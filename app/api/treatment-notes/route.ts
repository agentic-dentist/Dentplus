import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const clinicId  = searchParams.get('clinicId')

  if (!patientId || !clinicId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('treatment_notes')
    .select('id, visit_date, appointment_id, appointment_type, written_by_name, chief_complaint, findings, treatment_done, next_steps, is_private, created_at')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data || [] })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clinicId, patientId, appointmentId, writtenBy, writtenByName,
            visitDate, appointmentType, chiefComplaint, findings,
            treatmentDone, nextSteps, isPrivate } = body

    if (!clinicId || !patientId || !visitDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()
    const { data, error } = await db
      .from('treatment_notes')
      .insert({
        clinic_id:        clinicId,
        patient_id:       patientId,
        appointment_id:   appointmentId || null,
        written_by:       writtenBy || null,
        written_by_name:  writtenByName || null,
        visit_date:       visitDate,
        appointment_type: appointmentType || null,
        chief_complaint:  chiefComplaint || null,
        findings:         findings || null,
        treatment_done:   treatmentDone || null,
        next_steps:       nextSteps || null,
        is_private:       isPrivate || false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ note: data })
  } catch (error) {
    console.error('[TREATMENT NOTES POST]', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { noteId, clinicId, chiefComplaint, findings, treatmentDone, nextSteps, isPrivate } = await request.json()
    if (!noteId || !clinicId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = createServerClient()
    const { data, error } = await db
      .from('treatment_notes')
      .update({
        chief_complaint: chiefComplaint,
        findings,
        treatment_done:  treatmentDone,
        next_steps:      nextSteps,
        is_private:      isPrivate,
        updated_at:      new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ note: data })
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
