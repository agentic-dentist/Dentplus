'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Appointment {
  id: string
  start_time: string
  end_time: string
  appointment_type: string
  reason: string
  status: string
  booked_via: string
  patients: { full_name: string } | null
}

const CLINIC_ID = process.env.NEXT_PUBLIC_DEMO_CLINIC_ID!

const TYPE_COLOR: Record<string, string> = {
  cleaning: '#0EA5E9',
  checkup: '#6366F1',
  filling: '#A78BFA',
  emergency: '#F43F5E',
  consultation: '#F59E0B'
}

export default function SchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  const getWeekDays = (offset: number) => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7)
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }

  const days = getWeekDays(weekOffset)
  const weekStart = days[0]
  const weekEnd = days[4]

  useEffect(() => {
    const db = createClient()
    const start = new Date(weekStart)
    start.setHours(0, 0, 0, 0)
    const end = new Date(weekEnd)
    end.setHours(23, 59, 59, 999)

    // ← KEY FIX: only fetch scheduled appointments
    db.from('appointments')
      .select('*, patients(full_name)')
      .eq('clinic_id', CLINIC_ID)
      .eq('status', 'scheduled')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time')
      .then(({ data }) => {
        setAppointments(data || [])
        setLoading(false)
      })
  }, [weekOffset])

  const aptsForDay = (day: Date) =>
    appointments.filter(apt => {
      const d = new Date(apt.start_time)
      return d.toDateString() === day.toDateString()
    })

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-CA', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
    })

  const weekLabel = `${weekStart.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })} — ${weekEnd.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&display=swap');
        .page-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #0F172A; letter-spacing: -0.3px; margin-bottom: 20px; }
        .week-nav { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .week-btn { width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid #E2E8F0; background: white; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.12s; }
        .week-btn:hover { background: #F8FAFC; }
        .week-label { font-size: 14px; font-weight: 600; color: #0F172A; }
        .today-btn { padding: 6px 12px; border-radius: 8px; border: 1.5px solid #E2E8F0; background: white; font-size: 13px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; color: #475569; transition: background 0.12s; }
        .today-btn:hover { background: #F8FAFC; }
        .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        .day-col { background: white; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; }
        .day-header { padding: 12px 14px; border-bottom: 1px solid #F1F5F9; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; }
        .day-header.today { background: #F0F9FF; }
        .day-name { letter-spacing: 0.5px; }
        .day-num { font-size: 20px; font-weight: 700; color: #0F172A; margin-top: 2px; }
        .day-num.today { color: #0EA5E9; }
        .day-apts { padding: 10px; min-height: 100px; }
        .apt-pill { padding: 8px 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid; }
        .apt-pill-time { font-size: 11px; font-weight: 600; color: #64748B; }
        .apt-pill-name { font-size: 13px; font-weight: 600; color: #0F172A; margin-top: 2px; }
        .apt-pill-type { font-size: 11px; color: #64748B; margin-top: 1px; text-transform: capitalize; }
        .no-apts { font-size: 12px; color: #CBD5E1; text-align: center; padding: 20px 0; }
        .empty { color: #94A3B8; text-align: center; padding: 48px; font-size: 14px; }
      `}</style>

      <div className="page-title">Schedule</div>

      <div className="week-nav">
        <button className="week-btn" onClick={() => setWeekOffset(w => w - 1)}>←</button>
        <button className="week-btn" onClick={() => setWeekOffset(w => w + 1)}>→</button>
        <span className="week-label">{weekLabel}</span>
        <button className="today-btn" onClick={() => setWeekOffset(0)}>Today</button>
      </div>

      {loading ? (
        <div className="empty">Loading...</div>
      ) : (
        <div className="grid">
          {days.map(day => {
            const isToday = day.toDateString() === new Date().toDateString()
            const apts = aptsForDay(day)
            return (
              <div key={day.toISOString()} className="day-col">
                <div className={`day-header ${isToday ? 'today' : ''}`}>
                  <div className="day-name">
                    {day.toLocaleDateString('en-CA', { weekday: 'short' })}
                  </div>
                  <div className={`day-num ${isToday ? 'today' : ''}`}>
                    {day.getDate()}
                  </div>
                </div>
                <div className="day-apts">
                  {apts.length === 0 ? (
                    <div className="no-apts">Free</div>
                  ) : (
                    apts.map(apt => (
                      <div
                        key={apt.id}
                        className="apt-pill"
                        style={{
                          background: `${TYPE_COLOR[apt.appointment_type]}12`,
                          borderLeftColor: TYPE_COLOR[apt.appointment_type] || '#94A3B8'
                        }}
                      >
                        <div className="apt-pill-time">{formatTime(apt.start_time)}</div>
                        <div className="apt-pill-name">{apt.patients?.full_name || 'Unknown'}</div>
                        <div className="apt-pill-type">{apt.appointment_type}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
