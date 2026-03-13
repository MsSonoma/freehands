// Next.js API route for Mrs. Webb — Chat-style educational AI teacher
// Safety: validateInput (Layer 1) + instruction hardening (Layer 3) + validateOutput (Layer 4)
// Stateless design: client sends conversation history each request; server injects Cohere context
// Cohere context: stub placeholder — install Cohere SDK and implement getWebContext() when ready

import { NextResponse } from 'next/server'
import { validateInput, hardenInstructions, validateOutput, getFallbackResponse } from '@/lib/contentSafety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.WEBB_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o'

// ============================================================================
// COHERE CONTEXT STUB
// ============================================================================
// Replace this function with real Cohere retrieval once the SDK is installed.
// It should:
//  1. Receive the latest student message (and optionally grade/subject).
//  2. Query the Cohere knowledge base for relevant educational context.
//  3. Return a short string of relevant facts/curriculum context.
//  4. On any failure return '' (safe fallback — Mrs. Webb still works without context).
// ============================================================================
async function getWebberContext(_studentMessage, _meta = {}) {
  // TODO: install Cohere SDK, initialize client, perform retrieval here
  // Example skeleton (do NOT uncomment until SDK is installed):
  //
  //  const { CohereClient } = await import('cohere-ai')
  //  const cohere = new CohereClient({ token: process.env.COHERE_API_KEY })
  //  const result = await cohere.chat({
  //    message: _studentMessage,
  //    connectors: [{ id: 'web-search' }],
  //    safetyMode: 'STRICT',
  //  })
  //  return result.text ?? ''

  return '' // stub: no context injected yet
}

// ============================================================================
// Safety: harden instructions for Mrs. Webb's chat persona
// ============================================================================
function buildSystemPrompt(cohereContext, learnerName, grade) {
  const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
  const nameGreeting = learnerName ? ` You are talking to ${learnerName}.` : ''

  const baseRole = `You are Mrs. Webb, a warm and encouraging educational chat teacher for ${gradeLabel} students.${nameGreeting}
Your role is to answer school-related questions, help explain concepts clearly, and guide students with patience.
Keep your responses concise (2–4 sentences), friendly, age-appropriate, and always end with a gentle prompt to keep the student engaged.`

  const context = cohereContext
    ? `\n\nRelevant curriculum context (use this to inform your answer):\n${cohereContext}`
    : ''

  return hardenInstructions(baseRole + context, 'general educational topics', [])
}

function createCallId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ============================================================================
// POST handler
// ============================================================================
export async function POST(req) {
  const callId = createCallId()
  const logPrefix = `[Mrs. Webb API][${callId}]`

  try {
    // ── Parse body ────────────────────────────────────────────────────────────
    let messages = []    // [{ role: 'student'|'webb', content: string }]
    let learnerName = ''
    let grade = ''

    try {
      const raw = await req.text()
      const body = JSON.parse(raw)
      messages = Array.isArray(body.messages) ? body.messages : []
      learnerName = typeof body.learnerName === 'string' ? body.learnerName.slice(0, 80) : ''
      grade = typeof body.grade === 'string' ? body.grade.slice(0, 20) : ''
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    // The most recent message must come from the student
    const latestMsg = messages[messages.length - 1]
    if (!latestMsg || latestMsg.role !== 'student') {
      return NextResponse.json({ error: 'Last message must be from student.' }, { status: 400 })
    }

    const studentText = typeof latestMsg.content === 'string' ? latestMsg.content.trim() : ''

    if (!studentText) {
      return NextResponse.json({ error: 'Message is empty.' }, { status: 400 })
    }

    // ── LAYER 1: Input validation (student message) ───────────────────────────
    const inputValidation = validateInput(studentText, 'general')
    if (!inputValidation.safe) {
      console.warn(`${logPrefix} Input rejected: ${inputValidation.reason}`)
      const fallback = getFallbackResponse(inputValidation.reason)
      return NextResponse.json({ reply: fallback }, { status: 200 })
    }

    // ── LAYER 1: Validate all prior student messages in history ───────────────
    for (const m of messages.slice(0, -1)) {
      if (m.role === 'student') {
        const priorCheck = validateInput(typeof m.content === 'string' ? m.content : '', 'general')
        if (!priorCheck.safe) {
          // If history is contaminated, proceed but truncate to just the latest message
          messages = [latestMsg]
          break
        }
      }
    }

    // ── COHERE CONTEXT INJECTION (stub) ───────────────────────────────────────
    let cohereContext = ''
    try {
      cohereContext = await getWebberContext(studentText, { grade, learnerName })
    } catch (cohereErr) {
      // Cohere unavailable — continue without context (safe degradation)
      console.warn(`${logPrefix} Cohere context fetch failed (non-fatal):`, cohereErr?.message)
    }

    // ── LAYER 3: Build hardened system prompt ─────────────────────────────────
    const systemPrompt = buildSystemPrompt(cohereContext, learnerName, grade)

    // ── Build OpenAI message array ─────────────────────────────────────────────
    // Map our internal roles to OpenAI roles
    // Limit history to last 10 exchanges (20 messages) to control token usage
    const historyWindow = messages.slice(-20)
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...historyWindow.map(m => ({
        role: m.role === 'student' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content.slice(0, 800) : ''
      }))
    ]

    // ── Call OpenAI ───────────────────────────────────────────────────────────
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({
          reply: `(Dev mode) Mrs. Webb heard: "${studentText}". OPENAI_API_KEY not set.`
        }, { status: 200 })
      }
      return NextResponse.json({ error: 'Mrs. Webb is unavailable.' }, { status: 503 })
    }

    let webbReply = ''
    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: 512,
          messages: openaiMessages
        })
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.error(`${logPrefix} OpenAI error ${res.status}:`, errText.slice(0, 300))
        return NextResponse.json({ error: 'Mrs. Webb is unavailable.' }, { status: 502 })
      }

      const json = await res.json()
      webbReply = json.choices?.[0]?.message?.content?.trim() || ''
    } catch (fetchErr) {
      console.error(`${logPrefix} Network error calling OpenAI:`, fetchErr?.message)
      return NextResponse.json({ error: 'Mrs. Webb is unavailable.' }, { status: 502 })
    }

    if (!webbReply) {
      return NextResponse.json({ reply: "I'm not sure how to answer that. Can you ask me in a different way?" }, { status: 200 })
    }

    // ── LAYER 4: Output validation ────────────────────────────────────────────
    const outputValidation = await validateOutput(webbReply, openaiKey, true)
    if (!outputValidation.safe) {
      console.warn(`${logPrefix} Output rejected: ${outputValidation.reason}`)
      return NextResponse.json({
        reply: getFallbackResponse('output_flagged')
      }, { status: 200 })
    }

    return NextResponse.json({ reply: webbReply }, { status: 200 })

  } catch (err) {
    console.error(`${logPrefix} Unexpected error:`, err?.message)
    return NextResponse.json({ error: 'Mrs. Webb is unavailable.' }, { status: 500 })
  }
}

// Lightweight health check
export async function GET() {
  return NextResponse.json({ ok: true, route: 'webb', runtime }, { status: 200 })
}
