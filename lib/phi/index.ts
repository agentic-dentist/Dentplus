// Add this function to lib/phi/index.ts
// It resolves a logged-in patient's identity server-side
// so the agent never needs to ask for their name

export async function lookupPatientByAuthId(
  authId: string,
  clinicId: string,
  db: SupabaseClient
): Promise<{
  external_ref: string
  display_name: string
  preferred_language: string
} | null> {
  try {
    // Get patient_id from patient_accounts
    const { data: account } = await db
      .from('patient_accounts')
      .select('patient_id')
      .eq('auth_id', authId)
      .eq('clinic_id', clinicId)
      .single()

    if (!account) return null

    // Get patient details
    const { data: patient } = await db
      .from('patients')
      .select('id, full_name, preferred_language, external_ref')
      .eq('id', account.patient_id)
      .eq('clinic_id', clinicId)
      .single()

    if (!patient) return null

    // Use preferred_name if available, fallback to first name
    const displayName = patient.full_name.split(' ')[0]

    return {
      external_ref: patient.external_ref,
      display_name: displayName,
      preferred_language: patient.preferred_language || 'en'
    }
  } catch {
    return null
  }
}
