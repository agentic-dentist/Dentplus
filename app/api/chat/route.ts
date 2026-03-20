import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { classifyIntent } from '@/lib/agents/orchestrator'
import { runConcierge } from '@/lib/agents/concierge'
import { runAuditor } from '@/lib/agents/auditor'
import { audit } from '@/lib/audit'
import type { Anthropic } from '@anthropic-ai/sdk'

export async function GET() {
  return new Response('DentPlus Agent API', { status: 200 })
}

export async function POST(request: Request) {
  try {
    const { messages, clinicId } = await request.json()

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    const db = createServerClient()

    // ── Fetch clinic info ────────────────────────────────────────────────────
    const { data: clinic, error: clinicError } = await db
      .from('clinics')
      .select('name, timezone')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // ── Start conversation audit ─────────────────────────────────────────────
    const isFirstMessage = messages.length <= 1
    if (isFirstMessage) {
      await audit({
        clinic_id: clinicId,
        action: 'conversation_started',
        agent: 'system',
        success: true
      })
    }

    // ── Step 1: Orchestrator classifies intent ───────────────────────────────
    const lastUserMessage = [...messages].reverse().find(
      (m: { role: string }) => m.role === 'user'
    )
    const userText = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : lastUserMessage?.content?.[0]?.text ?? ''

    const orchestratorResult = await classifyIntent(userText, clinicId)

    // ── Step 2: Route to appropriate agent ───────────────────────────────────
    let agentResponse = ''

    // Currently routing to concierge for all intents
    // Diagnostician and Liaison will be added in Phase 2
    agentResponse = await runConcierge(
      messages as Anthropic.MessageParam[],
      clinicId,
      clinic.name,
      clinic.timezone || 'America/Toronto',
      orchestratorResult
    )

    // ── Step 3: Auditor always runs last ─────────────────────────────────────
    const conversationWithResponse: Anthropic.MessageParam[] = [
      ...(messages as Anthropic.MessageParam[]),
      { role: 'assistant', content: agentResponse }
    ]

    // Run auditor async — don't block the response
    runAuditor(
      conversationWithResponse,
      clinicId,
      orchestratorResult.intent
    ).catch(err => console.error('[AUDITOR ERROR]', err))

    return NextResponse.json({
      message: agentResponse,
      meta: {
        intent: orchestratorResult.intent,
        urgency: orchestratorResult.urgency,
        agent: orchestratorResult.routeTo
      }
    })

  } catch (error) {
    console.error('[CHAT API ERROR]', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
