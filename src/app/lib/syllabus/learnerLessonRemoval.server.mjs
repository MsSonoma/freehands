import { normalizeLessonKey } from '../lessonKeyNormalization.js'
import { applyLessonAvailability } from '../lessonAvailability.mjs'
import { resolveCalendarContext } from '../calendarDate.mjs'
import { activateSyllabus } from './revisions.server.mjs'
import { SyllabusError } from './schema.mjs'

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function throwMutationError(error, message) {
  if (error) throw new SyllabusError(error.message || message, 500, 'LESSON_REMOVAL_FAILED')
}

async function currentBindingInputs({ repository, facilitatorId, learner, lessonKey, now, fallbackTimeZone }) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  if (!canonicalKey) throw new SyllabusError('A valid lesson key is required', 400, 'INVALID_LESSON_KEY')
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function'
    ? await repository.findFacilitatorTimeZone(facilitatorId)
    : null
  const { today } = resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone })
  const [associations, schedules, syllabus] = await Promise.all([
    typeof repository.listLessonAssociations === 'function'
      ? repository.listLessonAssociations(facilitatorId, learner.id)
      : [],
    typeof repository.listLessonSchedule === 'function'
      ? repository.listLessonSchedule(facilitatorId, learner.id, today)
      : [],
    repository.findSyllabus(facilitatorId, learner.id),
  ])
  let revision = null
  let forecastItems = []
  if (syllabus?.active_revision_id) {
    revision = await repository.findRevision(syllabus.active_revision_id, syllabus.id)
    if (!revision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
    forecastItems = await repository.listForecastItems(revision.id)
  }
  return { canonicalKey, today, associations, schedules, syllabus, revision, forecastItems }
}

export async function readCurrentLessonBinding({ repository, facilitatorId, learner, lessonKey, now = new Date(), fallbackTimeZone }) {
  const inputs = await currentBindingInputs({ repository, facilitatorId, learner, lessonKey, now, fallbackTimeZone })
  const approved = Object.entries(learner?.approved_lessons || {})
    .some(([key, value]) => value === true && normalizeLessonKey(key) === inputs.canonicalKey)
  const association = inputs.associations.some((row) => (
    normalizeLessonKey(row?.lesson_key) === inputs.canonicalKey
      && row?.inferred_placement_suppressed !== true
  ))
  const forecast = inputs.forecastItems.some((row) => (
    dateOnly(row?.planned_date) >= inputs.today && normalizeLessonKey(row?.lesson_key) === inputs.canonicalKey
  ))
  const schedule = inputs.schedules.some((row) => (
    dateOnly(row?.scheduled_date) >= inputs.today && normalizeLessonKey(row?.lesson_key) === inputs.canonicalKey
  ))
  return {
    lessonKey: inputs.canonicalKey,
    currentlyBound: approved || association || forecast || schedule,
    sources: { approved, association, forecast, schedule },
  }
}

export async function removeLessonFromLearner({
  admin,
  repository,
  facilitatorId,
  learner,
  lessonKey,
  now = new Date(),
  fallbackTimeZone,
}) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  if (!canonicalKey) throw new SyllabusError('A valid lesson key is required', 400, 'INVALID_LESSON_KEY')

  const availability = applyLessonAvailability(learner?.approved_lessons, canonicalKey, false)
  if (!availability.ok) throw new SyllabusError(availability.error, 400, 'INVALID_LESSON_KEY')

  const inputs = await currentBindingInputs({ repository, facilitatorId, learner, lessonKey: canonicalKey, now, fallbackTimeZone })
  const { today } = inputs
  const readBinding = async () => {
    const freshLearner = typeof repository.findOwnedLearner === 'function'
      ? (await repository.findOwnedLearner(learner.id, facilitatorId)) || learner
      : learner
    return readCurrentLessonBinding({ repository, facilitatorId, learner: freshLearner, lessonKey: canonicalKey, now, fallbackTimeZone })
  }
  const runConvergentMutation = async ({ source, message, mutate }) => {
    try {
      const result = await mutate()
      if (result?.error) throw result.error
    } catch (error) {
      // A transport/database error can arrive after the mutation committed. Read
      // current authority before telling the facilitator that a completed removal failed.
      const binding = await readBinding()
      if (binding.sources?.[source] === false) return
      throw new SyllabusError(error?.message || message, 500, 'LESSON_REMOVAL_FAILED')
    }
  }

  const associationIds = inputs.associations
    .filter((row) => normalizeLessonKey(row?.lesson_key) === canonicalKey)
    .map((row) => row?.id)
    .filter(Boolean)
  if (associationIds.length > 0) {
    await runConvergentMutation({
      source: 'association',
      message: 'Could not remove current learner lesson association authority',
      mutate: () => admin.from('syllabus_lesson_associations')
        .update({ inferred_placement_suppressed: true, updated_at: new Date().toISOString() })
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learner.id)
        .in('id', associationIds),
    })
  }

  // Active revisions are immutable. Remove only present/future lesson intent from
  // a replacement revision. Historical revisions and the preserved association
  // remain available as evidence; suppression prevents them from creating new intent.
  let removedForecastOccurrences = 0
  if (inputs.revision) {
    const retainedFutureItems = inputs.forecastItems.filter((item) => {
      if (dateOnly(item?.planned_date) < today) return false
      const removesItem = normalizeLessonKey(item?.lesson_key) === canonicalKey
      if (removesItem) removedForecastOccurrences += 1
      return !removesItem
    })

    if (removedForecastOccurrences > 0) {
      const activationRepository = Object.create(repository)
      activationRepository.listLessonAssociations = async () => inputs.associations
        .filter((row) => normalizeLessonKey(row?.lesson_key) !== canonicalKey)
      activationRepository.listLessonSchedule = async () => inputs.schedules
        .filter((row) => normalizeLessonKey(row?.lesson_key) !== canonicalKey)
      await runConvergentMutation({
        source: 'forecast',
        message: 'Could not remove current learner Syllabus intent',
        mutate: () => activateSyllabus({
          repository: activationRepository,
          facilitatorId,
          learnerId: learner.id,
          expectedActiveRevisionId: inputs.revision.id,
          now,
          today,
          snapshot: {
            effective_from: today,
            goals: inputs.revision.goals,
            subjects: inputs.revision.subjects,
            weekly_pattern: inputs.revision.weekly_pattern,
            teaching_guidance: inputs.revision.teaching_guidance,
            planning_policy: inputs.revision.planning_policy,
            legacy_provenance: inputs.revision.legacy_provenance,
            forecast_items: retainedFutureItems,
            change_reason: `Removed ${canonicalKey} from learner current/future intent`,
          },
        }),
      })
    }
  }

  await runConvergentMutation({
    source: 'approved',
    message: 'Could not remove lesson availability',
    mutate: () => admin.from('learners')
      .update({ approved_lessons: availability.approvedLessons })
      .eq('id', learner.id),
  })

  // Schedules are the most immediately visible current/future authority, so delete
  // them last. No later historical cleanup is allowed to turn a successful visible
  // removal into a false failure.
  const scheduleIds = inputs.schedules
    .filter((row) => dateOnly(row?.scheduled_date) >= today && normalizeLessonKey(row?.lesson_key) === canonicalKey)
    .map((row) => row?.id)
    .filter(Boolean)
  if (scheduleIds.length > 0) {
    await runConvergentMutation({
      source: 'schedule',
      message: 'Could not remove current learner lesson schedules',
      mutate: () => admin.from('lesson_schedule').delete()
        .eq('learner_id', learner.id)
        .in('id', scheduleIds),
    })
  }

  const finalBinding = await readBinding()
  if (finalBinding.currentlyBound) {
    const remaining = Object.entries(finalBinding.sources || {}).filter(([, active]) => active).map(([source]) => source)
    throw new SyllabusError(
      `The lesson still has current/future learner authority${remaining.length ? `: ${remaining.join(', ')}` : ''}`,
      409,
      'LESSON_REMOVAL_INCOMPLETE',
    )
  }

  return {
    lessonKey: canonicalKey,
    approvedLessons: availability.approvedLessons,
    removedForecastOccurrences,
    removedScheduleOccurrences: scheduleIds.length,
    preservedHistoricalAssociation: associationIds.length > 0,
  }
}
