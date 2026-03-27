'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface StaffMember {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface Invite {
  id: string
  email: string
  full_name: string | null
  role: string
  status: string
  expires_at: string
  token: string
}

interface DaySchedule {
  active: boolean
  start: string
  end: string
}

interface Schedule {
  [day: number]: DaySchedule
}

const DAYS = [
  { label: 'Mon', short: 'M', num: 1 },
  { label: 'Tue', short: 'T', num: 2 },
  { label: 'Wed', short: 'W', num: 3 },
  { label: 'Thu', short: 'T', num: 4 },
  { label: 'Fri', short: 'F', num: 5 },
]

const DEFAULT_SCHEDULE: Schedule = {
  1: { active: true,  start: '09:00', end: '17:00' },
  2: { active: true,  start: '09:00', end: '17:00' },
  3: { active: true,  start: '09:00', end: '17:00' },
  4: { active: true,  start: '09:00', end: '17:00' },
  5: { active: true,  start: '09:00', end: '17:00' },
}

const ROLES = ['dentist', 'hygienist', 'receptionist', 'billing']

const ROLE_COLOR: Record<string, string> = {
  owner: '#6366F1', dentist: '#0EA5E9', hygienist: '#10B981',
  receptionist: '#F59E0B', billing: '#F43F5E'
}

const HOURS = Array.from({ length: 13 }, (_, i) => {
  const h = i + 7
  const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`
  const value = String(h).padStart(2, '0') + ':00'
  return { label, value }
})

const TEAM_STAT_HOLIDAYS = [
  { date: '2026-01-01', name: "New Year's Day" }, { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },  { date: '2026-05-18', name: 'Victoria Day' },
  { date: '2026-06-24', name: 'St-Jean-Baptiste'}, { date: '2026-07-01', name: 'Canada Day' },
  { date: '2026-09-07', name: 'Labour Day' },      { date: '2026-10-12', name: 'Thanksgiving' },
  { date: '2026-11-11', name: 'Remembrance Day' }, { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Boxing Day' },
  { date: '2027-01-01', name: "New Year's Day" },  { date: '2027-04-02', name: 'Good Friday' },
  { date: '2027-04-05', name: 'Easter Monday' },   { date: '2027-05-24', name: 'Victoria Day' },
  { date: '2027-06-24', name: 'St-Jean-Baptiste'}, { date: '2027-07-01', name: 'Canada Day' },
  { date: '2027-09-06', name: 'Labour Day' },      { date: '2027-10-11', name: 'Thanksgiving' },
  { date: '2027-11-11', name: 'Remembrance Day' }, { date: '2027-12-25', name: 'Christmas Day' },
  { date: '2027-12-26', name: 'Boxing Day' },
]
const LUNCH_HOURS_TEAM = Array.from({ length: 10 }, (_, i) => {
  const h = i + 10
  return { label: h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM`, value: String(h).padStart(2,'0')+':00' }
})

export default function TeamPage() {
  const [clinicId, setClinicId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('receptionist')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')

  // Schedule state
  const [scheduleFor, setScheduleFor] = useState<StaffMember | null>(null)
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)

  // Panel tabs: 'hours' | 'daysoff'
  const [panelTab, setPanelTab]             = useState<'hours'|'daysoff'>('hours')
  // Lunch for panel provider
  const [lunchEnabled, setLunchEnabled]     = useState(false)
  const [lunchStart, setLunchStart]         = useState('12:00')
  const [lunchEnd, setLunchEnd]             = useState('13:00')
  const [lunchSaving, setLunchSaving]       = useState(false)
  const [lunchSaved, setLunchSaved]         = useState(false)
  // Days off for panel provider
  const [provExceptions, setProvExceptions] = useState<{id:string;exception_date:string;reason:string|null}[]>([])
  const [addingExc, setAddingExc]           = useState(false)
  const [excType, setExcType]               = useState<'single'|'range'|'holidays'>('single')
  const [excDate, setExcDate]               = useState('')
  const [excEndDate, setExcEndDate]         = useState('')
  const [excReason, setExcReason]           = useState('')
  const [excSaving, setExcSaving]           = useState(false)
  const [selHolidays, setSelHolidays]       = useState<string[]>([])

  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ownerData } = await supabase.from('clinic_owners')
        .select('id, clinic_id').eq('auth_id', user.id).single()
      if (!ownerData) return
      setClinicId(ownerData.clinic_id)
      setOwnerId(ownerData.id)

      const [{ data: staffData }, { data: inviteData }] = await Promise.all([
        supabase.from('staff_accounts').select('*').eq('clinic_id', ownerData.clinic_id).order('created_at'),
        supabase.from('staff_invites').select('*').eq('clinic_id', ownerData.clinic_id)
          .eq('status', 'pending').order('created_at', { ascending: false })
      ])
      setStaff(staffData || [])
      setInvites(inviteData || [])
      setLoading(false)
    }
    load()
  }, [])

  const sendInvite = async () => {
    if (!inviteEmail) { setError('Email is required.'); return }
    setSending(true); setError(''); setInviteLink('')
    const normalizedEmail = inviteEmail.trim().toLowerCase()

    const { data, error: inviteError } = await supabase
      .from('staff_invites')
      .insert({ clinic_id: clinicId, invited_by: ownerId, email: normalizedEmail, full_name: inviteName || null, role: inviteRole })
      .select().single()

    if (inviteError || !data) { setError('Failed to create invite.'); setSending(false); return }

    const url = `${window.location.origin}/invite/${data.token}`
    setInviteLink(url)
    setInvites(prev => [data, ...prev])

    // Send invite email via API
    await fetch('/api/invite/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId: data.id, clinicId }),
    })

    setInviteEmail(''); setInviteName(''); setInviteRole('receptionist')
    setSent(true); setSending(false)
    setTimeout(() => setSent(false), 3000)
  }

  const copyLink = () => navigator.clipboard.writeText(inviteLink)

  // Open schedule panel — load existing rows
  const loadProvExceptions = async (memberId: string) => {
    const today = new Date().toISOString().slice(0,10)
    const future = new Date(); future.setDate(future.getDate()+90)
    const { data } = await supabase.from('provider_exceptions').select('id, exception_date, reason')
      .eq('staff_id', memberId).eq('clinic_id', clinicId)
      .gte('exception_date', today).lte('exception_date', future.toISOString().slice(0,10))
      .order('exception_date')
    setProvExceptions(data || [])
  }

  const openSchedule = async (member: StaffMember) => {
    setScheduleFor(member)
    setScheduleLoading(true)
    setScheduleSaved(false)
    setPanelTab('hours')
    setLunchEnabled(false); setLunchStart('12:00'); setLunchEnd('13:00')
    setProvExceptions([]); setAddingExc(false)

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
      .eq('staff_id', member.id)
      .eq('clinic_id', clinicId)

    const { data: rows } = await supabase
      .from('provider_schedules')
      .select('day_of_week, start_time, end_time, is_active, lunch_start, lunch_end')
      .eq('staff_id', member.id)
      .eq('clinic_id', clinicId)

    if (rows && rows.length > 0) {
      rows.forEach((r: any) => {
        if (r.day_of_week >= 1 && r.day_of_week <= 5) {
          fresh[r.day_of_week] = { active: r.is_active, start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }
        }
      })
      const lr = rows.find((r: any) => r.lunch_start)
      if (lr) { setLunchEnabled(true); setLunchStart(lr.lunch_start.slice(0,5)); setLunchEnd(lr.lunch_end?.slice(0,5)||'13:00') }
    } else {
      Object.assign(fresh, DEFAULT_SCHEDULE)
    }

    setSchedule(fresh)
    await loadProvExceptions(member.id)
    setScheduleLoading(false)
  }

  const closeSchedule = () => { setScheduleFor(null); setScheduleSaved(false); setPanelTab('hours') }

  const saveProvLunch = async () => {
    if (!scheduleFor) return
    setLunchSaving(true)
    const rows = DAYS.map(d => ({
      clinic_id: clinicId, staff_id: scheduleFor.id, day_of_week: d.num,
      start_time: schedule[d.num].start+':00', end_time: schedule[d.num].end+':00',
      is_active: schedule[d.num].active,
      lunch_start: lunchEnabled ? lunchStart+':00' : null,
      lunch_end:   lunchEnabled ? lunchEnd+':00'   : null,
    }))
    await supabase.from('provider_schedules').upsert(rows, { onConflict: 'staff_id,day_of_week' })
    setLunchSaving(false); setLunchSaved(true); setTimeout(() => setLunchSaved(false), 3000)
  }

  const addProvException = async () => {
    if (!scheduleFor || !excDate) return; setExcSaving(true)
    await supabase.from('provider_exceptions').upsert(
      { clinic_id: clinicId, staff_id: scheduleFor.id, exception_date: excDate, is_day_off: true, reason: excReason || null },
      { onConflict: 'staff_id,exception_date' })
    await loadProvExceptions(scheduleFor.id); setExcSaving(false); closeExcModal()
  }

  const addProvRange = async () => {
    if (!scheduleFor || !excDate || !excEndDate) return; setExcSaving(true)
    const rows: any[] = []
    let cur = new Date(excDate+'T12:00:00'); const end = new Date(excEndDate+'T12:00:00')
    while (cur <= end) {
      const dow = cur.getDay(); const ds = cur.toISOString().slice(0,10)
      if (schedule[dow]?.active) rows.push({ clinic_id: clinicId, staff_id: scheduleFor.id, exception_date: ds, is_day_off: true, reason: excReason || 'Vacation' })
      cur.setDate(cur.getDate()+1)
    }
    if (rows.length) await supabase.from('provider_exceptions').upsert(rows, { onConflict: 'staff_id,exception_date' })
    await loadProvExceptions(scheduleFor.id); setExcSaving(false); closeExcModal()
  }

  const addProvHolidays = async () => {
    if (!scheduleFor || !selHolidays.length) return; setExcSaving(true)
    const rows = selHolidays.map(date => ({
      clinic_id: clinicId, staff_id: scheduleFor.id, exception_date: date, is_day_off: true,
      reason: TEAM_STAT_HOLIDAYS.find(h => h.date === date)?.name || 'Stat holiday',
    }))
    await supabase.from('provider_exceptions').upsert(rows, { onConflict: 'staff_id,exception_date' })
    await loadProvExceptions(scheduleFor.id); setExcSaving(false); closeExcModal()
  }

  const removeProvException = async (id: string) => {
    await supabase.from('provider_exceptions').delete().eq('id', id)
    setProvExceptions(prev => prev.filter(e => e.id !== id))
  }

  const closeExcModal = () => {
    setAddingExc(false); setExcDate(''); setExcEndDate(''); setExcReason(''); setSelHolidays([]); setExcType('single')
  }

  const toggleDay = (day: number) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], active: !prev[day].active } }))
  }

  const setTime = (day: number, field: 'start' | 'end', val: string) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))
  }

  const saveSchedule = async () => {
    if (!scheduleFor) return
    setScheduleSaving(true)

    // Upsert all 5 days
    const rows = DAYS.map(d => ({
      clinic_id: clinicId,
      staff_id: scheduleFor.id,
      day_of_week: d.num,
      start_time: schedule[d.num].start + ':00',
      end_time: schedule[d.num].end + ':00',
      is_active: schedule[d.num].active,
      lunch_start: lunchEnabled ? lunchStart + ':00' : null,
      lunch_end:   lunchEnabled ? lunchEnd   + ':00' : null,
    }))

    const { error: upsertError } = await supabase
      .from('provider_schedules')
      .upsert(rows, { onConflict: 'staff_id,day_of_week' })

    setScheduleSaving(false)
    if (upsertError) {
      alert('Failed to save schedule. Please try again.')
      return
    }
    setScheduleSaved(true)
    setTimeout(() => setScheduleSaved(false), 2500)
  }

  const activeDays = scheduleFor ? DAYS.filter(d => schedule[d.num].active).length : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&display=swap');
        *{box-sizing:border-box}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:28px}
        .section{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:24px;margin-bottom:16px}
        .section-title{font-size:14px;font-weight:600;color:#0F172A;margin-bottom:16px}
        .invite-row{display:grid;grid-template-columns:1fr 1fr auto auto;gap:10px;align-items:end}
        label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
        input,select{width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;color:#0F172A;outline:none;transition:border-color .15s;background:white}
        input:focus,select:focus{border-color:#0F172A}
        .invite-btn{padding:10px 18px;background:#0F172A;color:white;border-radius:8px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;white-space:nowrap;height:42px;transition:background .15s}
        .invite-btn:hover{background:#1E293B}
        .invite-btn.sent{background:#10B981}
        .invite-btn:disabled{opacity:.6;cursor:not-allowed}
        .error-msg{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:8px 12px;font-size:12px;color:#DC2626;margin-top:8px}
        .link-box{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px 14px;margin-top:14px}
        .link-label{font-size:11px;font-weight:600;color:#166534;margin-bottom:6px}
        .link-row{display:flex;align-items:center;gap:8px}
        .link-url{font-size:12px;color:#14532D;font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:white;border:1px solid #BBF7D0;border-radius:6px;padding:6px 10px}
        .copy-btn{padding:6px 12px;background:#16A34A;color:white;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap}
        .copy-btn:hover{background:#15803D}
        .link-note{font-size:11px;color:#166534;margin-top:6px;opacity:.7}

        /* Staff rows */
        .staff-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #F8FAFC}
        .staff-row:last-child{border-bottom:none}
        .avatar{width:36px;height:36px;border-radius:50%;background:#F1F5F9;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#64748B;flex-shrink:0}
        .staff-info{flex:1}
        .staff-name{font-size:14px;font-weight:500;color:#0F172A}
        .staff-email{font-size:12px;color:#94A3B8;margin-top:1px}
        .role-badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;text-transform:capitalize;white-space:nowrap}
        .schedule-btn{padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;font-weight:500;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:5px;transition:all .15s;white-space:nowrap}
        .schedule-btn:hover{border-color:#0EA5E9;color:#0EA5E9;background:#F0F9FF}
        .schedule-btn.has-schedule{border-color:#10B981;color:#10B981;background:#F0FDF4}

        .invite-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F8FAFC}
        .invite-item:last-child{border-bottom:none}
        .invite-email{font-size:13px;color:#64748B;flex:1}
        .pending-badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;background:#FEF3C7;color:#92400E}
        .empty{text-align:center;padding:24px;color:#CBD5E1;font-size:13px}

        /* Schedule slide-out panel */
        .overlay{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:40;backdrop-filter:blur(2px);animation:fadeIn .18s ease}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .panel{position:fixed;right:0;top:0;bottom:0;width:420px;background:white;z-index:50;box-shadow:-8px 0 40px rgba(0,0,0,.12);display:flex;flex-direction:column;animation:slideIn .22s cubic-bezier(.22,1,.36,1)}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .panel-header{padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;flex-shrink:0}
        .panel-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A}
        .panel-sub{font-size:12px;color:#94A3B8;margin-top:3px}
        .panel-close{position:absolute;top:18px;right:20px;width:28px;height:28px;border-radius:50%;background:#F1F5F9;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;color:#64748B;transition:background .12s}
        .panel-close:hover{background:#E2E8F0}
        .panel-body{flex:1;overflow-y:auto;padding:20px 24px}
        .panel-footer{padding:16px 24px;border-top:1px solid #F1F5F9;flex-shrink:0}

        /* Day rows */
        .day-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F8FAFC}
        .day-row:last-child{border-bottom:none}
        .day-toggle{display:flex;align-items:center;gap:8px;min-width:60px;cursor:pointer;user-select:none}
        .toggle-track{width:34px;height:18px;border-radius:9px;background:#E2E8F0;position:relative;transition:background .15s;flex-shrink:0}
        .toggle-track.on{background:#0EA5E9}
        .toggle-thumb{width:14px;height:14px;border-radius:50%;background:white;position:absolute;top:2px;left:2px;transition:transform .15s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
        .toggle-track.on .toggle-thumb{transform:translateX(16px)}
        .day-label{font-size:13px;font-weight:600;color:#0F172A;width:32px}
        .day-label.off{color:#CBD5E1}
        .time-fields{display:flex;align-items:center;gap:8px;flex:1}
        .time-select{padding:6px 8px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0F172A;background:white;cursor:pointer;outline:none;flex:1;transition:border-color .15s}
        .time-select:focus{border-color:#0EA5E9}
        .time-select:disabled{opacity:.35;cursor:not-allowed}
        .time-sep{font-size:11px;color:#CBD5E1;flex-shrink:0}

        .schedule-summary{background:#F8FAFC;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#64748B}
        .schedule-summary strong{color:#0F172A}

        .save-btn{width:100%;padding:11px;background:#0F172A;color:white;border-radius:9px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:background .15s}
        .save-btn:hover{background:#1E293B}
        .save-btn.saved{background:#10B981}
        .save-btn:disabled{opacity:.6;cursor:not-allowed}
      `}</style>

      <div className="page-title">Team</div>
      <div className="page-sub">Manage your clinic staff and send invitations</div>

      {/* Invite form */}
      <div className="section">
        <div className="section-title">Invite a team member</div>
        <div className="invite-row">
          <div><label>Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="staff@clinic.com" /></div>
          <div><label>Name (optional)</label>
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Dr. Smith" /></div>
          <div><label>Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select></div>
          <button className={`invite-btn ${sent ? 'sent' : ''}`} onClick={sendInvite} disabled={sending}>
            {sending ? '...' : sent ? 'Sent!' : 'Send invite'}
          </button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {inviteLink && (
          <div className="link-box">
            <div className="link-label">Share this link with your staff member</div>
            <div className="link-row">
              <div className="link-url">{inviteLink}</div>
              <button className="copy-btn" onClick={copyLink}>Copy link</button>
            </div>
            <div className="link-note">Expires in 7 days · Invite email sent</div>
          </div>
        )}
      </div>

      {/* Active staff */}
      <div className="section">
        <div className="section-title">Active staff ({staff.length})</div>
        {loading ? <div className="empty">Loading...</div> : staff.length === 0 ? (
          <div className="empty">No staff members yet</div>
        ) : staff.map(s => (
          <div key={s.id} className="staff-row">
            <div className="avatar">{s.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div className="staff-info">
              <div className="staff-name">{s.full_name}</div>
              <div className="staff-email">{s.email}</div>
            </div>
            <span className="role-badge" style={{ background: `${ROLE_COLOR[s.role]}18`, color: ROLE_COLOR[s.role] }}>{s.role}</span>
            {(s.role === 'dentist' || s.role === 'hygienist') && (
              <button
                className="schedule-btn"
                onClick={() => openSchedule(s)}
              >
                🗓 Set schedule
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="section">
          <div className="section-title">Pending invites ({invites.length})</div>
          {invites.map(inv => (
            <div key={inv.id} className="invite-item">
              <div className="invite-email">{inv.email}{inv.full_name ? ` — ${inv.full_name}` : ''}</div>
              <span className="role-badge" style={{ background: `${ROLE_COLOR[inv.role]}18`, color: ROLE_COLOR[inv.role] }}>{inv.role}</span>
              <span className="pending-badge">Pending</span>
            </div>
          ))}
        </div>
      )}

      {/* Schedule panel */}
      {scheduleFor && (
        <>
          <div className="overlay" onClick={closeSchedule} />
          <div className="panel">
            <div className="panel-header" style={{ position: 'relative' }}>
              <div className="panel-title">{scheduleFor.full_name}</div>
              <div className="panel-sub">{scheduleFor.role.charAt(0).toUpperCase() + scheduleFor.role.slice(1)} · schedule &amp; time off</div>
              <button className="panel-close" onClick={closeSchedule}>✕</button>
              <div style={{ display:'flex', gap:4, background:'#F8FAFC', borderRadius:8, padding:3, marginTop:12 }}>
                {(['hours','daysoff'] as const).map(t => (
                  <button key={t} onClick={() => setPanelTab(t)}
                    style={{ flex:1, padding:'6px 8px', border:'none', borderRadius:6, fontSize:12, fontWeight:500,
                      fontFamily:"'DM Sans',sans-serif", cursor:'pointer',
                      background: panelTab === t ? 'white' : 'none',
                      color: panelTab === t ? '#0F172A' : '#94A3B8',
                      boxShadow: panelTab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                    }}>
                    {t === 'hours' ? 'Working hours' : 'Days off'}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-body">
              {/* Working hours tab */}
              {panelTab === 'hours' && (scheduleLoading ? (
                <div className="empty">Loading schedule...</div>
              ) : (
                <>
                  <div className="schedule-summary">
                    <strong>{activeDays} working {activeDays === 1 ? 'day' : 'days'}</strong> per week configured.
                    {activeDays === 0 && ' Toggle days on to add availability.'}
                  </div>

                  {DAYS.map(d => {
                    const day = schedule[d.num]
                    return (
                      <div key={d.num} className="day-row">
                        <div className="day-toggle" onClick={() => toggleDay(d.num)}>
                          <div className={`toggle-track ${day.active ? 'on' : ''}`}>
                            <div className="toggle-thumb" />
                          </div>
                          <span className={`day-label ${day.active ? '' : 'off'}`}>{d.label}</span>
                        </div>

                        <div className="time-fields">
                          <select
                            className="time-select"
                            value={day.start}
                            disabled={!day.active}
                            onChange={e => setTime(d.num, 'start', e.target.value)}
                          >
                            {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                          </select>
                          <span className="time-sep">to</span>
                          <select
                            className="time-select"
                            value={day.end}
                            disabled={!day.active}
                            onChange={e => setTime(d.num, 'end', e.target.value)}
                          >
                            {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </>
              ))}

              {/* Days off tab */}
              {panelTab === 'daysoff' && (
                <div>
                  {/* Lunch break */}
                  <div style={{ background:'#F8FAFC', borderRadius:10, padding:14, marginBottom:14 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#0F172A' }}>Lunch break</div>
                        <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>No slots offered during this window</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }} onClick={() => setLunchEnabled(v => !v)}>
                        <div style={{ width:34, height:18, borderRadius:9, background: lunchEnabled ? '#0EA5E9' : '#E2E8F0', position:'relative', transition:'background .2s' }}>
                          <div style={{ width:14, height:14, borderRadius:'50%', background:'white', position:'absolute', top:2, left:2, transition:'transform .2s', transform: lunchEnabled ? 'translateX(16px)' : 'none', boxShadow:'0 1px 3px rgba(0,0,0,.15)' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <select disabled={!lunchEnabled} value={lunchStart} onChange={e => setLunchStart(e.target.value)}
                        style={{ flex:1, padding:'6px 8px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:12, fontFamily:"'DM Sans',sans-serif", background:'white', opacity: lunchEnabled ? 1 : 0.4 }}>
                        {LUNCH_HOURS_TEAM.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                      <span style={{ fontSize:11, color:'#CBD5E1' }}>to</span>
                      <select disabled={!lunchEnabled} value={lunchEnd} onChange={e => setLunchEnd(e.target.value)}
                        style={{ flex:1, padding:'6px 8px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:12, fontFamily:"'DM Sans',sans-serif", background:'white', opacity: lunchEnabled ? 1 : 0.4 }}>
                        {LUNCH_HOURS_TEAM.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                      <button onClick={saveProvLunch} disabled={lunchSaving}
                        style={{ padding:'6px 12px', background: lunchSaved ? '#10B981' : '#0F172A', color:'white', border:'none', borderRadius:7, fontSize:12, fontFamily:"'DM Sans',sans-serif", cursor:'pointer', whiteSpace:'nowrap' }}>
                        {lunchSaving ? '...' : lunchSaved ? '✓' : 'Save'}
                      </button>
                    </div>
                  </div>

                  {/* Exceptions list */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#0F172A' }}>Days off</div>
                    <button onClick={() => setAddingExc(true)}
                      style={{ padding:'5px 12px', border:'1.5px dashed #E2E8F0', borderRadius:7, fontSize:12, color:'#94A3B8', background:'white', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                      + Add time off
                    </button>
                  </div>
                  {provExceptions.length === 0
                    ? <div style={{ fontSize:12, color:'#CBD5E1', textAlign:'center', padding:'20px 0' }}>No days blocked in the next 90 days</div>
                    : provExceptions.map(e => (
                      <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #F8FAFC' }}>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#0F172A', minWidth:90 }}>
                          {new Date(e.exception_date+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric',weekday:'short'})}
                        </span>
                        <span style={{ fontSize:12, color:'#64748B', flex:1 }}>{e.reason || 'Day off'}</span>
                        <button onClick={() => removeProvException(e.id)}
                          style={{ width:22, height:22, borderRadius:'50%', background:'#F8FAFC', border:'none', cursor:'pointer', fontSize:11, color:'#94A3B8' }}>✕</button>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <div className="panel-footer">
              {panelTab === 'hours' && (
                <button className={`save-btn ${scheduleSaved ? 'saved' : ''}`} onClick={saveSchedule} disabled={scheduleSaving || scheduleLoading}>
                  {scheduleSaving ? 'Saving...' : scheduleSaved ? '✓ Schedule saved' : 'Save schedule'}
                </button>
              )}
            </div>

            {/* Add exception modal for provider */}
            {addingExc && (
              <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.45)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
                onClick={e => e.target === e.currentTarget && closeExcModal()}>
                <div style={{ background:'white', borderRadius:14, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.18)', display:'flex', flexDirection:'column', maxHeight:'85vh' }}>
                  <div style={{ padding:'22px 24px 14px' }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:'#0F172A', marginBottom:4 }}>Add time off — {scheduleFor.full_name}</div>
                    <div style={{ fontSize:12, color:'#94A3B8', marginBottom:14 }}>Block dates so no appointments are offered.</div>
                    <div style={{ display:'flex', gap:4, background:'#F8FAFC', borderRadius:8, padding:3 }}>
                      {([['single','Single day'],['range','Range'],['holidays','Stat holidays']] as ['single'|'range'|'holidays', string][]).map(([t,label]) => (
                        <button key={t} onClick={() => setExcType(t)}
                          style={{ flex:1, padding:'6px 4px', border:'none', borderRadius:6, fontSize:11, fontWeight:500,
                            fontFamily:"'DM Sans',sans-serif", cursor:'pointer', textAlign:'center',
                            background: excType === t ? 'white' : 'none', color: excType === t ? '#0F172A' : '#94A3B8',
                            boxShadow: excType === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding:'0 24px', overflowY:'auto', flex:1 }}>
                    {excType === 'single' && (
                      <>
                        <div style={{ marginBottom:12 }}>
                          <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#64748B', marginBottom:5 }}>Date</label>
                          <input type="date" value={excDate} min={new Date().toISOString().slice(0,10)} onChange={e => setExcDate(e.target.value)}
                            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:'none' }} />
                        </div>
                        <div style={{ marginBottom:12 }}>
                          <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#64748B', marginBottom:5 }}>Reason (optional)</label>
                          <input value={excReason} onChange={e => setExcReason(e.target.value)} placeholder="e.g. Vacation, Personal"
                            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:'none' }} />
                        </div>
                      </>
                    )}
                    {excType === 'range' && (
                      <>
                        <div style={{ marginBottom:12 }}>
                          <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#64748B', marginBottom:5 }}>Date range</label>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            <input type="date" value={excDate} min={new Date().toISOString().slice(0,10)} onChange={e => setExcDate(e.target.value)}
                              style={{ padding:'9px 10px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:'none' }} />
                            <input type="date" value={excEndDate} min={excDate || new Date().toISOString().slice(0,10)} onChange={e => setExcEndDate(e.target.value)}
                              style={{ padding:'9px 10px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:'none' }} />
                          </div>
                        </div>
                        <div style={{ marginBottom:12 }}>
                          <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#64748B', marginBottom:5 }}>Reason (optional)</label>
                          <input value={excReason} onChange={e => setExcReason(e.target.value)} placeholder="e.g. Vacation"
                            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:'none' }} />
                        </div>
                      </>
                    )}
                    {excType === 'holidays' && (
                      <div style={{ paddingBottom:8 }}>
                        {TEAM_STAT_HOLIDAYS.filter(h => h.date >= new Date().toISOString().slice(0,10)).map(h => {
                          const taken = provExceptions.some(e => e.exception_date === h.date)
                          const checked = selHolidays.includes(h.date)
                          return (
                            <div key={h.date} onClick={() => !taken && (checked ? setSelHolidays(p => p.filter(d => d !== h.date)) : setSelHolidays(p => [...p, h.date]))}
                              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #F8FAFC', cursor: taken ? 'not-allowed' : 'pointer', opacity: taken ? 0.4 : 1 }}>
                              <div style={{ width:16, height:16, borderRadius:4, border:'1.5px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'center', background: checked ? '#0EA5E9' : 'white', borderColor: checked ? '#0EA5E9' : '#E2E8F0', flexShrink:0 }}>
                                {checked && <span style={{ fontSize:10, color:'white' }}>✓</span>}
                              </div>
                              <span style={{ fontSize:13, color:'#0F172A', flex:1 }}>{h.name}</span>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#94A3B8' }}>
                                {new Date(h.date+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric'})}
                              </span>
                              {taken && <span style={{ fontSize:10, color:'#10B981', fontWeight:600 }}>added</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ padding:'14px 24px', borderTop:'1px solid #F1F5F9', display:'flex', gap:8, flexShrink:0 }}>
                    <button onClick={closeExcModal}
                      style={{ flex:1, padding:9, border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, color:'#64748B', background:'white', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
                    <button
                      disabled={excSaving || (excType==='single' && !excDate) || (excType==='range' && (!excDate||!excEndDate)) || (excType==='holidays' && !selHolidays.length)}
                      onClick={() => excType==='single' ? addProvException() : excType==='range' ? addProvRange() : addProvHolidays()}
                      style={{ flex:2, padding:9, background:'#0F172A', color:'white', borderRadius:8, fontSize:13, fontWeight:500, border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif', opacity: excSaving ? 0.5 : 1" }}>
                      {excSaving ? 'Saving...' : excType==='single' ? 'Block this day' : excType==='range' ? 'Block range' : `Add ${selHolidays.length||''} holiday${selHolidays.length!==1?'s':''}`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
