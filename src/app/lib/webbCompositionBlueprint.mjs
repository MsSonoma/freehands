export const WEBB_BLUEPRINT_VERSION = 'webb-blueprint-v1'

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max)
}

function cleanUnit(raw, index) {
  return {
    id: clean(raw?.id || `body-${index + 1}`, 100),
    objective: clean(raw?.objective, 600),
    clue: clean(raw?.clue ?? raw?.atomic_focus, 100),
    rhetoricalJob: clean(raw?.rhetoricalJob ?? raw?.rhetorical_job, 320),
    connection: clean(raw?.connection ?? raw?.connection_from_previous, 500),
  }
}

export function normalizeWebbCompositionBlueprint(raw = {}) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const units = Array.isArray(input.bodyUnits)
    ? input.bodyUnits
    : (Array.isArray(input.body_units) ? input.body_units : [])
  return {
    blueprintVersion: WEBB_BLUEPRINT_VERSION,
    controllingIdea: clean(input.controllingIdea ?? input.controlling_idea, 700),
    discourseMode: clean(input.discourseMode ?? input.discourse_mode, 100).toLowerCase(),
    closingGoal: clean(input.closingGoal ?? input.closing_goal, 500),
    bodyUnits: units.map(cleanUnit),
  }
}

function genericConnection(value) {
  const text = clean(value).toLowerCase()
  return !text
    || /\b(?:next objective|next goal|comes next|is next|objective order|goal order)\b/.test(text)
    || /^continues? (?:the )?(?:essay|paragraph|body)(?: in order)?\.?$/.test(text)
}

export function webbCompositionBlueprintViolations(raw = {}) {
  const blueprint = normalizeWebbCompositionBlueprint(raw)
  const violations = []
  if (!blueprint.controllingIdea) violations.push('missing controlling idea')
  if (!blueprint.discourseMode) violations.push('missing discourse mode')
  if (!blueprint.closingGoal) violations.push('missing closing goal')
  if (blueprint.bodyUnits.length < 5 || blueprint.bodyUnits.length > 8) {
    violations.push('blueprint must contain 5 to 8 body units')
  }

  const seenIds = new Set()
  const seenObjectives = new Set()
  blueprint.bodyUnits.forEach((unit, index) => {
    if (!unit.id || seenIds.has(unit.id)) violations.push(`body unit ${index + 1} has a missing or duplicate id`)
    seenIds.add(unit.id)
    if (!unit.objective) violations.push(`body unit ${index + 1} is missing an objective`)
    if (!unit.clue) violations.push(`body unit ${index + 1} is missing a learner clue`)
    if (!unit.rhetoricalJob) violations.push(`body unit ${index + 1} is missing a rhetorical job`)
    if (genericConnection(unit.connection)) violations.push(`body unit ${index + 1} is missing a meaningful rhetorical connection`)
    const objectiveKey = unit.objective.toLowerCase()
    if (objectiveKey && seenObjectives.has(objectiveKey)) violations.push(`body unit ${index + 1} duplicates an objective`)
    if (objectiveKey) seenObjectives.add(objectiveKey)
  })
  return [...new Set(violations)]
}

export function objectivesFromWebbBlueprint(raw = {}) {
  return normalizeWebbCompositionBlueprint(raw).bodyUnits.map(unit => unit.objective)
}

export function cluesFromWebbBlueprint(raw = {}) {
  return normalizeWebbCompositionBlueprint(raw).bodyUnits.map(unit => unit.clue)
}

export function blueprintMatchesObjectives(raw = {}, objectives = []) {
  const blueprint = normalizeWebbCompositionBlueprint(raw)
  const list = Array.isArray(objectives) ? objectives.map(value => clean(value, 600)).filter(Boolean) : []
  if (blueprint.bodyUnits.length !== list.length) return false
  return blueprint.bodyUnits.every((unit, index) => unit.objective === list[index])
}
