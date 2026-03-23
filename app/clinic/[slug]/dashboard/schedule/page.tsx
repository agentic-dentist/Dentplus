'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'

interface DaySchedule { active: boolean; start: string; end: string }
interface Schedule { [day: number]: DaySchedule }
interface Exception {
  id: string
  exception_date: string
  is_day_off: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
}

const DAYS = [
  { label: 'Monday',    short: 'Mon', num: 1 },
  { label: 'Tuesday',   short: 'Tue', num: 2 },
  { label: 'Wednesday', short: 'Wed', num: 3 },
  { label: 'Thursday',  short: 'Thu', num: 4 },
  { label: 'Friday',    short: 'Fri', num: 5 },
]

const DEFAULT_SCHEDULE: Schedule = {
  1: { active: true,  start: '09:00', end: '17:00' },
  2: { active: true,  start: '09:00', end: '17:00' },
  3: { active: true,  start: '09:00', end: '17:00' },
  4: { active: true,  start: '09:00', end: '17:00' },
  5: { active: true,  start: '09:00', end: '17:00' },
}

const HOURS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 7
  const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`
  const value = String(h).padStart(2, '0') + ':00'
  return { label, value }
})

// Build next 90 days calendar grouped by month
const buildCalendar = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const months: { label: string; days: { date: Date; dateStr: string; dow: number; isPast: boolean }[] }[] = []
  let current = new Date(today)
  const end = new Date(today)
  end.setDate(end.getDate() + 90)

  while (current <= end) {
    const monthLabel = current.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
    let month = months.find(m => m.label === monthLabel)
    if (!month) { month = { label: monthLabel, days: [] }; months.push(month) }

    const dow = current.getDay()
    const dateStr = current.toISOString().slice(0, 10)
    month.days.push({
      date: new Date(current),
      dateStr,
      dow,
      isPast: current < today,
    })
    current.setDate(current.getDate() + 1)
  }
  return months
}

export default function MySchedulePage() {
  const [staffId, setStaffId]     = useState('')
  const [clinicId, setClinicId]   = useState('')
  const [staffName, setStaffName] = useState('')
  const [role, setRole]           = useState('')
  const [schedule, setSchedule]   = useState<Schedule>(DEFAULT_SCHEDULE)
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [schedError, setSchedError] = useState('')

  // Exception modal state
  const [addingException, setAddingException] = useState(false)
  const [excDate, setExcDate]     = useState('')
  const [excReason, setExcReason] = useState('')
  const [excSaving, setExcSaving] = useState(false)

  const supabase = createClient()
  const pathname = usePathname()
  const months   = buildCalendar()

  const loadExceptions = useCallback(async (sid: string, cid: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date()
    future.setDate(future.getDate() + 90)
    const { data } = await supabase
      .from('provider_exceptions')
      .select('*')
      .eq('staff_id', sid)
      .eq('clinic_id', cid)
      .gte('exception_date', today)
      .lte('exception_date', future.toISOString().slice(0, 10))
      .order('exception_date')
    setExceptions(data || [])
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: staff } = await supabase
        .from('staff_accounts')
        .select('id, full_name, role, clinic_id')
        .eq('auth_id', user.id)
        .single()
      if (!staff) return

      setStaffId(staff.id); setClinicId(staff.clinic_id)
      setStaffName(staff.full_name); setRole(staff.role)

      const fresh: Schedule = {
        1: { active: false, start: '09:00', end: '17:00' },
        2: { active: false, start: '09:00', end: '17:00' },
        3: { active: false, start: '09:00', end: '17:00' },
        4: { active: false, start: '09:00', end: '17:00' },
        5: { active: false, start: '09:00', end: '17:00' },
      }
      const { data: rows } = await supabase
        .from('provider_schedules')
        .select('day_of_week, start_time, end_time, is_active')
        .eq('staff_id', staff.id).eq('clinic_id', staff.clinic_id)

      if (rows && rows.length > 0) {
        rows.forEach(r => {
          if (r.day_of_week >= 1 && r.day_of_week <= 5)
            fresh[r.day_of_week] = { active: r.is_active, start: r.start_time.slice(0,5), end: r.end_time.slice(0,5) }
        })
      } else {
        Object.assign(fresh, DEFAULT_SCHEDULE)
      }
      setSchedule(fresh)
      await loadExceptions(staff.id, staff.clinic_id)
      setLoading(false)
    }
    init()
  }, [pathname])

  const toggleDay  = (day: number) => { setSchedule(p => ({ ...p, [day]: { ...p[day], active: !p[day].active } })); setSaved(false) }
  const setTime    = (day: number, f: 'start'|'end', v: string) => { setSchedule(p => ({ ...p, [day]: { ...p[day], [f]: v } })); setSaved(false) }

  const saveSchedule = async () => {
    if (!staffId) return
    setSaving(true); setSchedError('')
    const rows = DAYS.map(d => ({
      clinic_id: clinicId, staff_id: staffId, day_of_week: d.num,
      start_time: schedule[d.num].start + ':00',
      end_time:   schedule[d.num].end   + ':00',
      is_active:  schedule[d.num].active,
    }))
    const { error } = await supabase.from('provider_schedules').upsert(rows, { onConflict: 'staff_id,day_of_week' })
    setSaving(false)
    if (error) { setSchedError('Failed to save. Please try again.'); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const addException = async () => {
    if (!excDate) return
    setExcSaving(true)
    const { error } = await supabase.from('provider_exceptions').upsert({
      clinic_id: clinicId, staff_id: staffId,
      exception_date: excDate, is_day_off: true,
      reason: excReason || null,
    }, { onConflict: 'staff_id,exception_date' })
    setExcSaving(false)
    if (error) { alert('Could not save. Please try again.'); return }
    await loadExceptions(staffId, clinicId)
    setAddingException(false); setExcDate(''); setExcReason('')
  }

  const removeException = async (id: string) => {
    await supabase.from('provider_exceptions').delete().eq('id', id)
    setExceptions(prev => prev.filter(e => e.id !== id))
  }

  const exceptionDates = new Set(exceptions.map(e => e.exception_date))

  const getDayStatus = (dateStr: string, dow: number) => {
    if (dow === 0 || dow === 6) return 'weekend'
    if (exceptionDates.has(dateStr)) return 'off'
    const daySchedule = schedule[dow]
    if (!daySchedule?.active) return 'not-working'
    return 'working'
  }

  const activeDays = DAYS.filter(d => schedule[d.num].active)
  const totalHours = activeDays.reduce((sum, d) => {
    return sum + Math.max(0, parseInt(schedule[d.num].end) - parseInt(schedule[d.num].start))
  }, 0)

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400&display=swap');
        *{box-sizing:border-box}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}

        .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        .stat-card{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:16px 20px}
        .stat-value{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;color:#0F172A;line-height:1}
        .stat-label{font-size:12px;color:#94A3B8;margin-top:4px}

        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}

        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:16px}
        .card-header{padding:16px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-size:14px;font-weight:600;color:#0F172A}
        .card-sub{font-size:11px;color:#94A3B8;margin-top:2px}

        /* Weekly pattern */
        .day-row{display:flex;align-items:center;padding:11px 20px;border-bottom:1px solid #F8FAFC;gap:12px}
        .day-row:last-child{border-bottom:none}
        .toggle-wrap{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;min-width:110px}
        .toggle-track{width:34px;height:18px;border-radius:9px;background:#E2E8F0;position:relative;transition:background .2s;flex-shrink:0}
        .toggle-track.on{background:#0EA5E9}
        .toggle-thumb{width:14px;height:14px;border-radius:50%;background:white;position:absolute;top:2px;left:2px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.15)}
        .toggle-track.on .toggle-thumb{transform:translateX(16px)}
        .day-name{font-size:13px;font-weight:500;color:#0F172A}
        .day-name.off{color:#CBD5E1}
        .time-row{display:flex;align-items:center;gap:6px;flex:1}
        .time-select{padding:5px 8px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0F172A;background:white;cursor:pointer;outline:none;transition:border-color .15s;flex:1}
        .time-select:focus{border-color:#0EA5E9}
        .time-select:disabled{opacity:.3;cursor:not-allowed}
        .time-sep{font-size:11px;color:#CBD5E1}
        .hrs-tag{font-family:'JetBrains Mono',monospace;font-size:10px;color:#94A3B8;white-space:nowrap;min-width:28px}

        .save-row{padding:16px 20px;border-top:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .save-note{font-size:11px;color:#94A3B8}
        .save-btn{padding:8px 20px;background:#0F172A;color:white;border-radius:8px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .15s}
        .save-btn:hover{background:#1E293B}
        .save-btn.saved{background:#10B981}
        .save-btn:disabled{opacity:.6;cursor:not-allowed}
        .error-msg{padding:10px 20px;font-size:12px;color:#DC2626;background:#FEF2F2;border-top:1px solid #FECACA}

        /* 3-month calendar */
        .month-block{margin-bottom:16px}
        .month-label{font-size:12px;font-weight:600;color:#64748B;letter-spacing:.5px;text-transform:uppercase;padding:10px 20px 6px}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;padding:0 12px 12px}
        .dow-header{font-size:10px;font-weight:600;color:#CBD5E1;text-align:center;padding:4px 0;letter-spacing:.3px}
        .cal-day{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;position:relative;cursor:default}
        .cal-day.working{background:#F0F9FF;color:#0EA5E9;font-weight:600}
        .cal-day.working:hover{background:#E0F2FE;cursor:pointer}
        .cal-day.off{background:#FEF2F2;color:#F43F5E;font-weight:600}
        .cal-day.off:hover{cursor:pointer}
        .cal-day.not-working{background:#F8FAFC;color:#CBD5E1}
        .cal-day.weekend{background:transparent;color:#E2E8F0}
        .cal-day.today-marker{outline:2px solid #0EA5E9;outline-offset:-2px}
        .cal-day.empty{background:transparent}
        .off-dot{width:4px;height:4px;border-radius:50%;background:#F43F5E;position:absolute;bottom:3px;left:50%;transform:translateX(-50%)}

        /* Exceptions list */
        .exc-list{padding:0}
        .exc-item{display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid #F8FAFC}
        .exc-item:last-child{border-bottom:none}
        .exc-date{font-family:'JetBrains Mono',monospace;font-size:12px;color:#0F172A;font-weight:500;min-width:90px}
        .exc-reason{font-size:12px;color:#64748B;flex:1}
        .exc-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:#F43F5E;white-space:nowrap}
        .exc-remove{width:22px;height:22px;border-radius:50%;background:#F8FAFC;border:none;cursor:pointer;font-size:11px;color:#94A3B8;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0}
        .exc-remove:hover{background:#FEF2F2;color:#F43F5E}
        .exc-empty{padding:20px;text-align:center;font-size:12px;color:#CBD5E1}

        .add-exc-btn{padding:6px 14px;border:1.5px dashed #E2E8F0;border-radius:7px;font-size:12px;font-weight:500;color:#94A3B8;background:white;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}
        .add-exc-btn:hover{border-color:#0EA5E9;color:#0EA5E9}

        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(2px)}
        .modal{background:white;border-radius:14px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.15)}
        .modal-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .modal-sub{font-size:12px;color:#94A3B8;margin-bottom:20px}
        .modal-field{margin-bottom:14px}
        .modal-label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
        .modal-input{width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;color:#0F172A;outline:none;transition:border-color .15s}
        .modal-input:focus{border-color:#0EA5E9}
        .modal-actions{display:flex;gap:8px;margin-top:20px}
        .modal-cancel{flex:1;padding:9px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-weight:500;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif}
        .modal-cancel:hover{background:#F8FAFC}
        .modal-confirm{flex:2;padding:9px;background:#F43F5E;color:white;border-radius:8px;font-size:13px;font-weight:500;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}
        .modal-confirm:hover{background:#E11D48}
        .modal-confirm:disabled{opacity:.6;cursor:not-allowed}

        .loading{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
        .legend-row{display:flex;gap:14px;padding:8px 20px 12px;flex-wrap:wrap}
        .legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:#64748B}
        .legend-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
      `}</style>

      <div className="page-title">My Schedule</div>
      <div className="page-sub">Your recurring weekly pattern applies automatically for the next 90 days. Block specific dates for vacation or personal days.</div>

      {loading ? <div className="loading">Loading your schedule...</div> : (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">{activeDays.length}</div>
              <div className="stat-label">Working days / week</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalHours}h</div>
              <div className="stat-label">Available hours / week</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{exceptions.length}</div>
              <div className="stat-label">Days blocked (90d)</div>
            </div>
          </div>

          <div className="two-col">
            {/* LEFT — weekly pattern + exceptions list */}
            <div>
              {/* Weekly pattern */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Weekly pattern</div>
                    <div className="card-sub">Repeats automatically — set once, applies indefinitely</div>
                  </div>
                </div>
                {DAYS.map(d => {
                  const day = schedule[d.num]
                  const hrs = day.active ? parseInt(day.end) - parseInt(day.start) : 0
                  return (
                    <div key={d.num} className="day-row">
                      <div className="toggle-wrap" onClick={() => toggleDay(d.num)}>
                        <div className={`toggle-track ${day.active ? 'on' : ''}`}>
                          <div className="toggle-thumb" />
                        </div>
                        <span className={`day-name ${day.active ? '' : 'off'}`}>{d.short}</span>
                      </div>
                      <div className="time-row">
                        <select className="time-select" value={day.start} disabled={!day.active} onChange={e => setTime(d.num, 'start', e.target.value)}>
                          {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                        </select>
                        <span className="time-sep">–</span>
                        <select className="time-select" value={day.end} disabled={!day.active} onChange={e => setTime(d.num, 'end', e.target.value)}>
                          {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                        </select>
                        <span className="hrs-tag">{day.active && hrs > 0 ? `${hrs}h` : ''}</span>
                      </div>
                    </div>
                  )
                })}
                {schedError && <div className="error-msg">{schedError}</div>}
                <div className="save-row">
                  <span className="save-note">Changes apply to all future bookings</span>
                  <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={saveSchedule} disabled={saving}>
                    {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save pattern'}
                  </button>
                </div>
              </div>

              {/* Exceptions list */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Days off & exceptions</div>
                    <div className="card-sub">Next 90 days — vacation, personal days, conferences</div>
                  </div>
                  <button className="add-exc-btn" onClick={() => setAddingException(true)}>+ Add day off</button>
                </div>
                <div className="exc-list">
                  {exceptions.length === 0
                    ? <div className="exc-empty">No days blocked in the next 90 days</div>
                    : exceptions.map(e => (
                      <div key={e.id} className="exc-item">
                        <span className="exc-date">{new Date(e.exception_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                        <span className="exc-reason">{e.reason || 'Day off'}</span>
                        <span className="exc-badge">Blocked</span>
                        <button className="exc-remove" onClick={() => removeException(e.id)}>✕</button>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* RIGHT — 3-month calendar */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">90-day availability preview</div>
                  <div className="card-sub">Click a working day to block it off</div>
                </div>
              </div>
              <div className="legend-row">
                <div className="legend-item"><div className="legend-dot" style={{background:'#F0F9FF',border:'1px solid #0EA5E9'}} />Available</div>
                <div className="legend-item"><div className="legend-dot" style={{background:'#FEF2F2',border:'1px solid #F43F5E'}} />Blocked</div>
                <div className="legend-item"><div className="legend-dot" style={{background:'#F8FAFC',border:'1px solid #E2E8F0'}} />Not working</div>
              </div>
              {months.map(month => {
                // Calculate padding for first day of month
                const firstDow = month.days[0].dow
                const pad = firstDow === 0 ? 6 : firstDow - 1 // Mon-start grid

                return (
                  <div key={month.label} className="month-block">
                    <div className="month-label">{month.label}</div>
                    <div className="cal-grid">
                      {['M','T','W','T','F','S','S'].map((d, i) => (
                        <div key={i} className="dow-header">{d}</div>
                      ))}
                      {Array.from({ length: pad }, (_, i) => (
                        <div key={`pad-${i}`} className="cal-day empty" />
                      ))}
                      {month.days.map(day => {
                        const status = getDayStatus(day.dateStr, day.dow)
                        const isToday = day.dateStr === today
                        return (
                          <div
                            key={day.dateStr}
                            className={`cal-day ${status} ${isToday ? 'today-marker' : ''}`}
                            title={status === 'working' ? 'Click to block this day' : status === 'off' ? 'Blocked — click to remove' : ''}
                            onClick={() => {
                              if (status === 'working') {
                                setExcDate(day.dateStr)
                                setAddingException(true)
                              } else if (status === 'off') {
                                const exc = exceptions.find(e => e.exception_date === day.dateStr)
                                if (exc) removeException(exc.id)
                              }
                            }}
                          >
                            {day.date.getDate()}
                            {status === 'off' && <span className="off-dot" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Add exception modal */}
      {addingException && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddingException(false)}>
          <div className="modal">
            <div className="modal-title">Block a day off</div>
            <div className="modal-sub">This date will be marked unavailable — no bookings will be offered</div>
            <div className="modal-field">
              <label className="modal-label">Date</label>
              <input
                type="date"
                className="modal-input"
                value={excDate}
                min={today}
                onChange={e => setExcDate(e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Reason (optional)</label>
              <input
                className="modal-input"
                placeholder="e.g. Vacation, Conference, Personal"
                value={excReason}
                onChange={e => setExcReason(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => { setAddingException(false); setExcDate(''); setExcReason('') }}>Cancel</button>
              <button className="modal-confirm" onClick={addException} disabled={!excDate || excSaving}>
                {excSaving ? 'Saving...' : 'Block this day'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
