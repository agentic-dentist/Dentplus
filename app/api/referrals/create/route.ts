import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runOutreach } from '@/lib/agents/outreach'

export async function POST(request: Request) {
  try {
    const { referralId, clinicId, clinicName, patientName, patientEmail, specialist, notes, urgency } = await request.json()

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── 1. Notify patient via portal (mark as notified) ──────────────────────
    const { data: patient } = await db
      .from('referrals')
      .select('patient_id, patients(full_name, phone_primary, email, preferred_language)')
      .eq('id', referralId)
      .single()

    if (patient) {
      const p = Array.isArray(patient.patients) ? patient.patients[0] : patient.patients as {
        full_name: string; phone_primary: string | null; email: string | null; preferred_language: string | null
      } | null

      if (p) {
        // Send patient notification via outreach agent
        const channel = p.phone_primary ? 'sms' : 'email'
        if (p.phone_primary || p.email) {
          await runOutreach({
            clinicId,
            patientId: patient.patient_id,
            patientName: p.full_name,
            patientPhone: p.phone_primary,
            patientEmail: p.email,
            preferredLanguage: (p.preferred_language || 'en') as 'en' | 'fr',
            outreachType: 'confirmation_request',
            channel,
            appointmentType: `referral to ${specialist.full_name}`,
            appointmentTime: 'to be scheduled',
            clinicName,
          })
        }

        await db.from('referrals')
          .update({ patient_notified: true, status: 'sent' })
          .eq('id', referralId)
      }
    }

    // ── 2. Lead capture — if specialist is NOT on DentPlus ───────────────────
    if (!specialist.is_on_dentplus && specialist.email) {
      // Send referral email to specialist (stub — uses Resend when configured)
      const resendKey = process.env.RESEND_API_KEY
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@dentplus.ca'

      const emailBody = `
Dear ${specialist.full_name},

You have received a patient referral from ${clinicName}.

Patient: ${patientName}
Urgency: ${urgency}
Clinical notes: ${notes}

This referral was sent via DentPlus — the AI-powered dental practice management platform used by ${clinicName}.

If you're interested in learning how DentPlus can help your practice, visit https://dentplus.vercel.app

Best regards,
${clinicName}
      `.trim()

      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${clinicName} <${fromEmail}>`,
            to: [specialist.email],
            subject: `Patient Referral from ${clinicName} — ${urgency === 'asap' ? 'URGENT' : urgency}`,
            text: emailBody,
          })
        })
      } else {
        // Stub — log the referral email
        console.log(`[REFERRAL LEAD - STUB] To: ${specialist.email}\n${emailBody}`)
      }

      await db.from('referrals').update({ lead_captured: true }).eq('id', referralId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[REFERRAL CREATE]', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
