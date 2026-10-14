import {
  buildMathActivityProblem,
  createMathSession,
  normalizeMathActivity,
  restoreMathSession,
} from '../../lib/math/mathSession.mjs'
import { evaluateMathTestAnswer } from '../../lib/math/mathTestAnswer.mjs'

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const fail = (error) => ({ kind: 'invalid', error })

function itemType(item = {}) {
  if (Array.isArray(item.choices) && item.choices.length) return 'multiplechoice'
  if (typeof item.answer === 'boolean' || typeof item.correct === 'boolean') return 'truefalse'
  const declared = String(item.type || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (['multiplechoice', 'mcq', 'choice'].includes(declared)) return 'multiplechoice'
  if (['truefalse', 'tf', 'boolean'].includes(declared)) return 'truefalse'
  // Every other item is rendered as a written answer, including legacy fill-ins.
  return 'shortanswer'
}

function questionText(item = {}) {
  return String(item.question || item.prompt || item.text || '').trim()
}

function expectedCandidates(item = {}) {
  return [
    ...(Array.isArray(item.expectedAny) ? item.expectedAny : []),
    ...(own(item, 'expected') ? [item.expected] : []),
    ...(own(item, 'answer') ? [item.answer] : []),
  ].filter((value) => value !== null && value !== undefined && typeof value !== 'boolean')
}

function canonicalDecimal(value) {
  const match = String(value).trim().match(/^(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  const whole = match[1].replace(/^0+(?=\d)/, '')
  const fraction = (match[2] || '').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

function canonicalDivision(value) {
  const match = String(value).trim().match(/^(\d+)\s+(?:r|remainder)\s+(\d+)$/i)
  return match ? `${BigInt(match[1])} r ${BigInt(match[2])}` : null
}

function expectedValue(problem) {
  return problem.operation === 'division'
    ? `${BigInt(problem.quotient)} r ${BigInt(problem.remainder)}`
    : canonicalDecimal(problem.answer)
}

function candidateMatches(problem, candidate) {
  if (problem.operation === 'division') {
    const pair = canonicalDivision(candidate)
    if (pair) return pair === expectedValue(problem)
    const scalar = canonicalDecimal(candidate)
    return problem.remainder === '0' && scalar !== null && scalar === canonicalDecimal(problem.quotient)
  }
  const value = canonicalDecimal(candidate)
  return value !== null && value === expectedValue(problem)
}

function parseExpression(text) {
  const body = text.match(/^(?:(?:what\s+is|calculate|compute|solve|evaluate)\s*:?[ \t]*)?(.+?)(?:\s*(?:\?|=\s*\??))?$/i)?.[1]?.trim()
  if (!body || /\d\/\d/.test(body)) return null

  // The test's numeric prompts can have comma-grouped thousands (10,000 - 6,438).
  // Validate whole numerals first: only then strip commas for the existing workspace.
  const validNumber = (value) => /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)
  const clean = (values) => values.map((value) => value.replace(/,/g, ''))
  const parts = body.split(/\s*\+\s*/)
  if (parts.length >= 2 && parts.length <= 10 && parts.every(validNumber)) {
    return { operation: 'addition', operands: clean(parts), commands: [] }
  }

  // A spaced slash denotes division; an unspaced 1/2 stays a fraction.
  const spacedDivision = body.match(/^([\d.,]+)\s+\/\s+([\d.,]+)$/)
  if (spacedDivision && validNumber(spacedDivision[1]) && validNumber(spacedDivision[2])) {
    return { operation: 'division', operands: clean([spacedDivision[1], spacedDivision[2]]), commands: [] }
  }
  const binary = body.match(/^([\d.,]+)\s*([-*x\u00d7\u00f7\u2212])\s*([\d.,]+)$/i)
  if (!binary || !validNumber(binary[1]) || !validNumber(binary[3])) return null
  const operation = binary[2] === '-' || binary[2] === '\u2212' ? 'subtraction'
    : binary[2] === '\u00f7' ? 'division' : 'multiplication'
  return { operation, operands: clean([binary[1], binary[3]]), commands: [] }
}

function normalizedResult(raw, source) {
  try {
    const spec = normalizeMathActivity(raw)
    if (spec.commands.length) return fail('Independent test math cannot include presentation commands.')
    return { kind: 'math', spec, source }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The math activity is invalid.')
  }
}

export function resolveSlateTestMath(item = {}) {
  if (own(item, 'math')) {
    if (itemType(item) !== 'shortanswer') return fail('Choice-based test items cannot include structured math.')
    const resolved = normalizedResult(item.math, 'explicit')
    if (resolved.kind !== 'math') return resolved
    let problem
    try { problem = buildMathActivityProblem(resolved.spec) } catch { return fail('The math activity is invalid.') }
    const numericCandidates = expectedCandidates(item).filter((candidate) =>
      canonicalDecimal(candidate) !== null || canonicalDivision(candidate) !== null)
    if (numericCandidates.some((candidate) => !candidateMatches(problem, candidate))) {
      return fail('The structured math conflicts with the test answer key.')
    }
    return resolved
  }
  // A choice-based arithmetic test still needs the existing working grid;
  // the response remains a multiple-choice selection, not a numeric submission.
  if (itemType(item) === 'truefalse') return { kind: 'text' }
  const raw = parseExpression(questionText(item))
  if (!raw) return { kind: 'text' }
  const resolved = normalizedResult(raw, 'expression')
  if (resolved.kind !== 'math') return { kind: 'text' }
  // Recognition only controls the optional working layout, never the test answer key.
  // A bare arithmetic problem should display its operands even when older test data
  // lacks a numeric key or contains an inconsistent one. Grading stays unchanged.
  return resolved
}

export function slateTestMathFingerprint(item, spec) {
  return JSON.stringify({ question: questionText(item), spec: normalizeMathActivity(spec) })
}

export function restoreSlateMathTestDraft(feature = {}, { restart = false } = {}) {
  if (restart) {
    return { session: null, pending: null, text: '', textLocation: '', fingerprint: '' }
  }
  return {
    session: feature.assessmentMathSession || null,
    pending: feature.assessmentMathPending || null,
    text: String(feature.assessmentMathText || ''),
    textLocation: String(feature.assessmentMathTextLocation || ''),
    fingerprint: String(feature.assessmentMathFingerprint || ''),
  }
}

export function createSlateMathTestSession({ item, snapshot, activityId } = {}) {
  const resolved = resolveSlateTestMath(item)
  if (resolved.kind !== 'math') return resolved.kind === 'invalid'
    ? { ok: false, code: 'INVALID_TEST_MATH', error: resolved.error }
    : { ok: true, state: null, resolved }
  const result = snapshot
    ? restoreMathSession(snapshot, { activityId, phase: 'test', spec: resolved.spec })
    : createMathSession(resolved.spec, { activityId, phase: 'test' })
  return { ...result, resolved }
}

export function mathTestSubmissionReady(state) {
  if (!state || state.phase !== 'test') return false
  try {
    const evaluation = evaluateMathTestAnswer(buildMathActivityProblem(state.spec), state.view)
    return evaluation.complete && evaluation.gradable
  } catch { return false }
}

function rowValue(row, entries) {
  const supplied = row.cells
    .filter((cell) => Number.isInteger(cell.place) && own(entries, cell.id))
    .sort((a, b) => b.place - a.place)
  if (!supplied.length) return ''
  const high = Math.max(0, ...supplied.map((cell) => cell.place))
  const low = Math.min(0, ...supplied.map((cell) => cell.place))
  let value = ''
  for (let place = high; place >= low; place -= 1) {
    if (place === -1) value += '.'
    const cell = row.cells.find((candidate) => candidate.place === place)
    value += cell && own(entries, cell.id) ? entries[cell.id] : '0'
  }
  return value.replace(/^0+(?=\d)/, '') || '0'
}

export function formatSlateMathTestResponse(state) {
  if (!state?.view?.entries) return ''
  const problem = buildMathActivityProblem(state.spec)
  const rows = Array.isArray(problem.answerRows) && problem.answerRows.length ? problem.answerRows : [problem.resultRow]
  const values = rows.map((row) => rowValue(row, state.view.entries))
  return problem.operation === 'division' ? `${values[0]} r ${values[1]}` : values[0]
}
