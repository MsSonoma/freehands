import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../../lib/syllabus/supabaseRepository.server.mjs'
import { validateLearnerId } from '../../../../lib/syllabus/schema.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null
}

async function heartbeatTransaction(admin, values) {
  const { data, error } = await admin.rpc('heartbeat_lesson_session', values)
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('Instructional heartbeat returned no result')
  return data
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })

    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const sessionId = normalizeUuid(body?.sessionId)
    const browserSessionId = normalizeUuid(body?.browserSessionId)
    if (!sessionId || !browserSessionId) {
      return NextResponse.json({
        ok: false,
        active: false,
        error: 'Valid sessionId and browserSessionId values are required',
        code: 'SESSION_HEARTBEAT_IDENTITY_REQUIRED',
      }, { status: 400 })
    }

    const repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) {
      return NextResponse.json({ ok: false, active: false, error: 'Learner not found or unauthorized', code: 'FORBIDDEN' }, { status: 403 })
    }

    const runHeartbeat = deps.heartbeatTransaction || heartbeatTransaction
    const result = await runHeartbeat(context.admin, {
      p_session_id: sessionId,
      p_learner_id: learnerId,
      p_browser_session_id: browserSessionId,
    })

    const status = result?.state === 'identity_mismatch' || result?.state === 'ownership_mismatch' ? 409 : 200
    return NextResponse.json(result, { status })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      active: false,
      error: error?.message || 'Could not renew instructional execution ownership',
    }, { status: 500 })
  }
}