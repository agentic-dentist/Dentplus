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

interface TreatmentNote {
  id: string
  visit_date: string
  appointment_type: string | null
  written_by_name: string | null
  findings: string | null
  treatment_done: string | null
  next_steps: string | null
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

interface InvoiceItem {
  id: string
  description: string
  procedure_code: string | null
  tooth_number: string | null
  fee: number
  insurance_covers: number
  patient_portion: number
}
interface InvoicePayment {
  id: string
  amount: number
  method: string
  reference: string | null
  paid_at: string
}
interface Invoice {
  id: string
  invoice_number: string
  status: string
  notes: string | null
  subtotal: number
  insurance_amount: number
  patient_amount: number
  amount_paid: number
  balance_due: number
  due_date: string | null
  created_by_name: string | null
  created_at: string
  invoice_items: InvoiceItem[]
  invoice_payments: InvoicePayment[]
}

interface TreatmentPlanItem {
  id: string
  procedure_code: string
  description: string
  tooth_number: string | null
  surface: string | null
  fee: number
  sort_order: number
}
interface TreatmentPlan {
  id: string
  status: string
  title: string
  notes: string | null
  total_fee: number
  patient_signature: string | null
  patient_signed_at: string | null
  created_by_name: string | null
  created_at: string
  treatment_plan_items: TreatmentPlanItem[]
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
  const [isApproved, setIsApproved] = useState<boolean | null>(null)
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [past, setPast] = useState<Appointment[]>([])
  const [tab, setTab] = useState<'appointments' | 'profile' | 'waiting' | 'referrals' | 'notes' | 'plans' | 'invoices'>('appointments')
  const [loading, setLoading] = useState(true)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  const [wlType, setWlType] = useState('cleaning')
  const [wlUrgency, setWlUrgency] = useState('routine')
  const [wlAnyTime, setWlAnyTime] = useState(true)
  const [wlDays, setWlDays] = useState<string[]>([])
  const [wlTimes, setWlTimes] = useState<string[]>([])
  const [waitlistEntry, setWaitlistEntry] = useState<{ appointment_type: string; urgency: string; created_at: string } | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [waitlistOffer, setWaitlistOffer] = useState<WaitlistOffer | null>(null)
  const [offerResponding, setOfferResponding] = useState(false)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [plans, setPlans]           = useState<TreatmentPlan[]>([])
  const [invoices, setInvoices]     = useState<Invoice[]>([])
  const [planSignatures, setPlanSignatures] = useState<Record<string, string>>({})
  const [signingPlan, setSigningPlan] = useState<string | null>(null)
  const [portalClinicId, setPortalClinicId] = useState<string>('')
  const [treatmentNotes, setTreatmentNotes] = useState<TreatmentNote[]>([])
  const [downloadingPDF, setDownloadingPDF] = useState(false)
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
      if (!user) { router.push('/'); return }
      setPatientAuthId(user.id)

      const { data: account, error: accountError } = await supabase
        .from('patient_accounts')
        .select('patient_id, clinic_id, is_approved')
        .eq('auth_id', user.id).maybeSingle()

      console.log('account:', JSON.stringify(account), 'error:', JSON.stringify(accountError))

      if (!account) { await supabase.auth.signOut(); router.push('/'); return }
      setIsApproved(account.is_approved ?? true)
      if (!account.is_approved) { setLoading(false); return }
      setClinicId(account.clinic_id)
      setPatientId(account.patient_id)

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

      if (!patient) { await supabase.auth.signOut(); router.push('/'); return }
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

      const { data: wlData } = await supabase.from('waiting_list')
        .select('appointment_type, urgency, created_at')
        .eq('clinic_id', account.clinic_id).eq('patient_id', account.patient_id)
        .eq('status', 'waiting').order('created_at', { ascending: false }).limit(1).single()
      if (wlData) setWaitlistEntry(wlData)

      const { data: offerData } = await supabase.from('waiting_list')
        .select('id, appointment_type, offered_slot_start, offered_slot_end, urgency')
        .eq('clinic_id', account.clinic_id).eq('patient_id', account.patient_id)
        .eq('status', 'offered').not('offered_slot_start', 'is', null)
        .order('offered_at', { ascending: false }).limit(1).single()
      if (offerData) setWaitlistOffer(offerData)

      const { data: notesData } = await supabase.from('treatment_notes')
        .select('id, visit_date, appointment_type, written_by_name, findings, treatment_done, next_steps')
        .eq('clinic_id', account.clinic_id).eq('patient_id', account.patient_id)
        .eq('is_private', false).order('visit_date', { ascending: false })
      setTreatmentNotes(notesData || [])

      const { data: refData } = await supabase.from('referrals')
        .select('id, created_at, specialist_name, specialty, urgency, status, notes')
        .eq('from_clinic_id', account.clinic_id).eq('patient_id', account.patient_id)
        .order('created_at', { ascending: false })
      setReferrals(refData || [])

      // Load treatment plans
      const { data: plansData } = await supabase
        .from('treatment_plans')
        .select(`id, status, title, notes, total_fee, patient_signature, patient_signed_at, created_by_name, created_at, treatment_plan_items(id, procedure_code, description, tooth_number, surface, fee, sort_order)`)
        .eq('clinic_id', account.clinic_id)
        .eq('patient_id', account.patient_id)
        .in('status', ['proposed', 'approved', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
      setPlans(plansData || [])

      // Load invoices
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`id, invoice_number, status, notes, subtotal, insurance_amount, patient_amount, amount_paid, balance_due, due_date, created_by_name, created_at, invoice_items(id, description, procedure_code, tooth_number, fee, insurance_covers, patient_portion), invoice_payments(id, amount, method, reference, paid_at)`)
        .eq('clinic_id', account.clinic_id)
        .eq('patient_id', account.patient_id)
        .in('status', ['sent', 'partial', 'paid', 'overdue'])
        .order('created_at', { ascending: false })
      setInvoices(invoicesData || [])
      setPortalClinicId(account.clinic_id || '')

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
    router.push('/')
  }

  const intakeStatus = patientInfo?.intake_status || 'incomplete'
  const toggleDay = (day: string) => setWlDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  const toggleTime = (time: string) => setWlTimes(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time])

  const submitWaitlist = async () => {
    if (!patientId || !clinicId) return
    setWaitlistLoading(true); setWaitlistError('')
    const { data: existing } = await supabase.from('waiting_list').select('id')
      .eq('clinic_id', clinicId).eq('patient_id', patientId)
      .eq('appointment_type', wlType).eq('status', 'waiting').single()
    if (existing) { setWaitlistError(`You are already on the waitlist for a ${wlType}.`); setWaitlistLoading(false); return }
    const { data, error } = await supabase.from('waiting_list').insert({
      clinic_id: clinicId, patient_id: patientId, appointment_type: wlType,
      urgency: wlUrgency, any_time: wlAnyTime,
      preferred_days: wlAnyTime ? [] : wlDays, preferred_times: wlAnyTime ? [] : wlTimes,
      status: 'waiting', priority: wlUrgency === 'urgent' ? 2 : 1
    }).select('appointment_type, urgency, created_at').single()
    if (error || !data) { setWaitlistError('Something went wrong. Please try again.') }
    else { setWaitlistEntry(data); setWaitlistDone(true) }
    setWaitlistLoading(false)
  }

  const openBooking = () => { setShowBooking(true); if (!chatStarted) startChat() }

  const startChat = async () => {
    setChatStarted(true); setChatLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }], clinicId, patientAuthId })
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
    setMessages(newMessages); setChatInput(''); setChatLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, clinicId, patientAuthId })
    })
    const data = await res.json()
    setMessages([...newMessages, { role: 'assistant', content: data.message }])
    setChatLoading(false)
  }

  const closeBooking = () => {
    setShowBooking(false)
    if (clinicId && patientId) {
      const now = new Date().toISOString()
      supabase.from('appointments').select('id, start_time, appointment_type, status, reason, booked_via, patient_confirmed, patient_confirmed_at')
        .eq('clinic_id', clinicId).eq('patient_id', patientId)
        .eq('status', 'scheduled').gte('start_time', now).order('start_time').limit(5)
        .then(({ data }) => { if (data) setUpcoming(data) })
    }
  }

  const confirmAppointment = async (aptId: string) => {
    setConfirming(aptId)
    await supabase.from('appointments').update({ patient_confirmed: true, patient_confirmed_at: new Date().toISOString() }).eq('id', aptId)
    setUpcoming(prev => prev.map(a => a.id === aptId ? { ...a, patient_confirmed: true } : a))
    setConfirming(null)
  }

  const acceptOffer = async () => {
    if (!waitlistOffer || !patientId || !clinicId) return
    setOfferResponding(true)
    const res = await fetch('/api/waitlist/respond', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitlistId: waitlistOffer.id, action: 'accept', clinicId, patientId })
    })
    const data = await res.json()
    if (data.success) {
      setWaitlistOffer(null); setWaitlistEntry(null)
      const now = new Date().toISOString()
      const { data: upcomingData } = await supabase.from('appointments')
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitlistId: waitlistOffer.id, action: 'decline', clinicId, patientId })
    })
    setWaitlistOffer(null); setWaitlistEntry(null); setOfferResponding(false)
  }

  const downloadRecords = async () => {
    if (!patientAuthId || !clinicId) return
    setDownloadingPDF(true)
    try {
      const res = await fetch(`/api/patient/records-pdf?patientAuthId=${patientAuthId}&clinicId=${clinicId}`)
      if (!res.ok) throw new Error('Failed to fetch records')
      const data = await res.json()
      const html = buildRecordHTML(data)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none'
      document.body.appendChild(iframe)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) throw new Error('Could not access iframe')
      iframeDoc.open(); iframeDoc.write(html); iframeDoc.close()
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print()
          setTimeout(() => document.body.removeChild(iframe), 1000)
        }, 300)
      }
    } catch (err) { console.error(err); alert('Could not generate PDF. Please try again.') }
    setDownloadingPDF(false)
  }

  const buildRecordHTML = (data: Record<string, any>) => {
    const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    const fmtDT = (d: string) => new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })
    const row = (label: string, value: unknown) => value ? `<tr><td class="lbl">${label}</td><td>${value}</td></tr>` : ''
    const sec = (n: string, title: string) => `<div class="sec"><h2><span class="num">${n}</span>${title}</h2>`
    const allergies = data.allergies || []
    const dentalKeys = ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj']
    const dentalConds = data.dental ? dentalKeys.filter((k: string) => data.dental[k]).map((k: string) => k.replace(/has_|had_/g,'').replace(/_/g,' ')).join(', ') : ''
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DentPlus Records</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10pt;color:#1a1a2e;padding:15mm}.header{text-align:center;border-bottom:2px solid #0EA5E9;padding-bottom:10px;margin-bottom:16px}h1{font-size:16pt;font-weight:700;color:#0F172A}.clinic{font-size:10pt;color:#64748B}.generated{font-size:8pt;color:#94A3B8;margin-top:3px}.allergy{background:#FEF2F2;border:1px solid #FECACA;border-radius:4px;padding:8px 12px;margin-bottom:14px;color:#DC2626;font-weight:600;font-size:9pt}.sec{margin-bottom:18px;page-break-inside:avoid}h2{font-size:11pt;font-weight:700;color:#0F172A;margin-bottom:6px;display:flex;align-items:center;gap:8px}.num{background:#0EA5E9;color:white;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:8pt;flex-shrink:0}table.info{width:100%;border-collapse:collapse}table.info td{padding:4px 6px;border-bottom:1px solid #F1F5F9;vertical-align:top;font-size:9pt}table.info td.lbl{width:150px;color:#64748B;font-weight:600}table.apts{width:100%;border-collapse:collapse;font-size:8.5pt}table.apts th{background:#F8FAFC;padding:5px 6px;text-align:left;font-weight:600;color:#64748B;border-bottom:1px solid #E2E8F0}table.apts td{padding:5px 6px;border-bottom:1px solid #F8FAFC}.note{background:#F8FAFC;border-left:3px solid #0EA5E9;padding:8px 10px;margin-bottom:8px;font-size:9pt}.footer{margin-top:20px;padding-top:8px;border-top:1px solid #E2E8F0;text-align:center;color:#94A3B8;font-size:7pt}</style></head><body>
<div class="header"><h1>Patient Medical Record</h1><div class="clinic">${data.clinicName}</div><div class="generated">Generated ${new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'})}</div></div>
${allergies.length > 0 ? `<div class="allergy">⚠ Allergies: ${allergies.join(', ')}</div>` : ''}
${sec('1','Patient Information')}<table class="info">${row('Full name',data.patient?.full_name)}${row('Date of birth',data.patient?.date_of_birth?fmtDate(data.patient.date_of_birth):null)}${row('Phone',data.patient?.phone_primary)}${row('Email',data.patient?.email)}</table></div>
${data.appointments?.length>0?`${sec('5','Appointment History')}<table class="apts"><thead><tr><th>Date</th><th>Type</th><th>Status</th></tr></thead><tbody>${data.appointments.map((a:any)=>`<tr><td>${fmtDT(a.start_time)}</td><td>${a.appointment_type}</td><td>${a.status}</td></tr>`).join('')}</tbody></table></div>`:''}
<div class="footer">Generated by DentPlus — Confidential patient record — PIPEDA compliant</div>
</body></html>`
  }

  const signPlan = async (planId: string, clinicId: string) => {
    const sig = planSignatures[planId]?.trim()
    if (!sig) return
    setSigningPlan(planId)
    const res = await fetch('/api/treatment-plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, clinicId, action: 'sign', signature: sig, signedByName: patientInfo?.full_name })
    })
    const data = await res.json()
    if (data.plan) setPlans(prev => prev.map(p => p.id === planId ? data.plan : p))
    setSigningPlan(null)
  }

  const NAV = [
    { icon: '▦', label: 'Appointments', key: 'appointments' },
    { icon: '◈', label: 'My info', key: 'profile' },
    { icon: '◷', label: 'Waitlist', key: 'waiting' },
    { icon: '→', label: 'Referrals', key: 'referrals' },
    { icon: '◎', label: 'Visit notes', key: 'notes' },
    { icon: '◉', label: 'Treatment plans', key: 'plans' },
    { icon: '◎', label: 'Invoices', key: 'invoices' },
  ]

  const CHIPS = ['Book a cleaning', 'I have tooth pain', 'Cancel appointment', 'Prendre rendez-vous']

  if (isApproved === false) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #E2E8F0', padding: 40, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>Account pending approval</h2>
        <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>Your account is waiting for clinic staff approval. You will receive an email once approved.</p>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 20px', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>Sign out</button>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter',sans-serif;background:#F1F5F9;color:#0F172A;-webkit-font-smoothing:antialiased}
        .layout{display:flex;min-height:100vh}
        .sidebar{width:236px;background:#FFFFFF;border-right:1px solid #E2E8F0;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:50}
        .logo-area{padding:20px 20px 16px;border-bottom:1px solid #E2E8F0}
        .logo-mark{display:flex;align-items:center;gap:10px;margin-bottom:6px}
        .logo-icon{width:32px;height:32px;background:#00C4A7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .logo-text{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;color:#0F172A;letter-spacing:-0.3px}
        .logo-sub{font-size:12px;color:#64748B;font-weight:500;padding-left:42px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .nav{padding:8px 10px;flex:1}
        .nav-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94A3B8;padding:14px 12px 5px}
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;color:#334155;font-size:13px;font-weight:500;cursor:pointer;margin-bottom:2px;transition:all .12s;border:none;background:none;width:100%;text-align:left;font-family:'Inter',sans-serif}
        .nav-item:hover{background:#F8FAFC;color:#0F172A}
        .nav-item.active{background:#FFFFFF;color:#4F46E5;font-weight:600;border-left:3px solid #4F46E5;padding-left:9px;box-shadow:0 1px 4px rgba(0,0,0,.07)}
        .nav-icon{font-size:13px;width:18px;text-align:center;flex-shrink:0}
        .intake-sidebar{margin:0 12px 12px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:all .15s;border:none;width:calc(100% - 24px);text-align:left;font-family:'Inter',sans-serif}
        .intake-sidebar.incomplete{background:#FEF9EE;border:1px solid #FDE68A}
        .intake-sidebar.pending{background:#F8FAFC;border:1px solid #E2E8F0}
        .intake-sidebar.approved{background:#F0FDF4;border:1px solid #BBF7D0}
        .intake-sidebar.rejected{background:#FEF2F2;border:1px solid #FECACA}
        .intake-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block;margin-right:6px}
        .intake-label{font-size:11px;font-weight:600;letter-spacing:.3px}
        .book-btn-sidebar{margin:0 12px 10px;padding:9px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;color:#64748B;font-size:12px;font-weight:500;font-family:'Inter',sans-serif;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px;width:calc(100% - 24px)}
        .book-btn-sidebar:hover{border-color:#4F46E5;color:#4F46E5;background:#EEF2FF}
        .book-dot{width:5px;height:5px;border-radius:50%;background:#00C4A7;flex-shrink:0}
        .sidebar-footer{padding:14px 20px 18px;border-top:1px solid #E2E8F0}
        .patient-name{font-size:13px;color:#0F172A;font-weight:500;margin-bottom:3px}
        .signout{font-size:12px;color:#94A3B8;background:none;border:none;cursor:pointer;font-family:'Inter',sans-serif;padding:0;transition:color .15s}
        .signout:hover{color:#4F46E5}
        .main{flex:1;margin-left:236px;padding:32px 36px;min-height:100vh}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.4px;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:28px}
        .card{background:white;border-radius:14px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:16px}
        .apt-row{display:flex;align-items:center;gap:12px;padding:13px 20px;border-bottom:1px solid #F8FAFC}
        .apt-row:last-child{border-bottom:none}
        .apt-bar{width:3px;height:36px;border-radius:2px;flex-shrink:0}
        .apt-info{flex:1}
        .apt-type{font-size:14px;font-weight:500;color:#0F172A;text-transform:capitalize}
        .apt-time{font-size:12px;color:#64748B;margin-top:2px}
        .apt-badge{font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px}
        .badge-upcoming{background:#EEF2FF;color:#4F46E5}
        .badge-past{background:#F8FAFC;color:#CBD5E1}
        .badge-cancelled{background:#FEF2F2;color:#F87171}
        .section-title{font-size:11px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:#94A3B8;margin-bottom:12px}
        .empty{padding:32px 20px;text-align:center;color:#CBD5E1;font-size:13px}
        .intake-banner{background:white;border:1.5px solid #FDE68A;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
        .intake-banner-btn{padding:9px 18px;background:#4F46E5;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;white-space:nowrap}
        .profile-card{background:white;border-radius:14px;border:1px solid #E2E8F0;padding:20px;margin-bottom:12px}
        .profile-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #F8FAFC}
        .profile-row:last-child{border-bottom:none}
        .profile-label{font-size:12px;color:#94A3B8;font-weight:500}
        .profile-value{font-size:14px;color:#0F172A}
        .waitlist-card{background:white;border-radius:14px;border:1px solid #E2E8F0;padding:24px}
        .confirm-btn{padding:6px 14px;border-radius:7px;font-size:12px;font-weight:500;font-family:'Inter',sans-serif;cursor:pointer;border:1.5px solid #E2E8F0;background:white;color:#64748B;transition:all .15s;white-space:nowrap}
        .confirmed-badge{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#059669}
        .offer-banner{background:white;border:2px solid #4F46E5;border-radius:14px;padding:20px 24px;margin-bottom:24px}
        .offer-accept{flex:1;padding:11px;background:#0EA5E9;color:white;border:none;border-radius:9px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer}
        .offer-decline{padding:11px 20px;background:white;color:#94A3B8;border:1.5px solid #E2E8F0;border-radius:9px;font-size:14px;font-family:'DM Sans',sans-serif;cursor:pointer}
        .booking-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200}
        .booking-panel{position:fixed;top:0;right:0;width:420px;height:100vh;background:white;z-index:201;display:flex;flex-direction:column;box-shadow:-4px 0 32px rgba(0,0,0,0.15)}
        .booking-header{padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F1F5F9}
        .chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
        .bubble-wrap{display:flex;align-items:flex-end;gap:8px}
        .bubble-wrap.user{flex-direction:row-reverse}
        .bot-icon{width:24px;height:24px;border-radius:50%;background:#E0F2FE;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px}
        .bubble{max-width:80%;padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.55;white-space:pre-wrap}
        .bubble.assistant{background:#F1F5F9;color:#1E293B;border-bottom-left-radius:3px}
        .bubble.user{color:white;border-bottom-right-radius:3px}
        .typing{display:flex;align-items:center;gap:4px;padding:9px 13px;background:#F1F5F9;border-radius:14px}
        .tdot{width:5px;height:5px;border-radius:50%;background:#94A3B8;animation:bounce 1.2s infinite}
        .tdot:nth-child(2){animation-delay:.2s}.tdot:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
        .chips-row{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 10px}
        .chip{padding:5px 12px;border-radius:20px;border:1.5px solid;font-size:11px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;background:white}
        .chat-footer{padding:12px 16px;border-top:1px solid #E2E8F0;background:white}
        .chat-input-row{display:flex;gap:8px;align-items:center}
        .chat-input{flex:1;padding:9px 14px;border:1.5px solid #E2E8F0;border-radius:20px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;color:#1E293B}
        .send-btn{width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center}
      `}</style>

      <div className="layout">
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
              <button key={item.key} className={`nav-item ${tab === item.key ? 'active' : ''}`}
                onClick={() => setTab(item.key as typeof tab)}>
                <span className="nav-icon">{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <button className={`intake-sidebar ${intakeStatus === 'approved' ? 'approved' : intakeStatus === 'pending_review' ? 'pending' : intakeStatus === 'rejected' ? 'rejected' : 'incomplete'}`}
            onClick={() => (intakeStatus === 'incomplete' || intakeStatus === 'rejected') && router.push(`/clinic/${slug}/intake`)}
            style={{ cursor: (intakeStatus === 'incomplete' || intakeStatus === 'rejected') ? 'pointer' : 'default' }}>
            <span className="intake-dot" style={{ background: intakeStatus === 'approved' ? '#10B981' : intakeStatus === 'pending_review' ? '#F59E0B' : intakeStatus === 'rejected' ? '#F43F5E' : '#F59E0B' }} />
            <span className="intake-label" style={{ color: intakeStatus === 'approved' ? '#065F46' : intakeStatus === 'pending_review' ? '#92400E' : intakeStatus === 'rejected' ? '#9F1239' : '#92400E' }}>
              {intakeStatus === 'approved' ? '✓ File approved' : intakeStatus === 'pending_review' ? 'Intake pending review' : intakeStatus === 'rejected' ? 'Intake rejected — resubmit' : '→ Complete intake form'}
            </span>
          </button>
          <button className="book-btn-sidebar" onClick={openBooking}>
            <div className="book-dot" />Book an appointment
          </button>
          <div className="sidebar-footer">
            <div className="patient-name">{patientInfo?.full_name || ''}</div>
            <button className="signout" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        <main className="main">
          <div className="page-title">Hello{patientInfo ? `, ${patientInfo.full_name.split(' ')[0]}` : ''} 👋</div>
          <div className="page-sub">{upcoming.length > 0 ? `You have ${upcoming.length} upcoming appointment${upcoming.length > 1 ? 's' : ''}` : 'No upcoming appointments'}</div>

          {intakeStatus === 'incomplete' && (
            <div className="intake-banner">
              <div style={{ fontSize: 20 }}>📋</div>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Complete your intake form</div><div style={{ fontSize: 12, color: '#64748B' }}>Required before your first visit.</div></div>
              <button className="intake-banner-btn" onClick={() => router.push(`/clinic/${slug}/intake`)}>Start now</button>
            </div>
          )}

          {waitlistOffer && (
            <div className="offer-banner">
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>A slot just opened up for you!</div>
              <div style={{ fontSize: 14, color: '#0EA5E9', fontWeight: 600, marginBottom: 12 }}>
                {waitlistOffer.appointment_type} — {new Date(waitlistOffer.offered_slot_start).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="offer-accept" onClick={acceptOffer} disabled={offerResponding}>{offerResponding ? 'Processing...' : 'Accept'}</button>
                <button className="offer-decline" onClick={declineOffer} disabled={offerResponding}>Decline</button>
              </div>
            </div>
          )}

          {loading ? <div className="empty">Loading...</div> : tab === 'appointments' ? (
            <>
              {upcoming.length > 0 && (<><div className="section-title">Upcoming</div><div className="card">{upcoming.map(apt => {
                const hoursUntil = (new Date(apt.start_time).getTime() - Date.now()) / 36e5
                const showConfirm = hoursUntil <= 48 && hoursUntil > 0
                return (<div key={apt.id} className="apt-row">
                  <div className="apt-bar" style={{ background: TYPE_COLOR[apt.appointment_type] || '#E2E8F0' }} />
                  <div className="apt-info"><div className="apt-type">{apt.appointment_type}</div><div className="apt-time">{formatTime(apt.start_time)}</div></div>
                  {apt.patient_confirmed ? <span className="confirmed-badge">✓ Confirmed</span> : showConfirm ? <button className="confirm-btn" onClick={() => confirmAppointment(apt.id)} disabled={confirming === apt.id}>{confirming === apt.id ? 'Confirming...' : 'Confirm'}</button> : <span className="apt-badge badge-upcoming">Scheduled</span>}
                </div>)
              })}</div></>)}
              <div className="section-title" style={{ marginTop: upcoming.length > 0 ? 20 : 0 }}>Past visits</div>
              {past.length === 0 ? <div className="empty">No past visits yet</div> : <div className="card">{past.map(apt => (<div key={apt.id} className="apt-row"><div className="apt-bar" style={{ background: apt.status === 'cancelled' ? '#F87171' : '#E2E8F0' }} /><div className="apt-info"><div className="apt-type">{apt.appointment_type}</div><div className="apt-time">{formatTime(apt.start_time)}</div></div><span className={`apt-badge ${apt.status === 'cancelled' ? 'badge-cancelled' : 'badge-past'}`}>{apt.status}</span></div>))}</div>}
            </>
          ) : tab === 'profile' ? (
            <>
              <div className="section-title">Personal information</div>
              <div className="profile-card">
                {[['Full name', patientInfo?.full_name],['Email', patientInfo?.email],['Phone', patientInfo?.phone_primary || 'Not provided'],['Insurance', patientInfo?.insurance_provider || 'Not on file']].map(([label, value]) => (
                  <div key={label} className="profile-row"><span className="profile-label">{label}</span><span className="profile-value">{value}</span></div>
                ))}
              </div>
              <button onClick={downloadRecords} disabled={downloadingPDF} style={{ padding: '8px 16px', background: '#0F172A', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginTop: 12 }}>
                {downloadingPDF ? 'Generating...' : '↓ Download my records'}
              </button>
            </>
          ) : tab === 'notes' ? (
            <>{treatmentNotes.length === 0 ? <div className="empty">No visit notes on file yet</div> : <div className="card">{treatmentNotes.map(note => (<div key={note.id} className="apt-row"><div className="apt-bar" style={{ background: '#6366F1' }} /><div className="apt-info"><div className="apt-type">{note.appointment_type || 'Visit'}</div><div className="apt-time">{new Date(note.visit_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}{note.written_by_name ? ' · ' + note.written_by_name : ''}</div>{note.findings && <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{note.findings}</div>}</div></div>))}</div>}</>
          ) : tab === 'referrals' ? (
            <>{referrals.length === 0 ? <div className="empty">No referrals on file yet</div> : <div className="card">{referrals.map(r => (<div key={r.id} className="apt-row"><div className="apt-bar" style={{ background: '#6366F1' }} /><div className="apt-info"><div className="apt-type">{r.specialty} — {r.specialist_name}</div><div className="apt-time">{new Date(r.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div></div><span className="apt-badge badge-upcoming">{r.status}</span></div>))}</div>}</>
          ) : tab === 'plans' ? (
            <>
              {plans.length === 0 ? (
                <div className="empty">No treatment plans on file yet</div>
              ) : plans.map(plan => {
                const clinicId = plan.id // we need clinic_id — fetch from supabase context
                return (
                  <div key={plan.id} className="card" style={{marginBottom:14,overflow:'hidden',borderRadius:12}}>
                    {/* Plan header */}
                    <div style={{padding:'14px 16px',borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:'#0F172A'}}>{plan.title}</div>
                        <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>
                          From {plan.created_by_name || 'your clinic'} · {new Date(plan.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}
                        </div>
                      </div>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,
                        background: plan.status==='proposed'?'#EFF6FF':plan.status==='approved'?'#D1FAE5':plan.status==='in_progress'?'#FEF3C7':'#F0FDF4',
                        color: plan.status==='proposed'?'#1D4ED8':plan.status==='approved'?'#059669':plan.status==='in_progress'?'#D97706':'#16A34A'
                      }}>
                        {plan.status==='proposed'?'Awaiting your approval':plan.status==='approved'?'Approved':plan.status==='in_progress'?'In progress':'Completed'}
                      </span>
                    </div>

                    {/* Procedures */}
                    {plan.treatment_plan_items && plan.treatment_plan_items.length > 0 && (
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:'#F8FAFC'}}>
                            <th style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#94A3B8',padding:'8px 16px',textAlign:'left'}}>Procedure</th>
                            <th style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#94A3B8',padding:'8px 16px',textAlign:'right'}}>Fee</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...plan.treatment_plan_items].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(item => (
                            <tr key={item.id} style={{borderTop:'1px solid #F8FAFC'}}>
                              <td style={{padding:'10px 16px',fontSize:13,color:'#334155'}}>
                                {item.procedure_code && <span style={{display:'inline-block',padding:'1px 7px',background:'#F1F5F9',borderRadius:5,fontSize:11,fontWeight:600,color:'#475569',marginRight:8}}>{item.procedure_code}</span>}
                                {item.description}
                                {item.tooth_number && <span style={{fontSize:11,color:'#94A3B8',marginLeft:8}}>Tooth #{item.tooth_number}</span>}
                              </td>
                              <td style={{padding:'10px 16px',fontSize:13,fontWeight:600,color:'#0F172A',textAlign:'right'}}>${(item.fee||0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {plan.notes && (
                      <div style={{padding:'10px 16px',fontSize:13,color:'#475569',background:'#FAFAFA',borderTop:'1px solid #F1F5F9'}}>
                        <span style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#94A3B8',marginRight:8}}>Notes</span>
                        {plan.notes}
                      </div>
                    )}

                    {/* Total */}
                    <div style={{padding:'12px 16px',borderTop:'2px solid #F1F5F9',display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10}}>
                      <span style={{fontSize:13,color:'#64748B'}}>Estimated total</span>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:'#0F172A'}}>${(plan.total_fee||0).toFixed(2)} CAD</span>
                    </div>

                    {/* Signature — only for proposed plans */}
                    {plan.status === 'proposed' && (
                      <div style={{padding:'16px',background:'#F0F9FF',borderTop:'1px solid #BAE6FD'}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#0F172A',marginBottom:4}}>Your approval is needed</div>
                        <div style={{fontSize:12,color:'#6B7A99',marginBottom:12}}>
                          Review the procedures and fees above. Type your full name below to electronically approve this treatment plan.
                        </div>
                        <div style={{display:'flex',gap:10,alignItems:'center'}}>
                          <input
                            style={{flex:1,padding:'10px 14px',border:'1.5px solid #BAE6FD',borderRadius:8,fontSize:16,fontFamily:'Georgia,serif',fontStyle:'italic',color:'#0F172A',outline:'none',background:'white'}}
                            placeholder="Type your full name to approve…"
                            value={planSignatures[plan.id] || ''}
                            onChange={e => setPlanSignatures(prev => ({...prev, [plan.id]: e.target.value}))}
                          />
                          <button
                            onClick={async () => {
                              setSigningPlan(plan.id)
                              const sig = planSignatures[plan.id]?.trim()
                              if (!sig) { setSigningPlan(null); return }
                              const res = await fetch('/api/treatment-plans', {
                                method: 'PATCH',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({ planId: plan.id, clinicId: portalClinicId, action: 'sign', signature: sig, signedByName: patientInfo?.full_name })
                              })
                              const d = await res.json()
                              if (d.plan) setPlans(prev => prev.map(p => p.id === plan.id ? d.plan : p))
                              setSigningPlan(null)
                            }}
                            disabled={!planSignatures[plan.id]?.trim() || signingPlan === plan.id}
                            style={{padding:'10px 20px',background:'#0EA5E9',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:'pointer',whiteSpace:'nowrap',opacity:(!planSignatures[plan.id]?.trim()||signingPlan===plan.id)?0.5:1}}
                          >
                            {signingPlan === plan.id ? 'Saving…' : 'Approve ✓'}
                          </button>
                        </div>
                        <div style={{fontSize:11,color:'#94A3B8',marginTop:8}}>
                          By typing your name, you electronically approve this plan and authorize the clinic to proceed.
                        </div>
                      </div>
                    )}

                    {/* Approved confirmation */}
                    {plan.status !== 'proposed' && plan.patient_signature && (
                      <div style={{padding:'14px 16px',background:'#F0FDF4',borderTop:'1px solid #D1FAE5',display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:20}}>✅</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:'#059669'}}>You approved this plan</div>
                          <div style={{fontSize:12,color:'#6B7A99',marginTop:2}}>
                            Signed as: <em style={{fontFamily:'Georgia,serif',fontSize:14,color:'#0F172A'}}>{plan.patient_signature}</em>
                            {plan.patient_signed_at && <span> · {new Date(plan.patient_signed_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          ) : tab === 'invoices' ? (
            <>
              {invoices.length === 0 ? (
                <div className="empty">No invoices on file yet</div>
              ) : invoices.map(inv => {
                const isPaid    = inv.balance_due <= 0
                const isPartial = inv.amount_paid > 0 && !isPaid
                const statusColor = isPaid ? '#059669' : isPartial ? '#D97706' : inv.status === 'overdue' ? '#DC2626' : '#4F46E5'
                const statusBg    = isPaid ? '#D1FAE5' : isPartial ? '#FEF3C7' : inv.status === 'overdue' ? '#FEE2E2' : '#EEF2FF'
                const statusLabel = isPaid ? 'Paid' : isPartial ? 'Partial payment' : inv.status === 'overdue' ? 'Overdue' : 'Payment due'
                return (
                  <div key={inv.id} className="card" style={{marginBottom:14}}>
                    {/* Invoice header */}
                    <div style={{padding:'14px 20px',borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:'#0F172A',fontFamily:"'Syne',sans-serif"}}>{inv.invoice_number}</div>
                        <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>
                          {new Date(inv.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}
                          {inv.due_date && ` · Due: ${new Date(inv.due_date + 'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}`}
                        </div>
                      </div>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:statusBg,color:statusColor}}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Line items */}
                    {inv.invoice_items && inv.invoice_items.length > 0 && (
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:'#FAFAFA'}}>
                            <th style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#94A3B8',padding:'8px 20px',textAlign:'left'}}>Procedure</th>
                            <th style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#94A3B8',padding:'8px 20px',textAlign:'right'}}>Your portion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.invoice_items.map(item => (
                            <tr key={item.id} style={{borderTop:'1px solid #F8FAFC'}}>
                              <td style={{padding:'10px 20px',fontSize:13,color:'#334155'}}>
                                {item.procedure_code && <span style={{display:'inline-block',padding:'1px 7px',background:'#F1F5F9',borderRadius:5,fontSize:10,fontWeight:600,color:'#475569',marginRight:8}}>{item.procedure_code}</span>}
                                {item.description}
                                {item.tooth_number && <span style={{fontSize:11,color:'#94A3B8',marginLeft:6}}>Tooth #{item.tooth_number}</span>}
                              </td>
                              <td style={{padding:'10px 20px',fontSize:13,fontWeight:600,color:'#0F172A',textAlign:'right'}}>${(item.patient_portion||0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Summary */}
                    <div style={{padding:'12px 20px',borderTop:'1px solid #F1F5F9',background:'#FAFAFA'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#64748B',marginBottom:4}}>
                        <span>Insurance covers</span>
                        <span style={{color:'#059669',fontWeight:500}}>−${(inv.insurance_amount||0).toFixed(2)}</span>
                      </div>
                      {inv.amount_paid > 0 && (
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#64748B',marginBottom:4}}>
                          <span>Already paid</span>
                          <span style={{color:'#059669',fontWeight:500}}>−${(inv.amount_paid||0).toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8,paddingTop:8,borderTop:'1px solid #E2E8F0'}}>
                        <span style={{fontSize:14,fontWeight:700,color:'#0F172A'}}>Balance due</span>
                        <span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color: isPaid ? '#059669' : '#0F172A'}}>
                          {isPaid ? '✓ Paid' : `$${(inv.balance_due||0).toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    {/* Notes */}
                    {inv.notes && (
                      <div style={{padding:'10px 20px',fontSize:13,color:'#475569',borderTop:'1px solid #F1F5F9'}}>
                        <span style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#94A3B8',marginRight:8}}>Notes</span>
                        {inv.notes}
                      </div>
                    )}

                    {/* Payment history */}
                    {inv.invoice_payments && inv.invoice_payments.length > 0 && (
                      <div style={{padding:'12px 20px',background:'#F0FDF4',borderTop:'1px solid #BBF7D0'}}>
                        <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#059669',marginBottom:6}}>Payments received</div>
                        {inv.invoice_payments.map(pay => (
                          <div key={pay.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#334155',padding:'2px 0'}}>
                            <span>{new Date(pay.paid_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})} · {pay.method}</span>
                            <span style={{fontWeight:600,color:'#059669'}}>${(pay.amount||0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          ) : (
            <div className="waitlist-card">
              {waitlistEntry ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>You are on the waitlist</div>
                  <div style={{ fontSize: 13, color: '#64748B' }}>We will contact you when a <strong>{waitlistEntry.appointment_type}</strong> slot opens.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Join the waiting list</div>
                  <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>We will notify you when a slot opens.</div>
                  {waitlistError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 14 }}>{waitlistError}</div>}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Appointment type</div>
                    <select style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: 'none' }} value={wlType} onChange={e => setWlType(e.target.value)}>
                      {['cleaning','checkup','filling','consultation','emergency'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                    </select>
                  </div>
                  <button onClick={submitWaitlist} disabled={waitlistLoading} style={{ width: '100%', padding: 11, background: '#0F172A', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontFamily: "'DM Sans',sans-serif", cursor: 'pointer' }}>
                    {waitlistLoading ? 'Adding...' : 'Join waiting list'}
                  </button>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {showBooking && (
        <>
          <div className="booking-overlay" onClick={closeBooking} />
          <div className="booking-panel">
            <div className="booking-header" style={{ borderTop: `3px solid ${clinicColor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="bot-icon">🤖</div>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{clinicName}</div><div style={{ fontSize: 11, color: '#64748B' }}>AI Front Desk — 24/7</div></div>
              </div>
              <button onClick={closeBooking} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 14, color: '#64748B' }}>✕</button>
            </div>
            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`bubble-wrap ${msg.role}`}>
                  {msg.role === 'assistant' && <div className="bot-icon">🤖</div>}
                  <div className={`bubble ${msg.role}`} style={msg.role === 'user' ? { background: clinicColor } : {}}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && <div className="bubble-wrap assistant"><div className="bot-icon">🤖</div><div className="typing"><div className="tdot" /><div className="tdot" /><div className="tdot" /></div></div>}
            </div>
            {messages.length === 1 && !chatLoading && (
              <div className="chips-row">
                {CHIPS.map(chip => <button key={chip} className="chip" style={{ borderColor: clinicColor, color: clinicColor }} onClick={() => sendChat(chip)}>{chip}</button>)}
              </div>
            )}
            <div className="chat-footer">
              <div className="chat-input-row">
                <input className="chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }} placeholder="Type a message..." disabled={chatLoading} autoFocus />
                <button className="send-btn" style={{ background: clinicColor }} onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
