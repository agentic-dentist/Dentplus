import { NextResponse } from 'next/server'
import { runOutreach, OutreachPayload } from '@/lib/agents/outreach'

export async function POST(request: Request) {
  try {
    const payload = await request.json() as OutreachPayload

    if (!payload.clinicId || !payload.patientId || !payload.outreachType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await runOutreach(payload)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[OUTREACH API]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
