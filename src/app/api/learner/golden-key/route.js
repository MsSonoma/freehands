import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { validateLearnerId } from '../../../lib/syllabus/schema.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null
}

async function runRpc(admin, name, values) {
  const { data, error } = await admin.rpc(name, values)
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error(`${name} returned no result`)
  return data
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ ok: false, error: context.error }, { status: context.status })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })

    const learnerId = validateLearnerId(body.learnerId)
    const lessonKey = String(body.lessonKey || '').trim()
    const action = String(body.action || '').trim().toLowerCase()
    if (!lessonKey) return NextResponse.json({ ok: false, error: 'lessonKey is required' }, { status: 400 })

    const repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) return NextResponse.json({ ok: false, error: 'Learner not found or unauthorized' }, { status: 403 })

    const rpc = deps.runRpc || runRpc
    let result
    if (action === 'apply') {
      result = await rpc(context.admin, 'apply_golden_key_to_lesson', {
        p_learner_id: learnerId,
        p_lesson_key: lessonKey,
      })
    } else if (action === 'finalize') {
      const executionSessionId = normalizeUuid(body.executionSessionId)
      const browserSessionId = normalizeUuid(body.browserSessionId)
      if (!executionSessionId || !browserSessionId) {
        return NextResponse.json({ ok: false, error: 'Valid executionSessionId and browserSessionId are required' }, { status: 400 })
      }
      result = await rpc(context.admin, 'finalize_golden_key_for_session', {
        p_execution_session_id: executionSessionId,
        p_learner_id: learnerId,
        p_browser_session_id: browserSessionId,
        p_lesson_key: lessonKey,
        p_award_earned_key: body.awardEarnedKey === true,
      })
    } else {
      return NextResponse.json({ ok: false, error: 'Unsupported Golden Key action' }, { status: 400 })
    }

    const status = result?.ok === false
      ? (['ownership_mismatch', 'session_not_completed'].includes(result?.state) ? 409 : 422)
      : 200
    return NextResponse.json(result, { status })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Golden Key operation failed' }, { status: 500 })
  }
}