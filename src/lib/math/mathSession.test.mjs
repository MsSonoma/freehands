import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MATH_SESSION_MAX_EVENTS,
  applyMathSessionCommands,
  buildMathActivityProblem,
  createMathSession,
  normalizeMathActivity,
  recordMathSessionHelp,
  restoreMathSession,
  serializeMathSession,
  submitMathSession,
  updateMathSessionView,
} from './mathSession.mjs'
import { enterVerticalMathFullAnswer } from './verticalMath.mjs'
import { enterDivisionAnswer } from './verticalDivision.mjs'

const specs = {
  addition: { operation: 'addition', operands: ['12', '7'] },
  subtraction: { operation: 'subtraction', operands: ['12', '7'] },
  multiplication: { operation: 'multiplication', operands: ['12', '7'] },
  division: { operation: 'division', operands: ['17', '5'] },
}

function session(operation = 'addition', options = {}) {
  const made = createMathSession(specs[operation], { activityId: options.activityId || 'activity-1', phase: options.phase })
  assert.equal(made.ok, true)
  return made.state
}

function entered(state, answer) {
  const problem = buildMathActivityProblem(state.spec)
  const result = state.spec.operation === 'division'
    ? enterDivisionAnswer(problem, state.view, answer)
    : enterVerticalMathFullAnswer(problem, state.view, answer)
  assert.equal(result.ok, true)
  const updated = updateMathSessionView(state, result.view, {
    activityId: state.activityId,
    expectedRevision: state.revision,
    requestId: 'input-' + state.revision,
  })
  assert.equal(updated.ok, true)
  return updated.state
}

test('normalizes all four operations and defaults commands', () => {
  for (const operation of Object.keys(specs)) {
    assert.deepEqual(normalizeMathActivity(specs[operation]), { ...specs[operation], commands: [] })
  }
})

test('normalization rejects unknown fields, invalid operand types, arity, and commands', () => {
  assert.throws(() => normalizeMathActivity({ ...specs.addition, surprise: true }), /unknown field/)
  assert.throws(() => normalizeMathActivity({ operation: 'addition', operands: [1, '2'] }), /strings/)
  assert.throws(() => normalizeMathActivity({ operation: 'multiplication', operands: ['2'] }), /exactly two/)
  assert.throws(() => normalizeMathActivity({ ...specs.addition, commands: [{ action: 'paint', locations: ['result.*'] }] }), /unsupported action/)
})

test('generic normalization permits a no-response demonstration but submission rejects it', () => {
  const raw = { ...specs.addition, commands: [{ action: 'show', locations: ['result.*'] }] }
  assert.deepEqual(normalizeMathActivity(raw).commands, raw.commands)
  const made = createMathSession(raw, { activityId: 'demo' })
  assert.equal(made.ok, true)
  assert.equal(submitMathSession(made.state, { activityId: 'demo', expectedRevision: 0, requestId: 'submit' }).code, 'NO_RESPONSE_REQUIRED')
})

test('renderer full-answer update records only entry changes', () => {
  const state = session()
  const next = entered(state, '19')
  assert.equal(next.revision, 1)
  assert.equal(next.events.at(-1).type, 'input')
  assert.equal(next.events.at(-1).changes.every((change) => change.next !== undefined), true)
  assert.deepEqual(next.view.hidden, state.view.hidden)
})

test('correct and incorrect teaching submissions are graded and blank is rejected', () => {
  let correct = entered(session(), '19')
  const good = submitMathSession(correct, { activityId: correct.activityId, expectedRevision: correct.revision, requestId: 'good' })
  assert.equal(good.ok, true)
  assert.equal(good.submission.evaluation.correct, true)

  let wrong = entered(session(), '18')
  const bad = submitMathSession(wrong, { activityId: wrong.activityId, expectedRevision: wrong.revision, requestId: 'bad' })
  assert.equal(bad.ok, true)
  assert.equal(bad.submission.evaluation.correct, false)

  const blank = session()
  assert.equal(submitMathSession(blank, { activityId: blank.activityId, expectedRevision: 0, requestId: 'blank' }).code, 'INCOMPLETE_RESPONSE')
})

test('all operations submit correct answers including quotient and remainder', () => {
  const answers = { addition: '19', subtraction: '5', multiplication: '84', division: { quotient: '3', remainder: '2' } }
  for (const [operation, answer] of Object.entries(answers)) {
    const state = entered(session(operation), answer)
    const result = submitMathSession(state, { activityId: state.activityId, expectedRevision: state.revision, requestId: 'submit-' + operation })
    assert.equal(result.ok, true, operation)
    assert.equal(result.state.attempts[0].evaluation.correct, true, operation)
    if (operation === 'division') assert.deepEqual(Object.values(result.submission.entries).sort(), ['2', '3'])
  }
})

test('stale activity and revision are rejected', () => {
  const state = session()
  const command = { expectedRevision: 0, requestId: 'c', commands: [{ action: 'highlight', locations: ['operand.1.ones'] }] }
  assert.equal(applyMathSessionCommands(state, { ...command, activityId: 'foreign' }).code, 'ACTIVITY_MISMATCH')
  assert.equal(applyMathSessionCommands(state, { ...command, activityId: state.activityId, expectedRevision: 1 }).code, 'STALE_REVISION')
})

test('duplicate command is a no-op and conflicting request ID is rejected', () => {
  const state = session()
  const request = { activityId: state.activityId, expectedRevision: 0, requestId: 'same', commands: [{ action: 'highlight', locations: ['operand.1.ones'] }] }
  const first = applyMathSessionCommands(state, request)
  assert.equal(first.ok, true)
  const duplicate = applyMathSessionCommands(first.state, request)
  assert.equal(duplicate.duplicate, true)
  assert.strictEqual(duplicate.state, first.state)
  const conflict = applyMathSessionCommands(first.state, { ...request, commands: [{ action: 'clear_highlight', locations: [] }] })
  assert.equal(conflict.code, 'REQUEST_ID_CONFLICT')
})

test('duplicate submission does not append an attempt', () => {
  const state = entered(session(), '19')
  const request = { activityId: state.activityId, expectedRevision: state.revision, requestId: 'submit' }
  const first = submitMathSession(state, request)
  const retry = submitMathSession(first.state, request)
  assert.equal(retry.duplicate, true)
  assert.equal(retry.state.attempts.length, 1)
  assert.deepEqual(retry.submission, first.submission)
})

test('command batches validate final state atomically', () => {
  const state = session()
  const valid = applyMathSessionCommands(state, {
    activityId: state.activityId, expectedRevision: 0, requestId: 'mask',
    commands: [
      { action: 'show', locations: ['result.*'] },
      { action: 'hide', locations: ['result.ones'] },
    ],
  })
  assert.equal(valid.ok, true)
  assert.deepEqual(valid.state.view.editable, ['result.ones'])
  const invalid = applyMathSessionCommands(state, {
    activityId: state.activityId, expectedRevision: 0, requestId: 'invalid',
    commands: [{ action: 'highlight', locations: ['operand.1.ones'] }, { action: 'show', locations: ['missing'] }],
  })
  assert.equal(invalid.ok, false)
  assert.deepEqual(state.view.highlighted, [])
  assert.equal(state.revision, 0)
})

test('reveal keeps a wrong attempt and its event history', () => {
  let state = entered(session(), '18')
  state = submitMathSession(state, { activityId: state.activityId, expectedRevision: state.revision, requestId: 'wrong' }).state
  const revealed = applyMathSessionCommands(state, {
    activityId: state.activityId, expectedRevision: state.revision, requestId: 'reveal',
    commands: [{ action: 'show', locations: ['result.*'] }],
  })
  assert.equal(revealed.ok, true)
  assert.equal(revealed.state.assisted, true)
  assert.equal(revealed.state.attempts.length, 1)
  assert.equal(revealed.state.attempts[0].evaluation.correct, false)
  assert.equal(revealed.state.events.some((event) => event.type === 'input'), true)
  assert.equal(revealed.state.events.some((event) => event.type === 'submission'), true)
})

test('help is recorded as supported sticky assistance', () => {
  let state = session()
  const helped = recordMathSessionHelp(state, { activityId: state.activityId, expectedRevision: 0, requestId: 'help', kind: 'place-value prompt' })
  assert.equal(helped.ok, true)
  state = entered(helped.state, '19')
  const submitted = submitMathSession(state, { activityId: state.activityId, expectedRevision: state.revision, requestId: 'submit' })
  assert.equal(submitted.state.attempts[0].assisted, true)
  assert.equal(submitted.state.attempts[0].independent, false)
})

test('test phase rejects commands and help and redacts public grading', () => {
  let state = session('addition', { phase: 'test' })
  const base = { activityId: state.activityId, expectedRevision: 0 }
  assert.equal(applyMathSessionCommands(state, { ...base, requestId: 'c', commands: [{ action: 'highlight', locations: ['operand.1.ones'] }] }).code, 'TEST_PRESENTATION_LOCKED')
  assert.equal(recordMathSessionHelp(state, { ...base, requestId: 'h', kind: 'hint' }).code, 'TEST_HELP_LOCKED')
  state = entered(state, '19')
  const submitted = submitMathSession(state, { activityId: state.activityId, expectedRevision: state.revision, requestId: 's' })
  assert.equal(submitted.ok, true)
  assert.equal(Object.hasOwn(submitted.submission, 'evaluation'), false)
  assert.equal(Object.hasOwn(submitted.submission, 'correct'), false)
  assert.equal(Object.hasOwn(submitted.submission, 'expected'), false)
  assert.equal(submitted.state.attempts[0].evaluation.correct, true)
})

test('snapshot roundtrip preserves scope and recomputes corrupt saved grading', () => {
  let state = entered(session(), '19')
  state = submitMathSession(state, { activityId: state.activityId, expectedRevision: state.revision, requestId: 'submit' }).state
  const snapshot = serializeMathSession(state)
  snapshot.attempts[0].evaluation.correct = false
  snapshot.attempts[0].evaluation.incorrectLocations = ['invented']
  const restored = restoreMathSession(snapshot, { activityId: state.activityId, phase: 'teaching', spec: specs.addition })
  assert.equal(restored.ok, true)
  assert.equal(restored.state.attempts[0].evaluation.correct, true)
  assert.deepEqual(restored.state.attempts[0].evaluation.incorrectLocations, [])
})

test('restore rejects foreign context, spec, phase, protocol, and malformed view without throwing', () => {
  const state = session()
  const snapshot = serializeMathSession(state)
  const context = { activityId: state.activityId, phase: state.phase, spec: specs.addition }
  assert.equal(restoreMathSession(snapshot, { ...context, activityId: 'foreign' }).code, 'INVALID_SNAPSHOT')
  assert.equal(restoreMathSession(snapshot, { ...context, phase: 'test' }).code, 'INVALID_SNAPSHOT')
  assert.equal(restoreMathSession(snapshot, { ...context, spec: specs.subtraction }).code, 'INVALID_SNAPSHOT')
  assert.equal(restoreMathSession({ ...snapshot, protocolVersion: 999 }, context).code, 'INVALID_SNAPSHOT')
  assert.doesNotThrow(() => restoreMathSession({ ...snapshot, view: { hidden: null } }, context))
  assert.equal(restoreMathSession({ ...snapshot, view: { hidden: null } }, context).ok, false)
})

test('full history rejects mutation without evicting records', () => {
  const state = session()
  state.events = Array.from({ length: MATH_SESSION_MAX_EVENTS }, (_, revision) => ({ revision, type: 'input' }))
  const result = recordMathSessionHelp(state, { activityId: state.activityId, expectedRevision: 0, requestId: 'overflow', kind: 'hint' })
  assert.equal(result.code, 'HISTORY_FULL')
  assert.equal(state.events.length, MATH_SESSION_MAX_EVENTS)
  assert.equal(state.assisted, false)
  assert.equal(state.receipts.length, 0)
})
