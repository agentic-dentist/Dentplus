'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function VerifyContent() {
  const params = useSearchParams()
  const email = params.get('email') ?? 'your email'

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
        width: '100%', maxWidth: 440, background: '#111',
        border: '1px solid #222', borderRadius: 16, padding: '2.5rem', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem', fontSize: 24,
        }}>✉</div>

        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 0.75rem' }}>
          Check your inbox
        </h1>
        <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, margin: '0 0 0.5rem' }}>
          We sent a confirmation link to
        </p>
        <p style={{ color: '#aaa', fontSize: 15, fontWeight: 600, margin: '0 0 1.5rem', wordBreak: 'break-all' }}>
          {email}
        </p>
        <p style={{ color: '#555', fontSize: 13, lineHeight: 1.6, margin: '0 0 2rem' }}>
          Click the link to confirm your account and unlock the clinic setup wizard. Expires in 24 hours.
        </p>

        <div style={{
          background: '#0d0d0d', border: '1px solid #1e1e1e',
          borderRadius: 10, padding: '1rem', fontSize: 13, color: '#555',
        }}>
          Didn't receive it? Check your spam, or{' '}
          <Link href="/signup" style={{ color: '#1D9E75', textDecoration: 'none' }}>try again</Link>.
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyContent /></Suspense>
}