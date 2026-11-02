import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { normalizeLessonKey } from '../../../lib/lessonKeyNormalization.js'
import { verifyFacilitatorLessonAccess } from '../../../lib/serverLessonAccess.mjs'
import { normalizeInstructionalTeacher } from '../../../lib/syllabus/instructionalTeacher.mjs'
import { resolveSyllabusExecution } from '../../../lib/syllabus/executionAuthorization.server.mjs'

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
    const createIntent = deps.createRestartIntent || (async (values) => {
      const { data, error } = await context.admin.from('syllabus_restart_intents')
        .insert(values).select('id').single()
      if (error) throw error
      return data
    })
    const restartId = (deps.randomUUID || randomUUID)()
    const scheduledDate = source.calendar.today
    const intent = await createIntent({ id: restartId, facilitator_id: context.user.id,
      learner_id: learnerId, lesson_key: source.scope.lessonKey,
      instructional_teacher: teacher, scheduled_date: scheduledDate,
      source_occurrence_id: sourceOccurrenceId })
    if (!intent?.id) throw new Error('The restarted lesson was not saved.')
    // Historical evidence remains; the new learner-facing occurrence has its own ID.
    // A failure to release a live session must remain visible to the facilitator.
    await (deps.releasePreviousAttempt || releasePreviousAttempt)(context.admin, learnerId, source.scope.lessonKey, now)
    const response = NextResponse.json({ ok: true, occurrenceId: `restart:${intent.id}`,
      lessonKey: source.scope.lessonKey, instructionalTeacher: teacher, scheduledDate })
    return response
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    const message = error instanceof SyllabusError ? error.message
      : 'Ms. Sonoma could not prepare the restart. The lesson and recorded work are retained. Try again, or revise a new version.'
    return NextResponse.json({ error: message, code: error.code || 'LESSON_RESTART_FAILED' }, { status })
  }
}
