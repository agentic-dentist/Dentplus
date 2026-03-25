import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const clinicId = searchParams.get('clinicId')
  const step = parseInt(searchParams.get('step') || '0')
  if (!clinicId) return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })

  try {
    if (step === 2) {
      const { data: staff } = await supabase.from('staff_accounts').select('id, full_name, role, email').eq('clinic_id', clinicId).eq('is_active', true)
      if (!staff?.length) return NextResponse.json({ providers: [] })

      const { data: schedules } = await supabase.from('provider_schedules').select('staff_id, day_of_week, start_time, end_time, is_active').eq('clinic_id', clinicId)
      const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

      const providers = staff.map(s => ({
        id: s.id, full_name: s.full_name, role: s.role, email: s.email,
        schedule: days.reduce((acc, day, i) => {
          const sched = schedules?.find(sc => sc.staff_id === s.id && sc.day_of_week === i + 1)
          return { ...acc, [day]: { start: sched?.start_time?.slice(0,5) || '09:00', end: sched?.end_time?.slice(0,5) || '17:00', active: sched?.is_active ?? false } }
        }, {}),
      }))
      return NextResponse.json({ providers })
    }

    if (step === 3) {
      const { data: services } = await supabase.from('services').select('id, name, duration_mins, color').eq('clinic_id', clinicId).eq('is_active', true)
      if (!services?.length) return NextResponse.json({ services: [] })

      const { data: svcProviders } = await supabase.from('service_providers').select('service_id, staff_id').in('service_id', services.map(s => s.id))
      const mapped = services.map(svc => ({ ...svc, staff_ids: svcProviders?.filter(sp => sp.service_id === svc.id).map(sp => sp.staff_id) || [] }))
      return NextResponse.json({ services: mapped })
    }

    if (step === 4) {
      const { data: settings } = await supabase.from('clinic_settings').select('accepted_insurers, email').eq('clinic_id', clinicId).maybeSingle()
      const { data: sub } = await supabase.from('subscriptions').select('plan').eq('clinic_id', clinicId).maybeSingle()
      return NextResponse.json({ billing: { billing_email: settings?.email || '', accepted_insurers: settings?.accepted_insurers || [], plan_tier: sub?.plan || 'pro' } })
    }

    return NextResponse.json({})
  } catch (err) {
    console.error('Setup GET error:', err)
    return NextResponse.json({ error: 'Failed to load step data.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { step, clinicId } = body
    if (!clinicId || !step) return NextResponse.json({ error: 'Missing step or clinicId.' }, { status: 400 })

    const { data: clinic } = await supabase.from('clinics').select('id, slug').eq('id', clinicId).single()
    if (!clinic) return NextResponse.json({ error: 'Clinic not found.' }, { status: 404 })

    if (step === 1) {
      const { name, address, city, province, postal_code, phone, email, languages, opening_hours } = body
      const fullAddress = [address, city, province, postal_code].filter(Boolean).join(', ')

      const { error: clinicErr } = await supabase.from('clinics').update({ name, languages, setup_step: 1 }).eq('id', clinicId)
      if (clinicErr) return NextResponse.json({ error: 'Failed to update clinic.' }, { status: 500 })

      const { error: settingsErr } = await supabase.from('clinic_settings').update({ phone, email, address: fullAddress, opening_hours }).eq('clinic_id', clinicId)
      if (settingsErr) return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })

      return NextResponse.json({ success: true })
    }

    if (step === 2) {
      const { providers } = body
      const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

      for (const provider of providers) {
        let staffId = provider.id

        if (!staffId) {
          const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
            email: provider.email.toLowerCase(), email_confirm: false,
            password: crypto.randomUUID(),
            user_metadata: { full_name: provider.full_name, role: provider.role, clinic_id: clinicId },
          })
          if (authErr && !authErr.message.includes('already registered')) {
            return NextResponse.json({ error: `Could not create user for ${provider.full_name}` }, { status: 500 })
          }
          const authId = authUser?.user?.id
          if (!authId) return NextResponse.json({ error: `Could not resolve auth user for ${provider.email}` }, { status: 500 })

          const { data: newStaff, error: staffErr } = await supabase.from('staff_accounts')
            .insert({ auth_id: authId, clinic_id: clinicId, email: provider.email.toLowerCase(), full_name: provider.full_name, role: provider.role })
            .select('id').single()
          if (staffErr || !newStaff) return NextResponse.json({ error: `Could not create staff account for ${provider.full_name}` }, { status: 500 })
          staffId = newStaff.id

          await supabase.from('staff_invites').insert({
            clinic_id: clinicId, invited_by: await getOwnerId(clinicId),
            email: provider.email.toLowerCase(), full_name: provider.full_name, role: provider.role, status: 'pending',
          })
        } else {
          await supabase.from('staff_accounts').update({ full_name: provider.full_name, role: provider.role }).eq('id', staffId)
        }

        await supabase.from('provider_schedules').delete().eq('staff_id', staffId).eq('clinic_id', clinicId)
        await supabase.from('provider_schedules').insert(
          days.map((day, i) => ({
            staff_id: staffId, clinic_id: clinicId, day_of_week: i + 1,
            start_time: provider.schedule[day]?.start || '09:00',
            end_time: provider.schedule[day]?.end || '17:00',
            is_active: provider.schedule[day]?.active ?? false,
          }))
        )
      }

      await supabase.from('clinics').update({ setup_step: 2 }).eq('id', clinicId)
      return NextResponse.json({ success: true })
    }

    if (step === 3) {
      const { services } = body
      const { data: existingServices } = await supabase.from('services').select('id').eq('clinic_id', clinicId)
      const incomingIds = services.filter((s: { id?: string }) => s.id).map((s: { id: string }) => s.id)
      const toDelete = existingServices?.filter(e => !incomingIds.includes(e.id)).map(e => e.id) || []

      if (toDelete.length) {
        await supabase.from('service_providers').delete().in('service_id', toDelete)
        await supabase.from('services').delete().in('id', toDelete)
      }

      for (const svc of services) {
        let serviceId = svc.id
        if (serviceId) {
          await supabase.from('services').update({ name: svc.name, duration_mins: svc.duration_mins, color: svc.color }).eq('id', serviceId)
        } else {
          const { data: newSvc, error: svcErr } = await supabase.from('services')
            .insert({ clinic_id: clinicId, name: svc.name, duration_mins: svc.duration_mins, color: svc.color })
            .select('id').single()
          if (svcErr || !newSvc) return NextResponse.json({ error: `Could not create service ${svc.name}` }, { status: 500 })
          serviceId = newSvc.id
        }

        await supabase.from('service_providers').delete().eq('service_id', serviceId)
        if (svc.staff_ids.length) {
          await supabase.from('service_providers').insert(svc.staff_ids.map((sid: string) => ({ service_id: serviceId, staff_id: sid })))
        }

        const { data: staffRoles } = await supabase.from('staff_accounts').select('id, role').in('id', svc.staff_ids)
        const uniqueRoles = [...new Set(staffRoles?.map((s: { role: string }) => s.role) || [])]
        for (const role of uniqueRoles) {
          await supabase.from('procedure_provider_rules')
            .upsert({ clinic_id: clinicId, appointment_type: svc.name, preferred_role: role }, { onConflict: 'clinic_id,appointment_type' })
        }
      }

      await supabase.from('clinics').update({ setup_step: 3 }).eq('id', clinicId)
      return NextResponse.json({ success: true })
    }

    if (step === 4) {
      const { billing_email, accepted_insurers, plan_tier, goLive } = body

      await supabase.from('clinic_settings').update({ accepted_insurers, email: billing_email }).eq('clinic_id', clinicId)
      await supabase.from('subscriptions').update({ plan: plan_tier }).eq('clinic_id', clinicId)
      await supabase.from('clinics').update({ setup_step: 4, ...(goLive ? { setup_complete: true, is_active: true } : {}) }).eq('id', clinicId)

      if (goLive) {
        const { data: pendingInvites } = await supabase.from('staff_invites').select('id, email, full_name, token').eq('clinic_id', clinicId).eq('status', 'pending')
        for (const invite of pendingInvites || []) {
          const inviteLink = `${process.env.APP_URL}/invite/accept?token=${invite.token}`
          await supabase.auth.admin.generateLink({ type: 'recovery', email: invite.email, options: { redirectTo: inviteLink } })
          console.log(`Invite for ${invite.email}: ${inviteLink}`) // replace with Resend when ready
        }
      }

      return NextResponse.json({ success: true, slug: clinic.slug })
    }

    return NextResponse.json({ error: 'Invalid step.' }, { status: 400 })
  } catch (err) {
    console.error('Setup POST error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}

async function getOwnerId(clinicId: string): Promise<string> {
  const { data } = await supabase.from('clinic_owners').select('id').eq('clinic_id', clinicId).single()
  return data?.id ?? clinicId
}