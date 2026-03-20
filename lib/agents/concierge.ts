import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import {
  lookupPatientSafe,
  validatePatientToken,
  registerPatientSafe
} from '@/lib/phi'
import {
  auditPatientLookup,
  auditBooking,
  auditValidationFailed,
  audit
} from '@/lib/audit'
import type { OrchestratorResult } from './orchestrator'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_patient',
    description: 'Look up an existing patient by name. Returns a secure token (external_ref), never raw PHI.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name_query: { type: 'string', description: 'Full or partial patient name' }
      },
      required: ['name_query']
    }
  },
  {
    name: 'validate_patient',
    description: 'Validate a patient token before booking. Must be called before book_appointment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        external_ref: { type: 'string', description: 'Patient token from lookup_patient' }
      },
      required: ['external_ref']
    }
  },
  {
    name: 'get_pending_appointment',
    description: 'Check if the patient already has a recently booked appointment in this session. Always call this before booking to avoid duplicates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        external_ref: { type: 'string', description: 'Patient token' }
      },
      required: ['external_ref']
    }
  },
  {
    name: 'get_available_slots',
    description: 'Get available appointment slots for the next 7 business days.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_type: {
          type: 'string',
          enum: ['cleaning', 'checkup', 'emergency', 'filling', 'consultation'],
          description: 'Type of appointment needed'
        },
        urgency: {
          type: 'string',
          enum: ['routine', 'urgent', 'emergency'],
          description: 'Urgency level affects slot priority'
        }
      },
      required: ['appointment_type']
    }
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment. Always call this before rebooking when the patient wants to change their slot.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: { type: 'string', description: 'Appointment ID to cancel' }
      },
      required: ['appointment_id']
    }
  },
  {
    name: 'book_appointment',
    description: 'Book an appointment. Always call get_pending_appointment first to check for duplicates. Requires validated external_ref.',
    input_schema: {
      type: 'object' as const,
      properties: {
        external_ref: { type: 'string', description: 'Validated patient token' },
        appointment_type: { type: 'string' },
        start_time: { type: 'string', description: 'ISO 8601 datetime from get_available_slots' },
        reason: { type: 'string', description: 'Reason for visit' }
      },
      required: ['external_ref', 'appointment_type', 'start_time']
    }
  },
  {
    name: 'register_patient',
    description: 'Register a new patient. Returns a secure token only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        full_name: { type: 'string' },
        phone: { type: 'string', description: 'Canadian format: 514-555-0100' },
        email: { type: 'string' },
        date_of_birth: { type: 'string', description: 'YYYY-MM-DD' }
      },
      required: ['full_name', 'phone']
    }
  }
]

type ToolInput = Record<string, string>
type DB = ReturnType<typeof createServerClient>

// Track last booked appointment per conversation session
const sessionBookings = new Map<string, { appointment_id: string; start_time: string; external_ref: string }>()

async function runTool(
  name: string,
  input: ToolInput,
  clinicId: string,
  db: DB,
  sessionKey: string
): Promise<string> {

  switch (name) {

    case 'lookup_patient': {
      const result = await lookupPatientSafe(input.name_query, clinicId)
      await auditPatientLookup(clinicId, input.name_query, result.found)
      return JSON.stringify(result)
    }

    case 'validate_patient': {
      const result = await validatePatientToken(input.external_ref, clinicId)
      if (!result.valid) {
        await auditValidationFailed(clinicId, result.reason || 'Unknown reason')
      } else {
        await audit({
          clinic_id: clinicId,
          action: 'patient_validated',
          agent: 'concierge',
          entity_type: 'patient',
          external_ref: input.external_ref,
          success: true
        })
      }
      return JSON.stringify({ valid: result.valid, reason: result.reason })
    }


    case 'get_pending_appointment': {
      const pending = sessionBookings.get(`${sessionKey}:${input.external_ref}`)
      if (pending) {
        return JSON.stringify({
          has_pending: true,
          appointment_id: pending.appointment_id,
          start_time: pending.start_time,
          message: 'Patient has a pending appointment this session. Cancel first to change.'
        })
      }
      const validation = await validatePatientToken(input.external_ref, clinicId)
      if (validation.valid && validation.internalId) {
        const now = new Date().toISOString()
        const { data } = await db
          .from('appointments')
          .select('id, start_time, appointment_type')
          .eq('clinic_id', clinicId)
          .eq('patient_id', validation.internalId)
          .eq('status', 'scheduled')
          .gte('start_time', now)
          .order('start_time')
          .limit(1)
        if (data && data.length > 0) {
          const apt = data[0]
          const displayTime = new Date(apt.start_time).toLocaleDateString('en-CA', {
            weekday: 'long', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
          })
          return JSON.stringify({
            has_pending: true,
            appointment_id: apt.id,
            start_time: apt.start_time,
            appointment_type: apt.appointment_type,
            display_time: displayTime,
            message: `Patient has a ${apt.appointment_type} on ${displayTime}. Cancel it first to change or cancel.`
          })
        }
      }
      return JSON.stringify({ has_pending: false, message: 'No upcoming appointments. Safe to book.' })
    }

    }

    case 'cancel_appointment': {
      const { error } = await db
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', input.appointment_id)
        .eq('clinic_id', clinicId)

      if (error) return JSON.stringify({ success: false, error: 'Could not cancel appointment.' })

      // Clear session booking
      for (const [key, val] of sessionBookings.entries()) {
        if (val.appointment_id === input.appointment_id) {
          sessionBookings.delete(key)
          break
        }
      }

      await audit({
        clinic_id: clinicId,
        action: 'appointment_cancelled',
        agent: 'concierge',
        entity_type: 'appointment',
        entity_id: input.appointment_id,
        success: true
      })

      return JSON.stringify({ success: true, message: 'Appointment cancelled. You can now book a new slot.' })
    }

    case 'get_available_slots': {
      const duration = input.appointment_type === 'filling' ? 90 : 60
      const isEmergency = input.urgency === 'emergency'
      const slots = []
      const checkDate = new Date()
      checkDate.setDate(checkDate.getDate() + (isEmergency ? 0 : 1))
      let daysChecked = 0

      while (slots.length < (isEmergency ? 3 : 6) && daysChecked < 14) {
        const day = checkDate.getDay()
        if (day !== 0 && day !== 6) {
          const hours = isEmergency ? [8, 9, 10] : [9, 10, 11, 14, 15, 16]
          for (const hour of hours) {
            const slotStart = new Date(checkDate)
            slotStart.setHours(hour, 0, 0, 0)
            const slotEnd = new Date(slotStart.getTime() + duration * 60000)

            const { data: conflict } = await db
              .from('appointments')
              .select('id')
              .eq('clinic_id', clinicId)
              .eq('status', 'scheduled')
              .lt('start_time', slotEnd.toISOString())
              .gt('end_time', slotStart.toISOString())
              .limit(1)

            if (!conflict || conflict.length === 0) {
              slots.push({
                datetime: slotStart.toISOString(),
                display: slotStart.toLocaleDateString('en-CA', {
                  weekday: 'long', month: 'long', day: 'numeric',
                  hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
                }),
                duration_minutes: duration
              })
              if (slots.length >= (isEmergency ? 3 : 6)) break
            }
          }
        }
        checkDate.setDate(checkDate.getDate() + 1)
        daysChecked++
      }

      await audit({
        clinic_id: clinicId,
        action: 'slots_queried',
        agent: 'concierge',
        metadata: { appointment_type: input.appointment_type, slots_found: slots.length },
        success: true
      })

      return JSON.stringify({ slots })
    }

    case 'book_appointment': {
      const validation = await validatePatientToken(input.external_ref, clinicId)
      if (!validation.valid || !validation.internalId) {
        await auditValidationFailed(clinicId, validation.reason || 'Token invalid at booking time')
        return JSON.stringify({ success: false, error: validation.reason || 'Patient validation failed' })
      }

      const startTime = new Date(input.start_time)
      const duration = input.appointment_type === 'filling' ? 90 : 60
      const endTime = new Date(startTime.getTime() + duration * 60000)

      const { data, error } = await db
        .from('appointments')
        .insert({
          clinic_id: clinicId,
          patient_id: validation.internalId,
          appointment_type: input.appointment_type,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          reason: input.reason || '',
          status: 'scheduled',
          booked_via: 'web_agent'
        })
        .select('id, start_time, appointment_type')
        .single()

      if (error || !data) {
        return JSON.stringify({ success: false, error: 'Booking failed. Please try again.' })
      }

      // Track in session to prevent duplicates
      sessionBookings.set(`${sessionKey}:${input.external_ref}`, {
        appointment_id: data.id,
        start_time: data.start_time,
        external_ref: input.external_ref
      })

      await auditBooking(clinicId, data.id, input.external_ref, input.appointment_type)

      const confirmTime = new Date(data.start_time).toLocaleDateString('en-CA', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
      })

      return JSON.stringify({
        success: true,
        appointment_id: data.id,
        confirmation_time: confirmTime
      })
    }

    case 'register_patient': {
      const result = await registerPatientSafe(
        clinicId,
        input.full_name,
        input.phone,
        input.email,
        input.date_of_birth
      )

      await audit({
        clinic_id: clinicId,
        action: result.success ? 'patient_registered' : 'patient_validation_failed',
        agent: 'concierge',
        entity_type: 'patient',
        external_ref: result.external_ref,
        metadata: { has_email: !!input.email },
        success: result.success,
        error_message: result.error
      })

      return JSON.stringify(result.success
        ? { success: true, external_ref: result.external_ref }
        : { success: false, error: result.error }
      )
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

export async function runConcierge(
  messages: Anthropic.MessageParam[],
  clinicId: string,
  clinicName: string,
  timezone: string,
  orchestratorContext: OrchestratorResult
): Promise<string> {
  const db = createServerClient()
  const sessionKey = `${clinicId}:${Date.now().toString(36)}`

  const now = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: timezone
  })

  const urgencyInstruction = orchestratorContext.urgency === 'emergency'
    ? '\nEMERGENCY: Patient may have severe pain or trauma. Offer earliest available slot immediately.' : ''

  const system = `You are the AI front desk assistant for ${clinicName}, a dental clinic in Montréal, Québec.
${urgencyInstruction}

FORMATTING RULES — strictly follow:
- Never use markdown: no **bold**, no *italic*, no bullet points with *, no headers with #
- Never use emojis
- Write in plain conversational sentences only
- Keep responses short and clear

BOOKING RULES — strictly follow:
1. Always call get_pending_appointment before book_appointment
2. If patient already has a pending appointment and wants to change: call cancel_appointment first, then book_appointment
3. Never book twice — one appointment per conversation unless the previous was cancelled
4. Always call validate_patient before book_appointment
5. Never repeat PHI back to the patient

Conversation flow:
1. Greet, ask reason for visit
2. New or returning patient?
3. Returning: lookup_patient → validate_patient → get_pending_appointment → proceed
4. New: collect name + phone → register_patient → proceed
5. get_available_slots for their type
6. Present 3 options clearly numbered: "1. Monday March 23 at 9:00 AM, 2. ..."
7. When they choose a number: get_pending_appointment → book_appointment
8. If they want to change: cancel_appointment → book_appointment with new slot
9. Confirm once with date and time only

Appointment types: cleaning, checkup, filling, consultation, emergency
Current date and time: ${now}

Respond in the same language as the patient (French or English). Be warm and concise.`

  let msgs = messages
  let finalText = ''

  for (let i = 0; i < 12; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: msgs,
      tools: TOOLS
    })

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text')
      finalText = textBlock ? (textBlock as Anthropic.TextBlock).text : ''
      break
    }

    if (response.stop_reason === 'tool_use') {
      msgs = [...msgs, { role: 'assistant', content: response.content }]
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await runTool(block.name, block.input as ToolInput, clinicId, db, sessionKey)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
        }
      }

      msgs = [...msgs, { role: 'user', content: toolResults }]
      continue
    }

    break
  }

  return finalText
}
