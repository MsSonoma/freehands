import { createHash } from 'node:crypto'
import { addSyllabusDays, startOfSyllabusWeek } from './timeline.mjs'
import { subjectBalancedInstructionalEvidenceContext } from './evidenceProjection.mjs'
import { buildSubjectBreadthContext, forecastPlanningMetadata } from './learningBreadth.mjs'
import { noSchoolDateSet } from './noSchoolDates.mjs'
import { instructionalForecastWindow } from './forecastWindow.mjs'

export { instructionalEvidenceContext } from './evidenceProjection.mjs'
export { buildSubjectBreadthContext } from './learningBreadth.mjs'

const DAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

function clean(value) { return String(value || '').trim() }
function subjectKey(value) { return clean(value).toLocaleLowerCase() }
function eventTime(item) {
  const value = Date.parse(item?.actual_at || item?.planned_date || '')
  return Number.isFinite(value) ? value : 0
}
function duplicatesSlateAuthority(value) {
  return /\b(daily follow[- ]?up|weekly review|retention check|recovery session|mastery check)\b/i.test(String(value || ''))
}
function stableUuid(value) {
  const hex = createHash('sha256').update(String(value)).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4]
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

function curriculumSelectionMetadata(plan, slot, generated) {
  const guidance = plan?.curriculum_guidance
  if (!guidance?.subjects) return null
  const subject = guidance.subjects[subjectKey(slot?.subject)]
  if (!subject) return null

  const requirementKey = clean(generated?.requirement_key)
  if (!requirementKey) {
    if (!(subject.eligible_requirement_keys || []).length && Number(subject.required_remaining || 0) === 0) return null
    throw new Error('Forecast model omitted the server-authorized curriculum requirement')
  }

  const candidate = (subject.candidates || []).find((item) => item.requirement_key === requirementKey && item.eligible === true)
  if (!candidate) throw new Error('Forecast model selected a curriculum requirement outside the server-authorized candidate set')

  const alternatives = (subject.candidates || [])
    .filter((item) => item.eligible === true && item.requirement_key !== requirementKey)
    .slice(0, 3)
    .map((item) => ({
      requirement_key: item.requirement_key,
      statement: item.statement,
      reasons: item.reasons,
    }))

  const exposureNumber = Number(generated?.exposure_number || 0)
    || Math.min(3, Number(candidate?.state?.consecutive_exposures || 0) + 1)
  const nextPolicy = candidate?.state?.mastery === 'unresolved'
    ? (exposureNumber >= 3
        ? 'Branch after this lesson even if mastery remains unresolved; preserve the requirement for a later return.'
        : 'If mastery is demonstrated, branch. If mastery remains unresolved, one progressively different follow-up may be considered.')
    : 'If mastery is demonstrated, suppress immediate repetition and branch to another eligible requirement.'

  return {
    version: 1,
    period_id: guidance.period.id,
    period_label: guidance.period.label,
    period_ends_on: guidance.period.ends_on,
    contract_version_id: guidance.contract_version_id,
    requirement_key: candidate.requirement_key,
    supporting_requirement_keys: [],
    requirement_statement: candidate.statement,
    planning_group_key: candidate.planning_group_key,
    decision_kind: candidate.decision_kind,
    must_learn: candidate.must_learn,
    attention: candidate.attention,
    mastery_state_before: candidate.state.mastery,
    coverage_state_before: candidate.state.coverage,
    retention_state_before: candidate.state.retention,
    consecutive_exposures_before: candidate.state.consecutive_exposures,
    exposure_number: exposureNumber,
    instructional_change: clean(generated?.instructional_change) || null,
    coverage_pressure: subject.coverage_pressure,
    required_remaining: subject.required_remaining,
    remaining_instructional_capacity: subject.remaining_instructional_capacity,
    reasons: candidate.reasons,
    goal_reasons: candidate.goal_reasons,
    unmet_prerequisite_keys: candidate.unmet_prerequisite_keys,
    unlocks_requirement_keys: candidate.unlocks_requirement_keys,
    alternatives,
    next_policy: nextPolicy,
  }
}
export function nextInstructionalForecastWeek(today) {
  return addSyllabusDays(startOfSyllabusWeek(today), 7)
}

export function instructionalSlotsForWeek(weeklyPattern, weekStart) {
  const slots = []
  for (let offset = 0; offset < 7; offset++) {
    const plannedDate = addSyllabusDays(weekStart, offset)
    const day = DAY_KEYS[new Date(`${plannedDate}T12:00:00.000Z`).getUTCDay()]
    const entries = Array.isArray(weeklyPattern?.[day]) ? weeklyPattern[day] : []
    entries.forEach((entry, sortOrder) => {
      const subject = clean(typeof entry === 'string' ? entry : entry?.subject)
      if (subject) slots.push({ planned_date: plannedDate, subject, sort_order: sortOrder })
    })
  }
  return slots
}

export function unfinishedLessonCarrySuggestions({ activeRevision, timelineItems = [], openSlots = [], today } = {}) {
  const effectiveFrom = clean(activeRevision?.effective_from).slice(0, 10)
  const latestActualByLesson = new Map()
  for (const item of timelineItems || []) {
    if (item?.placement_kind !== 'actual' || item?.historical_record === true || !item?.lesson_key) continue
    const current = latestActualByLesson.get(item.lesson_key)
    if (!current || eventTime(item) > eventTime(current)) latestActualByLesson.set(item.lesson_key, item)
  }
  const candidates = [...latestActualByLesson.values()].filter((item) => {
    const date = clean(item?.planned_date).slice(0, 10)
    return item?.actual_kind === 'incomplete'
      && item?.requires_facilitator_carry === true
      && clean(item?.carry_source_occurrence_id)
      && (!effectiveFrom || date >= effectiveFrom)
      && (!today || date <= today)
  }).sort((left, right) => eventTime(right) - eventTime(left)
    || clean(left.lesson_key).localeCompare(clean(right.lesson_key)))

  const remaining = [...openSlots]
  const suggestions = []
  for (const item of candidates) {
    const index = remaining.findIndex((slot) => subjectKey(slot.subject) === subjectKey(item.subject))
    if (index < 0) continue
    const slot = remaining.splice(index, 1)[0]
    suggestions.push({
      slot,
      lesson_key: item.lesson_key,
      title: clean(item.title) || 'Unfinished lesson',
      subject: clean(item.subject) || slot.subject,
      source_occurrence_id: clean(item.carry_source_occurrence_id),
      source_date: clean(item.carry_source_date || item.planned_date).slice(0, 10),
      actual_at: item.actual_at || null,
      curriculum_guidance: item?.metadata?.learning_forecast?.curriculum_guidance || null,
    })
  }
  return { suggestions, remaining_slots: remaining }
}

function inputIdentity({ activeRevision, forecastItems, proposedForecastItems, timelineItems, targetWeekStart, targetWeekEnd, learnerGrade, evidenceContext, subjectBreadth, curriculumGuidance = null, blockedDates, carrySuggestions = [] }) {
  return createHash('sha256').update(JSON.stringify({
    active_revision_id: activeRevision.id,
    target_week: [targetWeekStart, targetWeekEnd],
    learner_grade: clean(learnerGrade) || null,
    goals: activeRevision.goals,
    subjects: activeRevision.subjects,
    weekly_pattern: activeRevision.weekly_pattern,
    no_school_dates: [...blockedDates].sort(),
    teaching_guidance: activeRevision.teaching_guidance,
    planning_policy: activeRevision.planning_policy,
    forecast_items: forecastItems.map((item) => ({
      lineage_id: item.lineage_id,
      planned_date: String(item.planned_date).slice(0, 10),
      subject: item.subject,
      title: item.title,
      description: item.description || null,
      lesson_key: item.lesson_key || null,
      item_type: item.item_type,
      origin: item.origin,
      sort_order: item.sort_order,
      planning: forecastPlanningMetadata(item?.metadata?.learning_forecast || {}),
    })),
    proposed_forecast_items: proposedForecastItems.map((item) => ({
      lineage_id: item.lineage_id, planned_date: String(item.planned_date).slice(0, 10),
      subject: item.subject, title: item.title, sort_order: item.sort_order, lesson_key: item.lesson_key || null,
    })),
    occupied_timeline: timelineItems.filter((item) => {
      const date = String(item?.planned_date || '').slice(0, 10)
      return date >= targetWeekStart && date <= targetWeekEnd
    }).map((item) => ({
      occurrence_id: item.occurrence_id || item.id,
      planned_date: String(item.planned_date).slice(0, 10),
      subject: item.subject,
      title: item.title || null,
      sort_order: item.sort_order,
      lesson_key: item.lesson_key || null,
    })),
    evidence: evidenceContext,
    subject_breadth: subjectBreadth,
    curriculum_guidance: curriculumGuidance,
    carry_suggestions: carrySuggestions.map((entry) => ({
      planned_date: entry.slot.planned_date, sort_order: entry.slot.sort_order, subject: entry.slot.subject,
      lesson_key: entry.lesson_key, source_occurrence_id: entry.source_occurrence_id, source_date: entry.source_date,
    })),
  })).digest('hex')
}

export function instructionalWeekIsFilled({ activeRevision, timelineItems = [], proposedForecastItems = [], noSchoolDates = [], weekStart, today = '' } = {}) {
  const targetWeekStart = startOfSyllabusWeek(weekStart)
  if (!activeRevision?.weekly_pattern || !targetWeekStart) return false
  const currentWeekStart = startOfSyllabusWeek(today)
  const blockedDates = noSchoolDateSet(noSchoolDates)
  const slots = instructionalSlotsForWeek(activeRevision.weekly_pattern, targetWeekStart)
    .filter((slot) => !blockedDates.has(slot.planned_date))
    .filter((slot) => targetWeekStart !== currentWeekStart || slot.planned_date >= today)
  const occupied = new Set([...timelineItems, ...proposedForecastItems].filter((item) => {
    if (item?.item_type === 'slate_assignment') return false
    return startOfSyllabusWeek(item?.planned_date) === targetWeekStart
  }).map((item) => `${String(item.planned_date).slice(0, 10)}:${Number(item.sort_order || 0)}`))
  return slots.every((slot) => occupied.has(`${slot.planned_date}:${slot.sort_order}`))
}

export function buildInstructionalForecastPlan({ activeRevision, forecastItems = [], proposedForecastItems = [], timelineItems = [], reports = [], learnerGrade = null, noSchoolDates = [], curriculumGuidance = null, today, targetWeekStart: requestedTargetWeekStart = '' }) {
  if (!activeRevision?.id) throw new Error('An active Syllabus revision is required')
  const { start: targetWeekStart, end: targetWeekEnd } = instructionalForecastWindow(today, requestedTargetWeekStart)
  if (!targetWeekStart) throw new Error('A valid local date is required for forecasting')
  const currentWeekStart = startOfSyllabusWeek(today)
  const blockedDates = noSchoolDateSet(noSchoolDates)
  const slots = instructionalSlotsForWeek(activeRevision.weekly_pattern, targetWeekStart)
    .filter((slot) => !blockedDates.has(slot.planned_date))
    .filter((slot) => targetWeekStart !== currentWeekStart || slot.planned_date >= today)
  const occupied = new Set([...timelineItems, ...proposedForecastItems].filter((item) => {
    if (item?.item_type === 'slate_assignment') return false
    const date = String(item?.planned_date || '').slice(0, 10)
    return date >= targetWeekStart && date <= targetWeekEnd
  }).map((item) => `${String(item.planned_date).slice(0, 10)}:${Number(item.sort_order || 0)}`))
  const openSlots = slots.filter((slot) => !occupied.has(`${slot.planned_date}:${slot.sort_order}`))
  const carryPlan = unfinishedLessonCarrySuggestions({ activeRevision, timelineItems, openSlots, today })
  const unfilledSlots = carryPlan.remaining_slots
  const requestedSubjects = unfilledSlots.map((slot) => slot.subject)
  const evidenceContext = subjectBalancedInstructionalEvidenceContext(reports, requestedSubjects, { perSubjectLimit: 8 })
  const subjectBreadth = buildSubjectBreadthContext({
    learnerGrade,
    slots: unfilledSlots,
    reports,
    forecastItems: [...forecastItems, ...proposedForecastItems],
    timelineItems,
    today,
    perSubjectEvidenceLimit: 8,
  })
  const proposalKey = inputIdentity({
    activeRevision, forecastItems, proposedForecastItems, timelineItems, targetWeekStart, targetWeekEnd,
    learnerGrade, evidenceContext, subjectBreadth, curriculumGuidance, blockedDates, carrySuggestions: carryPlan.suggestions,
  })
  return {
    proposal_key: proposalKey,
    target_week_start: targetWeekStart,
    target_week_end: targetWeekEnd,
    slots,
    unfilled_slots: unfilledSlots,
    carry_suggestions: carryPlan.suggestions,
    evidence_context: evidenceContext,
    subject_breadth: subjectBreadth,
    curriculum_guidance: curriculumGuidance,
  }
}

export function buildLearningForecastSnapshot({ activeRevision, forecastItems = [], existingProposalItems = null, plan, generatedItems = [], today }) {
  if (generatedItems.length !== plan.unfilled_slots.length) throw new Error('Forecast model returned an unexpected number of items')
  const carryAdditions = (plan.carry_suggestions || []).map(({ slot, lesson_key: lessonKey, title, subject, source_occurrence_id: sourceOccurrenceId, source_date: sourceDate, curriculum_guidance: curriculumGuidance }) => ({
    lineage_id: stableUuid(`${plan.proposal_key}:carry:${slot.planned_date}:${slot.sort_order}:${lessonKey}:${sourceOccurrenceId}`),
    planned_date: slot.planned_date,
    subject: subject || slot.subject,
    title,
    description: `Carry the unfinished ${title} lesson forward. The existing lesson is preserved until the facilitator chooses to carry it.`,
    lesson_key: null,
    item_type: 'lesson',
    origin: 'learning_forecast',
    sort_order: slot.sort_order,
    metadata: {
      learning_forecast: {
        proposal_key: plan.proposal_key,
        base_revision_id: activeRevision.id,
        target_week_start: plan.target_week_start,
        planning_move: 'continue',
        planning_reason: 'An incomplete Syllabus lesson is available to carry forward only with facilitator approval.',
        ...(curriculumGuidance ? { curriculum_guidance: curriculumGuidance } : {}),
        carry_existing_lesson_key: lessonKey,
        carry_source_occurrence_id: sourceOccurrenceId,
        carry_source_date: sourceDate,
      },
    },
  }))
  const generatedAdditions = plan.unfilled_slots.map((slot, index) => {
    const generated = generatedItems[index] || {}
    const title = clean(generated.title).slice(0, 300)
    const description = clean(generated.description).slice(0, 2000)
    if (!title || !description) throw new Error('Forecast model returned an incomplete instructional forecast')
    if (duplicatesSlateAuthority(`${title} ${description}`)) throw new Error('Forecast model crossed the instructional authority boundary')
    const planningMetadata = forecastPlanningMetadata(generated)
    const curriculumGuidance = curriculumSelectionMetadata(plan, slot, generated)
    return {
      lineage_id: stableUuid(`${plan.proposal_key}:${slot.planned_date}:${slot.sort_order}:${slot.subject.toLocaleLowerCase()}`),
      planned_date: slot.planned_date,
      subject: slot.subject,
      title,
      description,
      lesson_key: null,
      item_type: 'lesson',
      origin: 'learning_forecast',
      sort_order: slot.sort_order,
      metadata: {
        learning_forecast: {
          proposal_key: plan.proposal_key,
          base_revision_id: activeRevision.id,
          target_week_start: plan.target_week_start,
          ...planningMetadata,
          ...(curriculumGuidance ? { curriculum_guidance: curriculumGuidance } : {}),
        },
      },
    }
  })
  const additions = [...carryAdditions, ...generatedAdditions]
  const retentionSource = Array.isArray(existingProposalItems) ? existingProposalItems : forecastItems
  const retained = structuredClone(retentionSource).filter((item) => String(item?.planned_date || '').slice(0, 10) >= today)
  const allItems = [...retained, ...additions].sort((left, right) => (
    String(left.planned_date).localeCompare(String(right.planned_date))
    || Number(left.sort_order || 0) - Number(right.sort_order || 0)
    || String(left.lineage_id).localeCompare(String(right.lineage_id))
  ))
  return {
    additions,
    snapshot: {
      effective_from: today,
      goals: structuredClone(activeRevision.goals),
      subjects: structuredClone(activeRevision.subjects),
      weekly_pattern: structuredClone(activeRevision.weekly_pattern),
      teaching_guidance: structuredClone(activeRevision.teaching_guidance),
      planning_policy: {
        ...structuredClone(activeRevision.planning_policy),
        ...(plan?.curriculum_guidance?.contract_version_id ? {
          curriculum_guidance_version: 1,
          curriculum_contract_version_id: plan.curriculum_guidance.contract_version_id,
        } : {}),
      },
      legacy_provenance: structuredClone(activeRevision.legacy_provenance),
      forecast_items: allItems,
      change_reason: `Instructional learning forecast proposal: week of ${plan.target_week_start}`,
    },
  }
}
