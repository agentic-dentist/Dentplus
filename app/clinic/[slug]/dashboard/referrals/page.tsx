'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'

interface Patient {
  id: string
  full_name: string
  email: string | null
  phone_primary: string | null
  date_of_birth: string | null
}

interface Specialist {
  id: string
  full_name: string
  specialty: string
  clinic_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  is_on_dentplus: boolean
  notes: string | null
}

interface Referral {
  id: string
  created_at: string
  status: string
  urgency: string
  specialty: string
  specialist_name: string
  notes: string | null
  is_on_dentplus: boolean
  patients: { full_name: string }[] | { full_name: string } | null
}

const SPECIALTIES = [
  { value: 'orthodontist',    label: 'Orthodontist' },
  { value: 'oral_surgeon',    label: 'Oral Surgeon' },
  { value: 'periodontist',    label: 'Periodontist' },
  { value: 'endodontist',     label: 'Endodontist' },
  { value: 'pediatric',       label: 'Pediatric Dentist' },
  { value: 'prosthodontist',  label: 'Prosthodontist' },
  { value: 'other',           label: 'Other Specialist' },
]

const SPECIALTY_COLOR: Record<string, string> = {
  orthodontist: '#6366F1', oral_surgeon: '#F43F5E', periodontist: '#10B981',
  endodontist: '#F59E0B', pediatric: '#0EA5E9', prosthodontist: '#A78BFA', other: '#94A3B8',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FEF3C7', color: '#D97706' },
  sent:      { bg: '#EFF6FF', color: '#0EA5E9' },
  accepted:  { bg: '#D1FAE5', color: '#059669' },
  completed: { bg: '#F0FDF4', color: '#16A34A' },
  declined:  { bg: '#FEE2E2', color: '#DC2626' },
}

export default function ReferralsPage() {
  const [clinicId, setClinicId]         = useState('')
  const [staffId, setStaffId]           = useState('')
  const [tab, setTab]                   = useState<'create' | 'history' | 'specialists'>('create')

  // Patient search
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [searchingPatient, setSearchingPatient] = useState(false)

  // Specialist selection
  const [specialists, setSpecialists]   = useState<Specialist[]>([])
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null)
  const [specialtyFilter, setSpecialtyFilter] = useState('all')

  // Referral form
  const [notes, setNotes]               = useState('')
  const [urgency, setUrgency]           = useState('routine')
  const [submitting, setSubmitting]     = useState(false)
  const [submitted, setSubmitted]       = useState(false)

  // Add specialist modal
  const [showAddSpecialist, setShowAddSpecialist] = useState(false)
  const [newSpec, setNewSpec]           = useState({
    full_name: '', specialty: 'orthodontist', clinic_name: '',
    email: '', phone: '', address: '', city: '', notes: ''
  })
  const [savingSpec, setSavingSpec]     = useState(false)

  // History
  const [referrals, setReferrals]       = useState<Referral[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()
  const pathname = usePathname()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: staff } = await supabase.from('staff_accounts')
        .select('id, clinic_id').eq('auth_id', user.id).single()
      const { data: owner } = await supabase.from('clinic_owners')
        .select('clinic_id').eq('auth_id', user.id).single()
      const cid = staff?.clinic_id || owner?.clinic_id
      if (!cid) return
      setClinicId(cid)
      setStaffId(staff?.id || '')
      await loadSpecialists(cid)
    }
    init()
  }, [pathname])

  const loadSpecialists = async (cid: string) => {
    const { data } = await supabase.from('specialists')
      .select('*').eq('clinic_id', cid).eq('is_active', true).order('full_name')
    setSpecialists(data || [])
  }

  const loadHistory = async () => {
    setLoadingHistory(true)
    const { data } = await supabase.from('referrals')
      .select('id, created_at, status, urgency, specialty, specialist_name, notes, is_on_dentplus, patients(full_name)')
      .eq('from_clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(50)
    setReferrals(data || [])
    setLoadingHistory(false)
  }

  useEffect(() => {
    if (tab === 'history' && clinicId) loadHistory()
  }, [tab, clinicId])

  // Patient search with debounce
  useEffect(() => {
    if (!patientQuery.trim() || patientQuery.length < 2) {
      setPatientResults([]); return
    }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearchingPatient(true)
      const { data } = await supabase.from('patients')
        .select('id, full_name, email, phone_primary, date_of_birth')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .ilike('full_name', `%${patientQuery}%`)
        .limit(5)
      setPatientResults(data || [])
      setSearchingPatient(false)
    }, 300)
  }, [patientQuery, clinicId])

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p)
    setPatientQuery(p.full_name)
    setPatientResults([])
  }

  const saveSpecialist = async () => {
    if (!newSpec.full_name || !newSpec.specialty) return
    setSavingSpec(true)
    const { data } = await supabase.from('specialists').insert({
      clinic_id: clinicId, ...newSpec
    }).select().single()
    if (data) {
      setSpecialists(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setSelectedSpecialist(data)
    }
    setNewSpec({ full_name: '', specialty: 'orthodontist', clinic_name: '', email: '', phone: '', address: '', city: '', notes: '' })
    setShowAddSpecialist(false)
    setSavingSpec(false)
  }

  const submitReferral = async () => {
    if (!selectedPatient || !selectedSpecialist || !notes.trim()) return
    setSubmitting(true)

    const { data: clinic } = await supabase.from('clinics').select('name').eq('id', clinicId).single()

    const { data, error } = await supabase.from('referrals').insert({
      from_clinic_id:  clinicId,
      patient_id:      selectedPatient.id,
      referred_by:     staffId,
      specialist_id:   selectedSpecialist.id,
      specialist_name: selectedSpecialist.full_name,
      specialty:       selectedSpecialist.specialty,
      to_email:        selectedSpecialist.email,
      notes,
      urgency,
      status:          'pending',
      is_on_dentplus:  selectedSpecialist.is_on_dentplus,
      lead_captured:   !selectedSpecialist.is_on_dentplus,
    }).select('id').single()

    if (!error && data) {
      // Fire lead capture + notification API
      fetch('/api/referrals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralId:    data.id,
          clinicId,
          clinicName:    clinic?.name,
          patientName:   selectedPatient.full_name,
          patientEmail:  selectedPatient.email,
          specialist:    selectedSpecialist,
          notes,
          urgency,
        })
      }).catch(console.error)

      setSubmitted(true)
      setSelectedPatient(null)
      setSelectedSpecialist(null)
      setPatientQuery('')
      setNotes('')
      setUrgency('routine')
      setTimeout(() => setSubmitted(false), 4000)
    }
    setSubmitting(false)
  }

  const filteredSpecialists = specialtyFilter === 'all'
    ? specialists
    : specialists.filter(s => s.specialty === specialtyFilter)

  const usedSpecialties = [...new Set(specialists.map(s => s.specialty))]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400&display=swap');
        *{box-sizing:border-box}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}
        .tabs{display:flex;gap:4px;margin-bottom:20px;background:#F8FAFC;border-radius:9px;padding:3px;width:fit-content}
        .tab{padding:7px 16px;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;border:none;background:transparent;color:#64748B;font-family:'DM Sans',sans-serif;transition:all .15s}
        .tab.active{background:white;color:#0F172A;box-shadow:0 1px 3px rgba(0,0,0,.08)}

        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden}
        .card-header{padding:14px 20px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-size:13px;font-weight:600;color:#0F172A}
        .card-body{padding:16px 20px}

        label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
        input,select,textarea{width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;color:#0F172A;outline:none;transition:border-color .15s;background:white}
        input:focus,select:focus,textarea:focus{border-color:#0EA5E9}
        textarea{resize:vertical;min-height:80px}
        .field{margin-bottom:14px;position:relative}

        /* Patient search */
        .search-results{position:absolute;top:100%;left:0;right:0;background:white;border:1.5px solid #E2E8F0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.08);z-index:20;margin-top:3px}
        .search-result{padding:10px 12px;cursor:pointer;border-bottom:1px solid #F8FAFC;transition:background .1s}
        .search-result:last-child{border-bottom:none}
        .search-result:hover{background:#F0F9FF}
        .result-name{font-size:13px;font-weight:500;color:#0F172A}
        .result-meta{font-size:11px;color:#94A3B8;margin-top:2px;font-family:'JetBrains Mono',monospace}
        .selected-patient{background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
        .selected-name{font-size:14px;font-weight:500;color:#065F46}
        .selected-meta{font-size:11px;color:#16A34A;margin-top:2px}
        .clear-btn{font-size:11px;color:#94A3B8;background:none;border:none;cursor:pointer;padding:0}
        .clear-btn:hover{color:#F43F5E}

        /* Specialist grid */
        .spec-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:320px;overflow-y:auto;padding:4px}
        .spec-card{border:1.5px solid #E2E8F0;border-radius:9px;padding:10px 12px;cursor:pointer;transition:all .15s;background:white}
        .spec-card:hover{border-color:#0EA5E9;background:#F0F9FF}
        .spec-card.selected{border-color:#0EA5E9;background:#EFF6FF}
        .spec-name{font-size:13px;font-weight:500;color:#0F172A}
        .spec-clinic{font-size:11px;color:#64748B;margin-top:2px}
        .spec-badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;margin-top:5px}
        .dentplus-badge{background:#EFF6FF;color:#0EA5E9}
        .external-badge{background:#F1F5F9;color:#64748B}
        .add-spec-btn{border:1.5px dashed #E2E8F0;border-radius:9px;padding:10px 12px;cursor:pointer;background:white;color:#94A3B8;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif;transition:all .15s;text-align:center;width:100%}
        .add-spec-btn:hover{border-color:#0EA5E9;color:#0EA5E9}

        .urgency-row{display:flex;gap:8px}
        .urgency-btn{flex:1;padding:8px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;border:1.5px solid;transition:all .15s}

        .submit-btn{width:100%;padding:12px;background:#0F172A;color:white;border-radius:9px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .15s;margin-top:4px}
        .submit-btn:hover{background:#1E293B}
        .submit-btn:disabled{opacity:.6;cursor:not-allowed}
        .submit-btn.success{background:#10B981}

        /* Filters */
        .filter-row{display:flex;gap:6px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid #F1F5F9}
        .filter-pill{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid;transition:all .15s;background:white;white-space:nowrap}

        /* History table */
        .ref-table{width:100%;border-collapse:collapse}
        .ref-th{padding:10px 16px;font-size:11px;font-weight:600;color:#94A3B8;text-align:left;border-bottom:1px solid #F1F5F9;background:#FAFBFC;text-transform:uppercase;letter-spacing:.3px}
        .ref-row{border-bottom:1px solid #F8FAFC}
        .ref-row:last-child{border-bottom:none}
        .ref-td{padding:11px 16px;font-size:13px;color:#0F172A;vertical-align:middle}
        .badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;display:inline-block}
        .spec-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}

        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(2px)}
        .modal{background:white;border-radius:14px;padding:28px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.15);max-height:90vh;overflow-y:auto}
        .modal-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .modal-sub{font-size:12px;color:#94A3B8;margin-bottom:20px}
        .modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .modal-actions{display:flex;gap:8px;margin-top:20px}
        .modal-cancel{flex:1;padding:10px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif}
        .modal-save{flex:2;padding:10px;background:#0F172A;color:white;border-radius:8px;font-size:13px;font-weight:500;border:none;cursor:pointer;font-family:'DM Sans',sans-serif}
        .modal-save:disabled{opacity:.6;cursor:not-allowed}

        /* Specialist management */
        .spec-list-row{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid #F8FAFC}
        .spec-list-row:last-child{border-bottom:none}
        .spec-info{flex:1}
        .spec-list-name{font-size:14px;font-weight:500;color:#0F172A}
        .spec-list-detail{font-size:12px;color:#94A3B8;margin-top:2px;font-family:'JetBrains Mono',monospace}

        .empty{padding:48px;text-align:center;color:#CBD5E1;font-size:13px}
        .success-banner{background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#065F46;font-weight:500;display:flex;align-items:center;gap:8px}
      `}</style>

      <div className="page-title">Referrals</div>
      <div className="page-sub">Send patients to specialists — every external referral captures a growth lead</div>

      <div className="tabs">
        {([
          { key: 'create',      label: '+ New referral' },
          { key: 'history',     label: '◎ History' },
          { key: 'specialists', label: '◈ My specialists' },
        ] as const).map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ── CREATE TAB ── */}
      {tab === 'create' && (
        <div className="two-col">
          {/* Left — patient + notes */}
          <div>
            {submitted && (
              <div className="success-banner">
                ✓ Referral created — patient notified and lead captured
              </div>
            )}

            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header"><div className="card-title">Patient</div></div>
              <div className="card-body">
                {selectedPatient ? (
                  <div className="selected-patient">
                    <div>
                      <div className="selected-name">{selectedPatient.full_name}</div>
                      <div className="selected-meta">
                        {selectedPatient.phone_primary || selectedPatient.email || '—'}
                      </div>
                    </div>
                    <button className="clear-btn" onClick={() => { setSelectedPatient(null); setPatientQuery('') }}>✕ Change</button>
                  </div>
                ) : (
                  <div className="field">
                    <label>Search by name</label>
                    <input
                      value={patientQuery}
                      onChange={e => setPatientQuery(e.target.value)}
                      placeholder="Type patient name..."
                      autoComplete="off"
                    />
                    {patientResults.length > 0 && (
                      <div className="search-results">
                        {patientResults.map(p => (
                          <div key={p.id} className="search-result" onClick={() => selectPatient(p)}>
                            <div className="result-name">{p.full_name}</div>
                            <div className="result-meta">{p.phone_primary || p.email || '—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchingPatient && <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>Searching...</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Referral details</div></div>
              <div className="card-body">
                <div className="field">
                  <label>Urgency</label>
                  <div className="urgency-row">
                    {[
                      { val: 'routine', label: 'Routine' },
                      { val: 'urgent',  label: 'Urgent' },
                      { val: 'asap',    label: 'ASAP' },
                    ].map(u => (
                      <button key={u.val} className="urgency-btn"
                        style={{
                          background: urgency === u.val ? '#0F172A' : 'white',
                          color: urgency === u.val ? 'white' : '#64748B',
                          borderColor: urgency === u.val ? '#0F172A' : '#E2E8F0',
                        }}
                        onClick={() => setUrgency(u.val)}>{u.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Clinical notes for specialist</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Reason for referral, relevant history, specific concerns..."
                  />
                </div>
                <button
                  className={`submit-btn ${submitted ? 'success' : ''}`}
                  onClick={submitReferral}
                  disabled={!selectedPatient || !selectedSpecialist || !notes.trim() || submitting}
                >
                  {submitting ? 'Sending...' : submitted ? '✓ Referral sent' : 'Send referral'}
                </button>
                {(!selectedPatient || !selectedSpecialist) && (
                  <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', marginTop: '8px' }}>
                    {!selectedPatient ? 'Select a patient' : 'Select a specialist'} to continue
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right — specialist picker */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Select specialist</div>
              {selectedSpecialist && (
                <div style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>
                  ✓ {selectedSpecialist.full_name}
                </div>
              )}
            </div>

            {/* Specialty filter pills */}
            {usedSpecialties.length > 1 && (
              <div className="filter-row">
                <div className="filter-pill"
                  style={specialtyFilter === 'all' ? { background: '#0F172A', borderColor: '#0F172A', color: 'white' } : { borderColor: '#CBD5E1', color: '#64748B' }}
                  onClick={() => setSpecialtyFilter('all')}>All</div>
                {usedSpecialties.map(s => {
                  const spec = SPECIALTIES.find(x => x.value === s)
                  const color = SPECIALTY_COLOR[s] || '#94A3B8'
                  return (
                    <div key={s} className="filter-pill"
                      style={specialtyFilter === s ? { background: color, borderColor: color, color: 'white' } : { borderColor: color, color }}
                      onClick={() => setSpecialtyFilter(s === specialtyFilter ? 'all' : s)}>
                      {spec?.label || s}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ padding: '12px' }}>
              {specialists.length === 0 ? (
                <div className="empty" style={{ padding: '24px' }}>
                  No specialists yet — add your first one below
                </div>
              ) : (
                <div className="spec-grid">
                  {filteredSpecialists.map(s => {
                    const color = SPECIALTY_COLOR[s.specialty] || '#94A3B8'
                    const spec = SPECIALTIES.find(x => x.value === s.specialty)
                    return (
                      <div key={s.id} className={`spec-card ${selectedSpecialist?.id === s.id ? 'selected' : ''}`}
                        onClick={() => setSelectedSpecialist(s)}>
                        <div className="spec-name">{s.full_name}</div>
                        <div className="spec-clinic">{s.clinic_name || spec?.label}</div>
                        <div>
                          <span className="spec-badge" style={{ background: `${color}18`, color }}>
                            {spec?.label || s.specialty}
                          </span>
                          {s.is_on_dentplus && (
                            <span className="spec-badge dentplus-badge" style={{ marginLeft: '4px' }}>DentPlus</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <button className="add-spec-btn" style={{ marginTop: '10px' }}
                onClick={() => setShowAddSpecialist(true)}>
                + Add specialist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="card">
          {loadingHistory ? (
            <div className="empty">Loading...</div>
          ) : referrals.length === 0 ? (
            <div className="empty">No referrals yet</div>
          ) : (
            <table className="ref-table">
              <thead>
                <tr>
                  <th className="ref-th">Patient</th>
                  <th className="ref-th">Specialist</th>
                  <th className="ref-th">Specialty</th>
                  <th className="ref-th">Urgency</th>
                  <th className="ref-th">Status</th>
                  <th className="ref-th">Date</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map(r => {
                  const p = Array.isArray(r.patients) ? r.patients[0] : r.patients
                  const s = STATUS_STYLE[r.status] || STATUS_STYLE.pending
                  const color = SPECIALTY_COLOR[r.specialty] || '#94A3B8'
                  const spec = SPECIALTIES.find(x => x.value === r.specialty)
                  return (
                    <tr key={r.id} className="ref-row">
                      <td className="ref-td" style={{ fontWeight: 500 }}>{p?.full_name || '—'}</td>
                      <td className="ref-td">
                        {r.specialist_name}
                        {r.is_on_dentplus && <span className="badge dentplus-badge" style={{ marginLeft: '6px', fontSize: '10px' }}>DentPlus</span>}
                      </td>
                      <td className="ref-td">
                        <span className="spec-dot" style={{ background: color }} />
                        {spec?.label || r.specialty}
                      </td>
                      <td className="ref-td" style={{ textTransform: 'capitalize' }}>{r.urgency}</td>
                      <td className="ref-td"><span className="badge" style={s}>{r.status}</span></td>
                      <td className="ref-td" style={{ fontSize: '12px', color: '#94A3B8' }}>
                        {new Date(r.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' , timeZone: 'America/Toronto' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── SPECIALISTS TAB ── */}
      {tab === 'specialists' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Your specialist network ({specialists.length})</div>
            <button style={{ padding: '6px 14px', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '12px', color: '#64748B', background: 'white', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}
              onClick={() => setShowAddSpecialist(true)}>+ Add specialist</button>
          </div>
          {specialists.length === 0 ? (
            <div className="empty">No specialists added yet</div>
          ) : specialists.map(s => {
            const color = SPECIALTY_COLOR[s.specialty] || '#94A3B8'
            const spec = SPECIALTIES.find(x => x.value === s.specialty)
            return (
              <div key={s.id} className="spec-list-row">
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                  {s.specialty === 'orthodontist' ? '◎' : s.specialty === 'oral_surgeon' ? '✕' : s.specialty === 'periodontist' ? '◈' : '·'}
                </div>
                <div className="spec-info">
                  <div className="spec-list-name">
                    {s.full_name}
                    {s.is_on_dentplus && <span className="badge dentplus-badge" style={{ marginLeft: '8px' }}>DentPlus</span>}
                  </div>
                  <div className="spec-list-detail">
                    {spec?.label}{s.clinic_name ? ` · ${s.clinic_name}` : ''}{s.city ? ` · ${s.city}` : ''}{s.email ? ` · ${s.email}` : ''}
                  </div>
                </div>
                <button onClick={async () => {
                  await supabase.from('specialists').update({ is_active: false }).eq('id', s.id)
                  setSpecialists(prev => prev.filter(x => x.id !== s.id))
                }} style={{ fontSize: '11px', color: '#CBD5E1', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ADD SPECIALIST MODAL ── */}
      {showAddSpecialist && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddSpecialist(false)}>
          <div className="modal">
            <div className="modal-title">Add a specialist</div>
            <div className="modal-sub">Saved to your clinic's specialist network for future referrals</div>
            <div className="modal-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Full name *</label>
                <input value={newSpec.full_name} onChange={e => setNewSpec(p => ({ ...p, full_name: e.target.value }))} placeholder="Dr. Marie Tremblay" />
              </div>
              <div className="field">
                <label>Specialty *</label>
                <select value={newSpec.specialty} onChange={e => setNewSpec(p => ({ ...p, specialty: e.target.value }))}>
                  {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Clinic name</label>
                <input value={newSpec.clinic_name} onChange={e => setNewSpec(p => ({ ...p, clinic_name: e.target.value }))} placeholder="Clinique Ortho Montréal" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={newSpec.email} onChange={e => setNewSpec(p => ({ ...p, email: e.target.value }))} placeholder="dr.tremblay@clinique.ca" />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={newSpec.phone} onChange={e => setNewSpec(p => ({ ...p, phone: e.target.value }))} placeholder="514-555-0000" />
              </div>
              <div className="field">
                <label>Address</label>
                <input value={newSpec.address} onChange={e => setNewSpec(p => ({ ...p, address: e.target.value }))} placeholder="123 Rue Principale" />
              </div>
              <div className="field">
                <label>City</label>
                <input value={newSpec.city} onChange={e => setNewSpec(p => ({ ...p, city: e.target.value }))} placeholder="Montréal" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes (optional)</label>
                <input value={newSpec.notes} onChange={e => setNewSpec(p => ({ ...p, notes: e.target.value }))} placeholder="Accepts emergency cases, bilingual..." />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowAddSpecialist(false)}>Cancel</button>
              <button className="modal-save" onClick={saveSpecialist} disabled={!newSpec.full_name || savingSpec}>
                {savingSpec ? 'Saving...' : 'Add specialist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
