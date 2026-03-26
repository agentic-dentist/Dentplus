'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const [slug, setSlug] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    params.then(async p => {
      const hostname = window.location.hostname
      const realSlug = hostname.includes('.dentplus.ca')
        ? hostname.replace('.dentplus.ca', '')
        : p.slug
      setSlug(realSlug)

      const res = await fetch(`/api/public-clinic?slug=${realSlug}`)
      const data = await res.json()
      if (data.clinic) setClinicName(data.clinic.name)
    })
  }, [params])

  const handleRegister = async () => {
    if (!fullName || !email || !password) { setError('All fields are required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true); setError('')

    const res = await fetch('/api/patient/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, fullName, email: email.toLowerCase(), password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Could not create account.')
      setLoading(false); return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #E2E8F0', padding: 40, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: 24 }}>✓</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 0.75rem' }}>Account created!</h2>
          <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6, margin: '0 0 1rem' }}>
            Your account has been created. Once a staff member approves it, you'll receive an email and can sign in to your portal.
          </p>
          <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            This usually happens within one business day.
          </p>
          <button onClick={() => router.push(`/clinic/${slug}/login?type=patient`)}
            style={{ background: '#0F172A', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #E2E8F0', padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22 }}>🦷</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{clinicName || 'Your clinic'}</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Create your patient account</div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 5 }}>Full name</label>
            <input type="text" placeholder="Marie Tremblay" value={fullName} onChange={e => setFullName(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 5 }}>Email address</label>
            <input type="email" placeholder="marie@example.com" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 5 }}>Password</label>
            <input type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button onClick={handleRegister} disabled={loading} style={{
            width: '100%', padding: 12, background: loading ? '#E2E8F0' : '#0F172A',
            color: loading ? '#94A3B8' : 'white', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8', marginTop: 16, marginBottom: 0 }}>
            Already have an account?{' '}
            <button onClick={() => router.push(`/clinic/${slug}/login?type=patient`)}
              style={{ background: 'none', border: 'none', color: '#0EA5E9', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              Sign in
            </button>
          </p>
        </div>

        <p style={{ color: '#CBD5E1', fontSize: 12, marginTop: 16 }}>
          Powered by <strong>DentPlus</strong>
        </p>
      </div>
    </>
  )
}
