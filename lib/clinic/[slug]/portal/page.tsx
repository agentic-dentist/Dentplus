'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Appointment {
  id: string
  start_time: string
  appointment_type: string
  status: string
  reason: string
  booked_via: string
}

interface PatientInfo {
  full_name: string
  email: string
  phone: string | null
  insurance_provider: string | null
}

const TYPE_COLOR: Record<string, string> = {
  cleaning: '#0EA5E9',
  checkup: '#6366F1',
  filling: '#A78BFA',
  emergency: '#F43F5E',
  consultation: '#F59E0B'
}

export default function PatientPortal({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const [slug, setSlug] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [past, setPast] = useState<Appointment[]>([])
  const [tab, setTab] = useState<'appointments' | 'profile' | 'waiting'>('appointments')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    params.then(p => setSlug(p.slug))
  }, [params])

  useEffect(() => {
    if (!slug) return
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/clinic/${slug}/login?type=patient`); return }

      // Get patient account
      const { data: account } = await supabase
        .from('patient_accounts')
        .select('patient_id, clinic_id, clinics(name)')
        .eq('auth_id', user.id)
        .single()

      if (!account) { router.push(`/clinic/${slug}`); return }

      const clinic = Array.isArray(account.clinics) ? account.clinics[0] : account.clinics
      setClinicId(account.clinic_id)
      setClinicName((clinic as { name: string })?.name || '')

      // Get patient info
      const { data: patient } = await supabase
        .from('patients')
        .select('full_name, email, phone, insurance_provider')
        .eq('id', account.patient_id)
        .single()

      setPatientInfo(patient)

      // Get appointments
      const now = new Date().toISOString()
      const { data: upcomingData } = await supabase
        .from('appointments')
        .select('id, start_time, appointment_type, status, reason, booked_via')
        .eq('clinic_id', account.clinic_id)
        .eq('patient_id', account.patient_id)
        .eq('status', 'scheduled')
        .gte('start_time', now)
        .order('start_time')
        .limit(5)

      const { data: pastData } = await supabase
        .from('appointments')
        .select('id, start_time, appointment_type, status, reason, booked_via')
        .eq('clinic_id', account.clinic_id)
        .eq('patient_id', account.patient_id)
        .lt('start_time', now)
        .order('start_time', { ascending: false })
        .limit(10)

      setUpcoming(upcomingData || [])
      setPast(pastData || [])
      setLoading(false)
    }
    init()
  }, [slug])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
    })

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push(`/clinic/${slug}`)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F8FAFC; }

        .shell { max-width: 680px; margin: 0 auto; padding: 0 0 80px; min-height: 100vh; }

        .topbar {
          background: white; border-bottom: 1px solid #E2E8F0;
          padding: 16px 24px; display: flex; align-items: center;
          justify-content: space-between; position: sticky; top: 0; z-index: 10;
        }
        .clinic-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #0F172A; }
        .patient-name { font-size: 13px; color: #64748B; }
        .signout { font-size: 12px; color: #94A3B8; background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .signout:hover { color: #64748B; }

        .hero {
          background: #0F172A; padding: 28px 24px; color: white;
        }
        .hero-greeting { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .hero-sub { font-size: 13px; color: rgba(148,163,184,0.8); margin-bottom: 20px; }
        .book-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #0EA5E9; color: white; padding: 11px 20px;
          border-radius: 10px; font-size: 14px; font-weight: 500;
          text-decoration: none; transition: background 0.15s;
          font-family: 'DM Sans', sans-serif; border: none; cursor: pointer;
        }
        .book-btn:hover { background: #0284C7; }

        .tabs { display: flex; border-bottom: 1px solid #E2E8F0; background: white; padding: 0 24px; }
        .tab-btn { padding: 14px 16px; font-size: 13px; font-weight: 500; color: #94A3B8; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; margin-bottom: -1px; }
        .tab-btn.active { color: #0F172A; border-bottom-color: #0EA5E9; }

        .content { padding: 24px; }

        .section-title { font-size: 12px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: #94A3B8; margin-bottom: 12px; }

        .apt-card {
          background: white; border-radius: 12px; border: 1px solid #E2E8F0;
          padding: 16px 18px; margin-bottom: 10px;
          display: flex; align-items: center; gap: 12px;
        }
        .apt-bar { width: 3px; height: 40px; border-radius: 2px; flex-shrink: 0; }
        .apt-info { flex: 1; }
        .apt-type { font-size: 14px; font-weight: 500; color: #0F172A; text-transform: capitalize; }
        .apt-time { font-size: 12px; color: #64748B; margin-top: 2px; }
        .apt-reason { font-size: 11px; color: #94A3B8; margin-top: 2px; }
        .apt-badge { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
        .badge-upcoming { background: #EFF6FF; color: #0EA5E9; }
        .badge-past { background: #F8FAFC; color: #CBD5E1; }
        .badge-cancelled { background: #FEF2F2; color: #F87171; }

        .profile-card { background: white; border-radius: 12px; border: 1px solid #E2E8F0; padding: 20px; margin-bottom: 12px; }
        .profile-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #F8FAFC; }
        .profile-row:last-child { border-bottom: none; }
        .profile-label { font-size: 12px; color: #94A3B8; font-weight: 500; }
        .profile-value { font-size: 14px; color: #0F172A; }

        .empty { text-align: center; padding: 40px 20px; color: #CBD5E1; font-size: 13px; }
        .empty-icon { font-size: 28px; margin-bottom: 8px; opacity: 0.5; }

        .waitlist-card { background: white; border-radius: 12px; border: 1px solid #E2E8F0; padding: 24px; text-align: center; }
        .waitlist-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
        .waitlist-sub { font-size: 13px; color: #64748B; margin-bottom: 20px; line-height: 1.6; }
        .waitlist-btn { display: inline-block; padding: 10px 20px; background: #0F172A; color: white; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; }
      `}</style>

      <div className="shell">
        <div className="topbar">
          <div>
            <div className="clinic-name">{clinicName}</div>
            {patientInfo && <div className="patient-name">{patientInfo.full_name}</div>}
          </div>
          <button className="signout" onClick={signOut}>Sign out</button>
        </div>

        <div className="hero">
          <div className="hero-greeting">
            Hello{patientInfo ? `, ${patientInfo.full_name.split(' ')[0]}` : ''} 👋
          </div>
          <div className="hero-sub">
            {upcoming.length > 0
              ? `You have ${upcoming.length} upcoming appointment${upcoming.length > 1 ? 's' : ''}`
              : 'No upcoming appointments'}
          </div>
          <button className="book-btn" onClick={() => router.push(`/clinic/${slug}/book`)}>
            Book an appointment
          </button>
        </div>

        <div className="tabs">
          {(['appointments', 'profile', 'waiting'] as const).map(t => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'appointments' ? 'Appointments' : t === 'profile' ? 'My info' : 'Waitlist'}
            </button>
          ))}
        </div>

        <div className="content">
          {loading ? (
            <div className="empty"><div className="empty-icon">⏳</div>Loading...</div>
          ) : tab === 'appointments' ? (
            <>
              {upcoming.length > 0 && (
                <>
                  <div className="section-title">Upcoming</div>
                  {upcoming.map(apt => (
                    <div key={apt.id} className="apt-card">
                      <div className="apt-bar" style={{ background: TYPE_COLOR[apt.appointment_type] || '#E2E8F0' }} />
                      <div className="apt-info">
                        <div className="apt-type">{apt.appointment_type}</div>
                        <div className="apt-time">{formatTime(apt.start_time)}</div>
                        {apt.reason && <div className="apt-reason">{apt.reason}</div>}
                      </div>
                      <span className="apt-badge badge-upcoming">Scheduled</span>
                    </div>
                  ))}
                </>
              )}

              <div className="section-title" style={{ marginTop: upcoming.length > 0 ? '24px' : '0' }}>Past visits</div>
              {past.length === 0 ? (
                <div className="empty"><div className="empty-icon">📋</div>No past visits yet</div>
              ) : past.map(apt => (
                <div key={apt.id} className="apt-card">
                  <div className="apt-bar" style={{ background: apt.status === 'cancelled' ? '#F87171' : '#E2E8F0' }} />
                  <div className="apt-info">
                    <div className="apt-type">{apt.appointment_type}</div>
                    <div className="apt-time">{formatTime(apt.start_time)}</div>
                  </div>
                  <span className={`apt-badge ${apt.status === 'cancelled' ? 'badge-cancelled' : 'badge-past'}`}>
                    {apt.status}
                  </span>
                </div>
              ))}
            </>
          ) : tab === 'profile' ? (
            <>
              <div className="section-title">Personal information</div>
              <div className="profile-card">
                {[
                  { label: 'Full name', value: patientInfo?.full_name },
                  { label: 'Email', value: patientInfo?.email },
                  { label: 'Phone', value: patientInfo?.phone || 'Not provided' },
                  { label: 'Insurance', value: patientInfo?.insurance_provider || 'Not on file' },
                ].map(row => (
                  <div key={row.label} className="profile-row">
                    <span className="profile-label">{row.label}</span>
                    <span className="profile-value">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="empty" style={{ padding: '16px', color: '#94A3B8', fontSize: '12px' }}>
                To update your information, please contact the clinic.
              </div>
            </>
          ) : (
            <>
              <div className="section-title">Waiting list</div>
              <div className="waitlist-card">
                <div className="waitlist-title">Get notified of openings</div>
                <div className="waitlist-sub">
                  Join the waiting list and our AI agent will notify you automatically when a slot opens up that matches what you need.
                </div>
                <button className="waitlist-btn" onClick={() => router.push(`/clinic/${slug}/book?waitlist=true`)}>
                  Join waiting list
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
