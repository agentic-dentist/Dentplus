import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()
    if (!token || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = createServerClient()

    // Get invite
    const { data: invite } = await db
      .from('staff_invites')
      .select('id, email, full_name, role, status, expires_at, clinic_id, clinic_settings(slug)')
      .eq('token', token)
      .single()

    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (invite.status !== 'pending') return NextResponse.json({ error: 'Invite already used' }, { status: 400 })
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 400 })

    // Create auth user using admin client (service role)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true  // auto-confirm — they accepted invite via email
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create account' }, { status: 500 })
    }

    // Create staff account
    await db.from('staff_accounts').insert({
      auth_id: authData.user.id,
      clinic_id: invite.clinic_id,
      email: invite.email,
      full_name: invite.full_name || invite.email.split('@')[0],
      role: invite.role,
      is_active: true
    })

    // Mark invite as accepted
    await db.from('staff_invites').update({ status: 'accepted' }).eq('id', invite.id)

    const settings = Array.isArray(invite.clinic_settings) ? invite.clinic_settings[0] : invite.clinic_settings
    const slug = (settings as { slug: string })?.slug || 'demo'

    return NextResponse.json({ success: true, slug })
  } catch (error) {
    console.error('[INVITE ACCEPT]', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
