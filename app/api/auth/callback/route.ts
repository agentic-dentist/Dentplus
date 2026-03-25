import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') || 'patient'
  const slug = searchParams.get('slug') || 'demo'
  const next = searchParams.get('next') ?? '/setup'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        }
      }
    }
  )

  // ── Invite / magiclink flow (owner email confirmation) ──────────────────────
  if (token_hash && (type === 'invite' || type === 'magiclink' || type === 'email')) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'invite' | 'magiclink' | 'email',
    })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(`${origin}/signup`)
  }

  // ── OAuth / code flow ────────────────────────────────────────────────────────
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {

      // Check if clinic owner via user_metadata → send to setup wizard
      if (data.user.user_metadata?.role === 'owner') {
        return NextResponse.redirect(`${origin}/setup`)
      }

      // Existing patient flow
      if (type === 'patient') {
        const user = data.user
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Patient'
        await fetch(`${origin}/api/patient/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, fullName, email: user.email, authId: user.id })
        })
      }

      return NextResponse.redirect(`${origin}/clinic/${slug}/${type === 'staff' ? 'dashboard' : 'portal'}`)
    }
  }

  return NextResponse.redirect(`${origin}/clinic/${slug}`)
}
