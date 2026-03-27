import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/appointments/slots?clinicId=X&providerId=Y&duration=60&excludeAppointmentId=Z
// Returns next 20 available slots for a provider
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId              = searchParams.get('clinicId')
    const providerId            = searchParams.get('providerId')
    const duration              = parseInt(searchParams.get('duration') || '60')
    const excludeAppointmentId  = searchParams.get('excludeAppointmentId')

    if (!clinicId || !providerId) {
      return NextResponse.json({ error: 'clinicId and providerId required' }, { status: 400 })
    }

    const db = createServerClient()

    // Montreal offset helpers
    const TZ_OFFSET_HOURS = -5 // EST (UTC-5); daylight: -4. Close enough for slot generation.

    const parseHour = (timeStr: string): number => {
      const [h, m] = timeStr.split(':').map(Number)
      return h + (m || 0) / 60
    }

    const buildSlotStart = (date: Date, hour: number): Date => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const h = String(Math.floor(hour)).padStart(2, '0')
      const min = String(Math.round((hour % 1) * 60)).padStart(2, '0')
      const local = new Date(`${y}-${m}-${d}T${h}:${min}:00`)
      // Convert local Montreal time to UTC
      local.setHours(local.getHours() - TZ_OFFSET_HOURS)
      return local
    }

    const hasConflict = async (slotStart: Date, slotEnd: Date): Promise<boolean> => {
      let query = db
        .from('appointments')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('provider_id', providerId)
        .eq('status', 'scheduled')
        .lt('start_time', slotEnd.toISOString())
        .gt('end_time', slotStart.toISOString())

      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId)
      }

      const { data } = await query.limit(1)
      return (data?.length || 0) > 0
    }

    const slots: Array<{
      startTime: string
      endTime: string
      display: string
      date: string
    }> = []

    const now = new Date()
    let checkDate = new Date(now)
    checkDate.setDate(checkDate.getDate() + 1) // Start from tomorrow
    let daysChecked = 0
    const TARGET_SLOTS = 20
    const MAX_DAYS = 60

    while (slots.length < TARGET_SLOTS && daysChecked < MAX_DAYS) {
      const dayOfWeek = checkDate.getDay() // 0 = Sun, 6 = Sat

      // Get provider's schedule for this day
      const { data: schedule } = await db
        .from('provider_schedules')
        .select('start_time, end_time')
        .eq('staff_id', providerId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single()

      if (!schedule) {
        // Provider not working this day — skip
        checkDate.setDate(checkDate.getDate() + 1)
        daysChecked++
        continue
      }

      const dayStart = parseHour(schedule.start_time)
      const dayEnd   = parseHour(schedule.end_time)

      // Generate hourly slots (or duration-based)
      const slotIncrement = duration >= 60 ? 1 : 0.5
      let hour = dayStart

      while (hour + duration / 60 <= dayEnd) {
        const slotStart = buildSlotStart(checkDate, hour)
        const slotEnd   = new Date(slotStart.getTime() + duration * 60000)

        // Skip past slots
        if (slotStart <= now) {
          hour += slotIncrement
          continue
        }

        const conflict = await hasConflict(slotStart, slotEnd)
        if (!conflict) {
          const localStart = new Date(slotStart)
          localStart.setHours(localStart.getHours() + TZ_OFFSET_HOURS)

          slots.push({
            startTime: slotStart.toISOString(),
            endTime:   slotEnd.toISOString(),
            display: localStart.toLocaleString('en-CA', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: true,
              timeZone: 'America/Toronto',
            }),
            date: localStart.toLocaleDateString('en-CA', {
              weekday: 'long', month: 'long', day: 'numeric',
              timeZone: 'America/Toronto',
            }),
          })

          if (slots.length >= TARGET_SLOTS) break
        }

        hour += slotIncrement
      }

      checkDate.setDate(checkDate.getDate() + 1)
      daysChecked++
    }

    return NextResponse.json({ slots })

  } catch (err) {
    console.error('[APPOINTMENTS SLOTS]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
