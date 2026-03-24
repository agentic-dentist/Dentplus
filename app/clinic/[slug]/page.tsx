'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Clinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  primary_color: string | null
}

type Mode = 'splash' | 'register' | 'login'

export default function SplashPage() {
  const params = useParams()
  const slug = params.slug as string
  const router = useRouter()
  const supabase = createClient()

  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [mode, setMode] = useState<Mode>('splash')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Register fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  useEffect(() => {
    const init = async () => {
      // Check if already authenticated → redirect to portal
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace(`/clinic/${slug}/portal`)
        return
      }

      // Load clinic info via service role API (bypasses RLS for public page)
      const res = await fetch(`/api/clinic/slug/info?slug=${slug}`)
      if (!res.ok) { setLoading(false); return }
      const clinicData = await res.json()
      setClinic(clinicData)
      setLoading(false)
    }
    init()
  }, [slug])

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Please fill all fields. Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    if (data.user) {
      // Register patient account
      await fetch('/api/patient/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authId:   data.user.id,
          email,
          fullName,
          clinicId: clinic?.id,
          slug,
        })
      })
      router.replace(`/clinic/${slug}/portal`)
    }
    setSubmitting(false)
  }

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setError('Please enter your email and password.')
      return
    }
    setSubmitting(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (signInError) {
      setError('Invalid email or password.')
      setSubmitting(false)
      return
    }

    router.replace(`/clinic/${slug}/portal`)
    setSubmitting(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/clinic/${slug}/portal` }
    })
  }

  const color = clinic?.primary_color || '#0EA5E9'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: 'DM Sans, sans-serif', color: '#94A3B8' }}>
      Loading...
    </div>
  )

  if (!clinic) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: 'DM Sans, sans-serif', color: '#94A3B8' }}>
      Clinic not found.
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#F8FAFC;min-height:100vh}
        .page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px}
        .card{background:white;border-radius:20px;border:1px solid #E2E8F0;padding:40px;width:100%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
        .back-btn{display:flex;align-items:center;gap:4px;font-size:13px;color:#94A3B8;background:none;border:none;cursor:pointer;padding:0 0 20px;font-family:'DM Sans',sans-serif;transition:color .15s}
        .back-btn:hover{color:#64748B}
        .logo-wrap{width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px}
        .clinic-name{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0F172A;text-align:center;margin-bottom:4px}
        .clinic-info{font-size:12px;color:#94A3B8;text-align:center;margin-bottom:2px}
        .divider{height:1px;background:#F1F5F9;margin:24px 0}
        .section-label{font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#CBD5E1;text-align:center;margin-bottom:14px}
        .form-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .form-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}
        label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
        input{width:100%;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color .15s;color:#0F172A}
        input:focus{border-color:var(--color)}
        .field{margin-bottom:14px}
        .btn{display:block;width:100%;padding:13px;border-radius:10px;font-size:15px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;text-align:center;transition:all .15s;border:none}
        .btn-primary{color:white;margin-bottom:10px}
        .btn-primary:hover{filter:brightness(.92)}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-secondary{background:#F8FAFC;color:#475569;border:1.5px solid #E2E8F0!important;margin-bottom:10px}
        .btn-secondary:hover{background:#F1F5F9}
        .btn-google{background:white;color:#374151;border:1.5px solid #E2E8F0!important;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px}
        .btn-google:hover{background:#F9FAFB}
        .error{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 14px;font-size:13px;color:#DC2626;margin-bottom:14px}
        .switch-link{font-size:13px;color:#94A3B8;text-align:center;margin-top:16px}
        .switch-link button{background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;padding:0;transition:color .15s}
        .staff-link{display:block;text-align:center;font-size:12px;color:#CBD5E1;text-decoration:none;margin-top:12px;transition:color .15s}
        .staff-link:hover{color:#94A3B8}
        .footer{margin-top:24px;font-size:12px;color:#CBD5E1;text-align:center}
        .footer a{color:#94A3B8;text-decoration:none}
      `}</style>
      <style>{`:root { --color: ${color}; }`}</style>

      <div className="page">
        <div className="card">

          {/* ── SPLASH ── */}
          {mode === 'splash' && (
            <>
              <div className="logo-wrap" style={{ background: `${color}18` }}>🦷</div>
              <div className="clinic-name">{clinic.name}</div>
              {clinic.address && <div className="clinic-info">{clinic.address}</div>}
              {clinic.phone   && <div className="clinic-info">{clinic.phone}</div>}
              <div className="divider" />
              <div className="section-label">Patient access</div>
              <button className="btn btn-primary" style={{ background: color }}
                onClick={() => { setMode('register'); setError('') }}>
                Create an account
              </button>
              <button className="btn btn-secondary"
                onClick={() => { setMode('login'); setError('') }}>
                Sign in
              </button>
              <a href={`/clinic/${slug}/staff-login`} className="staff-link">
                Staff & clinic owner login →
              </a>
            </>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <>
              <button className="back-btn" onClick={() => { setMode('splash'); setError('') }}>← Back</button>
              <div className="form-title">Create account</div>
              <div className="form-sub">Join {clinic.name} as a patient</div>
              {error && <div className="error">{error}</div>}
              <div className="field">
                <label>Full name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Carol Safadi" autoComplete="name" />
              </div>
              <div className="field">
                <label>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters" autoComplete="new-password"
                  onKeyDown={e => e.key === 'Enter' && handleRegister()} />
              </div>
              <button className="btn btn-primary" style={{ background: color }}
                onClick={handleRegister} disabled={submitting}>
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#F1F5F9' }} />
                <span style={{ fontSize: '12px', color: '#CBD5E1' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: '#F1F5F9' }} />
              </div>
              <button className="btn btn-google" onClick={handleGoogle}>
                <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.2-11.3-8H6.1C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C40.9 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>
                Continue with Google
              </button>
              <div className="switch-link">
                Already have an account?{' '}
                <button style={{ color }} onClick={() => { setMode('login'); setError('') }}>Sign in</button>
              </div>
            </>
          )}

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <>
              <button className="back-btn" onClick={() => { setMode('splash'); setError('') }}>← Back</button>
              <div className="form-title">Welcome back</div>
              <div className="form-sub">Sign in to your patient portal</div>
              {error && <div className="error">{error}</div>}
              <div className="field">
                <label>Email address</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              <button className="btn btn-primary" style={{ background: color }}
                onClick={handleLogin} disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#F1F5F9' }} />
                <span style={{ fontSize: '12px', color: '#CBD5E1' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: '#F1F5F9' }} />
              </div>
              <button className="btn btn-google" onClick={handleGoogle}>
                <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.2-11.3-8H6.1C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C40.9 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>
                Continue with Google
              </button>
              <div className="switch-link">
                New patient?{' '}
                <button style={{ color }} onClick={() => { setMode('register'); setError('') }}>Create an account</button>
              </div>
              <a href={`/clinic/${slug}/staff-login`} className="staff-link">
                Staff & clinic owner login →
              </a>
            </>
          )}
        </div>

        <div className="footer">Powered by <a href="https://dentplus.ca">DentPlus</a></div>
      </div>
    </>
  )
}
