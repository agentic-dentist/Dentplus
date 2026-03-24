import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Dynamic import for pdfkit — avoids edge runtime issues
async function generatePDF(data: PatientRecordData): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []
    
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const { patient, clinic, appointments, treatmentNotes, medical, dental, insurance, consents } = data

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').text('Patient Medical Record', { align: 'center' })
    doc.fontSize(11).font('Helvetica').fillColor('#64748B')
      .text(clinic.name, { align: 'center' })
      .text(`Generated: ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' })
    doc.moveDown(1.5)

    // ── Divider helper ───────────────────────────────────────────────────────
    const divider = () => {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke()
      doc.moveDown(0.5)
    }

    // ── Section header helper ────────────────────────────────────────────────
    const sectionHeader = (title: string) => {
      doc.moveDown(0.5)
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0F172A').text(title)
      divider()
    }

    // ── Field helper ─────────────────────────────────────────────────────────
    const field = (label: string, value: string | null | undefined, inline = true) => {
      if (!value) return
      if (inline) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748B').text(label + ': ', { continued: true })
        doc.font('Helvetica').fillColor('#0F172A').text(value)
      } else {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748B').text(label + ':')
        doc.font('Helvetica').fillColor('#0F172A').text(value, { indent: 10 })
        doc.moveDown(0.3)
      }
    }

    // ── 1. Patient information ────────────────────────────────────────────────
    sectionHeader('1. Patient Information')
    field('Full name', patient.full_name)
    field('Date of birth', patient.date_of_birth ? new Date(patient.date_of_birth + 'T12:00:00').toLocaleDateString('en-CA') : null)
    field('Phone', patient.phone_primary)
    field('Email', patient.email)
    field('Address', [patient.address_line1, patient.city, patient.postal_code].filter(Boolean).join(', '))
    field('Language', patient.preferred_language === 'fr' ? 'French' : 'English')
    if (patient.emergency_contact_name) {
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748B').text('Emergency contact:')
      doc.font('Helvetica').fillColor('#0F172A')
        .text(`${patient.emergency_contact_name} (${patient.emergency_contact_relationship || 'Contact'}) — ${patient.emergency_contact_phone || '—'}`, { indent: 10 })
    }

    // ── 2. Insurance ─────────────────────────────────────────────────────────
    if (insurance) {
      doc.moveDown(0.5)
      sectionHeader('2. Insurance')
      field('Provider', insurance.insurance_provider)
      field('Policy number', insurance.insurance_number)
      field('Policy holder', insurance.policy_holder_name)
      if (insurance.secondary_provider) {
        doc.moveDown(0.3)
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748B').text('Secondary insurance:')
        field('Provider', insurance.secondary_provider)
        field('Policy number', insurance.secondary_policy_number)
      }
    }

    // ── 3. Medical history ────────────────────────────────────────────────────
    if (medical) {
      doc.moveDown(0.5)
      sectionHeader('3. Medical History')
      const allergies = medical.allergies as string[] | null
      const medications = medical.medications as string[] | string | null
      const conditions = medical.conditions as string[] | string | null
      if (allergies && allergies.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#DC2626').text('Allergies: ', { continued: true })
        doc.font('Helvetica').fillColor('#0F172A').text(allergies.join(', '))
      }
      field('Medications', Array.isArray(medications) ? medications.join(', ') : medications as string | null)
      field('Medical conditions', Array.isArray(conditions) ? conditions.join(', ') : conditions as string | null)
      field('Blood type', medical.blood_type as string | null)
      if (medical.medical_notes) field('Notes', medical.medical_notes as string, false)
    }

    // ── 4. Dental history ─────────────────────────────────────────────────────
    if (dental) {
      doc.moveDown(0.5)
      sectionHeader('4. Dental History')
      const dentalConditionKeys = ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj']
      const conditions = dentalConditionKeys.filter(k => dental[k] === true)
      if (conditions.length > 0) field('Dental conditions', conditions.map((k: string) => k.replace(/has_|had_/g, '').replace(/_/g, ' ')).join(', '))
      field('Last dental visit', dental.last_dental_visit as string | null)
      if (dental.dental_anxiety !== undefined) field('Dental anxiety', (dental.dental_anxiety as boolean) ? 'Yes' : 'No')
    }

    // ── 5. Appointment history ────────────────────────────────────────────────
    if (appointments.length > 0) {
      doc.moveDown(0.5)
      sectionHeader('5. Appointment History')
      appointments.forEach(apt => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A')
          .text(`${new Date(apt.start_time).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })} — ${apt.appointment_type.charAt(0).toUpperCase() + apt.appointment_type.slice(1)}`)
        doc.font('Helvetica').fillColor('#64748B').fontSize(9)
          .text(`Status: ${apt.status}${apt.reason ? ' · ' + apt.reason : ''}`, { indent: 10 })
        doc.moveDown(0.3)
      })
    }

    // ── 6. Treatment notes (non-private) ─────────────────────────────────────
    if (treatmentNotes.length > 0) {
      doc.moveDown(0.5)
      sectionHeader('6. Visit Notes')
      treatmentNotes.forEach(note => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A')
          .text(`${new Date(note.visit_date + 'T12:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}${note.appointment_type ? ' — ' + note.appointment_type : ''}${note.written_by_name ? ' (by ' + note.written_by_name + ')' : ''}`)
        if (note.chief_complaint) field('Complaint', note.chief_complaint, false)
        if (note.findings)        field('Findings', note.findings, false)
        if (note.treatment_done)  field('Treatment', note.treatment_done, false)
        if (note.next_steps)      field('Next steps', note.next_steps, false)
        doc.moveDown(0.3)
      })
    }

    // ── 7. Consents ───────────────────────────────────────────────────────────
    if (consents) {
      doc.moveDown(0.5)
      sectionHeader('7. Consents')
      const consentFields: [string, unknown][] = [
        ['Treatment consent', consents.consent_treatment],
        ['PIPEDA / Privacy', consents.consent_pipeda],
        ['Email communications', consents.consent_communication_email],
        ['SMS reminders', consents.consent_communication_sms],
      ]
      consentFields.forEach(([label, val]) => {
        doc.fontSize(10).font('Helvetica').fillColor(val ? '#10B981' : '#F43F5E')
          .text(`${val ? '✓' : '✗'} ${label}`)
      })
      if (consents.signature_text) {
        doc.moveDown(0.3)
        field('Electronic signature', consents.signature_text as string)
        if (consents.signed_at) field('Signed', new Date(consents.signed_at as string).toLocaleDateString('en-CA'))
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveDown(2)
    divider()
    doc.fontSize(8).fillColor('#94A3B8')
      .text(`This document was generated by DentPlus on behalf of ${clinic.name}. Confidential patient record.`, { align: 'center' })

    doc.end()
  })
}

interface PatientRecordData {
  patient: Record<string, string | null>
  clinic: { name: string }
  appointments: Record<string, string>[]
  treatmentNotes: Record<string, string>[]
  medical: Record<string, unknown> | null
  dental: Record<string, unknown> | null
  insurance: Record<string, string> | null
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

    // Verify patient belongs to this clinic
    const { data: account } = await db.from('patient_accounts')
      .select('patient_id').eq('auth_id', patientAuthId).eq('clinic_id', clinicId).single()
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = account.patient_id

    // Fetch all patient data in parallel
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
      appointments:    appointments || [],
      treatmentNotes:  treatmentNotes || [],
      medical:         medicalRows?.[0] || null,
      dental:          dental || null,
      insurance:       insurance || null,
      consents:        consents || null,
    })

    const fileName = `DentPlus-Records-${patient.full_name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`

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
