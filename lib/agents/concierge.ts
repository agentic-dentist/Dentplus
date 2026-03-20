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

// ─── Tool definitions ─────────────────────────────────────────────────────────

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
    name: 'book_appointment',
    description: 'Book an appointment. Requires validated external_ref from validate_patient.',
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
    description: 'Register a new patient. Returns a secure token, never stores raw PHI in agent memory.',
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

// ─── Tool execution ───────────────────────────────────────────────────────────

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
      // Return validation result but NEVER the internal id
      return JSON.stringify({ valid: result.valid, reason: result.reason })
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
                display: slotStart.toLocaleDateString('fr-CA', {
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

      return JSON.stringify({ slots, message: isEmergency ? 'Emergency slots — earliest available' : 'Available slots' })
    }

    case 'book_appointment': {
      // Step 1: Re-validate token server-side (never trust client-passed tokens)
      const validation = await validatePatientToken(input.external_ref, clinicId)
      if (!validation.valid || !validation.internalId) {
        await auditValidationFailed(clinicId, validation.reason || 'Token invalid at booking time')
        return JSON.stringify({ success: false, error: validation.reason || 'Patient validation failed' })
      }

      // Step 2: Book using internal id (never exposed to agent)
      const startTime = new Date(input.start_time)
      const duration = input.appointment_type === 'filling' ? 90 : 60
      const endTime = new Date(startTime.getTime() + duration * 60000)

      const { data, error } = await db
        .from('appointments')
        .insert({
          clinic_id: clinicId,
          patient_id: validation.internalId,  // internal id used here only
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

      // Step 3: Audit with token, never internal id
      await auditBooking(clinicId, data.id, input.external_ref, input.appointment_type)

      const confirmTime = new Date(data.start_time).toLocaleDateString('fr-CA', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
      })

      return JSON.stringify({
        success: true,
        appointment_id: data.id,
        confirmation_time: confirmTime,
        message: 'Appointment confirmed'
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

      // Return token only — never echo back the PHI
      return JSON.stringify(result.success
        ? { success: true, external_ref: result.external_ref, message: 'Patient registered successfully' }
        : { success: false, error: result.error }
      )
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

// ─── Concierge agent ──────────────────────────────────────────────────────────

export async function runConcierge(
  messages: Anthropic.MessageParam[],
  clinicId: string,
  clinicName: string,
  timezone: string,
  orchestratorContext: OrchestratorResult
): Promise<string> {
  const db = createServerClient()

  const now = new Date().toLocaleDateString('fr-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: timezone
  })

  const urgencyInstruction = orchestratorContext.urgency === 'emergency'
    ? '\n⚠️ EMERGENCY DETECTED: Prioritize immediate appointment. Offer earliest available slot first.' : ''

  const system = `You are the AI front desk agent for ${clinicName}, a dental clinic in Montréal, Québec.
${urgencyInstruction}

Your role: Help patients book, cancel, or reschedule appointments efficiently and warmly.

SECURITY RULES — follow strictly:
1. Always call validate_patient before book_appointment
2. Never repeat or confirm PHI (phone numbers, dates of birth, emails) back to the patient
3. Use external_ref tokens for all patient operations — never ask for internal IDs
4. If validation fails, inform the patient politely and offer to register them

Conversation flow:
1. Greet warmly, ask reason for visit
2. Ask: new or returning patient?
3. Returning → lookup_patient by name → validate_patient → proceed
4. New → collect name + phone → register_patient → proceed
5. get_available_slots for their appointment type
6. Present 3 clear options (in French if patient writes in French)
7. book_appointment when they confirm
8. Confirm with time — no other PHI

Appointment types: cleaning, checkup, filling, consultation, emergency
Current date/time: ${now}

Respond in the same language as the patient (French or English).
Be warm, concise, professional. Never give medical diagnoses.`

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
