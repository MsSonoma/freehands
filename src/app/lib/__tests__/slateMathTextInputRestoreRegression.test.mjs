import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildMathActivityProblem, createMathSession } from '../../../lib/math/mathSession.mjs'
import { listMathTextDestinations } from '../../../lib/math/mathTextInput.mjs'
import { buildMathConversationContext } from '../slateMath.mjs'

const source = readFileSync(new URL('../../session/slate/SlateLiftoffExperience.jsx', import.meta.url), 'utf8')

function contextFor(spec) {
  const problem = buildMathActivityProblem(spec)
  const state = createMathSession(spec, { activityId: 'decimal-context' }).state
  return { problem, view: state.view, text: buildMathConversationContext({ prompt: 'Solve.', problem, view: state.view }) }
}

test('whole numbers and unequal decimal factors use right-side decimal boundaries', () => {
  const whole = contextFor({ operation: 'addition', operands: ['47', '26'], commands: [] })
  assert.match(whole.text, /Number row 1: 4 7/)
  assert.doesNotMatch(whole.text, /\.\s*4 7/)

  const product = contextFor({ operation: 'multiplication', operands: ['12.3', '4.56'], commands: [] })
  assert.match(product.text, /Number row 1: 1 2 \. 3/)
  assert.match(product.text, /Number row 2: 4 \. 5 6/)
})

test('very small decimals render correctly and work rows never receive decimal points', () => {
  const addition = contextFor({ operation: 'addition', operands: ['0.004', '0.0006'], commands: [] })
  assert.match(addition.text, /Number row 1: 0 \. 0 0 4/)
  assert.match(addition.text, /Number row 2: 0 \. 0 0 0 6/)

  const product = contextFor({ operation: 'multiplication', operands: ['12.3', '4.56'], commands: [] })
  const lines = product.text.split('\n')
  const workStart = product.problem.rows.length
  const workEnd = workStart + product.problem.workRows.length
  for (const line of lines.slice(2 + workStart, 2 + workEnd)) assert.doesNotMatch(line, /\./)
})

test('hidden decimal entries display only an editable learner entry', () => {
  const { problem, view } = contextFor({ operation: 'addition', operands: ['12.3', '4.5'], commands: [] })
  const decimalId = 'operand.1.decimal'
  const concealed = { ...view, hidden: [...view.hidden, decimalId], entries: { ...view.entries, [decimalId]: '2' } }
  assert.doesNotMatch(buildMathConversationContext({ problem, view: concealed }), /1 2 \. 3/)
  const editable = { ...concealed, editable: [...concealed.editable, decimalId] }
  assert.match(buildMathConversationContext({ problem, view: editable }), /1 \. 2 3/)
})

test('text destinations use answer names, visible places, and physical slots for concealed decimals', () => {
  const division = contextFor({ operation: 'division', operands: ['144', '12'], commands: [] })
  const divisionChoices = listMathTextDestinations(division.problem, division.view)
  assert.equal(divisionChoices.find((choice) => choice.value === 'result.*')?.label, 'Whole answer')
  assert.equal(divisionChoices.find((choice) => choice.value === 'remainder.*')?.label, 'Remainder')
  assert.equal(divisionChoices.find((choice) => choice.value === 'result.tens')?.label, 'Result tens')

  const decimal = contextFor({ operation: 'addition', operands: ['12.3', '4.5'], commands: [] })
  const ids = ['operand.1.tens', 'operand.1.ones', 'operand.1.tenths', 'operand.1.decimal']
  const hiddenView = { ...decimal.view, hidden: [...new Set([...decimal.view.hidden, ...ids])], editable: ids }
  const choices = listMathTextDestinations(decimal.problem, hiddenView)
  assert.match(choices.find((choice) => choice.value === 'operand.1.tenths')?.label || '', /^Operand 1 slot \d+$/)
  assert.doesNotMatch(choices.map((choice) => choice.label).join(' '), /-\d/)
})

test('snapshot restore keeps only matching pending composer text and destination identity', () => {
  assert.match(source, /pendingOwnsRestoredMath[\s\S]*setAnswer\(pendingOwnsRestoredMath/)
  assert.match(source, /restoredPending\.kind === 'composer_help' \? restoredPending\.text : restoredPending\.learnerResponse/)
  assert.match(source, /textLocation: selectedMathTextLocation \|\| ''/)
  assert.match(source, /pendingMatches[\s\S]*result\.state\.view\.editable\.includes\(pendingLocation\)/)
  assert.match(source, /row\.cells\.every\(\(cell\) => result\.state\.view\.editable\.includes\(cell\.id\)\)/)
  assert.match(source, /setSelectedMathTextLocation\(restoreLocation \? pendingLocation : ''\)/)
})
