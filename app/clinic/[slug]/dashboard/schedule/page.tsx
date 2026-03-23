'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'

interface Provider {
  id: string
  full_name: string
  role: string
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  appointment_type: string
  reason: string
  status: string
  booked_via: string
  provider_id: string | null
  patients: { full_name: string } | null
}

const TYPE_COLOR: Record<string, string> = {
  cleaning:     '#0EA5E9',
  checkup:      '#0EA5E9',
  filling:      '#6366F1',
  crown:        '#6366F1',
  emergency:    '#F43F5E',
  consultation: '#F59E0B',
  root_canal:   '#A78BFA',
}

const PROVIDER_COLORS = ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#A78BFA']

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

export default function SchedulePage() {
  const [clinicId, setClinicId] = useState('')
  const [myStaffId, setMyStaffId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [providers, setProviders] = useState<Provider[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeProvider, setActiveProvider] = useState<string>('all')
  const supabase = createClient()
  const pathname = usePathname()

  const getWeekDays = (offset: number) => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }

  const days = getWeekDays(weekOffset)
  const weekStart = days[0]
  const weekEnd = days[6]

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: staff } = await supabase
        .from('staff_accounts')
        .select('id, clinic_id, role')
        .eq('auth_id', user.id)
        .single()

      if (!staff) return
      setClinicId(staff.clinic_id)
      setMyStaffId(staff.id)
      setMyRole(staff.role)

      // Default filter: dentist/hygienist sees themselves, others see all
      if (staff.role === 'dentist' || staff.role === 'hygienist') {
        setActiveProvider(staff.id)
      }

      // Load all clinical providers
      const { data: providerData } = await supabase
        .from('staff_accounts')
        .select('id, full_name, role')
        .eq('clinic_id', staff.clinic_id)
        .eq('is_active', true)
        .in('role', ['dentist', 'hygienist', 'owner'])
        .order('role')

      setProviders(providerData || [])
    }
    init()
  }, [])

  useEffect(() => {
    if (!clinicId) return
    const load = async () => {
      setLoading(true)
      const start = new Date(weekStart)
      start.setHours(0, 0, 0, 0)
      const end = new Date(weekEnd)
      end.setHours(23, 59, 59, 999)

      const { data } = await supabase
        .from('appointments')
        .select('*, patients(full_name)')
        .eq('clinic_id', clinicId)
        .eq('status', 'scheduled')
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time')

      setAppointments(data || [])
      setLoading(false)
    }
    load()
  }, [clinicId, weekOffset])

  const visibleProviders = activeProvider === 'all'
    ? providers
    : providers.filter(p => p.id === activeProvider)

  // Unassigned = appointments with no provider_id
  const showUnassigned = activeProvider === 'all'
  const unassignedApts = appointments.filter(a => !a.provider_id)

  const getApt = (day: Date, hour: number, providerId: string) => {
    return appointments.find(apt => {
      const d = new Date(apt.start_time)
      return d.toDateString() === day.toDateString() &&
        d.getHours() === hour &&
        apt.provider_id === providerId
    })
  }

  const getUnassignedApt = (day: Date, hour: number) => {
    return unassignedApts.find(apt => {
      const d = new Date(apt.start_time)
      return d.toDateString() === day.toDateString() && d.getHours() === hour
    })
  }

  const formatHour = (h: number) => `${h}:00`

  const weekLabel = `${weekStart.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} — ${weekEnd.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString()

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400&display=swap');
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:16px}
        .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .week-nav{display:flex;align-items:center;gap:6px}
        .nav-btn{padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:8px;background:white;cursor:pointer;font-size:14px;transition:background .12s;font-family:'DM Sans',sans-serif}
        .nav-btn:hover{background:#F8FAFC}
        .week-label{font-size:14px;font-weight:500;color:#0F172A;min-width:180px}
        .today-btn{padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:8px;background:white;font-size:12px;color:#64748B;cursor:pointer;font-family:'DM Sans',sans-serif}
        .today-btn:hover{background:#F8FAFC}
        .pills{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
        .pill{padding:5px 12px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid;transition:all .15s;background:white;white-space:nowrap}

        /* Grid */
        .grid-wrap{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow-x:auto}
        .sched-grid{border-collapse:collapse;width:100%;min-width:600px}
        .th-time{width:56px;padding:10px 8px;font-size:11px;color:#94A3B8;font-family:'JetBrains Mono',monospace;border-bottom:1px solid #F1F5F9;background:#FAFBFC}
        .th-provider{padding:10px 12px;border-bottom:1px solid #F1F5F9;background:#FAFBFC;min-width:130px}
        .th-day{font-size:12px;font-weight:600;color:#0F172A;margin-bottom:3px}
        .th-day.today{color:#0EA5E9}
        .th-name{font-size:11px;font-weight:500;padding:0}
        .provider-bar{height:2px;border-radius:1px;margin-bottom:4px}
        .td-time{padding:6px 8px;font-size:11px;color:#94A3B8;font-family:'JetBrains Mono',monospace;border-top:1px solid #F8FAFC;vertical-align:top;white-space:nowrap;background:#FAFBFC}
        .td-apt{padding:3px;border-top:1px solid #F8FAFC;vertical-align:top;min-width:130px}
        .apt-card{padding:6px 8px;border-radius:6px;border-left:3px solid;cursor:pointer;transition:opacity .15s}
        .apt-card:hover{opacity:.85}
        .apt-patient{font-size:13px;font-weight:500;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .apt-type{font-size:11px;color:#64748B;margin-top:1px;text-transform:capitalize}
        .apt-time{font-size:10px;color:#94A3B8;margin-top:2px;font-family:'JetBrains Mono',monospace}
        .ai-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:#EFF6FF;color:#0284C7;margin-top:2px;letter-spacing:.3px}
        .empty-cell{min-height:52px}
        .unassigned-tag{display:inline-block;font-size:9px;font-weight:600;padding:1px 5px;border-radius:4px;background:#FEF3C7;color:#92400E;margin-top:2px}

        .legend{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;padding:0 4px}
        .legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748B}
        .legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .empty-state{text-align:center;padding:48px;color:#CBD5E1;font-size:13px}
      `}</style>

      <div className="page-title">Schedule</div>

      <div className="toolbar">
        <div className="week-nav">
          <button className="nav-btn" onClick={() => setWeekOffset(w => w - 1)}>←</button>
          <button className="nav-btn" onClick={() => setWeekOffset(w => w + 1)}>→</button>
          <span className="week-label">{weekLabel}</span>
          <button className="today-btn" onClick={() => setWeekOffset(0)}>Today</button>
        </div>

        <div className="pills">
          {/* All providers pill */}
          <div
            className="pill"
            style={activeProvider === 'all'
              ? { background: '#0F172A', borderColor: '#0F172A', color: 'white' }
              : { borderColor: '#CBD5E1', color: '#64748B' }}
            onClick={() => setActiveProvider('all')}
          >
            All providers
          </div>
          {providers.map((p, i) => {
            const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length]
            const isActive = activeProvider === p.id
            return (
              <div
                key={p.id}
                className="pill"
                style={isActive
                  ? { background: color, borderColor: color, color: 'white' }
                  : { borderColor: color, color: color }}
                onClick={() => setActiveProvider(isActive ? 'all' : p.id)}
              >
                {p.full_name.split(' ')[0]} {p.full_name.split(' ')[1]?.[0]}.
                <span style={{ fontSize: '10px', opacity: .7, marginLeft: '4px' }}>
                  {p.role === 'hygienist' ? 'hyg' : 'dr'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <>
          <div className="grid-wrap">
            <table className="sched-grid">
              <thead>
                <tr>
                  <th className="th-time"></th>
                  {days.map(day => (
                    <>
                      {visibleProviders.map((prov, pi) => {
                        const color = PROVIDER_COLORS[providers.indexOf(prov) % PROVIDER_COLORS.length]
                        return (
                          <th key={`${day.toISOString()}-${prov.id}`} className="th-provider">
                            <div className="provider-bar" style={{ background: color }} />
                            <div className={`th-day ${isToday(day) ? 'today' : ''}`}>
                              {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="th-name" style={{ color, fontSize: '11px', fontWeight: 500 }}>
                              {prov.full_name.split(' ')[0]} {prov.full_name.split(' ')[1]?.[0]}.
                              <span style={{ color: '#94A3B8', marginLeft: '4px', fontSize: '10px' }}>
                                {prov.role === 'hygienist' ? '· hyg' : '· dr'}
                              </span>
                            </div>
                          </th>
                        )
                      })}
                      {showUnassigned && unassignedApts.some(a => new Date(a.start_time).toDateString() === day.toDateString()) && (
                        <th key={`${day.toISOString()}-unassigned`} className="th-provider">
                          <div className="provider-bar" style={{ background: '#F59E0B' }} />
                          <div className={`th-day ${isToday(day) ? 'today' : ''}`}>
                            {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="th-name" style={{ color: '#F59E0B', fontSize: '11px', fontWeight: 500 }}>
                            Unassigned
                          </div>
                        </th>
                      )}
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <td className="td-time">{formatHour(hour)}</td>
                    {days.map(day => (
                      <>
                        {visibleProviders.map((prov, pi) => {
                          const apt = getApt(day, hour, prov.id)
                          const color = apt ? (TYPE_COLOR[apt.appointment_type] || '#94A3B8') : null
                          return (
                            <td key={`${day.toISOString()}-${prov.id}-${hour}`} className="td-apt">
                              {apt ? (
                                <div className="apt-card" style={{ background: `${color}12`, borderLeftColor: color! }}>
                                  <div className="apt-patient">{apt.patients?.full_name || 'Unknown'}</div>
                                  <div className="apt-type">{apt.appointment_type}</div>
                                  <div className="apt-time">
                                    {new Date(apt.start_time).toLocaleTimeString('en-CA', {
                                      hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
                                    })}
                                  </div>
                                  {apt.booked_via === 'web_agent' && <span className="ai-tag">AI</span>}
                                  {apt.booked_via === 'matchmaker' && <span className="ai-tag" style={{background:'#FDF4FF',color:'#7C3AED'}}>ML</span>}
                                </div>
                              ) : (
                                <div className="empty-cell" />
                              )}
                          </td>
                          )
                        })}
                        {showUnassigned && (() => {
                          const apt = getUnassignedApt(day, hour)
                          const color = apt ? (TYPE_COLOR[apt.appointment_type] || '#94A3B8') : null
                          return unassignedApts.some(a => new Date(a.start_time).toDateString() === day.toDateString()) ? (
                            <td key={`${day.toISOString()}-unassigned-${hour}`} className="td-apt">
                              {apt ? (
                                <div className="apt-card" style={{ background: `${color}12`, borderLeftColor: color! }}>
                                  <div className="apt-patient">{apt.patients?.full_name || 'Unknown'}</div>
                                  <div className="apt-type">{apt.appointment_type}</div>
                                  <div className="apt-time">
                                    {new Date(apt.start_time).toLocaleTimeString('en-CA', {
                                      hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
                                    })}
                                  </div>
                                  {apt.booked_via === 'web_agent' && <span className="ai-tag">AI</span>}
                                  {apt.booked_via === 'matchmaker' && <span className="ai-tag" style={{background:'#FDF4FF',color:'#7C3AED'}}>ML</span>}
                                </div>
                              ) : (
                                <div className="empty-cell" />
                              )}
                            </td>
                          ) : null
                        })()}
                      </>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="legend">
            {[
              { label: 'Cleaning / Checkup', color: '#0EA5E9' },
              { label: 'Filling / Crown', color: '#6366F1' },
              { label: 'Emergency', color: '#F43F5E' },
              { label: 'Consultation', color: '#F59E0B' },
            ].map(l => (
              <div key={l.label} className="legend-item">
                <div className="legend-dot" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
            <div className="legend-item" style={{ marginLeft: 'auto' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#EFF6FF', border: '1px solid #0284C7', flexShrink: 0 }} />
              AI booked
            </div>
            <div className="legend-item">
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#FEF3C7', border: '1px solid #F59E0B', flexShrink: 0 }} />
              Unassigned provider
            </div>
          </div>
        </>
      )}
    </>
  )
}
