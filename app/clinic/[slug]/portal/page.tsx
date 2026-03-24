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
  patient_confirmed: boolean
  patient_confirmed_at: string | null
}

interface PatientInfo {
  full_name: string
  email: string
  phone_primary: string | null
  insurance_provider: string | null
  intake_status: string
}

interface WaitlistOffer {
  id: string
  appointment_type: string
  offered_slot_start: string
  offered_slot_end: string
  urgency: string
}

interface Referral {
  id: string
  created_at: string
  specialist_name: string
  specialty: string
  urgency: string
  status: string
  notes: string | null
}

interface Message { role: 'user' | 'assistant'; content: string }

const TYPE_COLOR: Record<string, string> = {
  cleaning: '#0EA5E9', checkup: '#6366F1', filling: '#A78BFA',
  emergency: '#F43F5E', consultation: '#F59E0B'
}

export default function PatientPortal({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [clinicColor, setClinicColor] = useState('#0EA5E9')
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
  const [patientAuthId, setPatientAuthId] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string>('')
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [past, setPast] = useState<Appointment[]>([])
  const [tab, setTab] = useState<'appointments' | 'profile' | 'waiting' | 'referrals'>('appointments')
  const [loading, setLoading] = useState(true)

  // Waitlist state
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  const [wlType, setWlType] = useState('cleaning')
  const [wlUrgency, setWlUrgency] = useState('routine')
  const [wlAnyTime, setWlAnyTime] = useState(true)
  const [wlDays, setWlDays] = useState<string[]>([])
  const [wlTimes, setWlTimes] = useState<string[]>([])
  const [waitlistEntry, setWaitlistEntry] = useState<{ appointment_type: string; urgency: string; created_at: string } | null>(null)

  // Confirmation state
  const [confirming, setConfirming] = useState<string | null>(null)

  // Waitlist offer state
  const [waitlistOffer, setWaitlistOffer] = useState<WaitlistOffer | null>(null)
  const [offerResponding, setOfferResponding] = useState(false)

  const [referrals, setReferrals] = useState<Referral[]>([])

  // Booking panel state
  const [showBooking, setShowBooking] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { params.then(p => setSlug(p.slug)) }, [params])

  useEffect(() => {
    if (!slug) return
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/clinic/${slug}/login?type=patient`); return }
      setPatientAuthId(user.id)

      const { data: account } = await supabase
        .from('patient_accounts')
        .select('patient_id, clinic_id')
        .eq('auth_id', user.id).single()

      if (!account) { router.push(`/clinic/${slug}`); return }
      setClinicId(account.clinic_id)
      setPatientId(account.patient_id)

      // Fetch clinic info separately to avoid join RLS issues
      const [{ data: clinicInfo }, { data: clinicSettings }] = await Promise.all([
        supabase.from('clinics').select('name').eq('id', account.clinic_id).single(),
        supabase.from('clinic_settings').select('primary_color').eq('clinic_id', account.clinic_id).single()
      ])

      setClinicName(clinicInfo?.name || '')
      setClinicColor(clinicSettings?.primary_color || '#0EA5E9')

      const { data: patient } = await supabase
        .from('patients')
        .select('full_name, email, phone_primary, insurance_provider, intake_status')
        .eq('id', account.patient_id).single()

      if (!patient) { router.push(`/clinic/${slug}`); return }
      setPatientInfo(patient)

      const now = new Date().toISOString()
      const [{ data: upcomingData }, { data: pastData }] = await Promise.all([
        supabase.from('appointments').select('id, start_time, appointment_type, status, reason, booked_via, patient_confirmed, patient_confirmed_at')
          .eq('clinic_id', account.clinic_id).eq('patient_id', account.patient_id)
          .eq('status', 'scheduled').gte('start_time', now).order('start_time').limit(5),
        supabase.from('appointments').select('id, start_time, appointment_type, status, reason, booked_via, patient_confirmed, patient_confirmed_at')
          .eq('clinic_id', account.clinic_id).eq('patient_id', account.patient_id)
          .lt('start_time', now).order('start_time', { ascending: false }).limit(10)
      ])
      setUpcoming(upcomingData || [])
      setPast(pastData || [])

      // Check if patient is already on waitlist
      const { data: wlData } = await supabase
        .from('waiting_list')
        .select('appointment_type, urgency, created_at')
        .eq('clinic_id', account.clinic_id)
        .eq('patient_id', account.patient_id)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (wlData) setWaitlistEntry(wlData)

      // Check for active slot offer
      const { data: offerData } = await supabase
        .from('waiting_list')
        .select('id, appointment_type, offered_slot_start, offered_slot_end, urgency')
        .eq('clinic_id', account.clinic_id)
        .eq('patient_id', account.patient_id)
        .eq('status', 'offered')
        .not('offered_slot_start', 'is', null)
        .order('offered_at', { ascending: false })
        .limit(1)
        .single()
      if (offerData) setWaitlistOffer(offerData)

      // Load referrals
      const { data: refData } = await supabase
        .from('referrals')
        .select('id, created_at, specialist_name, specialty, urgency, status, notes')
        .eq('from_clinic_id', account.clinic_id)
        .eq('patient_id', account.patient_id)
        .order('created_at', { ascending: false })
      setReferrals(refData || [])

      setLoading(false)
    }
    init()
  }, [slug])

  const formatTime = (iso: string) => new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
  })

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push(`/clinic/${slug}`)
  }

  const intakeStatus = patientInfo?.intake_status || 'incomplete'

  // ── Waitlist functions ────────────────────────────────────────────────────
  const toggleDay = (day: string) => setWlDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  const toggleTime = (time: string) => setWlTimes(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time])

  const submitWaitlist = async () => {
    if (!patientId || !clinicId) return
    setWaitlistLoading(true)
    setWaitlistError('')

    // Check for duplicate
    const { data: existing } = await supabase
      .from('waiting_list')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('appointment_type', wlType)
      .eq('status', 'waiting')
      .single()

    if (existing) {
      setWaitlistError(`You are already on the waitlist for a ${wlType}.`)
      setWaitlistLoading(false)
      return
    }

    const { data, error } = await supabase.from('waiting_list').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      appointment_type: wlType,
      urgency: wlUrgency,
      any_time: wlAnyTime,
      preferred_days: wlAnyTime ? [] : wlDays,
      preferred_times: wlAnyTime ? [] : wlTimes,
      status: 'waiting',
      priority: wlUrgency === 'urgent' ? 2 : 1
    }).select('appointment_type, urgency, created_at').single()

    if (error || !data) {
      setWaitlistError('Something went wrong. Please try again.')
    } else {
      setWaitlistEntry(data)
      setWaitlistDone(true)
    }
    setWaitlistLoading(false)
  }

  // ── Chat functions ──────────────────────────────────────────────────────
  const openBooking = () => {
    setShowBooking(true)
    if (!chatStarted) startChat()
  }

  const startChat = async () => {
    setChatStarted(true)
    setChatLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        clinicId,
        patientAuthId
      })
    })
    const data = await res.json()
    setMessages([{ role: 'assistant', content: data.message }])
    setChatLoading(false)
  }

  const sendChat = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim()
    if (!text || chatLoading) return
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, clinicId, patientAuthId })
    })
    const data = await res.json()
    setMessages([...newMessages, { role: 'assistant', content: data.message }])
    setChatLoading(false)
  }

  const closeBooking = () => {
    setShowBooking(false)
    // Reload appointments in case something was booked — always filter by patientId
    if (clinicId && patientId) {
      const now = new Date().toISOString()
      supabase.from('appointments').select('id, start_time, appointment_type, status, reason, booked_via, patient_confirmed, patient_confirmed_at')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('status', 'scheduled')
        .gte('start_time', now).order('start_time').limit(5)
        .then(({ data }) => { if (data) setUpcoming(data) })
    }
  }

  const confirmAppointment = async (aptId: string) => {
    setConfirming(aptId)
    await supabase
      .from('appointments')
      .update({ patient_confirmed: true, patient_confirmed_at: new Date().toISOString() })
      .eq('id', aptId)
    setUpcoming(prev => prev.map(a => a.id === aptId ? { ...a, patient_confirmed: true } : a))
    setConfirming(null)
  }

  const acceptOffer = async () => {
    if (!waitlistOffer || !patientId || !clinicId) return
    setOfferResponding(true)

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    // Use API route to handle this server-side with service role
    const res = await fetch('/api/waitlist/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waitlistId: waitlistOffer.id,
        action: 'accept',
        clinicId,
        patientId,
      })
    })
    const data = await res.json()
    if (data.success) {
      setWaitlistOffer(null)
      setWaitlistEntry(null)
      // Reload upcoming appointments
      const now = new Date().toISOString()
      const { data: upcomingData } = await supabase
        .from('appointments')
        .select('id, start_time, appointment_type, status, reason, booked_via, patient_confirmed, patient_confirmed_at')
        .eq('clinic_id', clinicId).eq('patient_id', patientId)
        .eq('status', 'scheduled').gte('start_time', now).order('start_time').limit(5)
      setUpcoming(upcomingData || [])
      setTab('appointments')
    }
    setOfferResponding(false)
  }

  const declineOffer = async () => {
    if (!waitlistOffer || !clinicId) return
    setOfferResponding(true)
    await fetch('/api/waitlist/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waitlistId: waitlistOffer.id,
        action: 'decline',
        clinicId,
        patientId,
      })
    })
    setWaitlistOffer(null)
    setWaitlistEntry(null)
    setOfferResponding(false)
  }

  const NAV = [
    { icon: '▦', label: 'Appointments', key: 'appointments' },
    { icon: '◈', label: 'My info', key: 'profile' },
    { icon: '◷', label: 'Waitlist', key: 'waiting' },
    { icon: '→', label: 'Referrals', key: 'referrals' },
  ]

  const CHIPS = ['Book a cleaning', 'I have tooth pain', 'Cancel appointment', 'Prendre rendez-vous']

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#F0F4F8;color:#0F172A}
        .layout{display:flex;min-height:100vh}
        .sidebar{width:240px;background:#0F172A;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:50}
        .logo-area{padding:24px 20px 20px;border-bottom:1px solid rgba(255,255,255,0.06)}
        .logo-mark{display:flex;align-items:center;gap:10px;margin-bottom:3px}
        .logo-icon{width:30px;height:30px;background:#0EA5E9;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px}
        .logo-text{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#F8FAFC;letter-spacing:-0.3px}
        .logo-sub{font-size:11px;color:rgba(148,163,184,0.5);padding-left:40px;margin-top:2px}
        .nav{padding:12px 10px;flex:1}
        .nav-label{font-size:9.5px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(148,163,184,0.25);padding:10px 10px 6px}
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:7px;color:rgba(148,163,184,0.5);font-size:13px;cursor:pointer;margin-bottom:1px;transition:all .15s;border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif;position:relative}
        .nav-item:hover{background:rgba(255,255,255,0.05);color:#CBD5E1}
        .nav-item.active{background:rgba(14,165,233,0.1);color:#0EA5E9;font-weight:500}
        .nav-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:2px;height:55%;background:#0EA5E9;border-radius:0 2px 2px 0}
        .nav-icon{font-size:13px;width:18px;text-align:center}
        .intake-sidebar{margin:0 12px 12px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:all .15s;border:none;width:calc(100% - 24px);text-align:left;font-family:'DM Sans',sans-serif}
        .intake-sidebar.incomplete{background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.25)}
        .intake-sidebar.pending{background:rgba(148,163,184,0.08);border:1px solid rgba(148,163,184,0.15)}
        .intake-sidebar.approved{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2)}
        .intake-sidebar.rejected{background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.2)}
        .intake-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block;margin-right:6px}
        .intake-label{font-size:11px;font-weight:600;letter-spacing:.3px}
        .book-btn-sidebar{margin:0 12px 12px;padding:10px 14px;background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);border-radius:8px;color:#0EA5E9;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;width:calc(100% - 24px)}
        .book-btn-sidebar:hover{background:rgba(14,165,233,0.14)}
        .book-dot{width:5px;height:5px;border-radius:50%;background:#0EA5E9;box-shadow:0 0 6px rgba(14,165,233,0.8)}
        .sidebar-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,0.06)}
        .patient-name{font-size:13px;color:#CBD5E1;font-weight:500;margin-bottom:2px}
        .signout{font-size:12px;color:rgba(148,163,184,0.4);background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;padding:0;transition:color .15s}
        .signout:hover{color:#94A3B8}
        .main{flex:1;margin-left:240px;padding:36px 40px;min-height:100vh}
        .page-header{margin-bottom:28px}
        .page-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;color:#0F172A;letter-spacing:-0.4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-top:3px}
        .intake-banner{background:white;border:1.5px solid #FDE68A;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
        .intake-banner-icon{font-size:20px;flex-shrink:0}
        .intake-banner-title{font-size:14px;font-weight:600;color:#0F172A;margin-bottom:2px}
        .intake-banner-sub{font-size:12px;color:#64748B}
        .intake-banner-btn{padding:9px 18px;background:#0F172A;color:white;border:none;border-radius:8px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;white-space:nowrap}
        .intake-approved-banner{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:12px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px;font-size:13px;color:#166534;font-weight:500}
        .intake-pending-banner{background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:12px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px;font-size:13px;color:#92400E;font-weight:500}
        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:16px}
        .card-header{padding:14px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:600;color:#0F172A}
        .apt-row{display:flex;align-items:center;gap:12px;padding:13px 20px;border-bottom:1px solid #F8FAFC}
        .apt-row:last-child{border-bottom:none}
        .apt-bar{width:3px;height:36px;border-radius:2px;flex-shrink:0}
        .apt-info{flex:1}
        .apt-type{font-size:14px;font-weight:500;color:#0F172A;text-transform:capitalize}
        .apt-time{font-size:12px;color:#64748B;margin-top:2px}
        .apt-badge{font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px}
        .badge-upcoming{background:#EFF6FF;color:#0EA5E9}
        .offer-banner{background:white;border:2px solid #0EA5E9;border-radius:14px;padding:20px 24px;margin-bottom:24px;position:relative;overflow:hidden}
        .offer-banner::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#0EA5E9,#6366F1)}
        .offer-pulse{display:inline-flex;align-items:center;gap:6px;background:#EFF6FF;color:#0EA5E9;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:12px;letter-spacing:.3px}
        .offer-dot{width:6px;height:6px;border-radius:50%;background:#0EA5E9;animation:pulse 1.5s infinite}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
        .offer-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .offer-slot{font-size:14px;color:#0EA5E9;font-weight:600;margin-bottom:12px}
        .offer-sub{font-size:13px;color:#64748B;margin-bottom:16px;line-height:1.5}
        .offer-actions{display:flex;gap:10px}
        .offer-accept{flex:1;padding:11px;background:#0EA5E9;color:white;border:none;border-radius:9px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;transition:background .15s}
        .offer-accept:hover{background:#0284C7}
        .offer-accept:disabled{opacity:.6;cursor:not-allowed}
        .offer-decline{padding:11px 20px;background:white;color:#94A3B8;border:1.5px solid #E2E8F0;border-radius:9px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .15s}
        .offer-decline:hover{border-color:#F43F5E;color:#F43F5E}
        .offer-decline:disabled{opacity:.6;cursor:not-allowed}
        .confirm-btn{padding:6px 14px;border-radius:7px;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:1.5px solid #E2E8F0;background:white;color:#64748B;transition:all .15s;white-space:nowrap}
        .confirm-btn:hover{border-color:#10B981;color:#10B981;background:#F0FDF4}
        .confirm-btn:disabled{opacity:.6;cursor:not-allowed}
        .confirmed-badge{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#10B981;white-space:nowrap}
        .badge-past{background:#F8FAFC;color:#CBD5E1}
        .badge-cancelled{background:#FEF2F2;color:#F87171}
        .profile-card{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:20px;margin-bottom:12px}
        .profile-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #F8FAFC}
        .profile-row:last-child{border-bottom:none}
        .profile-label{font-size:12px;color:#94A3B8;font-weight:500}
        .profile-value{font-size:14px;color:#0F172A}
        .status-row{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;margin-top:16px}
        .start-btn{padding:8px 16px;background:#0F172A;color:white;border-radius:8px;font-size:13px;font-weight:500;border:none;cursor:pointer;font-family:'DM Sans',sans-serif}
        .waitlist-card{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:32px;text-align:center}
        .waitlist-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:8px}
        .waitlist-sub{font-size:13px;color:#64748B;margin-bottom:20px;line-height:1.6;max-width:360px;margin-left:auto;margin-right:auto}
        .waitlist-btn{display:inline-block;padding:10px 20px;background:#0F172A;color:white;border-radius:8px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:none}
        .section-title{font-size:11px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:#94A3B8;margin-bottom:12px}
        .empty{padding:32px 20px;text-align:center;color:#CBD5E1;font-size:13px}

        /* ── Booking panel ── */
        .booking-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200}
        .booking-panel{position:fixed;top:0;right:0;width:420px;height:100vh;background:white;z-index:201;display:flex;flex-direction:column;box-shadow:-4px 0 32px rgba(0,0,0,0.15)}
        .booking-header{padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-bottom:1px solid #F1F5F9}
        .booking-header-left{display:flex;align-items:center;gap:10px}
        .booking-avatar{width:32px;height:32px;border-radius:50%;background:#E0F2FE;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .booking-title{font-size:14px;font-weight:600;color:#0F172A}
        .booking-status{font-size:11px;color:#64748B;display:flex;align-items:center;gap:4px;margin-top:1px}
        .status-dot-green{width:5px;height:5px;border-radius:50%;background:#4ADE80}
        .close-btn{width:30px;height:30px;border-radius:8px;border:1px solid #E2E8F0;background:white;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:#64748B;flex-shrink:0}
        .close-btn:hover{background:#F8FAFC}
        .chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
        .bubble-wrap{display:flex;align-items:flex-end;gap:8px}
        .bubble-wrap.user{flex-direction:row-reverse}
        .bot-icon{width:24px;height:24px;border-radius:50%;background:#E0F2FE;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px}
        .bubble{max-width:80%;padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.55;white-space:pre-wrap}
        .bubble.assistant{background:#F1F5F9;color:#1E293B;border-bottom-left-radius:3px}
        .bubble.user{color:white;border-bottom-right-radius:3px}
        .typing{display:flex;align-items:center;gap:4px;padding:9px 13px;background:#F1F5F9;border-radius:14px;border-bottom-left-radius:3px;width:fit-content}
        .tdot{width:5px;height:5px;border-radius:50%;background:#94A3B8;animation:bounce 1.2s infinite}
        .tdot:nth-child(2){animation-delay:.2s}
        .tdot:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
        .chips-row{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 10px}
        .chip{padding:5px 12px;border-radius:20px;border:1.5px solid;font-size:11px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;background:white;transition:all .15s;white-space:nowrap}
        .chat-footer{padding:12px 16px;border-top:1px solid #E2E8F0;background:white;flex-shrink:0}
        .chat-input-row{display:flex;gap:8px;align-items:center}
        .chat-input{flex:1;padding:9px 14px;border:1.5px solid #E2E8F0;border-radius:20px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;color:#1E293B;transition:border-color .15s}
        .chat-input:focus{border-color:#0EA5E9}
        .send-btn{width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:filter .15s}
        .send-btn:hover{filter:brightness(.9)}
        .send-btn:disabled{opacity:.4;cursor:not-allowed}
      `}</style>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-area">
            <div className="logo-mark">
              <div className="logo-icon">🦷</div>
              <div className="logo-text">{clinicName || 'DentPlus'}</div>
            </div>
            <div className="logo-sub">Patient portal</div>
          </div>

          <nav className="nav">
            <div className="nav-label">My account</div>
            {NAV.map(item => (
              <button key={item.key}
                className={`nav-item ${tab === item.key ? 'active' : ''}`}
                onClick={() => setTab(item.key as typeof tab)}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <button
            className={`intake-sidebar ${intakeStatus === 'approved' ? 'approved' : intakeStatus === 'pending_review' ? 'pending' : intakeStatus === 'rejected' ? 'rejected' : 'incomplete'}`}
            onClick={() => (intakeStatus === 'incomplete' || intakeStatus === 'rejected') && router.push(`/clinic/${slug}/intake`)}
            style={{ cursor: (intakeStatus === 'incomplete' || intakeStatus === 'rejected') ? 'pointer' : 'default' }}
          >
            <span className="intake-dot" style={{
              background: intakeStatus === 'approved' ? '#10B981' : intakeStatus === 'pending_review' ? '#F59E0B' : intakeStatus === 'rejected' ? '#F43F5E' : '#F59E0B'
            }} />
            <span className="intake-label" style={{
              color: intakeStatus === 'approved' ? '#065F46' : intakeStatus === 'pending_review' ? '#92400E' : intakeStatus === 'rejected' ? '#9F1239' : '#92400E'
            }}>
              {intakeStatus === 'approved' ? '✓ File approved' : intakeStatus === 'pending_review' ? 'Intake pending review' : intakeStatus === 'rejected' ? 'Intake rejected — resubmit' : '→ Complete intake form'}
            </span>
          </button>

          {/* Book button opens panel instead of new page */}
          <button className="book-btn-sidebar" onClick={openBooking}>
            <div className="book-dot" />
            Book an appointment
          </button>

          <div className="sidebar-footer">
            <div className="patient-name">{patientInfo?.full_name || ''}</div>
            <button className="signout" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        {/* Main content */}
        <main className="main">
          <div className="page-header">
            <div className="page-title">
              Hello{patientInfo ? `, ${patientInfo.full_name.split(' ')[0]}` : ''} 👋
            </div>
            <div className="page-sub">
              {upcoming.length > 0
                ? `You have ${upcoming.length} upcoming appointment${upcoming.length > 1 ? 's' : ''}`
                : 'No upcoming appointments'}
            </div>
          </div>

          {/* Intake banners */}
          {intakeStatus === 'incomplete' && (
            <div className="intake-banner">
              <div className="intake-banner-icon">📋</div>
              <div>
                <div className="intake-banner-title">Action required — complete your intake form</div>
                <div className="intake-banner-sub">Required before your first visit. Takes about 5 minutes.</div>
              </div>
              <button className="intake-banner-btn" onClick={() => router.push(`/clinic/${slug}/intake`)}>Start now</button>
            </div>
          )}
          {intakeStatus === 'rejected' && (
            <div className="intake-banner" style={{ borderColor: '#FECACA' }}>
              <div className="intake-banner-icon">⚠️</div>
              <div>
                <div className="intake-banner-title">Your intake form needs corrections</div>
                <div className="intake-banner-sub">The clinic has requested changes. Please resubmit.</div>
              </div>
              <button className="intake-banner-btn" style={{ background: '#F43F5E' }} onClick={() => router.push(`/clinic/${slug}/intake`)}>Resubmit</button>
            </div>
          )}
          {intakeStatus === 'pending_review' && (
            <div className="intake-pending-banner">⏳ Your intake form has been submitted and is pending staff review.</div>
          )}
          {intakeStatus === 'approved' && (
            <div className="intake-approved-banner">✓ Your patient file is complete and approved.</div>
          )}

          {/* Slot offer banner — shown when Matchmaker found a slot for this patient */}
          {waitlistOffer && (
            <div className="offer-banner">
              <div className="offer-pulse">
                <div className="offer-dot" />
                SLOT AVAILABLE
              </div>
              <div className="offer-title">A spot just opened up for you!</div>
              <div className="offer-slot">
                {waitlistOffer.appointment_type.charAt(0).toUpperCase() + waitlistOffer.appointment_type.slice(1)} — {new Date(waitlistOffer.offered_slot_start).toLocaleDateString('en-CA', {
                  weekday: 'long', month: 'long', day: 'numeric',
                  hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
                })}
              </div>
              <div className="offer-sub">
                This slot was reserved for you from the waitlist. Accept to confirm your appointment, or decline to pass — we will notify the next patient.
              </div>
              <div className="offer-actions">
                <button className="offer-accept" onClick={acceptOffer} disabled={offerResponding}>
                  {offerResponding ? 'Processing...' : 'Accept appointment'}
                </button>
                <button className="offer-decline" onClick={declineOffer} disabled={offerResponding}>
                  Decline
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="empty">Loading...</div>
          ) : tab === 'appointments' ? (
            <>
              {upcoming.length > 0 && (
                <>
                  <div className="section-title">Upcoming</div>
                  <div className="card">
                    {upcoming.map(apt => {
                      const hoursUntil = (new Date(apt.start_time).getTime() - Date.now()) / 36e5
                      const showConfirm = hoursUntil <= 48 && hoursUntil > 0
                      return (
                        <div key={apt.id} className="apt-row">
                          <div className="apt-bar" style={{ background: TYPE_COLOR[apt.appointment_type] || '#E2E8F0' }} />
                          <div className="apt-info">
                            <div className="apt-type">{apt.appointment_type}</div>
                            <div className="apt-time">{formatTime(apt.start_time)}</div>
                            {apt.reason && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{apt.reason}</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                            {apt.patient_confirmed ? (
                              <span className="confirmed-badge">✓ Confirmed</span>
                            ) : showConfirm ? (
                              <button
                                className="confirm-btn"
                                onClick={() => confirmAppointment(apt.id)}
                                disabled={confirming === apt.id}
                              >
                                {confirming === apt.id ? 'Confirming...' : 'Confirm attendance'}
                              </button>
                            ) : (
                              <span className="apt-badge badge-upcoming">Scheduled</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              <div className="section-title" style={{ marginTop: upcoming.length > 0 ? '20px' : '0' }}>Past visits</div>
              {past.length === 0 ? (
                <div className="empty">No past visits yet</div>
              ) : (
                <div className="card">
                  {past.map(apt => (
                    <div key={apt.id} className="apt-row">
                      <div className="apt-bar" style={{ background: apt.status === 'cancelled' ? '#F87171' : '#E2E8F0' }} />
                      <div className="apt-info">
                        <div className="apt-type">{apt.appointment_type}</div>
                        <div className="apt-time">{formatTime(apt.start_time)}</div>
                      </div>
                      <span className={`apt-badge ${apt.status === 'cancelled' ? 'badge-cancelled' : 'badge-past'}`}>{apt.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : tab === 'profile' ? (
            <>
              <div className="section-title">Personal information</div>
              <div className="profile-card">
                {[
                  { label: 'Full name', value: patientInfo?.full_name },
                  { label: 'Email', value: patientInfo?.email },
                  { label: 'Phone', value: patientInfo?.phone_primary || 'Not provided' },
                  { label: 'Insurance', value: patientInfo?.insurance_provider || 'Not on file' },
                ].map(row => (
                  <div key={row.label} className="profile-row">
                    <span className="profile-label">{row.label}</span>
                    <span className="profile-value">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="section-title" style={{ marginTop: '20px' }}>Intake form</div>
              <div className="status-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: intakeStatus === 'approved' ? '#10B981' : intakeStatus === 'pending_review' ? '#F59E0B' : '#CBD5E1' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#0F172A', textTransform: 'capitalize' }}>{intakeStatus === 'incomplete' ? 'Not started' : intakeStatus.replace('_', ' ')}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                      {intakeStatus === 'incomplete' && 'Required before your first visit'}
                      {intakeStatus === 'pending_review' && 'Submitted — awaiting staff review'}
                      {intakeStatus === 'approved' && 'Your patient file is complete'}
                      {intakeStatus === 'rejected' && 'Please resubmit with corrections'}
                    </div>
                  </div>
                </div>
                {(intakeStatus === 'incomplete' || intakeStatus === 'rejected') && (
                  <button className="start-btn" onClick={() => router.push(`/clinic/${slug}/intake`)}>
                    {intakeStatus === 'rejected' ? 'Resubmit' : 'Start'}
                  </button>
                )}
              </div>
            </>
          ) : tab === 'referrals' ? (
            <>
              <div className="section-title">My referrals</div>
              {referrals.length === 0 ? (
                <div className="empty">No referrals on file yet</div>
              ) : (
                <div className="card">
                  {referrals.map(r => (
                    <div key={r.id} className="apt-row">
                      <div className="apt-bar" style={{ background: '#6366F1' }} />
                      <div className="apt-info">
                        <div className="apt-type" style={{ textTransform: 'capitalize' }}>{r.specialty.replace('_', ' ')} — {r.specialist_name}</div>
                        <div className="apt-time">{new Date(r.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        {r.notes && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{r.notes}</div>}
                      </div>
                      <span className={"apt-badge" + (r.status === 'sent' ? ' badge-upcoming' : ' badge-past')} style={{ textTransform: 'capitalize' }}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="section-title">Waiting list</div>
              {waitlistEntry ? (
                <div className="waitlist-card">
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
                  <div className="waitlist-title">You are on the waitlist</div>
                  <div className="waitlist-sub">
                    We will contact you as soon as a <strong>{waitlistEntry.appointment_type}</strong> slot opens.
                    {waitlistEntry.urgency === 'urgent' && ' Your request is marked as urgent.'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>
                    Added {new Date(waitlistEntry.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              ) : (
                <div className="waitlist-card" style={{ textAlign: 'left', padding: '24px' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Join the waiting list</div>
                  <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>We will notify you when a slot opens that matches your needs.</div>

                  {waitlistError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#DC2626', marginBottom: '14px' }}>
                      {waitlistError}
                    </div>
                  )}

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>Appointment type</div>
                    <select style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: 'white' }}
                      value={wlType} onChange={e => setWlType(e.target.value)}>
                      {['cleaning', 'checkup', 'filling', 'consultation', 'emergency'].map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>Urgency</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['routine', 'urgent'].map(u => (
                        <button key={u} onClick={() => setWlUrgency(u)}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', border: '1.5px solid', transition: 'all .15s',
                            background: wlUrgency === u ? '#0F172A' : 'white',
                            color: wlUrgency === u ? 'white' : '#64748B',
                            borderColor: wlUrgency === u ? '#0F172A' : '#E2E8F0' }}>
                          {u.charAt(0).toUpperCase() + u.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>Scheduling preference</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>
                        <input type="checkbox" checked={wlAnyTime} onChange={e => setWlAnyTime(e.target.checked)} />
                        Any time works
                      </label>
                    </div>
                    {!wlAnyTime && (
                      <>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Preferred days</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {['monday','tuesday','wednesday','thursday','friday'].map(day => (
                            <button key={day} onClick={() => toggleDay(day)}
                              style={{ padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', border: '1.5px solid', transition: 'all .15s',
                                background: wlDays.includes(day) ? '#0F172A' : 'white',
                                color: wlDays.includes(day) ? 'white' : '#64748B',
                                borderColor: wlDays.includes(day) ? '#0F172A' : '#E2E8F0' }}>
                              {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Preferred times</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {['morning', 'afternoon', 'evening'].map(time => (
                            <button key={time} onClick={() => toggleTime(time)}
                              style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', border: '1.5px solid', transition: 'all .15s',
                                background: wlTimes.includes(time) ? '#0F172A' : 'white',
                                color: wlTimes.includes(time) ? 'white' : '#64748B',
                                borderColor: wlTimes.includes(time) ? '#0F172A' : '#E2E8F0' }}>
                              {time.charAt(0).toUpperCase() + time.slice(1)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <button onClick={submitWaitlist} disabled={waitlistLoading}
                    style={{ width: '100%', padding: '11px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 500, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginTop: '4px', opacity: waitlistLoading ? .6 : 1 }}>
                    {waitlistLoading ? 'Adding...' : 'Join waiting list'}
                  </button>

                  <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', marginTop: '10px' }}>
                    Or tell our AI agent — open <button onClick={openBooking} style={{ background: 'none', border: 'none', color: '#0EA5E9', cursor: 'pointer', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', padding: 0 }}>booking chat</button> and say "add me to the waitlist"
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Booking panel slide-in */}
      {showBooking && (
        <>
          <div className="booking-overlay" onClick={closeBooking} />
          <div className="booking-panel">
            <div className="booking-header" style={{ borderTop: `3px solid ${clinicColor}` }}>
              <div className="booking-header-left">
                <div className="booking-avatar">🤖</div>
                <div>
                  <div className="booking-title">{clinicName}</div>
                  <div className="booking-status">
                    <div className="status-dot-green" />
                    AI Front Desk — Available 24/7
                  </div>
                </div>
              </div>
              <button className="close-btn" onClick={closeBooking}>✕</button>
            </div>

            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`bubble-wrap ${msg.role}`}>
                  {msg.role === 'assistant' && <div className="bot-icon">🤖</div>}
                  <div className={`bubble ${msg.role}`} style={msg.role === 'user' ? { background: clinicColor } : {}}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="bubble-wrap assistant">
                  <div className="bot-icon">🤖</div>
                  <div className="typing">
                    <div className="tdot" /><div className="tdot" /><div className="tdot" />
                  </div>
                </div>
              )}
            </div>

            {messages.length === 1 && !chatLoading && (
              <div className="chips-row">
                {CHIPS.map(chip => (
                  <button key={chip} className="chip"
                    style={{ borderColor: clinicColor, color: clinicColor }}
                    onClick={() => sendChat(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <div className="chat-footer">
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  placeholder="Type a message..."
                  disabled={chatLoading}
                  autoFocus
                />
                <button className="send-btn" style={{ background: clinicColor }}
                  onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
