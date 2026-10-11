import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVerticalAdditionProblem, createVerticalAdditionView } from './verticalAddition.mjs'
import { buildVerticalDivisionProblem, createVerticalDivisionView } from './verticalDivision.mjs'
import { buildVerticalMultiplicationProblem, createVerticalMultiplicationView } from './verticalMultiplication.mjs'
import { applyVerticalMathCommand, evaluateVerticalMath } from './verticalMath.mjs'
import { isMathConversationQuestion, routeMathTextInput } from './mathTextInput.mjs'

function show(problem, view, locations) {
  const result = applyVerticalMathCommand(problem, view, { action: 'show', locations })
  assert.equal(result.ok, true)
  return result.view
}

function request(problem, view, locations) {
  const result = applyVerticalMathCommand(problem, view, { action: 'hide', locations })
  assert.equal(result.ok, true)
  return result.view
}

test('plain correct, wrong, grouped, equivalent-decimal, overflow, and no-op answers use the full row', () => {
  const addition = buildVerticalAdditionProblem(['47', '26'])
  const initial = createVerticalAdditionView(addition)
  const correct = routeMathTextInput(addition, initial, ' 73 ')
  assert.equal(correct.kind, 'entry')
  assert.equal(evaluateVerticalMath(addition, correct.view).correct, true)
  const noOp = routeMathTextInput(addition, correct.view, '73')
  assert.deepEqual(noOp.locations, [])
  assert.deepEqual(noOp.view, correct.view)

  const wrong = routeMathTextInput(addition, initial, '74')
  assert.equal(wrong.kind, 'entry')
  assert.equal(evaluateVerticalMath(addition, wrong.view).correct, false)
  assert.equal(wrong.view.entries['result.ones'], '4')

  const groupedProblem = buildVerticalAdditionProblem(['700', '534'])
  const grouped = routeMathTextInput(groupedProblem, createVerticalAdditionView(groupedProblem), '1,234')
  assert.equal(grouped.kind, 'entry')
  assert.equal(evaluateVerticalMath(groupedProblem, grouped.view).correct, true)

  const decimalProblem = buildVerticalMultiplicationProblem(['2.50', '4.0'])
  const equivalent = routeMathTextInput(decimalProblem, createVerticalMultiplicationView(decimalProblem), '10')
  assert.equal(equivalent.kind, 'entry')
  assert.equal(evaluateVerticalMath(decimalProblem, equivalent.view).correct, true)

  const snapshot = structuredClone(initial)
  const overflow = routeMathTextInput(addition, initial, '1234')
  assert.equal(overflow.kind, 'invalid')
  assert.deepEqual(initial, snapshot)
})

test('single digit, carry, decimal boundary, and operator route only to their named target', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  let view = show(problem, createVerticalAdditionView(problem), ['result.*'])
  view = request(problem, view, ['result.ones'])
  const digit = routeMathTextInput(problem, view, '4')
  assert.deepEqual(digit.locations, ['result.ones'])

  view = show(problem, digit.view, ['result.ones'])
  view = request(problem, view, ['carry.tens'])
  const carry = routeMathTextInput(problem, view, '12')
  assert.deepEqual(carry.locations, ['carry.tens'])
  assert.equal(carry.view.entries['carry.tens'], '12')

  const decimalProblem = buildVerticalAdditionProblem(['1.2', '3.45'])
  let decimalView = show(decimalProblem, createVerticalAdditionView(decimalProblem), ['result.*'])
  decimalView = request(decimalProblem, decimalView, ['operand.1.decimal'])
  assert.equal(routeMathTextInput(decimalProblem, decimalView, '02').kind, 'invalid')
  assert.equal(routeMathTextInput(decimalProblem, decimalView, '2').kind, 'entry')

  decimalView = show(decimalProblem, decimalView, ['operand.1.decimal'])
  decimalView = request(decimalProblem, decimalView, ['operator'])
  const operator = routeMathTextInput(decimalProblem, decimalView, '*')
  assert.equal(operator.kind, 'entry')
  assert.equal(operator.view.entries.operator, '\u00d7')
})

test('malformed scalar input is invalid while prose and questions remain unchanged conversation', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  const view = createVerticalAdditionView(problem)
  for (const text of ['1,2', '12..3', '-1', '1 2']) {
    const result = routeMathTextInput(problem, view, text)
    assert.equal(result.kind, 'invalid', text)
    assert.equal(result.text, text)
  }
  for (const text of ['I do not understand', 'Why do I carry 1?', 'I think it is 73']) {
    assert.deepEqual(routeMathTextInput(problem, view, text), { kind: 'conversation', text })
  }
  assert.equal(routeMathTextInput(problem, view, '   ').kind, 'empty')
  assert.equal(isMathConversationQuestion('Why do I carry 1?'), true)
  assert.equal(isMathConversationQuestion('I think it is 73'), false)
})

test('conversation questions recognize bounded help phrases and curly apostrophes', () => {
  for (const text of [
    'I don\'t understand', 'I don\'t know', 'I am not sure', "I'm stuck",
    'I\u2019m stuck', 'I need help', 'help', 'This has a question? even with more text',
  ]) assert.equal(isMathConversationQuestion(text), true, text)

  for (const text of ['Whatever I write', 'Helpful explanation', 'However, I regrouped']) {
    assert.equal(isMathConversationQuestion(text), false, text)
  }
})

test('ambiguity requires an explicit editable cell or whole answer row and ignores stale selections', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  let view = show(problem, createVerticalAdditionView(problem), ['result.*'])
  view = request(problem, view, ['operand.1.ones', 'operand.2.ones'])
  const before = structuredClone(view)
  assert.equal(routeMathTextInput(problem, view, '1').kind, 'clarification')
  assert.equal(routeMathTextInput(problem, view, '1', { selectedLocation: 'result.ones' }).kind, 'clarification')
  const selected = routeMathTextInput(problem, view, '1', { selectedLocation: 'operand.2.ones' })
  assert.deepEqual(selected.locations, ['operand.2.ones'])
  assert.equal(Object.hasOwn(selected.view.entries, 'operand.1.ones'), false)
  assert.deepEqual(view, before)

  let mixed = createVerticalAdditionView(problem)
  mixed = request(problem, mixed, ['carry.tens'])
  assert.equal(routeMathTextInput(problem, mixed, '1').kind, 'clarification')
  const carry = routeMathTextInput(problem, mixed, '1', { selectedLocation: 'carry.tens' })
  assert.deepEqual(carry.locations, ['carry.tens'])
  assert.equal(Object.hasOwn(carry.view.entries, 'result.ones'), false)
  const row = routeMathTextInput(problem, mixed, '73', { selectedLocation: 'result.*' })
  assert.equal(row.kind, 'entry')
  assert.equal(Object.hasOwn(row.view.entries, 'carry.tens'), false)
})

test('a fully editable incomplete answer row stays the whole-answer target and does not infer work', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  const initial = createVerticalAdditionView(problem)
  const partial = routeMathTextInput(problem, initial, '7', { selectedLocation: 'result.ones' })
  assert.equal(partial.kind, 'entry')
  assert.equal(partial.view.entries['result.ones'], '7')
  const complete = routeMathTextInput(problem, partial.view, '73', { selectedLocation: 'result.ones' })
  assert.equal(complete.kind, 'entry')
  assert.equal(evaluateVerticalMath(problem, complete.view).complete, true)

  const withCarry = request(problem, initial, ['carry.tens'])
  const resultOnly = routeMathTextInput(problem, withCarry, '73', { selectedLocation: 'result.*' })
  assert.equal(resultOnly.kind, 'entry')
  assert.equal(Object.hasOwn(resultOnly.view.entries, 'carry.tens'), false)
})

test('division pair entry is atomic, accepts zero and wrong remainders, and bare numbers clarify', () => {
  const problem = buildVerticalDivisionProblem(['84', '7'])
  const initial = createVerticalDivisionView(problem)
  assert.equal(routeMathTextInput(problem, initial, '12').kind, 'clarification')

  const zero = routeMathTextInput(problem, initial, '12 r 0')
  assert.equal(zero.kind, 'entry')
  assert.equal(evaluateVerticalMath(problem, zero.view).correct, true)

  const wrong = routeMathTextInput(problem, initial, '12 REMAINDER 5')
  assert.equal(wrong.kind, 'entry')
  assert.equal(wrong.view.entries['remainder.ones'], '5')
  assert.equal(evaluateVerticalMath(problem, wrong.view).correct, false)

  const snapshot = structuredClone(initial)
  const malformed = routeMathTextInput(problem, initial, '12 r 1.2')
  assert.equal(malformed.kind, 'invalid')
  assert.deepEqual(initial, snapshot)
})

test('explicit division row edits preserve the other whole row', () => {
  const problem = buildVerticalDivisionProblem(['84', '7'])
  const entered = routeMathTextInput(problem, createVerticalDivisionView(problem), '12 r 3')
  const edited = routeMathTextInput(problem, entered.view, '11', { selectedLocation: 'result.*' })
  assert.equal(edited.kind, 'entry')
  assert.equal(edited.view.entries['remainder.ones'], '3')
  assert.equal(edited.view.entries['result.tens'], '1')
  assert.equal(edited.view.entries['result.ones'], '1')
})

test('all-given views have no learner target and shared callers receive identical pure routing', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  const allGiven = show(problem, createVerticalAdditionView(problem), ['result.*'])
  assert.equal(routeMathTextInput(problem, allGiven, '73').kind, 'clarification')
  assert.deepEqual(routeMathTextInput(problem, allGiven, 'Can you explain 73?'), {
    kind: 'conversation', text: 'Can you explain 73?',
  })

  const view = createVerticalAdditionView(problem)
  const slateTeacher = (text) => routeMathTextInput(problem, view, text)
  const liftoffTeacher = (text) => routeMathTextInput(problem, view, text)
  assert.deepEqual(slateTeacher('74'), liftoffTeacher('74'))
})
