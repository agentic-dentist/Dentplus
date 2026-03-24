'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Provider { id: string; full_name: string; role: string }
interface Appointment {
  id: string; start_time: string; end_time: string
  appointment_type: string; reason: string; status: string
  booked_via: string; provider_id: string | null
  patient_id: string
  patient_confirmed: boolean
  patients: { full_name: string }[] | { full_name: string } | null
}
interface TreatmentNote {
  id: string; visit_date: string; written_by_name: string | null
  chief_complaint: string | null; findings: string | null
  treatment_done: string | null; next_steps: string | null
  is_private: boolean; created_at: string
}

const TYPE_COLOR: Record<string, string> = {
  cleaning: '#0EA5E9', checkup: '#0EA5E9', filling: '#6366F1',
  crown: '#6366F1', emergency: '#F43F5E', consultation: '#F59E0B', root_canal: '#A78BFA',
}
const PROVIDER_COLORS = ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#A78BFA']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

export default function SchedulePage() {
  const [clinicId, setClinicId]     = useState('')
  const [myRole, setMyRole]         = useState('')
  const [myStaffId, setMyStaffId]   = useState('')
  const [myName, setMyName]         = useState('')
  const [providers, setProviders]   = useState<Provider[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]       = useState(true)
  const [offset, setOffset]         = useState(0)
  const [activeProvider, setActiveProvider] = useState<string>('all')

  // Appointment panel state
  const [selectedApt, setSelectedApt]   = useState<Appointment | null>(null)
  const [aptNotes, setAptNotes]         = useState<TreatmentNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [note, setNote]                 = useState({ chiefComplaint: '', findings: '', treatmentDone: '', nextSteps: '', isPrivate: false })
  const [savingNote, setSavingNote]     = useState(false)
  const [noteSaved, setNoteSaved]       = useState(false)

  const supabase = createClient()

  const getDay      = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x }
  const getWeekDays = (w: number) => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1 + w * 7)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  }

  const isAllView   = activeProvider === 'all'
  const selectedDay = getDay(offset)
  const weekDays    = getWeekDays(offset)
  const isToday     = (d: Date) => d.toDateString() === new Date().toDateString()

  const rangeLabel = isAllView
    ? selectedDay.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : `${weekDays[0].toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} — ${weekDays[6].toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: staff } = await supabase.from('staff_accounts')
        .select('id, clinic_id, role, full_name').eq('auth_id', user.id).single()
      if (!staff) return
      setClinicId(staff.clinic_id); setMyRole(staff.role)
      setMyStaffId(staff.id); setMyName(staff.full_name)
      const res  = await fetch(`/api/clinic/${staff.clinic_id}/providers`)
      const json = await res.json()
      setProviders(json.providers || [])
    }
    init()
  }, [])

  useEffect(() => {
    const onFocus = () => { if (clinicId) loadApts(clinicId) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [clinicId, offset, activeProvider])

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
    const { data } = await supabase.from('appointments')
      .select('id, start_time, end_time, appointment_type, reason, status, booked_via, provider_id, patient_id, patient_confirmed, patients(full_name)')
      .eq('clinic_id', cid).eq('status', 'scheduled')
      .gte('start_time', start.toISOString()).lte('start_time', end.toISOString()).order('start_time')
    setAppointments(data || [])
    setLoading(false)
  }

  useEffect(() => { if (clinicId) loadApts(clinicId) }, [clinicId, offset, activeProvider])

  const switchProvider = (id: string) => { setActiveProvider(id); setOffset(0) }

  const getApt = (day: Date, hour: number, providerId: string | null) =>
    appointments.find(a => {
      const d = new Date(a.start_time)
      return d.toDateString() === day.toDateString() && d.getHours() === hour && a.provider_id === providerId
    })

  const openApt = async (apt: Appointment) => {
    setSelectedApt(apt)
    setNote({ chiefComplaint: '', findings: '', treatmentDone: '', nextSteps: '', isPrivate: false })
    setNoteSaved(false)
    setLoadingNotes(true)
    const res = await fetch(`/api/treatment-notes?patientId=${apt.patient_id}&clinicId=${clinicId}`)
    const data = await res.json()
    // Filter to notes for this appointment
    setAptNotes((data.notes || []).filter((n: TreatmentNote & { appointment_id?: string }) =>
      n.appointment_id === apt.id || !n.appointment_id
    ))
    setLoadingNotes(false)
  }

  const closePanel = () => { setSelectedApt(null); setAptNotes([]) }

  const saveNote = async () => {
    if (!selectedApt || !note.findings.trim()) return
    setSavingNote(true)
    const res = await fetch('/api/treatment-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicId,
        patientId:       selectedApt.patient_id,
        appointmentId:   selectedApt.id,
        writtenBy:       myStaffId,
        writtenByName:   myName,
        visitDate:       new Date(selectedApt.start_time).toISOString().slice(0, 10),
        appointmentType: selectedApt.appointment_type,
        chiefComplaint:  note.chiefComplaint,
        findings:        note.findings,
        treatmentDone:   note.treatmentDone,
        nextSteps:       note.nextSteps,
        isPrivate:       note.isPrivate,
      })
    })
    const data = await res.json()
    if (data.note) {
      setAptNotes(prev => [data.note, ...prev])
      setNote({ chiefComplaint: '', findings: '', treatmentDone: '', nextSteps: '', isPrivate: false })
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
    }
    setSavingNote(false)
  }

  const unassignedThisRange = appointments.filter(a => !a.provider_id)
  const patientName = selectedApt
    ? (Array.isArray(selectedApt.patients) ? selectedApt.patients[0]?.full_name : (selectedApt.patients as { full_name: string } | null)?.full_name) || 'Unknown'
    : ''

  const canWriteNotes = myRole === 'dentist' || myRole === 'hygienist' || myRole === 'owner'

  const AptCard = ({ apt }: { apt: Appointment }) => {
    const color = TYPE_COLOR[apt.appointment_type] || '#94A3B8'
    const name  = (Array.isArray(apt.patients) ? apt.patients[0]?.full_name : (apt.patients as { full_name: string } | null)?.full_name) || 'Unknown'
    return (
      <div className="apt-card" style={{ background: `${color}12`, borderLeftColor: color }}
        onClick={() => openApt(apt)}>
        <div className="apt-patient">{name}</div>
        <div className="apt-type">{apt.appointment_type}</div>
        <div className="apt-time">{new Date(apt.start_time).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })}</div>
        {apt.booked_via === 'web_agent'  && <span className="ai-tag">AI</span>}
        {apt.booked_via === 'matchmaker' && <span className="ml-tag">ML</span>}
        {apt.patient_confirmed && <span className="confirmed-tag">✓ Confirmed</span>}
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
        .apt-card{padding:6px 8px;border-radius:6px;border-left:3px solid;cursor:pointer;transition:all .15s}
        .apt-card:hover{opacity:.85;transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.06)}
        .apt-patient{font-size:13px;font-weight:500;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .apt-type{font-size:11px;color:#64748B;margin-top:1px;text-transform:capitalize}
        .apt-time{font-size:10px;color:#94A3B8;margin-top:2px;font-family:'JetBrains Mono',monospace}
        .ai-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:#EFF6FF;color:#0284C7;margin-top:2px;margin-right:3px}
        .ml-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:#FDF4FF;color:#7C3AED;margin-top:2px;margin-right:3px}
        .confirmed-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:#F0FDF4;color:#16A34A;margin-top:2px}
        .empty-cell{min-height:48px}
        .legend{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;padding:0 4px}
        .legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748B}
        .legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .empty-state{text-align:center;padding:48px;color:#CBD5E1;font-size:13px}

        /* Appointment panel */
        .overlay{position:fixed;inset:0;background:rgba(15,23,42,.25);z-index:40;backdrop-filter:blur(1px)}
        .apt-panel{position:fixed;right:0;top:0;bottom:0;width:440px;background:white;z-index:50;box-shadow:-8px 0 40px rgba(0,0,0,.12);display:flex;flex-direction:column;animation:slideIn .2s cubic-bezier(.22,1,.36,1)}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .apt-panel-header{padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;flex-shrink:0;position:relative}
        .apt-panel-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;color:#0F172A}
        .apt-panel-sub{font-size:12px;color:#94A3B8;margin-top:3px}
        .apt-panel-close{position:absolute;top:18px;right:20px;width:28px;height:28px;border-radius:50%;background:#F1F5F9;border:none;cursor:pointer;font-size:14px;color:#64748B;display:flex;align-items:center;justify-content:center;transition:background .12s}
        .apt-panel-close:hover{background:#E2E8F0}
        .apt-panel-body{flex:1;overflow-y:auto;padding:20px 24px}
        .apt-panel-footer{padding:16px 24px;border-top:1px solid #F1F5F9;flex-shrink:0}

        .apt-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
        .apt-info-card{background:#F8FAFC;border-radius:8px;padding:10px 12px}
        .apt-info-label{font-size:10px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
        .apt-info-val{font-size:13px;font-weight:500;color:#0F172A;text-transform:capitalize}

        .notes-section-title{font-size:12px;font-weight:600;color:#0F172A;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .notes-divider{height:1px;background:#F1F5F9;flex:1}

        .note-form-label{display:block;font-size:11px;font-weight:500;color:#64748B;margin-bottom:4px;margin-top:12px}
        .note-form-label:first-child{margin-top:0}
        .note-textarea{width:100%;padding:8px 10px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:13px;font-family:'DM Sans',sans-serif;resize:vertical;outline:none;min-height:56px;transition:border-color .15s;line-height:1.5}
        .note-textarea:focus{border-color:#0EA5E9}

        .save-note-btn{width:100%;padding:10px;background:#0F172A;color:white;border-radius:8px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .15s}
        .save-note-btn:hover{background:#1E293B}
        .save-note-btn:disabled{opacity:.6;cursor:not-allowed}
        .save-note-btn.saved{background:#10B981}

        .private-toggle{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748B;cursor:pointer;margin-bottom:10px}

        .past-note{background:#F8FAFC;border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid #F1F5F9}
        .past-note-meta{font-size:11px;color:#94A3B8;margin-bottom:8px;font-family:'JetBrains Mono',monospace;display:flex;gap:8px;align-items:center}
        .past-note-field{margin-bottom:6px}
        .past-note-field:last-child{margin-bottom:0}
        .past-note-key{font-size:10px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px}
        .past-note-val{font-size:13px;color:#0F172A;line-height:1.5}
        .private-pill{font-size:10px;font-weight:600;padding:1px 6px;border-radius:20px;background:#FEF3C7;color:#D97706}
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
            onClick={() => switchProvider('all')}>All providers</div>
          {providers.map((p, i) => {
            const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length]
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
        {isAllView ? '← → navigate days · click any appointment to view details and add notes' : '← → navigate weeks · click any appointment to add visit notes'}
      </div>

      {loading ? <div className="empty-state">Loading...</div> : (
        <>
          <div className="grid-wrap">
            <table className="sched-grid">
              <thead>
                <tr>
                  <th className="th-time" />
                  {isAllView ? (
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

      {/* ── Appointment slide-out panel ── */}
      {selectedApt && (
        <>
          <div className="overlay" onClick={closePanel} />
          <div className="apt-panel">
            <div className="apt-panel-header">
              <div className="apt-panel-title">{patientName}</div>
              <div className="apt-panel-sub">
                {new Date(selectedApt.start_time).toLocaleDateString('en-CA', {
                  weekday: 'long', month: 'long', day: 'numeric',
                  hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
                })}
              </div>
              <button className="apt-panel-close" onClick={closePanel}>✕</button>
            </div>

            <div className="apt-panel-body">
              {/* Appointment info */}
              <div className="apt-info-grid">
                <div className="apt-info-card">
                  <div className="apt-info-label">Type</div>
                  <div className="apt-info-val" style={{ color: TYPE_COLOR[selectedApt.appointment_type] || '#0F172A' }}>
                    {selectedApt.appointment_type}
                  </div>
                </div>
                <div className="apt-info-card">
                  <div className="apt-info-label">Status</div>
                  <div className="apt-info-val">
                    {selectedApt.patient_confirmed ? '✓ Confirmed' : 'Scheduled'}
                  </div>
                </div>
                <div className="apt-info-card">
                  <div className="apt-info-label">Booked via</div>
                  <div className="apt-info-val">{selectedApt.booked_via.replace('_', ' ')}</div>
                </div>
                {selectedApt.reason && (
                  <div className="apt-info-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="apt-info-label">Reason</div>
                    <div className="apt-info-val">{selectedApt.reason}</div>
                  </div>
                )}
              </div>

              {/* Add note form — only for clinical staff */}
              {canWriteNotes && (
                <>
                  <div className="notes-section-title">
                    Visit note
                    <div className="notes-divider" />
                  </div>

                  <label className="note-form-label">Chief complaint / reason for visit</label>
                  <textarea className="note-textarea" rows={2}
                    placeholder="Patient presented with..."
                    value={note.chiefComplaint}
                    onChange={e => setNote(p => ({ ...p, chiefComplaint: e.target.value }))} />

                  <label className="note-form-label">Clinical findings *</label>
                  <textarea className="note-textarea" rows={3}
                    placeholder="Examination findings, X-ray results, periodontal scores..."
                    value={note.findings}
                    onChange={e => setNote(p => ({ ...p, findings: e.target.value }))} />

                  <label className="note-form-label">Treatment performed</label>
                  <textarea className="note-textarea" rows={2}
                    placeholder="Procedures completed today..."
                    value={note.treatmentDone}
                    onChange={e => setNote(p => ({ ...p, treatmentDone: e.target.value }))} />

                  <label className="note-form-label">Next steps / follow-up</label>
                  <textarea className="note-textarea" rows={2}
                    placeholder="Return in 6 months, patient to monitor..."
                    value={note.nextSteps}
                    onChange={e => setNote(p => ({ ...p, nextSteps: e.target.value }))} />
                </>
              )}

              {/* Past notes for this patient */}
              {(aptNotes.length > 0 || loadingNotes) && (
                <>
                  <div className="notes-section-title" style={{ marginTop: '20px' }}>
                    Previous notes
                    <div className="notes-divider" />
                  </div>
                  {loadingNotes ? (
                    <div style={{ fontSize: '12px', color: '#CBD5E1', padding: '8px 0' }}>Loading...</div>
                  ) : aptNotes.map(n => (
                    <div key={n.id} className="past-note">
                      <div className="past-note-meta">
                        <span>{new Date(n.visit_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {n.written_by_name && <span>· {n.written_by_name}</span>}
                        {n.is_private && <span className="private-pill">Private</span>}
                      </div>
                      {n.findings && <div className="past-note-field"><div className="past-note-key">Findings</div><div className="past-note-val">{n.findings}</div></div>}
                      {n.treatment_done && <div className="past-note-field"><div className="past-note-key">Treatment</div><div className="past-note-val">{n.treatment_done}</div></div>}
                      {n.next_steps && <div className="past-note-field"><div className="past-note-key">Next steps</div><div className="past-note-val">{n.next_steps}</div></div>}
                    </div>
                  ))}
                </>
              )}
            </div>

            {canWriteNotes && (
              <div className="apt-panel-footer">
                <label className="private-toggle">
                  <input type="checkbox" checked={note.isPrivate}
                    onChange={e => setNote(p => ({ ...p, isPrivate: e.target.checked }))} />
                  Mark as private (staff only)
                </label>
                <button
                  className={`save-note-btn ${noteSaved ? 'saved' : ''}`}
                  onClick={saveNote}
                  disabled={savingNote || !note.findings.trim()}
                >
                  {savingNote ? 'Saving...' : noteSaved ? '✓ Note saved' : 'Save visit note'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
