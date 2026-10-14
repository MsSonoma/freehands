import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSlateMathTestSession,
  formatSlateMathTestResponse,
  mathTestSubmissionReady,
  resolveSlateTestMath,
  slateTestMathFingerprint,
} from '../slateMathTest.mjs'
import { buildMathActivityProblem, updateMathSessionView } from '../../../lib/math/mathSession.mjs'
import { routeMathTextInput } from '../../../lib/math/mathTextInput.mjs'

const explicit = (extra = {}) => ({
  type: 'shortanswer',
  question: 'Add 12 and 3.',
  expectedAny: ['15', '015.0'],
  math: { operation: 'addition', operands: ['12', '3'], commands: [] },
  ...extra,
})

test('explicit test math is normalized and rejects incompatible or conflicting items', () => {
  assert.deepEqual(resolveSlateTestMath(explicit()), {
    kind: 'math',
    spec: { operation: 'addition', operands: ['12', '3'], commands: [] },
    source: 'explicit',
  })
  assert.equal(resolveSlateTestMath(explicit({ type: 'mcq' })).kind, 'invalid')
  assert.equal(resolveSlateTestMath(explicit({ choices: ['15', '16'] })).kind, 'invalid')
  assert.equal(resolveSlateTestMath(explicit({ expectedAny: ['15', '16'] })).kind, 'invalid')
  assert.equal(resolveSlateTestMath(explicit({ math: { operation: 'addition', operands: ['12', '3'], commands: [{ action: 'highlight', locations: ['result.ones'] }] } })).kind, 'invalid')
  assert.equal(resolveSlateTestMath(explicit({ math: { operation: 'unknown', operands: ['12', '3'] } })).kind, 'invalid')
})

test('bare arithmetic recognition is anchored and independent of the test answer key', () => {
  const accepted = [
    [{ question: 'What is 12 + 3?', expected: '15' }, 'addition'],
    [{ question: 'Calculate: 10 - 7 = ?', answer: 3n }, 'subtraction'],
    [{ question: 'Compute 6 x 4', expectedAny: ['24.0'] }, 'multiplication'],
    [{ question: 'Evaluate: 18 × 2?', expected: 36 }, 'multiplication'],
    [{ question: 'Solve: 9 ÷ 2 = ?', expected: '4 r 1' }, 'division'],
    [{ question: '20 ÷ 5', expected: '4' }, 'division'],
    [{ question: '1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10', expected: '55' }, 'addition'],
    [{ question: '247 + 38 =', expected: '285' }, 'addition'],
    [{ question: '14 - 8 = ?', type: 'fillintheblank', expected: '6' }, 'subtraction'],
    [{ question: '6 × 9 =', expected: '54' }, 'multiplication'],
    [{ question: '42 ÷ 6 =', expected: '7' }, 'division'],
    [{ question: '83 − 17 =', expected: '66' }, 'subtraction'],
    [{ question: '42 / 6 =', expected: '7' }, 'division'],
    [{ question: '3 + 4', type: 'numeric' }, 'addition'],
    [{ question: '12 + 3?', expected: '14' }, 'addition'],
    [{ question: '9 ÷ 2', expected: '4' }, 'division'],
    [{ question: 'What is 6,708 + 4,395?', choices: ['11,103', '11,003'], correct: 'A' }, 'addition'],
    [{ question: 'What is 10,000 - 6,438?', choices: ['3,562', '3,662'], correct: 'A' }, 'subtraction'],
    [{ question: 'What is 407 × 16?', choices: ['6,512', '6,112'], correct: 'A' }, 'multiplication'],
    [{ question: '8,640 ÷ 12 = ?', expected: '720' }, 'division'],
    [{ question: '4,810 + 2,005 + 1,025?', expected: '7840' }, 'addition'],
  ]
  for (const [item, operation] of accepted) {
    const result = resolveSlateTestMath(item)
    assert.equal(result.kind, 'math', item.question)
    assert.equal(result.source, 'expression')
    assert.equal(result.spec.operation, operation)
  }

  const rejected = [
    { question: 'What is 1/2?', expected: '0.5' },
    { question: 'What is -2 + 3?', expected: '1' },
    { question: 'What is 2 + 3 apples?', expected: '5' },
    { question: 'Ava has 2 and gets 3. What is 2 + 3?', expected: '5' },
    { question: 'What is 2 + 3 - 1?', expected: '4' },
    { question: 'Round 2 + 3.', expected: '5' },
    { question: '1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11', expected: '66' },
    { question: '2 + 2', type: 'tf', correct: true },
    { question: 'What is 10,00 - 6,438?', choices: ['3,562', '3,662'], correct: 'A' },
    { question: 'Which estimate best checks 2,986 × 31?', choices: ['10,000', '100,000'], correct: 'A' },
    { question: 'A farmer puts 2,736 apples equally into 12 crates. How many apples go in each crate?', choices: ['228', '236'], correct: 'A' },
  ]
  for (const item of rejected) assert.deepEqual(resolveSlateTestMath(item), { kind: 'text' }, item.question)

  assert.equal(resolveSlateTestMath({ question: '2 + 2', choices: ['3', '4'], correct: 1 }).kind, 'math')
  const liveQuestion = resolveSlateTestMath({ question: 'What is 10,000 - 6,438?', choices: ['3,562', '3,662'], correct: 'A' })
  assert.deepEqual(liveQuestion.spec.operands, ['10000', '6438'])
  assert.deepEqual(resolveSlateTestMath({ question: '2 + 2', type: 'tf', correct: true }), { kind: 'text' })
})

test('test session restores only the requested identity and formats supplied digits', () => {
  const item = { question: '100 + 25 = ?', expected: '125' }
  const activityId = 'slate-math:test:one'
  const made = createSlateMathTestSession({ item, activityId })
  assert.equal(made.ok, true)
  assert.equal(made.state.phase, 'test')
  assert.equal(mathTestSubmissionReady(made.state), false)

  const problem = buildMathActivityProblem(made.state.spec)
  const routed = routeMathTextInput(problem, made.state.view, '25')
  assert.equal(routed.kind, 'entry')
  const updated = updateMathSessionView(made.state, routed.view, {
    activityId,
    expectedRevision: made.state.revision,
    requestId: 'input-1',
  })
  assert.equal(updated.ok, true)
  assert.equal(mathTestSubmissionReady(updated.state), true)
  assert.equal(formatSlateMathTestResponse(updated.state), '25')

  const restored = createSlateMathTestSession({ item, activityId, snapshot: updated.state })
  assert.equal(restored.ok, true)
  assert.deepEqual(restored.state.view.entries, updated.state.view.entries)
  assert.equal(createSlateMathTestSession({ item, activityId: 'different', snapshot: updated.state }).ok, false)
  assert.equal(slateTestMathFingerprint(item, made.state.spec), slateTestMathFingerprint({ ...item }, made.state.spec))
})
