import { lessonKeyBasename, normalizeLessonKey } from '../lessonKeyNormalization.js'
import { getActiveSyllabus } from './revisions.server.mjs'
import { SyllabusError } from './schema.mjs'
import { removeLessonTranscriptEvidence } from './transcriptEvidenceRemoval.server.mjs'

const clean = (value) => String(value || '').trim()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_MODES = new Set(['keep', 'delete'])

function exactTarget(timeline, lessonKey, occurrenceId) {
  const matches = (timeline || []).filter((item) => (
    item?.item_type === 'lesson'
      && normalizeLessonKey(item?.lesson_key) === lessonKey
      && clean(item?.occurrence_id) === occurrenceId
  ))
  if (matches.length !== 1) {
    throw new SyllabusError(
      matches.length ? 'This Syllabus occurrence is ambiguous.' : 'The lesson occurrence is no longer available. Reload the Syllabus.',
      matches.length ? 409 : 404,
      matches.length ? 'AMBIGUOUS_SYLLABUS_OCCURRENCE' : 'LESSON_NOT_IN_ACTIVE_SYLLABUS',
    )
  }
  return matches[0]
}

function linkedActualSessionIds({ timeline, target, lessonKey, occurrenceId, trackedSessions }) {
  const actualRows = target.placement_kind === 'actual'
    ? [target]
    : (timeline || []).filter((item) => (
      item?.placement_kind === 'actual'
        && item?.item_type === 'lesson'
        && normalizeLessonKey(item?.lesson_key) === lessonKey
        && clean(item?.source_occurrence_id) === occurrenceId
    ))
  const tracked = new Map((trackedSessions || []).map((row) => [clean(row?.id), row]))
  const selected = []
  for (const row of actualRows) {
    const id = clean(row?.occurrence_id).replace(/^actual:/, '')
    if (!UUID.test(id)) {
      throw new SyllabusError('The linked session identity is not valid.', 409, 'INVALID_LESSON_SESSION')
    }
    const trackedRow = tracked.get(id)
    if (!trackedRow || (normalizeLessonKey(trackedRow.lesson_id) !== lessonKey
      && lessonKeyBasename(trackedRow.lesson_id) !== lessonKeyBasename(lessonKey))) {
      throw new SyllabusError('The linked session could not be verified. No records were removed.', 409, 'LESSON_SESSION_NOT_FOUND')
    }
    selected.push({ ...trackedRow, id })
  }
  return [...new Map(selected.map((row) => [row.id, row])).values()]
}

function findForecastLineage(target, forecastRows, sourceOccurrenceId) {
  const sourceId = sourceOccurrenceId.startsWith('syllabus:') ? sourceOccurrenceId.slice(9) : ''
  const reconciledId = clean(target?.reconciled_forecast_id)
  const matches = (forecastRows || []).filter((row) => (
    (sourceId && (clean(row?.id) === sourceId || clean(row?.lineage_id) === sourceId))
    || (reconciledId && (clean(row?.id) === reconciledId || clean(row?.lineage_id) === reconciledId))
  ))
  return clean(target?.lineage_id || target?.forecast_lineage_id || (matches.length === 1 ? matches[0]?.lineage_id : '')) || null
}

// This action intentionally does not delete lesson content, other occurrences,
// sibling attempts, or review evidence belonging to other sessions.
export async function removeLessonWithFacilitatorOverride({
  admin,
  repository,
  facilitatorId,
  learnerId,
  lessonKey,
  occurrenceId,
  evidenceDisposition,
  expectedActiveRevisionId = null,
  now = new Date(),
  fallbackTimeZone,
  dependencies = {},
}) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  const requestedId = clean(occurrenceId)
  if (!canonicalKey?.includes('/') || !requestedId || !ALLOWED_MODES.has(evidenceDisposition)) {
    throw new SyllabusError('A lesson occurrence and evidence choice are required.', 400, 'INVALID_LESSON_REMOVAL')
  }
  const loadActive = dependencies.getActiveSyllabus || getActiveSyllabus
  const syllabus = await loadActive({ repository, admin, facilitatorId, learnerId, now, fallbackTimeZone })
  const activeRevisionId = clean(syllabus?.active_revision?.id)
  if (!activeRevisionId || (expectedActiveRevisionId && clean(expectedActiveRevisionId) !== activeRevisionId)) {
    throw new SyllabusError('The active Syllabus changed. Reload before removing this lesson.', 409, 'ACTIVATION_CONFLICT')
  }
  const timeline = syllabus?.timeline_items || []
  const target = exactTarget(timeline, canonicalKey, requestedId)
  const sourceOccurrenceId = clean(target?.source_occurrence_id) || requestedId
  const trackedSessions = typeof repository.listAllTrackedSessions === 'function'
    ? await repository.listAllTrackedSessions(learnerId)
    : []
  const linkedSessions = linkedActualSessionIds({
    timeline, target, lessonKey: canonicalKey, occurrenceId: requestedId, trackedSessions,
  })
  const ids = linkedSessions.map((row) => row.id)
  const lineage = findForecastLineage(target, syllabus.forecast_items || [], sourceOccurrenceId)
  const record = dependencies.recordRemoval || (async (params) => {
    const { data, error } = await admin.rpc('record_facilitator_lesson_removal', params)
    if (error) throw error
    return data
  })
  let recorded
  try {
    recorded = await record({
      p_facilitator_id: facilitatorId,
      p_learner_id: learnerId,
      p_lesson_key: canonicalKey,
      p_occurrence_id: requestedId,
      p_source_occurrence_id: sourceOccurrenceId,
      p_forecast_lineage_id: lineage,
      p_evidence_disposition: evidenceDisposition,
      p_execution_session_ids: ids,
    })
  } catch (error) {
    throw new SyllabusError(error?.message || 'Could not remove the lesson occurrence.', 500, 'LESSON_OVERRIDE_REMOVAL_FAILED')
  }
  if (recorded?.removed !== true) {
    throw new SyllabusError('Removal could not be verified.', 500, 'LESSON_OVERRIDE_REMOVAL_FAILED')
  }
  let transcriptCleanup = null
  if (evidenceDisposition === 'delete') {
    try {
      const learner = typeof repository.findOwnedLearner === 'function'
        ? await repository.findOwnedLearner(learnerId, facilitatorId)
        : null
      const cleanup = dependencies.removeTranscriptEvidence || removeLessonTranscriptEvidence
      transcriptCleanup = await cleanup({
        admin, facilitatorId, learnerId, lessonKey: canonicalKey,
        lessonTitle: target.title || 'Lesson',
        learnerName: learner?.name || learner?.display_name || 'Learner',
        selectedSessions: linkedSessions, allSessions: trackedSessions,
      })
    } catch {
      transcriptCleanup = { status: 'incomplete', unresolvedSessions: ids.length }
    }
  }
  return {
    removed: true,
    lessonKey: canonicalKey,
    occurrenceId: requestedId,
    sourceOccurrenceId,
    evidenceDisposition,
    linkedSessionCount: ids.length,
    transcriptCleanup,
    activeRevisionId,
  }
}
