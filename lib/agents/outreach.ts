import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { audit } from '@/lib/audit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Message types ────────────────────────────────────────────────────────────

export type OutreachType =
  | 'slot_offer'          // Matchmaker found a slot — offer to waitlisted patient
  | 'reminder_48h'        // 48h before appointment
  | 'reminder_24h'        // 24h before appointment
  | 'confirmation_request' // Ask patient to confirm attendance

export type OutreachChannel = 'sms' | 'email'

export interface OutreachPayload {
  clinicId: string
  patientId: string
  patientName: string
  patientPhone: string | null
  patientEmail: string | null
  preferredLanguage: 'en' | 'fr'
  outreachType: OutreachType
  channel: OutreachChannel
  // Context depending on type
  appointmentType?: string
  appointmentTime?: string   // Human-readable e.g. "Tuesday March 24 at 3:00 PM"
  clinicName?: string
  clinicPhone?: string
  waitlistId?: string        // For slot_offer — patient needs to respond
  appointmentId?: string     // For reminders
}

export interface OutreachResult {
  success: boolean
  channel: OutreachChannel
  messageId?: string
  messageSid?: string        // Twilio SID
  previewText: string        // The actual message that would be sent
  error?: string
  stubbed: boolean           // true = Twilio/Resend not configured, message was generated but not sent
}

// ─── Message generator ────────────────────────────────────────────────────────
// Uses LLM to generate natural, bilingual, short messages
// Keeps SMS under 160 chars, email concise and professional

async function generateMessage(payload: OutreachPayload): Promise<string> {
  const lang = payload.preferredLanguage === 'fr' ? 'French' : 'English'
  const clinic = payload.clinicName || 'the clinic'
  const name = payload.patientName.split(' ')[0]

  let context = ''

  switch (payload.outreachType) {
    case 'slot_offer':
      context = `A cancellation just opened a ${payload.appointmentType} slot on ${payload.appointmentTime}. 
Offer this slot to ${name}. Tell them to log into their patient portal to accept or decline.
This is time-sensitive — another patient may take the slot.`
      break

    case 'reminder_48h':
      context = `Remind ${name} they have a ${payload.appointmentType} appointment at ${clinic} on ${payload.appointmentTime}.
Ask them to reply YES to confirm or NO to cancel. They can also manage their appointment in their patient portal.
Keep it short and warm.`
      break

    case 'reminder_24h':
      context = `Final reminder — ${name} has a ${payload.appointmentType} appointment TOMORROW at ${payload.appointmentTime} at ${clinic}.
Keep it brief. Ask them to reply YES to confirm or NO to cancel.`
      break

    case 'confirmation_request':
      context = `Ask ${name} to confirm their upcoming ${payload.appointmentType} appointment at ${payload.appointmentTime}.
Reply YES to confirm, NO to cancel. Simple and direct.`
      break
  }

  const isSms = payload.channel === 'sms'

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: `You write ${isSms ? 'SMS text messages' : 'short professional emails'} for a dental clinic.
Language: ${lang}
${isSms ? 'STRICT: Under 160 characters. No greetings, no sign-off. Direct and warm.' : 'Format: Subject line on first line, blank line, then 2-3 sentence body. Sign off with clinic name.'}
Never include links. Never mention DentPlus by name — use the clinic name only.
Tone: warm, professional, not robotic.`,
    messages: [{ role: 'user', content: context }]
  })

  const text = response.content.find(b => b.type === 'text')
  return text ? (text as Anthropic.TextBlock).text.trim() : ''
}

// ─── Twilio SMS stub ──────────────────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<{ sid: string } | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    // Twilio not configured — stub mode
    return null
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
      }
    )
    const data = await res.json() as { sid: string; error_message?: string }
    if (!res.ok) throw new Error(data.error_message || 'Twilio error')
    return { sid: data.sid }
  } catch (err) {
    console.error('[TWILIO]', err)
    return null
  }
}

// ─── Resend email stub ────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  content: string,
  clinicName: string
): Promise<{ id: string } | null> {
  const apiKey  = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || `noreply@dentplus.ca`

  if (!apiKey) {
    // Resend not configured — stub mode
    return null
  }

  // Split subject from body (LLM puts subject on first line)
  const lines   = content.split('\n').filter(l => l.trim())
  const subject = lines[0] || `Message from ${clinicName}`
  const body    = lines.slice(1).join('\n').trim()

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${clinicName} <${fromEmail}>`,
        to: [to],
        subject,
        text: body,
      }),
    })
    const data = await res.json() as { id: string; message?: string }
    if (!res.ok) throw new Error(data.message || 'Resend error')
    return { id: data.id }
  } catch (err) {
    console.error('[RESEND]', err)
    return null
  }
}

// ─── Main outreach function ───────────────────────────────────────────────────

export async function runOutreach(payload: OutreachPayload): Promise<OutreachResult> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let messageText = ''
  let stubbed = false
  let messageId: string | undefined
  let messageSid: string | undefined
  let error: string | undefined

  try {
    // ── Step 1: Generate message content ──────────────────────────────────
    messageText = await generateMessage(payload)

    if (!messageText) {
      throw new Error('Message generation returned empty content')
    }

    // ── Step 2: Send via appropriate channel ──────────────────────────────
    if (payload.channel === 'sms') {
      if (!payload.patientPhone) {
        throw new Error('No phone number on file for patient')
      }

      const result = await sendSms(payload.patientPhone, messageText)
      if (result) {
        messageSid = result.sid
      } else {
        // Twilio not configured — stub mode, message generated but not sent
        stubbed = true
        console.log(`[OUTREACH STUB - SMS] To: ${payload.patientPhone}\n${messageText}`)
      }

    } else if (payload.channel === 'email') {
      if (!payload.patientEmail) {
        throw new Error('No email on file for patient')
      }

      const result = await sendEmail(
        payload.patientEmail,
        messageText,
        payload.clinicName || 'Your Dental Clinic'
      )
      if (result) {
        messageId = result.id
      } else {
        // Resend not configured — stub mode
        stubbed = true
        console.log(`[OUTREACH STUB - EMAIL] To: ${payload.patientEmail}\n${messageText}`)
      }
    }

    // ── Step 3: Log to outreach_log ────────────────────────────────────────
    await db.from('outreach_log').insert({
      clinic_id:       payload.clinicId,
      patient_id:      payload.patientId,
      outreach_type:   payload.outreachType,
      channel:         payload.channel,
      message_text:    messageText,
      status:          stubbed ? 'stubbed' : 'sent',
      twilio_sid:      messageSid || null,
      resend_id:       messageId  || null,
      appointment_id:  payload.appointmentId || null,
      waitlist_id:     payload.waitlistId    || null,
      language:        payload.preferredLanguage,
    })

    // ── Step 4: Update matchmaker_run status if this is a slot offer ───────
    if (payload.outreachType === 'slot_offer' && payload.waitlistId) {
      await db
        .from('matchmaker_runs')
        .update({ status: 'outreach_sent' })
        .eq('clinic_id', payload.clinicId)
        .eq('top_candidate_id', payload.patientId)
        .eq('status', 'pending_outreach')
    }

    await audit({
      clinic_id:   payload.clinicId,
      action:      'outreach_sent',
      agent:       'outreach',
      entity_type: 'patient',
      metadata: {
        outreach_type: payload.outreachType,
        channel:       payload.channel,
        stubbed,
        appointment_id: payload.appointmentId,
        waitlist_id:    payload.waitlistId,
      },
      success: true,
    })

    return {
      success:     true,
      channel:     payload.channel,
      messageId,
      messageSid,
      previewText: messageText,
      stubbed,
    }

  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error'
    console.error('[OUTREACH]', error)

    await audit({
      clinic_id:    payload.clinicId,
      action:       'outreach_sent',
      agent:        'outreach',
      entity_type:  'patient',
      metadata:     { outreach_type: payload.outreachType, channel: payload.channel },
      success:      false,
      error_message: error,
    })

    return {
      success:     false,
      channel:     payload.channel,
      previewText: messageText,
      error,
      stubbed:     false,
    }
  }
}
