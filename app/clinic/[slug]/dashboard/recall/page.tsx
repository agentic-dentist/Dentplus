'use client'

import { useEffect, useState } from 'react'
import { useClinicUser } from '../clinic-context'

interface RecallCandidate {
  patientId:         string
  patientName:       string
  email:             string | null
  phone:             string | null
  language:          string
  lastVisitDate:     string | null
  monthsSinceVisit:  number | null
  insuranceProvider: string | null
  coverageStatus:    'covered' | 'likely_covered' | 'unknown'
  intervalMonths:    number
  servicesDue:       string[]
}

interface RecallLog {
  id:                string
  patient_id:        string
  channel:           string
  coverage_status:   string
  services_due:      string[]
  months_since_visit: number | null
  last_visit_date:   string | null
  status:            string
  sent_at:           string
  message_text:      string
  insurance_provider: string | null
  patients:          { full_name: string; email: string | null } | null
}

const COVERAGE_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  covered:        { bg: '#D1FAE5', color: '#059669', label: '✓ Covered' },
  likely_covered: { bg: '#FEF3C7', color: '#D97706', label: '~ Likely covered' },
  unknown:        { bg: '#F1F5F9', color: '#64748B', label: '? Unknown' },
}

export default function RecallPage() {
  const { clinicId } = useClinicUser()

  const [candidates, setCandidates]   = useState<RecallCandidate[]>([])
  const [recentLog, setRecentLog]     = useState<RecallLog[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<'due' | 'history'>('due')

  // Send state
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [sending, setSending]         = useState(false)
  const [sendResult, setSendResult]   = useState<string>('')
  const [dryRun, setDryRun]           = useState(false)
  const [previewModal, setPreviewModal] = useState<RecallCandidate | null>(null)
  const [previewText, setPreviewText]   = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Expanded log row
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) return
    load()
  }, [clinicId])

  const load = async () => {
    setLoading(true)
    const res  = await fetch(`/api/recall?clinicId=${clinicId}`)
    const data = await res.json()
    setCandidates(data.candidates || [])
    setRecentLog(data.recentLog || [])
    setLoading(false)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(candidates.map(c => c.patientId)))
    }
  }

  const sendRecall = async () => {
    if (selected.size === 0) return
    setSending(true)
    setSendResult('')
    const res = await fetch('/api/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicId,
        dryRun,
        patientIds: Array.from(selected),
        channel: 'auto',
      }),
    })
    const data = await res.json()
    setSending(false)
    setSendResult(
      dryRun
        ? `Dry run: ${data.candidatesFound} messages generated (not sent)`
        : `Sent ${data.messagesSent} message${data.messagesSent !== 1 ? 's' : ''}${data.stubbed ? ` (${data.stubbed} stubbed — Resend/Twilio not configured)` : ''}${data.errors ? `, ${data.errors} error${data.errors !== 1 ? 's' : ''}` : ''}`
    )
    if (!dryRun) { setSelected(new Set()); await load() }
  }

  const previewMessage = async (candidate: RecallCandidate) => {
    setPreviewModal(candidate)
    setPreviewText('')
    setPreviewLoading(true)
    const res = await fetch('/api/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, dryRun: true, patientIds: [candidate.patientId], channel: 'auto' }),
    })
    const data = await res.json()
    const result = data.results?.find((r: any) => r.patientId === candidate.patientId)
    setPreviewText(result?.messageText || 'Could not generate preview.')
    setPreviewLoading(false)
  }

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtDt   = (d: string) => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const coveredCount      = candidates.filter(c => c.coverageStatus === 'covered').length
  const likelyCoveredCount = candidates.filter(c => c.coverageStatus === 'likely_covered').length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400&display=swap');
        *{box-sizing:border-box}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}
        .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        .stat-card{background:white;border-radius:10px;border:1px solid #E2E8F0;padding:16px 20px}
        .stat-value{font-family:'Syne',sans-serif;font-size:26px;font-weight:700;color:#0F172A;line-height:1}
        .stat-label{font-size:12px;color:#94A3B8;margin-top:4px}
        .stat-value.green{color:#059669}
        .stat-value.amber{color:#D97706}

        /* Tabs */
        .tabs{display:flex;gap:4px;background:#F8FAFC;border-radius:10px;padding:4px;margin-bottom:20px;width:fit-content}
        .tab{padding:7px 18px;border:none;border-radius:7px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;color:#64748B;background:none;transition:all .15s}
        .tab.active{background:white;color:#0F172A;box-shadow:0 1px 4px rgba(0,0,0,.08)}

        /* Toolbar */
        .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .send-btn{padding:9px 20px;background:#0F172A;color:white;border:none;border-radius:8px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .15s}
        .send-btn:hover{background:#1E293B}
        .send-btn:disabled{opacity:.5;cursor:not-allowed}
        .send-btn.green{background:#059669}
        .dry-toggle{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748B;cursor:pointer;user-select:none}
        .sel-count{font-size:13px;color:#64748B}
        .result-banner{padding:10px 16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;font-size:13px;color:#166534;flex:1}
        .result-banner.warn{background:#FEF3C7;border-color:#FDE68A;color:#92400E}

        /* Candidate table */
        .card{background:white;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden}
        .table-header{display:grid;grid-template-columns:36px 1fr 120px 100px 120px 80px 36px;gap:12px;padding:10px 16px;border-bottom:1px solid #F1F5F9;font-size:11px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px}
        .table-row{display:grid;grid-template-columns:36px 1fr 120px 100px 120px 80px 36px;gap:12px;padding:12px 16px;border-bottom:1px solid #F8FAFC;align-items:center;transition:background .1s}
        .table-row:last-child{border-bottom:none}
        .table-row:hover{background:#FAFAFA}
        .table-row.selected-row{background:#F0F9FF}
        .patient-name{font-size:13px;font-weight:600;color:#0F172A}
        .patient-meta{font-size:11px;color:#94A3B8;margin-top:1px}
        .coverage-badge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap;display:inline-block}
        .months-badge{font-family:'JetBrains Mono',monospace;font-size:12px;color:#0F172A;font-weight:500}
        .preview-btn{padding:5px 10px;border:1.5px solid #E2E8F0;border-radius:6px;font-size:11px;background:white;color:#64748B;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;white-space:nowrap}
        .preview-btn:hover{border-color:#0EA5E9;color:#0EA5E9}
        .checkbox{width:18px;height:18px;border-radius:4px;border:1.5px solid #E2E8F0;cursor:pointer;appearance:none;background:white;transition:all .12s;flex-shrink:0}
        .checkbox:checked{background:#0EA5E9;border-color:#0EA5E9}
        .empty{padding:48px;text-align:center;color:#CBD5E1;font-size:14px}
        .empty-icon{font-size:32px;margin-bottom:12px;opacity:.4}

        /* History table */
        .log-row{padding:12px 16px;border-bottom:1px solid #F8FAFC;cursor:pointer;transition:background .1s}
        .log-row:last-child{border-bottom:none}
        .log-row:hover{background:#FAFAFA}
        .log-header{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .log-patient{font-size:13px;font-weight:600;color:#0F172A}
        .log-meta{font-size:12px;color:#94A3B8}
        .log-status{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
        .log-status.sent{background:#D1FAE5;color:#059669}
        .log-status.stubbed{background:#FEF3C7;color:#D97706}
        .log-expand{background:#F8FAFC;border-radius:8px;padding:12px;margin-top:10px;font-size:12px;color:#475569;line-height:1.6;font-family:'DM Sans',sans-serif;white-space:pre-wrap}

        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:60;display:flex;align-items:center;justify-content:center;padding:24px}
        .modal{background:white;border-radius:14px;width:100%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.18);overflow:hidden}
        .modal-header{padding:22px 24px;border-bottom:1px solid #F1F5F9}
        .modal-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .modal-sub{font-size:12px;color:#94A3B8}
        .modal-body{padding:20px 24px}
        .preview-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;font-size:13px;color:#334155;line-height:1.7;white-space:pre-wrap;font-family:'DM Sans',sans-serif;min-height:80px}
        .modal-footer{padding:14px 24px;border-top:1px solid #F1F5F9;display:flex;justify-content:flex-end}
        .modal-close{padding:8px 18px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;color:#64748B;background:white;cursor:pointer;font-family:'DM Sans',sans-serif}
        .loading-pulse{color:#CBD5E1;font-size:13px;animation:pulse 1.5s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      <div className="page-title">Recall System</div>
      <div className="page-sub">Automatically identify patients due for a cleaning and send personalized, insurance-aware messages.</div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className={`stat-value ${candidates.length > 0 ? '' : ''}`}>{loading ? '—' : candidates.length}</div>
          <div className="stat-label">Patients due for recall</div>
        </div>
        <div className="stat-card">
          <div className="stat-value green">{loading ? '—' : coveredCount}</div>
          <div className="stat-label">Insurance covered</div>
        </div>
        <div className="stat-card">
          <div className="stat-value amber">{loading ? '—' : likelyCoveredCount}</div>
          <div className="stat-label">Likely covered</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{loading ? '—' : recentLog.filter(l => l.status === 'sent').length}</div>
          <div className="stat-label">Sent (last 90 days)</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'due' ? 'active' : ''}`} onClick={() => setActiveTab('due')}>
          Due for recall {candidates.length > 0 ? `(${candidates.length})` : ''}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          History {recentLog.length > 0 ? `(${recentLog.length})` : ''}
        </button>
      </div>

      {/* Due tab */}
      {activeTab === 'due' && (
        <>
          {/* Toolbar */}
          {candidates.length > 0 && (
            <div className="toolbar">
              <button className="send-btn" onClick={sendRecall} disabled={sending || selected.size === 0}>
                {sending ? 'Sending...' : dryRun ? `Preview ${selected.size} message${selected.size !== 1 ? 's' : ''}` : `Send recall to ${selected.size} patient${selected.size !== 1 ? 's' : ''}`}
              </button>
              <label className="dry-toggle">
                <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
                Dry run (preview only, don't send)
              </label>
              {selected.size > 0 && <span className="sel-count">{selected.size} selected</span>}
              {sendResult && (
                <div className={`result-banner ${sendResult.includes('stubbed') || sendResult.includes('error') ? 'warn' : ''}`}>
                  {sendResult}
                </div>
              )}
            </div>
          )}

          <div className="card">
            {loading ? (
              <div className="empty"><div className="loading-pulse">Loading patients...</div></div>
            ) : candidates.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">✓</div>
                <div>No patients currently due for recall</div>
                <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 6 }}>All patients are up to date or have upcoming appointments</div>
              </div>
            ) : (
              <>
                <div className="table-header">
                  <input type="checkbox" className="checkbox"
                    checked={selected.size === candidates.length && candidates.length > 0}
                    onChange={selectAll}
                  />
                  <div>Patient</div>
                  <div>Insurance</div>
                  <div>Coverage</div>
                  <div>Last visit</div>
                  <div>Months</div>
                  <div />
                </div>
                {candidates.map(c => {
                  const cov = COVERAGE_COLOR[c.coverageStatus]
                  return (
                    <div key={c.patientId} className={`table-row ${selected.has(c.patientId) ? 'selected-row' : ''}`}>
                      <input type="checkbox" className="checkbox"
                        checked={selected.has(c.patientId)}
                        onChange={() => toggleSelect(c.patientId)}
                      />
                      <div>
                        <div className="patient-name">{c.patientName}</div>
                        <div className="patient-meta">
                          {c.email ? c.email : c.phone ? c.phone : 'No contact info'}
                          {c.language === 'fr' ? ' · FR' : ' · EN'}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{c.insuranceProvider || <span style={{ color: '#CBD5E1' }}>None on file</span>}</div>
                      <div>
                        <span className="coverage-badge" style={{ background: cov.bg, color: cov.color }}>{cov.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        {c.lastVisitDate ? fmtDate(c.lastVisitDate) : <span style={{ color: '#CBD5E1' }}>Never</span>}
                      </div>
                      <div className="months-badge">{c.monthsSinceVisit !== null ? `${c.monthsSinceVisit}mo` : '—'}</div>
                      <button className="preview-btn" onClick={() => previewMessage(c)}>Preview</button>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Phase 2 notice */}
          <div style={{ marginTop: 14, padding: '12px 16px', background: '#EFF6FF', borderRadius: 10, fontSize: 12, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚡</span>
            <span><strong>Phase 2:</strong> Once Telus eClaims / CDAnet is connected, coverage will be verified in real-time — confirmed amounts, benefit year reset dates, and $0 out-of-pocket confirmations.</span>
          </div>
        </>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="card">
          {loading ? (
            <div className="empty"><div className="loading-pulse">Loading history...</div></div>
          ) : recentLog.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <div>No recall messages sent yet</div>
            </div>
          ) : recentLog.map(log => {
            const patientName = log.patients
              ? (Array.isArray(log.patients) ? (log.patients as any)[0]?.full_name : (log.patients as any)?.full_name)
              : 'Unknown patient'
            const cov = COVERAGE_COLOR[log.coverage_status] || COVERAGE_COLOR.unknown
            const isExpanded = expandedLog === log.id
            return (
              <div key={log.id} className="log-row" onClick={() => setExpandedLog(isExpanded ? null : log.id)}>
                <div className="log-header">
                  <span className="log-patient">{patientName}</span>
                  <span className="log-meta">{fmtDt(log.sent_at)}</span>
                  <span className="log-meta">via {log.channel}</span>
                  <span className="coverage-badge" style={{ background: cov.bg, color: cov.color, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                    {cov.label}
                  </span>
                  {log.insurance_provider && <span className="log-meta">{log.insurance_provider}</span>}
                  {log.months_since_visit && <span className="log-meta">{log.months_since_visit}mo since last visit</span>}
                  <span className={`log-status ${log.status}`}>{log.status}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#CBD5E1' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div className="log-expand">{log.message_text}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPreviewModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Message preview — {previewModal.patientName}</div>
              <div className="modal-sub">
                {previewModal.insuranceProvider || 'No insurance'} ·{' '}
                <span style={{ color: COVERAGE_COLOR[previewModal.coverageStatus].color }}>
                  {COVERAGE_COLOR[previewModal.coverageStatus].label}
                </span> ·{' '}
                {previewModal.monthsSinceVisit !== null ? `${previewModal.monthsSinceVisit} months since last visit` : 'No visit on record'}
              </div>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Generated message ({previewModal.email ? 'email' : 'sms'} · {previewModal.language === 'fr' ? 'French' : 'English'})
              </div>
              <div className="preview-box">
                {previewLoading
                  ? <span className="loading-pulse">Generating message...</span>
                  : previewText
                }
              </div>
              {!previewLoading && (
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 10 }}>
                  This message was generated by the AI recall agent based on the patient's insurance, last visit date, and language preference.
                  {' '}Phase 2 will include real-time Telus eClaims coverage verification.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-close" onClick={() => setPreviewModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
