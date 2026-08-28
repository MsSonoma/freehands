import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizeLessonKey, resolveLessonKeyAgainst } from '../lessonKeyNormalization.js'
import { resolveCalendarContext } from '../calendarDate.mjs'
import { SyllabusError } from './schema.mjs'
import { composeSyllabusLessonTimeline } from './lessonTimeline.mjs'

export const SYLLABUS_EXECUTION_COOKIE = 'syllabus_execution'
const PROOF_TTL_SECONDS = 120

function clean(value) { return String(value || '').trim() }
function proofKey(secret) {
  if (!secret) throw new SyllabusError('Syllabus execution authorization is not configured', 500, 'EXECUTION_NOT_CONFIGURED')
  return createHmac('sha256', secret).update('ms-sonoma-syllabus-execution-v1').digest()
}
function signature(payload, secret) {
  return createHmac('sha256', proofKey(secret)).update(payload).digest('base64url')
}
function safeEqual(left, right) {
  const a = Buffer.from(left || '')
  const b = Buffer.from(right || '')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createSyllabusExecutionProof(scope, secret, now = new Date()) {
  const payload = Buffer.from(JSON.stringify({ ...scope, exp: Math.floor(now.getTime() / 1000) + PROOF_TTL_SECONDS })).toString('base64url')
  return `${payload}.${signature(payload, secret)}`
}

export function readSyllabusExecutionProof(value, secret, now = new Date()) {
  try {
    const [payload, suppliedSignature] = clean(value).split('.')
    if (!payload || !suppliedSignature || !safeEqual(signature(payload, secret), suppliedSignature)) return null
    const proof = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return Number(proof.exp) >= Math.floor(now.getTime() / 1000) ? proof : null
  } catch {
    return null
  }
}

export function executionProofMatches(proof, scope) {
  return Boolean(proof
    && proof.facilitatorId === scope.facilitatorId
    && proof.learnerId === scope.learnerId
    && proof.lessonKey === scope.lessonKey
    && proof.occurrenceId === scope.occurrenceId
    && proof.today === scope.today)
}

export async function resolveSyllabusExecution({
  repository,
  facilitatorId,
  learnerId,
  lessonKey,
  occurrenceId = '',
  now = new Date(),
  fallbackTimeZone,
}) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function'
    ? await repository.findFacilitatorTimeZone(facilitatorId)
    : null
  const calendar = resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone })
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) {
    // Compatibility applies only while no active Syllabus exists. Once active,
    // the canonical occurrence below is the sole instructional-date authority.
    const normalizedKey = normalizeLessonKey(lessonKey)
    const approved = Object.entries(learner.approved_lessons || {}).some(([key, available]) => available === true && normalizeLessonKey(key) === normalizedKey)
    const legacySchedules = typeof repository.listLessonSchedule === 'function'
      ? await repository.listLessonSchedule(facilitatorId, learnerId, calendar.today)
      : []
    const scheduledToday = legacySchedules.some((row) => normalizeLessonKey(row?.lesson_key) === normalizedKey && String(row?.scheduled_date || '').slice(0, 10) === calendar.today)
    const legacyOccurrenceId = `legacy:${normalizedKey}:${calendar.today}`
    return {
      allowedWithoutPin: approved || scheduledToday,
      requiresPin: !approved && !scheduledToday,
      reason: approved || scheduledToday ? 'legacy_available' : 'legacy_exception',
      occurrence: { occurrence_id: legacyOccurrenceId, lesson_key: normalizedKey, planned_date: calendar.today },
      scope: { facilitatorId, learnerId, lessonKey: normalizedKey, occurrenceId: legacyOccurrenceId, today: calendar.today },
      calendar,
    }
  }
  const revision = await repository.findRevision(syllabus.active_revision_id, syllabus.id)
  if (!revision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  const optionalList = async (name, ...args) => typeof repository[name] === 'function' ? repository[name](...args) : []
  const [forecastItems, associations, schedules, sessions, sessionEvents] = await Promise.all([
    repository.listForecastItems(revision.id),
    optionalList('listLessonAssociations', facilitatorId, learnerId),
    optionalList('listLessonSchedule', facilitatorId, learnerId, revision.effective_from),
    optionalList('listAllTrackedSessions', learnerId),
    optionalList('listAllLessonSessionEvents', learnerId),
  ])
  const timeline = composeSyllabusLessonTimeline({
    activeRevision: revision,
    forecastItems,
    associations,
    approvedLessons: learner.approved_lessons || {},
    schedules,
    sessions,
    sessionEvents,
    today: calendar.today,
    timeZone: calendar.timeZone,
  })
  const concreteKeys = timeline.map((item) => item.lesson_key).filter(Boolean)
  const normalizedKey = resolveLessonKeyAgainst(normalizeLessonKey(lessonKey), concreteKeys)
  const candidates = timeline.filter((item) => item.lesson_key === normalizedKey)
  const occurrence = occurrenceId
    ? candidates.find((item) => clean(item.occurrence_id) === clean(occurrenceId))
    : (candidates.length === 1 ? candidates[0] : null)
  if (!occurrence) {
    throw new SyllabusError('The requested Syllabus occurrence is missing or ambiguous', 403, 'SYLLABUS_OCCURRENCE_REQUIRED')
  }
  const isToday = clean(occurrence.planned_date).slice(0, 10) === calendar.today
  const completedRepeat = occurrence.actual_kind === 'completed'
  return {
    allowedWithoutPin: isToday && !completedRepeat,
    requiresPin: !isToday || completedRepeat,
    reason: completedRepeat ? 'completed_repeat' : (!isToday ? 'non_today' : 'today'),
    occurrence,
    scope: {
      facilitatorId,
      learnerId,
      lessonKey: normalizedKey,
      occurrenceId: occurrence.occurrence_id,
      today: calendar.today,
    },
    calendar,
  }
}

export { PROOF_TTL_SECONDS }
