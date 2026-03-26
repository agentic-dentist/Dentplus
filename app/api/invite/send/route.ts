import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { inviteId, clinicId } = await request.json()
    if (!inviteId || !clinicId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Get invite details
    const { data: invite } = await adminClient
      .from('staff_invites')
      .select('id, email, full_name, role, token')
      .eq('id', inviteId)
      .single()

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Get clinic name
    const { data: clinic } = await adminClient
      .from('clinics')
      .select('name')
      .eq('id', clinicId)
      .single()

    const clinicName = clinic?.name || 'your clinic'
    const inviteLink = `${process.env.APP_URL}/invite/${invite.token}`

    if (!process.env.RESEND_API_KEY) {
      console.log(`[INVITE] ${invite.email}: ${inviteLink}`)
      return NextResponse.json({ success: true, note: 'No RESEND_API_KEY set' })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DentPlus <noreply@dentplus.ca>',
        to: invite.email,
        subject: `You've been invited to join ${clinicName} on DentPlus`,
        html: `
          <!DOCTYPE html>
          <html>
            <body style="background:#f8fafc;font-family:'Helvetica Neue',sans-serif;margin:0;padding:40px 20px;">
              <div style="max-width:480px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:40px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
                  <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#1D9E75,#0EA5E9);display:inline-flex;align-items:center;justify-content:center;">
                    <span style="color:#fff;font-size:18px;font-weight:700;line-height:1;">+</span>
                  </div>
                  <span style="color:#0f172a;font-size:18px;font-weight:700;">DentPlus</span>
                </div>
                <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px;">You're invited! 👋</h1>
                <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 8px;">Hi ${invite.full_name || invite.email},</p>
                <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                  You've been invited to join <strong>${clinicName}</strong> on DentPlus as a
                  <strong>${invite.role}</strong>. Click the button below to set up your account
                  and access the clinic dashboard.
                </p>
                <a href="${inviteLink}" style="display:block;text-align:center;background:#0F172A;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:600;margin-bottom:16px;">
                  Accept invitation →
                </a>
                <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
                  Or copy this link:<br/>
                  <a href="${inviteLink}" style="color:#0EA5E9;word-break:break-all;">${inviteLink}</a>
                </p>
                <p style="color:#94a3b8;font-size:11px;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:16px;">
                  This invitation expires in 7 days. If you were not expecting this, you can ignore this email.
                </p>
              </div>
            </body>
          </html>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[INVITE SEND]', err)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    // Mark invite as sent
    await adminClient.from('staff_invites').update({ status: 'sent' }).eq('id', invite.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INVITE SEND]', error)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
