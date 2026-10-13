import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMathActivityProblem, createMathSession } from '../../../lib/math/mathSession.mjs'
import { slateMathWorkspaceResult, insertSlateMathResult } from '../slateMathDraft.mjs'

function grid(spec, entries = {}) {
  const problem = buildMathActivityProblem(spec)
  const view = createMathSession(spec, { activityId: 'draft' }).state.view
  return [problem, { ...view, entries }]
}

test('optional math result is read from entered digits without computing correct answer', () => {
  const spec = { operation: 'addition', operands: ['6184', '2739'], commands: [] }
  const [problem, view] = grid(spec, { 'result.thousands': '8', 'result.hundreds': '8', 'result.tens': '8', 'result.ones': '8' })
  assert.equal(slateMathWorkspaceResult(problem, view), '8888')
  assert.equal(slateMathWorkspaceResult(problem, { ...view, entries: {} }), '')
  assert.equal(slateMathWorkspaceResult(problem, { ...view, entries: { 'result.thousands': '9' } }), '')
  assert.equal(slateMathWorkspaceResult(problem, { ...view, entries: { 'result.tens': '2', 'result.ones': '5' } }), '25')
  assert.equal(slateMathWorkspaceResult(problem, { ...view, entries: { 'result.tens': '2' } }), '')
})

test('a visible provided digit may complete guided work, but a hidden key never supplies digits', () => {
  const spec = { operation: 'addition', operands: ['47', '26'], commands: [
    { action: 'show', locations: ['result.*'] },
    { action: 'hide', locations: ['result.ones'] },
  ] }
  const [problem, view] = grid(spec, { 'result.ones': '3' })
  assert.equal(slateMathWorkspaceResult(problem, view), '73')
  assert.equal(slateMathWorkspaceResult(problem, { ...view, entries: {} }), '')
})

test('decimal and division responses are learner-entered, not the solved key', () => {
  const [p, v] = grid({ operation: 'addition', operands: ['1.2', '2.3'], commands: [] },
    { 'result.ones': '2', 'result.tenths': '9' })
  assert.equal(slateMathWorkspaceResult(p, v), '2.9')
  const [d, dv] = grid({ operation: 'division', operands: ['17', '5'], commands: [] },
    { 'result.ones': '2', 'remainder.ones': '1' })
  assert.equal(slateMathWorkspaceResult(d, dv), '2 r 1')
  assert.equal(slateMathWorkspaceResult(d, { ...dv, entries: { 'result.ones': '2' } }), '')
})

test('using scratch result never overwrites explanation or duplicates it', () => {
  assert.equal(insertSlateMathResult('', '73'), '73')
  assert.equal(insertSlateMathResult('My estimate is close.', '73'), 'My estimate is close.\n73')
  assert.equal(insertSlateMathResult('My estimate is close.\n73', '73'), 'My estimate is close.\n73')
  assert.equal(insertSlateMathResult('Mental answer: 74', ''), 'Mental answer: 74')
})
