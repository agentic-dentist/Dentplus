import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// PATCH /api/appointments/[appointmentId]
// body: { action: 'cancel' } | { action: 'reschedule', startTime: string, endTime: string }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const { appointmentId } = await params
    const body = await request.json()
    const { action, clinicId, startTime, endTime, staffId, staffName } = body

    if (!appointmentId || !clinicId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()

    // Verify appointment belongs to this clinic
    const { data: existing, error: fetchError } = await db
      .from('appointments')
      .select('id, status, clinic_id, patient_id, provider_id, start_time, appointment_type')
      .eq('id', appointmentId)
      .eq('clinic_id', clinicId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (existing.status === 'cancelled' || existing.status === 'completed') {
      return NextResponse.json({ error: `Cannot modify a ${existing.status} appointment` }, { status: 400 })
    }

    if (action === 'cancel') {
      const { data, error } = await db
        .from('appointments')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .eq('clinic_id', clinicId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ appointment: data, action: 'cancelled' })
    }

    if (action === 'reschedule') {
      if (!startTime || !endTime) {
        return NextResponse.json({ error: 'startTime and endTime required for reschedule' }, { status: 400 })
      }

      // Check for conflicts on the new slot (excluding this appointment itself)
      const { data: conflict } = await db
        .from('appointments')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('provider_id', existing.provider_id)
        .eq('status', 'scheduled')
        .neq('id', appointmentId)
        .lt('start_time', endTime)
        .gt('end_time', startTime)
        .limit(1)

      if (conflict && conflict.length > 0) {
        return NextResponse.json({ error: 'That slot has already been booked. Please choose another.' }, { status: 409 })
      }

      const { data, error } = await db
        .from('appointments')
        .update({
          start_time: startTime,
          end_time: endTime,
          status: 'scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .eq('clinic_id', clinicId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ appointment: data, action: 'rescheduled' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error('[APPOINTMENTS PATCH]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
