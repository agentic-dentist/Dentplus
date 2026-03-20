import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminContext } from '@/lib/admin'

export default async function AdminRoot() {
  const db = createServerClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) redirect('/admin/login')

  const ctx = await getAdminContext(user.id)
  if (!ctx) redirect('/admin/register')

  redirect('/admin/dashboard')
}
