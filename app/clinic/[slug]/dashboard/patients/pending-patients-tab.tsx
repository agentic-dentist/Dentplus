// Add this component to the top of your patients/page.tsx file
// Then add a tab switcher at the top of the page

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClinicUser } from '../clinic-context'

interface PendingAccount {
  id: string
  full_name: string
  email: string
  created_at: string
  patient_id: string | null
}

export function PendingPatientsTab() {
  const { clinicId } = useClinicUser()
  const [pending, setPending] = useState<PendingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) return
    const supabase = createClient()
    supabase.from('patient_accounts')
      .select('id, full_name, email, created_at, patient_id')
      .eq('clinic_id', clinicId)
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPending(data || [])
        setLoading(false)
      })
  }, [clinicId])

  const approve = async (accountId: string) => {
    setProcessing(accountId)
    const res = await fetch('/api/patient/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientAccountId: accountId, clinicId }),
    })
    if (res.ok) {
      setPending(p => p.filter(a => a.id !== accountId))
    }
    setProcessing(null)
  }

  const decline = async (accountId: string, patientId: string | null) => {
    setProcessing(accountId)
    const supabase = createClient()
    await supabase.from('patient_accounts').delete().eq('id', accountId)
    if (patientId) {
      await supabase.from('patients').delete().eq('id', patientId)
    }
    setPending(p => p.filter(a => a.id !== accountId))
    setProcessing(null)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#CBD5E1', fontSize: 14 }}>Loading...</div>

  if (pending.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 14, color: '#CBD5E1' }}>No pending approvals</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pending.map(account => (
        <div key={account.id} style={{ background: 'white', border: '1.5px solid #FEF3C7', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 3 }}>{account.full_name}</div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>{account.email}</div>
            <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>
              Registered {new Date(account.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => decline(account.id, account.patient_id)}
              disabled={processing === account.id}
              style={{ padding: '8px 16px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
              Decline
            </button>
            <button
              onClick={() => approve(account.id)}
              disabled={processing === account.id}
              style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
              {processing === account.id ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
