'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'

interface DaySchedule { active: boolean; start: string; end: string }
interface Schedule { [day: number]: DaySchedule }
interface Exception {
  id: string; exception_date: string; is_day_off: boolean
  start_time: string | null; end_time: string | null; reason: string | null
}
type ExcType = 'single' | 'range' | 'holidays'

const DAYS = [
  { label: 'Monday',    short: 'Mon', num: 1 },
  { label: 'Tuesday',   short: 'Tue', num: 2 },
  { label: 'Wednesday', short: 'Wed', num: 3 },
  { label: 'Thursday',  short: 'Thu', num: 4 },
  { label: 'Friday',    short: 'Fri', num: 5 },
  { label: 'Saturday',  short: 'Sat', num: 6 },
  { label: 'Sunday',    short: 'Sun', num: 0 },
]

const DEFAULT_SCHEDULE: Schedule = {
  1: { active: true,  start: '09:00', end: '17:00' },
  2: { active: true,  start: '09:00', end: '17:00' },
  3: { active: true,  start: '09:00', end: '17:00' },
  4: { active: true,  start: '09:00', end: '17:00' },
  5: { active: true,  start: '09:00', end: '17:00' },
  6: { active: false, start: '09:00', end: '14:00' },
  0: { active: false, start: '09:00', end: '14:00' },
}

const HOURS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 7
  return { label: h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM`, value: String(h).padStart(2,'0')+':00' }
})

const LUNCH_HOURS = Array.from({ length: 10 }, (_, i) => {
  const h = i + 10
  return { label: h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM`, value: String(h).padStart(2,'0')+':00' }
})

const STAT_HOLIDAYS = [
  { date: '2026-01-01', name: "New Year's Day",   flag: 'QC+CA' },
  { date: '2026-04-03', name: 'Good Friday',       flag: 'QC+CA' },
  { date: '2026-04-06', name: 'Easter Monday',     flag: 'QC' },
  { date: '2026-05-18', name: 'Victoria Day',      flag: 'QC+CA' },
  { date: '2026-06-24', name: 'St-Jean-Baptiste',  flag: 'QC' },
  { date: '2026-07-01', name: 'Canada Day',        flag: 'QC+CA' },
  { date: '2026-09-07', name: 'Labour Day',        flag: 'QC+CA' },
  { date: '2026-10-12', name: 'Thanksgiving',      flag: 'QC+CA' },
  { date: '2026-11-11', name: 'Remembrance Day',   flag: 'CA' },
  { date: '2026-12-25', name: 'Christmas Day',     flag: 'QC+CA' },
  { date: '2026-12-26', name: 'Boxing Day',        flag: 'CA' },
  { date: '2027-01-01', name: "New Year's Day",    flag: 'QC+CA' },
  { date: '2027-04-02', name: 'Good Friday',       flag: 'QC+CA' },
  { date: '2027-04-05', name: 'Easter Monday',     flag: 'QC' },
  { date: '2027-05-24', name: 'Victoria Day',      flag: 'QC+CA' },
  { date: '2027-06-24', name: 'St-Jean-Baptiste',  flag: 'QC' },
  { date: '2027-07-01', name: 'Canada Day',        flag: 'QC+CA' },
  { date: '2027-09-06', name: 'Labour Day',        flag: 'QC+CA' },
  { date: '2027-10-11', name: 'Thanksgiving',      flag: 'QC+CA' },
  { date: '2027-11-11', name: 'Remembrance Day',   flag: 'CA' },
  { date: '2027-12-25', name: 'Christmas Day',     flag: 'QC+CA' },
  { date: '2027-12-26', name: 'Boxing Day',        flag: 'CA' },
]

const buildCalendar = () => {
  const today = new Date(); today.setHours(0,0,0,0)
  const months: { label: string; days: { date: Date; dateStr: string; dow: number }[] }[] = []
  let cur = new Date(today); const end = new Date(today); end.setDate(end.getDate()+90)
  while (cur <= end) {
    const lbl = cur.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' , timeZone: 'America/Toronto' })
    let m = months.find(x => x.label === lbl)
    if (!m) { m = { label: lbl, days: [] }; months.push(m) }
    m.days.push({ date: new Date(cur), dateStr: cur.toISOString().slice(0,10), dow: cur.getDay() })
    cur.setDate(cur.getDate()+1)
  }
  return months
}

export default function MySchedulePage() {
  const [staffId, setStaffId]   = useState('')
  const [clinicId, setClinicId] = useState('')
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE)
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [schedError, setSchedError] = useState('')

  const [lunchEnabled, setLunchEnabled] = useState(false)
  const [lunchStart, setLunchStart]     = useState('12:00')
  const [lunchEnd, setLunchEnd]         = useState('13:00')
  const [lunchSaving, setLunchSaving]   = useState(false)
  const [lunchSaved, setLunchSaved]     = useState(false)

  const [addingException, setAddingException] = useState(false)
  const [excType, setExcType]           = useState<ExcType>('single')
  const [excDate, setExcDate]           = useState('')
  const [excEndDate, setExcEndDate]     = useState('')
  const [excReason, setExcReason]       = useState('')
  const [excSaving, setExcSaving]       = useState(false)
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>([])

  const supabase = createClient()
  const pathname = usePathname()
  const months   = buildCalendar()
  const today    = new Date().toISOString().slice(0,10)

  const loadExceptions = useCallback(async (sid: string, cid: string) => {
    const future = new Date(); future.setDate(future.getDate()+90)
    const { data } = await supabase.from('provider_exceptions').select('*')
      .eq('staff_id', sid).eq('clinic_id', cid)
      .gte('exception_date', today).lte('exception_date', future.toISOString().slice(0,10))
      .order('exception_date')
    setExceptions(data || [])
  }, [today])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: staff } = await supabase.from('staff_accounts')
        .select('id, full_name, role, clinic_id').eq('auth_id', user.id).single()
      if (!staff) return
      setStaffId(staff.id); setClinicId(staff.clinic_id)

      const fresh: Schedule = {
        1:{active:false,start:'09:00',end:'17:00'}, 2:{active:false,start:'09:00',end:'17:00'},
        3:{active:false,start:'09:00',end:'17:00'}, 4:{active:false,start:'09:00',end:'17:00'},
        5:{active:false,start:'09:00',end:'17:00'}, 6:{active:false,start:'09:00',end:'14:00'},
        0:{active:false,start:'09:00',end:'14:00'},
      }
      const { data: rows } = await supabase.from('provider_schedules')
        .select('day_of_week, start_time, end_time, is_active, lunch_start, lunch_end')
        .eq('staff_id', staff.id).eq('clinic_id', staff.clinic_id)

      if (rows && rows.length > 0) {
        rows.forEach((r: any) => {
          if (r.day_of_week >= 0 && r.day_of_week <= 6)
            fresh[r.day_of_week] = { active: r.is_active, start: r.start_time.slice(0,5), end: r.end_time.slice(0,5) }
        })
        const lr = rows.find((r: any) => r.lunch_start)
        if (lr) { setLunchEnabled(true); setLunchStart(lr.lunch_start.slice(0,5)); setLunchEnd(lr.lunch_end?.slice(0,5) || '13:00') }
      } else { Object.assign(fresh, DEFAULT_SCHEDULE) }
      setSchedule(fresh)
      await loadExceptions(staff.id, staff.clinic_id)
      setLoading(false)
    }
    init()
  }, [pathname])

  const buildScheduleRows = (ls: string|null, le: string|null) =>
    DAYS.map(d => ({
      clinic_id: clinicId, staff_id: staffId, day_of_week: d.num,
      start_time: schedule[d.num].start+':00', end_time: schedule[d.num].end+':00',
      is_active: schedule[d.num].active, lunch_start: ls, lunch_end: le,
    }))

  const saveSchedule = async () => {
    setSaving(true); setSchedError('')
    const { error } = await supabase.from('provider_schedules')
      .upsert(buildScheduleRows(lunchEnabled ? lunchStart+':00' : null, lunchEnabled ? lunchEnd+':00' : null), { onConflict: 'staff_id,day_of_week' })
    setSaving(false)
    if (error) { setSchedError('Failed to save. Please try again.'); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const saveLunch = async () => {
    setLunchSaving(true)
    await supabase.from('provider_schedules')
      .upsert(buildScheduleRows(lunchEnabled ? lunchStart+':00' : null, lunchEnabled ? lunchEnd+':00' : null), { onConflict: 'staff_id,day_of_week' })
    setLunchSaving(false); setLunchSaved(true); setTimeout(() => setLunchSaved(false), 3000)
  }

  const addSingleDay = async () => {
    if (!excDate) return; setExcSaving(true)
    await supabase.from('provider_exceptions').upsert(
      { clinic_id: clinicId, staff_id: staffId, exception_date: excDate, is_day_off: true, reason: excReason || null },
      { onConflict: 'staff_id,exception_date' })
    await loadExceptions(staffId, clinicId); setExcSaving(false); closeModal()
  }

  const addVacationRange = async () => {
    if (!excDate || !excEndDate) return; setExcSaving(true)
    const rows: any[] = []
    let cur = new Date(excDate+'T12:00:00'); const end = new Date(excEndDate+'T12:00:00')
    while (cur <= end) {
      const dow = cur.getDay(); const ds = cur.toISOString().slice(0,10)
      if (schedule[dow]?.active) rows.push({ clinic_id: clinicId, staff_id: staffId, exception_date: ds, is_day_off: true, reason: excReason || 'Vacation' })
      cur.setDate(cur.getDate()+1)
    }
    if (rows.length > 0) await supabase.from('provider_exceptions').upsert(rows, { onConflict: 'staff_id,exception_date' })
    await loadExceptions(staffId, clinicId); setExcSaving(false); closeModal()
  }

  const addStatHolidays = async () => {
    if (!selectedHolidays.length) return; setExcSaving(true)
    const rows = selectedHolidays.map(date => ({
      clinic_id: clinicId, staff_id: staffId, exception_date: date, is_day_off: true,
      reason: STAT_HOLIDAYS.find(h => h.date === date)?.name || 'Stat holiday',
    }))
    await supabase.from('provider_exceptions').upsert(rows, { onConflict: 'staff_id,exception_date' })
    await loadExceptions(staffId, clinicId); setExcSaving(false); closeModal()
  }

  const removeException = async (id: string) => {
    await supabase.from('provider_exceptions').delete().eq('id', id)
    setExceptions(prev => prev.filter(e => e.id !== id))
  }

  const closeModal = () => {
    setAddingException(false); setExcDate(''); setExcEndDate(''); setExcReason('')
    setSelectedHolidays([]); setExcType('single')
  }

  const toggleHoliday = (date: string) =>
    setSelectedHolidays(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date])

  const exceptionDates = new Set(exceptions.map(e => e.exception_date))
  const getDayStatus = (dateStr: string, dow: number) => {
    if (exceptionDates.has(dateStr)) return 'off'
    if (!schedule[dow]?.active) return 'not-working'
    return 'working'
  }

  const activeDays  = DAYS.filter(d => schedule[d.num].active)
  const totalHours  = activeDays.reduce((s, d) => s + Math.max(0, parseInt(schedule[d.num].end) - parseInt(schedule[d.num].start)), 0)
  const futureStats = STAT_HOLIDAYS.filter(h => h.date >= today)
  const yearGroups  = ['2026','2027'].map(yr => ({ year: yr, holidays: futureStats.filter(h => h.date.startsWith(yr)) })).filter(g => g.holidays.length)

  const toggleDay = (day: number) => { setSchedule(p => ({...p, [day]: {...p[day], active: !p[day].active}})); setSaved(false) }
  const setTime   = (day: number, f: 'start'|'end', v: string) => { setSchedule(p => ({...p, [day]: {...p[day], [f]: v}})); setSaved(false) }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400&display=swap');
        *{box-sizing:border-box}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}
        .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        .stat-card{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:16px 20px}
        .stat-value{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;line-height:1}
        .stat-label{font-size:12px;color:#94A3B8;margin-top:4px}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:16px}
        .card-header{padding:16px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-size:14px;font-weight:600;color:#0F172A}
        .card-sub{font-size:11px;color:#94A3B8;margin-top:2px}
        .day-row{display:flex;align-items:center;padding:11px 20px;border-bottom:1px solid #F8FAFC;gap:12px}
        .day-row:last-child{border-bottom:none}
        .toggle-wrap{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
        .toggle-track{width:34px;height:18px;border-radius:9px;background:#E2E8F0;position:relative;transition:background .2s;flex-shrink:0}
        .toggle-track.on{background:#0EA5E9}
        .toggle-thumb{width:14px;height:14px;border-radius:50%;background:white;position:absolute;top:2px;left:2px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.15)}
        .toggle-track.on .toggle-thumb{transform:translateX(16px)}
        .day-name{font-size:13px;font-weight:500;color:#0F172A;min-width:32px}
        .day-name.off{color:#CBD5E1}
        .time-row{display:flex;align-items:center;gap:6px;flex:1}
        .time-select{padding:5px 8px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0F172A;background:white;cursor:pointer;outline:none;transition:border-color .15s;flex:1}
        .time-select:focus{border-color:#0EA5E9}
        .time-select:disabled{opacity:.3;cursor:not-allowed}
        .time-sep{font-size:11px;color:#CBD5E1}
        .hrs-tag{font-family:'JetBrains Mono',monospace;font-size:10px;color:#94A3B8;white-space:nowrap;min-width:28px}
        .save-row{padding:14px 20px;border-top:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .save-note{font-size:11px;color:#94A3B8}
        .save-btn{padding:8px 18px;background:#0F172A;color:white;border-radius:8px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .15s}
        .save-btn:hover{background:#1E293B}
        .save-btn.saved{background:#10B981}
        .save-btn:disabled{opacity:.6;cursor:not-allowed}
        .error-msg{padding:10px 20px;font-size:12px;color:#DC2626;background:#FEF2F2;border-top:1px solid #FECACA}
        .lunch-row{display:flex;align-items:center;gap:10px;padding:14px 20px}
        .exc-list{padding:0}
        .exc-item{display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid #F8FAFC}
        .exc-item:last-child{border-bottom:none}
        .exc-date{font-family:'JetBrains Mono',monospace;font-size:12px;color:#0F172A;font-weight:500;min-width:94px}
        .exc-reason{font-size:12px;color:#64748B;flex:1}
        .exc-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:#F43F5E;white-space:nowrap}
        .exc-badge.holiday{background:#FEF3C7;color:#D97706}
        .exc-remove{width:22px;height:22px;border-radius:50%;background:#F8FAFC;border:none;cursor:pointer;font-size:11px;color:#94A3B8;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0}
        .exc-remove:hover{background:#FEF2F2;color:#F43F5E}
        .exc-empty{padding:20px;text-align:center;font-size:12px;color:#CBD5E1}
        .add-exc-btn{padding:6px 14px;border:1.5px dashed #E2E8F0;border-radius:7px;font-size:12px;font-weight:500;color:#94A3B8;background:white;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}
        .add-exc-btn:hover{border-color:#0EA5E9;color:#0EA5E9}
        .month-block{margin-bottom:16px}
        .month-label{font-size:12px;font-weight:600;color:#64748B;letter-spacing:.5px;text-transform:uppercase;padding:10px 20px 6px}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;padding:0 12px 12px}
        .dow-header{font-size:10px;font-weight:600;color:#CBD5E1;text-align:center;padding:4px 0}
        .cal-day{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;position:relative;cursor:default;transition:all .12s}
        .cal-day.working{background:#F0F9FF;color:#0EA5E9;font-weight:600;cursor:pointer}
        .cal-day.working:hover{background:#E0F2FE}
        .cal-day.off{background:#FEF2F2;color:#F43F5E;font-weight:600;cursor:pointer}
        .cal-day.not-working{background:#F8FAFC;color:#CBD5E1}
        .cal-day.today-marker{outline:2px solid #0EA5E9;outline-offset:-2px}
        .cal-day.empty{background:transparent}
        .off-dot{width:4px;height:4px;border-radius:50%;background:#F43F5E;position:absolute;bottom:3px;left:50%;transform:translateX(-50%)}
        .legend-row{display:flex;gap:14px;padding:8px 20px 12px;flex-wrap:wrap}
        .legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:#64748B}
        .legend-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
        .loading{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(2px)}
        .modal{background:white;border-radius:14px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:88vh}
        .modal.wide{max-width:520px}
        .modal-header{padding:24px 28px 16px;flex-shrink:0}
        .modal-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .modal-sub{font-size:12px;color:#94A3B8;margin-bottom:14px}
        .type-tabs{display:flex;gap:4px;background:#F8FAFC;border-radius:8px;padding:3px}
        .type-tab{flex:1;padding:7px 6px;border:none;border-radius:6px;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;color:#64748B;background:none;transition:all .15s;text-align:center}
        .type-tab.active{background:white;color:#0F172A;box-shadow:0 1px 3px rgba(0,0,0,.08)}
        .modal-body{padding:16px 28px;overflow-y:auto;flex:1}
        .modal-field{margin-bottom:14px}
        .modal-label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
        .modal-input{width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;color:#0F172A;outline:none;transition:border-color .15s}
        .modal-input:focus{border-color:#0EA5E9}
        .date-range-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .year-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin:14px 0 8px;padding-top:8px;border-top:1px solid #F1F5F9}
        .year-label:first-child{border-top:none;margin-top:0;padding-top:0}
        .holiday-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F8FAFC;cursor:pointer;user-select:none}
        .holiday-item:last-child{border-bottom:none}
        .holiday-item.taken{opacity:.4;cursor:not-allowed}
        .holiday-check{width:16px;height:16px;border-radius:4px;border:1.5px solid #E2E8F0;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;background:white}
        .holiday-check.checked{background:#0EA5E9;border-color:#0EA5E9}
        .holiday-name{font-size:13px;color:#0F172A;flex:1}
        .holiday-date{font-family:'JetBrains Mono',monospace;font-size:11px;color:#94A3B8}
        .holiday-flag{font-size:10px;padding:2px 6px;border-radius:10px;background:#F1F5F9;color:#64748B}
        .holiday-added{font-size:10px;color:#10B981;font-weight:600}
        .sel-all-btn{font-size:12px;color:#0EA5E9;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500;padding:0}
        .modal-footer{padding:14px 28px;border-top:1px solid #F1F5F9;display:flex;gap:8px;flex-shrink:0}
        .modal-cancel{flex:1;padding:9px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-weight:500;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif}
        .modal-cancel:hover{background:#F8FAFC}
        .modal-confirm{flex:2;padding:9px;background:#0F172A;color:white;border-radius:8px;font-size:13px;font-weight:500;border:none;cursor:pointer;font-family:'DM Sans',sans-serif}
        .modal-confirm:hover{background:#1E293B}
        .modal-confirm:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <div className="page-title">My Schedule</div>
      <div className="page-sub">Set your weekly pattern, configure lunch, and block time off for vacation or holidays.</div>

      {loading ? <div className="loading">Loading your schedule...</div> : (<>
        <div className="stats-row">
          <div className="stat-card"><div className="stat-value">{activeDays.length}</div><div className="stat-label">Working days / week</div></div>
          <div className="stat-card"><div className="stat-value">{totalHours}h</div><div className="stat-label">Available hours / week</div></div>
          <div className="stat-card"><div className="stat-value">{lunchEnabled ? `${lunchStart}` : '—'}</div><div className="stat-label">Lunch break starts</div></div>
          <div className="stat-card"><div className="stat-value">{exceptions.length}</div><div className="stat-label">Days blocked (90d)</div></div>
        </div>

        <div className="two-col">
          <div>
            {/* Weekly pattern */}
            <div className="card">
              <div className="card-header">
                <div><div className="card-title">Weekly pattern</div><div className="card-sub">Repeats automatically — set once, applies indefinitely</div></div>
              </div>
              {DAYS.map(d => {
                const day = schedule[d.num]
                const hrs = day.active ? parseInt(day.end) - parseInt(day.start) : 0
                return (
                  <div key={d.num} className="day-row">
                    <div className="toggle-wrap" onClick={() => toggleDay(d.num)}>
                      <div className={`toggle-track ${day.active ? 'on' : ''}`}><div className="toggle-thumb" /></div>
                      <span className={`day-name ${day.active ? '' : 'off'}`}>{d.short}</span>
                    </div>
                    <div className="time-row">
                      <select className="time-select" value={day.start} disabled={!day.active} onChange={e => setTime(d.num,'start',e.target.value)}>
                        {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                      <span className="time-sep">–</span>
                      <select className="time-select" value={day.end} disabled={!day.active} onChange={e => setTime(d.num,'end',e.target.value)}>
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

            {/* Lunch break */}
            <div className="card">
              <div className="card-header">
                <div><div className="card-title">Lunch break</div><div className="card-sub">No appointments offered during this window</div></div>
                <div className="toggle-wrap" onClick={() => setLunchEnabled(v => !v)} style={{ minWidth: 0 }}>
                  <div className={`toggle-track ${lunchEnabled ? 'on' : ''}`}><div className="toggle-thumb" /></div>
                </div>
              </div>
              <div className="lunch-row">
                <select className="time-select" value={lunchStart} disabled={!lunchEnabled} onChange={e => setLunchStart(e.target.value)} style={{ maxWidth: 120 }}>
                  {LUNCH_HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
                <span className="time-sep">to</span>
                <select className="time-select" value={lunchEnd} disabled={!lunchEnabled} onChange={e => setLunchEnd(e.target.value)} style={{ maxWidth: 120 }}>
                  {LUNCH_HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
                <button className={`save-btn ${lunchSaved ? 'saved' : ''}`} onClick={saveLunch} disabled={lunchSaving} style={{ padding: '7px 14px', fontSize: 12, marginLeft: 'auto' }}>
                  {lunchSaving ? '...' : lunchSaved ? '✓' : 'Save'}
                </button>
              </div>
            </div>

            {/* Days off list */}
            <div className="card">
              <div className="card-header">
                <div><div className="card-title">Days off &amp; exceptions</div><div className="card-sub">Next 90 days — vacation, personal, stat holidays</div></div>
                <button className="add-exc-btn" onClick={() => setAddingException(true)}>+ Add time off</button>
              </div>
              <div className="exc-list">
                {exceptions.length === 0
                  ? <div className="exc-empty">No days blocked in the next 90 days</div>
                  : exceptions.map(e => {
                    const isHoliday = STAT_HOLIDAYS.some(h => h.date === e.exception_date)
                    return (
                      <div key={e.id} className="exc-item">
                        <span className="exc-date">{new Date(e.exception_date+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric',weekday:'short', timeZone: 'America/Toronto' })}</span>
                        <span className="exc-reason">{e.reason || 'Day off'}</span>
                        <span className={`exc-badge ${isHoliday ? 'holiday' : ''}`}>{isHoliday ? 'Holiday' : 'Blocked'}</span>
                        <button className="exc-remove" onClick={() => removeException(e.id)}>✕</button>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          </div>

          {/* 90-day calendar */}
          <div className="card">
            <div className="card-header">
              <div><div className="card-title">90-day availability preview</div><div className="card-sub">Click working day to block · Click blocked to unblock</div></div>
            </div>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{background:'#F0F9FF',border:'1px solid #0EA5E9'}} />Available</div>
              <div className="legend-item"><div className="legend-dot" style={{background:'#FEF2F2',border:'1px solid #F43F5E'}} />Blocked</div>
              <div className="legend-item"><div className="legend-dot" style={{background:'#F8FAFC',border:'1px solid #E2E8F0'}} />Not working</div>
            </div>
            {months.map(month => {
              const pad = month.days[0].dow
              return (
                <div key={month.label} className="month-block">
                  <div className="month-label">{month.label}</div>
                  <div className="cal-grid">
                    {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="dow-header">{d}</div>)}
                    {Array.from({length:pad},(_,i) => <div key={`p${i}`} className="cal-day empty" />)}
                    {month.days.map(day => {
                      const status = getDayStatus(day.dateStr, day.dow)
                      const holiday = STAT_HOLIDAYS.find(h => h.date === day.dateStr)
                      return (
                        <div
                          key={day.dateStr}
                          className={`cal-day ${status} ${day.dateStr === today ? 'today-marker' : ''}`}
                          title={holiday ? holiday.name : status === 'working' ? 'Click to block' : status === 'off' ? 'Click to unblock' : ''}
                          onClick={() => {
                            if (status === 'working') { setExcDate(day.dateStr); setAddingException(true) }
                            else if (status === 'off') { const exc = exceptions.find(e => e.exception_date === day.dateStr); if (exc) removeException(exc.id) }
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
      </>)}

      {/* Exception modal */}
      {addingException && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className={`modal ${excType === 'holidays' ? 'wide' : ''}`}>
            <div className="modal-header">
              <div className="modal-title">Add time off</div>
              <div className="modal-sub">Block time so no appointments are offered during that period.</div>
              <div className="type-tabs">
                {([['single','Single day'],['range','Date range'],['holidays','Stat holidays']] as [ExcType,string][]).map(([t,label]) => (
                  <button key={t} className={`type-tab ${excType === t ? 'active' : ''}`} onClick={() => setExcType(t)}>{label}</button>
                ))}
              </div>
            </div>

            <div className="modal-body">
              {excType === 'single' && (<>
                <div className="modal-field">
                  <label className="modal-label">Date</label>
                  <input type="date" className="modal-input" value={excDate} min={today} onChange={e => setExcDate(e.target.value)} />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Reason (optional)</label>
                  <input className="modal-input" placeholder="e.g. Personal, Conference" value={excReason} onChange={e => setExcReason(e.target.value)} />
                </div>
              </>)}

              {excType === 'range' && (<>
                <div className="modal-field">
                  <label className="modal-label">Date range</label>
                  <div className="date-range-row">
                    <input type="date" className="modal-input" value={excDate} min={today} onChange={e => setExcDate(e.target.value)} />
                    <input type="date" className="modal-input" value={excEndDate} min={excDate || today} onChange={e => setExcEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Reason (optional)</label>
                  <input className="modal-input" placeholder="e.g. Vacation, Conference" value={excReason} onChange={e => setExcReason(e.target.value)} />
                </div>
                {excDate && excEndDate && (
                  <div style={{fontSize:12,color:'#64748B',background:'#F8FAFC',borderRadius:8,padding:'8px 12px'}}>
                    Only your configured working days within this range will be blocked.
                  </div>
                )}
              </>)}

              {excType === 'holidays' && (<>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontSize:12,color:'#64748B'}}>Québec &amp; Canada stat holidays</span>
                  <button className="sel-all-btn" onClick={() => setSelectedHolidays(futureStats.filter(h => !exceptionDates.has(h.date)).map(h => h.date))}>
                    Select all upcoming
                  </button>
                </div>
                {yearGroups.map(group => (
                  <div key={group.year}>
                    <div className="year-label">{group.year}</div>
                    {group.holidays.map(h => {
                      const taken   = exceptionDates.has(h.date)
                      const checked = selectedHolidays.includes(h.date)
                      return (
                        <div key={h.date} className={`holiday-item ${taken ? 'taken' : ''}`} onClick={() => !taken && toggleHoliday(h.date)}>
                          <div className={`holiday-check ${checked ? 'checked' : ''}`}>
                            {checked && <span style={{fontSize:10,color:'white',lineHeight:1}}>✓</span>}
                          </div>
                          <span className="holiday-name">{h.name}</span>
                          <span className="holiday-date">{new Date(h.date+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric',weekday:'short', timeZone: 'America/Toronto' })}</span>
                          <span className="holiday-flag">{h.flag}</span>
                          {taken && <span className="holiday-added">✓ added</span>}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {selectedHolidays.length > 0 && (
                  <div style={{fontSize:12,color:'#64748B',marginTop:12,padding:'8px 12px',background:'#F8FAFC',borderRadius:8}}>
                    {selectedHolidays.length} holiday{selectedHolidays.length > 1 ? 's' : ''} selected
                  </div>
                )}
              </>)}
            </div>

            <div className="modal-footer">
              <button className="modal-cancel" onClick={closeModal}>Cancel</button>
              <button
                className="modal-confirm"
                disabled={excSaving ||
                  (excType === 'single' && !excDate) ||
                  (excType === 'range' && (!excDate || !excEndDate)) ||
                  (excType === 'holidays' && !selectedHolidays.length)
                }
                onClick={() => excType === 'single' ? addSingleDay() : excType === 'range' ? addVacationRange() : addStatHolidays()}
              >
                {excSaving ? 'Saving...' :
                  excType === 'single' ? 'Block this day' :
                  excType === 'range'  ? 'Block date range' :
                  `Add ${selectedHolidays.length || ''} holiday${selectedHolidays.length !== 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
