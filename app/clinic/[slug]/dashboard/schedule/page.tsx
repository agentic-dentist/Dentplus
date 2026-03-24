'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Provider { id: string; full_name: string; role: string }
interface Appointment {
  id: string; start_time: string; end_time: string
  appointment_type: string; reason: string; status: string
  booked_via: string; provider_id: string | null
  patient_confirmed: boolean
  patients: { full_name: string } | null
}

const TYPE_COLOR: Record<string, string> = {
  cleaning: '#0EA5E9', checkup: '#0EA5E9', filling: '#6366F1',
  crown: '#6366F1', emergency: '#F43F5E', consultation: '#F59E0B', root_canal: '#A78BFA',
}
const PROVIDER_COLORS = ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#A78BFA']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

export default function SchedulePage() {
  const [clinicId, setClinicId]   = useState('')
  const [myRole, setMyRole]       = useState('')
  const [myStaffId, setMyStaffId] = useState('')
  const [providers, setProviders] = useState<Provider[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]     = useState(true)
  const [offset, setOffset]       = useState(0)   // day offset for all-view, week offset for single
  const [activeProvider, setActiveProvider] = useState<string>('all')
  const supabase = createClient()

  // ── Date helpers ────────────────────────────────────────────────────────────
  const getDay = (dayOffset: number) => {
    const d = new Date(); d.setDate(d.getDate() + dayOffset); return d
  }
  const getWeekDays = (weekOffset: number) => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  }

  const isAllView   = activeProvider === 'all'
  const selectedDay = getDay(offset)           // single day for all-view
  const weekDays    = getWeekDays(offset)       // 7 days for provider-view

  const rangeLabel = isAllView
    ? selectedDay.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : `${weekDays[0].toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} — ${weekDays[6].toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString()

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: staff } = await supabase.from('staff_accounts').select('id, clinic_id, role').eq('auth_id', user.id).single()
      if (!staff) return
      setClinicId(staff.clinic_id); setMyRole(staff.role); setMyStaffId(staff.id)
      // All roles start in daily all-providers view for consistency
      const res  = await fetch(`/api/clinic/${staff.clinic_id}/providers`)
      const json = await res.json()
      setProviders(json.providers || [])
    }
    init()
  }, [])

  // ── Reload on window focus (picks up confirmation changes from portal) ────────
  useEffect(() => {
    const onFocus = () => { if (clinicId) loadApts(clinicId) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [clinicId, offset, activeProvider])

  // ── Load appointments ────────────────────────────────────────────────────────
  const loadApts = async (cid: string) => {
    setLoading(true)
    let start: Date, end: Date
    if (isAllView) {
      start = new Date(selectedDay); start.setHours(0, 0, 0, 0)
      end   = new Date(selectedDay); end.setHours(23, 59, 59, 999)
    } else {
      start = new Date(weekDays[0]); start.setHours(0, 0, 0, 0)
      end   = new Date(weekDays[6]); end.setHours(23, 59, 59, 999)
    }
    const { data } = await supabase.from('appointments').select('*, patients(full_name)')
      .eq('clinic_id', cid).eq('status', 'scheduled')
      .gte('start_time', start.toISOString()).lte('start_time', end.toISOString()).order('start_time')
    setAppointments(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!clinicId) return
    loadApts(clinicId)
  }, [clinicId, offset, activeProvider])

  // ── Switch view resets offset ────────────────────────────────────────────────
  const switchProvider = (id: string) => {
    setActiveProvider(id); setOffset(0)
  }

  const getApt = (day: Date, hour: number, providerId: string | null) =>
    appointments.find(a => {
      const d = new Date(a.start_time)
      return d.toDateString() === day.toDateString() && d.getHours() === hour && a.provider_id === providerId
    })

  const unassignedThisRange = appointments.filter(a => !a.provider_id)

  const AptCard = ({ apt }: { apt: Appointment }) => {
    const color = TYPE_COLOR[apt.appointment_type] || '#94A3B8'
    return (
      <div className="apt-card" style={{ background: `${color}12`, borderLeftColor: color }}>
        <div className="apt-patient">{apt.patients?.full_name || 'Unknown'}</div>
        <div className="apt-type">{apt.appointment_type}</div>
        <div className="apt-time">{new Date(apt.start_time).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })}</div>
        {apt.booked_via === 'web_agent'  && <span className="ai-tag">AI</span>}
        {apt.booked_via === 'matchmaker' && <span className="ml-tag">ML</span>}
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400&display=swap');
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:16px}
        .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .nav-btn{padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:8px;background:white;cursor:pointer;font-size:14px;font-family:'DM Sans',sans-serif}
        .nav-btn:hover{background:#F8FAFC}
        .range-label{font-size:14px;font-weight:500;color:#0F172A;min-width:200px}
        .today-btn{padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:8px;background:white;font-size:12px;color:#64748B;cursor:pointer;font-family:'DM Sans',sans-serif}
        .today-btn:hover{background:#F8FAFC}
        .pills{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
        .pill{padding:5px 12px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid;transition:all .15s;background:white;white-space:nowrap}
        .view-hint{font-size:11px;color:#94A3B8;margin-bottom:10px}

        .grid-wrap{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow-x:auto}
        .sched-grid{border-collapse:collapse;width:100%}
        .th-time{width:56px;padding:10px 8px;font-size:11px;color:#94A3B8;font-family:'JetBrains Mono',monospace;border-bottom:1px solid #F1F5F9;background:#FAFBFC}
        .th-col{padding:10px 12px;border-bottom:1px solid #F1F5F9;background:#FAFBFC;min-width:160px}
        .th-day{font-size:12px;font-weight:600;color:#0F172A;margin-bottom:2px}
        .th-day.today{color:#0EA5E9}
        .th-name{font-size:11px;font-weight:500}
        .provider-bar{height:2px;border-radius:1px;margin-bottom:4px}
        .td-time{padding:6px 8px;font-size:11px;color:#94A3B8;font-family:'JetBrains Mono',monospace;border-top:1px solid #F8FAFC;vertical-align:top;background:#FAFBFC}
        .td-apt{padding:3px;border-top:1px solid #F8FAFC;vertical-align:top;min-width:160px}
        .apt-card{padding:6px 8px;border-radius:6px;border-left:3px solid;cursor:pointer;transition:opacity .15s}
        .apt-card:hover{opacity:.85}
        .apt-patient{font-size:13px;font-weight:500;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .apt-type{font-size:11px;color:#64748B;margin-top:1px;text-transform:capitalize}
        .apt-time{font-size:10px;color:#94A3B8;margin-top:2px;font-family:'JetBrains Mono',monospace}
        .ai-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:#EFF6FF;color:#0284C7;margin-top:2px;margin-right:3px}
        .ml-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:#FDF4FF;color:#7C3AED;margin-top:2px}
        .confirmed-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:#F0FDF4;color:#16A34A;margin-top:2px;margin-left:2px}
        .empty-cell{min-height:48px}
        .legend{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;padding:0 4px}
        .legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748B}
        .legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .empty-state{text-align:center;padding:48px;color:#CBD5E1;font-size:13px}
      `}</style>

      <div className="page-title">Schedule</div>

      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="nav-btn" onClick={() => setOffset(o => o - 1)}>←</button>
          <button className="nav-btn" onClick={() => setOffset(o => o + 1)}>→</button>
          <span className="range-label">{rangeLabel}</span>
          <button className="today-btn" onClick={() => setOffset(0)}>Today</button>
        </div>
        <div className="pills">
          <div className="pill"
            style={isAllView ? { background: '#0F172A', borderColor: '#0F172A', color: 'white' } : { borderColor: '#CBD5E1', color: '#64748B' }}
            onClick={() => switchProvider('all')}>
            All providers
          </div>
          {providers.map((p, i) => {
            const color    = PROVIDER_COLORS[i % PROVIDER_COLORS.length]
            const isActive = activeProvider === p.id
            return (
              <div key={p.id} className="pill"
                style={isActive ? { background: color, borderColor: color, color: 'white' } : { borderColor: color, color }}
                onClick={() => switchProvider(isActive ? 'all' : p.id)}>
                {p.full_name.split(' ')[0]} {p.full_name.split(' ')[1]?.[0]}.
                <span style={{ fontSize: '10px', opacity: .7, marginLeft: '4px' }}>{p.role === 'hygienist' ? 'hyg' : 'dr'}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="view-hint">
        {isAllView ? '← → navigate days · select a provider to see their full week' : '← → navigate weeks · select All providers for daily overview'}
      </div>

      {loading ? <div className="empty-state">Loading...</div> : (
        <>
          <div className="grid-wrap">
            <table className="sched-grid">
              <thead>
                <tr>
                  <th className="th-time" />
                  {isAllView ? (
                    // ALL VIEW — one column per provider for the selected day
                    <>
                      {providers.map((prov, i) => {
                        const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length]
                        return (
                          <th key={prov.id} className="th-col">
                            <div className="provider-bar" style={{ background: color }} />
                            <div className={`th-day ${isToday(selectedDay) ? 'today' : ''}`}>
                              {selectedDay.toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="th-name" style={{ color }}>
                              {prov.full_name.split(' ')[0]} {prov.full_name.split(' ')[1]?.[0]}.
                              <span style={{ color: '#94A3B8', marginLeft: '4px', fontSize: '10px' }}>{prov.role === 'hygienist' ? '· hyg' : '· dr'}</span>
                            </div>
                          </th>
                        )
                      })}
                      {unassignedThisRange.length > 0 && (
                        <th className="th-col">
                          <div className="provider-bar" style={{ background: '#94A3B8' }} />
                          <div className={`th-day ${isToday(selectedDay) ? 'today' : ''}`}>
                            {selectedDay.toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="th-name" style={{ color: '#94A3B8' }}>Unassigned</div>
                        </th>
                      )}
                    </>
                  ) : (
                    // PROVIDER VIEW — one column per day
                    weekDays.map(day => {
                      const prov  = providers.find(p => p.id === activeProvider)
                      const color = prov ? PROVIDER_COLORS[providers.indexOf(prov) % PROVIDER_COLORS.length] : '#0EA5E9'
                      return (
                        <th key={day.toISOString()} className="th-col">
                          <div className="provider-bar" style={{ background: color }} />
                          <div className={`th-day ${isToday(day) ? 'today' : ''}`}>
                            {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          {prov && (
                            <div className="th-name" style={{ color }}>
                              {prov.full_name.split(' ')[0]} {prov.full_name.split(' ')[1]?.[0]}.
                              <span style={{ color: '#94A3B8', marginLeft: '4px', fontSize: '10px' }}>{prov.role === 'hygienist' ? '· hyg' : '· dr'}</span>
                            </div>
                          )}
                        </th>
                      )
                    })
                  )}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <td className="td-time">{hour}:00</td>
                    {isAllView ? (
                      <>
                        {providers.map(prov => {
                          const apt = getApt(selectedDay, hour, prov.id)
                          return (
                            <td key={prov.id} className="td-apt">
                              {apt ? <AptCard apt={apt} /> : <div className="empty-cell" />}
                            </td>
                          )
                        })}
                        {unassignedThisRange.length > 0 && (
                          <td className="td-apt">
                            {(() => { const apt = getApt(selectedDay, hour, null); return apt ? <AptCard apt={apt} /> : <div className="empty-cell" /> })()}
                          </td>
                        )}
                      </>
                    ) : (
                      weekDays.map(day => {
                        const apt = getApt(day, hour, activeProvider)
                        return (
                          <td key={day.toISOString()} className="td-apt">
                            {apt ? <AptCard apt={apt} /> : <div className="empty-cell" />}
                          </td>
                        )
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="legend">
            {[
              { label: 'Cleaning / Checkup', color: '#0EA5E9' },
              { label: 'Filling / Crown',    color: '#6366F1' },
              { label: 'Emergency',          color: '#F43F5E' },
              { label: 'Consultation',       color: '#F59E0B' },
            ].map(l => (
              <div key={l.label} className="legend-item">
                <div className="legend-dot" style={{ background: l.color }} />{l.label}
              </div>
            ))}
            <div className="legend-item" style={{ marginLeft: 'auto' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: '#EFF6FF', border: '1px solid #0284C7' }} />AI booked
            </div>
            <div className="legend-item">
              <div style={{ width: 10, height: 10, borderRadius: 3, background: '#FDF4FF', border: '1px solid #7C3AED' }} />Matchmaker
            </div>
          </div>
        </>
      )}
    </>
  )
}
