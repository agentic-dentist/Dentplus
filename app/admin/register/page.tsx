'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const STEPS = ['Account', 'Clinic', 'Done']

export default function AdminRegister() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 0 — account
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // Step 1 — clinic
  const [clinicName, setClinicName] = useState('')
  const [slug, setSlug] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const slugify = (val: string) =>
    val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleStep0 = async () => {
    if (!email || !password || !fullName) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setStep(1)
  }

  const handleStep1 = async () => {
    if (!clinicName || !slug) { setError('Clinic name and URL are required.'); return }
    if (!/^[a-z0-9-]+$/.test(slug)) { setError('URL can only contain lowercase letters, numbers and hyphens.'); return }
    setLoading(true)
    setError('')

    // Create auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError || !authData.user) {
      setError(authError?.message || 'Account creation failed.')
      setLoading(false)
      return
    }

    // Create clinic via API
    const res = await fetch('/api/admin/register-clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authId: authData.user.id,
        email,
        fullName,
        clinicName,
        slug,
        phone,
        address
      })
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Clinic setup failed.'); setLoading(false); return }

    setStep(2)
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F8FAFC; min-height: 100vh; }
        .page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; }
        .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
        .brand-icon { width: 36px; height: 36px; background: #0F172A; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
        .brand-name { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; }
        .card { background: white; border-radius: 16px; border: 1px solid #E2E8F0; padding: 36px 32px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
        .steps { display: flex; align-items: center; gap: 8px; margin-bottom: 28px; }
        .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
        .step-dot.done { background: #0F172A; color: white; }
        .step-dot.active { background: #0EA5E9; color: white; }
        .step-dot.idle { background: #F1F5F9; color: #94A3B8; }
        .step-line { flex: 1; height: 1px; background: #E2E8F0; }
        .step-line.done { background: #0F172A; }
        .title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
        .subtitle { font-size: 13px; color: #94A3B8; margin-bottom: 24px; }
        .field { margin-bottom: 14px; }
        label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 5px; }
        input { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none; transition: border-color 0.15s; }
        input:focus { border-color: #0F172A; }
        .slug-wrap { position: relative; }
        .slug-prefix { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 13px; color: #94A3B8; pointer-events: none; }
        .slug-input { padding-left: 120px !important; }
        .btn { width: 100%; padding: 12px; border-radius: 10px; background: #0F172A; color: white; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; margin-top: 8px; transition: background 0.15s; }
        .btn:hover { background: #1E293B; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .error { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #DC2626; margin-bottom: 14px; }
        .success-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
        .success-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #0F172A; text-align: center; margin-bottom: 8px; }
        .success-sub { font-size: 14px; color: #64748B; text-align: center; margin-bottom: 24px; line-height: 1.6; }
        .url-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #0F172A; text-align: center; margin-bottom: 20px; font-family: monospace; }
        .btn-teal { background: #0EA5E9; }
        .btn-teal:hover { background: #0284C7; }
      `}</style>

      <div className="page">
        <div className="brand">
          <div className="brand-icon">🦷</div>
          <div>
            <div className="brand-name">DentPlus</div>
          </div>
        </div>

        <div className="card">
          <div className="steps">
            {STEPS.map((s, i) => (
              <>
                <div key={s} className={`step-dot ${i < step ? 'done' : i === step ? 'active' : 'idle'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div key={`line-${i}`} className={`step-line ${i < step ? 'done' : ''}`} />
                )}
              </>
            ))}
          </div>

          {step === 0 && (
            <>
              <div className="title">Create your account</div>
              <div className="subtitle">Start your 30-day free trial — no credit card required.</div>
              {error && <div className="error">{error}</div>}
              <div className="field"><label>Full name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Dr. Marie Tremblay" /></div>
              <div className="field"><label>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="dr.tremblay@clinic.com" /></div>
              <div className="field"><label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" /></div>
              <button className="btn" onClick={handleStep0}>Continue →</button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="title">Set up your clinic</div>
              <div className="subtitle">This creates your clinic's unique URL on DentPlus.</div>
              {error && <div className="error">{error}</div>}
              <div className="field"><label>Clinic name</label>
                <input value={clinicName} onChange={e => {
                  setClinicName(e.target.value)
                  setSlug(slugify(e.target.value))
                }} placeholder="Clinique Dentaire Tremblay" /></div>
              <div className="field">
                <label>Your clinic URL</label>
                <div className="slug-wrap">
                  <span className="slug-prefix">dentplus.app/clinic/</span>
                  <input className="slug-input" value={slug} onChange={e => setSlug(slugify(e.target.value))} placeholder="tremblay" />
                </div>
              </div>
              <div className="field"><label>Phone (optional)</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="514-555-0100" /></div>
              <div className="field"><label>Address (optional)</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Rue Principale, Montréal" /></div>
              <button className="btn btn-teal" onClick={handleStep1} disabled={loading}>
                {loading ? 'Setting up...' : 'Create clinic →'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="success-icon">🎉</div>
              <div className="success-title">Your clinic is ready!</div>
              <div className="success-sub">
                Check your email to confirm your account, then sign in to start managing your clinic.
              </div>
              <div className="url-box">dentplus.app/clinic/{slug}</div>
              <button className="btn" onClick={() => router.push('/admin/login')}>
                Go to dashboard
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
