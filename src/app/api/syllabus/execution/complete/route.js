import { NextResponse } from 'next/server.js'
import { normalizeLessonKey } from '../../../../lib/lessonKeyNormalization.js'
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

async function completeSessionTransaction(admin, values) {
  const { data, error } = await admin.rpc('complete_lesson_session_transactional', values)
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('Transactional session completion returned no result')
  return data
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const sessionId = normalizeUuid(body?.sessionId)
    if (!sessionId) return NextResponse.json({ error: 'A valid sessionId is required', code: 'SESSION_ID_REQUIRED' }, { status: 400 })
    const lessonKey = normalizeLessonKey(body?.lessonId)
    if (!lessonKey) return NextResponse.json({ error: 'A lessonId is required', code: 'LESSON_ID_REQUIRED' }, { status: 400 })
    const occurrenceId = String(body?.occurrenceId || '').trim()
    if (!occurrenceId) return NextResponse.json({ error: 'A Syllabus occurrenceId is required', code: 'SYLLABUS_OCCURRENCE_REQUIRED' }, { status: 400 })

    const repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) return NextResponse.json({ error: 'Learner not found or unauthorized', code: 'FORBIDDEN' }, { status: 403 })

    const source = ['session-v2', 'webb'].includes(String(body?.source || '').trim())
      ? String(body.source).trim()
      : null
    const percentage = Number(body?.testPercentage)
    const testPercentage = Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 ? percentage : null
    const runTransaction = deps.completeSessionTransaction || completeSessionTransaction
    const result = await runTransaction(context.admin, {
      p_session_id: sessionId,
      p_learner_id: learnerId,
      p_lesson_id: lessonKey,
      p_syllabus_occurrence_id: occurrenceId,
      p_source: source,
      p_test_percentage: testPercentage,
    })
    if (!result.ok) {
      return NextResponse.json({ ...result, error: 'This protected lesson session could not be completed.' }, { status: 409 })
    }
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Could not complete the protected lesson session' }, { status: 500 })
  }
}
