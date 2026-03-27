import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runOutreach } from '@/lib/agents/outreach'

// POST /api/reminders
// Called by Supabase Edge Function cron (hourly) or manually
// Finds appointments in the 48h and 24h windows and sends reminders
// Protected by CRON_SECRET header

export async function POST(request: Request) {
  // Simple secret check — set CRON_SECRET in env vars
  const secret = request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()

  // 48h window: appointments starting between 47h and 49h from now
  const win48Start = new Date(now.getTime() + 47 * 60 * 60 * 1000)
  const win48End   = new Date(now.getTime() + 49 * 60 * 60 * 1000)

  // 24h window: appointments starting between 23h and 25h from now
  const win24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const win24End   = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  // Fetch both windows in parallel
  const [res48, res24] = await Promise.all([
    db.from('appointments')
      .select('id, clinic_id, patient_id, appointment_type, start_time, patients(full_name, email, phone_primary, preferred_language), clinics(name, slug, phone)')
      .eq('status', 'scheduled')
      .gte('start_time', win48Start.toISOString())
      .lte('start_time', win48End.toISOString()),
    db.from('appointments')
      .select('id, clinic_id, patient_id, appointment_type, start_time, patients(full_name, email, phone_primary, preferred_language), clinics(name, slug, phone)')
      .eq('status', 'scheduled')
      .gte('start_time', win24Start.toISOString())
      .lte('start_time', win24End.toISOString()),
  ])

  const appts48 = res48.data || []
  const appts24 = res24.data || []

  // Avoid double-sending — check outreach_log for already-sent reminders
  const allApptIds = [...appts48, ...appts24].map(a => a.id)
  const { data: alreadySent } = await db
    .from('outreach_log')
    .select('appointment_id, outreach_type')
    .in('appointment_id', allApptIds)
    .in('outreach_type', ['reminder_48h', 'reminder_24h'])

  const sentSet = new Set(
    (alreadySent || []).map(r => `${r.appointment_id}:${r.outreach_type}`)
  )

  const results: { appointmentId: string; type: string; patient: string; status: string }[] = []

  const processAppointment = async (appt: any, type: '48h' | '24h') => {
    const outreachType = type === '48h' ? 'reminder_48h' : 'reminder_24h'
    const key = `${appt.id}:${outreachType}`

    if (sentSet.has(key)) {
      results.push({ appointmentId: appt.id, type: outreachType, patient: 'already sent', status: 'skipped' })
      return
    }

    const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients
    const clinic  = Array.isArray(appt.clinics)  ? appt.clinics[0]  : appt.clinics

    if (!patient) {
      results.push({ appointmentId: appt.id, type: outreachType, patient: 'unknown', status: 'no patient data' })
      return
    }

    const appointmentTime = new Date(appt.start_time).toLocaleDateString('en-CA', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/Toronto',
    })

    // Prefer SMS if phone available, fallback to email
    const channel = patient.phone_primary ? 'sms' : patient.email ? 'email' : null

    if (!channel) {
      results.push({ appointmentId: appt.id, type: outreachType, patient: patient.full_name, status: 'no contact info' })
      return
    }

    try {
      const result = await runOutreach({
        clinicId:         appt.clinic_id,
        patientId:        appt.patient_id,
        patientName:      patient.full_name,
        patientPhone:     patient.phone_primary,
        patientEmail:     patient.email,
        preferredLanguage: patient.preferred_language || 'en',
        outreachType,
        channel,
        appointmentType:  appt.appointment_type,
        appointmentTime,
        clinicName:       clinic?.name,
        clinicPhone:      clinic?.phone,
        appointmentId:    appt.id,
      })

      results.push({
        appointmentId: appt.id,
        type:          outreachType,
        patient:       patient.full_name,
        status:        result.stubbed ? 'stubbed' : result.success ? 'sent' : `error: ${result.error}`,
      })
    } catch (err) {
      results.push({
        appointmentId: appt.id,
        type:          outreachType,
        patient:       patient.full_name,
        status:        `error: ${err instanceof Error ? err.message : 'unknown'}`,
      })
    }
  }

  // Process all appointments
  await Promise.all([
    ...appts48.map(a => processAppointment(a, '48h')),
    ...appts24.map(a => processAppointment(a, '24h')),
  ])

  const sent    = results.filter(r => r.status === 'sent').length
  const stubbed = results.filter(r => r.status === 'stubbed').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors  = results.filter(r => r.status.startsWith('error')).length

  console.log(`[REMINDERS] 48h: ${appts48.length} | 24h: ${appts24.length} | sent: ${sent} | stubbed: ${stubbed} | skipped: ${skipped} | errors: ${errors}`)

  return NextResponse.json({
    success: true,
    summary: { appointments48h: appts48.length, appointments24h: appts24.length, sent, stubbed, skipped, errors },
    results,
  })
}

// GET — health check / preview without sending
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const preview = searchParams.get('preview') === 'true'

  if (!preview) {
    return NextResponse.json({ status: 'Reminder cron endpoint. POST to run, GET?preview=true to preview.' })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const win48Start = new Date(now.getTime() + 47 * 60 * 60 * 1000)
  const win48End   = new Date(now.getTime() + 49 * 60 * 60 * 1000)
  const win24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const win24End   = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const [res48, res24] = await Promise.all([
    db.from('appointments').select('id, appointment_type, start_time, patients(full_name)').eq('status', 'scheduled').gte('start_time', win48Start.toISOString()).lte('start_time', win48End.toISOString()),
    db.from('appointments').select('id, appointment_type, start_time, patients(full_name)').eq('status', 'scheduled').gte('start_time', win24Start.toISOString()).lte('start_time', win24End.toISOString()),
  ])

  return NextResponse.json({
    preview: true,
    window_48h: { count: (res48.data || []).length, appointments: res48.data },
    window_24h: { count: (res24.data || []).length, appointments: res24.data },
  })
}
