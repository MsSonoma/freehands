import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSlateManualScratch, initialSlateManualScratch, restoreSlateManualScratch, slateManualOperationChoices } from '../slateManualScratch.mjs'
import { enterVerticalMathCell } from '../../../lib/math/verticalMath.mjs'
import { updateMathSessionView } from '../../../lib/math/mathSession.mjs'

test('unprompted workspace starts collapsed and waits for learner-entered numbers', () => {
  const draft = initialSlateManualScratch()
  assert.equal(draft.visible, false)
  assert.equal(buildSlateManualScratch(draft, 'manual', 'teaching'), null)
  draft.operands = ['16', '7']
  const built = buildSlateManualScratch(draft, 'manual', 'teaching')
  assert.equal(built.session.spec.operation, 'addition')
  assert.deepEqual(built.session.spec.operands, ['16', '7'])
})

test('manual scratch preserves entered work after snapshot restore', () => {
  const initial = { ...initialSlateManualScratch(), visible: true, operands: ['16', '7'] }
  const built = buildSlateManualScratch(initial, 'manual', 'teaching')
  const target = built.session.view.editable.find((id) => id === 'result.ones')
  const entered = enterVerticalMathCell(built.problem, built.session.view, target, '3')
  const updated = updateMathSessionView(built.session, entered.view, {
    activityId: 'manual', expectedRevision: 0, requestId: 'a',
  })
  const saved = { ...initial, session: updated.state }
  const restored = restoreSlateManualScratch(JSON.parse(JSON.stringify(saved)), 'manual', 'teaching')
  assert.equal(restored.visible, true)
  assert.equal(buildSlateManualScratch(restored, 'manual', 'teaching').session.view.entries[target], '3')
  assert.equal(buildSlateManualScratch(restored, 'manual', 'test').session.phase, 'test')
})

test('manual scratch rejects incompatible and unsupported operand drafts safely', () => {
  const invalid = { ...initialSlateManualScratch(), operands: ['16', '0'], operation: 'division' }
  assert.equal(buildSlateManualScratch(invalid, 'manual', 'teaching'), null)
  assert.equal(restoreSlateManualScratch({ operands: ['abcdef', '7'] }, 'manual', 'teaching').operands[0], '')
  assert.equal(restoreSlateManualScratch({ operands: ['2', '3'], operation: 'addition', visible: true }, 'manual', 'teaching').visible, true)
})

test('manual subtraction stays in the operation menu when operands would produce a negative result', () => {
  const negativeOperands = ['2', '8']
  const choices = slateManualOperationChoices(negativeOperands)
  assert.ok(choices.includes('subtraction'))
  assert.ok(choices.includes('addition'))
  assert.equal(buildSlateManualScratch({
    ...initialSlateManualScratch(), operands: negativeOperands, operation: 'subtraction',
  }, 'manual', 'teaching'), null)

  const positiveOperands = ['9', '8']
  assert.ok(slateManualOperationChoices(positiveOperands).includes('subtraction'))
  const subtraction = buildSlateManualScratch({
    ...initialSlateManualScratch(), operands: positiveOperands, operation: 'subtraction',
  }, 'manual', 'teaching')
  assert.equal(subtraction?.problem?.operation, 'subtraction')
  assert.deepEqual(subtraction?.problem?.operands, positiveOperands)
  assert.ok(slateManualOperationChoices(['1.25', '0.35']).includes('subtraction'))
  assert.ok(!slateManualOperationChoices(['1.25', '0.35']).includes('division'))
})

test('My Math Workspace retains multiplier-dependent partial entries across refresh', () => {
  const draft = { ...initialSlateManualScratch(), visible: true,
    operation: 'multiplication', operands: ['47', '26'] }
  const problem = buildSlateManualScratch(draft, 'manual', 'teaching')
  assert.equal(problem.problem.partialRows.length, 2)
  assert(problem.session.view.editable.every((id) => !id.startsWith('partial.')))
  const entries = { 'partial.1.ones': '2', 'partial.2.tens': '4' }
  const saved = { ...draft, partialEntries: entries }
  const restored = restoreSlateManualScratch(JSON.parse(JSON.stringify(saved)), 'manual', 'teaching')
  assert.deepEqual(restored.partialEntries, entries)
  assert.equal(buildSlateManualScratch(restored, 'manual', 'teaching').problem.partialRows.length, 2)
  assert.deepEqual(restoreSlateManualScratch({
    ...saved, partialEntries: { ...entries, 'result.ones': '8', 'partial.2.ones': '0' },
  }, 'manual', 'teaching').partialEntries, entries)
  assert.deepEqual(restoreSlateManualScratch({
    ...saved, operation: 'addition',
  }, 'manual', 'teaching').partialEntries, {})
  assert.deepEqual(restoreSlateManualScratch({ ...draft }, 'manual', 'test').partialEntries, {})
})
