'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Appointment {
  id: string
  start_time: string
  end_time: string
  appointment_type: string
  reason: string
  status: string
  booked_via: string
  patients: { full_name: string; phone: string } | null
}

const CLINIC_ID = process.env.NEXT_PUBLIC_DEMO_CLINIC_ID!

const TYPE_COLOR: Record<string, string> = {
  cleaning: '#0EA5E9',
  checkup: '#6366F1',
  filling: '#A78BFA',
  emergency: '#F43F5E',
  consultation: '#F59E0B'
}

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = performance.now()
    const animate = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(ease * target))
      if (p < 1) raf.current = requestAnimationFrame(animate)
    }
    raf.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return value
}

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ today: 0, ai_booked: 0, patients: 0 })
  const [mounted, setMounted] = useState(false)

  const todayCount = useCountUp(stats.today)
  const aiCount = useCountUp(stats.ai_booked)
  const patientCount = useCountUp(stats.patients)

  useEffect(() => {
    setMounted(true)
    const db = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    db.from('appointments')
      .select('*, patients(full_name, phone)')
      .eq('clinic_id', CLINIC_ID)
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .order('start_time')
      .then(({ data }) => {
        setAppointments(data || [])
        setStats(s => ({ ...s, today: (data || []).length }))
        setLoading(false)
      })

    db.from('appointments')
      .select('id, booked_via', { count: 'exact' })
      .eq('clinic_id', CLINIC_ID).eq('status', 'scheduled')
      .then(({ data }) => {
        const ai = (data || []).filter(a => a.booked_via === 'web_agent').length
        setStats(s => ({ ...s, ai_booked: ai }))
      })

    db.from('patients')
      .select('id', { count: 'exact' })
      .eq('clinic_id', CLINIC_ID).eq('is_active', true)
      .then(({ count }) => setStats(s => ({ ...s, patients: count || 0 })))
  }, [])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-CA', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
    })

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const todayLabel = mounted ? new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }) : ''

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        .header { margin-bottom: 28px; }
        .greeting {
          font-family: 'Syne', sans-serif;
          font-size: 24px; font-weight: 700;
          color: #0F172A; letter-spacing: -0.4px;
        }
        .greeting-sub { font-size: 13px; color: #94A3B8; margin-top: 3px; }

        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 28px; }

        .stat-card {
          background: white; border-radius: 12px;
          padding: 20px 22px;
          border: 1px solid #E2E8F0;
          position: relative; overflow: hidden;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .stat-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); border-color: #CBD5E1; }

        .stat-card .accent-line {
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
        }

        .stat-label {
          font-size: 10.5px; font-weight: 600; letter-spacing: 1px;
          text-transform: uppercase; color: #94A3B8; margin-bottom: 10px;
        }
        .stat-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 36px; font-weight: 500;
          color: #0F172A; letter-spacing: -1px; line-height: 1;
          margin-bottom: 6px;
        }
        .stat-value.highlight { color: #0EA5E9; }
        .stat-sub { font-size: 12px; color: #94A3B8; }
        .stat-pill {
          display: inline-flex; align-items: center; gap: 4px;
          background: #EFF6FF; border-radius: 20px;
          padding: 2px 8px; font-size: 10px; font-weight: 600;
          color: #0EA5E9; margin-top: 4px;
        }

        .grid { display: grid; grid-template-columns: 1fr 300px; gap: 16px; }

        .card {
          background: white; border-radius: 12px;
          border: 1px solid #E2E8F0; overflow: hidden;
        }

        .card-header {
          padding: 14px 20px;
          border-bottom: 1px solid #F1F5F9;
          display: flex; align-items: center; justify-content: space-between;
        }
        .card-title {
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 600; color: #0F172A; letter-spacing: 0.1px;
        }
        .card-meta { font-size: 11px; color: #CBD5E1; letter-spacing: 0.3px; }

        .apt-row {
          display: flex; align-items: center; gap: 12px;
          padding: 13px 20px; border-bottom: 1px solid #F8FAFC;
          transition: background 0.12s;
        }
        .apt-row:last-child { border-bottom: none; }
        .apt-row:hover { background: #FAFBFC; }

        .apt-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: #94A3B8; width: 64px; flex-shrink: 0;
          letter-spacing: 0.3px;
        }
        .apt-bar { width: 3px; height: 34px; border-radius: 2px; flex-shrink: 0; }
        .apt-info { flex: 1; }
        .apt-name { font-size: 14px; font-weight: 500; color: #0F172A; }
        .apt-type { font-size: 11px; color: #94A3B8; text-transform: capitalize; margin-top: 1px; }

        .apt-tag {
          font-size: 10px; font-weight: 600; padding: 3px 8px;
          border-radius: 20px; letter-spacing: 0.2px; flex-shrink: 0;
        }
        .tag-ai { background: #EFF6FF; color: #0EA5E9; }
        .tag-manual { background: #F8FAFC; color: #CBD5E1; }

        .feed-item {
          padding: 12px 20px; border-bottom: 1px solid #F8FAFC;
          display: flex; gap: 10px; align-items: flex-start;
        }
        .feed-item:last-child { border-bottom: none; }
        .feed-dot { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
        .feed-text { font-size: 12px; color: #475569; line-height: 1.5; }
        .feed-text strong { color: #0F172A; font-weight: 500; }
        .feed-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; color: #CBD5E1; margin-top: 3px;
        }

        .empty { padding: 40px 20px; text-align: center; color: #CBD5E1; font-size: 13px; }
        .empty-icon { font-size: 26px; margin-bottom: 8px; opacity: 0.6; }
      `}</style>

      <div className="header">
        <div className="greeting">{greeting()} 👋</div>
        <div className="greeting-sub">{todayLabel}</div>
      </div>

      <div className="stats">
        <div className="stat-card">
          <div className="accent-line" style={{ background: '#0EA5E9' }} />
          <div className="stat-label">Today&apos;s appointments</div>
          <div className="stat-value">{loading ? '—' : todayCount}</div>
          <div className="stat-sub">Scheduled for today</div>
        </div>
        <div className="stat-card">
          <div className="accent-line" style={{ background: '#6366F1' }} />
          <div className="stat-label">Booked by AI</div>
          <div className={`stat-value ${aiCount > 0 ? 'highlight' : ''}`}>{aiCount}</div>
          {aiCount > 0
            ? <div className="stat-pill">⬡ AI powered</div>
            : <div className="stat-sub">Via web agent</div>}
        </div>
        <div className="stat-card">
          <div className="accent-line" style={{ background: '#10B981' }} />
          <div className="stat-label">Total patients</div>
          <div className="stat-value">{patientCount}</div>
          <div className="stat-sub">Active at this clinic</div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Today&apos;s schedule</div>
            <div className="card-meta">
              {mounted ? new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : ''}
            </div>
          </div>
          {loading ? (
            <div className="empty"><div className="empty-icon">⏳</div>Loading...</div>
          ) : appointments.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📅</div>
              No appointments today.<br />Open the patient widget to get bookings.
            </div>
          ) : appointments.map(apt => (
            <div key={apt.id} className="apt-row">
              <div className="apt-time">{formatTime(apt.start_time)}</div>
              <div className="apt-bar" style={{ background: TYPE_COLOR[apt.appointment_type] || '#E2E8F0' }} />
              <div className="apt-info">
                <div className="apt-name">{apt.patients?.full_name || 'Unknown'}</div>
                <div className="apt-type">{apt.appointment_type} · {apt.reason || 'No reason'}</div>
              </div>
              <span className={`apt-tag ${apt.booked_via === 'web_agent' ? 'tag-ai' : 'tag-manual'}`}>
                {apt.booked_via === 'web_agent' ? '⬡ AI' : 'Manual'}
              </span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Agent activity</div>
            <div className="card-meta">LIVE</div>
          </div>
          {appointments.length === 0 ? (
            <div className="empty"><div className="empty-icon">⬡</div>No recent activity</div>
          ) : appointments.slice(0, 6).map(apt => (
            <div key={apt.id} className="feed-item">
              <div className="feed-dot" style={{ background: apt.booked_via === 'web_agent' ? '#0EA5E9' : '#E2E8F0' }} />
              <div>
                <div className="feed-text">
                  <strong>{apt.patients?.full_name || 'Unknown'}</strong> booked a {apt.appointment_type}
                  {apt.booked_via === 'web_agent' ? ' via AI' : ' manually'}
                </div>
                <div className="feed-time">{formatTime(apt.start_time)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
