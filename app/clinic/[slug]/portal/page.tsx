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

export default function ClinicHomePage() {
  const params = useParams()
  const slug = params.slug as string
  const router = useRouter()
  const supabase = createClient()

  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const init = async () => {
    console.log('PORTAL INIT - slug:', slug)
    console.log('PORTAL INIT - user:', (await supabase.auth.getUser()).data.user?.email)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: account } = await supabase
          .from('patient_accounts')
          .select('is_approved')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (account) { router.replace('/portal'); return }
        // Auth user exists but no patient account (staff/owner) — sign out
        await supabase.auth.signOut()
      }

      const res = await fetch(`/api/public-clinic?slug=${slug}`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setClinic(data.clinic || data)
      setLoading(false)
    }
    init()
  }, [slug])

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setSubmitting(true); setError('')

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Invalid email or password.'); setSubmitting(false); return }

    const role = authData.user?.user_metadata?.role
    if (role === 'owner' || ['dentist', 'hygienist', 'receptionist', 'assistant'].includes(role)) {
      router.push('/dashboard')
    } else {
      router.push('/portal')
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?slug=${slug}&type=patient` }
    })
  }

  const color = clinic?.primary_color || '#0EA5E9'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: "'DM Sans', sans-serif", color: '#94A3B8' }}>
      Loading...
    </div>
  )

  if (!clinic) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: "'DM Sans', sans-serif", color: '#94A3B8' }}>
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
        .card{background:white;border-radius:20px;border:1px solid #E2E8F0;width:100%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.06);overflow:hidden}
        .clinic-header{padding:32px 40px 24px;text-align:center;border-bottom:1px solid #F1F5F9}
        .logo-wrap{width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px}
        .clinic-name{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .clinic-info{font-size:12px;color:#94A3B8;margin-bottom:2px}
        .form-body{padding:28px 40px 32px}
        .form-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .form-sub{font-size:13px;color:#94A3B8;margin-bottom:20px}
        .field{margin-bottom:14px}
        label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
        input{width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;color:#0F172A;outline:none;transition:border-color .15s}
        input:focus{border-color:var(--c)}
        .btn-primary{width:100%;padding:12px;border-radius:10px;color:white;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;margin-top:4px;transition:filter .15s}
        .btn-primary:hover{filter:brightness(.9)}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .divider{display:flex;align-items:center;gap:10px;margin:16px 0}
        .divider-line{flex:1;height:1px;background:#F1F5F9}
        .divider-text{font-size:11px;color:#CBD5E1}
        .btn-google{width:100%;padding:10px;border-radius:10px;border:1.5px solid #E2E8F0;background:white;font-size:13px;font-family:'DM Sans',sans-serif;color:#475569;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .15s}
        .btn-google:hover{background:#F8FAFC}
        .error{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 14px;font-size:13px;color:#DC2626;margin-bottom:14px}
        .register-hint{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;margin-top:16px;font-size:12px;color:#94A3B8;text-align:center;line-height:1.5}
        .staff-link{display:block;text-align:center;font-size:12px;color:#CBD5E1;text-decoration:none;margin-top:12px;transition:color .15s}
        .staff-link:hover{color:#94A3B8}
        .footer{margin-top:20px;font-size:12px;color:#CBD5E1;text-align:center}
        .footer a{color:#94A3B8;text-decoration:none}
      `}</style>
      <style>{`:root{--c:${color}}`}</style>

      <div className="page">
        <div className="card">
          <div className="clinic-header">
            <div className="logo-wrap" style={{ background: `${color}18` }}>🦷</div>
            <div className="clinic-name">{clinic.name}</div>
            {clinic.address && <div className="clinic-info">{clinic.address}</div>}
            {clinic.phone && <div className="clinic-info">{clinic.phone}</div>}
          </div>

          <div className="form-body">
            <div className="form-title">Patient sign in</div>
            <div className="form-sub">Access your portal, appointments and records</div>

            {error && <div className="error">{error}</div>}

            <div className="field">
              <label>Email address</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>

            <button className="btn-primary" style={{ background: color }}
              onClick={handleLogin} disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="divider">
              <div className="divider-line" />
              <div className="divider-text">or</div>
              <div className="divider-line" />
            </div>

            <button className="btn-google" onClick={handleGoogle}>
              <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <div className="register-hint">
              New patient? Ask our front desk to register you or visit<br />
              <strong style={{ color: '#475569' }}>{slug}.dentplus.ca/register</strong>
            </div>

            <a href="/login?type=staff" className="staff-link">
              Staff & clinic owner login →
            </a>
          </div>
        </div>

        <div className="footer">Powered by <a href="https://dentplus.ca">DentPlus</a></div>
      </div>
    </>
  )
}
