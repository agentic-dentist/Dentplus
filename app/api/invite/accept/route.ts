import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()
    if (!token || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch invite — no nested clinic_settings join (no FK relationship)
    const { data: invite, error: inviteError } = await db
      .from('staff_invites')
      .select('id, email, full_name, role, status, expires_at, clinic_id')
      .eq('token', token)
      .single()

    if (inviteError) {
      console.error('[INVITE ACCEPT] invite lookup error:', JSON.stringify(inviteError))
      return NextResponse.json({ error: `DB error: ${inviteError.message}` }, { status: 500 })
    }
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (!['pending', 'sent'].includes(invite.status)) return NextResponse.json({ error: 'Invite already used' }, { status: 400 })
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 400 })

    // Fetch slug separately
    const { data: settings } = await db
      .from('clinic_settings')
      .select('slug')
      .eq('clinic_id', invite.clinic_id)
      .single()

    // Normalize email to lowercase before creating auth user
    const normalizedEmail = invite.email.trim().toLowerCase()

    // Create auth user
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { role: invite.role, full_name: invite.full_name || normalizedEmail.split('@')[0] }
    })

    if (authError || !authData.user) {
      console.error('[INVITE ACCEPT] auth error:', authError)
      return NextResponse.json({ error: authError?.message || 'Failed to create account' }, { status: 500 })
    }

    // Create staff account
    const { error: staffError } = await db.from('staff_accounts').insert({
      auth_id: authData.user.id,
      clinic_id: invite.clinic_id,
      email: normalizedEmail,
      full_name: invite.full_name || invite.email.split('@')[0],
      role: invite.role,
      is_active: true
    })

    if (staffError) {
      console.error('[INVITE ACCEPT] staff insert error:', JSON.stringify(staffError))
    }

    // Mark invite as accepted
    await db.from('staff_invites').update({ status: 'accepted' }).eq('id', invite.id)

    return NextResponse.json({ success: true, slug: settings?.slug || 'demo' })
  } catch (error) {
    console.error('[INVITE ACCEPT] unexpected error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
