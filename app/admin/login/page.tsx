'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Invalid email or password.'); setLoading(false); return }
    router.push('/admin/dashboard')
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
        .brand-tag { font-size: 11px; color: #94A3B8; font-weight: 400; }
        .card { background: white; border-radius: 16px; border: 1px solid #E2E8F0; padding: 36px 32px; width: 100%; max-width: 380px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
        .title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
        .subtitle { font-size: 13px; color: #94A3B8; margin-bottom: 28px; }
        .field { margin-bottom: 14px; }
        label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 5px; letter-spacing: 0.3px; }
        input { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none; transition: border-color 0.15s; }
        input:focus { border-color: #0F172A; }
        .btn { width: 100%; padding: 12px; border-radius: 10px; background: #0F172A; color: white; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; margin-top: 8px; transition: background 0.15s; }
        .btn:hover { background: #1E293B; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .error { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #DC2626; margin-bottom: 14px; }
        .footer-link { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #94A3B8; text-decoration: none; }
        .footer-link a { color: #0EA5E9; text-decoration: none; }
        .footer-link a:hover { text-decoration: underline; }
      `}</style>

      <div className="page">
        <div className="brand">
          <div className="brand-icon">🦷</div>
          <div>
            <div className="brand-name">DentPlus</div>
            <div className="brand-tag">Clinic administration</div>
          </div>
        </div>

        <div className="card">
          <div className="title">Welcome back</div>
          <div className="subtitle">Sign in to manage your clinic</div>

          {error && <div className="error">{error}</div>}

          <div className="field">
            <label>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          <button className="btn" onClick={handleLogin} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <div className="footer-link">
          New to DentPlus? <Link href="/admin/register">Register your clinic</Link>
        </div>
      </div>
    </>
  )
}
