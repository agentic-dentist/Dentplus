import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RESERVED = [
  'www', 'app', 'api', 'admin', 'superadmin', 'demo',
  'staging', 'mail', 'help', 'support', 'blog', 'status', 'dentplus',
]

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  if (slug.length < 3) return NextResponse.json({ available: false, reason: 'too_short' })
  if (RESERVED.includes(slug.toLowerCase())) return NextResponse.json({ available: false, reason: 'reserved' })

  const { data } = await supabase
    .from('clinic_settings').select('id').eq('slug', slug).maybeSingle()

  return NextResponse.json({ available: !data })
}