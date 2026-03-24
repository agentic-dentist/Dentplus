'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'

interface WaitlistEntry {
  id: string
  patient_id: string
  appointment_type: string
  urgency: string
  status: string
  any_time: boolean
  preferred_days: string[]
  preferred_times: string[]
  notes: string | null
  priority: number
  created_at: string
  offered_at: string | null
  offered_slot_start: string | null
  patients: { full_name: string; phone_primary: string | null; email: string | null }[] | { full_name: string; phone_primary: string | null; email: string | null } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  waiting:  { bg: '#EFF6FF', color: '#0EA5E9' },
  offered:  { bg: '#FEF3C7', color: '#D97706' },
  confirmed:{ bg: '#D1FAE5', color: '#059669' },
  declined: { bg: '#FEE2E2', color: '#DC2626' },
  expired:  { bg: '#F1F5F9', color: '#94A3B8' },
}

const URGENCY_STYLE: Record<string, { bg: string; color: string }> = {
  urgent:  { bg: '#FEE2E2', color: '#DC2626' },
  routine: { bg: '#F1F5F9', color: '#64748B' },
}

const TYPE_COLOR: Record<string, string> = {
  cleaning: '#0EA5E9', checkup: '#0EA5E9', filling: '#6366F1',
  emergency: '#F43F5E', consultation: '#F59E0B', crown: '#6366F1',
}

export default function WaitlistPage() {
  const [clinicId, setClinicId]         = useState('')
  const [entries, setEntries]           = useState<WaitlistEntry[]>([])
  const [filtered, setFiltered]         = useState<WaitlistEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter]     = useState<string>('all')
  const [selected, setSelected]         = useState<WaitlistEntry | null>(null)
  const [removing, setRemoving]         = useState(false)
  const supabase = createClient()
  const pathname = usePathname()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: staff } = await supabase.from('staff_accounts')
        .select('clinic_id').eq('auth_id', user.id).single()
      const { data: owner } = await supabase.from('clinic_owners')
        .select('clinic_id').eq('auth_id', user.id).single()
      const cid = staff?.clinic_id || owner?.clinic_id
      if (!cid) return
      setClinicId(cid)
      await load(cid)
    }
    init()
  }, [pathname])

  const load = async (cid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('waiting_list')
      .select('*, patients(full_name, phone_primary, email)')
      .eq('clinic_id', cid)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
    setEntries(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  useEffect(() => {
    let f = entries
    if (statusFilter !== 'all') f = f.filter(e => e.status === statusFilter)
    if (typeFilter   !== 'all') f = f.filter(e => e.appointment_type === typeFilter)
    setFiltered(f)
  }, [statusFilter, typeFilter, entries])

  const removeEntry = async (id: string) => {
    setRemoving(true)
    await supabase.from('waiting_list').update({ status: 'expired' }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'expired' } : e))
    setSelected(null)
    setRemoving(false)
  }

  const formatTime = (iso: string) => new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
  })

  const formatRelative = (iso: string) => {
    const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day ago'
    return `${diffDays} days ago`
  }

  const getPatient = (entry: WaitlistEntry) =>
    Array.isArray(entry.patients) ? entry.patients[0] : entry.patients

  const waitingCount  = entries.filter(e => e.status === 'waiting').length
  const offeredCount  = entries.filter(e => e.status === 'offered').length
  const urgentCount   = entries.filter(e => e.urgency === 'urgent' && e.status === 'waiting').length
  const appointmentTypes = [...new Set(entries.map(e => e.appointment_type))]

  const patient = selected ? getPatient(selected) : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400&display=swap');
        *{box-sizing:border-box}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}
        .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        .stat{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:14px 20px}
        .stat-val{font-family:'Syne',sans-serif;font-size:26px;font-weight:700;line-height:1}
        .stat-label{font-size:12px;color:#94A3B8;margin-top:4px}
        .toolbar{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
        .filter-select{padding:7px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0F172A;background:white;outline:none;cursor:pointer}
        .filter-select:focus{border-color:#0EA5E9}
        .count-label{font-size:13px;color:#94A3B8}
        .refresh-btn{padding:7px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:12px;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif;margin-left:auto}
        .refresh-btn:hover{background:#F8FAFC}
        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden}
        .wl-table{width:100%;border-collapse:collapse}
        .wl-th{padding:10px 16px;font-size:11px;font-weight:600;color:#94A3B8;text-align:left;border-bottom:1px solid #F1F5F9;background:#FAFBFC;letter-spacing:.3px;text-transform:uppercase}
        .wl-row{border-bottom:1px solid #F8FAFC;cursor:pointer;transition:background .1s}
        .wl-row:last-child{border-bottom:none}
        .wl-row:hover{background:#FAFBFC}
        .wl-row.sel{background:#F0F9FF}
        .wl-td{padding:12px 16px;font-size:13px;color:#0F172A;vertical-align:middle}
        .patient-name{font-weight:500}
        .patient-contact{font-size:11px;color:#94A3B8;margin-top:2px;font-family:'JetBrains Mono',monospace}
        .type-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
        .badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;display:inline-block}
        .pref-text{font-size:11px;color:#64748B}
        .wait-time{font-size:12px;color:#64748B;font-family:'JetBrains Mono',monospace}
        .overlay{position:fixed;inset:0;background:rgba(15,23,42,.3);z-index:40;backdrop-filter:blur(2px)}
        .panel{position:fixed;right:0;top:0;bottom:0;width:400px;background:white;z-index:50;box-shadow:-8px 0 40px rgba(0,0,0,.12);display:flex;flex-direction:column;animation:slideIn .2s cubic-bezier(.22,1,.36,1)}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .panel-header{padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;flex-shrink:0;position:relative}
        .panel-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A}
        .panel-sub{font-size:12px;color:#94A3B8;margin-top:3px}
        .panel-close{position:absolute;top:18px;right:20px;width:28px;height:28px;border-radius:50%;background:#F1F5F9;border:none;cursor:pointer;font-size:14px;color:#64748B;display:flex;align-items:center;justify-content:center}
        .panel-close:hover{background:#E2E8F0}
        .panel-body{flex:1;overflow-y:auto;padding:20px 24px}
        .panel-footer{padding:16px 24px;border-top:1px solid #F1F5F9;flex-shrink:0}
        .detail-section{margin-bottom:20px}
        .detail-label{font-size:11px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
        .detail-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #F8FAFC;font-size:13px}
        .detail-row:last-child{border-bottom:none}
        .detail-key{color:#64748B}
        .detail-val{color:#0F172A;font-weight:500;text-align:right}
        .pref-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
        .pref-chip{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500;background:#F1F5F9;color:#64748B;text-transform:capitalize}
        .offer-banner{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 14px;margin-bottom:16px}
        .offer-banner-title{font-size:12px;font-weight:600;color:#92400E;margin-bottom:3px}
        .offer-banner-time{font-size:13px;color:#0F172A;font-weight:500}
        .remove-btn{width:100%;padding:11px;background:#FEF2F2;color:#DC2626;border:1.5px solid #FECACA;border-radius:9px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .15s}
        .remove-btn:hover{background:#FEE2E2}
        .remove-btn:disabled{opacity:.6;cursor:not-allowed}
        .empty{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
      `}</style>

      <div className="page-title">Waitlist</div>
      <div className="page-sub">Manage patients waiting for appointments — sorted by urgency then wait time</div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-val" style={{ color: waitingCount > 0 ? '#0EA5E9' : '#0F172A' }}>{waitingCount}</div>
          <div className="stat-label">Waiting</div>
        </div>
        <div className="stat">
          <div className="stat-val" style={{ color: offeredCount > 0 ? '#D97706' : '#0F172A' }}>{offeredCount}</div>
          <div className="stat-label">Slot offered</div>
        </div>
        <div className="stat">
          <div className="stat-val" style={{ color: urgentCount > 0 ? '#DC2626' : '#0F172A' }}>{urgentCount}</div>
          <div className="stat-label">Urgent</div>
        </div>
      </div>

      <div className="toolbar">
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="waiting">Waiting</option>
          <option value="offered">Offered</option>
          <option value="confirmed">Confirmed</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
        </select>
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {appointmentTypes.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <span className="count-label">{filtered.length} patient{filtered.length !== 1 ? 's' : ''}</span>
        <button className="refresh-btn" onClick={() => load(clinicId)}>↻ Refresh</button>
      </div>

      {loading ? (
        <div className="empty">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty">No patients on the waitlist</div></div>
      ) : (
        <div className="card">
          <table className="wl-table">
            <thead>
              <tr>
                <th className="wl-th">Patient</th>
                <th className="wl-th">Type</th>
                <th className="wl-th">Urgency</th>
                <th className="wl-th">Preference</th>
                <th className="wl-th">Status</th>
                <th className="wl-th">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => {
                const p = getPatient(entry)
                const s = STATUS_STYLE[entry.status] || STATUS_STYLE.waiting
                const u = URGENCY_STYLE[entry.urgency] || URGENCY_STYLE.routine
                const typeColor = TYPE_COLOR[entry.appointment_type] || '#94A3B8'
                return (
                  <tr key={entry.id} className={`wl-row ${selected?.id === entry.id ? 'sel' : ''}`}
                    onClick={() => setSelected(entry)}>
                    <td className="wl-td">
                      <div className="patient-name">{p?.full_name || 'Unknown'}</div>
                      <div className="patient-contact">{p?.phone_primary || p?.email || '—'}</div>
                    </td>
                    <td className="wl-td">
                      <span className="type-dot" style={{ background: typeColor }} />
                      <span style={{ textTransform: 'capitalize' }}>{entry.appointment_type}</span>
                    </td>
                    <td className="wl-td">
                      <span className="badge" style={u}>{entry.urgency}</span>
                    </td>
                    <td className="wl-td">
                      <span className="pref-text">
                        {entry.any_time ? 'Any time' : `${entry.preferred_days?.length || 0}d · ${entry.preferred_times?.length || 0}t`}
                      </span>
                    </td>
                    <td className="wl-td">
                      <span className="badge" style={s}>{entry.status}</span>
                    </td>
                    <td className="wl-td">
                      <span className="wait-time">{formatRelative(entry.created_at)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <>
          <div className="overlay" onClick={() => setSelected(null)} />
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">{patient?.full_name || 'Patient'}</div>
              <div className="panel-sub">Waitlist entry · added {formatRelative(selected.created_at)}</div>
              <button className="panel-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="panel-body">
              {selected.status === 'offered' && selected.offered_slot_start && (
                <div className="offer-banner">
                  <div className="offer-banner-title">⏳ Slot offered — awaiting patient response</div>
                  <div className="offer-banner-time">
                    {new Date(selected.offered_slot_start).toLocaleDateString('en-CA', {
                      weekday: 'long', month: 'long', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
                    })}
                  </div>
                </div>
              )}
              <div className="detail-section">
                <div className="detail-label">Appointment</div>
                <div className="detail-row"><span className="detail-key">Type</span>
                  <span className="detail-val" style={{ textTransform: 'capitalize' }}>{selected.appointment_type}</span></div>
                <div className="detail-row"><span className="detail-key">Urgency</span>
                  <span className="badge" style={URGENCY_STYLE[selected.urgency] || URGENCY_STYLE.routine}>{selected.urgency}</span></div>
                <div className="detail-row"><span className="detail-key">Status</span>
                  <span className="badge" style={STATUS_STYLE[selected.status] || STATUS_STYLE.waiting}>{selected.status}</span></div>
                <div className="detail-row"><span className="detail-key">Priority score</span>
                  <span className="detail-val">{selected.priority}</span></div>
                <div className="detail-row"><span className="detail-key">Added</span>
                  <span className="detail-val">{formatTime(selected.created_at)}</span></div>
                {selected.offered_at && (
                  <div className="detail-row"><span className="detail-key">Slot offered</span>
                    <span className="detail-val">{formatTime(selected.offered_at)}</span></div>
                )}
              </div>
              <div className="detail-section">
                <div className="detail-label">Scheduling preference</div>
                {selected.any_time ? (
                  <div style={{ fontSize: '13px', color: '#10B981', fontWeight: 500 }}>✓ Any time works</div>
                ) : (
                  <>
                    {(selected.preferred_days?.length ?? 0) > 0 && (
                      <>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px' }}>Preferred days</div>
                        <div className="pref-chips">
                          {selected.preferred_days.map(d => <span key={d} className="pref-chip">{d}</span>)}
                        </div>
                      </>
                    )}
                    {(selected.preferred_times?.length ?? 0) > 0 && (
                      <>
                        <div style={{ fontSize: '11px', color: '#94A3B8', margin: '10px 0 6px' }}>Preferred times</div>
                        <div className="pref-chips">
                          {selected.preferred_times.map(t => <span key={t} className="pref-chip">{t}</span>)}
                        </div>
                      </>
                    )}
                  </>
                )}
                {selected.notes && (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: '#64748B', fontStyle: 'italic' }}>
                    "{selected.notes}"
                  </div>
                )}
              </div>
              <div className="detail-section">
                <div className="detail-label">Contact</div>
                <div className="detail-row"><span className="detail-key">Phone</span>
                  <span className="detail-val">{patient?.phone_primary || '—'}</span></div>
                <div className="detail-row"><span className="detail-key">Email</span>
                  <span className="detail-val">{patient?.email || '—'}</span></div>
              </div>
            </div>
            {(selected.status === 'waiting' || selected.status === 'offered') && (
              <div className="panel-footer">
                <button className="remove-btn" onClick={() => removeEntry(selected.id)} disabled={removing}>
                  {removing ? 'Removing...' : 'Remove from waitlist'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
