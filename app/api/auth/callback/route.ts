import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// Service role client for DB lookups (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  // ── Invite / magiclink flow ──────────────────────────────────────────────────
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
      const user = data.user
      const role = user.user_metadata?.role

      // ── Clinic owner ──────────────────────────────────────────────────────
      if (role === 'owner') {
        const { data: owner } = await supabaseAdmin
          .from('clinic_owners')
          .select('clinic_id')
          .eq('auth_id', user.id)
          .maybeSingle()

        if (owner) {
          const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('slug, setup_complete')
            .eq('id', owner.clinic_id)
            .single()

          if (clinic) {
            if (!clinic.setup_complete) {
              // Setup not done — back to wizard on root domain
              return NextResponse.redirect(`https://dentplus.ca/setup`)
            }
            // Setup done — go to their subdomain dashboard
            return NextResponse.redirect(`https://${clinic.slug}.dentplus.ca/dashboard`)
          }
        }

        // Fallback
        return NextResponse.redirect(`https://dentplus.ca/setup`)
      }

      // ── Staff (receptionist, dentist, hygienist, etc.) ────────────────────
      if (['dentist', 'hygienist', 'receptionist', 'assistant'].includes(role)) {
        const { data: staff } = await supabaseAdmin
          .from('staff_accounts')
          .select('clinic_id')
          .eq('auth_id', user.id)
          .maybeSingle()

        if (staff) {
          const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('slug')
            .eq('id', staff.clinic_id)
            .single()

          if (clinic) {
            return NextResponse.redirect(`https://${clinic.slug}.dentplus.ca/dashboard`)
          }
        }
      }

      // ── Patient flow (existing) ───────────────────────────────────────────
      if (type === 'patient') {
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Patient'
        await fetch(`${origin}/api/patient/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, fullName, email: user.email, authId: user.id })
        })
        return NextResponse.redirect(`${origin}/clinic/${slug}/portal`)
      }

      return NextResponse.redirect(`${origin}/clinic/${slug}/portal`)
    }
  }

  return NextResponse.redirect(`${origin}/clinic/${slug}`)
}
