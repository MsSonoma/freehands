import {
  buildMathActivityProblem,
  createMathSession,
  normalizeMathActivity,
  restoreMathSession,
} from '../../lib/math/mathSession.mjs'
import { evaluateVerticalMath } from '../../lib/math/verticalMath.mjs'
import { isMathConversationQuestion } from '../../lib/math/mathTextInput.mjs'

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const fail = (code, error) => ({ ok: false, code, error })

function stableHash(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function createSlateMathActivityId({ occurrenceId, executionSessionId, stage, turnNumber, assessmentIndex } = {}) {
  const source = JSON.stringify([
    String(occurrenceId || ''), String(executionSessionId || ''), String(stage || ''),
    Number.isSafeInteger(turnNumber) ? turnNumber : null,
    Number.isSafeInteger(assessmentIndex) ? assessmentIndex : null,
  ])
  const label = [occurrenceId, executionSessionId, stage, turnNumber ?? assessmentIndex]
    .map((part) => String(part ?? '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32))
    .join(':')
  return `slate-math:${label.slice(0, 150)}:${stableHash(source)}`.slice(0, 200)
}

export function createOrRestoreSlateMathActivity({ math, snapshot, activityId, phase = 'teaching' } = {}) {
  if (math === undefined || math === null) return { ok: true, state: null }
  let spec
  try { spec = normalizeMathActivity(math) } catch (error) { return fail('INVALID_SPEC', error.message) }
  return snapshot
    ? restoreMathSession(snapshot, { activityId, phase, spec })
    : createMathSession(spec, { activityId, phase })
}

export function slateMathSessionMatchesSpec({ math, snapshot, activityId, phase = 'teaching' } = {}) {
  if (!math || !snapshot || snapshot.activityId !== activityId || snapshot.phase !== phase) return false
  try {
    return same(normalizeMathActivity(math), normalizeMathActivity(snapshot.spec))
  } catch {
    return false
  }
}

export function slateMathSubmissionReady({ math, snapshot, activityId, phase = 'teaching' } = {}) {
  if (!slateMathSessionMatchesSpec({ math, snapshot, activityId, phase })) return false
  try {
    const evaluation = evaluateVerticalMath(buildMathActivityProblem(normalizeMathActivity(math)), snapshot.view)
    return evaluation.responseRequired && evaluation.gradable && evaluation.complete
  } catch {
    return false
  }
}

export function shouldSendSlateMathConversation({ route, gridComplete = false, phase = 'teaching' } = {}) {
  return phase === 'teaching' && route?.kind === 'conversation' &&
    (!gridComplete || isMathConversationQuestion(route.text))
}

export function slateMathPendingMatchesText({ pending, activityId, revision, turnNumber, text } = {}) {
  return Boolean(pending?.submission && pending.submission.activityId === activityId &&
    revision === pending.submission.submittedRevision + 1 &&
    pending.turnNumber === turnNumber && pending.learnerResponse === String(text || '').trim())
}

export function slateMathHelpPendingMatches({ pending, activityId, revision, turnNumber, text } = {}) {
  return Boolean(pending?.kind === 'composer_help' && pending.activityId === activityId &&
    pending.helpedRevision === revision && pending.turnNumber === turnNumber &&
    pending.text === String(text || '').trim())
}

function visibleCellText(problem, view, cell) {
  if (view.hidden.includes(cell.id)) {
    return view.editable.includes(cell.id) && Object.hasOwn(view.entries, cell.id) ? view.entries[cell.id] : '?'
  }
  return cell.value === null ? ' ' : String(cell.value)
}

function visibleRowText(problem, view, row) {
  const decimal = getVisibleDecimalBoundary(problem, view, row)
  return row.cells.map((cell, index) => {
    const prefix = decimal > 0 && index === row.cells.length - decimal ? '. ' : ''
    return prefix + visibleCellText(problem, view, cell)
  }).join(' ').trim()
}

function getVisibleDecimalBoundary(problem, view, row) {
  if (problem.operation === 'division' || row.kind === 'work') return null
  const id = `${row.id}.decimal`
  if (view.hidden.includes(id)) {
    if (!view.editable.includes(id) || !Object.hasOwn(view.entries, id)) return null
    return Number(view.entries[id])
  }
  const ones = row.cells.find((cell) => cell.place === 0)
  return Number.isInteger(ones?.slot) ? ones.slot : null
}

/** Text-only context for existing teaching help. It never reads answer-key fields. */
export function buildMathConversationContext({ prompt = '', problem, view } = {}) {
  if (!problem || !view) return String(prompt || '').trim().slice(0, 2400)
  const rows = [...(problem.rows || []), ...(problem.workRows || []), ...(problem.answerRows || (problem.resultRow ? [problem.resultRow] : []))]
  const seen = new Set()
  const rendered = []
  for (const row of rows) {
    if (!row?.id || seen.has(row.id) || !Array.isArray(row.cells)) continue
    seen.add(row.id)
    const cells = visibleRowText(problem, view, row)
    rendered.push(`Number row ${rendered.length + 1}: ${cells}`)
  }
  if (view.hidden.includes('operator')) {
    rendered.push(`Arithmetic symbol: ${view.editable.includes('operator') && Object.hasOwn(view.entries, 'operator') ? view.entries.operator : '?'}`)
  } else if (problem.operator) {
    rendered.push(`Arithmetic symbol: ${problem.operator}`)
  }
  const operationVisible = !view.hidden.includes('operator') && problem.operation
  return [`Problem: ${String(prompt || '').trim()}`, ...(operationVisible ? [`Operation: ${problem.operation}`] : []), ...rendered]
    .join('\n').slice(0, 2400)
}

export function verifySlateMathSubmission({ problem, snapshot, submission } = {}) {
  if (!problem || !own(problem, 'math')) return fail('MATH_NOT_EXPECTED', 'The current problem has no structured math activity.')
  if (!snapshot || !submission) return fail('MISSING_SUBMISSION', 'A math session snapshot and submission are required.')
  let spec
  try { spec = normalizeMathActivity(problem.math) } catch (error) { return fail('INVALID_SPEC', error.message) }
  if (snapshot.phase !== 'teaching') return fail('INVALID_PHASE', 'Slate turn submissions must be in teaching phase.')
  const restored = restoreMathSession(snapshot, { activityId: snapshot.activityId, phase: 'teaching', spec })
  if (!restored.ok) return fail(restored.code || 'INVALID_SNAPSHOT', restored.error)
  const state = restored.state
  const attempt = state.attempts[state.attempts.length - 1]
  if (!attempt) return fail('MISSING_SUBMISSION', 'The math session has no recorded submission.')
  if (submission.activityId !== state.activityId || submission.activityId !== snapshot.activityId) return fail('ACTIVITY_MISMATCH', 'Submission activityId does not match the current activity.')
  if (submission.requestId !== attempt.requestId) return fail('STALE_SUBMISSION', 'Submission requestId is not the latest recorded submission.')
  if (submission.submittedRevision !== attempt.submittedRevision) return fail('STALE_SUBMISSION', 'Submission revision is not the latest recorded submission.')
  if (state.revision !== attempt.submittedRevision + 1) return fail('STALE_SUBMISSION', 'The math session changed after this submission.')
  if (!same(submission.entries, attempt.entries)) return fail('SUBMISSION_MISMATCH', 'Submission entries do not match the recorded attempt.')
  const mathProblem = buildMathActivityProblem(spec)
  const evaluation = evaluateVerticalMath(mathProblem, attempt.view)
  if (!evaluation.gradable || !evaluation.complete) return fail('UNGRADABLE_SUBMISSION', 'The recorded submission is not complete and gradable.')
  const evidence = {
    activityId: state.activityId,
    requestId: attempt.requestId,
    submittedRevision: attempt.submittedRevision,
    targetValues: Object.fromEntries(attempt.targets.map((id) => [id, attempt.entries[id]])),
    correct: evaluation.correct,
    incorrectLocations: [...evaluation.incorrectLocations],
    assisted: Boolean(attempt.assisted),
    independent: evaluation.correct && !attempt.assisted,
  }
  const values = attempt.targets.map((id) => `${id}=${attempt.entries[id]}`).join(', ')
  return { ok: true, evidence, responseText: values }
}

export const SLATE_MATH_ARCHIVE_LIMIT = 40

export function slateMathReceiptMatches({ receipt, pending, currentActivityId, currentRevision, currentTurnNumber } = {}) {
  if (!receipt || !pending?.submission) return false
  const submission = pending.submission
  return receipt.activityId === submission.activityId &&
    receipt.requestId === submission.requestId &&
    receipt.submittedRevision === submission.submittedRevision &&
    currentActivityId === submission.activityId &&
    currentRevision === submission.submittedRevision + 1 &&
    currentTurnNumber === pending.turnNumber
}

export function appendSlateMathArchive(archive, snapshot, metadata = {}) {
  const current = Array.isArray(archive) ? archive : []
  const duplicate = current.some((entry) => entry?.activityId === metadata.activityId &&
    entry?.requestId === metadata.requestId &&
    entry?.submittedRevision === metadata.submittedRevision)
  if (duplicate) return { ok: true, archive: current }
  if (current.length >= SLATE_MATH_ARCHIVE_LIMIT) {
    return fail('ARCHIVE_FULL', 'Math evidence storage is full. Ask a facilitator to preserve this lesson before continuing.')
  }
  return { ok: true, archive: [...current, { ...metadata, mathSession: snapshot }] }
}
