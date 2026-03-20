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
    description: 'Look up a patient by name. Call this as soon as the patient gives their name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name_query: { type: 'string', description: 'Full or partial patient name' }
      },
      required: ['name_query']
    }
  },
  {
    name: 'get_patient_context',
    description: 'Fetch full patient context in one call: all upcoming appointments, last past appointment, and insurance on file. Call this immediately after identifying the patient — before responding to any request.',
    input_schema: {
      type: 'object' as const,
      properties: {
        external_ref: { type: 'string', description: 'Patient token from lookup_patient' }
      },
      required: ['external_ref']
    }
  },
  {
    name: 'get_available_slots',
    description: 'Get available appointment slots.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_type: {
          type: 'string',
          enum: ['cleaning', 'checkup', 'emergency', 'filling', 'consultation']
        },
        urgency: {
          type: 'string',
          enum: ['routine', 'urgent', 'emergency']
        }
      },
      required: ['appointment_type']
    }
  },
  {
    name: 'book_appointment',
    description: 'Book a new appointment for the patient.',
    input_schema: {
      type: 'object' as const,
      properties: {
        external_ref: { type: 'string' },
        appointment_type: { type: 'string' },
        start_time: { type: 'string', description: 'ISO 8601 datetime' },
        reason: { type: 'string' }
      },
      required: ['external_ref', 'appointment_type', 'start_time']
    }
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an appointment by ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: { type: 'string' },
        reason: { type: 'string' }
      },
      required: ['appointment_id']
    }
  },
  {
    name: 'register_patient',
    description: 'Register a new patient. Use only when lookup_patient returns no results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        full_name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        date_of_birth: { type: 'string', description: 'YYYY-MM-DD' }
      },
      required: ['full_name', 'phone']
    }
  }
]

type ToolInput = Record<string, string>
type DB = ReturnType<typeof createServerClient>

async function runTool(
  name: string,
  input: ToolInput,
  clinicId: string,
  db: DB
): Promise<string> {

  switch (name) {

    case 'lookup_patient': {
      const result = await lookupPatientSafe(input.name_query, clinicId)
      await auditPatientLookup(clinicId, input.name_query, result.found)
      return JSON.stringify(result)
    }

    case 'get_patient_context': {
      const validation = await validatePatientToken(input.external_ref, clinicId)
      if (!validation.valid || !validation.internalId) {
        return JSON.stringify({ error: 'Patient not found' })
      }

      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // Fetch all upcoming appointments
      const { data: upcoming } = await db
        .from('appointments')
        .select('id, start_time, end_time, appointment_type, status, reason')
        .eq('clinic_id', clinicId)
        .eq('patient_id', validation.internalId)
        .eq('status', 'scheduled')
        .gte('start_time', now.toISOString())
        .order('start_time')
        .limit(5)

      // Fetch last past appointment (within last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const { data: recent } = await db
        .from('appointments')
        .select('id, start_time, appointment_type, status')
        .eq('clinic_id', clinicId)
        .eq('patient_id', validation.internalId)
        .lt('start_time', now.toISOString())
        .gte('start_time', thirtyDaysAgo.toISOString())
        .order('start_time', { ascending: false })
        .limit(1)

      // Fetch insurance from patient record
      const { data: patient } = await db
        .from('patients')
        .select('insurance_provider, insurance_number')
        .eq('id', validation.internalId)
        .single()

      const formatTime = (iso: string) =>
        new Date(iso).toLocaleDateString('en-CA', {
          weekday: 'long', month: 'long', day: 'numeric',
          hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
        })

      // Also check yesterday's appointments (patient might say "my appointment today")
      const { data: todayPast } = await db
        .from('appointments')
        .select('id, start_time, appointment_type, status')
        .eq('clinic_id', clinicId)
        .eq('patient_id', validation.internalId)
        .gte('start_time', yesterday.toISOString())
        .lt('start_time', now.toISOString())
        .order('start_time', { ascending: false })
        .limit(1)

      await audit({
        clinic_id: clinicId,
        action: 'patient_lookup',
        agent: 'concierge',
        external_ref: input.external_ref,
        metadata: {
          upcoming_count: upcoming?.length ?? 0,
          has_insurance: !!patient?.insurance_provider
        },
        success: true
      })

      return JSON.stringify({
        upcoming_appointments: (upcoming || []).map(a => ({
          id: a.id,
          display_time: formatTime(a.start_time),
          iso_time: a.start_time,
          type: a.appointment_type,
          reason: a.reason
        })),
        recent_past_appointment: recent?.[0] ? {
          id: recent[0].id,
          display_time: formatTime(recent[0].start_time),
          type: recent[0].appointment_type,
          status: recent[0].status
        } : null,
        today_past_appointment: todayPast?.[0] ? {
          id: todayPast[0].id,
          display_time: formatTime(todayPast[0].start_time),
          type: todayPast[0].appointment_type
        } : null,
        insurance: patient?.insurance_provider
          ? { provider: patient.insurance_provider, note: 'Exact coverage details will be confirmed by the clinic before your appointment.' }
          : { provider: null, note: 'No insurance on file. You can provide it when you arrive.' }
      })
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
          const hours = isEmergency ? [8, 9, 10, 11] : [9, 10, 11, 14, 15, 16]
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
        await auditValidationFailed(clinicId, validation.reason || 'Invalid token')
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

      await auditBooking(clinicId, data.id, input.external_ref, input.appointment_type)

      const confirmTime = new Date(data.start_time).toLocaleDateString('en-CA', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
      })

      return JSON.stringify({ success: true, appointment_id: data.id, confirmation_time: confirmTime })
    }

    case 'cancel_appointment': {
      const { error } = await db
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', input.appointment_id)
        .eq('clinic_id', clinicId)

      if (error) return JSON.stringify({ success: false, error: 'Could not cancel. Please try again.' })

      await audit({
        clinic_id: clinicId,
        action: 'appointment_cancelled',
        agent: 'concierge',
        entity_type: 'appointment',
        entity_id: input.appointment_id,
        success: true
      })

      return JSON.stringify({ success: true, message: 'Appointment cancelled successfully.' })
    }

    case 'register_patient': {
      const result = await registerPatientSafe(
        clinicId, input.full_name, input.phone, input.email, input.date_of_birth
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

  const now = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: timezone
  })

  const urgencyNote = orchestratorContext.urgency === 'emergency'
    ? '\nURGENT: Patient may be in pain. Be fast, empathetic, and offer the earliest slot first.' : ''

  const system = `You are the AI front desk receptionist for ${clinicName}, a dental clinic in Montréal.${urgencyNote}

PERSONALITY:
You are warm, efficient, and human. You talk like a real receptionist — not a chatbot.
You are proactive: when you know something useful, you say it without being asked.
You never leave the patient at a dead end. Every response ends with a clear next step or question.

FORMATTING — strictly enforced:
- Plain text only. No markdown, no **bold**, no bullet points, no headers, no emojis.
- Maximum 3 short sentences per response.
- Present appointment options as numbered list: "1. Monday March 23 at 9 AM  2. Tuesday March 24 at 10 AM"
- Never repeat information the patient already gave you.

TOOL USAGE — strictly enforced:
1. When patient gives their name: call lookup_patient immediately.
2. When patient is identified: call get_patient_context immediately — before responding to their request.
3. Use the context to answer proactively. If they say "cancel my appointment", you already know which ones they have — list them and ask which one.
4. For billing/insurance questions: get_patient_context has insurance info. Give what you know, note that exact coverage is confirmed by the clinic.
5. To book: always call book_appointment with the patient's external_ref.
6. To cancel: call cancel_appointment with the appointment ID from context.
7. To reschedule: cancel first, then get_available_slots, then book.

EXAMPLE — patient says "cancel my appointment":
BAD: "I couldn't find any appointments for you."
GOOD: "I can see you have two upcoming appointments — an emergency on Monday March 23 at 9 AM and a consultation the same day at 1 PM. Which one would you like to cancel?"

EXAMPLE — patient says "do I have an appointment":
BAD: "Please provide more information."
GOOD: "Yes, you have a cleaning scheduled for Friday March 27 at 10 AM. Would you like to confirm, reschedule, or cancel it?"

Current date and time: ${now}
Respond in the same language as the patient. French or English — follow their lead.`

  let msgs = messages
  let finalText = ''

  for (let i = 0; i < 15; i++) {
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
          const result = await runTool(block.name, block.input as ToolInput, clinicId, db)
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
