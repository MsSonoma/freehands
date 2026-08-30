import { normalizeLessonKey } from '../lessonKeyNormalization.js'
import { getActiveSyllabus } from './revisions.server.mjs'
import { SyllabusError } from './schema.mjs'

function clean(value) { return String(value || '').trim() }

async function loadSyllabusOccurrenceContext({
  repository,
  admin,
  facilitatorId,
  learnerId,
  lessonKey,
  occurrenceId,
  fallbackTimeZone,
  now,
}) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  const canonicalOccurrence = clean(occurrenceId)
  if (!canonicalKey || !canonicalOccurrence) {
    throw new SyllabusError('An exact Syllabus lesson occurrence is required', 400, 'INVALID_SYLLABUS_OCCURRENCE')
  }
  const syllabus = await getActiveSyllabus({
    repository,
    admin,
    facilitatorId,
    learnerId,
    fallbackTimeZone,
    now,
  })
  return { syllabus, canonicalKey, canonicalOccurrence }
}

export async function requireAssignableSyllabusOccurrence({
  repository,
  admin,
  facilitatorId,
  learnerId,
  lessonKey,
  occurrenceId,
  fallbackTimeZone,
  now = new Date(),
}) {
  const { syllabus, canonicalKey, canonicalOccurrence } = await loadSyllabusOccurrenceContext({
    repository,
    admin,
    facilitatorId,
    learnerId,
    lessonKey,
    occurrenceId,
    fallbackTimeZone,
    now,
  })
  const matches = (syllabus.timeline_items || []).filter((item) => (
    clean(item?.occurrence_id) === canonicalOccurrence
      && normalizeLessonKey(item?.lesson_key) === canonicalKey
      && (item?.item_type || 'lesson') === 'lesson'
      && item?.placement_kind !== 'actual'
  ))
  if (matches.length !== 1) {
    throw new SyllabusError('This lesson occurrence is not assignable in the active Syllabus', 403, 'LESSON_NOT_IN_ACTIVE_SYLLABUS')
  }
  const alreadyStarted = (syllabus.timeline_items || []).some((item) => (
    item?.placement_kind === 'actual'
      && item?.historical_record !== true
      && clean(item?.source_occurrence_id) === canonicalOccurrence
  ))
  if (alreadyStarted) {
    throw new SyllabusError('The instructional teacher cannot change after this occurrence has started', 409, 'SYLLABUS_OCCURRENCE_ALREADY_STARTED')
  }
  return { syllabus, item: matches[0], lessonKey: canonicalKey, occurrenceId: canonicalOccurrence }
}


export async function requireHistoricalSyllabusOccurrence({
  repository,
  admin,
  facilitatorId,
  learnerId,
  lessonKey,
  occurrenceId,
  activityType,
  fallbackTimeZone,
  now = new Date(),
}) {
  const { syllabus, canonicalKey, canonicalOccurrence } = await loadSyllabusOccurrenceContext({
    repository,
    admin,
    facilitatorId,
    learnerId,
    lessonKey,
    occurrenceId,
    fallbackTimeZone,
    now,
  })
  const timeline = syllabus.timeline_items || []
  const nonActualMatches = timeline.filter((item) => (
    item?.placement_kind !== 'actual'
      && item?.historical_record !== true
      && clean(item?.occurrence_id) === canonicalOccurrence
      && (item?.item_type || 'lesson') === 'lesson'
  ))
  const canonicalActualMatches = timeline.filter((item) => (
    item?.placement_kind === 'actual'
      && item?.historical_record !== true
      && clean(item?.source_occurrence_id) === canonicalOccurrence
      && (item?.item_type || 'lesson') === 'lesson'
  ))
  const representations = [...nonActualMatches, ...canonicalActualMatches]
  if (representations.length === 0 || representations.some((item) => normalizeLessonKey(item?.lesson_key) !== canonicalKey)) {
    throw new SyllabusError('This historical activity is not bound to the requested active-Syllabus lesson occurrence', 403, 'LESSON_NOT_IN_ACTIVE_SYLLABUS')
  }
  if (activityType === 'instructional_completion') {
    if (canonicalActualMatches.length > 0) {
      throw new SyllabusError('Canonical learner activity already exists for this occurrence', 409, 'SYLLABUS_OCCURRENCE_ALREADY_STARTED')
    }
    if (nonActualMatches.length !== 1) {
      throw new SyllabusError('Historical instruction requires one eligible non-actual Syllabus occurrence', 403, 'LESSON_NOT_IN_ACTIVE_SYLLABUS')
    }
    return { syllabus, item: nonActualMatches[0], lessonKey: canonicalKey, occurrenceId: canonicalOccurrence }
  }
  if (activityType !== 'slate_drill_completion' || nonActualMatches.length > 1 || canonicalActualMatches.length > 1) {
    throw new SyllabusError('The historical Slate occurrence is missing or ambiguous', 403, 'AMBIGUOUS_HISTORICAL_SYLLABUS_OCCURRENCE')
  }
  const item = canonicalActualMatches[0] || nonActualMatches[0]
  return { syllabus, item, lessonKey: canonicalKey, occurrenceId: canonicalOccurrence }
}
