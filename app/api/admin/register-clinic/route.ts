import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { authId, email, fullName, clinicName, slug, phone, address } = await request.json()

    if (!authId || !email || !fullName || !clinicName || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()

    // Check slug availability
    const { data: existing } = await db
      .from('clinic_settings')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'This URL is already taken. Please choose another.' }, { status: 409 })
    }

    // Create clinic
    const { data: clinic, error: clinicError } = await db
      .from('clinics')
      .insert({
        name: clinicName,
        slug,
        phone: phone || null,
        email,
        timezone: 'America/Toronto'
      })
      .select('id')
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Failed to create clinic' }, { status: 500 })
    }

    // Create clinic settings
    await db.from('clinic_settings').insert({
      clinic_id: clinic.id,
      slug,
      phone: phone || null,
      email,
      address: address || null,
      primary_color: '#0EA5E9'
    })

    // Create staff account (owner)
    await db.from('staff_accounts').insert({
      auth_id: authId,
      clinic_id: clinic.id,
      email,
      full_name: fullName,
      role: 'owner',
      is_active: true
    })

    // Create clinic owner record
    await db.from('clinic_owners').insert({
      auth_id: authId,
      clinic_id: clinic.id,
      email,
      full_name: fullName
    })

    // Create trial subscription
    await db.from('subscriptions').insert({
      clinic_id: clinic.id,
      plan: 'trial',
      status: 'active',
      max_staff: 5,
      max_patients: 500
    })

    return NextResponse.json({ success: true, slug, clinic_id: clinic.id })
  } catch (error) {
    console.error('[REGISTER CLINIC]', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
