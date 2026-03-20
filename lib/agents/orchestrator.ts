import Anthropic from '@anthropic-ai/sdk'
import { auditRouting } from '@/lib/audit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Intent types ─────────────────────────────────────────────────────────────

export type Intent =
  | 'book_appointment'
  | 'cancel_appointment'
  | 'reschedule_appointment'
  | 'patient_inquiry'
  | 'emergency'
  | 'insurance_inquiry'
  | 'general_question'
  | 'greeting'

export interface OrchestratorResult {
  intent: Intent
  urgency: 'routine' | 'urgent' | 'emergency'
  routeTo: 'concierge' | 'diagnostician' | 'liaison'
  context: string
}

// ─── Classify intent using fast model ────────────────────────────────────────

export async function classifyIntent(
  message: string,
  clinicId: string
): Promise<OrchestratorResult> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You are an intent classifier for a dental clinic AI system.
Classify the user message into exactly one intent and urgency level.
Respond ONLY with valid JSON matching this exact schema:
{
  "intent": "book_appointment" | "cancel_appointment" | "reschedule_appointment" | "patient_inquiry" | "emergency" | "insurance_inquiry" | "general_question" | "greeting",
  "urgency": "routine" | "urgent" | "emergency",
  "routeTo": "concierge" | "diagnostician" | "liaison",
  "context": "one sentence summary"
}

Routing rules:
- emergency → diagnostician (severe pain, bleeding, trauma, swelling)
- book/cancel/reschedule/patient_inquiry → concierge
- insurance_inquiry → concierge
- general_question/greeting → concierge

Urgency rules:
- emergency: severe pain, trauma, bleeding, abscess, broken tooth
- urgent: moderate pain, lost filling, sensitivity
- routine: everything else`,
      messages: [{ role: 'user', content: message }]
    })

    const text = response.content.find(b => b.type === 'text')
    if (!text) throw new Error('No response from classifier')

    const result = JSON.parse((text as Anthropic.TextBlock).text) as OrchestratorResult

    // Audit the routing decision
    await auditRouting(clinicId, result.intent, result.routeTo)

    return result
  } catch {
    // Fallback — route to concierge if classification fails
    return {
      intent: 'general_question',
      urgency: 'routine',
      routeTo: 'concierge',
      context: 'Classification failed — defaulting to concierge'
    }
  }
}
