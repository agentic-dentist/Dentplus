'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export default function SignupPage() {
  const router = useRouter()
  const slugCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    clinicName: '',
    slug: '',
    ownerName: '',
    email: '',
    password: '',
  })
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!slugManuallyEdited && form.clinicName) {
      setForm(f => ({ ...f, slug: slugify(form.clinicName) }))
    }
  }, [form.clinicName, slugManuallyEdited])

  useEffect(() => {
    if (!form.slug) { setSlugStatus('idle'); return }
    if (form.slug.length < 3) { setSlugStatus('invalid'); return }

    setSlugStatus('checking')
    if (slugCheckRef.current) clearTimeout(slugCheckRef.current)

    slugCheckRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/signup/check-slug?slug=${form.slug}`)
        const data = await res.json()
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 400)

    return () => { if (slugCheckRef.current) clearTimeout(slugCheckRef.current) }
  }, [form.slug])

  const handleSlugChange = (val: string) => {
    setSlugManuallyEdited(true)
    setForm(f => ({ ...f, slug: slugify(val) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (slugStatus !== 'available') return
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      router.push('/signup/verify-email?email=' + encodeURIComponent(form.email))
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const slugIndicator = () => {
    if (slugStatus === 'checking') return { color: '#888', label: 'Checking…' }
    if (slugStatus === 'available') return { color: '#1D9E75', label: 'Available' }
    if (slugStatus === 'taken') return { color: '#E24B4A', label: 'Already taken' }
    if (slugStatus === 'invalid') return { color: '#E24B4A', label: 'Min. 3 characters' }
    return { color: '#888', label: '' }
  }

  const indicator = slugIndicator()
  const canSubmit =
    form.clinicName.trim() && form.ownerName.trim() && form.email.trim() &&
    form.password.length >= 8 && slugStatus === 'available' && !isSubmitting

  const labelStyle: React.CSSProperties = {
    display: 'block', color: '#888', fontSize: 12, fontWeight: 500,
    marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0 1rem', height: 44, background: '#0d0d0d',
    border: '1px solid #2a2a2a', borderRadius: 10, color: '#fff', fontSize: 14,
    fontFamily: "'Syne', sans-serif", outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem', fontFamily: "'Syne', sans-serif",
    }}>
      <Link href="/" style={{ textDecoration: 'none', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #1D9E75, #0EA5E9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>+</span>
          </div>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>DentPlus</span>
        </div>
      </Link>

      <div style={{
        width: '100%', maxWidth: 480, background: '#111',
        border: '1px solid #222', borderRadius: 16, padding: '2.5rem',
      }}>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 0.35rem' }}>
          Set up your clinic
        </h1>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 2rem', lineHeight: 1.5 }}>
          Takes 5 minutes. No credit card required — 30-day free trial.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>Clinic name</label>
            <input type="text" placeholder="Clinique Familiale Bélanger"
              value={form.clinicName}
              onChange={e => setForm(f => ({ ...f, clinicName: e.target.value }))}
              required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Your DentPlus URL</label>
            <div style={{
              display: 'flex', alignItems: 'center', background: '#0d0d0d',
              border: `1px solid ${slugStatus === 'available' ? '#1D9E75' : slugStatus === 'taken' || slugStatus === 'invalid' ? '#E24B4A' : '#2a2a2a'}`,
              borderRadius: 10, overflow: 'hidden',
            }}>
              <span style={{
                padding: '0 0.75rem 0 1rem', color: '#444', fontSize: 13,
                whiteSpace: 'nowrap', borderRight: '1px solid #1e1e1e',
                height: 44, display: 'flex', alignItems: 'center',
              }}>
                dentplus.ca/
              </span>
              <input type="text" value={form.slug}
                onChange={e => handleSlugChange(e.target.value)}
                required style={{ ...inputStyle, border: 'none', borderRadius: 0, background: 'transparent', flex: 1 }} />
            </div>
            {indicator.label && (
              <p style={{ margin: '0.35rem 0 0', fontSize: 12, color: indicator.color }}>{indicator.label}</p>
            )}
            {slugStatus === 'available' && (
              <p style={{ margin: '0.25rem 0 0', fontSize: 12, color: '#444' }}>
                Patients will visit <span style={{ color: '#888' }}>{form.slug}.dentplus.ca</span>
              </p>
            )}
          </div>

          <div style={{ borderTop: '1px solid #1e1e1e' }} />

          <div>
            <label style={labelStyle}>Your full name</label>
            <input type="text" placeholder="Dr. Sophie Tremblay"
              value={form.ownerName}
              onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
              required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" placeholder="sophie@clinique-belanger.ca"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required minLength={8} style={{ ...inputStyle, paddingRight: '3rem' }} />
              <button type="button" onClick={() => setShowPassword(s => !s)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12,
              }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)',
              borderRadius: 8, padding: '0.75rem 1rem', color: '#E24B4A', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={!canSubmit} style={{
            width: '100%', padding: '0.85rem',
            background: canSubmit ? 'linear-gradient(135deg, #1D9E75, #0EA5E9)' : '#1e1e1e',
            color: canSubmit ? '#fff' : '#444', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif",
            cursor: canSubmit ? 'pointer' : 'not-allowed', letterSpacing: '-0.01em',
          }}>
            {isSubmitting ? 'Creating your clinic…' : 'Create clinic'}
          </button>

          <p style={{ textAlign: 'center', color: '#444', fontSize: 13, margin: 0 }}>
            Already have a clinic?{' '}
            <Link href="/" style={{ color: '#1D9E75', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </form>
      </div>

      <p style={{ color: '#333', fontSize: 12, marginTop: '1.5rem', textAlign: 'center', maxWidth: 380 }}>
        Your data is stored in Canada and protected under PIPEDA and Law 25.
      </p>
    </div>
  )
}