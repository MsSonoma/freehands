import { deriveConceptId } from '../masteryEvidence/identity.js'
import { curriculumGuidanceCounts } from './curriculumGuidance.mjs'
import { addSyllabusDays } from './timeline.mjs'

function clean(value) { return String(value ?? '').trim() }
function subjectKey(value) { return clean(value).toLocaleLowerCase() }
function dateOnly(value) { return clean(value).slice(0, 10) }

function timestamp(value) {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

function reportTime(report) {
  return timestamp(report?.session?.ended_at || report?.session?.started_at)
}

function actualTimelineItem(item) {
  return item?.placement_kind === 'actual' && item?.historical_record !== true
}

function curriculumMetadata(item) {
  return item?.metadata?.learning_forecast?.curriculum_guidance
    || item?.learning_forecast?.curriculum_guidance
    || null
}

function reportLessonKey(report) {
  return clean(report?.lesson?.key || report?.lesson?.source_key || report?.lesson?.id)
}

function expectedConceptId(requirementKey) {
  return deriveConceptId({ conceptId: requirementKey })
}

function initialState(requirement) {
  return {
    requirement_key: requirement.requirement_key,
    curriculum_contract_item_id: requirement.id || null,
    subject: requirement.subject,
    planning_group_key: requirement.planning_group_key,
    coverage_state: 'not_started',
    mastery_state: 'not_measured',
    retention_state: 'not_measured',
    last_evidence_at: null,
    last_instruction_at: null,
    consecutive_exposures: 0,
    return_after: null,
    projection: {
      version: 1,
      evidence_kind: 'inferred',
      source: 'curriculum-guidance-projector',
    },
  }
}

function setLaterDate(current, candidate) {
  if (!candidate) return current || null
  if (!current) return candidate
  return timestamp(candidate) >= timestamp(current) ? candidate : current
}

function applyIndependentState(state, independentState, observedAt) {
  const value = clean(independentState)
  if (['independent_success', 'independent_success_after_recovery'].includes(value)) {
    state.coverage_state = 'covered'
    state.mastery_state = 'demonstrated'
  } else if (['needs_recovery', 'assisted_success'].includes(value)) {
    if (state.coverage_state === 'not_started') state.coverage_state = 'introduced'
    state.mastery_state = 'unresolved'
  }
  if (value && !['unavailable', 'not_measured', 'unknown_protocol'].includes(value)) {
    state.last_evidence_at = setLaterDate(state.last_evidence_at, observedAt)
  }
}

function applyRetentionState(state, retentionState, observedAt) {
  const value = clean(retentionState)
  if (['retained', 'independent_success', 'independent_retained'].includes(value)) {
    state.retention_state = 'retained'
    state.mastery_state = 'demonstrated'
  } else if (['needs_review', 'assisted_review'].includes(value)) {
    state.retention_state = 'needs_review'
  }
  if (value && !['unavailable', 'not_measured', 'unknown_protocol'].includes(value)) {
    state.last_evidence_at = setLaterDate(state.last_evidence_at, observedAt)
  }
}

function timelineTargetKeys(item, lessonTargetsByLesson) {
  const guidance = curriculumMetadata(item)
  const keys = []
  if (guidance?.requirement_key) keys.push(clean(guidance.requirement_key))
  for (const value of guidance?.supporting_requirement_keys || []) {
    if (clean(value)) keys.push(clean(value))
  }
  const lessonKey = clean(item?.lesson_key)
  for (const target of lessonTargetsByLesson.get(lessonKey) || []) {
    if (clean(target.requirement_key)) keys.push(clean(target.requirement_key))
  }
  return [...new Set(keys)]
}

function groupForTimelineItem(item, requirementsByKey, lessonTargetsByLesson) {
  const guidance = curriculumMetadata(item)
  if (clean(guidance?.planning_group_key)) return clean(guidance.planning_group_key)
  for (const key of timelineTargetKeys(item, lessonTargetsByLesson)) {
    const requirement = requirementsByKey.get(key)
    if (requirement?.planning_group_key) return requirement.planning_group_key
  }
  return null
}

function consecutiveGroups({ timelineItems, proposedForecastItems, requirementsByKey, lessonTargetsByLesson, cutoffDate }) {
  const bySubject = new Map()
  const source = [...(timelineItems || []), ...(proposedForecastItems || [])]
    .filter((item) => {
      const date = dateOnly(item?.planned_date)
      if (!date || (cutoffDate && date >= cutoffDate)) return false
      if (item?.item_type === 'slate_assignment') return false
      return (item?.item_type || 'lesson') === 'lesson'
    })
    .sort((a, b) => dateOnly(a.planned_date).localeCompare(dateOnly(b.planned_date))
      || Number(a.sort_order || 0) - Number(b.sort_order || 0)
      || String(a.id || a.lineage_id || '').localeCompare(String(b.id || b.lineage_id || '')))

  for (const item of source) {
    const subject = subjectKey(item.subject)
    const group = groupForTimelineItem(item, requirementsByKey, lessonTargetsByLesson)
    if (!subject || !group) continue
    const current = bySubject.get(subject)
    if (current?.group === group) current.count += 1
    else bySubject.set(subject, { group, count: 1, last_date: dateOnly(item.planned_date) })
    const next = bySubject.get(subject)
    next.last_date = dateOnly(item.planned_date)
  }
  return bySubject
}

function recentLessonsByGroup({ timelineItems, proposedForecastItems, requirementsByKey, lessonTargetsByLesson, cutoffDate }) {
  const groups = new Map()
  const source = [...(timelineItems || []), ...(proposedForecastItems || [])]
    .filter((item) => {
      const date = dateOnly(item?.planned_date)
      if (!date || (cutoffDate && date >= cutoffDate)) return false
      if (item?.item_type === 'slate_assignment') return false
      return (item?.item_type || 'lesson') === 'lesson'
    })
    .sort((a, b) => dateOnly(a.planned_date).localeCompare(dateOnly(b.planned_date))
      || Number(a.sort_order || 0) - Number(b.sort_order || 0))
  for (const item of source) {
    const group = groupForTimelineItem(item, requirementsByKey, lessonTargetsByLesson)
    if (!group) continue
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push({
      title: clean(item.title) || null,
      description: clean(item.description) || null,
      planned_date: dateOnly(item.planned_date),
      subject: clean(item.subject) || null,
    })
  }
  for (const [group, items] of groups) groups.set(group, items.slice(-3))
  return groups
}

export function projectCurriculumState({
  facilitatorId,
  learnerId,
  period,
  requirements = [],
  reports = [],
  timelineItems = [],
  proposedForecastItems = [],
  lessonTargets = [],
  cutoffDate = '',
} = {}) {
  const requirementsByKey = new Map(requirements.map((item) => [item.requirement_key, item]))
  const states = new Map(requirements.map((requirement) => [requirement.requirement_key, initialState(requirement)]))
  const lessonTargetsByLesson = new Map()
  for (const target of lessonTargets || []) {
    const key = clean(target.lesson_key)
    if (!key) continue
    if (!lessonTargetsByLesson.has(key)) lessonTargetsByLesson.set(key, [])
    lessonTargetsByLesson.get(key).push(target)
  }

  for (const item of timelineItems || []) {
    if (!actualTimelineItem(item)) continue
    const instructionAt = item.actual_at || (item.planned_date ? `${dateOnly(item.planned_date)}T12:00:00.000Z` : null)
    for (const key of timelineTargetKeys(item, lessonTargetsByLesson)) {
      const state = states.get(key)
      if (!state) continue
      state.coverage_state = item.actual_kind === 'incomplete' ? 'developing' : 'covered'
      if (state.mastery_state === 'not_measured') state.mastery_state = item.actual_kind === 'incomplete' ? 'unresolved' : 'developing'
      state.last_instruction_at = setLaterDate(state.last_instruction_at, instructionAt)
    }
  }

  const conceptToRequirement = new Map(requirements.map((item) => [expectedConceptId(item.requirement_key), item.requirement_key]))
  const orderedReports = [...(reports || [])].sort((a, b) => reportTime(a) - reportTime(b))
  for (const report of orderedReports) {
    const observedAt = report?.session?.ended_at || report?.session?.started_at || null
    const directlyObserved = new Set()
    for (const concept of report?.concept_evidence || []) {
      const key = conceptToRequirement.get(clean(concept?.concept_id))
      const state = key ? states.get(key) : null
      if (!state) continue
      directlyObserved.add(key)
      if (concept.mastery === 'mastered') {
        state.coverage_state = 'covered'
        state.mastery_state = 'demonstrated'
      } else if (concept.mastery === 'pending') {
        if (state.coverage_state === 'not_started') state.coverage_state = concept.coverage === 'covered' ? 'covered' : 'introduced'
        state.mastery_state = concept.comprehension === 'demonstrated' ? 'developing' : 'unresolved'
      }
      state.last_evidence_at = setLaterDate(state.last_evidence_at, observedAt)
    }

    const targets = lessonTargetsByLesson.get(reportLessonKey(report)) || []
    for (const target of targets) {
      const key = clean(target.requirement_key)
      if (!key || directlyObserved.has(key)) continue
      const state = states.get(key)
      if (!state) continue
      applyIndependentState(state, report?.independent_evidence?.state, observedAt)
      applyRetentionState(state, report?.retention?.state, observedAt)
    }
  }

  const recent = consecutiveGroups({
    timelineItems,
    proposedForecastItems,
    requirementsByKey,
    lessonTargetsByLesson,
    cutoffDate,
  })
  const recentLessons = recentLessonsByGroup({
    timelineItems,
    proposedForecastItems,
    requirementsByKey,
    lessonTargetsByLesson,
    cutoffDate,
  })
  for (const requirement of requirements) {
    const state = states.get(requirement.requirement_key)
    const subjectRecent = recent.get(subjectKey(requirement.subject))
    state.consecutive_exposures = subjectRecent?.group === requirement.planning_group_key
      ? Math.min(3, Number(subjectRecent.count || 0))
      : 0
    state.projection = {
      ...state.projection,
      expected_concept_id: expectedConceptId(requirement.requirement_key),
      recent_subject_group: subjectRecent?.group || null,
      recent_subject_group_count: subjectRecent?.count || 0,
      recent_group_lessons: recentLessons.get(requirement.planning_group_key) || [],
    }
  }

  return [...states.values()].map((state) => ({
    facilitator_id: facilitatorId,
    learner_id: learnerId,
    period_id: period.id,
    ...state,
  }))
}

function goalBoost(requirement, goals = []) {
  let boost = 0
  const reasons = []
  for (const goal of goals) {
    const linked = Array.isArray(goal.linked_requirement_keys) && goal.linked_requirement_keys.includes(requirement.requirement_key)
    const subjectMatch = goal.subject && subjectKey(goal.subject) === subjectKey(requirement.subject)
    if (!linked && !subjectMatch) continue
    const value = goal.priority === 'high' ? 30 : goal.priority === 'low' ? 5 : 15
    boost += value
    reasons.push({ goal_key: goal.goal_key, title: goal.title, priority: goal.priority, linked })
  }
  return { boost, reasons }
}

function attentionBoost(value) {
  if (value === 'more') return 20
  if (value === 'minimum') return -15
  return 0
}

function dayCount(from, to) {
  const a = Date.parse(`${dateOnly(from)}T12:00:00.000Z`)
  const b = Date.parse(`${dateOnly(to)}T12:00:00.000Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / 86400000)) : 0
}

function remainingSubjectCapacity({ activeRevision, subject, fromDate, toDate, noSchoolDates = [] }) {
  const blocked = new Set((noSchoolDates || []).map((row) => dateOnly(row?.date || row)).filter(Boolean))
  let count = 0
  const subjectIdentity = subjectKey(subject)
  for (let date = dateOnly(fromDate); date && date <= dateOnly(toDate); date = addSyllabusDays(date, 1)) {
    if (blocked.has(date)) continue
    const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      new Date(`${date}T12:00:00.000Z`).getUTCDay()
    ]
    const entries = Array.isArray(activeRevision?.weekly_pattern?.[weekday]) ? activeRevision.weekly_pattern[weekday] : []
    count += entries.filter((entry) => subjectKey(typeof entry === 'string' ? entry : entry?.subject) === subjectIdentity).length
  }
  return count
}

function coveragePressure({ remainingRequired, capacity }) {
  if (remainingRequired <= 0) return { state: 'ahead', ratio: 0 }
  if (capacity <= 0) return { state: 'overcommitted', ratio: null }
  const ratio = remainingRequired / capacity
  if (ratio > 1) return { state: 'overcommitted', ratio }
  if (ratio >= 0.8) return { state: 'tight', ratio }
  return { state: 'on_pace', ratio }
}

function prerequisiteContext(requirements = [], associations = []) {
  const byFrameworkItem = new Map(requirements.filter((item) => item.framework_item_id).map((item) => [item.framework_item_id, item]))
  const prerequisitesOf = new Map()
  const unlocks = new Map()
  for (const association of associations || []) {
    if (association.relationship !== 'prerequisite_of') continue
    const source = byFrameworkItem.get(association.source_item_id)
    const target = byFrameworkItem.get(association.target_item_id)
    if (!source || !target) continue
    if (!prerequisitesOf.has(target.requirement_key)) prerequisitesOf.set(target.requirement_key, [])
    prerequisitesOf.get(target.requirement_key).push({ requirement: source, association })
    if (!unlocks.has(source.requirement_key)) unlocks.set(source.requirement_key, [])
    unlocks.get(source.requirement_key).push({ requirement: target, association })
  }
  return { prerequisitesOf, unlocks }
}

export function buildCurriculumCandidateContext({
  activeRevision,
  period,
  contractVersion,
  requirements = [],
  goals = [],
  states = [],
  associations = [],
  requestedSubjects = [],
  today,
  targetWeekStart,
  noSchoolDates = [],
} = {}) {
  const stateByKey = new Map(states.map((state) => [state.requirement_key, state]))
  const { prerequisitesOf, unlocks } = prerequisiteContext(requirements, associations)
  const requested = [...new Set(requestedSubjects.map(subjectKey).filter(Boolean))]
  const subjects = {}

  for (const requestedSubject of requested) {
    const subjectRequirements = requirements.filter((item) => subjectKey(item.subject) === requestedSubject)
    if (!subjectRequirements.length) continue
    const remainingRequired = subjectRequirements.filter((item) => {
      const state = stateByKey.get(item.requirement_key)
      return item.must_learn !== false && state?.mastery_state !== 'demonstrated'
    }).length
    const capacity = remainingSubjectCapacity({
      activeRevision,
      subject: requestedSubject,
      fromDate: targetWeekStart || today,
      toDate: period.ends_on,
      noSchoolDates,
    })
    const pressure = coveragePressure({ remainingRequired, capacity })
    const candidates = []

    for (const requirement of subjectRequirements) {
      const state = stateByKey.get(requirement.requirement_key) || initialState(requirement)
      const prereqs = prerequisitesOf.get(requirement.requirement_key) || []
      const unmetPrerequisites = prereqs
        .map((entry) => entry.requirement)
        .filter((item) => stateByKey.get(item.requirement_key)?.mastery_state !== 'demonstrated')
      const unlockTargets = (unlocks.get(requirement.requirement_key) || [])
        .map((entry) => entry.requirement)
        .filter((item) => item.must_learn !== false && stateByKey.get(item.requirement_key)?.mastery_state !== 'demonstrated')
      const goalsForRequirement = goalBoost(requirement, goals)
      const due = requirement.target_date || period.ends_on
      const daysUntilDue = dayCount(today, due)
      let score = requirement.must_learn === false ? 10 : 50
      const reasons = []

      if (state.mastery_state === 'demonstrated') {
        score -= 120
        reasons.push('recent mastery demonstrated; immediate repetition is suppressed')
      } else if (state.mastery_state === 'unresolved') {
        score += 70
        reasons.push('independent mastery remains unresolved')
      } else if (state.mastery_state === 'developing') {
        score += 40
        reasons.push('learning is developing but not yet demonstrated')
      } else if (state.coverage_state === 'not_started') {
        score += 30
        reasons.push('requirement has not yet been introduced')
      }
      if (requirement.must_learn !== false && ['tight', 'overcommitted'].includes(pressure.state)) {
        score += pressure.state === 'overcommitted' ? 45 : 25
        reasons.push(`required coverage is ${pressure.state.replace('_', ' ')} for this subject`)
      }
      if (daysUntilDue <= 21 && requirement.must_learn !== false) {
        score += 25
        reasons.push('requirement target date is approaching')
      }
      if (unlockTargets.length) {
        score += Math.min(40, unlockTargets.length * 15)
        reasons.push(`mastering this requirement unlocks ${unlockTargets.length} unmet required item${unlockTargets.length === 1 ? '' : 's'}`)
      }
      score += attentionBoost(requirement.attention)
      if (requirement.attention === 'more') reasons.push('facilitator requested additional attention')
      if (requirement.attention === 'minimum') reasons.push('facilitator requested minimum discretionary attention')
      score += goalsForRequirement.boost
      if (goalsForRequirement.reasons.length) reasons.push('supports a facilitator personal goal')

      let eligible = true
      let blockedReason = null
      if (state.mastery_state === 'demonstrated') {
        eligible = false
        blockedReason = 'mastery_demonstrated'
      } else if (unmetPrerequisites.length) {
        eligible = false
        blockedReason = 'prerequisite_unmet'
      } else if (state.consecutive_exposures >= 3) {
        eligible = false
        blockedReason = 'consecutive_exposure_cap'
        reasons.push('three consecutive lessons in this instructional territory require a branch before returning')
      }

      const decisionKind = state.mastery_state === 'unresolved'
        ? (state.consecutive_exposures > 0 ? 'recovery' : 'return')
        : requirement.must_learn !== false
          ? 'new_required'
          : goalsForRequirement.reasons.length
            ? 'goal'
            : 'enrichment'

      candidates.push({
        requirement_key: requirement.requirement_key,
        framework_item_id: requirement.framework_item_id || null,
        statement: requirement.statement,
        subject: requirement.subject,
        planning_group_key: requirement.planning_group_key,
        must_learn: requirement.must_learn !== false,
        attention: requirement.attention,
        target_date: requirement.target_date,
        state: {
          coverage: state.coverage_state,
          mastery: state.mastery_state,
          retention: state.retention_state,
          consecutive_exposures: state.consecutive_exposures,
          last_instruction_at: state.last_instruction_at,
          last_evidence_at: state.last_evidence_at,
          recent_lessons: state.projection?.recent_group_lessons || [],
        },
        eligible,
        blocked_reason: blockedReason,
        unmet_prerequisite_keys: unmetPrerequisites.map((item) => item.requirement_key),
        unlocks_requirement_keys: unlockTargets.map((item) => item.requirement_key),
        goal_reasons: goalsForRequirement.reasons,
        score,
        reasons,
        decision_kind: decisionKind,
      })
    }

    candidates.sort((a, b) => Number(b.eligible) - Number(a.eligible)
      || b.score - a.score
      || Number(b.must_learn) - Number(a.must_learn)
      || a.statement.localeCompare(b.statement))

    subjects[requestedSubject] = {
      subject: subjectRequirements[0]?.subject || requestedSubject,
      required_remaining: remainingRequired,
      remaining_instructional_capacity: capacity,
      coverage_pressure: pressure,
      candidates: candidates.slice(0, 16),
      eligible_requirement_keys: candidates.filter((candidate) => candidate.eligible).map((candidate) => candidate.requirement_key),
      forced_branch_groups: [...new Set(candidates.filter((candidate) => candidate.blocked_reason === 'consecutive_exposure_cap').map((candidate) => candidate.planning_group_key))],
    }
  }

  return {
    version: 1,
    period: {
      id: period.id,
      label: period.label,
      starts_on: dateOnly(period.starts_on),
      ends_on: dateOnly(period.ends_on),
      period_type: period.period_type,
    },
    contract_version_id: contractVersion.id,
    policy: {
      mastery_success_suppresses_immediate_repeat: true,
      unresolved_may_continue: true,
      max_consecutive_exposures_per_planning_group: 3,
      continuation_must_change_instructional_approach: true,
      retention_only_work_is_not_a_full_forecast_lesson: true,
    },
    subjects,
  }
}

export async function loadActiveCurriculumPlanningContext({
  repository,
  facilitatorId,
  learnerId,
  activeRevision,
  learnerGrade,
  reports = [],
  timelineItems = [],
  proposedForecastItems = [],
  noSchoolDates = [],
  requestedSubjects = [],
  requestedSlots = [],
  today,
  targetWeekStart,
} = {}) {
  if (
    typeof repository.findCurriculumContractVersion !== 'function'
    || typeof repository.findCurriculumPeriod !== 'function'
  ) return null

  const slots = Array.isArray(requestedSlots) ? requestedSlots : []
  const requestedDate = dateOnly(slots[0]?.planned_date || targetWeekStart || today)

  const snapshotForVersion = async (version) => {
    if (!version?.activated_at) return null
    const storedPeriod = await repository.findCurriculumPeriod(version.period_id, facilitatorId, learnerId)
    if (!storedPeriod) return null
    return {
      version,
      period: {
        ...storedPeriod,
        label: version.period_label || storedPeriod.label,
        period_type: version.period_type || storedPeriod.period_type,
        starts_on: version.period_start || storedPeriod.starts_on,
        ends_on: version.period_end || storedPeriod.ends_on,
        active_contract_version_id: version.id,
      },
    }
  }

  const contains = (period, date) => Boolean(
    period
    && date
    && date >= dateOnly(period.starts_on)
    && date <= dateOnly(period.ends_on)
  )

  const pinnedContractVersionId = clean(
    activeRevision?.curriculum_contract_version_id
      || activeRevision?.planning_policy?.curriculum_contract_version_id,
  )
  let resolved = pinnedContractVersionId
    ? await snapshotForVersion(await repository.findCurriculumContractVersion(pinnedContractVersionId))
    : null

  // A facilitator may approve the next period before it starts. The current
  // Syllabus remains governed by its pinned contract while its dates apply,
  // then Forecast resolves the already-authorized contract for the target date.
  if (!contains(resolved?.period, requestedDate) && typeof repository.findActiveCurriculumPeriod === 'function') {
    const targetPeriod = await repository.findActiveCurriculumPeriod(facilitatorId, learnerId, requestedDate)
    const targetVersionId = clean(targetPeriod?.active_contract_version_id)
    if (targetVersionId) {
      const targetVersion = await repository.findCurriculumContractVersion(targetVersionId, targetPeriod.id)
      const targetResolved = await snapshotForVersion(targetVersion)
      if (contains(targetResolved?.period, requestedDate)) resolved = targetResolved
    }
  }

  if (!resolved) return null
  const { version: contractVersion, period } = resolved

  const outsidePeriod = slots.find((slot) => {
    const date = dateOnly(slot?.planned_date)
    return date && !contains(period, date)
  })
  const weekOutsidePeriod = !slots.length && requestedDate && !contains(period, requestedDate)
  if (outsidePeriod || weekOutsidePeriod) {
    return {
      version: 1,
      blocked: true,
      reason: 'period_out_of_range',
      blocked_date: dateOnly(outsidePeriod?.planned_date || requestedDate),
      period: {
        id: period.id,
        label: period.label,
        starts_on: dateOnly(period.starts_on),
        ends_on: dateOnly(period.ends_on),
        period_type: period.period_type,
      },
      contract_version_id: contractVersion.id,
      subjects: {},
    }
  }

  const [requirements, goals] = await Promise.all([
    repository.listCurriculumContractItems(contractVersion.id),
    repository.listCurriculumContractGoals(contractVersion.id),
  ])
  if (!requirements.length) return null

  const lessonKeys = [...new Set((timelineItems || []).map((item) => clean(item?.lesson_key)).filter(Boolean))]
  const lessonTargets = typeof repository.listLessonCurriculumTargets === 'function'
    ? await repository.listLessonCurriculumTargets(facilitatorId, learnerId, lessonKeys)
    : []

  const states = projectCurriculumState({
    facilitatorId,
    learnerId,
    period,
    requirements,
    reports,
    timelineItems,
    proposedForecastItems,
    lessonTargets,
    cutoffDate: targetWeekStart,
  })
  if (typeof repository.upsertLearnerCurriculumState === 'function') {
    await repository.upsertLearnerCurriculumState(states)
  }

  const frameworkIds = [...new Set(requirements.map((item) => item.metadata?.framework_id).filter(Boolean))]
  const associations = typeof repository.listCurriculumFrameworkAssociations === 'function'
    ? await repository.listCurriculumFrameworkAssociations(frameworkIds)
    : []

  return buildCurriculumCandidateContext({
    activeRevision,
    period,
    contractVersion,
    requirements,
    goals,
    states,
    associations,
    requestedSubjects,
    today,
    targetWeekStart,
    noSchoolDates,
    learnerGrade,
  })
}
export async function loadCurriculumGuidanceBundle({
  repository,
  facilitatorId,
  learnerId,
  learnerGrade = null,
  subjects = [],
  today,
  periodId = null,
  includeRecommendations = true,
  decisionLimit = 50,
} = {}) {
  const active = await repository.findActiveCurriculumPeriod?.(facilitatorId, learnerId, today)
  const upcoming = await repository.findNextCurriculumPeriod?.(facilitatorId, learnerId, today)
  const selected = periodId
    ? await repository.findCurriculumPeriod?.(periodId, facilitatorId, learnerId)
    : null
  const period = selected || active || await repository.findLatestCurriculumPeriod?.(facilitatorId, learnerId)
  let contractVersion = null
  let requirements = []
  let goals = []
  let state = []
  if (period?.active_contract_version_id) {
    contractVersion = await repository.findCurriculumContractVersion(period.active_contract_version_id, period.id)
    if (contractVersion) {
      ;[requirements, goals, state] = await Promise.all([
        repository.listCurriculumContractItems(contractVersion.id),
        repository.listCurriculumContractGoals(contractVersion.id),
        repository.listLearnerCurriculumState?.(period.id) || [],
      ])
    }
  }
  const recommendations = includeRecommendations && typeof repository.listCurriculumFrameworkItems === 'function'
    ? await repository.listCurriculumFrameworkItems({ facilitatorId, subjects, grade: learnerGrade })
    : []
  const decisions = typeof repository.listCurriculumPlanningDecisions === 'function'
    ? await repository.listCurriculumPlanningDecisions(facilitatorId, learnerId, decisionLimit)
    : []

  if (active && !upcoming && dateOnly(today) <= dateOnly(active.ends_on)) {
    const reviewAt = addSyllabusDays(dateOnly(active.ends_on), -Number(active.review_window_days || 14))
    if (dateOnly(today) >= reviewAt && typeof repository.ensureCurriculumReviewNotification === 'function') {
      await repository.ensureCurriculumReviewNotification({
        facilitatorId,
        learnerId,
        periodId: active.id,
        title: 'Review the next curriculum period',
        body: `${active.label} ends on ${dateOnly(active.ends_on)}. Review requirements and personal goals for the next planning period.`,
        metadata: { ends_on: dateOnly(active.ends_on), active_contract_version_id: active.active_contract_version_id || null },
      }).catch(() => {})
    }
  }

  return {
    period,
    current_period: active || null,
    upcoming_period: upcoming || null,
    contract_version: contractVersion,
    requirements,
    goals,
    state,
    counts: curriculumGuidanceCounts(requirements, state),
    recommendations,
    decisions,
  }
}
