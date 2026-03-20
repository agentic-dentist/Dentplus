import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { slug, fullName, email, authId } = await request.json()
    if (!slug || !fullName || !email || !authId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()

    // Get clinic by slug
    const { data: settings } = await db
      .from('clinic_settings')
      .select('clinic_id')
      .eq('slug', slug)
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // Check if patient_account already exists
    const { data: existing } = await db
      .from('patient_accounts')
      .select('id')
      .eq('auth_id', authId)
      .eq('clinic_id', settings.clinic_id)
      .single()

    if (existing) {
      return NextResponse.json({ success: true, message: 'Account already exists' })
    }

    // Check if patient record exists by email
    let patientId: string | null = null
    const { data: existingPatient } = await db
      .from('patients')
      .select('id')
      .eq('clinic_id', settings.clinic_id)
      .eq('email', email)
      .single()

    if (existingPatient) {
      patientId = existingPatient.id
    } else {
      // Create new patient record
      const { data: newPatient } = await db
        .from('patients')
        .insert({
          clinic_id: settings.clinic_id,
          full_name: fullName,
          email,
          is_active: true
        })
        .select('id')
        .single()

      if (newPatient) patientId = newPatient.id
    }

    // Create patient account
    await db.from('patient_accounts').insert({
      auth_id: authId,
      clinic_id: settings.clinic_id,
      patient_id: patientId,
      email,
      full_name: fullName
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATIENT REGISTER]', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
