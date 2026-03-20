'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const [slug, setSlug] = useState('')
  const [type, setType] = useState<'patient' | 'staff'>('patient')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    params.then(p => {
      setSlug(p.slug)
      const t = searchParams.get('type') as 'patient' | 'staff'
      if (t) setType(t)
      if (t === 'staff') setMode('login')
    })
  }, [params, searchParams])

  const supabase = createClient()

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    if (mode === 'register' && !fullName) { setError('Please enter your name.'); return }

    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError('Invalid email or password.'); setLoading(false); return }
      const redirect = searchParams.get('redirect') || `/clinic/${slug}/${type === 'staff' ? 'dashboard' : 'portal'}`
      router.push(redirect)
      return
    }

    // Register — patient only (staff are created by clinic owner)
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError || !authData.user) { setError(authError?.message || 'Registration failed.'); setLoading(false); return }

    // Create patient account via API
    const res = await fetch(`/api/patient/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, fullName, email, authId: authData.user.id })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Account creation failed.'); setLoading(false); return }

    setSuccess('Account created! Check your email to verify, then log in.')
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?slug=${slug}&type=${type}`
      }
    })
  }

  const isPatient = type === 'patient'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F8FAFC; min-height: 100vh; }
        .page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; }
        .card { background: white; border-radius: 20px; border: 1px solid #E2E8F0; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
        .back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #94A3B8; text-decoration: none; margin-bottom: 24px; cursor: pointer; background: none; border: none; font-family: 'DM Sans', sans-serif; }
        .back:hover { color: #64748B; }
        .title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
        .subtitle { font-size: 13px; color: #94A3B8; margin-bottom: 28px; }
        .tabs { display: flex; background: #F8FAFC; border-radius: 10px; padding: 3px; margin-bottom: 24px; gap: 3px; }
        .tab { flex: 1; padding: 8px; border-radius: 8px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; background: none; color: #94A3B8; transition: all 0.15s; }
        .tab.active { background: white; color: #0F172A; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .field { margin-bottom: 14px; }
        label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 5px; letter-spacing: 0.3px; }
        input { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none; transition: border-color 0.15s; }
        input:focus { border-color: #0EA5E9; }
        .btn-primary { width: 100%; padding: 12px; border-radius: 10px; background: #0F172A; color: white; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; margin-top: 8px; transition: background 0.15s; }
        .btn-primary:hover { background: #1E293B; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
        .divider-line { flex: 1; height: 1px; background: #F1F5F9; }
        .divider-text { font-size: 11px; color: #CBD5E1; font-weight: 500; }
        .btn-google { width: 100%; padding: 10px; border-radius: 10px; border: 1.5px solid #E2E8F0; background: white; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.15s; }
        .btn-google:hover { background: #F8FAFC; }
        .error { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #DC2626; margin-bottom: 14px; }
        .success { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #16A34A; margin-bottom: 14px; }
      `}</style>

      <div className="page">
        <div className="card">
          <button className="back" onClick={() => router.push(`/clinic/${slug}`)}>
            ← Back
          </button>

          <div className="title">
            {isPatient ? (mode === 'login' ? 'Welcome back' : 'Create account') : 'Staff login'}
          </div>
          <div className="subtitle">
            {isPatient
              ? (mode === 'login' ? 'Sign in to your patient portal' : 'Join your dental clinic portal')
              : 'Access the clinic dashboard'}
          </div>

          {isPatient && (
            <div className="tabs">
              <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign in</button>
              <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Register</button>
            </div>
          )}

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          {mode === 'register' && (
            <div className="field">
              <label>Full name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Marie Tremblay" />
            </div>
          )}

          <div className="field">
            <label>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Please wait...' : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>

          {isPatient && (
            <>
              <div className="divider">
                <div className="divider-line" />
                <div className="divider-text">or</div>
                <div className="divider-line" />
              </div>
              <button className="btn-google" onClick={handleGoogle}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
