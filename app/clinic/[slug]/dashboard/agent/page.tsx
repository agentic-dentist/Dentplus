'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'

interface AuditEntry {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface OutreachEntry {
  id: string
  outreach_type: string
  channel: string
  status: string
  message_text: string
  language: string
  created_at: string
  patients: { full_name: string }[] | { full_name: string } | null
  appointments: { appointment_type: string; start_time: string }[] | { appointment_type: string; start_time: string } | null
}

interface MatchmakerRun {
  id: string
  appointment_type: string
  slot_start: string
  candidates_found: number
  top_score: number | null
  status: string
  created_at: string
}

interface Stats {
  bookings_today: number
  cancellations_today: number
  reminders_sent: number
  matchmaker_runs: number
  offers_accepted: number
  offers_declined: number
}

const ACTION_ICON: Record<string, string> = {
  appointment_booked:      '✓',
  appointment_cancelled:   '✕',
  slots_queried:           '◷',
  waitlist_joined:         '◈',
  waitlist_offered:        '→',
  waitlist_confirmed:      '✓',
  patient_registered:      '+',
  patient_lookup:          '◎',
  outreach_sent:           '✉',
  matchmaker_run_started:  '⚡',
  matchmaker_candidates_scored: '⚡',
  conversation_started:    '💬',
}

const ACTION_COLOR: Record<string, string> = {
  appointment_booked:      '#10B981',
  appointment_cancelled:   '#F43F5E',
  slots_queried:           '#0EA5E9',
  waitlist_joined:         '#6366F1',
  waitlist_offered:        '#F59E0B',
  waitlist_confirmed:      '#10B981',
  patient_registered:      '#10B981',
  outreach_sent:           '#0EA5E9',
  matchmaker_run_started:  '#7C3AED',
  matchmaker_candidates_scored: '#7C3AED',
  conversation_started:    '#64748B',
}

const OUTREACH_LABEL: Record<string, string> = {
  reminder_48h:           '48h reminder',
  reminder_24h:           '24h reminder',
  slot_offer:             'Slot offer',
  confirmation_request:   'Confirmation request',
}

const STATUS_COLOR: Record<string, string> = {
  confirmed:        '#10B981',
  pending_outreach: '#F59E0B',
  outreach_sent:    '#0EA5E9',
  declined:         '#F43F5E',
  stubbed:          '#94A3B8',
  sent:             '#10B981',
}

export default function AgentPage() {
  const [clinicId, setClinicId]         = useState('')
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<'activity' | 'outreach' | 'matchmaker'>('activity')
  const [auditLog, setAuditLog]         = useState<AuditEntry[]>([])
  const [outreachLog, setOutreachLog]   = useState<OutreachEntry[]>([])
  const [matchmakerRuns, setMatchmakerRuns] = useState<MatchmakerRun[]>([])
  const [stats, setStats]               = useState<Stats | null>(null)
  const supabase = createClient()
  const pathname = usePathname()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Try staff_accounts first, then clinic_owners
      const { data: staff } = await supabase
        .from('staff_accounts')
        .select('clinic_id')
        .eq('auth_id', user.id)
        .single()

      const { data: owner } = await supabase
        .from('clinic_owners')
        .select('clinic_id')
        .eq('auth_id', user.id)
        .single()

      const cid = staff?.clinic_id || owner?.clinic_id
      if (!cid) return
      setClinicId(cid)

      await loadAll(cid)
      setLoading(false)
    }
    init()
  }, [pathname])

  const loadAll = async (cid: string) => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      { data: audit },
      { data: outreach },
      { data: matchmaker },
    ] = await Promise.all([
      supabase.from('audit_log')
        .select('id, action, entity_type, entity_id, metadata, created_at')
        .eq('clinic_id', cid)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('outreach_log')
        .select('id, outreach_type, channel, status, message_text, language, created_at, patients(full_name), appointments(appointment_type, start_time)')
        .eq('clinic_id', cid)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('matchmaker_runs')
        .select('id, appointment_type, slot_start, candidates_found, top_score, status, created_at')
        .eq('clinic_id', cid)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setAuditLog(audit || [])
    setOutreachLog(outreach || [])
    setMatchmakerRuns(matchmaker || [])

    // Compute stats from today's data
    const todayAudit = (audit || []).filter(a => new Date(a.created_at) >= todayStart)
    setStats({
      bookings_today:     todayAudit.filter(a => a.action === 'appointment_booked').length,
      cancellations_today: todayAudit.filter(a => a.action === 'appointment_cancelled').length,
      reminders_sent:     (outreach || []).filter(o => ['reminder_48h','reminder_24h'].includes(o.outreach_type)).length,
      matchmaker_runs:    (matchmaker || []).length,
      offers_accepted:    (matchmaker || []).filter(m => m.status === 'confirmed').length,
      offers_declined:    (matchmaker || []).filter(m => m.status === 'declined').length,
    })
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1)  return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHrs < 24)  return `${diffHrs}h ago`
    if (diffDays < 7)  return `${diffDays}d ago`
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  }

  const formatAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400&display=swap');
        *{box-sizing:border-box}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}

        .stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:24px}
        .stat{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:14px 16px}
        .stat-val{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;line-height:1}
        .stat-label{font-size:11px;color:#94A3B8;margin-top:4px}

        .tabs{display:flex;gap:4px;margin-bottom:16px;background:#F8FAFC;border-radius:9px;padding:3px;width:fit-content}
        .tab{padding:7px 16px;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;border:none;background:transparent;color:#64748B;font-family:'DM Sans',sans-serif;transition:all .15s}
        .tab.active{background:white;color:#0F172A;box-shadow:0 1px 3px rgba(0,0,0,.08)}

        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden}
        .card-header{padding:14px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-size:13px;font-weight:600;color:#0F172A}
        .card-count{font-size:12px;color:#94A3B8}
        .refresh-btn{padding:5px 12px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif}
        .refresh-btn:hover{background:#F8FAFC}

        /* Activity feed */
        .feed-row{display:flex;align-items:flex-start;gap:12px;padding:11px 20px;border-bottom:1px solid #F8FAFC;transition:background .1s}
        .feed-row:last-child{border-bottom:none}
        .feed-row:hover{background:#FAFBFC}
        .feed-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px}
        .feed-body{flex:1;min-width:0}
        .feed-action{font-size:13px;font-weight:500;color:#0F172A}
        .feed-meta{font-size:11px;color:#94A3B8;margin-top:2px;font-family:'JetBrains Mono',monospace}
        .feed-time{font-size:11px;color:#CBD5E1;white-space:nowrap;font-family:'JetBrains Mono',monospace;flex-shrink:0}
        .agent-pill{display:inline-block;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:#F1F5F9;color:#64748B;margin-left:6px;letter-spacing:.3px;text-transform:uppercase}

        /* Outreach log */
        .outreach-row{padding:14px 20px;border-bottom:1px solid #F8FAFC}
        .outreach-row:last-child{border-bottom:none}
        .outreach-top{display:flex;align-items:center;gap:10px;margin-bottom:6px}
        .outreach-patient{font-size:13px;font-weight:500;color:#0F172A}
        .outreach-type{font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:#EFF6FF;color:#0EA5E9}
        .outreach-channel{font-size:11px;color:#94A3B8}
        .status-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .outreach-status{font-size:11px;font-weight:600;margin-left:auto}
        .outreach-msg{font-size:12px;color:#64748B;line-height:1.5;background:#F8FAFC;border-radius:6px;padding:8px 10px;font-style:italic}
        .outreach-time{font-size:11px;color:#CBD5E1;font-family:'JetBrains Mono',monospace;margin-top:4px}

        /* Matchmaker */
        .mm-row{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid #F8FAFC}
        .mm-row:last-child{border-bottom:none}
        .mm-icon{width:32px;height:32px;border-radius:8px;background:#FDF4FF;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
        .mm-info{flex:1}
        .mm-type{font-size:13px;font-weight:500;color:#0F172A;text-transform:capitalize}
        .mm-detail{font-size:11px;color:#94A3B8;margin-top:2px;font-family:'JetBrains Mono',monospace}
        .mm-score{font-size:12px;font-weight:600;color:#7C3AED}
        .mm-status{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px}
        .mm-time{font-size:11px;color:#CBD5E1;font-family:'JetBrains Mono',monospace;white-space:nowrap}

        .empty{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
        .loading{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
      `}</style>

      <div className="page-title">AI Agent</div>
      <div className="page-sub">Real-time activity feed, outreach log, and Matchmaker runs</div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          {[
            { val: stats.bookings_today,      label: 'Bookings today',     color: '#10B981' },
            { val: stats.cancellations_today, label: 'Cancellations today', color: '#F43F5E' },
            { val: stats.reminders_sent,      label: 'Reminders sent',     color: '#0EA5E9' },
            { val: stats.matchmaker_runs,     label: 'Matchmaker runs',    color: '#7C3AED' },
            { val: stats.offers_accepted,     label: 'Offers accepted',    color: '#10B981' },
            { val: stats.offers_declined,     label: 'Offers declined',    color: '#F43F5E' },
          ].map(s => (
            <div key={s.label} className="stat">
              <div className="stat-val" style={{ color: s.val > 0 ? s.color : '#0F172A' }}>{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {(['activity', 'outreach', 'matchmaker'] as const).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'activity' ? '⚡ Activity feed' : t === 'outreach' ? '✉ Outreach log' : '🎯 Matchmaker'}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading...</div> : (

        tab === 'activity' ? (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent agent activity</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="card-count">{auditLog.length} events</span>
                <button className="refresh-btn" onClick={() => loadAll(clinicId)}>↻ Refresh</button>
              </div>
            </div>
            {auditLog.length === 0 ? (
              <div className="empty">No activity yet</div>
            ) : auditLog.map(entry => {
              const color = ACTION_COLOR[entry.action] || '#94A3B8'
              const icon  = ACTION_ICON[entry.action]  || '·'
              const agent = (entry.metadata?.agent as string) || null
              return (
                <div key={entry.id} className="feed-row">
                  <div className="feed-icon" style={{ background: `${color}18`, color }}>
                    {icon}
                  </div>
                  <div className="feed-body">
                    <div className="feed-action">
                      {formatAction(entry.action)}
                      {agent && <span className="agent-pill">{agent}</span>}
                    </div>
                    <div className="feed-meta">
                      {entry.entity_type && `${entry.entity_type}`}
                      {entry.metadata?.appointment_type && ` · ${String(entry.metadata.appointment_type)}`}
                      {entry.metadata?.slots_found !== undefined && ` · ${String(entry.metadata.slots_found)} slots found`}
                      {entry.metadata?.candidate_count !== undefined && ` · ${String(entry.metadata.candidate_count)} candidates`}
                      {entry.metadata?.channel && ` · ${String(entry.metadata.channel)}`}
                    </div>
                  </div>
                  <div className="feed-time">{formatTime(entry.created_at)}</div>
                </div>
              )
            })}
          </div>

        ) : tab === 'outreach' ? (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Outreach log</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="card-count">{outreachLog.length} messages</span>
                <button className="refresh-btn" onClick={() => loadAll(clinicId)}>↻ Refresh</button>
              </div>
            </div>
            {outreachLog.length === 0 ? (
              <div className="empty">No outreach sent yet</div>
            ) : outreachLog.map(entry => {
              const patient = Array.isArray(entry.patients) ? entry.patients[0] : entry.patients
              const statusColor = STATUS_COLOR[entry.status] || '#94A3B8'
              return (
                <div key={entry.id} className="outreach-row">
                  <div className="outreach-top">
                    <span className="outreach-patient">{patient?.full_name || 'Unknown patient'}</span>
                    <span className="outreach-type">{OUTREACH_LABEL[entry.outreach_type] || entry.outreach_type}</span>
                    <span className="outreach-channel">{entry.channel.toUpperCase()} · {entry.language.toUpperCase()}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
                      <div className="status-dot" style={{ background: statusColor }} />
                      <span className="outreach-status" style={{ color: statusColor }}>{entry.status}</span>
                    </div>
                  </div>
                  <div className="outreach-msg">"{entry.message_text}"</div>
                  <div className="outreach-time">{formatTime(entry.created_at)}</div>
                </div>
              )
            })}
          </div>

        ) : (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Matchmaker runs</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="card-count">{matchmakerRuns.length} runs</span>
                <button className="refresh-btn" onClick={() => loadAll(clinicId)}>↻ Refresh</button>
              </div>
            </div>
            {matchmakerRuns.length === 0 ? (
              <div className="empty">No Matchmaker runs yet — happens automatically on cancellation</div>
            ) : matchmakerRuns.map(run => {
              const statusColor = STATUS_COLOR[run.status] || '#94A3B8'
              return (
                <div key={run.id} className="mm-row">
                  <div className="mm-icon">⚡</div>
                  <div className="mm-info">
                    <div className="mm-type">{run.appointment_type}</div>
                    <div className="mm-detail">
                      {new Date(run.slot_start).toLocaleDateString('en-CA', {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
                      })}
                      {' · '}{run.candidates_found} candidate{run.candidates_found !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {run.top_score !== null && (
                    <div className="mm-score">Score {run.top_score}</div>
                  )}
                  <div className="mm-status" style={{ background: `${statusColor}18`, color: statusColor }}>
                    {run.status.replace(/_/g, ' ')}
                  </div>
                  <div className="mm-time">{formatTime(run.created_at)}</div>
                </div>
              )
            })}
          </div>
        )
      )}
    </>
  )
}
