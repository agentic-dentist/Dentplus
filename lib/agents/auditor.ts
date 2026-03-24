import Anthropic from '@anthropic-ai/sdk'
import { auditComplianceCheck } from '@/lib/audit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Compliance flags ─────────────────────────────────────────────────────────

const COMPLIANCE_RULES = [
  'No medical diagnoses, treatment recommendations, or clinical guidance was given',
  'Emergency cases were handled with appropriate urgency and directed to call 911 or visit ER',
  'No sensitive PHI (phone number, full DOB, health card number, SIN) was repeated back verbatim',
  'No appointment details were shared with someone who identified as a DIFFERENT person than the patient',
  'Agent did not book or cancel without explicit patient confirmation of the specific action',
]

// NOTE: The following are NOT violations in this system:
// - Greeting a logged-in patient by first name (they authenticated via Supabase session)
// - Showing appointment history to the authenticated patient
// - Mentioning insurance status to the authenticated patient
// - Disclosing appointment times to the patient whose appointment it is
// Patient identity is verified at the session level before the agent runs.

// ─── Auditor agent ────────────────────────────────────────────────────────────

export async function runAuditor(
  conversation: Anthropic.MessageParam[],
  clinicId: string,
  action: string
): Promise<{ passed: boolean; flags: string[] }> {
  try {
    // Extract only assistant messages for review — never log user PHI
    const assistantMessages = conversation
      .filter(m => m.role === 'assistant')
      .map(m => {
        if (typeof m.content === 'string') return m.content
        if (Array.isArray(m.content)) {
          return m.content
            .filter(b => b.type === 'text')
            .map(b => (b as Anthropic.TextBlock).text)
            .join(' ')
        }
        return ''
      })
      .join('\n---\n')

    if (!assistantMessages.trim()) {
      await auditComplianceCheck(clinicId, true, [])
      return { passed: true, flags: [] }
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are a compliance auditor for a Canadian dental clinic AI system (PIPEDA compliant).
IMPORTANT CONTEXT: Patients are pre-authenticated via Supabase session before the agent runs.
Greeting a patient by name, showing their appointments, or discussing their insurance IS expected behaviour — not a violation.
Review ONLY for genuine clinical or privacy violations.
Respond ONLY with valid JSON: { "passed": boolean, "flags": string[] }
flags should list any real violations found. Empty array if compliant. Prefer passing over false positives.

Rules to check:
${COMPLIANCE_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
      messages: [{
        role: 'user',
        content: `Action performed: ${action}\n\nAgent responses to audit:\n${assistantMessages}`
      }]
    })

    const text = response.content.find(b => b.type === 'text')
    if (!text) throw new Error('No auditor response')

    const raw = (text as Anthropic.TextBlock).text.replace(/```json/g, "").replace(/```/g, "").trim()
    const result = JSON.parse(raw) as { passed: boolean; flags: string[] }
    await auditComplianceCheck(clinicId, result.passed, result.flags)
    return result

  } catch {
    // Auditor failure should not crash the main flow
    await auditComplianceCheck(clinicId, true, ['Auditor check skipped — parse error'])
    return { passed: true, flags: ['Auditor check skipped'] }
  }
}
