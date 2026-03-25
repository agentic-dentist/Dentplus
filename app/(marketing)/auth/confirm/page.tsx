'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const handleRedirect = async () => {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })

        if (!error && data.session?.user) {
          const role = data.session.user.user_metadata?.role
          if (role === 'owner') {
            router.replace('/setup')
          } else {
            router.replace('/')
          }
          return
        }
      }

      // No token in hash — check if already signed in
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const role = session.user.user_metadata?.role
        router.replace(role === 'owner' ? '/setup' : '/')
        return
      }

      router.replace('/signup')
    }

    handleRedirect()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Syne', sans-serif",
      gap: '1rem',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'linear-gradient(135deg, #1D9E75, #0EA5E9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>+</span>
      </div>
      <p style={{ color: '#555', fontSize: 14, margin: 0 }}>Confirming your account…</p>
    </div>
  )
}
