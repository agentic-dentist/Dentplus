'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Superadmin uses service role directly — this page is locked behind superadmin auth
// In production, protect this route with middleware checking superadmins table

interface Clinic {
  id: string
  name: string
  slug: string
  plan: string
  trial_ends_at: string | null
  created_at: string
  patients: number
  appointments: number
  staff: number
  ai_bookings: number
  matchmaker_runs: number
  reminders_sent: number
  last_activity: string | null
  estimated_cost: number
}

interface PlatformStats {
  total_clinics: number
  active_clinics: number
  total_patients: number
  total_appointments: number
  total_ai_bookings: number
  total_matchmaker_runs: number
  total_reminders: number
  estimated_monthly_cost: number
}

const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  trial:      { bg: '#FEF3C7', color: '#D97706' },
  starter:    { bg: '#EFF6FF', color: '#0EA5E9' },
  pro:        { bg: '#F0FDF4', color: '#10B981' },
  enterprise: { bg: '#FDF4FF', color: '#7C3AED' },
}

// Cost per 1000 tokens (Anthropic Sonnet + Haiku blended estimate)
const COST_PER_BOOKING     = 0.05  // $0.05 per AI conversation
const COST_PER_REMINDER    = 0.008 // $0.008 per reminder
const COST_PER_MATCHMAKER  = 0.002 // $0.002 per matchmaker run (pure DB, minimal LLM)

export default function SuperAdminPage() {
  const [authed, setAuthed]       = useState(false)
  const [password, setPassword]   = useState('')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading]     = useState(false)
  const [clinics, setClinics]     = useState<Clinic[]>([])
  const [stats, setStats]         = useState<PlatformStats | null>(null)
  const [tab, setTab]             = useState<'overview' | 'clinics' | 'costs' | 'logs'>('overview')
  const [search, setSearch]       = useState('')
  const [auditLog, setAuditLog]   = useState<Record<string, unknown>[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)
  const [actionMsg, setActionMsg] = useState('')

  // Simple password gate — in production use proper superadmin auth
  const SUPER_PASSWORD = process.env.NEXT_PUBLIC_SUPERADMIN_PASSWORD || 'dentplus-admin-2026'

  const handleAuth = () => {
    if (password === SUPER_PASSWORD) {
      setAuthed(true)
      loadData()
    } else {
      setAuthError('Invalid password')
    }
  }

  const loadData = async () => {
    setLoading(true)
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Fetch all clinics with their settings
    const { data: clinicList } = await db
      .from('clinics')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })

    if (!clinicList) { setLoading(false); return }

    // Fetch stats for each clinic in parallel
    const clinicData = await Promise.all(clinicList.map(async c => {
      const [
        { count: patients },
        { count: appointments },
        { count: staff },
        { data: aiApts },
        { count: matchmaker },
        { count: reminders },
        { data: settings },
        { data: sub },
        { data: lastAudit },
      ] = await Promise.all([
        db.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', c.id).eq('is_active', true),
        db.from('appointments').select('*', { count: 'exact', head: true }).eq('clinic_id', c.id),
        db.from('staff_accounts').select('*', { count: 'exact', head: true }).eq('clinic_id', c.id).eq('is_active', true),
        db.from('appointments').select('id').eq('clinic_id', c.id).in('booked_via', ['web_agent', 'matchmaker']),
        db.from('matchmaker_runs').select('*', { count: 'exact', head: true }).eq('clinic_id', c.id),
        db.from('outreach_log').select('*', { count: 'exact', head: true }).eq('clinic_id', c.id).in('outreach_type', ['reminder_48h', 'reminder_24h']),
        db.from('clinic_settings').select('slug').eq('clinic_id', c.id).single(),
        db.from('subscriptions').select('plan, trial_ends_at').eq('clinic_id', c.id).single(),
        db.from('audit_log').select('created_at').eq('clinic_id', c.id).order('created_at', { ascending: false }).limit(1),
      ])

      const aiBookings = aiApts?.length || 0
      const mmRuns     = matchmaker || 0
      const remCount   = reminders  || 0
      const estCost    = (aiBookings * COST_PER_BOOKING) + (mmRuns * COST_PER_MATCHMAKER) + (remCount * COST_PER_REMINDER)

      return {
        id:               c.id,
        name:             c.name,
        slug:             settings?.slug || '',
        plan:             sub?.plan || 'trial',
        trial_ends_at:    sub?.trial_ends_at || null,
        created_at:       c.created_at,
        patients:         patients || 0,
        appointments:     appointments || 0,
        staff:            staff || 0,
        ai_bookings:      aiBookings,
        matchmaker_runs:  mmRuns,
        reminders_sent:   remCount,
        last_activity:    lastAudit?.[0]?.created_at || null,
        estimated_cost:   estCost,
      } as Clinic
    }))

    setClinics(clinicData)

    // Platform totals
    const totalCost = clinicData.reduce((s, c) => s + c.estimated_cost, 0)
    setStats({
      total_clinics:           clinicData.length,
      active_clinics:          clinicData.filter(c => c.last_activity && new Date(c.last_activity) > new Date(Date.now() - 7 * 86400000)).length,
      total_patients:          clinicData.reduce((s, c) => s + c.patients, 0),
      total_appointments:      clinicData.reduce((s, c) => s + c.appointments, 0),
      total_ai_bookings:       clinicData.reduce((s, c) => s + c.ai_bookings, 0),
      total_matchmaker_runs:   clinicData.reduce((s, c) => s + c.matchmaker_runs, 0),
      total_reminders:         clinicData.reduce((s, c) => s + c.reminders_sent, 0),
      estimated_monthly_cost:  totalCost,
    })

    setLoading(false)
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await db
      .from('audit_log')
      .select('id, clinic_id, action, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setAuditLog(data || [])
    setLoadingLogs(false)
  }

  useEffect(() => {
    if (tab === 'logs' && authed) loadLogs()
  }, [tab, authed])

  const extendTrial = async (clinicId: string) => {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const newEnd = new Date(Date.now() + 30 * 86400000).toISOString()
    await db.from('subscriptions').update({ trial_ends_at: newEnd }).eq('clinic_id', clinicId)
    setActionMsg('Trial extended by 30 days')
    setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, trial_ends_at: newEnd } : c))
    setTimeout(() => setActionMsg(''), 3000)
  }

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7)  return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  }

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (!authed) {
    return (
      <>
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:'DM Sans',sans-serif;background:#0F172A;min-height:100vh;display:flex;align-items:center;justify-content:center}
          .card{background:white;border-radius:16px;padding:40px;width:360px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
          .logo{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0F172A;text-align:center;margin-bottom:4px}
          .sub{font-size:13px;color:#94A3B8;text-align:center;margin-bottom:28px}
          label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
          input{width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;font-family:'DM Sans',sans-serif}
          input:focus{border-color:#0F172A}
          .btn{width:100%;padding:11px;background:#0F172A;color:white;border-radius:8px;font-size:14px;font-weight:500;border:none;cursor:pointer;margin-top:12px;font-family:'DM Sans',sans-serif}
          .err{color:#DC2626;font-size:12px;margin-top:8px;text-align:center}
        `}</style>
        <div className="card">
          <div className="logo">🦷 DentPlus</div>
          <div className="sub">Super admin access</div>
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()} placeholder="Enter superadmin password" />
          <button className="btn" onClick={handleAuth}>Access platform</button>
          {authError && <div className="err">{authError}</div>}
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400&family=DM+Sans:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#0F172A;min-height:100vh;color:#0F172A}
        .layout{display:flex;min-height:100vh}

        .sidebar{width:220px;background:#0F172A;flex-shrink:0;padding:24px 16px;display:flex;flex-direction:column;position:fixed;top:0;bottom:0}
        .logo{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:white;margin-bottom:4px}
        .logo-sub{font-size:10px;color:rgba(148,163,184,.4);letter-spacing:1px;text-transform:uppercase;margin-bottom:28px}
        .nav-item{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:7px;cursor:pointer;font-size:13px;color:rgba(148,163,184,.6);transition:all .15s;margin-bottom:2px;border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif}
        .nav-item:hover{background:rgba(255,255,255,.05);color:#CBD5E1}
        .nav-item.active{background:rgba(14,165,233,.1);color:#0EA5E9}
        .nav-icon{width:16px;text-align:center}

        .main{margin-left:220px;flex:1;padding:32px;background:#F0F4F8;min-height:100vh}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}

        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
        .stat{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:16px 18px}
        .stat-val{font-family:'Syne',sans-serif;font-size:26px;font-weight:700;color:#0F172A;line-height:1}
        .stat-label{font-size:11px;color:#94A3B8;margin-top:4px}

        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:16px}
        .card-header{padding:14px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-size:13px;font-weight:600;color:#0F172A}

        .search-input{padding:7px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;width:220px}
        .search-input:focus{border-color:#0EA5E9}

        .clinic-table{width:100%;border-collapse:collapse}
        .th{padding:10px 16px;font-size:11px;font-weight:600;color:#94A3B8;text-align:left;border-bottom:1px solid #F1F5F9;background:#FAFBFC;text-transform:uppercase;letter-spacing:.3px}
        .tr{border-bottom:1px solid #F8FAFC;cursor:pointer;transition:background .1s}
        .tr:last-child{border-bottom:none}
        .tr:hover{background:#FAFBFC}
        .tr.selected{background:#F0F9FF}
        .td{padding:11px 16px;font-size:13px;color:#0F172A;vertical-align:middle}
        .clinic-name{font-weight:500}
        .clinic-slug{font-size:11px;color:#94A3B8;font-family:'JetBrains Mono',monospace}
        .badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;display:inline-block}
        .mono{font-family:'JetBrains Mono',monospace;font-size:12px;color:#64748B}

        .action-bar{display:flex;gap:8px;padding:12px 20px;border-top:1px solid #F1F5F9;flex-wrap:wrap;align-items:center}
        .action-btn{padding:7px 14px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;font-weight:500;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
        .action-btn:hover{border-color:#0EA5E9;color:#0EA5E9}
        .action-btn.danger:hover{border-color:#F43F5E;color:#F43F5E}
        .action-btn.primary{background:#0F172A;color:white;border-color:#0F172A}
        .action-btn.primary:hover{background:#1E293B}
        .action-msg{font-size:12px;color:#10B981;font-weight:500}

        .cost-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .cost-card{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:16px 18px}
        .cost-title{font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
        .cost-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #F8FAFC;font-size:13px}
        .cost-row:last-child{border-bottom:none}
        .cost-clinic{color:#0F172A;font-weight:500}
        .cost-amount{font-family:'JetBrains Mono',monospace;color:#0F172A}
        .cost-total{font-weight:700;color:#0EA5E9}

        .log-row{display:flex;align-items:center;gap:12px;padding:9px 20px;border-bottom:1px solid #F8FAFC;font-size:12px}
        .log-row:last-child{border-bottom:none}
        .log-action{font-weight:500;color:#0F172A;min-width:200px}
        .log-clinic{color:#64748B;font-family:'JetBrains Mono',monospace;font-size:11px;min-width:80px}
        .log-time{color:#CBD5E1;font-family:'JetBrains Mono',monospace;font-size:11px;margin-left:auto;white-space:nowrap}

        .empty{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
        .loading{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
        .refresh-btn{padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif}
        .refresh-btn:hover{background:#F8FAFC}
      `}</style>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo">🦷 DentPlus</div>
          <div className="logo-sub">Super Admin</div>
          {[
            { key: 'overview',  icon: '▦', label: 'Overview' },
            { key: 'clinics',   icon: '◈', label: 'Clinics' },
            { key: 'costs',     icon: '◎', label: 'AI Costs' },
            { key: 'logs',      icon: '⚡', label: 'Audit Logs' },
          ].map(item => (
            <button key={item.key} className={`nav-item ${tab === item.key ? 'active' : ''}`}
              onClick={() => setTab(item.key as typeof tab)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </aside>

        <main className="main">
          {loading ? (
            <div className="loading">Loading platform data...</div>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {tab === 'overview' && (
                <>
                  <div className="page-title">Platform Overview</div>
                  <div className="page-sub">DentPlus — all clinics, all activity</div>

                  <div className="stats-grid">
                    {[
                      { val: stats?.total_clinics,         label: 'Total clinics',       color: '#0EA5E9' },
                      { val: stats?.active_clinics,        label: 'Active (7 days)',      color: '#10B981' },
                      { val: stats?.total_patients,        label: 'Total patients',       color: '#6366F1' },
                      { val: stats?.total_appointments,    label: 'Total appointments',   color: '#F59E0B' },
                      { val: stats?.total_ai_bookings,     label: 'AI bookings',          color: '#0EA5E9' },
                      { val: stats?.total_matchmaker_runs, label: 'Matchmaker runs',      color: '#7C3AED' },
                      { val: stats?.total_reminders,       label: 'Reminders sent',       color: '#10B981' },
                      { val: `$${stats?.estimated_monthly_cost.toFixed(2)}`, label: 'Est. AI cost (total)', color: '#F43F5E' },
                    ].map(s => (
                      <div key={s.label} className="stat">
                        <div className="stat-val" style={{ color: s.color }}>{s.val ?? '—'}</div>
                        <div className="stat-label">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent clinics */}
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Recent clinics</div>
                      <button className="refresh-btn" onClick={loadData}>↻ Refresh</button>
                    </div>
                    <table className="clinic-table">
                      <thead>
                        <tr>
                          <th className="th">Clinic</th>
                          <th className="th">Plan</th>
                          <th className="th">Patients</th>
                          <th className="th">AI bookings</th>
                          <th className="th">Last activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clinics.slice(0, 10).map(c => (
                          <tr key={c.id} className="tr" onClick={() => { setSelectedClinic(c); setTab('clinics') }}>
                            <td className="td">
                              <div className="clinic-name">{c.name}</div>
                              <div className="clinic-slug">{c.slug}</div>
                            </td>
                            <td className="td">
                              <span className="badge" style={PLAN_STYLE[c.plan] || PLAN_STYLE.trial}>{c.plan}</span>
                            </td>
                            <td className="td mono">{c.patients}</td>
                            <td className="td mono">{c.ai_bookings}</td>
                            <td className="td mono">{c.last_activity ? formatRelative(c.last_activity) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── CLINICS ── */}
              {tab === 'clinics' && (
                <>
                  <div className="page-title">Clinics</div>
                  <div className="page-sub">{clinics.length} registered clinics</div>

                  <div className="card">
                    <div className="card-header">
                      <input className="search-input" placeholder="Search clinics..." value={search}
                        onChange={e => setSearch(e.target.value)} />
                      <button className="refresh-btn" onClick={loadData}>↻ Refresh</button>
                    </div>
                    <table className="clinic-table">
                      <thead>
                        <tr>
                          <th className="th">Clinic</th>
                          <th className="th">Plan</th>
                          <th className="th">Patients</th>
                          <th className="th">Staff</th>
                          <th className="th">Apts</th>
                          <th className="th">AI</th>
                          <th className="th">ML</th>
                          <th className="th">Est cost</th>
                          <th className="th">Last active</th>
                          <th className="th">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClinics.map(c => (
                          <tr key={c.id} className={`tr ${selectedClinic?.id === c.id ? 'selected' : ''}`}
                            onClick={() => setSelectedClinic(selectedClinic?.id === c.id ? null : c)}>
                            <td className="td">
                              <div className="clinic-name">{c.name}</div>
                              <div className="clinic-slug">{c.slug}</div>
                            </td>
                            <td className="td"><span className="badge" style={PLAN_STYLE[c.plan] || PLAN_STYLE.trial}>{c.plan}</span></td>
                            <td className="td mono">{c.patients}</td>
                            <td className="td mono">{c.staff}</td>
                            <td className="td mono">{c.appointments}</td>
                            <td className="td mono">{c.ai_bookings}</td>
                            <td className="td mono">{c.matchmaker_runs}</td>
                            <td className="td mono" style={{ color: c.estimated_cost > 20 ? '#F43F5E' : '#0F172A' }}>${c.estimated_cost.toFixed(2)}</td>
                            <td className="td mono">{c.last_activity ? formatRelative(c.last_activity) : '—'}</td>
                            <td className="td mono">{new Date(c.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {selectedClinic && (
                      <div className="action-bar">
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A' }}>{selectedClinic.name}</span>
                        <button className="action-btn primary" onClick={() => window.open(`/clinic/${selectedClinic.slug}/dashboard`, '_blank')}>
                          Open dashboard →
                        </button>
                        <button className="action-btn" onClick={() => window.open(`/clinic/${selectedClinic.slug}`, '_blank')}>
                          View clinic page
                        </button>
                        {selectedClinic.plan === 'trial' && (
                          <button className="action-btn" onClick={() => extendTrial(selectedClinic.id)}>
                            +30 days trial
                          </button>
                        )}
                        {actionMsg && <span className="action-msg">✓ {actionMsg}</span>}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── COSTS ── */}
              {tab === 'costs' && (
                <>
                  <div className="page-title">AI Cost Tracker</div>
                  <div className="page-sub">Estimated Anthropic API spend per clinic — based on usage patterns</div>

                  <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '24px' }}>
                    <div className="stat">
                      <div className="stat-val" style={{ color: '#F43F5E' }}>${stats?.estimated_monthly_cost.toFixed(2)}</div>
                      <div className="stat-label">Total estimated cost</div>
                    </div>
                    <div className="stat">
                      <div className="stat-val">${stats && stats.total_clinics > 0 ? (stats.estimated_monthly_cost / stats.total_clinics).toFixed(2) : '0.00'}</div>
                      <div className="stat-label">Avg cost per clinic</div>
                    </div>
                    <div className="stat">
                      <div className="stat-val" style={{ color: '#10B981' }}>
                        {stats ? Math.round((stats.estimated_monthly_cost / Math.max(stats.total_clinics * 99, 1)) * 100) : 0}%
                      </div>
                      <div className="stat-label">Cost as % of Starter revenue</div>
                    </div>
                  </div>

                  <div className="cost-grid">
                    <div className="cost-card">
                      <div className="cost-title">Cost by clinic</div>
                      {[...clinics].sort((a, b) => b.estimated_cost - a.estimated_cost).map(c => (
                        <div key={c.id} className="cost-row">
                          <div className="cost-clinic">{c.name}</div>
                          <div className="cost-amount">${c.estimated_cost.toFixed(2)}</div>
                        </div>
                      ))}
                      <div className="cost-row">
                        <div className="cost-clinic cost-total">Total</div>
                        <div className="cost-amount cost-total">${stats?.estimated_monthly_cost.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="cost-card">
                      <div className="cost-title">Cost assumptions (Anthropic)</div>
                      {[
                        { label: 'AI booking conversation',    cost: '$0.050', note: 'Sonnet + Haiku, 5 turns avg' },
                        { label: 'Matchmaker run',             cost: '$0.002', note: 'Minimal LLM, mostly DB' },
                        { label: 'Outreach message (SMS/email)', cost: '$0.008', note: 'Haiku, 1 generation' },
                        { label: '48h / 24h reminder',        cost: '$0.008', note: 'Haiku, 1 generation' },
                        { label: 'Auditor check',             cost: '$0.003', note: 'Haiku, async' },
                      ].map(r => (
                        <div key={r.label} className="cost-row">
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#0F172A' }}>{r.label}</div>
                            <div style={{ fontSize: '10px', color: '#94A3B8' }}>{r.note}</div>
                          </div>
                          <div className="cost-amount">{r.cost}</div>
                        </div>
                      ))}
                      <div className="cost-row" style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>Switch to Cohere (command-r-plus) saves ~28%</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── AUDIT LOGS ── */}
              {tab === 'logs' && (
                <>
                  <div className="page-title">Audit Logs</div>
                  <div className="page-sub">Platform-wide agent activity — last 100 events</div>

                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Recent events</div>
                      <button className="refresh-btn" onClick={loadLogs}>↻ Refresh</button>
                    </div>
                    {loadingLogs ? (
                      <div className="loading">Loading logs...</div>
                    ) : auditLog.length === 0 ? (
                      <div className="empty">No logs yet</div>
                    ) : auditLog.map((entry, i) => {
                      const clinic = clinics.find(c => c.id === entry.clinic_id)
                      const action = (entry.action as string).replace(/_/g, ' ')
                      const agent  = (entry.metadata as Record<string, string>)?.agent || ''
                      return (
                        <div key={i} className="log-row">
                          <div className="log-action" style={{ textTransform: 'capitalize' }}>{action}</div>
                          <div className="log-clinic">{clinic?.name || (entry.clinic_id as string)?.slice(0,8)}</div>
                          {agent && <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#64748B' }}>{agent}</span>}
                          <div className="log-time">{formatRelative(entry.created_at as string)}</div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
