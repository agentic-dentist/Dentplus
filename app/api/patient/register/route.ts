import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

async function sendWelcomeEmail(email: string, fullName: string, clinicName: string) {
  if (!process.env.RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'DentPlus <noreply@dentplus.ca>',
      to: email,
      subject: `Your account at ${clinicName} has been approved`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="background:#f8fafc;font-family:'Helvetica Neue',sans-serif;margin:0;padding:40px 20px;">
            <div style="max-width:480px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:40px;">
              <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px;">You're approved! 🎉</h1>
              <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 8px;">Hi ${fullName},</p>
              <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Your patient account at <strong>${clinicName}</strong> has been approved.
                You can now sign in to access your portal, view appointments, and complete your intake form.
              </p>
              <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">— The DentPlus team</p>
            </div>
          </body>
        </html>
      `,
    }),
  })
}

export async function POST(request: Request) {
  try {
    const { slug, fullName, email, authId } = await request.json()
    if (!slug || !fullName || !email || !authId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()

    const { data: settings } = await db
      .from('clinic_settings')
      .select('clinic_id, clinics(name)')
      .eq('slug', slug)
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const clinicId = settings.clinic_id
    const clinics = settings.clinics
    const clinicName = (Array.isArray(clinics) ? clinics[0] : clinics as { name: string } | null)?.name || 'your clinic'

    // Check if patient_account already exists
    const { data: existing } = await db
      .from('patient_accounts')
      .select('id, is_approved')
      .eq('auth_id', authId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, message: 'Account already exists', is_approved: existing.is_approved })
    }

    // Check if patient record exists by email — auto-link if found
    let patientId: string | null = null
    const { data: existingPatient } = await db
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingPatient) {
      patientId = existingPatient.id
    } else {
      const { data: newPatient } = await db
        .from('patients')
        .insert({
          clinic_id: clinicId,
          full_name: fullName,
          email: email.toLowerCase(),
          is_active: true,
          intake_status: 'incomplete',
        })
        .select('id')
        .single()

      if (newPatient) patientId = newPatient.id
    }

    const { error: accountError } = await db.from('patient_accounts').insert({
      auth_id: authId,
      clinic_id: clinicId,
      patient_id: patientId,
      email: email.toLowerCase(),
      full_name: fullName,
      is_approved: false,
    })

    if (accountError) {
      console.error('[PATIENT REGISTER]', accountError)
      return NextResponse.json({ error: 'Could not create account.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, is_approved: false, clinicName })
  } catch (error) {
    console.error('[PATIENT REGISTER]', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { patientAccountId, clinicId } = await request.json()
    if (!patientAccountId || !clinicId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = createServerClient()

    const { data: account } = await db
      .from('patient_accounts')
      .select('email, full_name, clinic_id, clinics(name)')
      .eq('id', patientAccountId)
      .eq('clinic_id', clinicId)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await db.from('patient_accounts')
      .update({ is_approved: true })
      .eq('id', patientAccountId)

    const clinics = account.clinics
    const clinicName = (Array.isArray(clinics) ? clinics[0] : clinics as { name: string } | null)?.name || 'your clinic'
    await sendWelcomeEmail(account.email, account.full_name, clinicName)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATIENT APPROVE]', error)
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 })
  }
}
