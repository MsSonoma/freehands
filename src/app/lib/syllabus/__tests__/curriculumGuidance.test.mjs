import test from 'node:test'
import assert from 'node:assert/strict'

import {
  validateCurriculumGuidanceInput,
} from '../curriculumGuidance.mjs'
import {
  buildCurriculumCandidateContext,
  loadActiveCurriculumPlanningContext,
  loadCurriculumGuidanceBundle,
  projectCurriculumState,
} from '../curriculumGuidance.server.mjs'
import {
  generateInstructionalForecastItems,
  validateInstructionalForecastItems,
} from '../learningForecastModel.server.mjs'
import {
  buildLearningForecastSnapshot,
} from '../learningForecast.mjs'
import { normalizeGenerationRequest } from '../../facilitatorPreparation.mjs'
import { deriveConceptId } from '../../masteryEvidence/identity.js'

const PERIOD = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Fall 2026',
  period_type: 'semester',
  starts_on: '2026-09-01',
  ends_on: '2027-01-15',
}

const CONTRACT = {
  id: '22222222-2222-4222-8222-222222222222',
}

function requirement({
  key = 'math:division',
  statement = 'Divide multi-digit whole numbers with remainders.',
  group = 'math:division',
  subject = 'Math',
  mustLearn = true,
  attention = 'normal',
} = {}) {
  return {
    id: `row:${key}`,
    requirement_key: key,
    framework_item_id: null,
    subject,
    statement,
    must_learn: mustLearn,
    attention,
    target_date: null,
    planning_group_key: group,
    source_kind: 'facilitator',
    metadata: {},
  }
}

function activeRevision() {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    weekly_pattern: {
      monday: [{ subject: 'Math' }],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
    goals: {},
    subjects: [{ name: 'Math' }],
    teaching_guidance: {},
    planning_policy: {},
    legacy_provenance: {},
  }
}

function conceptReport(requirementKey, {
  mastery = 'pending',
  coverage = 'covered',
  comprehension = 'not_demonstrated',
  at = '2026-09-20T14:00:00.000Z',
} = {}) {
  return {
    session: { started_at: at, ended_at: at },
    lesson: { key: `generated/${requirementKey}.json` },
    concept_evidence: [{
      concept_id: deriveConceptId({ conceptId: requirementKey }),
      coverage,
      comprehension,
      mastery,
    }],
    independent_evidence: { state: mastery === 'mastered' ? 'independent_success' : 'needs_recovery' },
    retention: { state: 'not_measured' },
  }
}

function curriculumTimelineItem({
  date,
  key = 'math:division',
  group = 'math:division',
  title = 'Division with Remainders',
  description = 'Use place value and partial quotients to divide whole numbers.',
} = {}) {
  return {
    placement_kind: 'actual',
    historical_record: false,
    actual_kind: 'completed',
    planned_date: date,
    actual_at: `${date}T15:00:00.000Z`,
    subject: 'Math',
    title,
    description,
    lesson_key: `generated/${date}.json`,
    item_type: 'lesson',
    metadata: {
      learning_forecast: {
        curriculum_guidance: {
          requirement_key: key,
          planning_group_key: group,
        },
      },
    },
  }
}

function guidanceContext(candidate) {
  return {
    curriculum_guidance: {
      period: PERIOD,
      contract_version_id: CONTRACT.id,
      subjects: {
        math: {
          subject: 'Math',
          eligible_requirement_keys: candidate.eligible ? [candidate.requirement_key] : [],
          candidates: [candidate],
          coverage_pressure: { state: 'on_pace', ratio: 0.5 },
          required_remaining: 1,
          remaining_instructional_capacity: 8,
        },
      },
    },
    subject_breadth: {
      subjects: [{
        subject: 'Math',
        default_planning_move: 'branch',
        recent_topic_history: [],
        future_intent: [],
      }],
    },
    syllabus: {},
  }
}

test('Curriculum Guidance validates a dated facilitator contract without topic/concept preference fields', () => {
  const result = validateCurriculumGuidanceInput({
    period: {
      label: 'Fall 2026',
      period_type: 'semester',
      starts_on: '2026-09-01',
      ends_on: '2027-01-15',
    },
    requirements: [{
      requirement_key: 'math:division',
      subject: 'Math',
      statement: 'Divide multi-digit whole numbers with remainders.',
      must_learn: true,
      attention: 'more',
      planning_group_key: 'math:division',
    }],
    goals: [{
      goal_key: 'goal:division-confidence',
      title: 'Build confidence with division.',
      subject: 'Math',
      priority: 'high',
      linked_requirement_keys: ['math:division'],
    }],
  })

  assert.equal(result.period.period_type, 'semester')
  assert.equal(result.requirements[0].must_learn, true)
  assert.equal(result.requirements[0].attention, 'more')
  assert.equal(result.goals[0].priority, 'high')
  assert.deepEqual(result.goals[0].linked_requirement_keys, ['math:division'])
  assert.equal(Object.hasOwn(result, 'focus_topics'), false)
  assert.equal(Object.hasOwn(result, 'focus_concepts'), false)
})

test('demonstrated mastery removes recent curriculum territory from immediate eligibility', () => {
  const requirements = [
    requirement(),
    requirement({
      key: 'math:geometry',
      statement: 'Classify angles and shapes by their properties.',
      group: 'math:geometry',
    }),
  ]
  const states = projectCurriculumState({
    facilitatorId: 'facilitator',
    learnerId: 'learner',
    period: PERIOD,
    requirements,
    reports: [conceptReport('math:division', { mastery: 'mastered', comprehension: 'demonstrated' })],
    timelineItems: [],
    proposedForecastItems: [],
    lessonTargets: [],
    cutoffDate: '2026-09-28',
  })

  const context = buildCurriculumCandidateContext({
    activeRevision: activeRevision(),
    period: PERIOD,
    contractVersion: CONTRACT,
    requirements,
    goals: [],
    states,
    associations: [],
    requestedSubjects: ['Math'],
    today: '2026-09-24',
    targetWeekStart: '2026-09-28',
    noSchoolDates: [],
  })

  const division = context.subjects.math.candidates.find((candidate) => candidate.requirement_key === 'math:division')
  const geometry = context.subjects.math.candidates.find((candidate) => candidate.requirement_key === 'math:geometry')
  assert.equal(division.state.mastery, 'demonstrated')
  assert.equal(division.eligible, false)
  assert.equal(division.blocked_reason, 'mastery_demonstrated')
  assert.equal(geometry.eligible, true)
  assert.ok(context.subjects.math.eligible_requirement_keys.includes('math:geometry'))
})

test('unresolved mastery permits a second or third progressive exposure, then forces a branch', () => {
  const requirements = [requirement()]

  const twoPriorStates = projectCurriculumState({
    facilitatorId: 'facilitator',
    learnerId: 'learner',
    period: PERIOD,
    requirements,
    reports: [conceptReport('math:division')],
    timelineItems: [
      curriculumTimelineItem({ date: '2026-09-14' }),
      curriculumTimelineItem({ date: '2026-09-21', title: 'Division with Area Models', description: 'Use area models to connect division to place value.' }),
    ],
    proposedForecastItems: [],
    lessonTargets: [],
    cutoffDate: '2026-09-28',
  })

  const thirdExposureContext = buildCurriculumCandidateContext({
    activeRevision: activeRevision(),
    period: PERIOD,
    contractVersion: CONTRACT,
    requirements,
    goals: [],
    states: twoPriorStates,
    associations: [],
    requestedSubjects: ['Math'],
    today: '2026-09-24',
    targetWeekStart: '2026-09-28',
    noSchoolDates: [],
  })

  const third = thirdExposureContext.subjects.math.candidates[0]
  assert.equal(third.state.mastery, 'unresolved')
  assert.equal(third.state.consecutive_exposures, 2)
  assert.equal(third.eligible, true)
  assert.equal(third.decision_kind, 'recovery')

  const threePriorStates = projectCurriculumState({
    facilitatorId: 'facilitator',
    learnerId: 'learner',
    period: PERIOD,
    requirements,
    reports: [conceptReport('math:division')],
    timelineItems: [
      curriculumTimelineItem({ date: '2026-09-07' }),
      curriculumTimelineItem({ date: '2026-09-14', title: 'Division with Area Models', description: 'Use area models to connect division to place value.' }),
      curriculumTimelineItem({ date: '2026-09-21', title: 'Division on a Number Line', description: 'Use jumps on a number line to represent quotient and remainder.' }),
    ],
    proposedForecastItems: [],
    lessonTargets: [],
    cutoffDate: '2026-09-28',
  })

  const forcedBranchContext = buildCurriculumCandidateContext({
    activeRevision: activeRevision(),
    period: PERIOD,
    contractVersion: CONTRACT,
    requirements,
    goals: [],
    states: threePriorStates,
    associations: [],
    requestedSubjects: ['Math'],
    today: '2026-09-24',
    targetWeekStart: '2026-09-28',
    noSchoolDates: [],
  })

  const capped = forcedBranchContext.subjects.math.candidates[0]
  assert.equal(capped.state.consecutive_exposures, 3)
  assert.equal(capped.eligible, false)
  assert.equal(capped.blocked_reason, 'consecutive_exposure_cap')
  assert.deepEqual(forcedBranchContext.subjects.math.forced_branch_groups, ['math:division'])
})

test('curriculum forecast validation accepts a changed recovery lesson and rejects cosmetic repetition', () => {
  const candidate = {
    requirement_key: 'math:division',
    statement: 'Divide multi-digit whole numbers with remainders.',
    planning_group_key: 'math:division',
    decision_kind: 'recovery',
    must_learn: true,
    attention: 'normal',
    eligible: true,
    state: {
      coverage: 'developing',
      mastery: 'unresolved',
      retention: 'not_measured',
      consecutive_exposures: 1,
      recent_lessons: [{
        title: 'Division with Area Models',
        description: 'Use area models and place value to divide whole numbers with remainders.',
      }],
    },
    score: 100,
    reasons: ['independent mastery remains unresolved'],
    goal_reasons: [],
    unmet_prerequisite_keys: [],
    unlocks_requirement_keys: [],
  }
  const context = guidanceContext(candidate)

  const progressive = validateInstructionalForecastItems([{
    requirement_key: 'math:division',
    planning_move: 'continue',
    strand: 'number operations',
    planning_reason: 'Independent mastery remains unresolved, so change representation before branching.',
    instructional_change: 'Shift from area models to number-line representations of quotient and remainder.',
    title: 'Division on a Number Line',
    description: 'Represent quotient and remainder with repeated jumps and explain the relationship.',
  }], [{ subject: 'Math' }], context)
  assert.equal(progressive[0].requirement_key, 'math:division')

  assert.throws(() => validateInstructionalForecastItems([{
    requirement_key: 'math:division',
    planning_move: 'continue',
    strand: 'number operations',
    planning_reason: 'Independent mastery remains unresolved.',
    instructional_change: 'Keep using area models with only cosmetic wording changes.',
    title: 'Area Models for Division',
    description: 'Use place value and area models to divide whole numbers with remainders.',
  }], [{ subject: 'Math' }], context), /repeated the prior lesson/i)

  assert.throws(() => validateInstructionalForecastItems([{
    requirement_key: 'math:fractions',
    planning_move: 'continue',
    strand: 'number operations',
    planning_reason: 'Try another lesson.',
    title: 'Equivalent Fractions',
    description: 'Generate equivalent fractions.',
  }], [{ subject: 'Math' }], context), /outside the server-authorized candidate set/i)
})

test('the third curriculum exposure is visibly recorded in forecast metadata with a forced next branch', () => {
  const candidate = {
    requirement_key: 'math:division',
    statement: 'Divide multi-digit whole numbers with remainders.',
    planning_group_key: 'math:division',
    decision_kind: 'recovery',
    must_learn: true,
    attention: 'normal',
    eligible: true,
    state: {
      coverage: 'developing',
      mastery: 'unresolved',
      retention: 'not_measured',
      consecutive_exposures: 2,
      recent_lessons: [],
    },
    score: 100,
    reasons: ['independent mastery remains unresolved'],
    goal_reasons: [],
    unmet_prerequisite_keys: [],
    unlocks_requirement_keys: ['math:decimals'],
  }
  const curriculumGuidance = guidanceContext(candidate).curriculum_guidance
  const plan = {
    proposal_key: 'proposal-key',
    target_week_start: '2026-09-28',
    unfilled_slots: [{ planned_date: '2026-09-28', subject: 'Math', sort_order: 0 }],
    carry_suggestions: [],
    curriculum_guidance: curriculumGuidance,
  }
  const snapshot = buildLearningForecastSnapshot({
    activeRevision: activeRevision(),
    forecastItems: [],
    existingProposalItems: [],
    plan,
    generatedItems: [{
      requirement_key: 'math:division',
      planning_move: 'continue',
      strand: 'number operations',
      planning_reason: 'One final changed-approach recovery lesson is warranted.',
      instructional_change: 'Shift from prior representations to estimation and reasonableness checks.',
      exposure_number: 3,
      title: 'Division Through Estimation',
      description: 'Use estimation and reasonableness to solve and check division with remainders.',
    }],
    today: '2026-09-24',
  })

  const guidance = snapshot.additions[0].metadata.learning_forecast.curriculum_guidance
  assert.equal(guidance.requirement_key, 'math:division')
  assert.equal(guidance.exposure_number, 3)
  assert.match(guidance.next_policy, /Branch after this lesson/i)
  assert.equal(guidance.mastery_state_before, 'unresolved')
})

test('materialization generation requests preserve curriculum target identity', () => {
  const curriculumTargets = {
    version: 1,
    periodId: PERIOD.id,
    contractVersionId: CONTRACT.id,
    primaryRequirement: {
      key: 'math:division',
      statement: 'Divide multi-digit whole numbers with remainders.',
      planningGroupKey: 'math:division',
    },
    supportingRequirementKeys: [],
    decisionKind: 'new_required',
  }
  const normalized = normalizeGenerationRequest({
    mode: 'structured',
    title: 'Division with Remainders',
    subject: 'Math',
    difficulty: 'Intermediate',
    grade: '4th',
    description: 'Learn division with remainders.',
    notes: '',
    vocab: '',
    curriculumTargets,
  })

  assert.equal(normalized.ok, true)
  assert.equal(normalized.request.curriculumTargets.primaryRequirement.key, 'math:division')
  assert.equal(normalized.request.curriculumTargets.contractVersionId, CONTRACT.id)
  assert.equal(
    deriveConceptId({ conceptId: normalized.request.curriculumTargets.primaryRequirement.key }),
    'concept:item-identity-v1:math:division',
  )
})

test('Curriculum Guidance supplies editable starter recommendations when no imported framework is available', async () => {
  const repository = {
    async findActiveCurriculumPeriod() { return null },
    async findNextCurriculumPeriod() { return null },
    async findLatestCurriculumPeriod() { return null },
    async listCurriculumFrameworkItems() { return [] },
    async listCurriculumPlanningDecisions() { return [] },
  }

  const bundle = await loadCurriculumGuidanceBundle({
    repository,
    facilitatorId: 'facilitator',
    learnerId: 'learner',
    learnerGrade: '4',
    subjects: ['Math', 'Science'],
    today: '2026-09-24',
  })

  assert.equal(bundle.period, null)
  assert.ok(bundle.recommendations.length >= 10)
  assert.ok(bundle.recommendations.some((item) => item.subject === 'Math' && item.recommendation_kind === 'ms_sonoma'))
  assert.ok(bundle.recommendations.some((item) => item.subject === 'Science' && item.recommendation_kind === 'ms_sonoma'))
  assert.ok(bundle.recommendations.every((item) => item.framework_id === null))
})

test('Curriculum Guidance can reopen an approved upcoming period before it becomes current', async () => {
  const currentPeriod = {
    ...PERIOD,
    id: 'period-current',
    starts_on: '2026-09-01',
    ends_on: '2026-10-31',
    status: 'active',
    active_contract_version_id: 'contract-current',
  }
  const futurePeriod = {
    ...PERIOD,
    id: 'period-future',
    label: 'Winter 2026',
    starts_on: '2026-11-01',
    ends_on: '2026-12-31',
    status: 'active',
    active_contract_version_id: 'contract-future',
  }
  const versions = {
    'contract-current': {
      id: 'contract-current',
      period_id: currentPeriod.id,
      activated_at: '2026-09-01T12:00:00.000Z',
    },
    'contract-future': {
      id: 'contract-future',
      period_id: futurePeriod.id,
      activated_at: '2026-09-20T12:00:00.000Z',
    },
  }
  const items = {
    'contract-current': [requirement({ key: 'math:current', group: 'math:current' })],
    'contract-future': [requirement({ key: 'math:future', statement: 'Begin winter mathematics.', group: 'math:future' })],
  }
  let notifications = 0
  const repository = {
    async findActiveCurriculumPeriod() { return currentPeriod },
    async findNextCurriculumPeriod() { return futurePeriod },
    async findCurriculumPeriod(id) { return id === currentPeriod.id ? currentPeriod : id === futurePeriod.id ? futurePeriod : null },
    async findLatestCurriculumPeriod() { return futurePeriod },
    async findCurriculumContractVersion(id) { return versions[id] || null },
    async listCurriculumContractItems(id) { return items[id] || [] },
    async listCurriculumContractGoals() { return [] },
    async listLearnerCurriculumState() { return [] },
    async listCurriculumFrameworkItems() { return [] },
    async listCurriculumPlanningDecisions() { return [] },
    async ensureCurriculumReviewNotification() { notifications += 1 },
  }

  const bundle = await loadCurriculumGuidanceBundle({
    repository,
    facilitatorId: 'facilitator',
    learnerId: 'learner',
    learnerGrade: '4th',
    subjects: ['Math'],
    today: '2026-10-20',
    periodId: futurePeriod.id,
  })

  assert.equal(bundle.period.id, futurePeriod.id)
  assert.equal(bundle.current_period.id, currentPeriod.id)
  assert.equal(bundle.upcoming_period.id, futurePeriod.id)
  assert.equal(bundle.contract_version.id, 'contract-future')
  assert.equal(bundle.requirements[0].requirement_key, 'math:future')
  assert.equal(notifications, 0)
})

test('Forecast keeps the pinned contract for current dates and switches only to an approved future period for future dates', async () => {
  const currentPeriod = {
    ...PERIOD,
    id: 'period-current',
    starts_on: '2026-09-01',
    ends_on: '2026-10-31',
    active_contract_version_id: 'contract-current',
  }
  const futurePeriod = {
    ...PERIOD,
    id: 'period-future',
    label: 'Winter 2026',
    starts_on: '2026-11-01',
    ends_on: '2026-12-31',
    active_contract_version_id: 'contract-future',
  }
  const versions = {
    'contract-current': {
      id: 'contract-current',
      period_id: currentPeriod.id,
      period_label: currentPeriod.label,
      period_type: currentPeriod.period_type,
      period_start: currentPeriod.starts_on,
      period_end: currentPeriod.ends_on,
      activated_at: '2026-09-01T12:00:00.000Z',
    },
    'contract-future': {
      id: 'contract-future',
      period_id: futurePeriod.id,
      period_label: futurePeriod.label,
      period_type: futurePeriod.period_type,
      period_start: futurePeriod.starts_on,
      period_end: futurePeriod.ends_on,
      activated_at: '2026-09-20T12:00:00.000Z',
    },
  }
  const contractItems = {
    'contract-current': [requirement({ key: 'math:current', statement: 'Complete current-period mathematics.', group: 'math:current' })],
    'contract-future': [requirement({ key: 'math:future', statement: 'Begin future-period mathematics.', group: 'math:future' })],
  }
  const periods = [currentPeriod, futurePeriod]
  const repository = {
    async findCurriculumContractVersion(id) { return versions[id] || null },
    async findCurriculumPeriod(id) { return periods.find((row) => row.id === id) || null },
    async findActiveCurriculumPeriod(_facilitatorId, _learnerId, date) {
      return periods.find((row) => row.status !== 'draft' && row.starts_on <= date && date <= row.ends_on)
        || periods.find((row) => row.starts_on <= date && date <= row.ends_on)
        || null
    },
    async listCurriculumContractItems(id) { return contractItems[id] || [] },
    async listCurriculumContractGoals() { return [] },
    async listLessonCurriculumTargets() { return [] },
    async upsertLearnerCurriculumState() { return [] },
    async listCurriculumFrameworkAssociations() { return [] },
  }
  const active = {
    ...activeRevision(),
    curriculum_contract_version_id: 'contract-current',
    planning_policy: { curriculum_contract_version_id: 'contract-current' },
  }

  const current = await loadActiveCurriculumPlanningContext({
    repository,
    facilitatorId: 'facilitator',
    learnerId: 'learner',
    activeRevision: active,
    requestedSubjects: ['Math'],
    requestedSlots: [{ subject: 'Math', planned_date: '2026-10-26' }],
    today: '2026-09-24',
    targetWeekStart: '2026-10-26',
  })
  assert.equal(current.contract_version_id, 'contract-current')
  assert.ok(current.subjects.math.eligible_requirement_keys.includes('math:current'))

  const future = await loadActiveCurriculumPlanningContext({
    repository,
    facilitatorId: 'facilitator',
    learnerId: 'learner',
    activeRevision: active,
    requestedSubjects: ['Math'],
    requestedSlots: [{ subject: 'Math', planned_date: '2026-11-02' }],
    today: '2026-09-24',
    targetWeekStart: '2026-11-02',
  })
  assert.equal(future.contract_version_id, 'contract-future')
  assert.ok(future.subjects.math.eligible_requirement_keys.includes('math:future'))
})

test('Forecast blocks the first uncovered date when the curriculum contract expires without an approved next period', async () => {
  const currentPeriod = {
    ...PERIOD,
    id: 'period-current',
    ends_on: '2026-10-31',
    active_contract_version_id: 'contract-current',
  }
  const currentVersion = {
    id: 'contract-current',
    period_id: currentPeriod.id,
    period_label: currentPeriod.label,
    period_type: currentPeriod.period_type,
    period_start: currentPeriod.starts_on,
    period_end: currentPeriod.ends_on,
    activated_at: '2026-09-01T12:00:00.000Z',
  }
  const repository = {
    async findCurriculumContractVersion() { return currentVersion },
    async findCurriculumPeriod() { return currentPeriod },
    async findActiveCurriculumPeriod() { return null },
  }
  const result = await loadActiveCurriculumPlanningContext({
    repository,
    facilitatorId: 'facilitator',
    learnerId: 'learner',
    activeRevision: {
      ...activeRevision(),
      curriculum_contract_version_id: currentVersion.id,
      planning_policy: { curriculum_contract_version_id: currentVersion.id },
    },
    requestedSubjects: ['Math'],
    requestedSlots: [{ subject: 'Math', planned_date: '2026-11-02' }],
    today: '2026-09-24',
    targetWeekStart: '2026-11-02',
  })

  assert.equal(result.blocked, true)
  assert.equal(result.reason, 'period_out_of_range')
  assert.equal(result.blocked_date, '2026-11-02')
})

test('one unresolved result authorizes only the next same-territory continuation before new evidence', () => {
  const candidate = {
    requirement_key: 'math:division',
    statement: 'Divide multi-digit whole numbers with remainders.',
    planning_group_key: 'math:division',
    decision_kind: 'recovery',
    must_learn: true,
    attention: 'normal',
    eligible: true,
    state: {
      coverage: 'developing',
      mastery: 'unresolved',
      retention: 'not_measured',
      consecutive_exposures: 1,
      recent_lessons: [],
    },
    score: 100,
    reasons: ['independent mastery remains unresolved'],
    goal_reasons: [],
    unmet_prerequisite_keys: [],
    unlocks_requirement_keys: [],
  }
  const context = guidanceContext(candidate)

  const next = validateInstructionalForecastItems([{
    requirement_key: 'math:division',
    planning_move: 'continue',
    strand: 'number operations',
    planning_reason: 'Independent mastery remains unresolved.',
    instructional_change: 'Shift from area models to partial quotients.',
    title: 'Division With Partial Quotients',
    description: 'Use partial quotients to solve multi-digit division.',
  }], [{ subject: 'Math' }], context)
  assert.equal(next[0].exposure_number, 2)

  assert.throws(() => validateInstructionalForecastItems([
    {
      requirement_key: 'math:division',
      planning_move: 'continue',
      strand: 'number operations',
      planning_reason: 'Independent mastery remains unresolved.',
      instructional_change: 'Shift from area models to partial quotients.',
      title: 'Division With Partial Quotients',
      description: 'Use partial quotients to solve multi-digit division.',
    },
    {
      requirement_key: 'math:division',
      planning_move: 'continue',
      strand: 'number operations',
      planning_reason: 'Continue unresolved division work.',
      instructional_change: 'Shift from partial quotients to remainder applications.',
      title: 'Remainders in Context',
      description: 'Interpret remainders in real-world grouping problems.',
    },
  ], [{ subject: 'Math' }, { subject: 'Math' }], context), /before new learner evidence/i)
})

test('the third exposure is allowed after fresh unresolved evidence, while a fourth is rejected', () => {
  const thirdCandidate = {
    requirement_key: 'math:division',
    statement: 'Divide multi-digit whole numbers with remainders.',
    planning_group_key: 'math:division',
    decision_kind: 'recovery',
    must_learn: true,
    attention: 'normal',
    eligible: true,
    state: {
      coverage: 'developing',
      mastery: 'unresolved',
      retention: 'not_measured',
      consecutive_exposures: 2,
      recent_lessons: [],
    },
    score: 100,
    reasons: ['independent mastery remains unresolved'],
    goal_reasons: [],
    unmet_prerequisite_keys: [],
    unlocks_requirement_keys: [],
  }
  const valid = validateInstructionalForecastItems([{
    requirement_key: 'math:division',
    planning_move: 'continue',
    strand: 'number operations',
    planning_reason: 'The second lesson still left independent mastery unresolved.',
    instructional_change: 'Shift to interpreting remainders inside multi-step word problems.',
    title: 'Interpreting Division Remainders',
    description: 'Use word problems to explain what a division remainder means.',
  }], [{ subject: 'Math' }], guidanceContext(thirdCandidate))
  assert.equal(valid[0].exposure_number, 3)

  const cappedCandidate = {
    ...thirdCandidate,
    state: { ...thirdCandidate.state, consecutive_exposures: 3 },
  }
  assert.throws(() => validateInstructionalForecastItems([{
    requirement_key: 'math:division',
    planning_move: 'continue',
    strand: 'number operations',
    planning_reason: 'Keep going.',
    instructional_change: 'Try a fourth representation.',
    title: 'More Division',
    description: 'Continue division.',
  }], [{ subject: 'Math' }], guidanceContext(cappedCandidate)), /exposure cap/i)
})

test('instructional forecast generation retries once after deterministic curriculum validation rejects the first result', async () => {
  const candidate = {
    requirement_key: 'math:division',
    statement: 'Divide multi-digit whole numbers with remainders.',
    planning_group_key: 'math:division',
    decision_kind: 'recovery',
    must_learn: true,
    attention: 'normal',
    eligible: true,
    state: {
      coverage: 'developing',
      mastery: 'unresolved',
      retention: 'not_measured',
      consecutive_exposures: 1,
      recent_lessons: [],
    },
    score: 100,
    reasons: ['independent mastery remains unresolved'],
    goal_reasons: [],
    unmet_prerequisite_keys: [],
    unlocks_requirement_keys: [],
  }
  const priorKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'offline-test'
  let calls = 0
  let retryPayload = null

  try {
    const result = await generateInstructionalForecastItems({
      slots: [{ subject: 'Math' }],
      context: {
        ...guidanceContext(candidate),
        learner: { grade: '4th' },
        evidence_summaries: [],
      },
      fetchImpl: async (_url, init) => {
        calls += 1
        const body = JSON.parse(init.body)
        if (calls === 2) retryPayload = JSON.parse(body.messages[1].content)
        const item = calls === 1
          ? {
              requirement_key: 'math:division',
              planning_move: 'continue',
              strand: 'number operations',
              planning_reason: 'Mastery remains unresolved.',
              instructional_change: '',
              title: 'Division Follow-up',
              description: 'Continue division.',
            }
          : {
              requirement_key: 'math:division',
              planning_move: 'continue',
              strand: 'number operations',
              planning_reason: 'Mastery remains unresolved.',
              instructional_change: 'Shift from area models to partial quotients.',
              title: 'Division With Partial Quotients',
              description: 'Use partial quotients to solve multi-digit division.',
            }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ items: [item] }) } }],
          }),
        }
      },
    })

    assert.equal(calls, 2)
    assert.match(retryPayload.server_validation_feedback, /instructional approach/i)
    assert.equal(result[0].instructional_change, 'Shift from area models to partial quotients.')
  } finally {
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = priorKey
  }
})

test('future Forecast proposal pins the approved future curriculum contract without changing the active revision object', () => {
  const active = {
    ...activeRevision(),
    planning_policy: { curriculum_contract_version_id: 'contract-current' },
  }
  const futureGuidance = {
    ...guidanceContext({
      requirement_key: 'math:future',
      statement: 'Begin future-period mathematics.',
      planning_group_key: 'math:future',
      decision_kind: 'new_required',
      must_learn: true,
      attention: 'normal',
      eligible: true,
      state: {
        coverage: 'not_started',
        mastery: 'not_measured',
        retention: 'not_measured',
        consecutive_exposures: 0,
        recent_lessons: [],
      },
      score: 80,
      reasons: ['requirement has not yet been introduced'],
      goal_reasons: [],
      unmet_prerequisite_keys: [],
      unlocks_requirement_keys: [],
    }).curriculum_guidance,
    contract_version_id: 'contract-future',
  }
  futureGuidance.period = {
    ...futureGuidance.period,
    label: 'Winter 2026',
    starts_on: '2026-11-01',
    ends_on: '2026-12-31',
  }
  futureGuidance.subjects.math.eligible_requirement_keys = ['math:future']

  const plan = {
    proposal_key: 'future-proposal',
    target_week_start: '2026-11-02',
    unfilled_slots: [{ planned_date: '2026-11-02', subject: 'Math', sort_order: 0 }],
    carry_suggestions: [],
    curriculum_guidance: futureGuidance,
  }

  const built = buildLearningForecastSnapshot({
    activeRevision: active,
    plan,
    generatedItems: [{
      requirement_key: 'math:future',
      planning_move: 'branch',
      strand: 'number operations',
      planning_reason: '',
      instructional_change: '',
      exposure_number: 1,
      title: 'Future Mathematics',
      description: 'Begin the approved future-period mathematics requirement.',
    }],
    today: '2026-09-24',
  })

  assert.equal(active.planning_policy.curriculum_contract_version_id, 'contract-current')
  assert.equal(built.snapshot.planning_policy.curriculum_contract_version_id, 'contract-future')
  assert.equal(built.snapshot.planning_policy.curriculum_guidance_version, 1)
})

test('a subject with no remaining contract requirement may branch without inventing a requirement id', () => {
  const candidate = {
    requirement_key: 'math:division',
    statement: 'Divide multi-digit whole numbers with remainders.',
    planning_group_key: 'math:division',
    decision_kind: 'new_required',
    must_learn: true,
    attention: 'normal',
    eligible: false,
    state: {
      coverage: 'covered',
      mastery: 'demonstrated',
      retention: 'not_measured',
      consecutive_exposures: 0,
      recent_lessons: [],
    },
    score: -50,
    reasons: ['recent mastery demonstrated; immediate repetition is suppressed'],
    goal_reasons: [],
    unmet_prerequisite_keys: [],
    unlocks_requirement_keys: [],
  }
  const context = guidanceContext(candidate)
  context.curriculum_guidance.subjects.math.required_remaining = 0

  const result = validateInstructionalForecastItems([{
    requirement_key: null,
    planning_move: 'branch',
    strand: 'geometry and spatial reasoning',
    planning_reason: '',
    instructional_change: '',
    title: 'Classifying Quadrilaterals',
    description: 'Compare quadrilaterals by sides, angles, and parallel lines.',
  }], [{ subject: 'Math' }], context)

  assert.equal(result[0].requirement_key, null)
  assert.equal(result[0].planning_group_key, null)
})
