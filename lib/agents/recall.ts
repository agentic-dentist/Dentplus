import Anthropic from '@anthropic-ai/sdk'
import { toE164 } from '@/lib/utils/phone'
import { createClient } from '@supabase/supabase-js'
import { getCoverageRule, checkRecallEligibility } from '@/lib/data/insurance-intervals'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecallCandidate {
  patientId:          string
  patientName:        string
  email:              string | null
  phone:              string | null
  language:           'en' | 'fr'
  lastVisitDate:      string | null
  lastVisitType:      string | null
  insuranceProvider:  string | null
  monthsSinceVisit:   number | null
  servicesDue:        string[]       // e.g. ['cleaning', 'checkup']
  coverageStatus:     'covered' | 'likely_covered' | 'unknown'
  intervalMonths:     number
  alreadyContacted:   boolean        // contacted in last 30 days
}

export interface RecallResult {
  patientId:    string
  patientName:  string
  sent:         boolean
  channel:      'email' | 'sms' | null
  stubbed:      boolean
  messageText:  string
  error?:       string
}

export interface RecallRunSummary {
  clinicId:       string
  candidatesFound: number
  messagesSent:   number
  stubbed:        number
  errors:         number
  results:        RecallResult[]
}

// ─── Find recall candidates ───────────────────────────────────────────────────

export async function findRecallCandidates(
  clinicId: string,
): Promise<RecallCandidate[]> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all approved active patients
  const { data: patients } = await db
    .from('patients')
    .select('id, full_name, email, phone_primary, preferred_language')
    .eq('clinic_id', clinicId)
    .eq('intake_status', 'approved')
    .eq('is_active', true)

  if (!patients || patients.length === 0) return []

  const candidates: RecallCandidate[] = []
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  for (const patient of patients) {
    // Get last completed appointment
    const { data: lastAppts } = await db
      .from('appointments')
      .select('start_time, appointment_type, status')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patient.id)
      .in('status', ['completed', 'scheduled'])
      .order('start_time', { ascending: false })
      .limit(5)

    const lastCompleted = lastAppts?.find(a => a.status === 'completed')
    const hasUpcoming   = lastAppts?.some(a => {
      return a.status === 'scheduled' && new Date(a.start_time) > new Date()
    })

    // Skip if they already have an upcoming appointment
    if (hasUpcoming) continue

    // Get insurance
    const { data: insurance } = await db
      .from('patient_insurance')
      .select('provider_name')
      .eq('patient_id', patient.id)
      .eq('clinic_id', clinicId)
      .eq('coverage_order', 'primary')
      .maybeSingle()

    const insuranceProvider = insurance?.provider_name || null

    // Check recall eligibility for cleaning
    const cleaningCheck = checkRecallEligibility(
      lastCompleted?.start_time?.slice(0, 10) || null,
      'cleaning',
      insuranceProvider
    )

    // Skip if not yet due
    if (!cleaningCheck.due) continue

    // Check if already contacted recently (last 30 days)
    const { data: recentContact } = await db
      .from('recall_log')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patient.id)
      .gte('sent_at', thirtyDaysAgo.toISOString())
      .limit(1)

    const alreadyContacted = (recentContact?.length || 0) > 0
    if (alreadyContacted) continue

    candidates.push({
      patientId:         patient.id,
      patientName:       patient.full_name,
      email:             patient.email,
      phone:             patient.phone_primary,
      language:          (patient.preferred_language as 'en' | 'fr') || 'en',
      lastVisitDate:     lastCompleted?.start_time?.slice(0, 10) || null,
      lastVisitType:     lastCompleted?.appointment_type || null,
      insuranceProvider,
      monthsSinceVisit:  cleaningCheck.monthsSinceVisit,
      servicesDue:       ['cleaning'],
      coverageStatus:    cleaningCheck.coverageStatus,
      intervalMonths:    cleaningCheck.intervalMonths,
      alreadyContacted:  false,
    })
  }

  return candidates
}

// ─── Generate personalized recall message ─────────────────────────────────────

async function generateRecallMessage(
  candidate: RecallCandidate,
  clinicName: string,
  bookingUrl: string,
  channel: 'email' | 'sms'
): Promise<string> {
  const lang     = candidate.language === 'fr' ? 'French' : 'English'
  const name     = candidate.patientName.split(' ')[0]
  const isSms    = channel === 'sms'
  const rule     = getCoverageRule(candidate.insuranceProvider)

  // Build insurance context
  let insuranceContext = ''
  if (candidate.insuranceProvider && candidate.coverageStatus === 'covered') {
    insuranceContext = `The patient has ${candidate.insuranceProvider} insurance. Based on their plan, their cleaning is COVERED — this is a key selling point. Mention that it's covered and encourage them to use their benefit.`
  } else if (candidate.insuranceProvider && candidate.coverageStatus === 'likely_covered') {
    insuranceContext = `The patient has ${candidate.insuranceProvider} insurance. Their cleaning is likely covered based on the ${candidate.intervalMonths}-month interval typical of their plan. Mention this as a reason to book now, but don't guarantee it.`
  } else if (candidate.insuranceProvider) {
    insuranceContext = `The patient has ${candidate.insuranceProvider} insurance. Coverage details aren't confirmed — encourage them to check their benefits when booking.`
  } else {
    insuranceContext = `No insurance information on file. Focus on the health aspect and time since last visit.`
  }

  const visitContext = candidate.lastVisitDate
    ? `Their last cleaning was ${candidate.monthsSinceVisit} months ago (${candidate.lastVisitDate}).`
    : `No previous visit on record — this may be a new patient who hasn't booked yet.`

  const prompt = `Write a ${isSms ? 'text message' : 'recall email'} to ${name} from ${clinicName}.

Context:
- ${visitContext}
- ${insuranceContext}
- Booking link: ${bookingUrl}
- Services due: ${candidate.servicesDue.join(', ')}

Instructions:
${isSms
  ? `- SMS only: STRICT 160 character limit. Be warm but ultra concise.
- Include first name and booking link.
- If covered by insurance, lead with that.
- No subject line needed.`
  : `- Email format: Subject line on line 1, blank line, then body.
- Subject should be compelling and personalized.
- Body: 3-4 sentences max. Warm, professional, not robotic.
- If insurance is covered, make that prominent — people respond to "it's covered".
- Include the booking link naturally in the text.
- Sign off with ${clinicName}.`
}

Language: ${lang}
Tone: warm, caring, like a trusted healthcare provider — not a marketing blast.
Never mention DentPlus. Use clinic name only.
${candidate.insuranceProvider ? `Never guarantee coverage — use "typically covered", "should be covered", or "your ${candidate.insuranceProvider} plan usually covers".` : ''}
`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: isSms ? 100 : 300,
    messages:   [{ role: 'user', content: prompt }],
  })

  const block = response.content.find(b => b.type === 'text')
  return block ? (block as Anthropic.TextBlock).text.trim() : ''
}

// ─── Send via email ────────────────────────────────────────────────────────────

async function sendEmail(to: string, content: string, clinicName: string): Promise<{ id: string } | null> {
  if (!process.env.RESEND_API_KEY) return null
  const lines   = content.split('\n').filter(l => l.trim())
  const subject = lines[0] || `Time for your dental checkup — ${clinicName}`
  const body    = lines.slice(1).join('\n').trim()
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${clinicName} <noreply@dentplus.ca>`, to: [to], subject, text: body }),
    })
    const data = await res.json() as { id: string; message?: string }
    if (!res.ok) throw new Error(data.message || 'Resend error')
    return { id: data.id }
  } catch (err) {
    console.error('[RECALL EMAIL]', err)
    return null
  }
}

// ─── Send via SMS ──────────────────────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<{ sid: string } | null> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return null
  try {
    const creds = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body }).toString(),
      }
    )
    const data = await res.json() as { sid: string; error_message?: string }
    if (!res.ok) throw new Error(data.error_message || 'Twilio error')
    return { sid: data.sid }
  } catch (err) {
    console.error('[RECALL SMS]', err)
    return null
  }
}

// ─── Main recall runner ───────────────────────────────────────────────────────

export async function runRecall(
  clinicId: string,
  options: {
    dryRun?: boolean         // generate messages but don't send or log
    patientIds?: string[]    // run for specific patients only (manual trigger)
    channel?: 'email' | 'sms' | 'auto'  // auto = prefer email, fallback sms
  } = {}
): Promise<RecallRunSummary> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const channel  = options.channel || 'auto'
  const dryRun   = options.dryRun || false

  // Get clinic info
  const { data: clinic } = await db
    .from('clinics')
    .select('name, slug')
    .eq('id', clinicId)
    .single()

  const clinicName  = clinic?.name  || 'Your Dental Clinic'
  const clinicSlug  = clinic?.slug  || ''
  const bookingUrl  = `https://${clinicSlug}.dentplus.ca/book`

  // Find candidates
  let candidates = await findRecallCandidates(clinicId)

  // Filter to specific patients if manual trigger
  if (options.patientIds && options.patientIds.length > 0) {
    candidates = candidates.filter(c => options.patientIds!.includes(c.patientId))
  }

  const results: RecallResult[] = []
  let messagesSent = 0
  let stubbed      = 0
  let errors       = 0

  for (const candidate of candidates) {
    try {
      // Determine channel
      const useChannel: 'email' | 'sms' =
        channel === 'email' ? 'email' :
        channel === 'sms'   ? 'sms' :
        candidate.email ? 'email' : 'sms'

      // Check contact method available
      if (useChannel === 'email' && !candidate.email) {
        results.push({ patientId: candidate.patientId, patientName: candidate.patientName, sent: false, channel: null, stubbed: false, error: 'No email on file', messageText: '' })
        errors++
        continue
      }
      if (useChannel === 'sms') {
        const e164 = toE164(candidate.phone)
        if (!e164) {
          results.push({ patientId: candidate.patientId, patientName: candidate.patientName, sent: false, channel: null, stubbed: false, error: `Invalid phone number: ${candidate.phone}`, messageText: '' })
          errors++
          continue
        }
        candidate.phone = e164 // normalize for sending
      }

      // Generate message
      const messageText = await generateRecallMessage(candidate, clinicName, bookingUrl, useChannel)
      if (!messageText) {
        results.push({ patientId: candidate.patientId, patientName: candidate.patientName, sent: false, channel: useChannel, stubbed: false, error: 'Message generation failed', messageText: '' })
        errors++
        continue
      }

      let sent    = false
      let isStub  = false
      let sentId: string | null = null

      if (!dryRun) {
        if (useChannel === 'email') {
          const res = await sendEmail(candidate.email!, messageText, clinicName)
          sent    = true
          isStub  = !res
          sentId  = res?.id || null
        } else {
          const res = await sendSms(candidate.phone!, messageText)
          sent    = true
          isStub  = !res
          sentId  = res?.sid || null
        }

        // Log to recall_log
        await db.from('recall_log').insert({
          clinic_id:          clinicId,
          patient_id:         candidate.patientId,
          channel:            useChannel,
          message_text:       messageText,
          insurance_provider: candidate.insuranceProvider,
          coverage_status:    candidate.coverageStatus,
          services_due:       candidate.servicesDue,
          months_since_visit: candidate.monthsSinceVisit,
          last_visit_date:    candidate.lastVisitDate,
          status:             isStub ? 'stubbed' : 'sent',
          external_id:        sentId,
          sent_at:            new Date().toISOString(),
        })
      }

      results.push({
        patientId:   candidate.patientId,
        patientName: candidate.patientName,
        sent,
        channel:     useChannel,
        stubbed:     isStub,
        messageText,
      })

      if (isStub) stubbed++
      else if (sent) messagesSent++

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[RECALL]', candidate.patientName, msg)
      results.push({ patientId: candidate.patientId, patientName: candidate.patientName, sent: false, channel: null, stubbed: false, error: msg, messageText: '' })
      errors++
    }
  }

  return {
    clinicId,
    candidatesFound: candidates.length,
    messagesSent,
    stubbed,
    errors,
    results,
  }
}
