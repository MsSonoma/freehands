import { resolveCalendarContext } from '../calendarDate.mjs'
import { loadRecentMasteryReports } from './masteryReports.server.mjs'
import { composeSyllabusLessonTimeline } from './lessonTimeline.mjs'
import { loadSyllabusTimelineInputs } from './lessonTimelineInputs.server.mjs'
import { buildInstructionalForecastPlan, buildLearningForecastSnapshot } from './learningForecast.mjs'
import { SyllabusError, validateSnapshot } from './schema.mjs'

function conflict() {
  return new SyllabusError('The active Syllabus changed while the instructional forecast was being prepared.', 409, 'LEARNING_FORECAST_CONFLICT')
}

export async function createLearningForecastProposal({
  repository,
  admin,
  facilitatorId,
  learnerId,
  expectedActiveRevisionId,
  reports,
  loadReports = loadRecentMasteryReports,
  generateItems,
  resolveLesson,
  now = new Date(),
  fallbackTimeZone,
}) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) throw new SyllabusError('An active Syllabus is required before forecasting', 409, 'ACTIVE_SYLLABUS_REQUIRED')
  if (!expectedActiveRevisionId || syllabus.active_revision_id !== expectedActiveRevisionId) throw conflict()
  const activeRevision = await repository.findRevision(syllabus.active_revision_id, syllabus.id)
  if (!activeRevision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function' ? await repository.findFacilitatorTimeZone(facilitatorId) : null
  const calendar = resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone })
  const inputs = await loadSyllabusTimelineInputs({ repository, admin, facilitatorId, learner, activeRevision, includeSlateEvidence: false })
  const timelineItems = composeSyllabusLessonTimeline({
    activeRevision,
    ...inputs,
    approvedLessons: learner.approved_lessons || {},
    today: calendar.today,
    timeZone: calendar.timeZone,
  })
  const authorizedReports = reports || await loadReports({ repository, facilitatorId, learnerId, resolveLesson })
  const plan = buildInstructionalForecastPlan({
    activeRevision,
    forecastItems: inputs.forecastItems,
    timelineItems,
    reports: authorizedReports,
    today: calendar.today,
  })
  const existing = await repository.findLatestLearningForecastProposal(syllabus.id, activeRevision.id)
  if (existing?.proposal_key === plan.proposal_key && String(existing.effective_from).slice(0, 10) === calendar.today) {
    return {
      kind: 'proposal', reused: true, active_revision_id: activeRevision.id,
      proposal_revision: existing, forecast_items: await repository.listForecastItems(existing.id),
      target_week_start: plan.target_week_start, additions: plan.unfilled_slots.length,
    }
  }
  if (!plan.unfilled_slots.length) {
    return { kind: 'no_action', active_revision_id: activeRevision.id, message: 'The next instructional week already has intent for every Syllabus slot.' }
  }
  if (typeof generateItems !== 'function') throw new SyllabusError('Instructional forecasting is unavailable', 503, 'FORECAST_MODEL_UNAVAILABLE')
  let generatedItems
  try {
    generatedItems = await generateItems({
      slots: plan.unfilled_slots,
      context: {
        syllabus: {
          goals: activeRevision.goals,
          subjects: activeRevision.subjects,
          teaching_guidance: activeRevision.teaching_guidance,
          planning_policy: activeRevision.planning_policy,
        },
        evidence_summaries: plan.evidence_context,
      },
    })
  } catch {
    throw new SyllabusError('The instructional forecast could not be generated. The active Syllabus was not changed.', 502, 'FORECAST_GENERATION_FAILED')
  }
  let built
  let planning
  try {
    built = buildLearningForecastSnapshot({ activeRevision, forecastItems: inputs.forecastItems, plan, generatedItems, today: calendar.today })
    planning = validateSnapshot(built.snapshot, { today: calendar.today })
  } catch {
    throw new SyllabusError('The instructional forecast could not be generated. The active Syllabus was not changed.', 502, 'FORECAST_GENERATION_FAILED')
  }
  let result
  try {
    result = await repository.replaceLearningForecastProposal({
      syllabusId: syllabus.id,
      expectedActiveRevisionId: activeRevision.id,
      planning,
      proposalKey: plan.proposal_key,
    })
    const current = await repository.findSyllabus(facilitatorId, learnerId)
    if (current?.active_revision_id !== activeRevision.id) throw conflict()
  } catch (error) {
    if (error.code === '40001') throw conflict()
    throw error
  }
  if (!result?.revision?.id) throw new SyllabusError('Instructional forecast persistence returned no revision', 500, 'PROPOSAL_WRITE_FAILED')
  return {
    kind: 'proposal', reused: result.reused === true, active_revision_id: activeRevision.id,
    proposal_revision: result.revision, forecast_items: await repository.listForecastItems(result.revision.id),
    target_week_start: plan.target_week_start, additions: built.additions.length,
  }
}
