'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Stats {
  total_patients: number
  total_appointments: number
  ai_bookings: number
  staff_count: number
  trial_days_left: number | null
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [clinicId, setClinicId] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: owner } = await supabase
        .from('clinic_owners')
        .select('clinic_id')
        .eq('auth_id', user.id)
        .single()

      if (!owner) { router.push('/admin/login'); return }
      setClinicId(owner.clinic_id)

      const { data: settings } = await supabase
        .from('clinic_settings')
        .select('slug')
        .eq('clinic_id', owner.clinic_id)
        .single()
      if (settings) setSlug(settings.slug)

      const [
        { count: patients },
        { count: appointments },
        { data: aiData },
        { count: staff },
        { data: sub }
      ] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', owner.clinic_id).eq('is_active', true),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('clinic_id', owner.clinic_id).eq('status', 'scheduled'),
        supabase.from('appointments').select('id').eq('clinic_id', owner.clinic_id).eq('booked_via', 'web_agent'),
        supabase.from('staff_accounts').select('*', { count: 'exact', head: true }).eq('clinic_id', owner.clinic_id).eq('is_active', true),
        supabase.from('subscriptions').select('trial_ends_at, plan').eq('clinic_id', owner.clinic_id).single()
      ])

      let trialDaysLeft: number | null = null
      if (sub?.plan === 'trial' && sub?.trial_ends_at) {
        const diff = new Date(sub.trial_ends_at).getTime() - Date.now()
        trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }

      setStats({
        total_patients: patients || 0,
        total_appointments: appointments || 0,
        ai_bookings: aiData?.length || 0,
        staff_count: staff || 0,
        trial_days_left: trialDaysLeft
      })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .header { margin-bottom: 28px; }
        .page-title { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 700; color: #0F172A; letter-spacing: -0.4px; }
        .page-sub { font-size: 13px; color: #94A3B8; margin-top: 3px; }
        .trial-banner { background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
        .trial-text { font-size: 13px; color: #92400E; font-weight: 500; }
        .trial-btn { padding: 7px 14px; background: #F59E0B; color: white; border-radius: 7px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
        .stat-card { background: white; border-radius: 12px; padding: 20px; border: 1px solid #E2E8F0; position: relative; overflow: hidden; }
        .stat-card .bar { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
        .stat-label { font-size: 10.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #94A3B8; margin-bottom: 10px; }
        .stat-value { font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 500; color: #0F172A; letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }
        .stat-sub { font-size: 12px; color: #94A3B8; }
        .quick-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .action-card { background: white; border-radius: 12px; padding: 18px; border: 1px solid #E2E8F0; cursor: pointer; transition: all 0.15s; text-decoration: none; display: block; }
        .action-card:hover { border-color: #CBD5E1; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .action-icon { font-size: 22px; margin-bottom: 8px; }
        .action-title { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 3px; }
        .action-sub { font-size: 12px; color: #94A3B8; }
      `}</style>

      <div className="header">
        <div className="page-title">Overview</div>
        <div className="page-sub">Welcome to your DentPlus admin</div>
      </div>

      {stats?.trial_days_left !== null && stats?.trial_days_left !== undefined && (
        <div className="trial-banner">
          <div className="trial-text">
            {stats.trial_days_left > 0
              ? `Your free trial ends in ${stats.trial_days_left} day${stats.trial_days_left !== 1 ? 's' : ''}`
              : 'Your trial has ended'}
          </div>
          <button className="trial-btn" onClick={() => router.push('/admin/dashboard/billing')}>
            Upgrade plan
          </button>
        </div>
      )}

      <div className="stats">
        {[
          { label: 'Active patients', value: loading ? '—' : stats?.total_patients, color: '#0EA5E9' },
          { label: 'Upcoming appts', value: loading ? '—' : stats?.total_appointments, color: '#6366F1' },
          { label: 'AI bookings', value: loading ? '—' : stats?.ai_bookings, color: '#10B981' },
          { label: 'Staff members', value: loading ? '—' : stats?.staff_count, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="bar" style={{ background: s.color }} />
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="quick-actions">
        {[
          { icon: '🔗', title: 'View clinic page', sub: 'See what patients see', href: `/clinic/${slug}` },
          { icon: '👥', title: 'Invite staff', sub: 'Add team members', href: '/admin/dashboard/team' },
          { icon: '⚙️', title: 'Clinic profile', sub: 'Update info and branding', href: '/admin/dashboard/profile' },
        ].map(a => (
          <a key={a.title} href={a.href} className="action-card" target={a.href.startsWith('/clinic') ? '_blank' : undefined}>
            <div className="action-icon">{a.icon}</div>
            <div className="action-title">{a.title}</div>
            <div className="action-sub">{a.sub}</div>
          </a>
        ))}
      </div>
    </>
  )
}
