'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleRedirect = async () => {
      // Give Supabase JS time to parse the hash and establish the session
      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        if (session.user.user_metadata?.role === 'owner') {
          router.replace('/setup')
        } else {
          router.replace('/')
        }
        return
      }

      // Fallback: listen for auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          subscription.unsubscribe()
          if (session.user.user_metadata?.role === 'owner') {
            router.replace('/setup')
          } else {
            router.replace('/')
          }
        }
      })
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
