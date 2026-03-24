import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Simple password protection — superadmin API requires the same password
const SUPER_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'dentplus-admin-2026'
const COST_PER_BOOKING    = 0.05
const COST_PER_REMINDER   = 0.008
const COST_PER_MATCHMAKER = 0.002

export async function GET(request: Request) {
  // Verify password header
  const auth = request.headers.get('x-superadmin-password')
  if (auth !== SUPER_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'overview'

  if (type === 'logs') {
    const { data: logs } = await db
      .from('audit_log')
      .select('id, clinic_id, action, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ logs: logs || [] })
  }

  // Fetch all clinics
  const { data: clinicList } = await db
    .from('clinics')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })

  if (!clinicList) return NextResponse.json({ clinics: [], stats: null })

  // Fetch all data in parallel across all clinics
  const [
    { data: allPatients },
    { data: allAppointments },
    { data: allStaff },
    { data: allAudit },
    { data: allMatchmaker },
    { data: allOutreach },
    { data: allSettings },
    { data: allSubs },
  ] = await Promise.all([
    db.from('patients').select('id, clinic_id').eq('is_active', true),
    db.from('appointments').select('id, clinic_id, booked_via'),
    db.from('staff_accounts').select('id, clinic_id').eq('is_active', true),
    db.from('audit_log').select('clinic_id, created_at').order('created_at', { ascending: false }),
    db.from('matchmaker_runs').select('id, clinic_id'),
    db.from('outreach_log').select('id, clinic_id, outreach_type'),
    db.from('clinic_settings').select('clinic_id, slug'),
    db.from('subscriptions').select('clinic_id, plan, trial_ends_at'),
  ])

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const clinics = clinicList.map(c => {
    const patients     = (allPatients || []).filter(p => p.clinic_id === c.id).length
    const appointments = (allAppointments || []).filter(a => a.clinic_id === c.id).length
    const staff        = (allStaff || []).filter(s => s.clinic_id === c.id).length
    const ai_bookings  = (allAppointments || []).filter(a => a.clinic_id === c.id && ['web_agent','matchmaker'].includes(a.booked_via)).length
    const mm_runs      = (allMatchmaker || []).filter(m => m.clinic_id === c.id).length
    const reminders    = (allOutreach || []).filter(o => o.clinic_id === c.id && ['reminder_48h','reminder_24h'].includes(o.outreach_type)).length
    const lastAudit    = (allAudit || []).find(a => a.clinic_id === c.id)
    const settings     = (allSettings || []).find(s => s.clinic_id === c.id)
    const sub          = (allSubs || []).find(s => s.clinic_id === c.id)
    const est_cost     = (ai_bookings * COST_PER_BOOKING) + (mm_runs * COST_PER_MATCHMAKER) + (reminders * COST_PER_REMINDER)
    const is_active    = lastAudit && lastAudit.created_at > sevenDaysAgo

    return {
      id: c.id, name: c.name,
      slug:          settings?.slug || '',
      plan:          sub?.plan || 'trial',
      trial_ends_at: sub?.trial_ends_at || null,
      created_at:    c.created_at,
      patients, appointments, staff,
      ai_bookings, matchmaker_runs: mm_runs, reminders_sent: reminders,
      last_activity: lastAudit?.created_at || null,
      estimated_cost: est_cost,
      is_active: !!is_active,
    }
  })

  const stats = {
    total_clinics:           clinics.length,
    active_clinics:          clinics.filter(c => c.is_active).length,
    total_patients:          clinics.reduce((s, c) => s + c.patients, 0),
    total_appointments:      clinics.reduce((s, c) => s + c.appointments, 0),
    total_ai_bookings:       clinics.reduce((s, c) => s + c.ai_bookings, 0),
    total_matchmaker_runs:   clinics.reduce((s, c) => s + c.matchmaker_runs, 0),
    total_reminders:         clinics.reduce((s, c) => s + c.reminders_sent, 0),
    estimated_monthly_cost:  clinics.reduce((s, c) => s + c.estimated_cost, 0),
  }

  return NextResponse.json({ clinics, stats })
}

export async function PATCH(request: Request) {
  const auth = request.headers.get('x-superadmin-password')
  if (auth !== SUPER_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action, clinicId } = await request.json()

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (action === 'extend_trial') {
    const newEnd = new Date(Date.now() + 30 * 86400000).toISOString()
    await db.from('subscriptions').update({ trial_ends_at: newEnd }).eq('clinic_id', clinicId)
    return NextResponse.json({ success: true, trial_ends_at: newEnd })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
