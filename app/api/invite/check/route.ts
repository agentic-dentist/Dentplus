import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ valid: false, error: 'No token provided' }, { status: 400 })

  // Must use service role — invite pages are unauthenticated, anon key + RLS blocks the read
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invite } = await db
    .from('staff_invites')
    .select('id, email, full_name, role, status, expires_at, clinic_id, token')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ valid: false, error: 'Invite not found.' }, { status: 404 })
  if (invite.status !== 'pending') return NextResponse.json({ valid: false, error: 'This invite has already been used.' }, { status: 400 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ valid: false, error: 'This invite has expired. Ask the clinic to resend it.' }, { status: 400 })

  const { data: clinic } = await db
    .from('clinics')
    .select('name')
    .eq('id', invite.clinic_id)
    .single()

  const { data: settings } = await db
    .from('clinic_settings')
    .select('slug')
    .eq('clinic_id', invite.clinic_id)
    .single()

  return NextResponse.json({
    valid: true,
    invite: {
      email: invite.email,
      full_name: invite.full_name,
      role: invite.role,
      clinic_name: clinic?.name || 'Your clinic',
      slug: settings?.slug || 'demo'
    }
  })
}
