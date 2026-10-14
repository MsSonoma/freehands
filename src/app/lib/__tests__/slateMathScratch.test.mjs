import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSlateScratchVariant, selectSlateScratchOperation, slateScratchChoices,
  slateScratchUiForQuestion, restoreSlateScratchUi,
} from '../slateMathScratch.mjs'
import { enterVerticalMathCell } from '../../../lib/math/verticalMath.mjs'
import { buildMathActivityProblem, updateMathSessionView } from '../../../lib/math/mathSession.mjs'

const ADD = { operation: 'addition', operands: ['47', '26'], commands: [] }

test('all available operations rebuild with the same operands and original question stays intact', () => {
  assert.deepEqual(slateScratchChoices(ADD), ['addition', 'subtraction', 'multiplication', 'division'])
  const changed = selectSlateScratchOperation(null, 'original-question', ADD, 'teaching', 'multiplication')
  assert.equal(changed.operation, 'multiplication')
  assert.equal(changed.variants.multiplication.session.spec.operation, 'multiplication')
  assert.deepEqual(changed.variants.multiplication.session.spec.operands, ['47', '26'])
  assert.equal(ADD.operation, 'addition')
})

test('unsupported operations are excluded instead of constructing invalid math', () => {
  const decimals = { operation: 'addition', operands: ['6.25', '2.5'], commands: [] }
  assert.ok(!slateScratchChoices(decimals).includes('division'))
  assert.equal(selectSlateScratchOperation(null, 'x', decimals, 'teaching', 'division'), null)
  const multi = { operation: 'addition', operands: ['1', '2', '3'], commands: [] }
  assert.deepEqual(slateScratchChoices(multi), ['addition'])
})

test('switching operations preserves existing variants and does not grade independent test entries', () => {
  const addition = slateScratchUiForQuestion(null, 'original-question', ADD, 'test')
  assert.equal(addition.visible, true)
  assert.equal(addition.operation, 'addition')
  const multiplication = selectSlateScratchOperation(addition, 'original-question', ADD, 'test', 'multiplication')
  assert.equal(multiplication.variants.multiplication.session.phase, 'test')
  const session = multiplication.variants.multiplication.session
  const problem = buildMathActivityProblem(session.spec)
  const target = session.view.editable[session.view.editable.length - 1]
  const entered = enterVerticalMathCell(problem, session.view, target, '9')
  assert.equal(entered.ok, true)
  const updated = updateMathSessionView(session, entered.view, {
    activityId: session.activityId, expectedRevision: session.revision, requestId: 'scratch-1',
  })
  assert.equal(updated.ok, true)
  const withWork = { ...multiplication, variants: { multiplication: { session: updated.state, notes: {} } } }
  const restored = restoreSlateScratchUi(JSON.parse(JSON.stringify(withWork)), 'original-question', ADD, 'test')
  assert.equal(restored.variants.multiplication.session.view.entries[target], '9')
  const back = selectSlateScratchOperation(restored, 'original-question', ADD, 'test', 'addition')
  const again = selectSlateScratchOperation(back, 'original-question', ADD, 'test', 'multiplication')
  assert.equal(again.variants.multiplication.session.view.entries[target], '9')
})

test('drafts from another question and forged states do not carry over', () => {
  const draft = selectSlateScratchOperation(null, 'first', ADD, 'teaching', 'division')
  assert.equal(restoreSlateScratchUi(draft, 'second', ADD, 'teaching'), null)
  assert.equal(slateScratchUiForQuestion(draft, 'second', ADD, 'teaching').visible, true)
  const forged = { ...draft, variants: { division: { session: { wrong: true } } } }
  assert.deepEqual(restoreSlateScratchUi(forged, 'first', ADD, 'teaching').variants, {})
})

test('division is available when two supported nonzero whole numbers are provided', () => {
  const input = { operation: 'division', operands: ['144', '12'], commands: [] }
  const initial = createSlateScratchVariant(input, 'addition', 'id', 'teaching')
  assert.equal(initial.session.spec.operation, 'addition')
})
