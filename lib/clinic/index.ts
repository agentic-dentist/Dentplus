import { createServerClient } from '@/lib/supabase/server'

export interface ClinicInfo {
  id: string
  name: string
  slug: string
  timezone: string
  primary_color: string
  phone: string | null
  email: string | null
  address: string | null
  welcome_message: string
  logo_url: string | null
}

export async function getClinicBySlug(slug: string): Promise<ClinicInfo | null> {
  const db = createServerClient()

  const { data } = await db
    .from('clinic_settings')
    .select(`
      slug,
      primary_color,
      phone,
      email,
      address,
      welcome_message,
      logo_url,
      clinics (
        id,
        name,
        timezone
      )
    `)
    .eq('slug', slug)
    .single()

  if (!data || !data.clinics) return null

  const clinic = Array.isArray(data.clinics) ? data.clinics[0] : data.clinics

  return {
    id: clinic.id,
    name: clinic.name,
    slug: data.slug,
    timezone: clinic.timezone || 'America/Toronto',
    primary_color: data.primary_color || '#0EA5E9',
    phone: data.phone,
    email: data.email,
    address: data.address,
    welcome_message: data.welcome_message,
    logo_url: data.logo_url
  }
}
