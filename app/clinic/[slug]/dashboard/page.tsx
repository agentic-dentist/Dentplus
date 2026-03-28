'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClinicUser } from './clinic-context'

interface Appointment {
  id: string
  start_time: string
  appointment_type: string
  reason: string
  status: string
  booked_via: string
  patients: { full_name: string; phone: string } | null
}

const TYPE_COLOR: Record<string, string> = {
  cleaning:     '#00C4A7',
  checkup:      '#4F46E5',
  filling:      '#8B5CF6',
  emergency:    '#F43F5E',
  consultation: '#F59E0B',
  whitening:    '#06B6D4',
  extraction:   '#EF4444',
  xray:         '#64748B',
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = performance.now()
    const animate = (now: number) => {
      const p    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(ease * target))
      if (p < 1) raf.current = requestAnimationFrame(animate)
    }
    raf.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf.current)
  }, [target])
  return value
}

export default function DashboardPage() {
  const { clinicId, staffName } = useClinicUser()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [stats, setStats]               = useState({ today: 0, ai_booked: 0, patients: 0 })
  const [mounted, setMounted]           = useState(false)
  const supabase = createClient()

  const todayCount   = useCountUp(stats.today)
  const aiCount      = useCountUp(stats.ai_booked)
  const patientCount = useCountUp(stats.patients)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!clinicId) return
    const load = async () => {
      const today    = new Date(); today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

      const [{ data: apts }, { data: allApts }, { count }] = await Promise.all([
        supabase.from('appointments')
          .select('*, patients(full_name, phone)')
          .eq('clinic_id', clinicId).eq('status', 'scheduled')
          .gte('start_time', today.toISOString())
          .lt('start_time', tomorrow.toISOString())
          .order('start_time'),
        supabase.from('appointments')
          .select('id, booked_via')
          .eq('clinic_id', clinicId).eq('status', 'scheduled'),
        supabase.from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', clinicId).eq('is_active', true),
      ])

      setAppointments(apts || [])
      const ai = (allApts || []).filter(a => a.booked_via === 'web_agent').length
      setStats({ today: (apts || []).length, ai_booked: ai, patients: count || 0 })
      setLoading(false)
    }
    load()
  }, [clinicId])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-CA', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto',
    })

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const todayLabel = mounted
    ? new Date().toLocaleDateString('en-CA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: 'America/Toronto',
      })
    : ''

  const firstName = staffName ? staffName.split(' ')[0] : ''

  return (
    <>
      <style>{`
        .ov-header       { margin-bottom:32px }
        .ov-greeting     { font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:#0F172A;letter-spacing:-.5px }
        .ov-date         { font-size:13px;color:#94A3B8;margin-top:4px;font-weight:500 }
        .ov-stats        { display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px }
        .ov-stat         { background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:22px 24px;transition:box-shadow .15s }
        .ov-stat:hover   { box-shadow:0 4px 20px rgba(0,0,0,.06) }
        .ov-stat.primary { background:#4F46E5;border-color:#4F46E5 }
        .ov-stat-icon    { width:36px;height:36px;border-radius:10px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:16px }
        .ov-stat.primary .ov-stat-icon { background:rgba(255,255,255,.15) }
        .ov-stat-label   { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:10px }
        .ov-stat.primary .ov-stat-label { color:rgba(255,255,255,.65) }
        .ov-stat-val     { font-family:'Syne',sans-serif;font-size:40px;font-weight:800;color:#0F172A;line-height:1 }
        .ov-stat.primary .ov-stat-val   { color:#FFFFFF }
        .ov-stat-sub     { font-size:12px;color:#94A3B8;margin-top:8px;font-weight:500 }
        .ov-stat.primary .ov-stat-sub   { color:rgba(255,255,255,.6) }
        .ov-ai-pill      { display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;color:white;margin-top:8px }
        .ov-ai-dot       { width:5px;height:5px;border-radius:50%;background:#00C4A7 }
        .ov-grid         { display:grid;grid-template-columns:1fr 320px;gap:16px }
        .ov-card         { background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden }
        .ov-card-head    { padding:16px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between }
        .ov-card-title   { font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#0F172A }
        .ov-card-meta    { font-size:11px;color:#CBD5E1;font-weight:600;letter-spacing:.3px }
        .ov-card-meta.live { color:#00C4A7 }
        .ov-apt-row      { display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid #F8FAFC;transition:background .1s }
        .ov-apt-row:last-child { border-bottom:none }
        .ov-apt-row:hover { background:#FAFAFA }
        .ov-apt-time     { font-size:12px;color:#94A3B8;width:70px;flex-shrink:0;font-weight:500 }
        .ov-apt-bar      { width:3px;height:36px;border-radius:2px;flex-shrink:0 }
        .ov-apt-info     { flex:1;min-width:0 }
        .ov-apt-name     { font-size:14px;font-weight:600;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
        .ov-apt-type     { font-size:12px;color:#94A3B8;margin-top:2px;text-transform:capitalize }
        .ov-apt-tag      { font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;flex-shrink:0;letter-spacing:.3px }
        .ov-tag-ai       { background:#EEF2FF;color:#4F46E5 }
        .ov-tag-manual   { background:#F8FAFC;color:#CBD5E1 }
        .ov-feed-item    { padding:13px 20px;border-bottom:1px solid #F8FAFC;display:flex;gap:10px;align-items:flex-start }
        .ov-feed-item:last-child { border-bottom:none }
        .ov-feed-dot     { width:7px;height:7px;border-radius:50%;margin-top:4px;flex-shrink:0 }
        .ov-feed-text    { font-size:12px;color:#475569;line-height:1.5 }
        .ov-feed-text strong { color:#0F172A;font-weight:600 }
        .ov-feed-time    { font-size:11px;color:#CBD5E1;margin-top:3px;font-weight:500 }
        .ov-empty        { padding:48px 20px;text-align:center;color:#CBD5E1;font-size:13px }
        .ov-empty-icon   { font-size:28px;margin-bottom:8px;opacity:.5 }
        .ov-quick-links  { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:28px }
        .ov-quick-btn    { background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:all .12s;text-decoration:none }
        .ov-quick-btn:hover { border-color:#4F46E5;box-shadow:0 2px 12px rgba(79,70,229,.08) }
        .ov-quick-icon   { font-size:18px;width:36px;height:36px;border-radius:9px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;flex-shrink:0 }
        .ov-quick-label  { font-size:13px;font-weight:600;color:#0F172A }
        .ov-quick-sub    { font-size:11px;color:#94A3B8;margin-top:1px }
      `}</style>

      {/* Header */}
      <div className="ov-header">
        <div className="ov-greeting">
          {greeting()}{firstName ? `, ${firstName}` : ''} 👋
        </div>
        <div className="ov-date">{todayLabel}</div>
      </div>

      {/* Stat cards */}
      <div className="ov-stats">
        <div className="ov-stat primary">
          <div className="ov-stat-icon">📅</div>
          <div className="ov-stat-label">Today&apos;s appointments</div>
          <div className="ov-stat-val">{loading ? '—' : todayCount}</div>
          <div className="ov-stat-sub">Scheduled for today</div>
        </div>

        <div className="ov-stat">
          <div className="ov-stat-icon">⬡</div>
          <div className="ov-stat-label">Booked by AI</div>
          <div className="ov-stat-val">{aiCount}</div>
          {aiCount > 0
            ? <div className="ov-ai-pill" style={{background:'#EEF2FF',color:'#4F46E5'}}><span className="ov-ai-dot" />AI powered</div>
            : <div className="ov-stat-sub">Via web agent</div>
          }
        </div>

        <div className="ov-stat">
          <div className="ov-stat-icon">◈</div>
          <div className="ov-stat-label">Total patients</div>
          <div className="ov-stat-val">{patientCount}</div>
          <div className="ov-stat-sub">Active at this clinic</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="ov-grid">
        {/* Today's schedule */}
        <div className="ov-card">
          <div className="ov-card-head">
            <div className="ov-card-title">Today&apos;s schedule</div>
            <div className="ov-card-meta">
              {mounted ? new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }) : ''}
            </div>
          </div>
          {loading ? (
            <div className="ov-empty"><div className="ov-empty-icon">⏳</div>Loading…</div>
          ) : appointments.length === 0 ? (
            <div className="ov-empty">
              <div className="ov-empty-icon">📅</div>
              No appointments scheduled for today
            </div>
          ) : appointments.map(apt => (
            <div key={apt.id} className="ov-apt-row">
              <div className="ov-apt-time">{formatTime(apt.start_time)}</div>
              <div className="ov-apt-bar" style={{ background: TYPE_COLOR[apt.appointment_type] || '#E2E8F0' }} />
              <div className="ov-apt-info">
                <div className="ov-apt-name">{apt.patients?.full_name || 'Unknown patient'}</div>
                <div className="ov-apt-type">{apt.appointment_type}{apt.reason ? ` · ${apt.reason}` : ''}</div>
              </div>
              <span className={`ov-apt-tag ${apt.booked_via === 'web_agent' ? 'ov-tag-ai' : 'ov-tag-manual'}`}>
                {apt.booked_via === 'web_agent' ? '⬡ AI' : 'Manual'}
              </span>
            </div>
          ))}
        </div>

        {/* Agent activity */}
        <div className="ov-card">
          <div className="ov-card-head">
            <div className="ov-card-title">Agent activity</div>
            <div className="ov-card-meta live">● LIVE</div>
          </div>
          {appointments.length === 0 ? (
            <div className="ov-empty">
              <div className="ov-empty-icon">⬡</div>
              No activity today
            </div>
          ) : appointments.slice(0, 8).map(apt => (
            <div key={apt.id} className="ov-feed-item">
              <div className="ov-feed-dot" style={{ background: apt.booked_via === 'web_agent' ? '#4F46E5' : '#E2E8F0' }} />
              <div>
                <div className="ov-feed-text">
                  <strong>{apt.patients?.full_name || 'Unknown'}</strong>
                  {apt.booked_via === 'web_agent' ? ' booked via AI' : ' booked manually'}
                  {` · ${apt.appointment_type}`}
                </div>
                <div className="ov-feed-time">{formatTime(apt.start_time)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
