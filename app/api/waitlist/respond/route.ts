import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runMatchmaker } from '@/lib/agents/matchmaker'

export async function POST(request: Request) {
  try {
    const { waitlistId, action, clinicId, patientId } = await request.json()
    if (!waitlistId || !action || !clinicId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch the waitlist entry
    const { data: entry } = await db
      .from('waiting_list')
      .select('id, appointment_type, offered_slot_start, offered_slot_end, patient_id')
      .eq('id', waitlistId)
      .eq('clinic_id', clinicId)
      .single()

    if (!entry) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    if (action === 'accept') {
      // ── Create the actual appointment ──────────────────────────────────
      const { data: apt, error: aptError } = await db
        .from('appointments')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          appointment_type: entry.appointment_type,
          start_time: entry.offered_slot_start,
          end_time: entry.offered_slot_end,
          status: 'scheduled',
          booked_via: 'matchmaker',
          reason: 'Booked via waitlist offer',
        })
        .select('id')
        .single()

      if (aptError || !apt) {
        console.error('[WAITLIST ACCEPT] appointment insert error:', aptError)
        return NextResponse.json({ error: 'Failed to book appointment' }, { status: 500 })
      }

      // ── Mark waitlist entry as confirmed ──────────────────────────────
      await db
        .from('waiting_list')
        .update({ status: 'confirmed' })
        .eq('id', waitlistId)

      // ── Update matchmaker run ──────────────────────────────────────────
      await db
        .from('matchmaker_runs')
        .update({ status: 'confirmed' })
        .eq('clinic_id', clinicId)
        .eq('top_candidate_id', patientId)
        .eq('status', 'pending_outreach')

      return NextResponse.json({ success: true, appointment_id: apt.id })

    } else if (action === 'decline') {
      // ── Mark as declined ──────────────────────────────────────────────
      await db
        .from('waiting_list')
        .update({ status: 'declined' })
        .eq('id', waitlistId)

      await db
        .from('matchmaker_runs')
        .update({ status: 'declined' })
        .eq('clinic_id', clinicId)
        .eq('top_candidate_id', patientId)
        .eq('status', 'pending_outreach')

      // ── Re-run Matchmaker with next candidate ─────────────────────────
      if (entry.offered_slot_start && entry.offered_slot_end) {
        runMatchmaker({
          clinicId,
          appointmentType: entry.appointment_type,
          startTime: entry.offered_slot_start,
          endTime: entry.offered_slot_end,
          providerId: null,
        }).catch(err => console.error('[MATCHMAKER RE-RUN]', err))
      }

      return NextResponse.json({ success: true })

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[WAITLIST RESPOND]', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
