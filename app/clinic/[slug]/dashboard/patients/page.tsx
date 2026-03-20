'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Patient {
  id: string
  full_name: string
  email: string
  phone_primary: string | null
  insurance_provider: string | null
  intake_status: string
  created_at: string
  date_of_birth: string | null
  address_line1: string | null
  city: string | null
  postal_code: string | null
  phone_secondary: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  preferred_language: string | null
  is_minor: boolean
  guardian_name: string | null
  guardian_phone: string | null
}

interface PatientDetail {
  medical: Record<string, unknown> | null
  dental: Record<string, unknown> | null
  insurance: Record<string, unknown>[] | null
  consents: Record<string, unknown> | null
}

const CLINIC_ID = process.env.NEXT_PUBLIC_DEMO_CLINIC_ID!

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  incomplete: { bg: '#F1F5F9', color: '#94A3B8', label: 'Incomplete' },
  pending_review: { bg: '#FEF3C7', color: '#D97706', label: 'Pending review' },
  approved: { bg: '#D1FAE5', color: '#059669', label: 'Approved' },
  rejected: { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [filtered, setFiltered] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [detail, setDetail] = useState<PatientDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('patients')
      .select('id, full_name, email, phone_primary, phone_secondary, insurance_provider, intake_status, created_at, date_of_birth, address_line1, city, postal_code, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_language, is_minor, guardian_name, guardian_phone')
      .eq('clinic_id', CLINIC_ID)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPatients(data || [])
        setFiltered(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(patients.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone_primary || '').includes(q)
    ))
  }, [search, patients])

  const loadDetail = async (patient: Patient) => {
    setSelected(patient)
    setDetail(null)
    setLoadingDetail(true)
    setShowReject(false)
    setRejectionReason('')

    const [{ data: medical }, { data: dental }, { data: insurance }, { data: consents }] = await Promise.all([
      supabase.from('patient_medical').select('*').eq('patient_id', patient.id).single(),
      supabase.from('patient_dental').select('*').eq('patient_id', patient.id).single(),
      supabase.from('patient_insurance').select('*').eq('patient_id', patient.id),
      supabase.from('patient_consents').select('*').eq('patient_id', patient.id).single()
    ])

    setDetail({ medical, dental, insurance, consents })
    setLoadingDetail(false)
  }

  const approve = async () => {
    if (!selected) return
    setProcessing(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: staff } = await supabase.from('staff_accounts').select('id').eq('auth_id', user!.id).single()
    await supabase.from('patients').update({
      intake_status: 'approved',
      intake_reviewed_at: new Date().toISOString(),
      intake_reviewed_by: staff?.id
    }).eq('id', selected.id)
    setPatients(prev => prev.map(p => p.id === selected.id ? { ...p, intake_status: 'approved' } : p))
    setSelected(prev => prev ? { ...prev, intake_status: 'approved' } : null)
    setProcessing(false)
  }

  const reject = async () => {
    if (!selected) return
    setProcessing(true)
    await supabase.from('patients').update({
      intake_status: 'rejected',
      intake_reviewed_at: new Date().toISOString(),
      intake_rejection_reason: rejectionReason
    }).eq('id', selected.id)
    setPatients(prev => prev.map(p => p.id === selected.id ? { ...p, intake_status: 'rejected' } : p))
    setSelected(prev => prev ? { ...prev, intake_status: 'rejected' } : null)
    setShowReject(false)
    setProcessing(false)
  }

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric'
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&display=swap');
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .page-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #0F172A; }
        .search { padding: 9px 14px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; width: 260px; transition: border-color .15s; }
        .search:focus { border-color: #0EA5E9; }
        .table-wrap { background: white; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; }
        .table { width: 100%; border-collapse: collapse; }
        .th { padding: 11px 16px; text-align: left; font-size: 10.5px; font-weight: 600; letter-spacing: .8px; text-transform: uppercase; color: #94A3B8; border-bottom: 1px solid #F1F5F9; background: #FAFBFC; }
        .tr { border-bottom: 1px solid #F8FAFC; cursor: pointer; transition: background .1s; }
        .tr:last-child { border-bottom: none; }
        .tr:hover { background: #F8FAFC; }
        .td { padding: 13px 16px; font-size: 14px; color: #0F172A; }
        .patient-cell { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 34px; height: 34px; border-radius: 50%; background: #E0F2FE; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #0284C7; flex-shrink: 0; }
        .pt-name { font-weight: 500; color: #0F172A; }
        .pt-email { font-size: 12px; color: #94A3B8; margin-top: 1px; }
        .status-badge { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .pending-count { background: #FEF3C7; color: #D97706; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .empty { text-align: center; padding: 48px; color: #CBD5E1; font-size: 14px; }

        /* Slide-out panel */
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100; }
        .panel { position: fixed; top: 0; right: 0; width: 520px; height: 100vh; background: white; z-index: 101; overflow-y: auto; box-shadow: -4px 0 32px rgba(0,0,0,0.12); display: flex; flex-direction: column; }
        .panel-header { padding: 20px 24px; border-bottom: 1px solid #F1F5F9; display: flex; align-items: flex-start; justify-content: space-between; position: sticky; top: 0; background: white; z-index: 10; }
        .panel-name { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #0F172A; }
        .panel-email { font-size: 13px; color: #64748B; margin-top: 2px; }
        .close-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #E2E8F0; background: white; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .close-btn:hover { background: #F8FAFC; }
        .panel-body { padding: 20px 24px; flex: 1; }
        .panel-actions { display: flex; gap: 10px; margin-bottom: 20px; }
        .btn-approve { padding: 9px 20px; background: #10B981; color: white; border-radius: 8px; font-size: 13px; font-weight: 500; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background .15s; }
        .btn-approve:hover { background: #059669; }
        .btn-approve:disabled { opacity: .5; cursor: not-allowed; }
        .btn-reject { padding: 9px 20px; background: #FEF2F2; color: #F87171; border-radius: 8px; font-size: 13px; font-weight: 500; border: 1.5px solid #FECACA; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .section { margin-bottom: 20px; }
        .section-label { font-size: 10.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #94A3B8; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #F1F5F9; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-item { }
        .info-key { font-size: 11px; color: #94A3B8; font-weight: 500; margin-bottom: 2px; }
        .info-val { font-size: 13px; color: #0F172A; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin: 2px; }
        .tag-allergy { background: #FEF2F2; color: #F87171; }
        .tag-med { background: #EFF6FF; color: #0EA5E9; }
        .tag-cond { background: #F0FDF4; color: #059669; }
        .consent-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; padding: 5px 0; }
        .check { color: #10B981; font-weight: 700; font-size: 14px; }
        .cross { color: #F87171; font-weight: 700; font-size: 14px; }
        .sig-box { background: #F8FAFC; border-radius: 8px; padding: 12px; margin-top: 8px; }
        .sig-label { font-size: 11px; color: #94A3B8; margin-bottom: 4px; }
        .sig-text { font-size: 16px; font-style: italic; color: #0F172A; }
        .reject-box { background: #FFF; border: 1px solid #FECACA; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
        textarea { width: 100%; padding: 8px 12px; border: 1.5px solid #E2E8F0; border-radius: 7px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; resize: none; }
        .btn-sm { padding: 7px 14px; border-radius: 7px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; border: none; }
        .btn-cancel-sm { background: #F8FAFC; color: #475569; border: 1.5px solid #E2E8F0 !important; }
        .btn-confirm-reject { background: #F87171; color: white; }
        .emergency-banner { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
        .emergency-title { font-size: 12px; font-weight: 700; color: #C2410C; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
        .emergency-items { display: flex; flex-wrap: wrap; gap: 6px; }
        .no-intake { text-align: center; padding: 32px; color: #94A3B8; font-size: 13px; }
        .loading-panel { text-align: center; padding: 48px; color: #CBD5E1; font-size: 13px; }
      `}</style>

      <div className="header">
        <div>
          <div className="page-title">Patients</div>
          {patients.filter(p => p.intake_status === 'pending_review').length > 0 && (
            <span className="pending-count" style={{ marginTop: '4px', display: 'inline-block' }}>
              {patients.filter(p => p.intake_status === 'pending_review').length} pending review
            </span>
          )}
        </div>
        <input
          className="search"
          placeholder="Search patients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No patients found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="th">Patient</th>
                <th className="th">Phone</th>
                <th className="th">Insurance</th>
                <th className="th">Intake</th>
                <th className="th">Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const s = STATUS_STYLE[p.intake_status] || STATUS_STYLE.incomplete
                return (
                  <tr key={p.id} className="tr" onClick={() => loadDetail(p)}>
                    <td className="td">
                      <div className="patient-cell">
                        <div className="avatar">{initials(p.full_name)}</div>
                        <div>
                          <div className="pt-name">{p.full_name}</div>
                          <div className="pt-email">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td" style={{ color: '#64748B' }}>{p.phone_primary || '—'}</td>
                    <td className="td" style={{ color: '#64748B' }}>{p.insurance_provider || '—'}</td>
                    <td className="td">
                      <span className="status-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td className="td" style={{ color: '#94A3B8', fontSize: '12px' }}>{formatDate(p.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-out panel */}
      {selected && (
        <>
          <div className="overlay" onClick={() => setSelected(null)} />
          <div className="panel">
            <div className="panel-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '14px' }}>{initials(selected.full_name)}</div>
                  <div>
                    <div className="panel-name">{selected.full_name}</div>
                    <div className="panel-email">{selected.email}</div>
                  </div>
                </div>
                <span className="status-badge" style={{ background: STATUS_STYLE[selected.intake_status]?.bg, color: STATUS_STYLE[selected.intake_status]?.color, marginLeft: '50px' }}>
                  {STATUS_STYLE[selected.intake_status]?.label}
                </span>
              </div>
              <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="panel-body">
              {/* Approve / Reject actions */}
              {selected.intake_status === 'pending_review' && (
                <>
                  <div className="panel-actions">
                    <button className="btn-approve" onClick={approve} disabled={processing}>✓ Approve patient</button>
                    <button className="btn-reject" onClick={() => setShowReject(!showReject)}>✕ Reject</button>
                  </div>
                  {showReject && (
                    <div className="reject-box">
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', marginBottom: '8px' }}>Reason (optional)</div>
                      <textarea rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="e.g. Missing information..." />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button className="btn-sm btn-cancel-sm" onClick={() => setShowReject(false)}>Cancel</button>
                        <button className="btn-sm btn-confirm-reject" onClick={reject} disabled={processing}>Confirm rejection</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {loadingDetail ? (
                <div className="loading-panel">Loading patient details...</div>
              ) : !detail?.medical && !detail?.dental ? (
                <>
                  {/* Basic info even without intake */}
                  <div className="section">
                    <div className="section-label">Contact</div>
                    <div className="info-grid">
                      {[
                        ['Date of birth', selected.date_of_birth || '—'],
                        ['Primary phone', selected.phone_primary || '—'],
                        ['Secondary phone', selected.phone_secondary || '—'],
                        ['Language', selected.preferred_language === 'fr' ? 'Français' : 'English'],
                        ['Address', selected.address_line1 ? `${selected.address_line1}, ${selected.city}` : '—'],
                        ['Postal code', selected.postal_code || '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="info-item">
                          <div className="info-key">{k}</div>
                          <div className="info-val">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selected.emergency_contact_name && (
                    <div className="section">
                      <div className="section-label">Emergency contact</div>
                      <div className="info-grid">
                        <div className="info-item"><div className="info-key">Name</div><div className="info-val">{selected.emergency_contact_name}</div></div>
                        <div className="info-item"><div className="info-key">Phone</div><div className="info-val">{selected.emergency_contact_phone}</div></div>
                        <div className="info-item"><div className="info-key">Relationship</div><div className="info-val">{selected.emergency_contact_relationship || '—'}</div></div>
                      </div>
                    </div>
                  )}

                  <div className="no-intake">Intake form not yet submitted</div>
                </>
              ) : (
                <>
                  {/* Emergency banner - allergies and medications at top */}
                  {(detail.medical as any)?.has_allergies && ((detail.medical as any)?.allergies || []).length > 0 && (
                    <div className="emergency-banner">
                      <div className="emergency-title">⚠ Allergies — review before treatment</div>
                      <div className="emergency-items">
                        {((detail.medical as any).allergies || []).map((a: any, i: number) => (
                          <span key={i} className="tag tag-allergy">{a.name} {a.severity ? `(${a.severity})` : ''}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact */}
                  <div className="section">
                    <div className="section-label">Contact</div>
                    <div className="info-grid">
                      {[
                        ['Date of birth', selected.date_of_birth || '—'],
                        ['Primary phone', selected.phone_primary || '—'],
                        ['Secondary phone', selected.phone_secondary || '—'],
                        ['Address', selected.address_line1 ? `${selected.address_line1}, ${selected.city}` : '—'],
                        ['Language', selected.preferred_language === 'fr' ? 'Français' : 'English'],
                      ].map(([k, v]) => (
                        <div key={k} className="info-item">
                          <div className="info-key">{k}</div>
                          <div className="info-val">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Emergency contact */}
                  {selected.emergency_contact_name && (
                    <div className="section">
                      <div className="section-label">Emergency contact</div>
                      <div className="info-grid">
                        <div className="info-item"><div className="info-key">Name</div><div className="info-val">{selected.emergency_contact_name}</div></div>
                        <div className="info-item"><div className="info-key">Phone</div><div className="info-val">{selected.emergency_contact_phone}</div></div>
                        <div className="info-item"><div className="info-key">Relationship</div><div className="info-val">{selected.emergency_contact_relationship || '—'}</div></div>
                      </div>
                    </div>
                  )}

                  {/* Insurance */}
                  {detail.insurance && (detail.insurance as any[]).length > 0 && (
                    <div className="section">
                      <div className="section-label">Insurance</div>
                      {(detail.insurance as any[]).map((ins, i) => (
                        <div key={i} style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'capitalize' }}>
                            {ins.coverage_order} insurance
                          </div>
                          <div className="info-grid">
                            {[
                              ['Provider', ins.provider_name],
                              ['Policy #', ins.policy_number || '—'],
                              ['Certificate #', ins.certificate_number || '—'],
                              ['Group #', ins.group_number || '—'],
                            ].map(([k, v]) => (
                              <div key={k} className="info-item">
                                <div className="info-key">{k}</div>
                                <div className="info-val">{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Medical */}
                  {detail.medical && (
                    <div className="section">
                      <div className="section-label">Medical history</div>

                      {(detail.medical as any).takes_medications && (
                        <div style={{ marginBottom: '10px' }}>
                          <div className="info-key" style={{ marginBottom: '4px' }}>Medications</div>
                          <div>
                            {((detail.medical as any).medications || []).map((m: any, i: number) => (
                              <span key={i} className="tag tag-med">{m.name} {m.dosage} — {m.frequency}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ marginBottom: '10px' }}>
                        <div className="info-key" style={{ marginBottom: '4px' }}>Conditions</div>
                        {Object.entries((detail.medical as any).conditions || {})
                          .filter(([k, v]) => v === true && k !== 'other')
                          .map(([k]) => <span key={k} className="tag tag-cond">{k.replace(/_/g, ' ')}</span>)}
                        {(detail.medical as any).conditions?.other && (
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{(detail.medical as any).conditions.other}</div>
                        )}
                        {Object.values((detail.medical as any).conditions || {}).every(v => !v) && (
                          <span style={{ fontSize: '13px', color: '#94A3B8' }}>None reported</span>
                        )}
                      </div>

                      <div className="info-grid">
                        {[
                          ['Smoker', (detail.medical as any).smoker || '—'],
                          ['Pregnant', (detail.medical as any).is_pregnant ? 'Yes' : 'No'],
                          ['Physician', (detail.medical as any).physician_name || '—'],
                          ['Physician phone', (detail.medical as any).physician_phone || '—'],
                        ].map(([k, v]) => (
                          <div key={k} className="info-item">
                            <div className="info-key">{k}</div>
                            <div className="info-val">{v as string}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dental */}
                  {detail.dental && (
                    <div className="section">
                      <div className="section-label">Dental history</div>
                      <div className="info-grid">
                        {[
                          ['Chief complaint', (detail.dental as any).chief_complaint || '—'],
                          ['Last visit', (detail.dental as any).last_visit_date || '—'],
                          ['Last X-rays', (detail.dental as any).last_xray_date || '—'],
                          ['Anxiety', `${(detail.dental as any).dental_anxiety}/5`],
                          ['Previous dentist', (detail.dental as any).previous_dentist_name || '—'],
                          ['Brushing', (detail.dental as any).brushing_frequency || '—'],
                          ['Flossing', (detail.dental as any).flossing_frequency || '—'],
                        ].map(([k, v]) => (
                          <div key={k} className="info-item">
                            <div className="info-key">{k}</div>
                            <div className="info-val">{v as string}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <div className="info-key" style={{ marginBottom: '4px' }}>Dental conditions</div>
                        {Object.entries(detail.dental as any)
                          .filter(([k, v]) => v === true && ['has_crowns','has_bridges','has_implants','has_dentures','had_orthodontics','has_gum_disease','grinds_teeth','has_tmj','has_dry_mouth','sensitive_teeth'].includes(k))
                          .map(([k]) => <span key={k} className="tag tag-cond">{k.replace(/has_|had_/g, '').replace(/_/g, ' ')}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Consents */}
                  {detail.consents && (
                    <div className="section">
                      <div className="section-label">Consents</div>
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
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                              Signed {formatDate((detail.consents as any).signed_at)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
