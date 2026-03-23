import { createServerClient } from '@/lib/supabase/server'

// ─── Audit event types ────────────────────────────────────────────────────────
export type AuditAction =
  | 'patient_lookup'
  | 'patient_lookup_failed'
  | 'patient_registered'
  | 'patient_validated'
  | 'patient_validation_failed'
  | 'appointment_booked'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'slots_queried'
  | 'agent_routed'
  | 'compliance_check_passed'
  | 'compliance_check_failed'
  | 'phi_access_attempted'
  | 'phi_access_denied'
  | 'conversation_started'
  | 'conversation_completed'
  | 'waitlist_joined'
  | 'waitlist_removed'
  | 'waitlist_offered'
  | 'waitlist_confirmed'
  | 'waitlist_expired'
  | 'insurance_validated'
  | 'insurance_gap_detected'
  | 'matchmaker_run_started'
  | 'matchmaker_candidates_scored'
  | 'matchmaker_no_candidates'
  | 'outreach_sent'
  | 'outreach_confirmed'
  | 'outreach_declined'
  | 'outreach_expired'
  | 'outreach_consent_blocked'
  | 'billing_fee_assessed'
  | 'billing_fee_waived'
  | 'billing_plan_offered'
  | 'triage_completed'
  | 'escalated_to_human'
  | 'recall_triggered'

export interface AuditEntry {
  clinic_id: string
  action: AuditAction
  agent: 'concierge' | 'diagnostician' | 'liaison' | 'auditor' | 'orchestrator' | 'matchmaker' | 'outreach' | 'billing' | 'insurance_validator' | 'system'
  entity_type?: string
  entity_id?: string
  external_ref?: string      // patient token — never internal id
  metadata?: Record<string, unknown>
  success: boolean
  error_message?: string
}

// ─── Write to audit log (immutable — inserts only) ───────────────────────────
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const db = createServerClient()
    await db.from('audit_log').insert({
      clinic_id: entry.clinic_id,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      metadata: {
        agent: entry.agent,
        external_ref: entry.external_ref ?? null,
        success: entry.success,
        error_message: entry.error_message ?? null,
        ...entry.metadata,
        // Never log PHI — strip any accidental name/phone/email fields
        full_name: undefined,
        phone: undefined,
        email: undefined,
        date_of_birth: undefined,
      }
    })
  } catch (err) {
    // Audit failures must never crash the main flow
    console.error('[AUDIT FAILURE]', err)
  }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────
export const auditPatientLookup = (clinicId: string, query: string, found: boolean) =>
  audit({
    clinic_id: clinicId,
    action: found ? 'patient_lookup' : 'patient_lookup_failed',
    agent: 'concierge',
    entity_type: 'patient',
    metadata: { query_length: query.length },
    success: found
  })

export const auditBooking = (
  clinicId: string,
  appointmentId: string,
  externalRef: string,
  appointmentType: string
) =>
  audit({
    clinic_id: clinicId,
    action: 'appointment_booked',
    agent: 'concierge',
    entity_type: 'appointment',
    entity_id: appointmentId,
    external_ref: externalRef,
    metadata: { appointment_type: appointmentType, booked_via: 'web_agent' },
    success: true
  })

export const auditValidationFailed = (clinicId: string, reason: string) =>
  audit({
    clinic_id: clinicId,
    action: 'patient_validation_failed',
    agent: 'concierge',
    entity_type: 'patient',
    metadata: { reason },
    success: false,
    error_message: reason
  })

export const auditComplianceCheck = (clinicId: string, passed: boolean, flags: string[]) =>
  audit({
    clinic_id: clinicId,
    action: passed ? 'compliance_check_passed' : 'compliance_check_failed',
    agent: 'auditor',
    metadata: { flags },
    success: passed
  })

export const auditRouting = (clinicId: string, intent: string, routedTo: string) =>
  audit({
    clinic_id: clinicId,
    action: 'agent_routed',
    agent: 'orchestrator',
    metadata: { intent, routed_to: routedTo },
    success: true
  })
