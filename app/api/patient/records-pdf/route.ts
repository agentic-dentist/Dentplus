import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

async function generatePDF(data: PatientRecordData): Promise<Buffer> {
  // Use pdfmake — self-contained, no external font files needed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfMakePkg = require('pdfmake/build/pdfmake')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfFontsPkg = require('pdfmake/build/vfs_fonts')
  const pdfMake = pdfMakePkg.default ?? pdfMakePkg
  const fonts = pdfFontsPkg.default ?? pdfFontsPkg
  // Create a new unfrozen instance with fonts attached
  const pdfMakeWithFonts = Object.assign(Object.create(Object.getPrototypeOf(pdfMake)), pdfMake, {
    vfs: fonts.pdfMake?.vfs ?? fonts.vfs ?? {}
  })

  const { patient, clinic, appointments, treatmentNotes, medical, dental, insurance, consents } = data

  const gray  = '#64748B'
  const dark  = '#0F172A'
  const light = '#F8FAFC'
  const red   = '#DC2626'
  const green = '#10B981'

  const section = (title: string) => ([
    { text: title, style: 'sectionHeader', margin: [0, 16, 0, 4] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#E2E8F0' }] },
    { text: '', margin: [0, 4] }
  ])

  const row = (label: string, value: string | null | undefined) => {
    if (!value) return null
    return {
      columns: [
        { text: label + ':', width: 140, style: 'fieldLabel' },
        { text: value, style: 'fieldValue' }
      ], margin: [0, 2]
    }
  }

  const content: unknown[] = [
    // Header
    { text: 'Patient Medical Record', style: 'title' },
    { text: clinic.name, style: 'subtitle' },
    { text: `Generated: ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}`, style: 'subtitle', margin: [0, 0, 0, 16] },

    // 1. Patient info
    ...section('1. Patient Information'),
    row('Full name', patient.full_name as string),
    row('Date of birth', patient.date_of_birth ? new Date((patient.date_of_birth as string) + 'T12:00:00').toLocaleDateString('en-CA') : null),
    row('Phone', patient.phone_primary as string),
    row('Email', patient.email as string),
    row('Address', [patient.address_line1, patient.city, patient.postal_code].filter(Boolean).join(', ') || null),
    row('Language', patient.preferred_language === 'fr' ? 'French' : 'English'),
    patient.emergency_contact_name ? row('Emergency contact', `${patient.emergency_contact_name} (${patient.emergency_contact_relationship || 'Contact'}) — ${patient.emergency_contact_phone || '—'}`) : null,
  ].filter(Boolean)

  // 2. Insurance
  if (insurance) {
    content.push(...section('2. Insurance'))
    ;[
      row('Provider', insurance.insurance_provider as string),
      row('Policy number', insurance.insurance_number as string),
      row('Policy holder', insurance.policy_holder_name as string),
      insurance.secondary_provider ? row('Secondary provider', insurance.secondary_provider as string) : null,
    ].filter(Boolean).forEach(r => content.push(r))
  }

  // 3. Medical history
  if (medical) {
    content.push(...section('3. Medical History'))
    const allergies = medical.allergies as string[] | null
    if (allergies && allergies.length > 0) {
      content.push({
        columns: [
          { text: 'Allergies:', width: 140, style: 'fieldLabel', color: red },
          { text: allergies.join(', '), style: 'fieldValue', color: red, bold: true }
        ], margin: [0, 2]
      })
    }
    const meds = medical.medications as string[] | string | null
    const conds = medical.conditions as string[] | string | null
    ;[
      row('Medications', Array.isArray(meds) ? meds.join(', ') : meds as string | null),
      row('Medical conditions', Array.isArray(conds) ? conds.join(', ') : conds as string | null),
      row('Blood type', medical.blood_type as string | null),
      medical.medical_notes ? row('Notes', medical.medical_notes as string) : null,
    ].filter(Boolean).forEach(r => content.push(r))
  }

  // 4. Dental history
  if (dental) {
    content.push(...section('4. Dental History'))
    const dentalKeys = ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj']
    const dentalConds = dentalKeys.filter(k => dental[k] === true).map(k => k.replace(/has_|had_/g, '').replace(/_/g, ' ')).join(', ')
    ;[
      row('Last dental visit', dental.last_dental_visit as string | null),
      row('Dental anxiety', dental.dental_anxiety ? 'Yes' : null),
      dentalConds ? row('Dental conditions', dentalConds) : null,
    ].filter(Boolean).forEach(r => content.push(r))
  }

  // 5. Appointment history
  if (appointments.length > 0) {
    content.push(...section('5. Appointment History'))
    appointments.forEach(apt => {
      content.push({
        columns: [
          { text: new Date(apt.start_time as string).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }), width: 100, style: 'fieldLabel' },
          { text: (apt.appointment_type as string).charAt(0).toUpperCase() + (apt.appointment_type as string).slice(1), width: 120, style: 'fieldValue' },
          { text: apt.status as string, width: 80, style: 'fieldLabel' },
          { text: (apt.reason as string) || '', style: 'fieldLabel' },
        ], margin: [0, 2]
      })
    })
  }

  // 6. Visit notes
  if (treatmentNotes.length > 0) {
    content.push(...section('6. Visit Notes'))
    treatmentNotes.forEach(note => {
      content.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: `${new Date((note.visit_date as string) + 'T12:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}${note.appointment_type ? ' — ' + note.appointment_type : ''}${note.written_by_name ? ' · ' + note.written_by_name : ''}`, style: 'noteDate' },
              note.chief_complaint ? { text: [{ text: 'Complaint: ', bold: true }, note.chief_complaint as string], style: 'noteField' } : null,
              note.findings        ? { text: [{ text: 'Findings: ', bold: true }, note.findings as string], style: 'noteField' } : null,
              note.treatment_done  ? { text: [{ text: 'Treatment: ', bold: true }, note.treatment_done as string], style: 'noteField' } : null,
              note.next_steps      ? { text: [{ text: 'Next steps: ', bold: true }, note.next_steps as string], style: 'noteField' } : null,
            ].filter(Boolean)
          }]]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 8]
      })
    })
  }

  // 7. Consents
  if (consents) {
    content.push(...section('7. Consents'))
    const consentMap: [string, unknown][] = [
      ['Treatment consent', consents.consent_treatment],
      ['PIPEDA / Privacy', consents.consent_pipeda],
      ['Email communications', consents.consent_communication_email],
      ['SMS reminders', consents.consent_communication_sms],
    ]
    consentMap.forEach(([label, val]) => {
      content.push({ text: `${val ? '✓' : '✗'} ${label}`, color: val ? green : red, fontSize: 10, margin: [0, 2] })
    })
    if (consents.signature_text) {
      content.push(row('Signature', consents.signature_text as string))
      if (consents.signed_at) content.push(row('Signed', new Date(consents.signed_at as string).toLocaleDateString('en-CA')))
    }
  }

  // Footer
  content.push(
    { text: '', margin: [0, 20] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#E2E8F0' }] },
    { text: `This document was generated by DentPlus on behalf of ${clinic.name}. Confidential patient record.`, style: 'footer', margin: [0, 8] }
  )

  const docDefinition = {
    content,
    styles: {
      title:         { fontSize: 20, bold: true, color: dark, alignment: 'center' as const },
      subtitle:      { fontSize: 10, color: gray, alignment: 'center' as const },
      sectionHeader: { fontSize: 13, bold: true, color: dark },
      fieldLabel:    { fontSize: 9, color: gray },
      fieldValue:    { fontSize: 10, color: dark },
      noteDate:      { fontSize: 10, bold: true, color: dark, margin: [0, 0, 0, 4] },
      noteField:     { fontSize: 9, color: dark, margin: [0, 1] },
      footer:        { fontSize: 8, color: '#94A3B8', alignment: 'center' as const },
    },
    defaultStyle: { font: 'Roboto' },
    pageMargins: [40, 40, 40, 40] as [number, number, number, number],
  }

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = pdfMakeWithFonts.createPdf(docDefinition)
      pdfDoc.getBuffer((buffer: Buffer) => resolve(buffer))
    } catch(err) { reject(err) }
  })
}

interface PatientRecordData {
  patient: Record<string, unknown>
  clinic: { name: string }
  appointments: Record<string, unknown>[]
  treatmentNotes: Record<string, unknown>[]
  medical: Record<string, unknown> | null
  dental: Record<string, unknown> | null
  insurance: Record<string, unknown> | null
  consents: Record<string, unknown> | null
}

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

    const pdfBuffer = await generatePDF({
      patient,
      clinic,
      appointments:   appointments || [],
      treatmentNotes: treatmentNotes || [],
      medical:        medicalRows?.[0] || null,
      dental:         dental || null,
      insurance:      insurance || null,
      consents:       consents || null,
    })

    const fileName = `DentPlus-Records-${(patient.full_name as string).replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      }
    })

  } catch (error) {
    console.error('[PDF RECORDS]', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
