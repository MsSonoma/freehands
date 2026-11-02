import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { normalizeLessonKey } from '../../../lib/lessonKeyNormalization.js'
import { verifyFacilitatorLessonAccess } from '../../../lib/serverLessonAccess.mjs'
import { normalizeInstructionalTeacher } from '../../../lib/syllabus/instructionalTeacher.mjs'
import { resolveSyllabusExecution, createSyllabusExecutionProof, SYLLABUS_EXECUTION_COOKIE, PROOF_TTL_SECONDS } from '../../../lib/syllabus/executionAuthorization.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// End prior live sessions and record interruption in one database transaction.
// If the event write fails, the transaction rolls back instead of fabricating completion.
async function releasePreviousAttempt(admin, learnerId, lessonKey) {
  const { data, error } = await admin.rpc('release_lesson_sessions_for_facilitator_restart', {
    p_learner_id: learnerId,
    p_lesson_id: lessonKey,
  })
  if (error) throw error
  if (!Number.isInteger(data) || data < 0) throw new Error('Lesson restart did not confirm the previous session state')
  return data
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const lessonKey = normalizeLessonKey(body?.lessonKey)
    const teacher = normalizeInstructionalTeacher(body?.instructionalTeacher)
    const sourceOccurrenceId = String(body?.occurrenceId || '').trim()
    if (!lessonKey || !teacher || !sourceOccurrenceId) throw new SyllabusError('Choose a lesson and teacher to restart.', 400, 'RESTART_SELECTION_REQUIRED')
    const now = deps.now || new Date()
    const repository = deps.repository || createSyllabusRepository(context.admin)
    // Resolve the original occurrence to prove the educator controls this exact lesson.
    const source = await (deps.resolveSyllabusExecution || resolveSyllabusExecution)({
      repository, admin: context.admin, facilitatorId: context.user.id,
      learnerId, lessonKey, occurrenceId: sourceOccurrenceId, now,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
    })
    const verifyLesson = deps.verifyFacilitatorLessonAccess || verifyFacilitatorLessonAccess
    const access = await verifyLesson({ admin: context.admin, userId: context.user.id,
      lessonKey: source.scope.lessonKey,
      unapprovedError: 'Review and approve this lesson before starting a new attempt.' })
    if (!access?.ok) throw new SyllabusError(access?.error || 'This lesson needs review before restarting.', 409, 'LESSON_REVIEW_REQUIRED')
    const makeId = deps.randomUUID || randomUUID
    const occurrenceId = `restart:${makeId()}`
    const scope = { facilitatorId: context.user.id, learnerId, lessonKey: source.scope.lessonKey,
      occurrenceId, instructionalTeacher: teacher, today: source.calendar.today, restart: true }
    const secret = deps.proofSecret || process.env.SUPABASE_SERVICE_ROLE_KEY
    // Prepare proof before changing the active attempt, so missing configuration never closes it.
    const proof = createSyllabusExecutionProof(scope, secret, now)
    await (deps.releasePreviousAttempt || releasePreviousAttempt)(context.admin, learnerId, source.scope.lessonKey, now)
    const response = NextResponse.json({ ok: true, occurrenceId, lessonKey: scope.lessonKey, instructionalTeacher: teacher })
    response.cookies.set(SYLLABUS_EXECUTION_COOKIE, proof, {
      httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: PROOF_TTL_SECONDS,
    })
    return response
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    const message = error instanceof SyllabusError ? error.message
      : 'Ms. Sonoma could not prepare the restart. The lesson and recorded work are retained. Try again, or revise a new version.'
    return NextResponse.json({ error: message, code: error.code || 'LESSON_RESTART_FAILED' }, { status })
  }
}
