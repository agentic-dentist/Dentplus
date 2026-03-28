'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
const DAYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<DayKey, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }
type HoursMap = Record<DayKey, { open: string; close: string } | null>

interface ClinicInfo { name: string; address: string; city: string; province: string; postal_code: string; phone: string; email: string; languages: string[]; opening_hours: HoursMap }
interface Provider { id?: string; full_name: string; role: string; email: string; schedule: Partial<Record<DayKey, { start: string; end: string; active: boolean }>> }
interface Service { id?: string; name: string; duration_mins: number; color: string; staff_ids: string[] }
interface BillingInfo { billing_email: string; accepted_insurers: string[]; plan_tier: string }

const ROLES = ['dentist', 'hygienist', 'receptionist', 'assistant', 'owner']
const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120]
const SERVICE_COLORS = ['#1D9E75', '#0EA5E9', '#7F77DD', '#D85A30', '#D4537E', '#EF9F27', '#639922', '#E24B4A']
const INSURERS = ['Sun Life', 'Manulife', 'Canada Life', 'Desjardins', 'Blue Cross', 'Great-West Life', 'Industrial Alliance', 'Intact', 'SSQ', 'Empire Life']
const PLANS = [
  { id: 'starter', name: 'Starter', price: '$99', desc: 'Up to 3 staff, 100 patients' },
  { id: 'pro', name: 'Pro', price: '$249', desc: 'Up to 10 staff, unlimited patients' },
  { id: 'enterprise', name: 'Enterprise', price: '$499', desc: 'Unlimited staff + priority support' },
]
const DEFAULT_HOURS: HoursMap = {
  monday: { open: '08:00', close: '17:00' }, tuesday: { open: '08:00', close: '17:00' },
  wednesday: { open: '08:00', close: '17:00' }, thursday: { open: '08:00', close: '17:00' },
  friday: { open: '08:00', close: '17:00' }, saturday: { open: '09:00', close: '13:00' }, sunday: null,
}
const DEFAULT_PROVIDER_SCHEDULE = DAYS.reduce((acc, d) => ({
  ...acc,
  [d]: { start: '09:00', end: '17:00', active: ['monday','tuesday','wednesday','thursday','friday'].includes(d) }
}), {} as Provider['schedule'])

const S = {
  label: { display: 'block', color: '#888', fontSize: 12, fontWeight: 500, marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' } as React.CSSProperties,
  input: { width: '100%', padding: '0 0.875rem', height: 40, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: "'Syne', sans-serif", outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  select: { width: '100%', padding: '0 0.875rem', height: 40, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: "'Syne', sans-serif", outline: 'none', boxSizing: 'border-box', cursor: 'pointer' } as React.CSSProperties,
  card: { background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: '1.25rem' } as React.CSSProperties,
  section: { marginBottom: '1.75rem' } as React.CSSProperties,
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: '0.75rem', letterSpacing: '-0.02em' } as React.CSSProperties,
  error: { background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: '#E24B4A', fontSize: 13, marginBottom: '1rem' } as React.CSSProperties,
}

// ── Shared save button ────────────────────────────────────────────────────────

function SaveButton({ saving, onClick, label, accent }: { saving: boolean; onClick: () => void; label: string; accent?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={saving} style={{
      width: '100%', padding: '0.875rem',
      background: saving ? '#1e1e1e' : accent ? 'linear-gradient(135deg, #1D9E75, #0EA5E9)' : '#1D9E75',
      color: saving ? '#444' : '#fff', border: 'none', borderRadius: 10,
      fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif",
      cursor: saving ? 'not-allowed' : 'pointer',
    }}>
      {saving ? 'Saving…' : label}
    </button>
  )
}

// ── Step 1: Clinic info ───────────────────────────────────────────────────────

function Step1({ clinicId, initial, onSaved }: { clinicId: string; initial: Partial<ClinicInfo>; onSaved: () => void }) {
  const [form, setForm] = useState<ClinicInfo>({
    name: initial.name || '', address: initial.address || '', city: initial.city || 'Montréal',
    province: initial.province || 'QC', postal_code: initial.postal_code || '',
    phone: initial.phone || '', email: initial.email || '',
    languages: initial.languages || ['en', 'fr'],
    opening_hours: (initial.opening_hours as HoursMap) || DEFAULT_HOURS,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleLanguage = (lang: string) => setForm(f => ({
    ...f, languages: f.languages.includes(lang) ? f.languages.filter(l => l !== lang) : [...f.languages, lang]
  }))

  const toggleDay = (day: DayKey) => setForm(f => ({
    ...f, opening_hours: { ...f.opening_hours, [day]: f.opening_hours[day] ? null : { open: '08:00', close: '17:00' } }
  }))

  const updateHours = (day: DayKey, field: 'open' | 'close', val: string) => setForm(f => ({
    ...f, opening_hours: { ...f.opening_hours, [day]: { ...(f.opening_hours[day] as { open: string; close: string }), [field]: val } }
  }))

  const handleSave = async () => {
    if (!form.name || !form.phone) { setError('Clinic name and phone are required.'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 1, clinicId, ...form }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Save failed.'); return }
    onSaved()
  }

  return (
    <div>
      <div style={S.section}>
        <p style={S.sectionTitle}>Clinic details</p>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={S.label}>Clinic name</label>
            <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={S.label}>Phone</label>
              <input style={S.input} placeholder="514-555-0100" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Clinic email</label>
              <input style={S.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={S.label}>Street address</label>
            <input style={S.input} placeholder="123 Rue Saint-Denis" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '1rem' }}>
            <div>
              <label style={S.label}>City</label>
              <input style={S.input} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Province</label>
              <select style={S.select} value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}>
                {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Postal code</label>
              <input style={S.input} placeholder="H2X 1Y4" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <p style={S.sectionTitle}>Patient languages</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[{ id: 'en', label: 'English' }, { id: 'fr', label: 'Français' }].map(lang => (
            <button key={lang.id} type="button" onClick={() => toggleLanguage(lang.id)} style={{
              padding: '0.5rem 1.25rem', borderRadius: 8, fontSize: 13,
              fontFamily: "'Syne', sans-serif", cursor: 'pointer',
              background: form.languages.includes(lang.id) ? 'rgba(29,158,117,0.15)' : '#111',
              border: `1px solid ${form.languages.includes(lang.id) ? '#1D9E75' : '#2a2a2a'}`,
              color: form.languages.includes(lang.id) ? '#1D9E75' : '#666',
            }}>
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.section}>
        <p style={S.sectionTitle}>Opening hours</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {DAYS.map(day => (
            <div key={day} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', gap: '1rem' }}>
              <button type="button" onClick={() => toggleDay(day)} style={{
                padding: '0.35rem 0.75rem', borderRadius: 6, fontSize: 12,
                fontFamily: "'Syne', sans-serif", cursor: 'pointer',
                background: form.opening_hours[day] ? 'rgba(29,158,117,0.12)' : '#111',
                border: `1px solid ${form.opening_hours[day] ? '#1D9E75' : '#2a2a2a'}`,
                color: form.opening_hours[day] ? '#1D9E75' : '#555',
              }}>
                {DAY_LABELS[day]}
              </button>
              {form.opening_hours[day] ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="time" value={(form.opening_hours[day] as { open: string; close: string }).open}
                    onChange={e => updateHours(day, 'open', e.target.value)} style={{ ...S.input, width: 120 }} />
                  <span style={{ color: '#555', fontSize: 13 }}>to</span>
                  <input type="time" value={(form.opening_hours[day] as { open: string; close: string }).close}
                    onChange={e => updateHours(day, 'close', e.target.value)} style={{ ...S.input, width: 120 }} />
                </div>
              ) : <span style={{ color: '#444', fontSize: 13 }}>Closed</span>}
            </div>
          ))}
        </div>
      </div>

      {error && <div style={S.error}>{error}</div>}
      <SaveButton saving={saving} onClick={handleSave} label="Save & continue" />
    </div>
  )
}

// ── Step 2: Providers ─────────────────────────────────────────────────────────

function Step2({ clinicId, onSaved }: { clinicId: string; onSaved: (providers: Provider[]) => void }) {
  const [providers, setProviders] = useState<Provider[]>([{ full_name: '', role: 'dentist', email: '', schedule: { ...DEFAULT_PROVIDER_SCHEDULE } }])
  const [expanded, setExpanded] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/setup?clinicId=${clinicId}&step=2`)
      .then(r => r.json()).then(d => { if (d.providers?.length) setProviders(d.providers) })
  }, [clinicId])

  const addProvider = () => {
    setProviders(p => [...p, { full_name: '', role: 'dentist', email: '', schedule: { ...DEFAULT_PROVIDER_SCHEDULE } }])
    setExpanded(providers.length)
  }
  const removeProvider = (i: number) => setProviders(p => p.filter((_, idx) => idx !== i))
  const updateProvider = (i: number, field: keyof Provider, val: string) =>
    setProviders(p => p.map((prov, idx) => idx === i ? { ...prov, [field]: val } : prov))
  const toggleProviderDay = (pi: number, day: DayKey) =>
    setProviders(p => p.map((prov, idx) => idx !== pi ? prov : {
      ...prov, schedule: { ...prov.schedule, [day]: { ...(prov.schedule[day] || { start: '09:00', end: '17:00' }), active: !prov.schedule[day]?.active } }
    }))
  const updateProviderHours = (pi: number, day: DayKey, field: 'start' | 'end', val: string) =>
    setProviders(p => p.map((prov, idx) => idx !== pi ? prov : {
      ...prov, schedule: { ...prov.schedule, [day]: { ...(prov.schedule[day] || { active: true, start: '09:00', end: '17:00' }), [field]: val } }
    }))

  const handleSave = async () => {
    for (const p of providers) {
      if (!p.full_name || !p.email || !p.role) { setError('All providers need a name, role, and email.'); return }
    }
    setSaving(true); setError('')
    const res = await fetch('/api/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 2, clinicId, providers }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Save failed.'); return }
    onSaved(providers)
  }

  return (
    <div>
      <p style={{ color: '#666', fontSize: 13, marginBottom: '1.5rem', lineHeight: 1.6 }}>
        Staff will receive an invite email to set their password when your clinic goes live.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        {providers.map((prov, i) => (
          <div key={i} style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded === i ? '1rem' : 0 }}>
              <button type="button" onClick={() => setExpanded(expanded === i ? -1 : i)} style={{
                background: 'none', border: 'none', color: prov.full_name ? '#fff' : '#555',
                fontSize: 14, fontFamily: "'Syne', sans-serif", cursor: 'pointer', padding: 0, fontWeight: 500,
              }}>
                {prov.full_name || `Provider ${i + 1}`}
                {prov.role && <span style={{ color: '#555', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{prov.role}</span>}
                <span style={{ color: '#444', marginLeft: 8 }}>{expanded === i ? '▲' : '▼'}</span>
              </button>
              {providers.length > 1 && (
                <button type="button" onClick={() => removeProvider(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, fontFamily: "'Syne', sans-serif" }}>Remove</button>
              )}
            </div>
            {expanded === i && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div><label style={S.label}>Full name</label><input style={S.input} placeholder="Dr. Jean Tremblay" value={prov.full_name} onChange={e => updateProvider(i, 'full_name', e.target.value)} /></div>
                  <div><label style={S.label}>Role</label><select style={S.select} value={prov.role} onChange={e => updateProvider(i, 'role', e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
                  <div><label style={S.label}>Email</label><input style={S.input} type="email" value={prov.email} onChange={e => updateProvider(i, 'email', e.target.value)} /></div>
                </div>
                <p style={{ color: '#666', fontSize: 12, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weekly schedule</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {DAYS.map(day => (
                    <div key={day} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'center', gap: '0.75rem' }}>
                      <button type="button" onClick={() => toggleProviderDay(i, day)} style={{
                        padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: 12, fontFamily: "'Syne', sans-serif", cursor: 'pointer',
                        background: prov.schedule[day]?.active ? 'rgba(14,165,233,0.12)' : '#111',
                        border: `1px solid ${prov.schedule[day]?.active ? '#0EA5E9' : '#222'}`,
                        color: prov.schedule[day]?.active ? '#0EA5E9' : '#444',
                      }}>{DAY_LABELS[day]}</button>
                      {prov.schedule[day]?.active ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="time" value={prov.schedule[day]?.start || '09:00'} onChange={e => updateProviderHours(i, day, 'start', e.target.value)} style={{ ...S.input, width: 110 }} />
                          <span style={{ color: '#444', fontSize: 12 }}>–</span>
                          <input type="time" value={prov.schedule[day]?.end || '17:00'} onChange={e => updateProviderHours(i, day, 'end', e.target.value)} style={{ ...S.input, width: 110 }} />
                        </div>
                      ) : <span style={{ color: '#333', fontSize: 12 }}>Off</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addProvider} style={{ width: '100%', padding: '0.65rem', background: 'transparent', border: '1px dashed #333', borderRadius: 8, color: '#666', fontSize: 13, fontFamily: "'Syne', sans-serif", cursor: 'pointer', marginBottom: '1.5rem' }}>
        + Add another provider
      </button>
      {error && <div style={S.error}>{error}</div>}
      <SaveButton saving={saving} onClick={handleSave} label="Save & continue" />
    </div>
  )
}

// ── Step 3: Services ──────────────────────────────────────────────────────────

function Step3({ clinicId, staffIds, onSaved }: { clinicId: string; staffIds: { id: string; name: string }[]; onSaved: () => void }) {
  const [services, setServices] = useState<Service[]>([
    { name: 'Cleaning', duration_mins: 60, color: '#1D9E75', staff_ids: [] },
    { name: 'Exam', duration_mins: 30, color: '#4F46E5', staff_ids: [] },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/setup?clinicId=${clinicId}&step=3`)
      .then(r => r.json()).then(d => { if (d.services?.length) setServices(d.services) })
  }, [clinicId])

  const addService = () => setServices(s => [...s, { name: '', duration_mins: 60, color: SERVICE_COLORS[s.length % SERVICE_COLORS.length], staff_ids: [] }])
  const removeService = (i: number) => setServices(s => s.filter((_, idx) => idx !== i))
  const updateService = (i: number, field: keyof Service, val: unknown) =>
    setServices(s => s.map((svc, idx) => idx === i ? { ...svc, [field]: val } : svc))
  const toggleStaff = (si: number, staffId: string) =>
    setServices(s => s.map((svc, idx) => idx !== si ? svc : {
      ...svc, staff_ids: svc.staff_ids.includes(staffId) ? svc.staff_ids.filter(id => id !== staffId) : [...svc.staff_ids, staffId]
    }))

  const handleSave = async () => {
    for (const s of services) { if (!s.name) { setError('All services need a name.'); return } }
    setSaving(true); setError('')
    const res = await fetch('/api/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 3, clinicId, services }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Save failed.'); return }
    onSaved()
  }

  return (
    <div>
      <p style={{ color: '#666', fontSize: 13, marginBottom: '1.5rem', lineHeight: 1.6 }}>
        The AI agent uses these to match patients with the right provider and block the right amount of time.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        {services.map((svc, i) => (
          <div key={i} style={S.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px auto', gap: '0.75rem', alignItems: 'end' }}>
              <div><label style={S.label}>Service name</label><input style={S.input} placeholder="e.g. Cleaning, Filling" value={svc.name} onChange={e => updateService(i, 'name', e.target.value)} /></div>
              <div><label style={S.label}>Duration</label><select style={S.select} value={svc.duration_mins} onChange={e => updateService(i, 'duration_mins', Number(e.target.value))}>{DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}</select></div>
              <div>
                <label style={S.label}>Color</label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingTop: 6 }}>
                  {SERVICE_COLORS.map(c => <button key={c} type="button" onClick={() => updateService(i, 'color', c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: svc.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />)}
                </div>
              </div>
              {services.length > 1 && <button type="button" onClick={() => removeService(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, fontFamily: "'Syne', sans-serif", alignSelf: 'flex-end', paddingBottom: 8 }}>Remove</button>}
            </div>
            {staffIds.length > 0 && (
              <div style={{ marginTop: '0.875rem' }}>
                <label style={{ ...S.label, marginBottom: '0.5rem' }}>Offered by</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {staffIds.map(staff => (
                    <button key={staff.id} type="button" onClick={() => toggleStaff(i, staff.id)} style={{
                      padding: '0.3rem 0.75rem', borderRadius: 6, fontSize: 12, fontFamily: "'Syne', sans-serif", cursor: 'pointer',
                      background: svc.staff_ids.includes(staff.id) ? 'rgba(29,158,117,0.12)' : '#111',
                      border: `1px solid ${svc.staff_ids.includes(staff.id) ? '#1D9E75' : '#2a2a2a'}`,
                      color: svc.staff_ids.includes(staff.id) ? '#1D9E75' : '#555',
                    }}>{staff.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addService} style={{ width: '100%', padding: '0.65rem', background: 'transparent', border: '1px dashed #333', borderRadius: 8, color: '#666', fontSize: 13, fontFamily: "'Syne', sans-serif", cursor: 'pointer', marginBottom: '1.5rem' }}>
        + Add another service
      </button>
      {error && <div style={S.error}>{error}</div>}
      <SaveButton saving={saving} onClick={handleSave} label="Save & continue" />
    </div>
  )
}

// ── Step 4: Billing ───────────────────────────────────────────────────────────

function Step4({ clinicId, onSaved }: { clinicId: string; onSaved: () => void }) {
  const [form, setForm] = useState<BillingInfo>({ billing_email: '', accepted_insurers: [], plan_tier: 'pro' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/setup?clinicId=${clinicId}&step=4`)
      .then(r => r.json()).then(d => { if (d.billing) setForm(d.billing) })
  }, [clinicId])

  const toggleInsurer = (ins: string) => setForm(f => ({
    ...f, accepted_insurers: f.accepted_insurers.includes(ins) ? f.accepted_insurers.filter(i => i !== ins) : [...f.accepted_insurers, ins]
  }))

  const handleGoLive = async () => {
    if (!form.billing_email) { setError('Billing email is required.'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 4, clinicId, ...form, goLive: true }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Save failed.'); return }
    onSaved()
  }

  return (
    <div>
      <div style={S.section}>
        <p style={S.sectionTitle}>Accepted insurance</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {INSURERS.map(ins => (
            <button key={ins} type="button" onClick={() => toggleInsurer(ins)} style={{
              padding: '0.4rem 0.875rem', borderRadius: 8, fontSize: 13, fontFamily: "'Syne', sans-serif", cursor: 'pointer',
              background: form.accepted_insurers.includes(ins) ? 'rgba(29,158,117,0.12)' : '#111',
              border: `1px solid ${form.accepted_insurers.includes(ins) ? '#1D9E75' : '#2a2a2a'}`,
              color: form.accepted_insurers.includes(ins) ? '#1D9E75' : '#666',
            }}>{ins}</button>
          ))}
        </div>
      </div>
      <div style={S.section}>
        <p style={S.sectionTitle}>Billing email</p>
        <input style={S.input} type="email" placeholder="billing@clinic.ca" value={form.billing_email} onChange={e => setForm(f => ({ ...f, billing_email: e.target.value }))} />
        <p style={{ color: '#444', fontSize: 12, marginTop: '0.4rem' }}>Invoices will go here.</p>
      </div>
      <div style={S.section}>
        <p style={S.sectionTitle}>Plan</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {PLANS.map(plan => (
            <button key={plan.id} type="button" onClick={() => setForm(f => ({ ...f, plan_tier: plan.id }))} style={{
              padding: '1rem 1.25rem', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              background: form.plan_tier === plan.id ? 'rgba(29,158,117,0.08)' : '#0d0d0d',
              border: `1px solid ${form.plan_tier === plan.id ? '#1D9E75' : '#222'}`,
              fontFamily: "'Syne', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{plan.name}</div>
                <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{plan.desc}</div>
              </div>
              <div style={{ color: form.plan_tier === plan.id ? '#1D9E75' : '#444', fontSize: 18, fontWeight: 700 }}>
                {plan.price}<span style={{ fontSize: 12, fontWeight: 400 }}>/mo</span>
              </div>
            </button>
          ))}
        </div>
        <p style={{ color: '#444', fontSize: 12, marginTop: '0.75rem' }}>30-day free trial. Stripe activates at the end of your trial.</p>
      </div>
      {error && <div style={S.error}>{error}</div>}
      <SaveButton saving={saving} onClick={handleGoLive} label="Go live" accent />
    </div>
  )
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

const STEPS = [{ n: 1, label: 'Clinic info' }, { n: 2, label: 'Providers' }, { n: 3, label: 'Services' }, { n: 4, label: 'Billing' }]

function SetupWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [clinicData, setClinicData] = useState<Partial<ClinicInfo>>({})
  const [savedProviders, setSavedProviders] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      if (!session.user.email_confirmed_at) {
        router.replace('/signup/verify-email?email=' + encodeURIComponent(session.user.email ?? ''))
        return
      }
      const { data: owner } = await supabase.from('clinic_owners').select('clinic_id').eq('auth_id', session.user.id).maybeSingle()
      if (!owner) { setAuthError('No clinic found for this account.'); setLoading(false); return }

      const { data: clinic } = await supabase.from('clinics').select('id, name, slug, setup_step, setup_complete, languages').eq('id', owner.clinic_id).single()
      if (!clinic) { setAuthError('Clinic not found.'); setLoading(false); return }
      if (clinic.setup_complete) { router.replace(`https://${clinic.slug}.dentplus.ca/dashboard`); return }

      setClinicId(clinic.id)

      const { data: settings } = await supabase.from('clinic_settings').select('*').eq('clinic_id', clinic.id).maybeSingle()
      setClinicData({ name: clinic.name, languages: clinic.languages, phone: settings?.phone || '', email: settings?.email || '', address: settings?.address || '', opening_hours: settings?.opening_hours || DEFAULT_HOURS })

      const { data: staff } = await supabase.from('staff_accounts').select('id, full_name').eq('clinic_id', clinic.id)
      if (staff?.length) setSavedProviders(staff.map(s => ({ id: s.id, name: s.full_name })))

      const urlStep = parseInt(params.get('step') || '0')
      const dbStep = Math.min((clinic.setup_step || 0) + 1, 4)
      setStep(urlStep >= 1 && urlStep <= 4 ? urlStep : dbStep)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => { if (!loading) router.replace(`/setup?step=${step}`, { scroll: false }) }, [step, loading])

  const handleStep2Saved = useCallback((providers: Provider[]) => {
    setSavedProviders(providers.map((p, i) => ({ id: p.id || String(i), name: p.full_name })))
    setStep(3)
  }, [])

  const handleGoLive = () => {
  supabase.from('clinics').select('slug').eq('id', clinicId!).single()
    .then(({ data }) => {
      if (data?.slug) {
        router.replace(`/setup/complete?slug=${data.slug}`)
      }
    })
}

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#555', fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Loading your clinic…</span>
    </div>
  )
  if (authError) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#E24B4A', fontSize: 14, fontFamily: "'Syne', sans-serif" }}>{authError}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Syne', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem 4rem' }}>
      <div style={{ width: '100%', maxWidth: 620, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #1D9E75, #0EA5E9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>+</span>
            </div>
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>DentPlus</span>
          </div>
          <span style={{ color: '#444', fontSize: 13 }}>Setup wizard</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <button type="button" onClick={() => s.n <= step && setStep(s.n)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: s.n <= step ? 'pointer' : 'default', padding: '0 0.5rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: step === s.n ? '#1D9E75' : s.n < step ? 'rgba(29,158,117,0.3)' : '#111', border: `1.5px solid ${step === s.n ? '#1D9E75' : s.n < step ? '#1D9E75' : '#333'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: step === s.n ? '#fff' : s.n < step ? '#1D9E75' : '#444', fontSize: 12, fontWeight: 700 }}>
                  {s.n < step ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 11, color: step === s.n ? '#fff' : s.n < step ? '#1D9E75' : '#444', whiteSpace: 'nowrap' }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: s.n < step ? '#1D9E75' : '#222', margin: '0 0.25rem', marginBottom: '1.2rem' }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 620, background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '2rem' }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 1.5rem' }}>
          {STEPS[step - 1].label}
        </h2>
        {step === 1 && clinicId && <Step1 clinicId={clinicId} initial={clinicData} onSaved={() => setStep(2)} />}
        {step === 2 && clinicId && <Step2 clinicId={clinicId} onSaved={handleStep2Saved} />}
        {step === 3 && clinicId && <Step3 clinicId={clinicId} staffIds={savedProviders} onSaved={() => setStep(4)} />}
        {step === 4 && clinicId && <Step4 clinicId={clinicId} onSaved={handleGoLive} />}
      </div>
    </div>
  )
}

export default function SetupPage() {
  return <Suspense><SetupWizard /></Suspense>
}