import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runRecall, findRecallCandidates } from '@/lib/agents/recall'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/recall?clinicId=X  — preview candidates without sending
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')
    if (!clinicId) return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })

    const candidates = await findRecallCandidates(clinicId, db)

    // Also get recent recall log
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90)
    const { data: recentLog } = await db
      .from('recall_log')
      .select('id, patient_id, channel, coverage_status, services_due, months_since_visit, last_visit_date, status, sent_at, message_text, insurance_provider, patients(full_name, email)')
      .eq('clinic_id', clinicId)
      .gte('sent_at', thirtyDaysAgo.toISOString())
      .order('sent_at', { ascending: false })
      .limit(100)

    return NextResponse.json({ candidates, recentLog: recentLog || [] })
  } catch (err) {
    console.error('[RECALL GET]', err)
    return NextResponse.json({ error: 'Failed to load recall data' }, { status: 500 })
  }
}

// POST /api/recall  — run recall (send messages)
// body: { clinicId, dryRun?, patientIds?, channel? }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clinicId, dryRun = false, patientIds, channel = 'auto' } = body

    if (!clinicId) return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })

    const summary = await runRecall(clinicId, { dryRun, patientIds, channel })
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[RECALL POST]', err)
    return NextResponse.json({ error: 'Recall run failed' }, { status: 500 })
  }
}
