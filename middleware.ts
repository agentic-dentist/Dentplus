import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/clinic/')) return NextResponse.next()

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 3) return NextResponse.next()

  const section = segments[2]

  // Public pages — no auth needed
  if (section === 'book') return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const slug = segments[1]
  const loginUrl = new URL(`/clinic/${slug}/login`, request.url)
  const splashUrl = new URL(`/clinic/${slug}`, request.url)

  // Dashboard — requires staff auth
  if (section === 'dashboard') {
    if (!user) {
      loginUrl.searchParams.set('type', 'staff')
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const { data: staff } = await supabase
      .from('staff_accounts').select('id, role')
      .eq('auth_id', user.id).eq('is_active', true).single()
    if (!staff) return NextResponse.redirect(splashUrl)
  }

  // Portal and intake — requires patient auth
  if (section === 'portal' || section === 'intake') {
    if (!user) {
      loginUrl.searchParams.set('type', 'patient')
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const { data: account } = await supabase
      .from('patient_accounts').select('id')
      .eq('auth_id', user.id).single()
    if (!account) return NextResponse.redirect(splashUrl)
  }

  return response
}

export const config = {
  matcher: ['/clinic/:path*']
}
