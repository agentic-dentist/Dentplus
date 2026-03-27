'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClinicUser } from '../clinic-context'

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
  const { clinicId, staffId: myStaffId, staffName: myName, staffRole: myRole } = useClinicUser()

  const [providers, setProviders]   = useState<Provider[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]       = useState(true)
  const [offset, setOffset]         = useState(0)
  const [activeProvider, setActiveProvider] = useState<string>('all')

  const [selectedApt, setSelectedApt]   = useState<Appointment | null>(null)
  const [aptNotes, setAptNotes]         = useState<TreatmentNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [note, setNote]                 = useState({ chiefComplaint: '', findings: '', treatmentDone: '', nextSteps: '', isPrivate: false })
  const [savingNote, setSavingNote]     = useState(false)
  const [noteSaved, setNoteSaved]       = useState(false)

  // Cancel modal
  const [cancelTarget, setCancelTarget]         = useState<Appointment | null>(null)
  const [cancelling, setCancelling]             = useState(false)
  const [cancelError, setCancelError]           = useState('')

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [slots, setSlots]                       = useState<{ startTime: string; endTime: string; display: string; date: string }[]>([])
  const [loadingSlots, setLoadingSlots]         = useState(false)
  const [selectedSlot, setSelectedSlot]         = useState<{ startTime: string; endTime: string; display: string; date: string } | null>(null)
  const [rescheduling, setRescheduling]         = useState(false)
  const [rescheduleError, setRescheduleError]   = useState('')

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
    if (!clinicId) return
    const load = async () => {
      const res  = await fetch(`/api/clinic/${clinicId}/providers`)
      const json = await res.json()
      setProviders(json.providers || [])
    }
    load()
  }, [clinicId])

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
    setAptNotes((data.notes || []).filter((n: TreatmentNote & { appointment_id?: string }) =>
      n.appointment_id === apt.id || !n.appointment_id
    ))
    setLoadingNotes(false)
  }

  const closePanel = () => { setSelectedApt(null); setAptNotes([]) }

  // ── Cancel / Reschedule ───────────────────────────────────────────────────
  const openCancelModal = () => {
    if (!selectedApt) return
    setCancelTarget(selectedApt)
    setCancelError('')
  }

  const confirmCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    setCancelError('')
    try {
      const res = await fetch(`/api/appointments/${cancelTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', clinicId }),
      })
      const data = await res.json()
      if (!res.ok) { setCancelError(data.error || 'Failed to cancel'); setCancelling(false); return }
      setAppointments(prev => prev.filter(a => a.id !== cancelTarget.id))
      setCancelTarget(null)
      closePanel()
    } catch { setCancelError('Something went wrong') }
    setCancelling(false)
  }

  const openRescheduleModal = async () => {
    if (!selectedApt) return
    setRescheduleTarget(selectedApt)
    setSelectedSlot(null)
    setRescheduleError('')
    setSlots([])
    setLoadingSlots(true)
    if (!selectedApt.provider_id) { setLoadingSlots(false); return }
    const res = await fetch(`/api/appointments/slots?clinicId=${clinicId}&providerId=${selectedApt.provider_id}&duration=60&excludeAppointmentId=${selectedApt.id}`)
    const data = await res.json()
    setSlots(data.slots || [])
    setLoadingSlots(false)
  }

  const confirmReschedule = async () => {
    if (!rescheduleTarget || !selectedSlot) return
    setRescheduling(true)
    setRescheduleError('')
    try {
      const res = await fetch(`/api/appointments/${rescheduleTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', clinicId, startTime: selectedSlot.startTime, endTime: selectedSlot.endTime }),
      })
      const data = await res.json()
      if (!res.ok) { setRescheduleError(data.error || 'Failed to reschedule'); setRescheduling(false); return }
      setAppointments(prev => prev.map(a =>
        a.id === rescheduleTarget.id ? { ...a, start_time: selectedSlot.startTime, end_time: selectedSlot.endTime } : a
      ))
      setRescheduleTarget(null)
      closePanel()
    } catch { setRescheduleError('Something went wrong') }
    setRescheduling(false)
  }

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
    const isAI  = apt.booked_via === 'web_agent'
    const isML  = apt.booked_via === 'matchmaker'
    return (
      <div onClick={() => openApt(apt)} style={{
        background: isAI ? '#EFF6FF' : isML ? '#FDF4FF' : 'white',
        border: `1px solid ${isAI ? '#BAE6FD' : isML ? '#E9D5FF' : '#E2E8F0'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
        transition: 'box-shadow .15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>{name}</div>
        <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'capitalize' }}>{apt.appointment_type}</div>
        {isAI && <span style={{ fontSize: 9, background: '#0EA5E9', color: 'white', padding: '1px 5px', borderRadius: 10, marginTop: 3, display: 'inline-block' }}>AI</span>}
        {isML && <span style={{ fontSize: 9, background: '#7C3AED', color: 'white', padding: '1px 5px', borderRadius: 10, marginTop: 3, display: 'inline-block' }}>ML</span>}
        {apt.patient_confirmed && <span style={{ fontSize: 9, background: '#D1FAE5', color: '#065F46', padding: '1px 5px', borderRadius: 10, marginTop: 3, marginLeft: 3, display: 'inline-block' }}>✓</span>}
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .sch-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap}
        .sch-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#0F172A}
        .sch-nav{display:flex;align-items:center;gap:8px}
        .nav-btn{padding:6px 14px;border-radius:8px;border:1px solid #E2E8F0;background:white;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;color:#475569;transition:all .15s}
        .nav-btn:hover{border-color:#CBD5E1;background:#F8FAFC}
        .today-btn{background:#0F172A;color:white;border-color:#0F172A}
        .today-btn:hover{background:#1E293B;border-color:#1E293B}
        .provider-tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
        .prov-tab{padding:6px 14px;border-radius:20px;border:1px solid #E2E8F0;background:white;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;color:#64748B;transition:all .15s}
        .prov-tab.active{background:#0F172A;color:white;border-color:#0F172A}
        .grid-wrap{overflow-x:auto;border-radius:12px;border:1px solid #E2E8F0;background:white}
        .sch-table{width:100%;border-collapse:collapse;min-width:600px}
        .th-time{width:52px;padding:10px 8px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#CBD5E1;text-align:right;border-right:1px solid #F1F5F9;vertical-align:top}
        .th-prov{padding:10px 12px;font-size:11px;font-weight:600;color:#475569;border-bottom:1px solid #F1F5F9;border-right:1px solid #F1F5F9;white-space:nowrap;text-align:center;min-width:120px}
        .th-prov.today-col{background:#EFF6FF;color:#0EA5E9}
        .td-time{padding:6px 8px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#CBD5E1;text-align:right;border-right:1px solid #F1F5F9;vertical-align:top;white-space:nowrap}
        .td-apt{padding:4px 6px;border-right:1px solid #F8FAFC;border-bottom:1px solid #F8FAFC;vertical-align:top;min-height:52px;width:140px}
        .empty-cell{height:44px}
        .legend{display:flex;gap:16px;padding:10px 16px;border-top:1px solid #F1F5F9;font-size:11px;color:#94A3B8;flex-wrap:wrap;align-items:center}
        .legend-item{display:flex;align-items:center;gap:5px}
        .legend-dot{width:8px;height:8px;border-radius:50%}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:40}
        .apt-panel{position:fixed;right:0;top:0;bottom:0;width:420px;background:white;z-index:50;display:flex;flex-direction:column;box-shadow:-4px 0 24px rgba(0,0,0,0.1)}
        .apt-panel-header{padding:20px 24px;border-bottom:1px solid #F1F5F9;position:relative}
        .apt-panel-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#0F172A}
        .apt-panel-sub{font-size:12px;color:#94A3B8;margin-top:4px}
        .apt-panel-close{position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;font-size:18px;color:#94A3B8;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px}
        .apt-panel-close:hover{background:#F1F5F9}
        .apt-panel-body{flex:1;overflow-y:auto;padding:20px 24px}
        .apt-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
        .apt-info-card{background:#F8FAFC;border-radius:8px;padding:12px}
        .apt-info-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#94A3B8;margin-bottom:4px}
        .apt-info-val{font-size:14px;font-weight:500;color:#0F172A;text-transform:capitalize}
        .notes-section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;display:flex;align-items:center;gap:10px;margin-bottom:12px}
        .notes-divider{flex:1;height:1px;background:#F1F5F9}
        .note-form-label{display:block;font-size:11px;font-weight:600;color:#64748B;margin-bottom:4px;margin-top:10px;text-transform:uppercase;letter-spacing:0.5px}
        .note-textarea{width:100%;padding:8px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;resize:vertical;outline:none;box-sizing:border-box}
        .note-textarea:focus{border-color:#0EA5E9}
        .past-note{background:#F8FAFC;border-radius:8px;padding:12px;margin-bottom:8px}
        .past-note-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:#94A3B8;margin-bottom:6px}
        .private-pill{background:#FEF3C7;color:#D97706;padding:1px 6px;border-radius:10px;font-size:9px;font-weight:600}
        .past-note-field{margin-bottom:6px}
        .past-note-key{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#94A3B8;margin-bottom:2px}
        .past-note-val{font-size:13px;color:#334155;line-height:1.5}
        .apt-panel-footer{padding:16px 24px;border-top:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .private-toggle{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748B;cursor:pointer}
        .save-note-btn{padding:10px 20px;background:#0F172A;color:white;border:none;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;transition:background .15s}
        .save-note-btn.saved{background:#059669}
        .save-note-btn:disabled{opacity:.5;cursor:not-allowed}

        /* Action buttons in panel footer */
        .apt-action-row{display:flex;gap:8px;margin-bottom:0}
        .btn-reschedule{padding:9px 16px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;background:white;color:#334155;cursor:pointer;transition:all .15s;font-weight:500}
        .btn-reschedule:hover{border-color:#0EA5E9;color:#0EA5E9}
        .btn-cancel-appt{padding:9px 16px;border:1.5px solid #FECACA;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;background:#FEF2F2;color:#DC2626;cursor:pointer;transition:all .15s;font-weight:500}
        .btn-cancel-appt:hover{background:#FEE2E2}

        /* Modals */
        .modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:100;display:flex;align-items:center;justify-content:center;animation:mfade .15s ease}
        @keyframes mfade{from{opacity:0}to{opacity:1}}
        .modal-box{background:white;border-radius:16px;padding:28px;width:480px;max-width:calc(100vw - 48px);box-shadow:0 24px 60px rgba(0,0,0,0.2);animation:mup .18s ease}
        .modal-box.wide{width:560px}
        @keyframes mup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .modal-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;color:#0F172A;margin-bottom:6px}
        .modal-sub{font-size:13px;color:#64748B;margin-bottom:20px;line-height:1.5}
        .modal-appt-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 16px;margin-bottom:20px}
        .modal-appt-date{font-size:14px;font-weight:600;color:#0F172A;margin-bottom:2px}
        .modal-appt-meta{font-size:12px;color:#94A3B8}
        .modal-footer{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:18px;border-top:1px solid #F1F5F9}
        .btn-modal-cancel{padding:9px 18px;background:none;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;color:#64748B;cursor:pointer}
        .btn-modal-cancel:hover{border-color:#CBD5E1}
        .btn-modal-confirm{padding:9px 20px;background:#DC2626;color:white;border:none;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500}
        .btn-modal-confirm:disabled{opacity:.5;cursor:not-allowed}
        .btn-modal-primary{padding:9px 20px;background:#0F172A;color:white;border:none;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500}
        .btn-modal-primary:disabled{opacity:.5;cursor:not-allowed}
        .slot-scroll{max-height:300px;overflow-y:auto;padding-right:4px}
        .slot-group{margin-bottom:14px}
        .slot-group-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:8px}
        .slot-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .slot-btn{padding:8px 6px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:12px;font-family:'DM Sans',sans-serif;color:#334155;background:white;cursor:pointer;text-align:center;transition:all .12s;line-height:1.3}
        .slot-btn:hover{border-color:#0EA5E9;color:#0EA5E9;background:#F0F9FF}
        .slot-btn.selected{border-color:#0EA5E9;background:#0EA5E9;color:white;font-weight:500}
        .slot-loading{font-size:13px;color:#94A3B8;padding:24px 0;text-align:center}
        .no-slots{font-size:13px;color:#CBD5E1;padding:24px 0;text-align:center}
      `}</style>

      <div className="sch-header">
        <div className="sch-title">{rangeLabel}</div>
        <div className="sch-nav">
          <button className="nav-btn" onClick={() => setOffset(o => o - 1)}>←</button>
          <button className="nav-btn today-btn" onClick={() => setOffset(0)}>Today</button>
          <button className="nav-btn" onClick={() => setOffset(o => o + 1)}>→</button>
        </div>
      </div>

      <div className="provider-tabs">
        <button className={`prov-tab ${activeProvider === 'all' ? 'active' : ''}`} onClick={() => switchProvider('all')}>
          All providers
        </button>
        {providers.map((p, i) => (
          <button key={p.id} className={`prov-tab ${activeProvider === p.id ? 'active' : ''}`}
            onClick={() => switchProvider(p.id)}
            style={activeProvider === p.id ? {} : { borderColor: PROVIDER_COLORS[i % PROVIDER_COLORS.length] + '40' }}>
            {p.full_name}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#CBD5E1', fontSize: 14 }}>Loading schedule...</div>
      ) : (
        <>
          <div className="grid-wrap">
            <table className="sch-table">
              <thead>
                <tr>
                  <th className="th-time" />
                  {isAllView ? (
                    <>
                      {providers.map((p, i) => (
                        <th key={p.id} className="th-prov" style={{ borderTop: `2px solid ${PROVIDER_COLORS[i % PROVIDER_COLORS.length]}` }}>
                          {p.full_name}
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400, textTransform: 'capitalize' }}>{p.role}</div>
                        </th>
                      ))}
                      {unassignedThisRange.length > 0 && (
                        <th className="th-prov" style={{ borderTop: '2px solid #E2E8F0' }}>Unassigned</th>
                      )}
                    </>
                  ) : (
                    weekDays.map(day => (
                      <th key={day.toISOString()} className={`th-prov ${isToday(day) ? 'today-col' : ''}`}>
                        {day.toLocaleDateString('en-CA', { weekday: 'short' })}
                        <div style={{ fontSize: 10, fontWeight: 400 }}>{day.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</div>
                      </th>
                    ))
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
              <div className="apt-info-grid">
                <div className="apt-info-card">
                  <div className="apt-info-label">Type</div>
                  <div className="apt-info-val" style={{ color: TYPE_COLOR[selectedApt.appointment_type] || '#0F172A' }}>
                    {selectedApt.appointment_type}
                  </div>
                </div>
                <div className="apt-info-card">
                  <div className="apt-info-label">Status</div>
                  <div className="apt-info-val">{selectedApt.patient_confirmed ? '✓ Confirmed' : 'Scheduled'}</div>
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

              {canWriteNotes && (
                <>
                  <div className="notes-section-title">
                    Visit note <div className="notes-divider" />
                  </div>
                  <label className="note-form-label">Chief complaint</label>
                  <textarea className="note-textarea" rows={2} placeholder="Patient presented with..." value={note.chiefComplaint} onChange={e => setNote(p => ({ ...p, chiefComplaint: e.target.value }))} />
                  <label className="note-form-label">Clinical findings *</label>
                  <textarea className="note-textarea" rows={3} placeholder="Examination findings..." value={note.findings} onChange={e => setNote(p => ({ ...p, findings: e.target.value }))} />
                  <label className="note-form-label">Treatment performed</label>
                  <textarea className="note-textarea" rows={2} placeholder="Procedures completed..." value={note.treatmentDone} onChange={e => setNote(p => ({ ...p, treatmentDone: e.target.value }))} />
                  <label className="note-form-label">Next steps</label>
                  <textarea className="note-textarea" rows={2} placeholder="Return in 6 months..." value={note.nextSteps} onChange={e => setNote(p => ({ ...p, nextSteps: e.target.value }))} />
                </>
              )}

              {(aptNotes.length > 0 || loadingNotes) && (
                <>
                  <div className="notes-section-title" style={{ marginTop: 20 }}>
                    Previous notes <div className="notes-divider" />
                  </div>
                  {loadingNotes ? (
                    <div style={{ fontSize: 12, color: '#CBD5E1', padding: '8px 0' }}>Loading...</div>
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

            <div className="apt-panel-footer" style={{ flexDirection: 'column', gap: 10 }}>
              {/* Cancel / Reschedule — all roles */}
              <div className="apt-action-row">
                <button className="btn-reschedule" onClick={openRescheduleModal}>⟳ Reschedule</button>
                <button className="btn-cancel-appt" onClick={openCancelModal}>✕ Cancel appointment</button>
              </div>
              {/* Save note — clinical roles only */}
              {canWriteNotes && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                  <label className="private-toggle">
                    <input type="checkbox" checked={note.isPrivate} onChange={e => setNote(p => ({ ...p, isPrivate: e.target.checked }))} />
                    Mark as private
                  </label>
                  <button className={`save-note-btn ${noteSaved ? 'saved' : ''}`} onClick={saveNote} disabled={savingNote || !note.findings.trim()}>
                    {savingNote ? 'Saving...' : noteSaved ? '✓ Note saved' : 'Save visit note'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Cancel modal ── */}
      {cancelTarget && (
        <div className="modal-backdrop" onClick={() => setCancelTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Cancel appointment</div>
            <div className="modal-sub">This cannot be undone. The slot will open up for other patients.</div>
            <div className="modal-appt-card">
              <div className="modal-appt-date">{patientName}</div>
              <div className="modal-appt-meta">
                {new Date(cancelTarget.start_time).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })}
                {' · '}{cancelTarget.appointment_type}
              </div>
            </div>
            {cancelError && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{cancelError}</div>}
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={() => setCancelTarget(null)}>Keep appointment</button>
              <button className="btn-modal-confirm" onClick={confirmCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling...' : 'Yes, cancel it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule modal ── */}
      {rescheduleTarget && (
        <div className="modal-backdrop" onClick={() => setRescheduleTarget(null)}>
          <div className="modal-box wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Reschedule appointment</div>
            <div className="modal-sub">
              Pick a new slot for {patientName} — {rescheduleTarget.appointment_type}.
            </div>
            <div className="modal-appt-card">
              <div className="modal-appt-date">
                Current: {new Date(rescheduleTarget.start_time).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })}
              </div>
              <div className="modal-appt-meta">{rescheduleTarget.provider_id ? 'Same provider will be kept' : 'Unassigned provider'}</div>
            </div>
            <div className="slot-scroll">
              {loadingSlots ? (
                <div className="slot-loading">Finding available slots...</div>
              ) : slots.length === 0 ? (
                <div className="no-slots">No available slots in the next 60 days.</div>
              ) : (
                Object.entries(
                  slots.reduce((acc, s) => { (acc[s.date] = acc[s.date] || []).push(s); return acc }, {} as Record<string, typeof slots>)
                ).map(([date, daySlots]) => (
                  <div key={date} className="slot-group">
                    <div className="slot-group-label">{date}</div>
                    <div className="slot-grid">
                      {daySlots.map(s => (
                        <button
                          key={s.startTime}
                          className={`slot-btn ${selectedSlot?.startTime === s.startTime ? 'selected' : ''}`}
                          onClick={() => setSelectedSlot(s)}
                        >
                          {new Date(s.startTime).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Toronto' })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            {rescheduleError && <div style={{ color: '#DC2626', fontSize: 13, marginTop: 12 }}>{rescheduleError}</div>}
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={() => setRescheduleTarget(null)}>Cancel</button>
              <button className="btn-modal-primary" onClick={confirmReschedule} disabled={!selectedSlot || rescheduling}>
                {rescheduling ? 'Saving...' : 'Confirm reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
