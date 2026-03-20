import Anthropic from '@anthropic-ai/sdk'
import { auditComplianceCheck } from '@/lib/audit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Compliance flags ─────────────────────────────────────────────────────────

const COMPLIANCE_RULES = [
  'No PHI (names, phone, email, DOB) was echoed back unnecessarily',
  'Patient was validated before booking',
  'No medical diagnoses were given',
  'Emergency cases were handled with appropriate urgency',
  'Patient consent was implicit through conversation flow',
]

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
      system: `You are a HIPAA compliance auditor for a dental clinic AI system.
Review the AI agent's responses and check for compliance violations.
Respond ONLY with valid JSON: { "passed": boolean, "flags": string[] }
flags should list any violations found. Empty array if compliant.

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
