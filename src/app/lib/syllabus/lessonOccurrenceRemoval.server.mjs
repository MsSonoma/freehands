import { normalizeLessonKey } from '../lessonKeyNormalization.js'
import { setLessonAssociationInferenceSuppressed } from './lessonAssociations.server.mjs'
import { activateSyllabus, getActiveSyllabus } from './revisions.server.mjs'
import { SyllabusError } from './schema.mjs'

function clean(value) {
  return String(value || '').trim()
}

function dateOnly(value) {
  return clean(value).slice(0, 10)
}

function canonicalItemKey(item) {
  return normalizeLessonKey(item?.lesson_key)
}

function isLessonItem(item) {
  return item?.item_type === 'lesson'
}

function isOrdinaryExplicit(item) {
  return item?.placement_kind === 'syllabus' || item?.placement_kind === 'scheduled'
}

function requireCurrentOccurrence({ timelineItems, lessonKey, occurrenceId }) {
  const sameKey = (item) => canonicalItemKey(item) === lessonKey
  const started = timelineItems.some((item) => (
    item?.placement_kind === 'actual'
      && item?.historical_record !== true
      && sameKey(item)
      && clean(item?.source_occurrence_id) === occurrenceId
  ))
  if (started) {
    throw new SyllabusError(
      'This Syllabus occurrence has already started and cannot be removed',
      409,
      'SYLLABUS_OCCURRENCE_ALREADY_STARTED',
    )
  }

  const identityMatches = timelineItems.filter((item) => (
    clean(item?.occurrence_id) === occurrenceId && sameKey(item)
  ))
  if (identityMatches.some((item) => item?.placement_kind === 'actual')) {
    throw new SyllabusError('Actual Syllabus occurrences cannot be removed', 409, 'SYLLABUS_OCCURRENCE_NOT_REMOVABLE')
  }
  if (identityMatches.some((item) => item?.placement_kind === 'historical' || item?.historical_record === true)) {
    throw new SyllabusError('Historical Syllabus occurrences cannot be removed', 409, 'SYLLABUS_OCCURRENCE_NOT_REMOVABLE')
  }
  if (identityMatches.some((item) => item?.item_type === 'slate_assignment' || item?.placement_kind === 'slate_assignment')) {
    throw new SyllabusError('Mr. Slate occurrences cannot be removed by this operation', 409, 'SYLLABUS_OCCURRENCE_NOT_REMOVABLE')
  }

  const matches = identityMatches.filter((item) => (
    isLessonItem(item)
      && item?.historical_record !== true
      && item?.placement_kind !== 'actual'
      && item?.placement_kind !== 'historical'
  ))
  if (matches.length === 0) {
    throw new SyllabusError(
      'This exact lesson occurrence is not in the active Syllabus',
      404,
      'LESSON_NOT_IN_ACTIVE_SYLLABUS',
    )
  }
  if (matches.length > 1) {
    throw new SyllabusError(
      'This Syllabus occurrence is ambiguous and cannot be removed safely',
      409,
      'AMBIGUOUS_SYLLABUS_OCCURRENCE',
    )
  }
  return matches[0]
}

function requireExpectedActiveRevision(activeRevision, expectedActiveRevisionId) {
  const expected = clean(expectedActiveRevisionId)
  if (!expected || !activeRevision?.id || clean(activeRevision.id) !== expected) {
    throw new SyllabusError(
      'The active Syllabus changed. Reload before removing this occurrence.',
      409,
      'ACTIVATION_CONFLICT',
    )
  }
  return expected
}

function exactForecastByVisibleOccurrence({ forecastItems, item, lessonKey, occurrenceId }) {
  if (!occurrenceId.startsWith('syllabus:')) {
    throw new SyllabusError('The Syllabus occurrence identity is invalid', 400, 'INVALID_SYLLABUS_OCCURRENCE')
  }
  const identity = clean(occurrenceId.slice('syllabus:'.length))
  if (!identity) {
    throw new SyllabusError('The Syllabus occurrence identity is invalid', 400, 'INVALID_SYLLABUS_OCCURRENCE')
  }

  const sameKeyRows = forecastItems.filter((row) => normalizeLessonKey(row?.lesson_key) === lessonKey)
  const idMatches = sameKeyRows.filter((row) => clean(row?.id) === identity)
  if (idMatches.length === 1) return idMatches[0]
  if (idMatches.length > 1) {
    throw new SyllabusError('The forecast occurrence identity is ambiguous', 409, 'AMBIGUOUS_SYLLABUS_OCCURRENCE')
  }

  const visibleDerivedFromLineage = !clean(item?.id)
    && clean(item?.lineage_id) === identity
    && clean(item?.occurrence_id) === occurrenceId
  if (!visibleDerivedFromLineage) {
    throw new SyllabusError('The exact forecast occurrence could not be found', 404, 'FORECAST_OCCURRENCE_NOT_FOUND')
  }
  const lineageMatches = sameKeyRows.filter((row) => clean(row?.lineage_id) === identity)
  if (lineageMatches.length === 1) return lineageMatches[0]
  if (lineageMatches.length > 1) {
    throw new SyllabusError('The forecast lineage is ambiguous', 409, 'AMBIGUOUS_SYLLABUS_OCCURRENCE')
  }
  throw new SyllabusError('The exact forecast occurrence could not be found', 404, 'FORECAST_OCCURRENCE_NOT_FOUND')
}

function exactReconciledForecast({ forecastItems, lessonKey, reconciledForecastId }) {
  const identity = clean(reconciledForecastId)
  const sameKeyRows = forecastItems.filter((row) => normalizeLessonKey(row?.lesson_key) === lessonKey)
  const idMatches = sameKeyRows.filter((row) => clean(row?.id) === identity)
  if (idMatches.length === 1) return idMatches[0]
  if (idMatches.length > 1) {
    throw new SyllabusError('The reconciled forecast identity is ambiguous', 409, 'AMBIGUOUS_SYLLABUS_OCCURRENCE')
  }
  const lineageMatches = sameKeyRows.filter((row) => clean(row?.lineage_id) === identity)
  if (lineageMatches.length === 1) return lineageMatches[0]
  if (lineageMatches.length > 1) {
    throw new SyllabusError('The reconciled forecast lineage is ambiguous', 409, 'AMBIGUOUS_SYLLABUS_OCCURRENCE')
  }
  throw new SyllabusError('The reconciled forecast occurrence could not be found', 409, 'FORECAST_OCCURRENCE_NOT_FOUND')
}

function replacementForecastItems({ forecastItems, removedForecast, today }) {
  return forecastItems.filter((row) => row !== removedForecast && dateOnly(row?.planned_date) >= today)
}

function replacementSnapshot({ activeRevision, forecastItems, lessonKey, occurrenceId, today }) {
  return {
    effective_from: today,
    goals: activeRevision.goals,
    subjects: activeRevision.subjects,
    weekly_pattern: activeRevision.weekly_pattern,
    teaching_guidance: activeRevision.teaching_guidance,
    planning_policy: activeRevision.planning_policy,
    legacy_provenance: activeRevision.legacy_provenance,
    forecast_items: forecastItems,
    change_reason: `Removed ${lessonKey} occurrence ${occurrenceId} from the Syllabus`,
  }
}

async function deleteExactScheduleOccurrence({ admin, learnerId, lessonKey, scheduleId }) {
  const { data, error } = await admin.from('lesson_schedule').delete()
    .eq('id', scheduleId)
    .eq('learner_id', learnerId)
    .eq('lesson_key', lessonKey)
    .select('id')
    .maybeSingle()
  if (error) {
    throw new SyllabusError(error.message || 'Could not remove the lesson schedule occurrence', 500, 'LESSON_OCCURRENCE_REMOVAL_FAILED')
  }
  if (!data) {
    throw new SyllabusError('The exact schedule occurrence could not be found', 404, 'SCHEDULE_OCCURRENCE_NOT_FOUND')
  }
  return data
}

export async function removeLessonOccurrenceFromSyllabus({
  admin,
  repository,
  facilitatorId,
  learnerId,
  lessonKey,
  occurrenceId,
  expectedActiveRevisionId = null,
  now = new Date(),
  fallbackTimeZone,
  dependencies = {},
}) {
  try {
    const canonicalKey = normalizeLessonKey(lessonKey)
    const canonicalOccurrence = clean(occurrenceId)
    if (!canonicalKey || !canonicalKey.includes('/') || !canonicalOccurrence) {
      throw new SyllabusError('An exact Syllabus lesson occurrence is required', 400, 'INVALID_SYLLABUS_OCCURRENCE')
    }

    const loadActiveSyllabus = dependencies.getActiveSyllabus || getActiveSyllabus
    const activate = dependencies.activateSyllabus || activateSyllabus
    const setInferenceSuppressed = dependencies.setLessonAssociationInferenceSuppressed
      || setLessonAssociationInferenceSuppressed
    const deleteSchedule = dependencies.deleteExactScheduleOccurrence || deleteExactScheduleOccurrence
    const syllabus = await loadActiveSyllabus({
      repository,
      admin,
      facilitatorId,
      learnerId,
      now,
      fallbackTimeZone,
    })
    const timelineItems = Array.isArray(syllabus?.timeline_items) ? syllabus.timeline_items : []
    const forecastItems = Array.isArray(syllabus?.forecast_items) ? syllabus.forecast_items : []
    const activeRevision = syllabus?.active_revision || null
    const target = requireCurrentOccurrence({
      timelineItems,
      lessonKey: canonicalKey,
      occurrenceId: canonicalOccurrence,
    })
    const placementKind = clean(target.placement_kind)

    const suppressInference = async () => setInferenceSuppressed({
      admin,
      facilitatorId,
      learnerId,
      lessonKey: canonicalKey,
      suppressed: true,
      verifyLearner: false,
    })

    if (placementKind === 'inferred' || placementKind === 'needs_placement') {
      await suppressInference()
      return {
        lessonKey: canonicalKey,
        occurrenceId: canonicalOccurrence,
        placementKind,
        removedForecastOccurrence: false,
        removedScheduleOccurrence: false,
        inferenceSuppressed: true,
        activeRevisionId: activeRevision?.id || null,
      }
    }

    if (!isOrdinaryExplicit(target)) {
      throw new SyllabusError('This Syllabus occurrence cannot be removed', 409, 'SYLLABUS_OCCURRENCE_NOT_REMOVABLE')
    }
    const finalExplicit = !timelineItems.some((item) => (
      isLessonItem(item)
        && isOrdinaryExplicit(item)
        && canonicalItemKey(item) === canonicalKey
        && clean(item?.occurrence_id) !== canonicalOccurrence
    ))
    const today = dateOnly(syllabus?.resolved_today)
    if (!today) {
      throw new SyllabusError('The current Syllabus date could not be resolved', 500, 'LESSON_OCCURRENCE_REMOVAL_FAILED')
    }

    if (placementKind === 'syllabus') {
      const expectedRevision = requireExpectedActiveRevision(activeRevision, expectedActiveRevisionId)
      const forecast = exactForecastByVisibleOccurrence({
        forecastItems,
        item: target,
        lessonKey: canonicalKey,
        occurrenceId: canonicalOccurrence,
      })
      const snapshot = replacementSnapshot({
        activeRevision,
        forecastItems: replacementForecastItems({ forecastItems, removedForecast: forecast, today }),
        lessonKey: canonicalKey,
        occurrenceId: canonicalOccurrence,
        today,
      })
      if (finalExplicit) await suppressInference()
      const activation = await activate({
        repository,
        facilitatorId,
        learnerId,
        expectedActiveRevisionId: expectedRevision,
        now,
        today,
        snapshot,
      })
      return {
        lessonKey: canonicalKey,
        occurrenceId: canonicalOccurrence,
        placementKind,
        removedForecastOccurrence: true,
        removedScheduleOccurrence: false,
        inferenceSuppressed: finalExplicit,
        activeRevisionId: activation?.active_revision?.id || activation?.syllabus?.active_revision_id || null,
      }
    }

    if (!canonicalOccurrence.startsWith('scheduled:')) {
      throw new SyllabusError('The schedule occurrence identity is invalid', 400, 'INVALID_SYLLABUS_OCCURRENCE')
    }
    const scheduleId = clean(canonicalOccurrence.slice('scheduled:'.length))
    if (!scheduleId || clean(target?.id) !== scheduleId) {
      throw new SyllabusError('The exact schedule occurrence could not be found', 404, 'SCHEDULE_OCCURRENCE_NOT_FOUND')
    }

    let activeRevisionId = activeRevision?.id || null
    let removedForecastOccurrence = false
    const reconciledForecastId = clean(target?.reconciled_forecast_id)
    if (reconciledForecastId) {
      const expectedRevision = requireExpectedActiveRevision(activeRevision, expectedActiveRevisionId)
      const forecast = exactReconciledForecast({
        forecastItems,
        lessonKey: canonicalKey,
        reconciledForecastId,
      })
      const snapshot = replacementSnapshot({
        activeRevision,
        forecastItems: replacementForecastItems({ forecastItems, removedForecast: forecast, today }),
        lessonKey: canonicalKey,
        occurrenceId: canonicalOccurrence,
        today,
      })
      if (finalExplicit) await suppressInference()
      const activation = await activate({
        repository,
        facilitatorId,
        learnerId,
        expectedActiveRevisionId: expectedRevision,
        now,
        today,
        snapshot,
      })
      activeRevisionId = activation?.active_revision?.id || activation?.syllabus?.active_revision_id || null
      removedForecastOccurrence = true
    } else if (finalExplicit) {
      await suppressInference()
    }

    await deleteSchedule({ admin, learnerId, lessonKey: canonicalKey, scheduleId })
    return {
      lessonKey: canonicalKey,
      occurrenceId: canonicalOccurrence,
      placementKind,
      removedForecastOccurrence,
      removedScheduleOccurrence: true,
      inferenceSuppressed: finalExplicit,
      activeRevisionId,
    }
  } catch (error) {
    if (error instanceof SyllabusError) throw error
    throw new SyllabusError(error?.message || 'Could not remove the Syllabus occurrence', 500, 'LESSON_OCCURRENCE_REMOVAL_FAILED')
  }
}
