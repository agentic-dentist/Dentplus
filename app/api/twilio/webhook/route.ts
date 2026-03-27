import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { toE164 } from '@/lib/utils/phone'

// POST /api/twilio/webhook
// Twilio sends a POST when a patient replies to an SMS reminder
// Configure in Twilio console: Messaging → Phone Numbers → Webhook URL
// Set to: https://dentplus.ca/api/twilio/webhook (POST)
//
// Patient replies:
//   YES / OUI / Y / O → confirm appointment
//   NO  / NON / N     → cancel appointment

const CONFIRM_KEYWORDS = ['yes', 'oui', 'y', 'o', 'confirm', 'confirmer', '1']
const CANCEL_KEYWORDS  = ['no', 'non', 'n', 'cancel', 'annuler', 'annule', '2']

function twimlResponse(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function POST(request: Request) {
  try {
    // Parse Twilio's form-encoded body
    const text   = await request.text()
    const params = new URLSearchParams(text)

    const from    = params.get('From')    || ''  // Patient's phone in E.164
    const body    = params.get('Body')    || ''  // Patient's reply text
    const to      = params.get('To')      || ''  // Our Twilio number

    const reply   = body.trim().toLowerCase()

    const isConfirm = CONFIRM_KEYWORDS.some(k => reply === k || reply.startsWith(k + ' '))
    const isCancel  = CANCEL_KEYWORDS.some(k => reply === k || reply.startsWith(k + ' '))

    if (!isConfirm && !isCancel) {
      // Unrecognized reply — send help message
      return twimlResponse(
        'Reply YES to confirm your appointment or NO to cancel. / Répondez OUI pour confirmer ou NON pour annuler.'
      )
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the patient by phone number
    // Try both formatted and raw versions
    const { data: patients } = await db
      .from('patients')
      .select('id, full_name, preferred_language, clinic_id')
      .or(`phone_primary.eq.${from},phone_primary.eq.${from.replace('+1', '')},phone_primary.eq.${from.slice(2)}`)
      .limit(1)

    if (!patients || patients.length === 0) {
      // Can't identify patient — generic response
      console.warn('[TWILIO WEBHOOK] Unknown patient phone:', from)
      return twimlResponse(
        'Your message was received. Please contact the clinic directly if you need assistance. / Message reçu. Contactez la clinique si vous avez besoin d\'aide.'
      )
    }

    const patient  = patients[0]
    const lang     = patient.preferred_language || 'en'
    const isFr     = lang === 'fr'

    // Find the most recent upcoming scheduled appointment for this patient
    const { data: appointments } = await db
      .from('appointments')
      .select('id, clinic_id, start_time, appointment_type, patient_confirmed, clinics(name, phone)')
      .eq('patient_id', patient.id)
      .eq('status', 'scheduled')
      .gt('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1)

    if (!appointments || appointments.length === 0) {
      return twimlResponse(
        isFr
          ? 'Aucun rendez-vous à venir trouvé. Contactez la clinique pour plus d\'info.'
          : 'No upcoming appointment found. Please contact the clinic for more information.'
      )
    }

    const appt   = appointments[0]
    const clinic = Array.isArray(appt.clinics) ? appt.clinics[0] : appt.clinics

    const apptTime = new Date(appt.start_time).toLocaleDateString(
      isFr ? 'fr-CA' : 'en-CA',
      { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto' }
    )

    if (isConfirm) {
      // Mark appointment as confirmed
      await db
        .from('appointments')
        .update({ patient_confirmed: true })
        .eq('id', appt.id)

      // Log the confirmation
      await db.from('outreach_log').insert({
        clinic_id:      appt.clinic_id,
        patient_id:     patient.id,
        outreach_type:  'confirmation_request',
        channel:        'sms',
        message_text:   body,
        status:         'confirmed',
        appointment_id: appt.id,
        language:       lang,
      })

      return twimlResponse(
        isFr
          ? `Merci ${patient.full_name.split(' ')[0]}! Votre rendez-vous du ${apptTime} est confirmé. À bientôt!`
          : `Thank you ${patient.full_name.split(' ')[0]}! Your appointment on ${apptTime} is confirmed. See you soon!`
      )

    } else {
      // Cancel the appointment
      await db
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.id)

      // Log the cancellation
      await db.from('outreach_log').insert({
        clinic_id:      appt.clinic_id,
        patient_id:     patient.id,
        outreach_type:  'reminder_24h',
        channel:        'sms',
        message_text:   body,
        status:         'cancelled_via_sms',
        appointment_id: appt.id,
        language:       lang,
      })

      const clinicPhone = clinic?.phone ? ` (${clinic.phone})` : ''

      return twimlResponse(
        isFr
          ? `Votre rendez-vous du ${apptTime} a été annulé. Pour rebooker, visitez notre portail ou appelez-nous${clinicPhone}.`
          : `Your appointment on ${apptTime} has been cancelled. To rebook, visit our patient portal or call us${clinicPhone}.`
      )
    }

  } catch (err) {
    console.error('[TWILIO WEBHOOK]', err)
    // Always return valid TwiML — Twilio will retry on 5xx
    return twimlResponse('Message received. Please contact the clinic directly.')
  }
}
