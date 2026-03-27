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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    params.then(p => {
      const hostname = window.location.hostname
      const realSlug = hostname.includes('.dentplus.ca')
        ? hostname.replace('.dentplus.ca', '')
        : p.slug
      setSlug(realSlug)
      const t = searchParams.get('type') as 'patient' | 'staff'
      if (t) setType(t)
    })
  }, [params, searchParams])

  const supabase = createClient()

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Invalid email or password.'); setLoading(false); return }

    const user = authData.user
    const metaRole = user?.user_metadata?.role

    // Always check staff_accounts first — covers staff created before user_metadata.role was set
    const { data: staffRow } = await supabase
      .from('staff_accounts')
      .select('role, clinic_id')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (staffRow) {
      // Staff member — go to dashboard
      router.push(`/clinic/${slug}/dashboard`)
      return
    }

    // Check clinic_owners table
    const { data: ownerRow } = await supabase
      .from('clinic_owners')
      .select('clinic_id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (ownerRow || metaRole === 'owner') {
      router.push(`/clinic/${slug}/dashboard`)
      return
    }

    // Patient
    router.push(`/clinic/${slug}/portal`)
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
      `}</style>

      <div className="page">
        <div className="card">
          <button className="back" onClick={() => router.push(`/clinic/${slug}`)}>
            ← Back
          </button>

          <div className="title">
            {isPatient ? 'Welcome back' : 'Staff login'}
          </div>
          <div className="subtitle">
            {isPatient ? 'Sign in to your patient portal' : 'Access the clinic dashboard'}
          </div>

          {error && <div className="error">{error}</div>}

          <div className="field">
            <label>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
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
