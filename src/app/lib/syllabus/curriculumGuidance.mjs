export const CURRICULUM_GUIDANCE_SCHEMA_VERSION = 1

export const CURRICULUM_PERIOD_TYPES = Object.freeze([
  'semester',
  'quarter',
  'school_year',
  'custom',
])

export const CURRICULUM_ATTENTION_LEVELS = Object.freeze([
  'more',
  'normal',
  'minimum',
])

export const CURRICULUM_GOAL_PRIORITIES = Object.freeze([
  'high',
  'normal',
  'low',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function clean(value, max = Infinity) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function isCalendarDate(value) {
  const match = DATE.exec(clean(value, 10))
  if (!match) return false
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return parsed.getUTCFullYear() === Number(match[1])
    && parsed.getUTCMonth() === Number(match[2]) - 1
    && parsed.getUTCDate() === Number(match[3])
}

function normalizeKey(value, label) {
  const key = clean(value, 240)
  if (!key) throw new Error(`${label} is required`)
  if (!/^[A-Za-z0-9._:/-]+$/.test(key)) throw new Error(`${label} contains unsupported characters`)
  return key
}

function normalizeMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {}
}

export function normalizeCurriculumRequirement(input = {}, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`requirements[${index}] must be an object`)
  const frameworkItemId = clean(input.framework_item_id, 80)
  if (frameworkItemId && !UUID.test(frameworkItemId)) throw new Error(`requirements[${index}].framework_item_id is invalid`)
  const fallbackKey = frameworkItemId ? `framework:${frameworkItemId}` : ''
  const requirementKey = normalizeKey(input.requirement_key || fallbackKey, `requirements[${index}].requirement_key`)
  const subject = clean(input.subject, 120)
  const statement = clean(input.statement, 2000)
  if (!subject) throw new Error(`requirements[${index}].subject is required`)
  if (!statement) throw new Error(`requirements[${index}].statement is required`)
  const attention = clean(input.attention || 'normal', 40).toLocaleLowerCase()
  if (!CURRICULUM_ATTENTION_LEVELS.includes(attention)) throw new Error(`requirements[${index}].attention is invalid`)
  const targetDate = clean(input.target_date, 10)
  if (targetDate && !isCalendarDate(targetDate)) throw new Error(`requirements[${index}].target_date is invalid`)
  const sourceKind = clean(input.source_kind || (frameworkItemId ? 'framework' : 'facilitator'), 40).toLocaleLowerCase()
  if (!['framework', 'facilitator', 'migrated'].includes(sourceKind)) throw new Error(`requirements[${index}].source_kind is invalid`)
  const planningGroupKey = normalizeKey(input.planning_group_key || requirementKey, `requirements[${index}].planning_group_key`)
  return {
    requirement_key: requirementKey,
    framework_item_id: frameworkItemId || null,
    subject,
    statement,
    must_learn: input.must_learn !== false,
    attention,
    target_date: targetDate || null,
    planning_group_key: planningGroupKey,
    source_kind: sourceKind,
    sort_order: Number.isInteger(input.sort_order) ? input.sort_order : index,
    metadata: normalizeMetadata(input.metadata),
  }
}

export function normalizeCurriculumGoal(input = {}, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`goals[${index}] must be an object`)
  const goalKey = normalizeKey(input.goal_key, `goals[${index}].goal_key`)
  const title = clean(input.title, 1000)
  if (!title) throw new Error(`goals[${index}].title is required`)
  const priority = clean(input.priority || 'normal', 40).toLocaleLowerCase()
  if (!CURRICULUM_GOAL_PRIORITIES.includes(priority)) throw new Error(`goals[${index}].priority is invalid`)
  const linkedRequirementKeys = Array.isArray(input.linked_requirement_keys)
    ? [...new Set(input.linked_requirement_keys.map((value) => clean(value, 240)).filter(Boolean))].slice(0, 100)
    : []
  return {
    goal_key: goalKey,
    title,
    subject: clean(input.subject, 120) || null,
    priority,
    linked_requirement_keys: linkedRequirementKeys,
    notes: clean(input.notes, 2000) || null,
    sort_order: Number.isInteger(input.sort_order) ? input.sort_order : index,
  }
}

export function validateCurriculumGuidanceInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Curriculum Guidance payload must be an object')
  const rawPeriod = input.period
  if (!rawPeriod || typeof rawPeriod !== 'object' || Array.isArray(rawPeriod)) throw new Error('A planning period is required')
  const label = clean(rawPeriod.label, 200)
  const periodType = clean(rawPeriod.period_type || rawPeriod.type || 'custom', 40).toLocaleLowerCase()
  const startsOn = clean(rawPeriod.starts_on || rawPeriod.start, 10)
  const endsOn = clean(rawPeriod.ends_on || rawPeriod.end, 10)
  if (!label) throw new Error('Planning period label is required')
  if (!CURRICULUM_PERIOD_TYPES.includes(periodType)) throw new Error('Planning period type is invalid')
  if (!isCalendarDate(startsOn) || !isCalendarDate(endsOn) || endsOn < startsOn) throw new Error('Planning period dates are invalid')

  const rawRequirements = Array.isArray(input.requirements) ? input.requirements : []
  if (rawRequirements.length > 500) throw new Error('A curriculum period may contain at most 500 requirements')
  const requirements = rawRequirements.map(normalizeCurriculumRequirement)
  const requirementKeys = new Set()
  for (const requirement of requirements) {
    if (requirementKeys.has(requirement.requirement_key)) throw new Error(`Duplicate requirement key: ${requirement.requirement_key}`)
    requirementKeys.add(requirement.requirement_key)
    if (requirement.target_date && (requirement.target_date < startsOn || requirement.target_date > endsOn)) {
      throw new Error(`Requirement target date must fall inside the planning period: ${requirement.statement}`)
    }
  }

  const rawGoals = Array.isArray(input.goals) ? input.goals : []
  if (rawGoals.length > 100) throw new Error('A curriculum period may contain at most 100 personal goals')
  const goals = rawGoals.map(normalizeCurriculumGoal)
  const goalKeys = new Set()
  for (const goal of goals) {
    if (goalKeys.has(goal.goal_key)) throw new Error(`Duplicate goal key: ${goal.goal_key}`)
    goalKeys.add(goal.goal_key)
    goal.linked_requirement_keys = goal.linked_requirement_keys.filter((key) => requirementKeys.has(key))
  }

  const expectedActiveVersionId = clean(input.expected_active_version_id || input.expectedActiveVersionId, 80)
  if (expectedActiveVersionId && !UUID.test(expectedActiveVersionId)) throw new Error('expected_active_version_id is invalid')

  const periodId = clean(rawPeriod.id, 80)
  if (periodId && !UUID.test(periodId)) throw new Error('Planning period id is invalid')

  return {
    schema_version: CURRICULUM_GUIDANCE_SCHEMA_VERSION,
    period: {
      id: periodId || null,
      label,
      period_type: periodType,
      starts_on: startsOn,
      ends_on: endsOn,
    },
    expected_active_version_id: expectedActiveVersionId || null,
    requirements,
    goals,
    change_reason: clean(input.change_reason, 1000) || null,
  }
}

export function curriculumGuidanceCounts(requirements = [], stateRows = []) {
  const stateByKey = new Map((stateRows || []).map((row) => [String(row.requirement_key || ''), row]))
  const totals = {
    total: requirements.length,
    required: 0,
    demonstrated: 0,
    unresolved: 0,
    developing: 0,
    not_started: 0,
  }
  for (const requirement of requirements) {
    if (requirement.must_learn !== false) totals.required += 1
    const state = stateByKey.get(requirement.requirement_key)
    if (state?.mastery_state === 'demonstrated') totals.demonstrated += 1
    else if (state?.mastery_state === 'unresolved') totals.unresolved += 1
    else if (state?.coverage_state === 'not_started' || !state) totals.not_started += 1
    else totals.developing += 1
  }
  return totals
}

export function curriculumRequirementLabel(requirement) {
  return clean(requirement?.statement, 2000) || clean(requirement?.requirement_key, 240) || 'Requirement'
}
