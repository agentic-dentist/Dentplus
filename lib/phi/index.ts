import { createServerClient } from '@/lib/supabase/server'

type DB = ReturnType<typeof createServerClient>

// ── lookupPatientSafe ──────────────────────────────────────────────────────
// Looks up a patient by name — returns only display name + external_ref token.
// Internal patient_id is never exposed to the agent.

export async function lookupPatientSafe(
  nameQuery: string,
  clinicId: string
): Promise<{
  found: boolean
  external_ref?: string
  display_name?: string
  multiple?: boolean
}> {
  const db = createServerClient()

  const { data } = await db
    .from('patients')
    .select('external_ref, full_name')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .ilike('full_name', `%${nameQuery}%`)
    .limit(3)

  if (!data || data.length === 0) {
    return { found: false }
  }

  if (data.length > 1) {
    return {
      found: true,
      multiple: true,
      display_name: data.map(p => p.full_name).join(', ')
    }
  }

  return {
    found: true,
    external_ref: data[0].external_ref,
    display_name: data[0].full_name
  }
}

// ── validatePatientToken ───────────────────────────────────────────────────
// Validates an external_ref token before any write operation.
// Returns the internal patient_id only for server-side use — never sent to agent.

export async function validatePatientToken(
  externalRef: string,
  clinicId: string
): Promise<{
  valid: boolean
  internalId?: string
  reason?: string
}> {
  if (!externalRef) {
    return { valid: false, reason: 'No token provided' }
  }

  const db = createServerClient()

  const { data } = await db
    .from('patients')
    .select('id, is_active')
    .eq('external_ref', externalRef)
    .eq('clinic_id', clinicId)
    .single()

  if (!data) {
    return { valid: false, reason: 'Patient not found' }
  }

  if (!data.is_active) {
    return { valid: false, reason: 'Patient account is inactive' }
  }

  return { valid: true, internalId: data.id }
}

// ── registerPatientSafe ────────────────────────────────────────────────────
// Creates a new patient record. Checks for duplicate phone before inserting.
// Returns external_ref token — never the internal patient_id.

export async function registerPatientSafe(
  clinicId: string,
  fullName: string,
  phone: string,
  email?: string,
  dateOfBirth?: string
): Promise<{
  success: boolean
  external_ref?: string
  error?: string
}> {
  const db = createServerClient()

  // Duplicate phone check
  const { data: existing } = await db
    .from('patients')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('phone_primary', phone)
    .eq('is_active', true)
    .limit(1)

  if (existing && existing.length > 0) {
    return {
      success: false,
      error: 'A patient with this phone number already exists. Please look them up by name.'
    }
  }

  const { data, error } = await db
    .from('patients')
    .insert({
      clinic_id: clinicId,
      full_name: fullName,
      phone_primary: phone,
      email: email || null,
      date_of_birth: dateOfBirth || null,
      is_active: true,
      intake_status: 'incomplete'
    })
    .select('external_ref')
    .single()

  if (error || !data) {
    return { success: false, error: 'Failed to register patient. Please try again.' }
  }

  return { success: true, external_ref: data.external_ref }
}

// ── lookupPatientByAuthId ──────────────────────────────────────────────────
// Resolves a logged-in patient's identity from their Supabase auth session.
// Used by the chat API to pre-identify patients so the agent skips name question.

export async function lookupPatientByAuthId(
  authId: string,
  clinicId: string,
  db: DB
): Promise<{
  external_ref: string
  display_name: string
  preferred_language: string
} | null> {
  try {
    const { data: account } = await db
      .from('patient_accounts')
      .select('patient_id')
      .eq('auth_id', authId)
      .eq('clinic_id', clinicId)
      .single()

    if (!account) return null

    const { data: patient } = await db
      .from('patients')
      .select('external_ref, full_name, preferred_language')
      .eq('id', account.patient_id)
      .eq('clinic_id', clinicId)
      .single()

    if (!patient?.external_ref) return null

    return {
      external_ref: patient.external_ref,
      display_name: patient.full_name.split(' ')[0],
      preferred_language: patient.preferred_language || 'en'
    }
  } catch {
    return null
  }
}
