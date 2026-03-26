'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PortalPendingGate({
  slug,
  children
}: {
  slug: string
  children: React.ReactNode
}) {
  const [status, setStatus] = useState<'loading' | 'approved' | 'pending' | 'unauthenticated'>('loading')
  const [clinicName, setClinicName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('unauthenticated'); return }

      const { data: settings } = await supabase
        .from('clinic_settings')
        .select('clinic_id, clinics(name)')
        .eq('slug', slug)
        .maybeSingle()

      if (!settings) { setStatus('unauthenticated'); return }

      const clinicName = (settings.clinics as { name: string } | null)?.name || ''
      setClinicName(clinicName)

      const { data: account } = await supabase
        .from('patient_accounts')
        .select('is_approved')
        .eq('auth_id', user.id)
        .eq('clinic_id', settings.clinic_id)
        .maybeSingle()

      if (!account) { router.push(`/clinic/${slug}/login?type=patient`); return }
      setStatus(account.is_approved ? 'approved' : 'pending')
    }
    check()
  }, [slug])

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: '#CBD5E1', fontSize: 14 }}>Loading...</p>
    </div>
  )

  if (status === 'pending') return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #E2E8F0', padding: 40, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: 24 }}>⏳</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 0.75rem' }}>Account pending approval</h2>
        <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6, margin: '0 0 1rem' }}>
          Your account at <strong>{clinicName}</strong> is waiting for staff approval.
        </p>
        <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          You'll receive an email once your account is approved. This usually happens within one business day.
        </p>
        <button onClick={() => supabase.auth.signOut().then(() => router.push(`/clinic/${slug}`))}
          style={{ marginTop: 24, background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 20px', fontSize: 13, color: '#64748B', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          Sign out
        </button>
      </div>
    </div>
  )

  if (status === 'unauthenticated') return null

  return <>{children}</>
}
