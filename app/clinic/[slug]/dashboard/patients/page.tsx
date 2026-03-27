'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClinicUser } from '../clinic-context'
import { PendingPatientsTab } from './pending-patients-tab'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string
  full_name: string
  email: string
  phone_primary: string | null
  phone_secondary: string | null
  insurance_provider: string | null
  intake_status: string
  created_at: string
  date_of_birth: string | null
  address_line1: string | null
  city: string | null
  postal_code: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  preferred_language: string | null
  is_minor: boolean
  guardian_name: string | null
  guardian_phone: string | null
  intake_rejection_reason: string | null
}

interface TreatmentNote {
  id: string
  visit_date: string
  appointment_type: string | null
  written_by_name: string | null
  chief_complaint: string | null
  findings: string | null
  treatment_done: string | null
  next_steps: string | null
  is_private: boolean
  created_at: string
}

interface Slot {
  startTime: string
  endTime: string
  display: string
  date: string
}

type ChartTab = 'overview' | 'appointments' | 'notes' | 'treatment-plan' | 'clinical' | 'billing'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  incomplete:     { bg: '#F1F5F9', color: '#94A3B8', label: 'Incomplete' },
  pending_review: { bg: '#FEF3C7', color: '#D97706', label: 'Pending review' },
  approved:       { bg: '#D1FAE5', color: '#059669', label: 'Approved' },
  rejected:       { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
}

const CHART_TABS: { id: ChartTab; label: string; icon: string }[] = [
  { id: 'overview',        label: 'Overview',       icon: '◈' },
  { id: 'appointments',    label: 'Appointments',   icon: '◷' },
  { id: 'notes',           label: 'Notes',          icon: '✎' },
  { id: 'treatment-plan',  label: 'Treatment Plan', icon: '◉' },
  { id: 'clinical',        label: 'Clinical',       icon: '⬡' },
  { id: 'billing',         label: 'Billing',        icon: '◎' },
]

const APPT_STATUS: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: '#EFF6FF', color: '#1D4ED8' },
  confirmed:  { bg: '#D1FAE5', color: '#059669' },
  completed:  { bg: '#F1F5F9', color: '#64748B' },
  cancelled:  { bg: '#FEE2E2', color: '#DC2626' },
  no_show:    { bg: '#FEF3C7', color: '#D97706' },
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .patients-layout  { display: flex; gap: 24px; height: calc(100vh - 100px); }
  .patients-list    { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; }
  .search-bar       { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 10px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none; margin-bottom: 14px; box-sizing: border-box; }
  .search-bar:focus { border-color: #0EA5E9; }
  .patient-scroll   { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .patient-card     { background: white; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
  .patient-card:hover  { border-color: #CBD5E1; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .patient-card.active { border-color: #0EA5E9; background: #F0F9FF; }
  .patient-name     { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 3px; }
  .patient-meta     { font-size: 12px; color: #94A3B8; }
  .status-pill      { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; margin-top: 6px; }
  .list-placeholder { flex: 1; background: white; border-radius: 16px; border: 1.5px solid #E2E8F0; display: flex; align-items: center; justify-content: center; }
  .placeholder-text { font-size: 14px; color: #CBD5E1; text-align: center; line-height: 1.8; }

  /* Chart overlay */
  .chart-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: #F0F4F8;
    display: flex; flex-direction: column;
    animation: chartSlideUp 0.18s ease;
  }
  @keyframes chartSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Chart header */
  .chart-header {
    background: white; border-bottom: 1.5px solid #E2E8F0;
    padding: 0 32px; display: flex; align-items: stretch;
    height: 62px; flex-shrink: 0;
  }
  .chart-header-id {
    display: flex; align-items: center; gap: 14px;
    padding-right: 28px; border-right: 1px solid #F1F5F9;
    min-width: 260px; flex-shrink: 0;
  }
  .close-btn {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1.5px solid #E2E8F0; background: white;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: #64748B; flex-shrink: 0; transition: all 0.15s;
  }
  .close-btn:hover { background: #F8FAFC; border-color: #CBD5E1; color: #0F172A; }
  .chart-patient-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #0F172A; }
  .chart-patient-sub  { font-size: 11.5px; color: #94A3B8; margin-top: 2px; }

  /* Tab bar */
  .chart-tabs { display: flex; align-items: stretch; flex: 1; padding: 0 6px; }
  .chart-tab  {
    display: flex; align-items: center; gap: 7px; padding: 0 16px;
    border: none; background: none; cursor: pointer;
    font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500;
    color: #94A3B8; border-bottom: 2.5px solid transparent;
    transition: all 0.15s; white-space: nowrap;
  }
  .chart-tab:hover  { color: #475569; }
  .chart-tab.active { color: #0EA5E9; border-bottom-color: #0EA5E9; }

  /* Chart body */
  .chart-body       { flex: 1; overflow-y: auto; padding: 32px 40px; }
  .chart-inner      { max-width: 860px; margin: 0 auto; }

  /* Shared */
  .section       { margin-bottom: 26px; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #94A3B8; margin-bottom: 12px; }
  .card-box      { background: white; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 20px 24px; }
  .info-grid     { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-key      { font-size: 11px; color: #94A3B8; margin-bottom: 2px; }
  .info-val      { font-size: 13px; color: #0F172A; font-weight: 500; line-height: 1.5; }
  .no-data       { font-size: 13px; color: #CBD5E1; font-style: italic; }
  .tag           { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; margin: 3px 3px 0 0; }
  .tag-allergy   { background: #FEE2E2; color: #DC2626; }
  .tag-med       { background: #EFF6FF; color: #1D4ED8; }
  .tag-cond      { background: #F0FDF4; color: #059669; }

  /* Action row */
  .action-row  { display: flex; gap: 10px; margin-bottom: 22px; }
  .btn-approve { padding: 9px 20px; background: #059669; color: white; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; font-weight: 500; }
  .btn-approve:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-reject  { padding: 9px 20px; background: #FEE2E2; color: #DC2626; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; font-weight: 500; }
  .reject-box  { background: white; border: 1.5px solid #FECACA; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
  .reject-input { width: 100%; padding: 9px 12px; border: 1.5px solid #FECACA; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; margin-bottom: 10px; outline: none; box-sizing: border-box; }

  /* Provider */
  .assign-row   { display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: flex-end; }
  .assign-sel   { width: 100%; padding: 9px 12px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: white; }
  .assign-sel:focus { border-color: #0EA5E9; }
  .btn-save     { padding: 9px 20px; background: #0F172A; color: white; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap; }
  .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-save.saved { background: #059669; }

  /* Consents */
  .consent-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #475569; padding: 10px 0; border-bottom: 1px solid #F8FAFC; }
  .consent-row:last-child { border-bottom: none; }
  .check { color: #059669; font-size: 14px; font-weight: 700; }
  .cross { color: #DC2626; font-size: 14px; font-weight: 700; }
  .sig-box  { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-top: 12px; }
  .sig-label { font-size: 11px; color: #94A3B8; margin-bottom: 4px; }
  .sig-text  { font-size: 14px; color: #0F172A; font-style: italic; }

  /* Appointments */
  .appt-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #F8FAFC; }
  .appt-row:last-child { border-bottom: none; }
  .appt-status-pill { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }

  /* Notes */
  .notes-topbar   { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .add-note-btn   { padding: 8px 16px; background: #EFF6FF; color: #1D4ED8; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; font-weight: 500; }
  .note-form      { background: white; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 20px 24px; margin-bottom: 18px; }
  .note-form-title { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 16px; }
  .note-label     { display: block; font-size: 11px; font-weight: 600; color: #64748B; margin-bottom: 5px; margin-top: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
  .note-textarea  { width: 100%; padding: 10px 12px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; resize: vertical; outline: none; box-sizing: border-box; line-height: 1.5; }
  .note-textarea:focus { border-color: #0EA5E9; }
  .note-form-foot { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #F1F5F9; }
  .btn-save-note  { padding: 9px 20px; background: #0F172A; color: white; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .btn-save-note.saved { background: #059669; }
  .btn-save-note:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-cancel-note { padding: 9px 12px; background: none; color: #94A3B8; border: none; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .private-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748B; cursor: pointer; margin-left: auto; }
  .note-card      { background: white; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 18px 22px; margin-bottom: 10px; }
  .note-meta      { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #F1F5F9; flex-wrap: wrap; }
  .note-date      { font-size: 13px; font-weight: 600; color: #0F172A; }
  .note-author    { font-size: 12px; color: #94A3B8; }
  .private-badge  { padding: 2px 8px; background: #FEF3C7; color: #D97706; border-radius: 10px; font-size: 10px; font-weight: 600; margin-left: auto; }
  .note-field       { margin-bottom: 10px; }
  .note-field:last-child { margin-bottom: 0; }
  .note-field-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #94A3B8; margin-bottom: 3px; }
  .note-field-val   { font-size: 13px; color: #334155; line-height: 1.6; }

  /* Coming soon */
  .coming-soon       { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 360px; gap: 12px; }
  .coming-soon-icon  { font-size: 38px; opacity: 0.2; }
  .coming-soon-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #94A3B8; }
  .coming-soon-sub   { font-size: 13px; color: #CBD5E1; text-align: center; max-width: 320px; line-height: 1.6; }

  /* Cancel / Reschedule modals */
  .modal-backdrop   { position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 400; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-box        { background: white; border-radius: 16px; padding: 28px; width: 480px; max-width: calc(100vw - 48px); box-shadow: 0 24px 60px rgba(0,0,0,0.18); animation: modalUp 0.18s ease; }
  .modal-box.wide   { width: 560px; }
  @keyframes modalUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .modal-title      { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: #0F172A; margin-bottom: 6px; }
  .modal-sub        { font-size: 13px; color: #64748B; margin-bottom: 20px; line-height: 1.5; }
  .modal-appt-card  { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; }
  .modal-appt-date  { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 2px; }
  .modal-appt-meta  { font-size: 12px; color: #94A3B8; }
  .modal-footer     { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 18px; border-top: 1px solid #F1F5F9; }
  .btn-modal-cancel  { padding: 9px 18px; background: none; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: #64748B; cursor: pointer; }
  .btn-modal-cancel:hover  { border-color: #CBD5E1; }
  .btn-modal-confirm { padding: 9px 20px; background: #DC2626; color: white; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; font-weight: 500; }
  .btn-modal-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-modal-primary { padding: 9px 20px; background: #0F172A; color: white; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; font-weight: 500; }
  .btn-modal-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Slot picker */
  .slot-loading     { font-size: 13px; color: #94A3B8; padding: 24px 0; text-align: center; }
  .slot-group       { margin-bottom: 16px; }
  .slot-group-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94A3B8; margin-bottom: 8px; }
  .slot-grid        { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .slot-btn         { padding: 8px 6px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 12px; font-family: 'DM Sans', sans-serif; color: #334155; background: white; cursor: pointer; text-align: center; transition: all 0.12s; line-height: 1.3; }
  .slot-btn:hover   { border-color: #0EA5E9; color: #0EA5E9; background: #F0F9FF; }
  .slot-btn.selected { border-color: #0EA5E9; background: #0EA5E9; color: white; font-weight: 500; }
  .slot-scroll      { max-height: 320px; overflow-y: auto; padding-right: 4px; }
  .no-slots         { font-size: 13px; color: #CBD5E1; padding: 24px 0; text-align: center; }
`

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const { clinicId, staffId, staffName, staffRole } = useClinicUser()

  const [pageTab, setPageTab]   = useState<'all' | 'pending'>('all')
  const [patients, setPatients] = useState<Patient[]>([])
  const [filtered, setFiltered] = useState<Patient[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)

  const [selected, setSelected]   = useState<Patient | null>(null)
  const [chartTab, setChartTab]   = useState<ChartTab>('overview')
  const [detail, setDetail]       = useState<Record<string, unknown> | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [dentists, setDentists]               = useState<{ id: string; full_name: string; role: string }[]>([])
  const [assignedDentistId, setAssignedDentistId]     = useState('')
  const [assignedHygienistId, setAssignedHygienistId] = useState('')
  const [savingAssignment, setSavingAssignment]       = useState(false)
  const [assignmentSaved, setAssignmentSaved]         = useState(false)

  const [processing, setProcessing]     = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject]     = useState(false)

  const [treatmentNotes, setTreatmentNotes] = useState<TreatmentNote[]>([])
  const [loadingNotes, setLoadingNotes]     = useState(false)
  const [showAddNote, setShowAddNote]       = useState(false)
  const [newNote, setNewNote] = useState({ chiefComplaint: '', findings: '', treatmentDone: '', nextSteps: '', isPrivate: false })
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved]   = useState(false)

  const [appointments, setAppointments]   = useState<any[]>([])
  const [loadingAppts, setLoadingAppts]   = useState(false)

  // Cancel modal
  const [cancelTarget, setCancelTarget]         = useState<any | null>(null)
  const [cancelling, setCancelling]             = useState(false)
  const [cancelError, setCancelError]           = useState('')

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<any | null>(null)
  const [slots, setSlots]                       = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots]         = useState(false)
  const [selectedSlot, setSelectedSlot]         = useState<Slot | null>(null)
  const [rescheduling, setRescheduling]         = useState(false)
  const [rescheduleError, setRescheduleError]   = useState('')


  const supabase = createClient()

  // Load patients
  useEffect(() => {
    if (!clinicId) return
    const load = async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, email, phone_primary, phone_secondary, insurance_provider, intake_status, created_at, date_of_birth, address_line1, city, postal_code, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_language, is_minor, guardian_name, guardian_phone, intake_rejection_reason')
        .eq('clinic_id', clinicId).eq('is_active', true).order('created_at', { ascending: false })
      setPatients(data || [])
      setFiltered(data || [])
      setLoading(false)
      const { data: sd } = await supabase.from('staff_accounts').select('id, full_name, role').eq('clinic_id', clinicId).eq('is_active', true).in('role', ['dentist', 'hygienist', 'owner']).order('role')
      setDentists(sd || [])
    }
    load()
  }, [clinicId])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(patients.filter(p => p.full_name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)))
  }, [search, patients])

  // Open chart
  const openChart = async (p: Patient) => {
    setSelected(p)
    setChartTab('overview')
    setDetail(null)
    setLoadingDetail(true)
    setAssignedDentistId('')
    setAssignedHygienistId('')
    setTreatmentNotes([])
    setAppointments([])
    setShowAddNote(false)
    setShowReject(false)

    const [med, dental, ins, consents, patientFull] = await Promise.all([
      supabase.from('patient_medical').select('*').eq('patient_id', p.id).eq('clinic_id', clinicId).maybeSingle(),
      supabase.from('patient_dental').select('*').eq('patient_id', p.id).eq('clinic_id', clinicId).maybeSingle(),
      supabase.from('patient_insurance').select('*').eq('patient_id', p.id).eq('clinic_id', clinicId).order('coverage_order'),
      supabase.from('patient_consents').select('*').eq('patient_id', p.id).eq('clinic_id', clinicId).maybeSingle(),
      supabase.from('patients').select('assigned_dentist_id, assigned_hygienist_id').eq('id', p.id).single(),
    ])
    setDetail({ medical: med.data, dental: dental.data, insurance: ins.data, consents: consents.data })
    setAssignedDentistId(patientFull.data?.assigned_dentist_id || '')
    setAssignedHygienistId(patientFull.data?.assigned_hygienist_id || '')
    setLoadingDetail(false)

    loadNotes(p.id)
    loadAppts(p.id)
  }

  const closeChart = () => { setSelected(null); setDetail(null) }

  // Notes
  const loadNotes = async (pid: string) => {
    setLoadingNotes(true)
    const res = await fetch(`/api/treatment-notes?patientId=${pid}&clinicId=${clinicId}`)
    const data = await res.json()
    setTreatmentNotes(data.notes || [])
    setLoadingNotes(false)
  }

  const saveNote = async () => {
    if (!selected || !newNote.findings.trim()) return
    setSavingNote(true)
    const res = await fetch('/api/treatment-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, patientId: selected.id, writtenBy: staffId, writtenByName: staffName, visitDate: new Date().toISOString().slice(0, 10), appointmentType: null, chiefComplaint: newNote.chiefComplaint, findings: newNote.findings, treatmentDone: newNote.treatmentDone, nextSteps: newNote.nextSteps, isPrivate: newNote.isPrivate })
    })
    const data = await res.json()
    if (data.note) {
      setTreatmentNotes(prev => [data.note, ...prev])
      setNewNote({ chiefComplaint: '', findings: '', treatmentDone: '', nextSteps: '', isPrivate: false })
      setShowAddNote(false)
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
    }
    setSavingNote(false)
  }

  // Appointments
  const loadAppts = async (pid: string) => {
    setLoadingAppts(true)
    const { data } = await supabase.from('appointments').select('id, start_time, end_time, appointment_type, status, notes, staff_accounts(full_name)').eq('patient_id', pid).eq('clinic_id', clinicId).order('start_time', { ascending: false })
    setAppointments(data || [])
    setLoadingAppts(false)
  }

  // Approve / reject
  const updateStatus = async (status: string) => {
    if (!selected) return
    setProcessing(true)
    await supabase.from('patients').update({ intake_status: status, intake_reviewed_at: new Date().toISOString() }).eq('id', selected.id)
    setPatients(prev => prev.map(p => p.id === selected.id ? { ...p, intake_status: status } : p))
    setSelected(prev => prev ? { ...prev, intake_status: status } : null)
    setShowReject(false); setRejectionReason('')
    setProcessing(false)
  }

  // Provider assignment
  const saveAssignment = async () => {
    if (!selected) return
    setSavingAssignment(true)
    await supabase.from('patients').update({ assigned_dentist_id: assignedDentistId || null, assigned_hygienist_id: assignedHygienistId || null }).eq('id', selected.id)
    setSavingAssignment(false); setAssignmentSaved(true)
    setTimeout(() => setAssignmentSaved(false), 3000)
  }


  // ── Cancel / Reschedule ───────────────────────────────────────────────────

  const openCancelModal = (appt: any) => {
    setCancelTarget(appt)
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
      setAppointments(prev => prev.map(a => a.id === cancelTarget.id ? { ...a, status: 'cancelled' } : a))
      setCancelTarget(null)
    } catch { setCancelError('Something went wrong') }
    setCancelling(false)
  }

  const openRescheduleModal = async (appt: any) => {
    setRescheduleTarget(appt)
    setSelectedSlot(null)
    setRescheduleError('')
    setSlots([])
    setLoadingSlots(true)
    const providerId = appt.provider_id
    if (!providerId) { setLoadingSlots(false); return }
    const res = await fetch(`/api/appointments/slots?clinicId=${clinicId}&providerId=${providerId}&duration=60&excludeAppointmentId=${appt.id}`)
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
      setAppointments(prev => prev.map(a => a.id === rescheduleTarget.id ? { ...a, start_time: selectedSlot.startTime, end_time: selectedSlot.endTime, status: 'scheduled' } : a))
      setRescheduleTarget(null)
    } catch { setRescheduleError('Something went wrong') }
    setRescheduling(false)
  }

  // Helpers
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Toronto' })

  // ── Tab renderers ─────────────────────────────────────────────────────────

  const TabOverview = () => {
    const d = detail
    if (loadingDetail) return <div className="no-data" style={{ padding: '32px 0' }}>Loading record...</div>
    return (
      <>
        {selected?.intake_status === 'pending_review' && (staffRole === 'owner' || staffRole === 'dentist' || staffRole === 'receptionist') && (
          <div className="action-row">
            <button className="btn-approve" disabled={processing} onClick={() => updateStatus('approved')}>✓ Approve patient</button>
            <button className="btn-reject" onClick={() => setShowReject(v => !v)}>Reject</button>
          </div>
        )}
        {showReject && (
          <div className="reject-box section">
            <input className="reject-input" placeholder="Reason for rejection..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
            <button className="btn-reject" disabled={processing} onClick={() => updateStatus('rejected')}>Confirm rejection</button>
          </div>
        )}

        <div className="section">
          <div className="section-label">Contact</div>
          <div className="card-box">
            <div className="info-grid">
              {[['Email', selected?.email], ['Phone', selected?.phone_primary || '—'], ['Address', [selected?.address_line1, selected?.city, selected?.postal_code].filter(Boolean).join(', ') || '—'], ['Emergency contact', selected?.emergency_contact_name ? `${selected.emergency_contact_name} (${selected.emergency_contact_relationship}) ${selected.emergency_contact_phone}` : '—']].map(([k, v]) => (
                <div key={k as string}><div className="info-key">{k}</div><div className="info-val">{v as string}</div></div>
              ))}
            </div>
          </div>
        </div>

        {(staffRole === 'owner' || staffRole === 'receptionist') && (
          <div className="section">
            <div className="section-label">Provider assignment</div>
            <div className="card-box">
              <div className="assign-row">
                <div>
                  <div className="info-key" style={{ marginBottom: 6 }}>Dentist</div>
                  <select className="assign-sel" value={assignedDentistId} onChange={e => setAssignedDentistId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {dentists.filter(d => d.role === 'dentist' || d.role === 'owner').map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="info-key" style={{ marginBottom: 6 }}>Hygienist</div>
                  <select className="assign-sel" value={assignedHygienistId} onChange={e => setAssignedHygienistId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {dentists.filter(d => d.role === 'hygienist').map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
                <button className={`btn-save${assignmentSaved ? ' saved' : ''}`} onClick={saveAssignment} disabled={savingAssignment}>
                  {savingAssignment ? 'Saving...' : assignmentSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="section">
          <div className="section-label">Medical history</div>
          {d?.medical ? (
            <div className="card-box">
              <div className="info-grid" style={{ marginBottom: 14 }}>
                {[['Physician', (d.medical as any).physician_name || '—'], ['Last physical', (d.medical as any).last_physical_date || '—'], ['Smoker', (d.medical as any).smoker || '—'], ['Alcohol', (d.medical as any).alcohol_use || '—'], ['Pregnant', (d.medical as any).is_pregnant === true ? 'Yes' : (d.medical as any).is_pregnant === false ? 'No' : '—']].map(([k, v]) => (
                  <div key={k as string}><div className="info-key">{k}</div><div className="info-val">{v as string}</div></div>
                ))}
              </div>
              {(d.medical as any).has_allergies && ((d.medical as any).allergies as string[])?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div className="info-key" style={{ marginBottom: 5 }}>Allergies</div>
                  {((d.medical as any).allergies as string[]).map((a: string) => <span key={a} className="tag tag-allergy">{a}</span>)}
                </div>
              )}
              {(d.medical as any).takes_medications && ((d.medical as any).medications as any[])?.length > 0 && (
                <div>
                  <div className="info-key" style={{ marginBottom: 5 }}>Medications</div>
                  {((d.medical as any).medications as any[]).map((m: any, i: number) => {
                    const label = typeof m === 'object' ? [m.name, m.dosage, m.frequency].filter(Boolean).join(' · ') : m
                    return <span key={i} className="tag tag-med">{label}</span>
                  })}
                </div>
              )}
            </div>
          ) : <div className="card-box"><div className="no-data">Not submitted yet</div></div>}
        </div>

        <div className="section">
          <div className="section-label">Dental history</div>
          {d?.dental ? (
            <div className="card-box">
              <div className="info-grid" style={{ marginBottom: 14 }}>
                {[['Last visit', (d.dental as any).last_visit_date || '—'], ['Last X-rays', (d.dental as any).last_xray_date || '—'], ['Anxiety', `${(d.dental as any).dental_anxiety}/5`], ['Previous dentist', (d.dental as any).previous_dentist_name || '—'], ['Brushing', (d.dental as any).brushing_frequency || '—'], ['Flossing', (d.dental as any).flossing_frequency || '—']].map(([k, v]) => (
                  <div key={k as string}><div className="info-key">{k}</div><div className="info-val">{v as string}</div></div>
                ))}
              </div>
              <div>
                <div className="info-key" style={{ marginBottom: 5 }}>Dental conditions</div>
                {Object.entries(d.dental as any).filter(([k, v]) => v === true && ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj','has_dry_mouth','sensitive_teeth'].includes(k)).map(([k]) => <span key={k} className="tag tag-cond">{k.replace(/has_|had_/g, '').replace(/_/g, ' ')}</span>)}
                {Object.entries(d.dental as any).filter(([k, v]) => v === true && ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj','has_dry_mouth','sensitive_teeth'].includes(k)).length === 0 && <span className="no-data">None reported</span>}
              </div>
            </div>
          ) : <div className="card-box"><div className="no-data">Not submitted yet</div></div>}
        </div>

        <div className="section">
          <div className="section-label">Consents & signature</div>
          {d?.consents ? (
            <div className="card-box">
              {[['Treatment consent', (d.consents as any).consent_treatment], ['PIPEDA / Law 25', (d.consents as any).consent_pipeda], ['Email communications', (d.consents as any).consent_communication_email], ['SMS reminders', (d.consents as any).consent_communication_sms]].map(([label, val]) => (
                <div key={label as string} className="consent-row">
                  <span className={val ? 'check' : 'cross'}>{val ? '✓' : '✕'}</span>
                  <span>{label}</span>
                </div>
              ))}
              {(d.consents as any).signature_text && (
                <div className="sig-box">
                  <div className="sig-label">Electronic signature</div>
                  <div className="sig-text">{(d.consents as any).signature_text}</div>
                  {(d.consents as any).signed_at && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Signed {fmtDate((d.consents as any).signed_at)}</div>}
                </div>
              )}
            </div>
          ) : <div className="card-box"><div className="no-data">Not submitted yet</div></div>}
        </div>
      </>
    )
  }

  const TabAppointments = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Appointments</div>
        <button style={{ padding: '8px 18px', background: '#0F172A', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", opacity: 0.35, cursor: 'not-allowed' }} disabled>+ Book appointment</button>
      </div>
      {loadingAppts ? (
        <div className="no-data">Loading...</div>
      ) : appointments.length === 0 ? (
        <div className="card-box"><div className="no-data" style={{ padding: '20px 0', textAlign: 'center' }}>No appointments on record</div></div>
      ) : (
        <div className="card-box">
          {appointments.map(appt => {
            const s = APPT_STATUS[appt.status] || APPT_STATUS.scheduled
            const provider = Array.isArray(appt.staff_accounts) ? appt.staff_accounts[0] : appt.staff_accounts
            return (
              <div key={appt.id} className="appt-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{fmtDate(appt.start_time)} · {fmtTime(appt.start_time)}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{appt.appointment_type?.replace(/_/g, ' ')}{provider?.full_name ? ` · ${provider.full_name}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="appt-status-pill" style={{ background: s.bg, color: s.color }}>{appt.status}</div>
                  {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        style={{ padding: '5px 12px', border: '1.5px solid #E2E8F0', borderRadius: 6, fontSize: 12, background: 'white', color: '#334155', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s' }}
                        onClick={() => openRescheduleModal(appt)}
                      >Reschedule</button>
                      <button
                        style={{ padding: '5px 12px', border: '1.5px solid #FECACA', borderRadius: 6, fontSize: 12, background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s' }}
                        onClick={() => openCancelModal(appt)}
                      >Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  const TabNotes = () => {
    const canWrite = staffRole === 'dentist' || staffRole === 'hygienist' || staffRole === 'owner'
    return (
      <>
        <div className="notes-topbar">
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Treatment notes</div>
          {canWrite && <button className="add-note-btn" onClick={() => setShowAddNote(v => !v)}>{showAddNote ? '✕ Cancel' : '+ Add note'}</button>}
        </div>
        {showAddNote && (
          <div className="note-form">
            <div className="note-form-title">New visit note</div>
            <label className="note-label">Chief complaint</label>
            <textarea className="note-textarea" rows={2} placeholder="Patient presented with..." value={newNote.chiefComplaint} onChange={e => setNewNote(p => ({ ...p, chiefComplaint: e.target.value }))} />
            <label className="note-label">Clinical findings *</label>
            <textarea className="note-textarea" rows={3} placeholder="Examination findings..." value={newNote.findings} onChange={e => setNewNote(p => ({ ...p, findings: e.target.value }))} />
            <label className="note-label">Treatment performed</label>
            <textarea className="note-textarea" rows={2} placeholder="Procedures completed today..." value={newNote.treatmentDone} onChange={e => setNewNote(p => ({ ...p, treatmentDone: e.target.value }))} />
            <label className="note-label">Next steps</label>
            <textarea className="note-textarea" rows={2} placeholder="Return in 6 months..." value={newNote.nextSteps} onChange={e => setNewNote(p => ({ ...p, nextSteps: e.target.value }))} />
            <div className="note-form-foot">
              <button className={`btn-save-note${noteSaved ? ' saved' : ''}`} onClick={saveNote} disabled={savingNote || !newNote.findings.trim()}>
                {savingNote ? 'Saving...' : noteSaved ? '✓ Saved' : 'Save note'}
              </button>
              <button className="btn-cancel-note" onClick={() => setShowAddNote(false)}>Cancel</button>
              <label className="private-toggle">
                <input type="checkbox" checked={newNote.isPrivate} onChange={e => setNewNote(p => ({ ...p, isPrivate: e.target.checked }))} />
                Staff only
              </label>
            </div>
          </div>
        )}
        {loadingNotes ? (
          <div className="no-data" style={{ padding: '24px 0' }}>Loading notes...</div>
        ) : treatmentNotes.length === 0 ? (
          <div className="card-box"><div className="no-data" style={{ padding: '20px 0', textAlign: 'center' }}>No treatment notes yet</div></div>
        ) : treatmentNotes.map(note => (
          <div key={note.id} className="note-card">
            <div className="note-meta">
              <span className="note-date">{new Date(note.visit_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              {note.written_by_name && <span className="note-author">by {note.written_by_name}</span>}
              {note.appointment_type && <span className="note-author">· {note.appointment_type}</span>}
              {note.is_private && <span className="private-badge">Staff only</span>}
            </div>
            {note.chief_complaint && <div className="note-field"><div className="note-field-label">Chief complaint</div><div className="note-field-val">{note.chief_complaint}</div></div>}
            {note.findings && <div className="note-field"><div className="note-field-label">Findings</div><div className="note-field-val">{note.findings}</div></div>}
            {note.treatment_done && <div className="note-field"><div className="note-field-label">Treatment performed</div><div className="note-field-val">{note.treatment_done}</div></div>}
            {note.next_steps && <div className="note-field"><div className="note-field-label">Next steps</div><div className="note-field-val">{note.next_steps}</div></div>}
          </div>
        ))}
      </>
    )
  }

  const ComingSoon = ({ icon, title, sub }: { icon: string; title: string; sub: string }) => (
    <div className="coming-soon">
      <div className="coming-soon-icon">{icon}</div>
      <div className="coming-soon-title">{title}</div>
      <div className="coming-soon-sub">{sub}</div>
    </div>
  )

  const renderChartTab = () => {
    switch (chartTab) {
      case 'overview':       return <TabOverview />
      case 'appointments':   return <TabAppointments />
      case 'notes':          return <TabNotes />
      case 'treatment-plan': return <ComingSoon icon="◉" title="Treatment Planning" sub="Procedure codes (ADA/CDA), cost estimates, and patient approval signatures — coming next build." />
      case 'clinical':       return <ComingSoon icon="⬡" title="Clinical" sub="Prescriptions, lab orders, and X-ray attachments — coming soon." />
      case 'billing':        return <ComingSoon icon="◎" title="Billing" sub="Invoices, payment tracking, and insurance coverage breakdown — coming soon." />
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>Patients</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPageTab('all')} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #E2E8F0', background: pageTab === 'all' ? '#0F172A' : 'white', color: pageTab === 'all' ? 'white' : '#64748B', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>All patients</button>
          <button onClick={() => setPageTab('pending')} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #FEF3C7', background: pageTab === 'pending' ? '#D97706' : 'white', color: pageTab === 'pending' ? 'white' : '#D97706', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Pending approval</button>
        </div>
      </div>

      {pageTab === 'pending' ? (
        <PendingPatientsTab />
      ) : (
        <div className="patients-layout">
          <div className="patients-list">
            <input className="search-bar" placeholder="Search patients..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="patient-scroll">
              {loading ? (
                <div style={{ fontSize: 13, color: '#CBD5E1', padding: 12 }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ fontSize: 13, color: '#CBD5E1', padding: 12 }}>No patients found.</div>
              ) : filtered.map(p => {
                const s = STATUS_STYLE[p.intake_status] || STATUS_STYLE.incomplete
                return (
                  <div key={p.id} className={`patient-card ${selected?.id === p.id ? 'active' : ''}`} onClick={() => openChart(p)}>
                    <div className="patient-name">{p.full_name}</div>
                    <div className="patient-meta">{p.email}</div>
                    <div className="status-pill" style={{ background: s.bg, color: s.color }}>{s.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="list-placeholder">
            <div className="placeholder-text">Select a patient<br />to open their chart</div>
          </div>
        </div>
      )}

      {/* ── Full-screen chart overlay ── */}
      {selected && (
        <div className="chart-overlay">
          <div className="chart-header">
            <div className="chart-header-id">
              <button className="close-btn" onClick={closeChart} title="Close chart">✕</button>
              <div>
                <div className="chart-patient-name">{selected.full_name}</div>
                <div className="chart-patient-sub">
                  {selected.date_of_birth ? `DOB: ${fmtDate(selected.date_of_birth)} · ` : ''}
                  {selected.preferred_language === 'fr' ? 'French' : 'English'}
                  {selected.is_minor ? ' · Minor' : ''}
                  {' · '}
                  <span style={{ color: STATUS_STYLE[selected.intake_status]?.color || '#94A3B8' }}>
                    {STATUS_STYLE[selected.intake_status]?.label || selected.intake_status}
                  </span>
                </div>
              </div>
            </div>
            <div className="chart-tabs">
              {CHART_TABS.map(tab => (
                <button key={tab.id} className={`chart-tab ${chartTab === tab.id ? 'active' : ''}`} onClick={() => setChartTab(tab.id)}>
                  <span style={{ fontSize: 12 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-body">
            <div className="chart-inner">
              {renderChartTab()}
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel modal ── */}
      {cancelTarget && (
        <div className="modal-backdrop" onClick={() => setCancelTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Cancel appointment</div>
            <div className="modal-sub">This cannot be undone. The slot will become available for other patients to book.</div>
            <div className="modal-appt-card">
              <div className="modal-appt-date">{fmtDate(cancelTarget.start_time)} · {fmtTime(cancelTarget.start_time)}</div>
              <div className="modal-appt-meta">{cancelTarget.appointment_type?.replace(/_/g, ' ')}</div>
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
            <div className="modal-sub">Pick a new available slot for {selected?.full_name}.</div>
            <div className="modal-appt-card">
              <div className="modal-appt-date">Current: {fmtDate(rescheduleTarget.start_time)} · {fmtTime(rescheduleTarget.start_time)}</div>
              <div className="modal-appt-meta">{rescheduleTarget.appointment_type?.replace(/_/g, ' ')}</div>
            </div>
            <div className="slot-scroll">
              {loadingSlots ? (
                <div className="slot-loading">Finding available slots...</div>
              ) : slots.length === 0 ? (
                <div className="no-slots">No available slots found in the next 60 days.</div>
              ) : (
                Object.entries(
                  slots.reduce((acc, s) => {
                    (acc[s.date] = acc[s.date] || []).push(s)
                    return acc
                  }, {} as Record<string, typeof slots>)
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
