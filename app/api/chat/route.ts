import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { classifyIntent } from '@/lib/agents/orchestrator'
import { runConcierge } from '@/lib/agents/concierge'
import { runAuditor } from '@/lib/agents/auditor'
import { audit } from '@/lib/audit'
import { lookupPatientByAuthId } from '@/lib/phi'
import type { Anthropic } from '@anthropic-ai/sdk'

export async function GET() {
  return new Response('DentPlus Agent API', { status: 200 })
}

export async function POST(request: Request) {
  try {
    const { messages, clinicId, patientAuthId } = await request.json()

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    const db = createServerClient()

    // ── Fetch clinic info ──────────────────────────────────────────────────
    const { data: clinic, error: clinicError } = await db
      .from('clinics')
      .select('name, timezone')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // ── Pre-identify patient if auth session passed ────────────────────────
    // When a logged-in patient opens the booking widget, we resolve their
    // identity server-side so the agent never needs to ask for their name.
    let preIdentifiedPatient: {
      external_ref: string
      display_name: string
      preferred_language: string
    } | null = null

    if (patientAuthId) {
      const result = await lookupPatientByAuthId(patientAuthId, clinicId, db)
      if (result) {
        preIdentifiedPatient = result
      }
    }

    // ── Detect closing signals before running agents ───────────────────────
    const lastMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const lastText = typeof lastMsg?.content === 'string'
      ? lastMsg.content.toLowerCase().trim()
      : (lastMsg?.content?.[0]?.text ?? '').toLowerCase().trim()

    const closingPhrases = ['thank you', 'thanks', 'np', 'no problem', 'that is all',
      'thats all', "that's all", 'bye', 'goodbye', 'perfect', 'great', 'merci',
      'bonne journee', 'bonne journée', 'au revoir', 'parfait', 'super', 'ok bye',
      'ok thanks', 'ok thank you', 'sounds good', 'got it', 'all good']

    const isClosing = closingPhrases.some(p =>
      lastText === p || lastText.startsWith(p + ' ') || lastText.endsWith(' ' + p)
    )

    if (isClosing) {
      const closings = [
        'Have a great day! We look forward to seeing you.',
        'You are welcome! Have a wonderful day.',
        'Happy to help. Take care and see you soon!',
        'Of course! Have a great day.',
        'De rien! Bonne journée et à bientôt.'
      ]
      const closing = closings[Math.floor(Math.random() * closings.length)]
      return NextResponse.json({
        message: closing,
        meta: { intent: 'greeting', urgency: 'routine', agent: 'concierge' }
      })
    }

    // ── Start conversation audit ───────────────────────────────────────────
    const isFirstMessage = messages.length <= 1
    if (isFirstMessage) {
      await audit({
        clinic_id: clinicId,
        action: 'conversation_started',
        agent: 'system',
        success: true
      })
    }

    // ── Step 1: Orchestrator classifies intent ─────────────────────────────
    const lastUserMessage = [...messages].reverse().find(
      (m: { role: string }) => m.role === 'user'
    )
    const userText = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : lastUserMessage?.content?.[0]?.text ?? ''

    const orchestratorResult = await classifyIntent(userText, clinicId)

    // ── Step 2: Route to concierge ─────────────────────────────────────────
    const agentResponse = await runConcierge(
      messages as Anthropic.MessageParam[],
      clinicId,
      clinic.name,
      orchestratorResult.urgency === 'emergency',
      db,
      preIdentifiedPatient  // passes pre-identified patient to skip name ask
    )

    // ── Step 3: Async auditor ──────────────────────────────────────────────
    if (messages.length > 2) {
      runAuditor(messages, clinicId).catch(console.error)
    }

    return NextResponse.json({
      message: agentResponse,
      meta: {
        intent: orchestratorResult.intent,
        urgency: orchestratorResult.urgency,
        agent: 'concierge',
        pre_identified: !!preIdentifiedPatient
      }
    })

  } catch (error) {
    console.error('[CHAT API]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
