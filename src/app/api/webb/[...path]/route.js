// Next.js catch-all proxy → Mrs. Webb Cohere server (http://127.0.0.1:7720)
//
// Forwards:
//   GET  /api/webb/health                   → GET  /health
//   GET  /api/webb/lesson/list              → GET  /mrs-webb/lesson/list
//   POST /api/webb/lesson/start             → POST /mrs-webb/lesson/start
//   POST /api/webb/lesson/item-done         → POST /mrs-webb/lesson/item-done
//   POST /api/webb/lesson/respond           → POST /mrs-webb/lesson/respond   ← safety-filtered
//   GET  /api/webb/lesson/status            → GET  /mrs-webb/lesson/status
//   POST /api/webb/lesson/remediate         → POST /mrs-webb/lesson/remediate
//   POST /api/webb/lesson/remediation-done  → POST /mrs-webb/lesson/remediation-done
//   GET  /api/webb/lesson/reward            → GET  /mrs-webb/lesson/reward
//   POST /api/webb/lesson/close             → POST /mrs-webb/lesson/close
//
// Safety:
//   • POST /respond: student `text` is validated via contentSafety before forwarding.
//   • All other student-initiated POST bodies are passed through (no user-generated text).
//   • The Cohere server enforces a separate safety layer on its end.
//   • No OpenAI calls are made here — Cohere handles LLM.

import { NextResponse } from 'next/server'
import { validateInput, getFallbackResponse } from '@/lib/contentSafety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const WEBB_BASE = process.env.WEBB_SERVER_URL || 'http://127.0.0.1:7720'

// Paths that live directly under / on the Cohere server (not under /mrs-webb/)
const ROOT_PATHS = new Set(['health'])

function buildUpstreamUrl(pathSegments, searchParams) {
  const joined = pathSegments.join('/')
  const upstreamPath = ROOT_PATHS.has(joined) ? `/${joined}` : `/mrs-webb/${joined}`
  const qs = searchParams.toString()
  return `${WEBB_BASE}${upstreamPath}${qs ? `?${qs}` : ''}`
}

// ── Safety check for /lesson/respond ──────────────────────────────────────────
async function validateRespondBody(body) {
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return { ok: false, status: 400, error: 'Student text is required.' }

  const validation = validateInput(text, 'general')
  if (!validation.safe) {
    // Return a Mrs. Webb-style safety reply rather than a hard error
    return {
      ok: false,
      status: 200,
      safetyReply: {
        passed: false,
        attempts: 1,
        nudge: getFallbackResponse(validation.reason),
        next_probe: null,
        needs_remediation: false,
        _safety_blocked: true
      }
    }
  }
  return { ok: true }
}

// ── Generic proxy helper ───────────────────────────────────────────────────────
async function proxyRequest(method, upstreamUrl, body) {
  const init = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== null && (method === 'POST' || method === 'PUT')) {
    init.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(upstreamUrl, init)
  } catch (netErr) {
    return NextResponse.json(
      { error: "Mrs. Webb's server is not reachable. Please try again shortly." },
      { status: 503 }
    )
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = await res.json().catch(() => ({}))
    return NextResponse.json(json, { status: res.status })
  }
  const text = await res.text().catch(() => '')
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': contentType || 'text/plain' }
  })
}

// ── Route handlers ─────────────────────────────────────────────────────────────

export async function GET(req, { params }) {
  const segments = (await params).path ?? []
  const url = new URL(req.url)
  const upstream = buildUpstreamUrl(segments, url.searchParams)
  return proxyRequest('GET', upstream, null)
}

export async function POST(req, { params }) {
  const segments = (await params).path ?? []
  const url = new URL(req.url)
  const upstream = buildUpstreamUrl(segments, url.searchParams)

  let body = {}
  try {
    const raw = await req.text()
    if (raw) body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // ── Safety layer for student free-text input ─────────────────────────────
  const pathStr = segments.join('/')
  if (pathStr === 'lesson/respond') {
    const check = await validateRespondBody(body)
    if (!check.ok) {
      if (check.safetyReply) {
        return NextResponse.json(check.safetyReply, { status: 200 })
      }
      return NextResponse.json({ error: check.error }, { status: check.status })
    }
  }

  return proxyRequest('POST', upstream, body)
}
