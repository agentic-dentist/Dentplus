import { createServerClient } from '@/lib/supabase/server'

export interface ClinicOwner {
  id: string
  auth_id: string
  clinic_id: string
  email: string
  full_name: string
}

export interface AdminContext {
  owner: ClinicOwner
  clinic: {
    id: string
    name: string
    slug: string
    primary_color: string
    phone: string | null
    email: string | null
    address: string | null
    logo_url: string | null
    welcome_message: string
  }
  subscription: {
    plan: string
    status: string
    trial_ends_at: string
    max_staff: number
    max_patients: number
  } | null
}

export async function getAdminContext(authId: string): Promise<AdminContext | null> {
  const db = createServerClient()

  const { data: owner } = await db
    .from('clinic_owners')
    .select('*')
    .eq('auth_id', authId)
    .single()

  if (!owner) return null

  const { data: settings } = await db
    .from('clinic_settings')
    .select(`slug, primary_color, phone, email, address, logo_url, welcome_message,
      clinics(id, name)`)
    .eq('clinic_id', owner.clinic_id)
    .single()

  if (!settings) return null

  const clinic = Array.isArray(settings.clinics) ? settings.clinics[0] : settings.clinics

  const { data: sub } = await db
    .from('subscriptions')
    .select('plan, status, trial_ends_at, max_staff, max_patients')
    .eq('clinic_id', owner.clinic_id)
    .single()

  return {
    owner,
    clinic: {
      id: (clinic as { id: string; name: string }).id,
      name: (clinic as { id: string; name: string }).name,
      slug: settings.slug,
      primary_color: settings.primary_color,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      logo_url: settings.logo_url,
      welcome_message: settings.welcome_message
    },
    subscription: sub
  }
}
