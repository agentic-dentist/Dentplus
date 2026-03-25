'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function CompleteContent() {
  const params = useSearchParams()
  const slug = params.get('slug') ?? ''
  const dashboardUrl = `https://${slug}.dentplus.ca/dashboard`

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem', fontFamily: "'Syne', sans-serif",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'linear-gradient(135deg, #1D9E75, #0EA5E9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1.5rem', fontSize: 28,
      }}>
        ✓
      </div>

      <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 0.5rem', textAlign: 'center' }}>
        Your clinic is live
      </h1>
      <p style={{ color: '#666', fontSize: 14, margin: '0 0 2rem', textAlign: 'center' }}>
        {slug}.dentplus.ca is ready for patients.
      </p>

      <div style={{
        width: '100%', maxWidth: 440,
        background: '#111', border: '1px solid #222',
        borderRadius: 16, padding: '2rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        <a href={dashboardUrl} style={{
          display: 'block', textAlign: 'center',
          background: 'linear-gradient(135deg, #1D9E75, #0EA5E9)',
          color: '#fff', textDecoration: 'none',
          padding: '0.875rem', borderRadius: 10,
          fontSize: 15, fontWeight: 700,
        }}>
          Go to my dashboard
        </a>

        <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '0.875rem' }}>
          <p style={{ color: '#666', fontSize: 12, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Bookmark your dashboard
          </p>
          <p style={{ color: '#aaa', fontSize: 13, margin: 0, wordBreak: 'break-all' }}>
            {dashboardUrl}
          </p>
        </div>

        <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '0.875rem' }}>
          <p style={{ color: '#666', fontSize: 12, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Patient portal
          </p>
          <p style={{ color: '#aaa', fontSize: 13, margin: 0, wordBreak: 'break-all' }}>
            https://{slug}.dentplus.ca
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SetupCompletePage() {
  return <Suspense><CompleteContent /></Suspense>
}