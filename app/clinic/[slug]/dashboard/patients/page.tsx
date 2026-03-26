'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClinicUser } from '../clinic-context'
import { PendingPatientsTab } from './pending-patients-tab'

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

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  incomplete:     { bg: '#F1F5F9', color: '#94A3B8', label: 'Incomplete' },
  pending_review: { bg: '#FEF3C7', color: '#D97706', label: 'Pending review' },
  approved:       { bg: '#D1FAE5', color: '#059669', label: 'Approved' },
  rejected:       { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
}

export default function PatientsPage() {
  // Get clinic context instead of querying staff_accounts
  const { clinicId, staffId, staffName, staffRole } = useClinicUser()
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all')
  const [patients, setPatients] = useState<Patient[]>([])
  const [filtered, setFiltered] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [dentists, setDentists] = useState<{ id: string; full_name: string; role: string }[]>([])
  const [assignedDentistId, setAssignedDentistId] = useState<string>('')
  const [assignedHygienistId, setAssignedHygienistId] = useState<string>('')
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [assignmentSaved, setAssignmentSaved] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [treatmentNotes, setTreatmentNotes] = useState<TreatmentNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [newNote, setNewNote] = useState({
    chiefComplaint: '', findings: '', treatmentDone: '', nextSteps: '', isPrivate: false
  })
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  const supabase = createClient()

  const loadTreatmentNotes = async (patientId: string) => {
    setLoadingNotes(true)
    const res = await fetch(`/api/treatment-notes?patientId=${patientId}&clinicId=${clinicId}`)
    const data = await res.json()
    setTreatmentNotes(data.notes || [])
    setLoadingNotes(false)
  }

  const saveNote = async () => {
    if (!selected || !newNote.findings.trim()) return
    setSavingNote(true)
    const res = await fetch('/api/treatment-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicId,
        patientId:       selected.id,
        writtenBy:       staffId,
        writtenByName:   staffName,
        visitDate:       new Date().toISOString().slice(0, 10),
        appointmentType: null,
        chiefComplaint:  newNote.chiefComplaint,
        findings:        newNote.findings,
        treatmentDone:   newNote.treatmentDone,
        nextSteps:       newNote.nextSteps,
        isPrivate:       newNote.isPrivate,
      })
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

  // Load patients once clinicId is available from context
  useEffect(() => {
    if (!clinicId) return

    const load = async () => {
      const { data } = await supabase.from('patients')
        .select('id, full_name, email, phone_primary, phone_secondary, insurance_provider, intake_status, created_at, date_of_birth, address_line1, city, postal_code, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_language, is_minor, guardian_name, guardian_phone, intake_rejection_reason')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setPatients(data || [])
      setFiltered(data || [])
      setLoading(false)

      const { data: staffData } = await supabase
        .from('staff_accounts')
        .select('id, full_name, role')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .in('role', ['dentist', 'hygienist', 'owner'])
        .order('role')
      setDentists(staffData || [])
    }

    load()
  }, [clinicId])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(patients.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    ))
  }, [search, patients])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })

  const selectPatient = async (p: Patient) => {
    setSelected(p)
    setDetail(null)
    setLoadingDetail(true)
    setAssignedDentistId('')
    setAssignedHygienistId('')
    setTreatmentNotes([])
    setShowAddNote(false)
    setShowReject(false)

    const [med, dental, ins, consents, patientFull] = await Promise.all([
      supabase.from('patient_medical').select('*').eq('patient_id', p.id).eq('clinic_id', clinicId).maybeSingle(),
      supabase.from('patient_dental').select('*').eq('patient_id', p.id).eq('clinic_id', clinicId).maybeSingle(),
      supabase.from('patient_insurance').select('*').eq('patient_id', p.id).eq('clinic_id', clinicId).order('coverage_order'),
      supabase.from('patient_consents').select('*').eq('patient_id', p.id).eq('clinic_id', clinicId).maybeSingle(),
      supabase.from('patients').select('assigned_dentist_id, assigned_hygienist_id').eq('id', p.id).single(),
    ])

    setDetail({
      medical: med.data,
      dental: dental.data,
      insurance: ins.data,
      consents: consents.data,
    })
    setAssignedDentistId(patientFull.data?.assigned_dentist_id || '')
    setAssignedHygienistId(patientFull.data?.assigned_hygienist_id || '')
    setLoadingDetail(false)
    await loadTreatmentNotes(p.id)
  }

  const updateIntakeStatus = async (status: string) => {
    if (!selected) return
    setProcessing(true)
    await supabase.from('patients').update({ intake_status: status, intake_reviewed_at: new Date().toISOString() }).eq('id', selected.id)
    setPatients(prev => prev.map(p => p.id === selected.id ? { ...p, intake_status: status } : p))
    setSelected(prev => prev ? { ...prev, intake_status: status } : null)
    setShowReject(false)
    setRejectionReason('')
    setProcessing(false)
  }

  const saveAssignment = async () => {
    if (!selected) return
    setSavingAssignment(true)
    await supabase.from('patients').update({
      assigned_dentist_id: assignedDentistId || null,
      assigned_hygienist_id: assignedHygienistId || null,
    }).eq('id', selected.id)
    setSavingAssignment(false)
    setAssignmentSaved(true)
    setTimeout(() => setAssignmentSaved(false), 3000)
  }

  return (
    <>
      <style>{`
        .patients-layout { display: flex; gap: 24px; height: calc(100vh - 72px); }
        .patients-list { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; }
        .search-bar { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 10px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none; margin-bottom: 14px; box-sizing: border-box; }
        .search-bar:focus { border-color: #0EA5E9; }
        .patient-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .patient-card { background: white; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
        .patient-card:hover { border-color: #CBD5E1; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .patient-card.active { border-color: #0EA5E9; background: #F0F9FF; }
        .patient-name { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 3px; }
        .patient-meta { font-size: 12px; color: #94A3B8; }
        .status-pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; margin-top: 6px; }
        .detail-panel { flex: 1; overflow-y: auto; background: white; border-radius: 16px; border: 1.5px solid #E2E8F0; padding: 28px; }
        .empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: #CBD5E1; font-size: 14px; }
        .patient-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #F1F5F9; }
        .patient-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
        .patient-subtitle { font-size: 13px; color: #94A3B8; }
        .action-btns { display: flex; gap: 8px; }
        .btn-approve { padding: 8px 16px; background: #059669; color: white; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; }
        .btn-reject { padding: 8px 16px; background: #FEE2E2; color: #DC2626; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; }
        .section { margin-bottom: 24px; }
        .section-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #94A3B8; margin-bottom: 12px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-key { font-size: 11px; color: #94A3B8; margin-bottom: 2px; }
        .info-val { font-size: 13px; color: #0F172A; font-weight: 500; }
        .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; margin: 3px 3px 0 0; }
        .tag-allergy { background: #FEE2E2; color: #DC2626; }
        .tag-med { background: #EFF6FF; color: #1D4ED8; }
        .tag-cond { background: #F0FDF4; color: #059669; }
        .consent-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; margin-bottom: 6px; }
        .check { color: #059669; font-weight: 700; }
        .cross { color: #DC2626; font-weight: 700; }
        .sig-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; margin-top: 8px; }
        .sig-label { font-size: 11px; color: #94A3B8; margin-bottom: 4px; }
        .sig-text { font-size: 14px; color: #0F172A; font-style: italic; }
        .no-data { font-size: 13px; color: #CBD5E1; font-style: italic; }
        .reject-box { margin-top: 8px; }
        .reject-input { width: 100%; padding: 8px 12px; border: 1.5px solid #FECACA; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; margin-bottom: 8px; outline: none; box-sizing: border-box; }
        .assign-row { display: flex; gap: 12px; align-items: flex-end; }
        .assign-select { flex: 1; padding: 8px 12px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; }
        .btn-save-assign { padding: 8px 16px; background: #0F172A; color: white; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; }
        .notes-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .add-note-btn { padding: 6px 12px; background: #EFF6FF; color: #1D4ED8; border: none; border-radius: 6px; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; }
        .note-form { background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
        .note-form-title { font-size: 13px; font-weight: 600; color: #0F172A; margin-bottom: 12px; }
        .note-label { display: block; font-size: 11px; font-weight: 600; color: #64748B; margin-bottom: 4px; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .note-textarea { width: 100%; padding: 8px 12px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; resize: vertical; outline: none; box-sizing: border-box; }
        .note-textarea:focus { border-color: #0EA5E9; }
        .note-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .note-save-btn { padding: 8px 16px; background: #0F172A; color: white; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; }
        .note-save-btn.saved { background: #059669; }
        .note-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .note-cancel-btn { padding: 8px 12px; background: none; color: #94A3B8; border: none; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; }
        .private-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748B; cursor: pointer; margin-left: auto; }
        .note-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
        .note-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .note-date { font-size: 12px; font-weight: 600; color: #0F172A; }
        .note-author { font-size: 12px; color: #94A3B8; }
        .private-badge { padding: 2px 8px; background: #FEF3C7; color: #D97706; border-radius: 10px; font-size: 10px; font-weight: 600; }
        .note-field { margin-bottom: 8px; }
        .note-field-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #94A3B8; margin-bottom: 2px; }
        .note-field-val { font-size: 13px; color: #334155; line-height: 1.5; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>Patients</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setActiveTab('all')} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #E2E8F0', background: activeTab === 'all' ? '#0F172A' : 'white', color: activeTab === 'all' ? 'white' : '#64748B', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>All patients</button>
          <button onClick={() => setActiveTab('pending')} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #FEF3C7', background: activeTab === 'pending' ? '#D97706' : 'white', color: activeTab === 'pending' ? 'white' : '#D97706', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Pending approval</button>
        </div>
      </div>

      {activeTab === 'pending' ? (
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
                <div key={p.id} className={`patient-card ${selected?.id === p.id ? 'active' : ''}`} onClick={() => selectPatient(p)}>
                  <div className="patient-name">{p.full_name}</div>
                  <div className="patient-meta">{p.email}</div>
                  <div className="status-pill" style={{ background: s.bg, color: s.color }}>{s.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="detail-panel">
          {!selected ? (
            <div className="empty-state">Select a patient to view their record</div>
          ) : (
            <>
              <div className="patient-header">
                <div>
                  <div className="patient-title">{selected.full_name}</div>
                  <div className="patient-subtitle">
                    {selected.date_of_birth ? `DOB: ${formatDate(selected.date_of_birth)} · ` : ''}
                    {selected.preferred_language === 'fr' ? 'French' : 'English'}
                    {selected.is_minor ? ' · Minor' : ''}
                  </div>
                </div>
                {selected.intake_status === 'pending_review' && (staffRole === 'owner' || staffRole === 'dentist' || staffRole === 'receptionist') && (
                  <div className="action-btns">
                    <button className="btn-approve" disabled={processing} onClick={() => updateIntakeStatus('approved')}>Approve</button>
                    <button className="btn-reject" onClick={() => setShowReject(v => !v)}>Reject</button>
                  </div>
                )}
              </div>

              {showReject && (
                <div className="reject-box section">
                  <input className="reject-input" placeholder="Reason for rejection..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
                  <button className="btn-reject" disabled={processing} onClick={() => updateIntakeStatus('rejected')}>Confirm rejection</button>
                </div>
              )}

              {loadingDetail ? (
                <div style={{ fontSize: 13, color: '#CBD5E1' }}>Loading record...</div>
              ) : (
                <>
                  {/* Contact */}
                  <div className="section">
                    <div className="section-label">Contact</div>
                    <div className="info-grid">
                      {[
                        ['Email', selected.email],
                        ['Phone', selected.phone_primary || '—'],
                        ['Address', [selected.address_line1, selected.city, selected.postal_code].filter(Boolean).join(', ') || '—'],
                        ['Emergency contact', selected.emergency_contact_name ? `${selected.emergency_contact_name} (${selected.emergency_contact_relationship}) ${selected.emergency_contact_phone}` : '—'],
                      ].map(([k, v]) => (
                        <div key={k}><div className="info-key">{k}</div><div className="info-val">{v}</div></div>
                      ))}
                    </div>
                  </div>

                  {/* Provider assignment */}
                  {(staffRole === 'owner' || staffRole === 'receptionist') && (
                    <div className="section">
                      <div className="section-label">Provider assignment</div>
                      <div className="assign-row">
                        <div style={{ flex: 1 }}>
                          <div className="info-key" style={{ marginBottom: 4 }}>Dentist</div>
                          <select className="assign-select" value={assignedDentistId} onChange={e => setAssignedDentistId(e.target.value)}>
                            <option value="">Unassigned</option>
                            {dentists.filter(d => d.role === 'dentist' || d.role === 'owner').map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="info-key" style={{ marginBottom: 4 }}>Hygienist</div>
                          <select className="assign-select" value={assignedHygienistId} onChange={e => setAssignedHygienistId(e.target.value)}>
                            <option value="">Unassigned</option>
                            {dentists.filter(d => d.role === 'hygienist').map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                          </select>
                        </div>
                        <button className={`btn-save-assign ${assignmentSaved ? '' : ''}`} onClick={saveAssignment} disabled={savingAssignment}>
                          {savingAssignment ? 'Saving...' : assignmentSaved ? '✓ Saved' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Medical */}
                  {detail?.medical ? (
                    <div className="section">
                      <div className="section-label">Medical history</div>
                      <div className="info-grid" style={{ marginBottom: 10 }}>
                        {[
                          ['Physician', (detail.medical as any).physician_name || '—'],
                          ['Last physical', (detail.medical as any).last_physical_date || '—'],
                          ['Smoker', (detail.medical as any).smoker || '—'],
                          ['Alcohol', (detail.medical as any).alcohol_use || '—'],
                          ['Pregnant', (detail.medical as any).is_pregnant === true ? 'Yes' : (detail.medical as any).is_pregnant === false ? 'No' : '—'],
                        ].map(([k, v]) => (
                          <div key={k}><div className="info-key">{k}</div><div className="info-val">{v as string}</div></div>
                        ))}
                      </div>
                      {(detail.medical as any).has_allergies && ((detail.medical as any).allergies as string[]).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div className="info-key" style={{ marginBottom: 4 }}>Allergies</div>
                          {((detail.medical as any).allergies as string[]).map((a: string) => <span key={a} className="tag tag-allergy">{a}</span>)}
                        </div>
                      )}
                      {(detail.medical as any).takes_medications && ((detail.medical as any).medications as string[]).length > 0 && (
                        <div>
                          <div className="info-key" style={{ marginBottom: 4 }}>Medications</div>
                          {((detail.medical as any).medications as string[]).map((m: string) => <span key={m} className="tag tag-med">{m}</span>)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="section">
                      <div className="section-label">Medical history</div>
                      <div className="no-data">Not submitted yet</div>
                    </div>
                  )}

                  {/* Dental */}
                  {detail?.dental ? (
                    <div className="section">
                      <div className="section-label">Dental history</div>
                      <div className="info-grid" style={{ marginBottom: 10 }}>
                        {[
                          ['Last visit', (detail.dental as any).last_visit_date || '—'],
                          ['Last X-rays', (detail.dental as any).last_xray_date || '—'],
                          ['Anxiety', `${(detail.dental as any).dental_anxiety}/5`],
                          ['Previous dentist', (detail.dental as any).previous_dentist_name || '—'],
                          ['Brushing', (detail.dental as any).brushing_frequency || '—'],
                          ['Flossing', (detail.dental as any).flossing_frequency || '—'],
                        ].map(([k, v]) => (
                          <div key={k}><div className="info-key">{k}</div><div className="info-val">{v as string}</div></div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <div className="info-key" style={{ marginBottom: 4 }}>Dental conditions</div>
                        {Object.entries(detail.dental as any)
                          .filter(([k, v]) => v === true && ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj','has_dry_mouth','sensitive_teeth'].includes(k))
                          .map(([k]) => <span key={k} className="tag tag-cond">{k.replace(/has_|had_/g, '').replace(/_/g, ' ')}</span>)}
                        {Object.entries(detail.dental as any).filter(([k, v]) => v === true && ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj','has_dry_mouth','sensitive_teeth'].includes(k)).length === 0 && (
                          <span style={{ fontSize: 13, color: '#94A3B8' }}>None reported</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="section">
                      <div className="section-label">Dental history</div>
                      <div className="no-data">Not submitted yet</div>
                    </div>
                  )}

                  {/* Consents */}
                  {detail?.consents ? (
                    <div className="section">
                      <div className="section-label">Consents & signature</div>
                      {[
                        ['Treatment consent', (detail.consents as any).consent_treatment],
                        ['PIPEDA / Law 25', (detail.consents as any).consent_pipeda],
                        ['Email communications', (detail.consents as any).consent_communication_email],
                        ['SMS reminders', (detail.consents as any).consent_communication_sms],
                      ].map(([label, val]) => (
                        <div key={label as string} className="consent-row">
                          <span className={val ? 'check' : 'cross'}>{val ? '✓' : '✕'}</span>
                          <span>{label}</span>
                        </div>
                      ))}
                      {(detail.consents as any).signature_text && (
                        <div className="sig-box">
                          <div className="sig-label">Electronic signature</div>
                          <div className="sig-text">{(detail.consents as any).signature_text}</div>
                          {(detail.consents as any).signed_at && (
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                              Signed {formatDate((detail.consents as any).signed_at)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="section">
                      <div className="section-label">Consents</div>
                      <div className="no-data">Not submitted yet</div>
                    </div>
                  )}

                  {/* Treatment Notes */}
                  {(staffRole === 'dentist' || staffRole === 'hygienist' || staffRole === 'owner') && (
                    <div className="section">
                      <div className="notes-header">
                        <div className="section-label" style={{ marginBottom: 0 }}>Treatment notes</div>
                        <button className="add-note-btn" onClick={() => setShowAddNote(v => !v)}>
                          {showAddNote ? '✕ Cancel' : '+ Add note'}
                        </button>
                      </div>

                      {showAddNote && (
                        <div className="note-form">
                          <div className="note-form-title">New visit note</div>
                          <label className="note-label">Chief complaint</label>
                          <textarea className="note-textarea" rows={2} placeholder="Patient presented with..." value={newNote.chiefComplaint} onChange={e => setNewNote(p => ({ ...p, chiefComplaint: e.target.value }))} />
                          <label className="note-label">Clinical findings *</label>
                          <textarea className="note-textarea" rows={3} placeholder="Examination findings..." value={newNote.findings} onChange={e => setNewNote(p => ({ ...p, findings: e.target.value }))} />
                          <label className="note-label">Treatment performed</label>
                          <textarea className="note-textarea" rows={2} placeholder="Procedures completed..." value={newNote.treatmentDone} onChange={e => setNewNote(p => ({ ...p, treatmentDone: e.target.value }))} />
                          <label className="note-label">Next steps</label>
                          <textarea className="note-textarea" rows={2} placeholder="Return in 6 months..." value={newNote.nextSteps} onChange={e => setNewNote(p => ({ ...p, nextSteps: e.target.value }))} />
                          <div className="note-actions">
                            <button className={`note-save-btn${noteSaved ? ' saved' : ''}`} onClick={saveNote} disabled={savingNote || !newNote.findings.trim()}>
                              {savingNote ? 'Saving...' : noteSaved ? '✓ Saved' : 'Save note'}
                            </button>
                            <button className="note-cancel-btn" onClick={() => setShowAddNote(false)}>Cancel</button>
                            <label className="private-toggle">
                              <input type="checkbox" checked={newNote.isPrivate} onChange={e => setNewNote(p => ({ ...p, isPrivate: e.target.checked }))} />
                              Staff only
                            </label>
                          </div>
                        </div>
                      )}

                      {loadingNotes ? (
                        <div style={{ fontSize: 13, color: '#CBD5E1', padding: '12px 0' }}>Loading notes...</div>
                      ) : treatmentNotes.length === 0 ? (
                        <div className="no-data">No treatment notes yet</div>
                      ) : treatmentNotes.map(note => (
                        <div key={note.id} className="note-card">
                          <div className="note-meta">
                            <span className="note-date">{new Date(note.visit_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            {note.written_by_name && <span className="note-author">by {note.written_by_name}</span>}
                            {note.appointment_type && <span className="note-author">· {note.appointment_type}</span>}
                            {note.is_private && <span className="private-badge">Private</span>}
                          </div>
                          {note.chief_complaint && <div className="note-field"><div className="note-field-label">Chief complaint</div><div className="note-field-val">{note.chief_complaint}</div></div>}
                          {note.findings && <div className="note-field"><div className="note-field-label">Findings</div><div className="note-field-val">{note.findings}</div></div>}
                          {note.treatment_done && <div className="note-field"><div className="note-field-label">Treatment performed</div><div className="note-field-val">{note.treatment_done}</div></div>}
                          {note.next_steps && <div className="note-field"><div className="note-field-label">Next steps</div><div className="note-field-val">{note.next_steps}</div></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      )}
    </>
  )
}
