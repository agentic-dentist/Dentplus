'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [invite, setInvite] = useState<{ email: string; full_name: string | null; role: string; clinic_name: string; slug: string } | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    params.then(async p => {
      setToken(p.token)
      const res = await fetch(`/api/invite/check?token=${p.token}`)
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setError(data.error || 'This invite link is invalid or has expired.')
      } else {
        setInvite(data.invite)
      }
      setChecking(false)
    })
  }, [params])

  const handleAccept = async () => {
    if (!password || !confirm) { setError('Please enter and confirm your password.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to accept invite.'); setLoading(false); return }

    await supabase.auth.signInWithPassword({ email: invite!.email, password })
    router.push(`/clinic/${data.slug}/dashboard`)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter',sans-serif;background:#F8FAFC;min-height:100vh}
        .page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px}
        .brand{display:flex;align-items:center;gap:10px;margin-bottom:32px}
        .brand-icon{width:36px;height:36px;background:#00C4A7;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
        .brand-name{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0F172A}
        .card{background:white;border-radius:16px;border:1px solid #E2E8F0;padding:36px 32px;width:100%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,0.06)}
        .title{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .subtitle{font-size:13px;color:#94A3B8;margin-bottom:24px}
        .invite-info{background:#F8FAFC;border-radius:10px;padding:14px;margin-bottom:20px}
        .invite-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0}
        .invite-label{color:#94A3B8}
        .invite-val{color:#0F172A;font-weight:500;text-transform:capitalize}
        .field{margin-bottom:14px}
        label{display:block;font-size:12px;font-weight:500;color:#64748B;margin-bottom:5px}
        input{width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:'Inter',sans-serif;color:#0F172A;outline:none;transition:border-color .15s}
        input:focus{border-color:#0F172A}
        .btn{width:100%;padding:12px;border-radius:10px;background:#4F46E5;color:white;font-size:14px;font-weight:500;font-family:'Inter',sans-serif;cursor:pointer;border:none;margin-top:8px;transition:background .15s}
        .btn:hover{background:#4338CA}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .error{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 14px;font-size:13px;color:#DC2626;margin-bottom:14px}
        .msg{text-align:center;padding:16px;color:#94A3B8;font-size:14px}
      `}</style>

      <div className="page">
        <div className="brand">
          <div className="brand-icon">🦷</div>
          <div className="brand-name">DentPlus</div>
        </div>

        <div className="card">
          {checking ? (
            <div className="msg">Checking invite...</div>
          ) : error && !invite ? (
            <div className="msg">{error}</div>
          ) : invite ? (
            <>
              <div className="title">You have been invited</div>
              <div className="subtitle">Set your password to join the clinic.</div>

              <div className="invite-info">
                <div className="invite-row"><span className="invite-label">Clinic</span><span className="invite-val">{invite.clinic_name}</span></div>
                <div className="invite-row"><span className="invite-label">Email</span><span className="invite-val">{invite.email}</span></div>
                <div className="invite-row"><span className="invite-label">Role</span><span className="invite-val">{invite.role}</span></div>
              </div>

              {error && <div className="error">{error}</div>}

              <div className="field">
                <label>Create password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" />
              </div>
              <div className="field">
                <label>Confirm password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password" onKeyDown={e => e.key === 'Enter' && handleAccept()} />
              </div>

              <button className="btn" onClick={handleAccept} disabled={loading}>
                {loading ? 'Setting up your account...' : 'Accept invite & sign in'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
