import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ clinicId: string }> }
) {
  const { clinicId } = await context.params
  const db = createServerClient()

  const { data, error } = await db
    .from('clinics')
    .select('name, phone, address')
    .eq('id', clinicId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}
