export const LIFTOFF_PROTOCOL_VERSION = 'liftoff-instruction-v2'
export const LIFTOFF_SNAPSHOT_KIND = 'slate-liftoff-v1'
export const LIFTOFF_QUESTION_DEMAND_VERSION = 'question-demand-v1'

export const LIFTOFF_EVIDENCE_STATES = Object.freeze({
  UNOBSERVED: 'unobserved',
  SUPPORTED: 'supported',
  EMERGING: 'emerging',
  INDEPENDENT: 'independent',
  UNSTABLE: 'unstable',
  RETAINED: 'retained',
})

export const LIFTOFF_ACTION_TYPES = Object.freeze([
  'model',
  'probe',
  'isolate',
  'teach',
  'reprobe',
  'integrate',
  'release',
])

export const LIFTOFF_DIAGNOSTIC_CATEGORIES = Object.freeze([
  'success',
  'selection_error',
  'execution_error',
  'sequencing_error',
  'representation_error',
  'retrieval_failure',
  'integration_failure',
  'transfer_failure',
  'retention_failure',
  'possible_slip',
  'unknown',
])

const EVIDENCE = new Set(Object.values(LIFTOFF_EVIDENCE_STATES))
const ACTIONS = new Set(LIFTOFF_ACTION_TYPES)
const DIAGNOSTICS = new Set(LIFTOFF_DIAGNOSTIC_CATEGORIES)

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function stableContractId({ instanceKey = '', targetComponentId = '', criterion = '' } = {}) {
  const source = [instanceKey, targetComponentId, criterion]
    .map(value => clean(value, 1200).toLowerCase())
    .join('|')
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619)
  }
  return `question-demand-${(hash >>> 0).toString(36)}`
}

export function normalizeLiftoffResponseContract(raw = {}, { instanceKey = '' } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const targetComponentId = clean(raw.targetComponentId, 80)
  const demandType = clean(raw.demandType, 80).toLowerCase()
  const criterion = clean(raw.criterion, 800)
  if (!targetComponentId || !demandType || !criterion) return null
  return {
    version: LIFTOFF_QUESTION_DEMAND_VERSION,
    contractId: clean(raw.contractId, 160) || stableContractId({ instanceKey, targetComponentId, criterion }),
    targetComponentId,
    demandType,
    criterion,
  }
}

export function liftoffProblemFingerprint(value) {
  return clean(value, 1200).toLowerCase().replace(/\s+/g, ' ').trim()
}

export function normalizeLiftoffProblem(raw = {}) {
  const prompt = clean(raw?.prompt, 1200)
  const instanceKey = clean(raw?.instanceKey, 240).toLowerCase()
  if (!prompt) return null
  const problem = { prompt, instanceKey: instanceKey || null, fingerprint: liftoffProblemFingerprint(prompt) }
  const responseContract = normalizeLiftoffResponseContract(raw?.responseContract, { instanceKey })
  if (responseContract) problem.responseContract = responseContract
  if (Object.prototype.hasOwnProperty.call(raw || {}, 'math')) {
    problem.math = normalizeMathActivity(raw.math)
    problem.mathFingerprint = JSON.stringify({ operation: problem.math.operation, operands: problem.math.operands })
  }
  return problem
}

export function isLiftoffProblemFresh(problem, priorProblems = []) {
  const normalized = normalizeLiftoffProblem(problem)
  if (!normalized) return false
  return !(Array.isArray(priorProblems) ? priorProblems : []).some((prior) => {
    const candidate = normalizeLiftoffProblem(prior)
    if (!candidate) return false
    if (normalized.instanceKey && candidate.instanceKey && normalized.instanceKey === candidate.instanceKey) return true
    if (normalized.mathFingerprint && candidate.mathFingerprint && normalized.mathFingerprint === candidate.mathFingerprint) return true
    return Boolean(normalized.fingerprint && candidate.fingerprint && normalized.fingerprint === candidate.fingerprint)
  })
}
function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, 120)).filter(Boolean))]
}

function normalizeImportance(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(1, Math.min(5, Math.round(n))) : 3
}

export function normalizeLiftoffComponentMap(raw = []) {
  const source = Array.isArray(raw) ? raw : []
  const ids = new Set()
  const components = []
  for (let index = 0; index < source.length; index += 1) {
    const row = source[index] || {}
    let id = clean(row.id, 80) || `component-${index + 1}`
    if (ids.has(id)) id = `${id}-${index + 1}`
    ids.add(id)
    components.push({
      id,
      name: clean(row.name, 160) || `Component ${index + 1}`,
      description: clean(row.description, 500),
      dependencies: unique(row.dependencies),
      importance: normalizeImportance(row.importance),
      essential: row.essential !== false,
      evidenceState: LIFTOFF_EVIDENCE_STATES.UNOBSERVED,
      lastDiagnostic: null,
      lastEvidence: null,
      revealedToLearner: false,
    })
  }
  const validIds = new Set(components.map((component) => component.id))
  return components.map((component) => ({
    ...component,
    dependencies: component.dependencies.filter((id) => validIds.has(id) && id !== component.id),
  }))
}

export function normalizeLiftoffAction(raw = {}, componentIds = []) {
  const validIds = new Set(componentIds)
  const type = ACTIONS.has(raw?.type) ? raw.type : 'probe'
  const filterIds = (values) => unique(values).filter((id) => validIds.has(id))
  return {
    type,
    targetComponentIds: filterIds(raw?.targetComponentIds),
    withheldComponentIds: filterIds(raw?.withheldComponentIds),
    supportedComponentIds: filterIds(raw?.supportedComponentIds),
    problem: normalizeLiftoffProblem(raw?.problem),
    reason: clean(raw?.reason, 600),
  }
}

export function createLiftoffState(componentMap = [], initialAction = {}, { priorProblems = [] } = {}) {
  const components = normalizeLiftoffComponentMap(componentMap)
  const problemHistory = (Array.isArray(priorProblems) ? priorProblems : []).map(normalizeLiftoffProblem).filter(Boolean)
  const currentAction = normalizeLiftoffAction(initialAction, components.map((component) => component.id))
  if (currentAction.problem) currentAction.problem.fresh = isLiftoffProblemFresh(currentAction.problem, problemHistory)
  return {
    protocolVersion: LIFTOFF_PROTOCOL_VERSION,
    components,
    currentAction,
    problemHistory,
    trace: [],
    integrationConfirmed: false,
    variationConfirmed: false,
    procedureReleased: false,
    turnNumber: 0,
  }
}

function nextEvidenceState(previous, observation = {}) {
  const result = clean(observation.result, 80).toLowerCase()
  const independent = observation.independent === true
  const varied = observation.varied === true
  const integrated = observation.integrated === true

  if (result === 'possible_slip') {
    return previous === LIFTOFF_EVIDENCE_STATES.INDEPENDENT
      ? LIFTOFF_EVIDENCE_STATES.INDEPENDENT
      : previous
  }

  if (result === 'failure') {
    return previous === LIFTOFF_EVIDENCE_STATES.INDEPENDENT
      ? LIFTOFF_EVIDENCE_STATES.UNSTABLE
      : previous
  }

  if (result === 'supported_success' || !independent) {
    if (previous === LIFTOFF_EVIDENCE_STATES.INDEPENDENT) return previous
    return LIFTOFF_EVIDENCE_STATES.SUPPORTED
  }

  if (result === 'independent_success') {
    if (varied || integrated) return LIFTOFF_EVIDENCE_STATES.INDEPENDENT
    return previous === LIFTOFF_EVIDENCE_STATES.UNSTABLE
      ? LIFTOFF_EVIDENCE_STATES.EMERGING
      : LIFTOFF_EVIDENCE_STATES.EMERGING
  }

  return EVIDENCE.has(previous) ? previous : LIFTOFF_EVIDENCE_STATES.UNOBSERVED
}

export function liftoffReleaseReady(state) {
  const essential = (state?.components || []).filter((component) => component.essential !== false)
  if (!essential.length) return false
  const componentsIndependent = essential.every((component) => [LIFTOFF_EVIDENCE_STATES.INDEPENDENT, LIFTOFF_EVIDENCE_STATES.RETAINED].includes(component.evidenceState))
  return componentsIndependent && state?.integrationConfirmed === true && state?.variationConfirmed === true
}

export function applyLiftoffTurn(state, rawTurn = {}) {
  const previous = state || createLiftoffState([])
  const byId = new Map((previous.components || []).map((component) => [component.id, { ...component }]))
  const observations = (Array.isArray(rawTurn?.observations) ? rawTurn.observations : []).filter((observation) => {
    if (rawTurn?.evidenceValidated === true) return observation?.accepted === true
    const result = clean(observation?.result, 80).toLowerCase()
    if (previous?.protocolVersion === LIFTOFF_PROTOCOL_VERSION && ['failure', 'possible_slip'].includes(result)) {
      return observation?.accepted === true
    }
    return true
  })
  const priorProblemHistory = (Array.isArray(previous.problemHistory) ? previous.problemHistory : []).map((problem) => ({ ...problem }))
  const currentProblem = normalizeLiftoffProblem(previous.currentAction?.problem)
  const currentProblemFresh = currentProblem ? isLiftoffProblemFresh(currentProblem, priorProblemHistory) : null
  const effectiveObservations = observations.map((observation) => ({
    ...observation,
    varied: observation?.varied === true && currentProblemFresh !== false,
  }))

  for (const observation of effectiveObservations) {
    const id = clean(observation?.componentId, 80)
    const component = byId.get(id)
    if (!component) continue
    const diagnostic = DIAGNOSTICS.has(observation?.diagnostic)
      ? observation.diagnostic
      : (DIAGNOSTICS.has(rawTurn?.diagnosis?.category) ? rawTurn.diagnosis.category : 'unknown')
    const previousEvidenceState = component.evidenceState
    component.evidenceState = nextEvidenceState(component.evidenceState, observation)
    component.revealedToLearner = component.revealedToLearner === true
      || ['independent', 'retained'].includes(previousEvidenceState)
      || ['independent', 'retained'].includes(component.evidenceState)
    component.lastDiagnostic = diagnostic
    component.lastEvidence = {
      result: clean(observation?.result, 80),
      independent: observation?.independent === true,
      varied: observation?.varied === true,
      integrated: observation?.integrated === true,
      supportLevel: clean(observation?.supportLevel, 80) || null,
      basis: clean(observation?.basis, 80) || null,
      contractId: clean(observation?.contractId, 160) || null,
      responseQuote: clean(observation?.responseQuote, 500) || null,
    }
  }

  const problemHistory = [...priorProblemHistory]
  if (currentProblem) {
    const alreadyRecorded = problemHistory.some((problem) => !isLiftoffProblemFresh(currentProblem, [problem]))
    if (!alreadyRecorded) problemHistory.push({ ...currentProblem, turn: Number(previous.turnNumber || 0) })
  }

  const components = [...byId.values()]
  const currentAction = normalizeLiftoffAction(rawTurn?.nextAction, components.map((component) => component.id))
  if (currentAction.problem) currentAction.problem.fresh = isLiftoffProblemFresh(currentAction.problem, problemHistory)
  const next = {
    ...previous,
    components,
    currentAction,
    problemHistory: problemHistory.slice(-40),
    integrationConfirmed: previous.integrationConfirmed === true || rawTurn?.integrationEvidence === true,
    variationConfirmed: previous.variationConfirmed === true || (rawTurn?.variationEvidence === true && currentProblemFresh !== false),
    turnNumber: Number(previous.turnNumber || 0) + 1,
  }

  const requestedRelease = rawTurn?.sessionDecision === 'procedure_released' || next.currentAction.type === 'release'
  next.procedureReleased = requestedRelease && liftoffReleaseReady(next)
  next.trace = [
    ...(Array.isArray(previous.trace) ? previous.trace : []),
    {
      turn: next.turnNumber,
      diagnosis: DIAGNOSTICS.has(rawTurn?.diagnosis?.category) ? rawTurn.diagnosis.category : 'unknown',
      evidence: clean(rawTurn?.diagnosis?.evidence, 600),
      answeredProblem: currentProblem ? { ...currentProblem, fresh: currentProblemFresh } : null,
      action: next.currentAction,
      observations: effectiveObservations.map((observation) => ({
        componentId: clean(observation?.componentId, 80),
        result: clean(observation?.result, 80),
        independent: observation?.independent === true,
        varied: observation?.varied === true,
        integrated: observation?.integrated === true,
        basis: clean(observation?.basis, 80) || null,
        contractId: clean(observation?.contractId, 160) || null,
        responseQuote: clean(observation?.responseQuote, 500) || null,
        criterion: clean(observation?.criterion, 800) || null,
        contradiction: clean(observation?.contradiction, 800) || null,
      })),
      demandJudgment: rawTurn?.demandJudgment && typeof rawTurn.demandJudgment === 'object'
        ? {
            contractId: clean(rawTurn.demandJudgment.contractId, 160) || null,
            status: clean(rawTurn.demandJudgment.status, 80) || null,
            responseQuote: clean(rawTurn.demandJudgment.responseQuote, 500) || null,
            reason: clean(rawTurn.demandJudgment.reason, 800) || null,
          }
        : null,
      fairnessVersion: rawTurn?.evidenceValidated === true ? LIFTOFF_QUESTION_DEMAND_VERSION : null,
      releaseRequested: requestedRelease,
      releaseAccepted: next.procedureReleased,
    },
  ].slice(-80)

  return next
}
export function liftoffStateForModel(state) {
  return {
    protocolVersion: state?.protocolVersion || LIFTOFF_PROTOCOL_VERSION,
    components: (state?.components || []).map((component) => ({
      id: component.id,
      name: component.name,
      description: component.description,
      dependencies: component.dependencies,
      importance: component.importance,
      essential: component.essential,
      evidenceState: component.evidenceState,
      lastDiagnostic: component.lastDiagnostic,
      lastEvidence: component.lastEvidence,
    })),
    currentAction: state?.currentAction || null,
    recentProblemHistory: (state?.problemHistory || []).slice(-12),
    integrationConfirmed: state?.integrationConfirmed === true,
    variationConfirmed: state?.variationConfirmed === true,
    procedureReleased: state?.procedureReleased === true,
    turnNumber: Number(state?.turnNumber || 0),
    recentTrace: (state?.trace || []).slice(-8),
  }
}

export function buildLiftoffSnapshotFeatureState({
  occurrenceId,
  executionSessionId,
  phase = 'active',
  liftoff,
  slateText = '',
  introTeaching,
  pendingAdvance,
  activeScratchUi,
  assessmentScratchUi,
  manualScratchUi,
  assessmentIndex = 0,
  worksheetFeedback = null,
  testResults = [],
  testItems,
  finalPercentage = null,
  startedAt = null,
  mathSession,
  mathWorkingNotes,
  mathArchive,
  mathPending,
  assessmentMathSession,
  assessmentMathWorkingNotes,
  assessmentMathPending,
  assessmentMathText,
  assessmentMathTextLocation,
  assessmentMathFingerprint,
} = {}) {
  return {
    kind: LIFTOFF_SNAPSHOT_KIND,
    occurrenceId: String(occurrenceId || ''),
    instructionalTeacher: 'slate',
    executionSessionId: String(executionSessionId || ''),
    phase: ['active', 'worksheet', 'test'].includes(phase) ? phase : 'active',
    liftoff: liftoff && typeof liftoff === 'object' ? liftoff : null,
    slateText: String(slateText || ''),
    ...(introTeaching !== undefined ? { introTeaching } : {}),
    ...(pendingAdvance !== undefined ? { pendingAdvance } : {}),
    ...(activeScratchUi !== undefined ? { activeScratchUi } : {}),
    ...(assessmentScratchUi !== undefined ? { assessmentScratchUi } : {}),
    ...(manualScratchUi !== undefined ? { manualScratchUi } : {}),
    assessmentIndex: Math.max(0, Number(assessmentIndex) || 0),
    worksheetFeedback: worksheetFeedback || null,
    testResults: Array.isArray(testResults) ? testResults : [],
    ...(testItems !== undefined ? { testItems: Array.isArray(testItems) ? testItems : [] } : {}),
    finalPercentage: Number.isFinite(Number(finalPercentage)) ? Number(finalPercentage) : null,
    startedAt: startedAt || null,
    ...(mathSession !== undefined ? { mathSession } : {}),
    ...(mathWorkingNotes !== undefined ? { mathWorkingNotes } : {}),
    ...(mathArchive !== undefined ? { mathArchive } : {}),
    ...(mathPending !== undefined ? { mathPending } : {}),
    ...(assessmentMathSession !== undefined ? { assessmentMathSession } : {}),
    ...(assessmentMathWorkingNotes !== undefined ? { assessmentMathWorkingNotes } : {}),
    ...(assessmentMathPending !== undefined ? { assessmentMathPending } : {}),
    ...(assessmentMathText !== undefined ? { assessmentMathText: String(assessmentMathText || '') } : {}),
    ...(assessmentMathTextLocation !== undefined ? { assessmentMathTextLocation: String(assessmentMathTextLocation || '') } : {}),
    ...(assessmentMathFingerprint !== undefined ? { assessmentMathFingerprint: String(assessmentMathFingerprint || '') } : {}),
  }
}

// A refresh can offer a choice before creating/binding a new protected execution.
// Do not offer snapshots belonging to another learner, lesson, or occurrence.
export function isResumableSlateLiftoffSnapshot(snapshot, { learnerId, lessonKey, occurrenceId } = {}) {
  if (!learnerId || !lessonKey || !occurrenceId) return false
  const feature = snapshot?.featureState
  return Boolean(
    String(snapshot?.learnerId || '') === String(learnerId) &&
    String(snapshot?.lessonKey || '') === String(lessonKey) &&
    feature?.kind === LIFTOFF_SNAPSHOT_KIND &&
    feature.instructionalTeacher === 'slate' &&
    String(feature.occurrenceId || '') === String(occurrenceId) &&
    feature.liftoff && typeof feature.liftoff === 'object' &&
    ['active', 'worksheet', 'test'].includes(feature.phase)
  )
}

export function canRestoreLiftoffSnapshot(snapshot, { occurrenceId, executionSessionId } = {}) {
  const feature = snapshot?.featureState
  if (!feature || feature.kind !== LIFTOFF_SNAPSHOT_KIND) return false
  if (feature.instructionalTeacher !== 'slate') return false
  if (String(feature.occurrenceId || '') !== String(occurrenceId || '')) return false
  if (!feature.liftoff || typeof feature.liftoff !== 'object') return false
  const directExecution = String(feature.executionSessionId || '') === String(executionSessionId || '')
  const transferredExecution = String(snapshot?.ownershipHandoff?.targetExecutionSessionId || '') === String(executionSessionId || '')
  return Boolean(executionSessionId && (directExecution || transferredExecution))
}
import { normalizeMathActivity } from '../../lib/math/mathSession.mjs'
