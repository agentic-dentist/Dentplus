import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function sendConfirmationEmail(email: string, fullName: string, confirmUrl: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'DentPlus <noreply@dentplus.ca>',
      to: email,
      subject: 'Confirm your DentPlus account',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="background:#0a0a0a;font-family:'Helvetica Neue',sans-serif;margin:0;padding:40px 20px;">
            <div style="max-width:480px;margin:0 auto;background:#111;border:1px solid #222;border-radius:16px;padding:40px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
                <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#1D9E75,#0EA5E9);display:inline-flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-size:18px;font-weight:700;line-height:1;">+</span>
                </div>
                <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">DentPlus</span>
              </div>
              <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 12px;letter-spacing:-0.02em;">
                Confirm your account
              </h1>
              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 8px;">
                Hi ${fullName},
              </p>
              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 32px;">
                Click the button below to confirm your email and unlock your clinic setup wizard.
                This link expires in 24 hours.
              </p>
              <a href="${confirmUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#1D9E75,#0EA5E9);color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:-0.01em;">
                Confirm my email
              </a>
              <p style="color:#333;font-size:12px;margin:24px 0 0;text-align:center;line-height:1.6;">
                If you didn't sign up for DentPlus, you can safely ignore this email.<br/>
                Your data is stored in Canada and protected under PIPEDA and Law 25.
              </p>
            </div>
          </body>
        </html>
      `,
    }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { clinicName, slug, ownerName, email, password } = await req.json()

    if (!clinicName || !slug || !ownerName || !email || !password)
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    if (password.length < 8)
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

    const cleanSlug = slugify(slug)
    if (cleanSlug.length < 3)
      return NextResponse.json({ error: 'Clinic URL must be at least 3 characters.' }, { status: 400 })

    // Check slug uniqueness
    const { data: existingSlug } = await supabase
      .from('clinic_settings').select('id').eq('slug', cleanSlug).maybeSingle()
    if (existingSlug)
      return NextResponse.json({ error: 'That URL is already taken.' }, { status: 409 })

    // Check email uniqueness
    const { data: existingOwner } = await supabase
      .from('clinic_owners').select('id').eq('email', email.toLowerCase()).maybeSingle()
    if (existingOwner)
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.' }, { status: 409 })

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: false,
      user_metadata: { full_name: ownerName, role: 'owner' },
    })
    if (authError || !authData.user) {
      if (
        authError?.message?.includes('already registered') ||
        authError?.message?.includes('already been registered') ||
        authError?.status === 422
      )
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.' }, { status: 409 })
      return NextResponse.json({ error: `Could not create account: ${authError?.message}` }, { status: 500 })
    }

    const authId = authData.user.id

    // Create clinic
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .insert({
        name: clinicName.trim(), slug: cleanSlug, timezone: 'America/Toronto',
        setup_step: 0, setup_complete: false, is_active: false, languages: ['en', 'fr'],
      })
      .select('id').single()

    if (clinicError || !clinic) {
      await supabase.auth.admin.deleteUser(authId)
      return NextResponse.json({ error: 'Could not create clinic.' }, { status: 500 })
    }

    const clinicId = clinic.id

    // Create clinic_settings
    const { error: settingsError } = await supabase
      .from('clinic_settings').insert({ clinic_id: clinicId, slug: cleanSlug, accepted_insurers: [] })
    if (settingsError) {
      await supabase.auth.admin.deleteUser(authId)
      await supabase.from('clinics').delete().eq('id', clinicId)
      return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 })
    }

    // Create clinic_owner
    const { error: ownerError } = await supabase
      .from('clinic_owners').insert({
        auth_id: authId, clinic_id: clinicId,
        email: email.toLowerCase(), full_name: ownerName.trim(),
      })
    if (ownerError) {
      await supabase.auth.admin.deleteUser(authId)
      await supabase.from('clinic_settings').delete().eq('clinic_id', clinicId)
      await supabase.from('clinics').delete().eq('id', clinicId)
      return NextResponse.json({ error: 'Could not create owner account.' }, { status: 500 })
    }

    // Create subscription (30-day trial)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 30)
    await supabase.from('subscriptions').insert({
      clinic_id: clinicId, plan: 'trial', status: 'active',
      trial_ends_at: trialEnd.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
      max_staff: 3, max_patients: 100,
    })

    // Step 1: Confirm the user we just created so magiclink works correctly
    await supabase.auth.admin.updateUserById(authId, {
      email_confirm: true,
    })

    // Step 2: Generate magiclink for the confirmed user — token sub will match authId
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: { redirectTo: `${process.env.APP_URL}/auth/confirm` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Failed to generate confirmation link:', linkError)
      return NextResponse.json({ error: 'Could not generate confirmation email.' }, { status: 500 })
    }

    // Step 3: Send branded email via Resend
    await sendConfirmationEmail(email.toLowerCase(), ownerName.trim(), linkData.properties.action_link)

    return NextResponse.json({ success: true, clinicId, slug: cleanSlug })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Unexpected error. Please try again.' }, { status: 500 })
  }
}
