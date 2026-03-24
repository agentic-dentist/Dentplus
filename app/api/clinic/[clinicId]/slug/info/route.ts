import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await db
    .from('clinic_settings')
    .select('slug, primary_color, phone, address, clinics(id, name)')
    .eq('slug', slug)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const clinic = Array.isArray(data.clinics) ? data.clinics[0] : data.clinics

  return NextResponse.json({
    id:            clinic.id,
    name:          clinic.name,
    slug:          data.slug,
    primary_color: data.primary_color || '#0EA5E9',
    phone:         data.phone,
    address:       data.address,
  })
}
