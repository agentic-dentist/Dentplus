import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ valid: false, error: 'No token provided' }, { status: 400 })

  const db = createServerClient()

  const { data: invite } = await db
    .from('staff_invites')
    .select('id, email, full_name, role, status, expires_at, clinic_id, clinics(name), clinic_settings(slug)')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ valid: false, error: 'Invite not found.' }, { status: 404 })
  if (invite.status !== 'pending') return NextResponse.json({ valid: false, error: 'This invite has already been used.' }, { status: 400 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ valid: false, error: 'This invite has expired. Please ask the clinic to resend it.' }, { status: 400 })

  const clinic = Array.isArray(invite.clinics) ? invite.clinics[0] : invite.clinics
  const settings = Array.isArray(invite.clinic_settings) ? invite.clinic_settings[0] : invite.clinic_settings

  return NextResponse.json({
    valid: true,
    invite: {
      email: invite.email,
      full_name: invite.full_name,
      role: invite.role,
      clinic_name: (clinic as { name: string })?.name || 'Clinic',
      slug: (settings as { slug: string })?.slug || 'demo'
    }
  })
}
