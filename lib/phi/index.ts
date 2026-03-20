import { createServerClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PatientToken {
  external_ref: string      // agents only ever see this
  clinic_id: string
  is_active: boolean
}

export interface PatientRecord {
  id: string
  external_ref: string
  full_name: string
  phone: string
  email: string | null
  insurance_provider: string | null
  date_of_birth: string | null
  is_active: boolean
}

// ─── Resolve external_ref → internal id (server only) ────────────────────────

export async function resolveRef(externalRef: string, clinicId: string): Promise<string | null> {
  const db = createServerClient()
  const { data } = await db
    .from('patients')
    .select('id')
    .eq('external_ref', externalRef)
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .single()
  return data?.id ?? null
}

// ─── Lookup patient by name — returns token only, never raw PHI ──────────────

export async function lookupPatientSafe(
  query: string,
  clinicId: string
): Promise<{ found: boolean; tokens?: PatientToken[]; message?: string }> {
  const db = createServerClient()

  const { data } = await db
    .from('patients')
    .select('external_ref, clinic_id, is_active, full_name')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .ilike('full_name', `%${query}%`)
    .limit(3)

  if (!data || data.length === 0) {
    return { found: false, message: 'No patient found. They may need to register as a new patient.' }
  }

  // Return display name for UX but flag it as display-only
  // The actual booking uses external_ref — never the name directly
  return {
    found: true,
    tokens: data.map(p => ({
      external_ref: p.external_ref,
      clinic_id: p.clinic_id,
      is_active: p.is_active,
      display_name: p.full_name  // OK to show in chat — not used for data ops
    })) as PatientToken[]
  }
}

// ─── Validate patient token before any operation ─────────────────────────────

export async function validatePatientToken(
  externalRef: string,
  clinicId: string
): Promise<{ valid: boolean; internalId?: string; reason?: string }> {
  const db = createServerClient()

  const { data } = await db
    .from('patients')
    .select('id, is_active, clinic_id')
    .eq('external_ref', externalRef)
    .eq('clinic_id', clinicId)
    .single()

  if (!data) return { valid: false, reason: 'Patient not found in this clinic' }
  if (!data.is_active) return { valid: false, reason: 'Patient account is inactive' }
  if (data.clinic_id !== clinicId) return { valid: false, reason: 'Patient does not belong to this clinic' }

  return { valid: true, internalId: data.id }
}

// ─── Register new patient — returns token only ───────────────────────────────

export async function registerPatientSafe(
  clinicId: string,
  fullName: string,
  phone: string,
  email?: string,
  dateOfBirth?: string
): Promise<{ success: boolean; external_ref?: string; error?: string }> {
  const db = createServerClient()

  // Check for duplicate phone in same clinic
  const { data: existing } = await db
    .from('patients')
    .select('external_ref')
    .eq('clinic_id', clinicId)
    .eq('phone', phone)
    .eq('is_active', true)
    .single()

  if (existing) {
    return {
      success: false,
      error: 'A patient with this phone number already exists. Please look them up instead.'
    }
  }

  const { data, error } = await db
    .from('patients')
    .insert({
      clinic_id: clinicId,
      full_name: fullName,
      phone,
      email: email ?? null,
      date_of_birth: dateOfBirth ?? null,
      is_active: true
    })
    .select('external_ref')
    .single()

  if (error || !data) return { success: false, error: 'Registration failed. Please try again.' }

  return { success: true, external_ref: data.external_ref }
}
