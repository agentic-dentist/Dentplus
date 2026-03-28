'use client'

import { useEffect, useState } from 'react'

interface Clinic {
  id: string; name: string; slug: string; plan: string
  trial_ends_at: string | null; created_at: string
  patients: number; appointments: number; staff: number
  ai_bookings: number; matchmaker_runs: number; reminders_sent: number
  last_activity: string | null; estimated_cost: number; is_active: boolean
}

interface PlatformStats {
  total_clinics: number; active_clinics: number; total_patients: number
  total_appointments: number; total_ai_bookings: number
  total_matchmaker_runs: number; total_reminders: number
  estimated_monthly_cost: number
}

const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  trial:      { bg: '#FEF3C7', color: '#D97706' },
  starter:    { bg: '#EEF2FF', color: '#4F46E5' },
  pro:        { bg: '#F0FDF4', color: '#10B981' },
  enterprise: { bg: '#FDF4FF', color: '#7C3AED' },
}

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

  const api = (type = 'overview') =>
    fetch(`/api/superadmin?type=${type}`, {
      headers: { 'x-superadmin-password': password }
    })

  const handleAuth = async () => {
    setAuthError('')
    setLoading(true)
    const res = await fetch('/api/superadmin?type=overview', {
      headers: { 'x-superadmin-password': password }
    })
    if (res.ok) {
      const data = await res.json()
      setClinics(data.clinics || [])
      setStats(data.stats)
      setAuthed(true)
    } else {
      setAuthError('Invalid password')
    }
    setLoading(false)
  }

  const loadData = async () => {
    setLoading(true)
    const res = await api()
    if (res.ok) {
      const data = await res.json()
      setClinics(data.clinics || [])
      setStats(data.stats)
    }
    setLoading(false)
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    const res = await api('logs')
    if (res.ok) {
      const data = await res.json()
      setAuditLog(data.logs || [])
    }
    setLoadingLogs(false)
  }

  useEffect(() => {
    if (tab === 'logs' && authed) loadLogs()
  }, [tab, authed])

  const extendTrial = async (clinicId: string) => {
    const res = await fetch('/api/superadmin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-superadmin-password': password },
      body: JSON.stringify({ action: 'extend_trial', clinicId })
    })
    if (res.ok) {
      const data = await res.json()
      setActionMsg('Trial extended 30 days ✓')
      setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, trial_ends_at: data.trial_ends_at } : c))
      setTimeout(() => setActionMsg(''), 3000)
    }
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
          body{font-family:'Inter',sans-serif;background:#F1F5F9;min-height:100vh;display:flex;align-items:center;justify-content:center}
          .card{background:white;border-radius:16px;padding:40px;width:360px;border:1px solid #E2E8F0;box-shadow:0 4px 24px rgba(0,0,0,.06)}
          .logo{font-size:20px;font-weight:700;color:#0F172A;text-align:center;margin-bottom:4px}
          .sub{font-size:13px;color:#94A3B8;text-align:center;margin-bottom:28px}
          label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
          input{width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;font-family:inherit}
          input:focus{border-color:#4F46E5}
          .btn{width:100%;padding:11px;background:#4F46E5;color:white;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer;margin-top:12px;font-family:inherit;transition:opacity .15s}
          .btn:disabled{opacity:.6;cursor:not-allowed}
          .err{color:#DC2626;font-size:12px;margin-top:8px;text-align:center}
        `}</style>
        <div className="card">
          <div className="logo">🦷 DentPlus</div>
          <div className="sub">Super admin access</div>
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()} placeholder="Enter superadmin password" />
          <button className="btn" onClick={handleAuth} disabled={loading}>
            {loading ? 'Verifying...' : 'Access platform'}
          </button>
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
        body{font-family:'Inter',sans-serif;background:#F1F5F9;min-height:100vh}
        .layout{display:flex;min-height:100vh}
        .sidebar{width:220px;background:#FFFFFF;border-right:1px solid #E2E8F0;flex-shrink:0;padding:20px 14px;display:flex;flex-direction:column;position:fixed;top:0;bottom:0}
        .logo{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:2px}
        .logo-sub{font-size:10px;color:rgba(148,163,184,.4);letter-spacing:1px;text-transform:uppercase;margin-bottom:28px}
        .nav-item{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:7px;cursor:pointer;font-size:13px;color:#334155;font-weight:500;transition:all .12s;margin-bottom:2px;border:none;background:none;width:100%;text-align:left;font-family:'Inter',sans-serif}
        .nav-item:hover{background:#F8FAFC;color:#0F172A}
        .nav-item.active{background:#EEF2FF;color:#4F46E5;font-weight:600;border-left:3px solid #4F46E5;padding-left:9px}
        .main{margin-left:220px;flex:1;padding:32px;background:#F1F5F9;min-height:100vh}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
        .stat{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:16px 18px}
        .stat-val{font-family:'Syne',sans-serif;font-size:26px;font-weight:700;color:#0F172A;line-height:1}
        .stat-label{font-size:11px;color:#94A3B8;margin-top:4px}
        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:16px}
        .card-header{padding:14px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-size:13px;font-weight:600;color:#0F172A}
        .search-input{padding:7px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;outline:none;width:220px}
        .search-input:focus{border-color:#4F46E5}
        .clinic-table{width:100%;border-collapse:collapse}
        .th{padding:10px 16px;font-size:11px;font-weight:600;color:#94A3B8;text-align:left;border-bottom:1px solid #F1F5F9;background:#FAFBFC;text-transform:uppercase;letter-spacing:.3px}
        .tr{border-bottom:1px solid #F8FAFC;cursor:pointer;transition:background .1s}
        .tr:last-child{border-bottom:none}
        .tr:hover{background:#FAFBFC}
        .tr.sel{background:#EEF2FF}
        .td{padding:11px 16px;font-size:13px;color:#0F172A;vertical-align:middle}
        .clinic-name{font-weight:500}
        .clinic-slug{font-size:11px;color:#94A3B8;font-family:'JetBrains Mono',monospace}
        .badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;display:inline-block}
        .mono{font-family:'JetBrains Mono',monospace;font-size:12px;color:#64748B}
        .active-dot{width:6px;height:6px;border-radius:50%;background:#10B981;display:inline-block;margin-right:5px}
        .inactive-dot{width:6px;height:6px;border-radius:50%;background:#CBD5E1;display:inline-block;margin-right:5px}
        .action-bar{display:flex;gap:8px;padding:12px 20px;border-top:1px solid #F1F5F9;flex-wrap:wrap;align-items:center;background:#F8FAFC}
        .action-btn{padding:7px 14px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;font-weight:500;color:#64748B;background:white;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s}
        .action-btn:hover{border-color:#4F46E5;color:#4F46E5}
        .action-btn.primary{background:#0F172A;color:white;border-color:#0F172A}
        .action-btn.primary:hover{background:#1E293B}
        .action-msg{font-size:12px;color:#10B981;font-weight:600}
        .cost-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .cost-card{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:16px 18px}
        .cost-title{font-size:11px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
        .cost-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #F8FAFC;font-size:13px}
        .cost-row:last-child{border-bottom:none}
        .cost-total{font-weight:700;color:#4F46E5}
        .log-row{display:flex;align-items:center;gap:12px;padding:9px 20px;border-bottom:1px solid #F8FAFC;font-size:12px}
        .log-row:last-child{border-bottom:none}
        .log-action{font-weight:500;color:#0F172A;min-width:200px;text-transform:capitalize}
        .log-clinic{color:#64748B;font-family:'JetBrains Mono',monospace;font-size:11px;min-width:120px}
        .log-time{color:#CBD5E1;font-family:'JetBrains Mono',monospace;font-size:11px;margin-left:auto;white-space:nowrap}
        .refresh-btn{padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;color:#64748B;background:white;cursor:pointer;font-family:'Inter',sans-serif}
        .refresh-btn:hover{background:#F8FAFC}
        .empty{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
        .loading{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
      `}</style>

      <div className="layout">
        <aside className="sidebar">
          <div className="logo">🦷 DentPlus</div>
          <div className="logo-sub">Super Admin</div>
          {[
            { key: 'overview', icon: '▦', label: 'Overview' },
            { key: 'clinics',  icon: '◈', label: 'Clinics' },
            { key: 'costs',    icon: '◎', label: 'AI Costs' },
            { key: 'logs',     icon: '⚡', label: 'Audit Logs' },
          ].map(item => (
            <button key={item.key} className={`nav-item ${tab === item.key ? 'active' : ''}`}
              onClick={() => setTab(item.key as typeof tab)}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </aside>

        <main className="main">
          {loading ? <div className="loading">Loading platform data...</div> : <>

            {/* ── OVERVIEW ── */}
            {tab === 'overview' && <>
              <div className="page-title">Platform Overview</div>
              <div className="page-sub">DentPlus — all clinics, all activity</div>
              <div className="stats-grid">
                {[
                  { val: stats?.total_clinics,         label: 'Total clinics',        color: '#4F46E5' },
                  { val: stats?.active_clinics,        label: 'Active (7 days)',       color: '#10B981' },
                  { val: stats?.total_patients,        label: 'Total patients',        color: '#6366F1' },
                  { val: stats?.total_appointments,    label: 'Total appointments',    color: '#F59E0B' },
                  { val: stats?.total_ai_bookings,     label: 'AI bookings',           color: '#4F46E5' },
                  { val: stats?.total_matchmaker_runs, label: 'Matchmaker runs',       color: '#7C3AED' },
                  { val: stats?.total_reminders,       label: 'Reminders sent',        color: '#10B981' },
                  { val: `$${stats?.estimated_monthly_cost.toFixed(2)}`, label: 'Est. AI cost (total)', color: '#F43F5E' },
                ].map(s => (
                  <div key={s.label} className="stat">
                    <div className="stat-val" style={{ color: s.color }}>{s.val ?? '—'}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Recent clinics</div>
                  <button className="refresh-btn" onClick={loadData}>↻ Refresh</button>
                </div>
                <table className="clinic-table">
                  <thead><tr>
                    <th className="th">Clinic</th>
                    <th className="th">Plan</th>
                    <th className="th">Patients</th>
                    <th className="th">AI bookings</th>
                    <th className="th">Last activity</th>
                  </tr></thead>
                  <tbody>
                    {clinics.slice(0, 10).map(c => (
                      <tr key={c.id} className="tr" onClick={() => { setSelectedClinic(c); setTab('clinics') }}>
                        <td className="td">
                          <span className={c.is_active ? 'active-dot' : 'inactive-dot'} />
                          <span className="clinic-name">{c.name}</span>
                          <div className="clinic-slug" style={{ marginLeft: '11px' }}>{c.slug}</div>
                        </td>
                        <td className="td"><span className="badge" style={PLAN_STYLE[c.plan] || PLAN_STYLE.trial}>{c.plan}</span></td>
                        <td className="td mono">{c.patients}</td>
                        <td className="td mono">{c.ai_bookings}</td>
                        <td className="td mono">{c.last_activity ? formatRelative(c.last_activity) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>}

            {/* ── CLINICS ── */}
            {tab === 'clinics' && <>
              <div className="page-title">Clinics</div>
              <div className="page-sub">{clinics.length} registered clinics</div>
              <div className="card">
                <div className="card-header">
                  <input className="search-input" placeholder="Search clinics..."
                    value={search} onChange={e => setSearch(e.target.value)} />
                  <button className="refresh-btn" onClick={loadData}>↻ Refresh</button>
                </div>
                <table className="clinic-table">
                  <thead><tr>
                    <th className="th">Clinic</th>
                    <th className="th">Plan</th>
                    <th className="th">Patients</th>
                    <th className="th">Staff</th>
                    <th className="th">Apts</th>
                    <th className="th">AI</th>
                    <th className="th">ML</th>
                    <th className="th">Reminders</th>
                    <th className="th">Est cost</th>
                    <th className="th">Last active</th>
                    <th className="th">Joined</th>
                  </tr></thead>
                  <tbody>
                    {filteredClinics.map(c => (
                      <tr key={c.id} className={`tr ${selectedClinic?.id === c.id ? 'sel' : ''}`}
                        onClick={() => setSelectedClinic(selectedClinic?.id === c.id ? null : c)}>
                        <td className="td">
                          <span className={c.is_active ? 'active-dot' : 'inactive-dot'} />
                          <span className="clinic-name">{c.name}</span>
                          <div className="clinic-slug" style={{ marginLeft: '11px' }}>{c.slug}</div>
                        </td>
                        <td className="td"><span className="badge" style={PLAN_STYLE[c.plan] || PLAN_STYLE.trial}>{c.plan}</span></td>
                        <td className="td mono">{c.patients}</td>
                        <td className="td mono">{c.staff}</td>
                        <td className="td mono">{c.appointments}</td>
                        <td className="td mono">{c.ai_bookings}</td>
                        <td className="td mono">{c.matchmaker_runs}</td>
                        <td className="td mono">{c.reminders_sent}</td>
                        <td className="td mono" style={{ color: c.estimated_cost > 20 ? '#F43F5E' : '#0F172A' }}>${c.estimated_cost.toFixed(2)}</td>
                        <td className="td mono">{c.last_activity ? formatRelative(c.last_activity) : '—'}</td>
                        <td className="td mono">{new Date(c.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedClinic && (
                  <div className="action-bar">
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{selectedClinic.name}</span>
                    <button className="action-btn primary" onClick={() => window.open(`/clinic/${selectedClinic.slug}/dashboard`, '_blank')}>Open dashboard →</button>
                    <button className="action-btn" onClick={() => window.open(`/clinic/${selectedClinic.slug}`, '_blank')}>View clinic page</button>
                    {selectedClinic.plan === 'trial' && (
                      <button className="action-btn" onClick={() => extendTrial(selectedClinic.id)}>+30 days trial</button>
                    )}
                    {actionMsg && <span className="action-msg">{actionMsg}</span>}
                  </div>
                )}
              </div>
            </>}

            {/* ── COSTS ── */}
            {tab === 'costs' && <>
              <div className="page-title">AI Cost Tracker</div>
              <div className="page-sub">Estimated Anthropic API spend — based on usage</div>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
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
                      <div style={{ fontWeight: 500, color: '#0F172A' }}>{c.name}</div>
                      <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px' }}>${c.estimated_cost.toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="cost-row">
                    <div className="cost-total">Total</div>
                    <div className="cost-total" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px' }}>${stats?.estimated_monthly_cost.toFixed(2)}</div>
                  </div>
                </div>
                <div className="cost-card">
                  <div className="cost-title">Cost assumptions (Anthropic)</div>
                  {[
                    { label: 'AI booking conversation',       cost: '$0.050', note: 'Sonnet + Haiku, 5 turns avg' },
                    { label: 'Matchmaker run',                cost: '$0.002', note: 'Minimal LLM, mostly DB' },
                    { label: 'Outreach / reminder message',   cost: '$0.008', note: 'Haiku, 1 generation' },
                    { label: 'Auditor check',                 cost: '$0.003', note: 'Haiku, async' },
                  ].map(r => (
                    <div key={r.label} className="cost-row">
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: '#0F172A' }}>{r.label}</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>{r.note}</div>
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#0F172A' }}>{r.cost}</div>
                    </div>
                  ))}
                  <div className="cost-row" style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Switching to Cohere (command-r-plus) saves ~28%</div>
                  </div>
                </div>
              </div>
            </>}

            {/* ── LOGS ── */}
            {tab === 'logs' && <>
              <div className="page-title">Audit Logs</div>
              <div className="page-sub">Platform-wide agent activity — last 100 events</div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Recent events</div>
                  <button className="refresh-btn" onClick={loadLogs}>↻ Refresh</button>
                </div>
                {loadingLogs ? <div className="loading">Loading...</div>
                  : auditLog.length === 0 ? <div className="empty">No logs yet</div>
                  : auditLog.map((entry, i) => {
                    const clinic = clinics.find(c => c.id === entry.clinic_id)
                    const agent  = (entry.metadata as Record<string, string>)?.agent || ''
                    return (
                      <div key={i} className="log-row">
                        <div className="log-action">{(entry.action as string).replace(/_/g, ' ')}</div>
                        <div className="log-clinic">{clinic?.name || String(entry.clinic_id).slice(0, 8)}</div>
                        {agent && <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#64748B' }}>{agent}</span>}
                        <div className="log-time">{formatRelative(entry.created_at as string)}</div>
                      </div>
                    )
                  })}
              </div>
            </>}
          </>}
        </main>
      </div>
    </>
  )
}
