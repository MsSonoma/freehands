import { normalizeAvailabilityMap, applyLessonAvailability } from './lessonAvailability.mjs'
import { normalizeLessonKey } from './lessonKeyNormalization.js'

const ACTIVE_LEASE_MS = 5 * 60 * 1000

export class LessonRevisionStateError extends Error {
  constructor(message, code, status = 500) {
    super(message)
    this.name = 'LessonRevisionStateError'
    this.code = code
    this.status = status
  }
}


function ownedLearnerFilter(facilitatorId) {
  return `facilitator_id.eq.${facilitatorId},owner_id.eq.${facilitatorId},user_id.eq.${facilitatorId}`
}

export function lessonRevisionSessionIsActive(session, { now = new Date(), activeLeaseMs = ACTIVE_LEASE_MS } = {}) {
  if (session?.ended_at) return false
  const timestamp = Date.parse(session?.last_activity_at || session?.started_at || '')
  if (!Number.isFinite(timestamp)) return true
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  return timestamp >= (nowMs - activeLeaseMs)
}

export function lessonRevisionAvailabilityTransition(previous, lessonKey) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  if (!canonicalKey) return { changed: false, approvedLessons: normalizeAvailabilityMap(previous) }
  const before = normalizeAvailabilityMap(previous)
  if (before[canonicalKey] !== true) return { changed: false, approvedLessons: before }
  const result = applyLessonAvailability(before, canonicalKey, false)
  return { changed: result.ok === true, approvedLessons: result.approvedLessons || before }
}

export async function synchronizeLessonRevisionState({
  admin,
  facilitatorId,
  lessonKey,
  now = new Date(),
  activeLeaseMs = ACTIVE_LEASE_MS,
} = {}) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  if (!admin || !facilitatorId || !canonicalKey || !canonicalKey.startsWith('generated/')) {
    throw new LessonRevisionStateError('A facilitator-owned generated lesson is required', 'LESSON_REVISION_INVALID', 400)
  }

  const associationLookup = await admin.from('syllabus_lesson_associations')
    .select('id,learner_id')
    .eq('facilitator_id', facilitatorId)
    .eq('lesson_key', canonicalKey)
  if (associationLookup.error) {
    throw new LessonRevisionStateError(associationLookup.error.message || 'Could not read Syllabus lesson associations', 'LESSON_REVISION_STATE_FAILED')
  }
  const associationRows = Array.isArray(associationLookup.data) ? associationLookup.data : []
  const learnerIds = Array.from(new Set(associationRows.map((row) => row?.learner_id).filter(Boolean)))
  let learners = []
  if (learnerIds.length > 0) {
    const learnerResult = await admin.from('learners').select('id,approved_lessons').in('id', learnerIds)
    if (learnerResult.error) {
      throw new LessonRevisionStateError(learnerResult.error.message || 'Could not read learner availability', 'LESSON_REVISION_STATE_FAILED')
    }
    learners = Array.isArray(learnerResult.data) ? learnerResult.data : []
  }

  const ownedLearnerResult = await admin.from('learners').select('id').or(ownedLearnerFilter(facilitatorId))
  if (ownedLearnerResult.error) {
    throw new LessonRevisionStateError(ownedLearnerResult.error.message || 'Could not verify facilitator learner ownership', 'LESSON_REVISION_STATE_FAILED')
  }
  const historyLearnerIds = Array.from(new Set((ownedLearnerResult.data || []).map((row) => row?.id).filter(Boolean)))
  if (historyLearnerIds.length > 0) {
    const sessionResult = await admin.from('lesson_sessions')
      .select('id,learner_id,lesson_id,started_at,last_activity_at,ended_at')
      .in('learner_id', historyLearnerIds)
      .eq('lesson_id', canonicalKey)
    if (sessionResult.error) {
      throw new LessonRevisionStateError(sessionResult.error.message || 'Could not verify lesson-session history', 'LESSON_REVISION_STATE_FAILED')
    }
    const sessions = Array.isArray(sessionResult.data) ? sessionResult.data : []
    const liveSessions = sessions.filter((row) => lessonRevisionSessionIsActive(row, { now, activeLeaseMs }))
    if (liveSessions.length > 0) {
      throw new LessonRevisionStateError(
        'This lesson is currently being taught. End the active learner session before regenerating it.',
        'LESSON_REVISION_ACTIVE_SESSION',
        409,
      )
    }
    if (sessions.length > 0) {
      throw new LessonRevisionStateError(
        'This lesson already has learner-session evidence and cannot be rewritten. Create a new lesson version for the changed content.',
        'LESSON_REVISION_HISTORICAL_ARTIFACT',
        409,
      )
    }
  }

  const updatedAt = (now instanceof Date ? now : new Date(now)).toISOString()
  const associationResult = await admin.from('syllabus_lesson_associations')
    .update({ readiness_state: 'draft', updated_at: updatedAt })
    .eq('facilitator_id', facilitatorId)
    .eq('lesson_key', canonicalKey)
    .select('id,learner_id')
  if (associationResult.error) {
    throw new LessonRevisionStateError(associationResult.error.message || 'Could not reset Syllabus lesson readiness', 'LESSON_REVISION_STATE_FAILED')
  }

  let availabilityRevoked = 0
  for (const learner of learners) {
    const transition = lessonRevisionAvailabilityTransition(learner?.approved_lessons, canonicalKey)
    if (!transition.changed) continue
    const { error } = await admin.from('learners')
      .update({ approved_lessons: transition.approvedLessons })
      .eq('id', learner.id)
    if (error) {
      throw new LessonRevisionStateError(error.message || 'Could not revoke learner availability for revised lesson', 'LESSON_REVISION_STATE_FAILED')
    }
    availabilityRevoked += 1
  }

  return {
    lessonKey: canonicalKey,
    associationsDowngraded: Array.isArray(associationResult.data) ? associationResult.data.length : associationRows.length,
    availabilityRevoked,
  }
}