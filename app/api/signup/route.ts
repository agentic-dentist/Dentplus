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

    // Send verification email via Resend SMTP
    await supabase.auth.admin.inviteUserByEmail(email.toLowerCase(), {
      redirectTo: `${process.env.APP_URL}/setup`,
    })

    return NextResponse.json({ success: true, clinicId, slug: cleanSlug })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Unexpected error. Please try again.' }, { status: 500 })
  }
}