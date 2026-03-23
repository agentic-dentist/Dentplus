import { createClient } from '@supabase/supabase-js'
import { audit } from '@/lib/audit'

interface CancelledSlot {
  clinicId: string
  appointmentType: string
  startTime: string   // ISO string
  endTime: string     // ISO string
  providerId: string | null
}

interface WaitlistCandidate {
  waitlistId: string
  patientId: string
  externalRef: string
  fullName: string
  phone: string | null
  urgency: string
  anyTime: boolean
  preferredDays: string[]
  preferredTimes: string[]
  waitingSince: string
  score: number
}

// Day number → name mapping for preference matching
const DOW_NAMES: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday'
}

// Map slot hour → time-of-day bucket
const getTimeBucket = (hour: number): string => {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

// Score a waitlist candidate against the freed slot
const scoreCandidate = (
  candidate: Omit<WaitlistCandidate, 'score'>,
  slotDate: Date
): number => {
  let score = 0

  // Urgency — urgent patients always ranked higher
  if (candidate.urgency === 'urgent') score += 100

  // Preference match — any time is always a match
  if (candidate.anyTime) {
    score += 50
  } else {
    const slotDow = DOW_NAMES[slotDate.getDay()]
    const slotBucket = getTimeBucket(slotDate.getHours())

    const dayMatch = candidate.preferredDays.includes(slotDow)
    const timeMatch = candidate.preferredTimes.includes(slotBucket)

    if (dayMatch && timeMatch) score += 50
    else if (dayMatch || timeMatch) score += 25
    // No match — score stays as-is (urgency still counts)
  }

  // Wait time — longer wait = higher priority (max 30 pts for 30+ days)
  const daysWaiting = Math.floor(
    (Date.now() - new Date(candidate.waitingSince).getTime()) / 86400000
  )
  score += Math.min(daysWaiting, 30)

  return score
}

export async function runMatchmaker(slot: CancelledSlot): Promise<{
  matched: boolean
  candidateCount: number
  topCandidate: WaitlistCandidate | null
  runId: string | null
}> {
  // Must use service role — matchmaker runs async without a user session, anon key + RLS blocks reads
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const slotDate = new Date(slot.startTime)

  await audit({
    clinic_id: slot.clinicId,
    action: 'matchmaker_run_started',
    agent: 'matchmaker',
    metadata: {
      appointment_type: slot.appointmentType,
      slot_start: slot.startTime,
      provider_id: slot.providerId,
    },
    success: true,
  })

  // ── Step 1: Find waitlist candidates for this appointment type ──────────
  const { data: waitlistRows } = await db
    .from('waiting_list')
    .select(`
      id,
      patient_id,
      urgency,
      any_time,
      preferred_days,
      preferred_times,
      created_at,
      patients (
        id,
        external_ref,
        full_name,
        phone_primary
      )
    `)
    .eq('clinic_id', slot.clinicId)
    .eq('appointment_type', slot.appointmentType)
    .eq('status', 'waiting')
    .order('urgency', { ascending: false })  // urgent first
    .order('created_at', { ascending: true }) // then FIFO

  if (!waitlistRows || waitlistRows.length === 0) {
    await audit({
      clinic_id: slot.clinicId,
      action: 'matchmaker_no_candidates',
      agent: 'matchmaker',
      metadata: { appointment_type: slot.appointmentType },
      success: true,
    })
    return { matched: false, candidateCount: 0, topCandidate: null, runId: null }
  }

  // ── Step 2: Score each candidate ────────────────────────────────────────
  const candidates: WaitlistCandidate[] = waitlistRows
    .map(row => {
      const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients
      if (!patient) return null

      const base = {
        waitlistId: row.id,
        patientId: row.patient_id,
        externalRef: (patient as { external_ref: string }).external_ref,
        fullName: (patient as { full_name: string }).full_name,
        phone: (patient as { phone_primary: string | null }).phone_primary,
        urgency: row.urgency,
        anyTime: row.any_time,
        preferredDays: row.preferred_days || [],
        preferredTimes: row.preferred_times || [],
        waitingSince: row.created_at,
      }

      return { ...base, score: scoreCandidate(base, slotDate) }
    })
    .filter(Boolean) as WaitlistCandidate[]

  if (candidates.length === 0) {
    return { matched: false, candidateCount: 0, topCandidate: null, runId: null }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)
  const top = candidates[0]

  await audit({
    clinic_id: slot.clinicId,
    action: 'matchmaker_candidates_scored',
    agent: 'matchmaker',
    metadata: {
      appointment_type: slot.appointmentType,
      candidate_count: candidates.length,
      top_score: top.score,
      top_urgency: top.urgency,
    },
    success: true,
  })

  // ── Step 3: Log run to matchmaker_runs ──────────────────────────────────
  const { data: run } = await db
    .from('matchmaker_runs')
    .insert({
      clinic_id: slot.clinicId,
      appointment_type: slot.appointmentType,
      slot_start: slot.startTime,
      slot_end: slot.endTime,
      provider_id: slot.providerId,
      candidates_found: candidates.length,
      top_candidate_id: top.patientId,
      top_score: top.score,
      status: 'pending_outreach',  // outreach agent picks this up next
    })
    .select('id')
    .single()

  const runId = run?.id ?? null

  // ── Step 4: Mark top candidate as "offered" in waiting_list ─────────────
  // Prevents double-offering if matchmaker runs again before patient responds
  await db
    .from('waiting_list')
    .update({
      status: 'offered',
      offered_at: new Date().toISOString(),
      offered_slot_start: slot.startTime,
      offered_slot_end: slot.endTime,
    })
    .eq('id', top.waitlistId)

  await audit({
    clinic_id: slot.clinicId,
    action: 'waitlist_offered',
    agent: 'matchmaker',
    entity_type: 'waiting_list',
    entity_id: top.waitlistId,
    external_ref: top.externalRef,
    metadata: {
      run_id: runId,
      score: top.score,
      slot_start: slot.startTime,
      appointment_type: slot.appointmentType,
    },
    success: true,
  })

  return {
    matched: true,
    candidateCount: candidates.length,
    topCandidate: top,
    runId,
  }
}
