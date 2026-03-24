import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const patientAuthId = searchParams.get('patientAuthId')
    const clinicId      = searchParams.get('clinicId')

    if (!patientAuthId || !clinicId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: account } = await db.from('patient_accounts')
      .select('patient_id').eq('auth_id', patientAuthId).eq('clinic_id', clinicId).single()
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = account.patient_id

    const [
      { data: patient },
      { data: clinic },
      { data: appointments },
      { data: treatmentNotes },
      { data: medicalRows },
      { data: dental },
      { data: insurance },
      { data: consents },
    ] = await Promise.all([
      db.from('patients').select('*').eq('id', patientId).single(),
      db.from('clinics').select('name').eq('id', clinicId).single(),
      db.from('appointments').select('id, start_time, appointment_type, status, reason')
        .eq('patient_id', patientId).eq('clinic_id', clinicId)
        .order('start_time', { ascending: false }).limit(50),
      db.from('treatment_notes').select('visit_date, appointment_type, written_by_name, chief_complaint, findings, treatment_done, next_steps')
        .eq('patient_id', patientId).eq('clinic_id', clinicId).eq('is_private', false)
        .order('visit_date', { ascending: false }),
      db.from('patient_medical').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1),
      db.from('patient_dental').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('patient_insurance').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('patient_consents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    if (!patient || !clinic) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const medical = medicalRows?.[0] || null
    const dent = dental as Record<string, unknown> | null
    const dentalKeys = ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj']
    const dentalConditions = dent
      ? dentalKeys.filter(k => dent[k] === true).map(k => k.replace(/has_|had_/g,'').replace(/_/g,' ')).join(', ')
      : null

    const med = medical as Record<string, unknown> | null
    const allergies = (med?.allergies as string[]) || []

    return NextResponse.json({
      clinicName:     clinic.name,
      patient,
      allergies,
      medical,
      dental,
      dentalConditions,
      insurance,
      consents,
      appointments:   appointments || [],
      treatmentNotes: treatmentNotes || [],
    })

  } catch (error) {
    console.error('[PDF RECORDS]', error)
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
  }
}
