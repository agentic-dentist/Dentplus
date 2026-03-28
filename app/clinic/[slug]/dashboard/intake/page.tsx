'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PendingPatient {
  id: string
  full_name: string
  email: string
  phone_primary: string | null
  date_of_birth: string | null
  intake_submitted_at: string
  intake_status: string
  address_line1: string | null
  city: string | null
}

export default function IntakeReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const [pending, setPending] = useState<PendingPatient[]>([])
  const [selected, setSelected] = useState<PendingPatient | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: staff } = await supabase.from('staff_accounts')
        .select('clinic_id').eq('auth_id', user.id).single()
      if (!staff) return

      const { data } = await supabase.from('patients')
        .select('id, full_name, email, phone_primary, date_of_birth, intake_submitted_at, intake_status, address_line1, city')
        .eq('clinic_id', staff.clinic_id)
        .eq('intake_status', 'pending_review')
        .order('intake_submitted_at')
      setPending(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const loadDetail = async (patient: PendingPatient) => {
    setSelected(patient)
    const [{ data: medical }, { data: dental }, { data: insurance }, { data: consents }] = await Promise.all([
      supabase.from('patient_medical').select('*').eq('patient_id', patient.id).single(),
      supabase.from('patient_dental').select('*').eq('patient_id', patient.id).single(),
      supabase.from('patient_insurance').select('*').eq('patient_id', patient.id),
      supabase.from('patient_consents').select('*').eq('patient_id', patient.id).single()
    ])
    setDetail({ medical, dental, insurance, consents })
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
    setPending(prev => prev.filter(p => p.id !== selected.id))
    setSelected(null); setDetail(null)
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
    setPending(prev => prev.filter(p => p.id !== selected.id))
    setSelected(null); setDetail(null); setShowReject(false); setRejectionReason('')
    setProcessing(false)
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  , timeZone: 'America/Toronto' })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&display=swap');
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}
        .layout{display:grid;grid-template-columns:300px 1fr;gap:16px}
        .patient-card{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:14px;cursor:pointer;transition:all .15s;margin-bottom:10px}
        .patient-card:hover{border-color:#CBD5E1}
        .patient-card.active{border-color:#0EA5E9;background:#EFF6FF}
        .patient-name{font-size:14px;font-weight:600;color:#0F172A}
        .patient-meta{font-size:12px;color:#94A3B8;margin-top:2px}
        .submitted-at{font-size:11px;color:#CBD5E1;margin-top:6px}
        .detail-panel{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:24px}
        .detail-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #F1F5F9}
        .detail-name{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#0F172A}
        .detail-email{font-size:13px;color:#64748B;margin-top:2px}
        .action-btns{display:flex;gap:10px}
        .btn-approve{padding:9px 20px;background:#10B981;color:white;border-radius:8px;font-size:13px;font-weight:500;border:none;cursor:pointer;font-family:'DM Sans',sans-serif}
        .btn-approve:hover{background:#059669}
        .btn-reject{padding:9px 20px;background:#FEF2F2;color:#F87171;border-radius:8px;font-size:13px;font-weight:500;border:1.5px solid #FECACA;cursor:pointer;font-family:'DM Sans',sans-serif}
        .section{margin-bottom:20px}
        .section-label{font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94A3B8;margin-bottom:10px}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .info-key{font-size:11px;color:#94A3B8;font-weight:500;margin-bottom:2px}
        .info-val{font-size:13px;color:#0F172A}
        .tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:#FEF2F2;color:#F87171;margin:2px}
        .tag.med{background:#EFF6FF;color:#0EA5E9}
        .tag.cond{background:#F0FDF4;color:#10B981}
        .consent-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#475569;padding:4px 0}
        .check{color:#10B981;font-weight:700}
        .cross{color:#F87171;font-weight:700}
        .reject-box{background:white;border-radius:10px;border:1px solid #FECACA;padding:16px;margin-top:12px}
        textarea{width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;resize:none}
        .btn-sm{padding:8px 14px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;border:none}
        .btn-cancel-sm{background:#F8FAFC;color:#475569;border:1.5px solid #E2E8F0 !important}
        .btn-confirm-reject{background:#F87171;color:white}
        .empty{text-align:center;padding:48px;color:#CBD5E1;font-size:14px}
        .empty-icon{font-size:32px;margin-bottom:12px}
        .placeholder{text-align:center;padding:48px;color:#CBD5E1;font-size:14px}
      `}</style>

      <div className="page-title">Intake review</div>
      <div className="page-sub">{pending.length} patient{pending.length !== 1 ? 's' : ''} pending review</div>

      {loading ? <div className="placeholder">Loading...</div> : pending.length === 0 ? (
        <div className="empty"><div className="empty-icon">✅</div>All intake forms reviewed.</div>
      ) : (
        <div className="layout">
          <div>
            {pending.map(p => (
              <div key={p.id} className={`patient-card ${selected?.id === p.id ? 'active' : ''}`} onClick={() => loadDetail(p)}>
                <div className="patient-name">{p.full_name}</div>
                <div className="patient-meta">{p.email}</div>
                {p.phone_primary && <div className="patient-meta">{p.phone_primary}</div>}
                <div className="submitted-at">Submitted {formatDate(p.intake_submitted_at)}</div>
              </div>
            ))}
          </div>

          <div className="detail-panel">
            {!selected ? <div className="placeholder">Select a patient to review</div> : (
              <>
                <div className="detail-header">
                  <div>
                    <div className="detail-name">{selected.full_name}</div>
                    <div className="detail-email">{selected.email}</div>
                  </div>
                  <div className="action-btns">
                    <button className="btn-approve" onClick={approve} disabled={processing}>✓ Approve</button>
                    <button className="btn-reject" onClick={() => setShowReject(!showReject)}>✕ Reject</button>
                  </div>
                </div>

                {showReject && (
                  <div className="reject-box">
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', marginBottom: '8px' }}>Reason for rejection (optional)</div>
                    <textarea rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Missing information, incomplete form..." />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button className="btn-sm btn-cancel-sm" onClick={() => setShowReject(false)}>Cancel</button>
                      <button className="btn-sm btn-confirm-reject" onClick={reject} disabled={processing}>Confirm rejection</button>
                    </div>
                  </div>
                )}

                <div className="section">
                  <div className="section-label">Contact</div>
                  <div className="info-grid">
                    {[['DOB', selected.date_of_birth || '—'], ['Phone', selected.phone_primary || '—'], ['Address', selected.address_line1 ? `${selected.address_line1}, ${selected.city}` : '—']].map(([k, v]) => (
                      <div key={k}><div className="info-key">{k}</div><div className="info-val">{v}</div></div>
                    ))}
                  </div>
                </div>

                {detail?.medical && (
                  <div className="section">
                    <div className="section-label">Medical</div>
                    {(detail.medical as any).has_allergies && <div style={{ marginBottom: '8px' }}>
                      <div className="info-key" style={{ marginBottom: '4px' }}>Allergies</div>
                      {((detail.medical as any).allergies || []).map((a: any, i: number) => <span key={i} className="tag">{a.name}</span>)}
                    </div>}
                    {(detail.medical as any).takes_medications && <div style={{ marginBottom: '8px' }}>
                      <div className="info-key" style={{ marginBottom: '4px' }}>Medications</div>
                      {((detail.medical as any).medications || []).map((m: any, i: number) => <span key={i} className="tag med">{m.name} {m.dosage}</span>)}
                    </div>}
                    <div>
                      <div className="info-key" style={{ marginBottom: '4px' }}>Conditions</div>
                      {Object.entries((detail.medical as any).conditions || {}).filter(([, v]) => v === true).map(([k]) => <span key={k} className="tag cond">{k.replace(/_/g, ' ')}</span>)}
                    </div>
                  </div>
                )}

                {detail?.dental && (
                  <div className="section">
                    <div className="section-label">Dental</div>
                    <div className="info-grid">
                      {[['Chief complaint', (detail.dental as any).chief_complaint || '—'], ['Last visit', (detail.dental as any).last_visit_date || '—'], ['Anxiety', `${(detail.dental as any).dental_anxiety}/5`]].map(([k, v]) => (
                        <div key={k}><div className="info-key">{k}</div><div className="info-val">{v}</div></div>
                      ))}
                    </div>
                  </div>
                )}

                {detail?.consents && (
                  <div className="section">
                    <div className="section-label">Consents</div>
                    {[['Treatment', (detail.consents as any).consent_treatment], ['PIPEDA', (detail.consents as any).consent_pipeda], ['Email', (detail.consents as any).consent_communication_email], ['SMS', (detail.consents as any).consent_communication_sms]].map(([l, v]) => (
                      <div key={l as string} className="consent-row"><span className={v ? 'check' : 'cross'}>{v ? '✓' : '✕'}</span>{l}</div>
                    ))}
                    {(detail.consents as any).signature_text && (
                      <div style={{ marginTop: '10px', padding: '10px', background: '#F8FAFC', borderRadius: '8px' }}>
                        <div className="info-key">Signature</div>
                        <div style={{ fontSize: '15px', fontStyle: 'italic', color: '#0F172A', marginTop: '3px' }}>{(detail.consents as any).signature_text}</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
