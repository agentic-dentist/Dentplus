import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const slug = searchParams.get('slug') || 'demo'
  const type = searchParams.get('type') || 'patient'

  if (code) {
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // For Google OAuth patients, auto-create their account
      if (type === 'patient') {
        const user = data.user
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Patient'

        await fetch(`${origin}/api/patient/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            fullName,
            email: user.email,
            authId: user.id
          })
        })
      }

      return NextResponse.redirect(`${origin}/clinic/${slug}/${type === 'staff' ? 'dashboard' : 'portal'}`)
    }
  }

  return NextResponse.redirect(`${origin}/clinic/${slug}`)
}
