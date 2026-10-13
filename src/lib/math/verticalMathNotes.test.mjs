import assert from 'node:assert/strict'
import test from 'node:test'

import { buildVerticalAdditionProblem } from './verticalAddition.mjs'
import { buildVerticalMultiplicationProblem } from './verticalMultiplication.mjs'
import { buildVerticalSubtractionProblem } from './verticalSubtraction.mjs'
import { createVerticalMathView, enterVerticalMathFullAnswer, evaluateVerticalMath } from './verticalMath.mjs'
import {
  createVerticalMathWorkingNotes,
  listVerticalMathWorkingNoteSlots,
  restoreVerticalMathWorkingNotes,
  sanitizeVerticalMathWorkingNotes,
  updateVerticalMathWorkingNote,
  VERTICAL_MATH_WORKING_NOTE_LIMIT,
} from './verticalMathNotes.mjs'

function slots(problem) {
  return listVerticalMathWorkingNoteSlots(problem, createVerticalMathView(problem))
}

test('addition offers blank carry notes by visible top-addend place without solved values', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  assert.deepEqual(slots(problem).map((slot) => slot.key), ['carry.hundreds', 'carry.tens', 'carry.ones'])
  assert.equal(slots(problem).some((slot) => Object.hasOwn(slot, 'value')), false)
})

test('addition includes the leading overflow carry slot', () => {
  const found = slots(buildVerticalAdditionProblem(['99', '99']))
  assert.deepEqual(found.map((slot) => slot.key), ['carry.hundreds', 'carry.tens', 'carry.ones'])
  assert.equal(found.some((slot) => Object.hasOwn(slot, 'value')), false)
})

test('subtraction overlays every visible top digit for direct and chained regrouping', () => {
  assert.deepEqual(slots(buildVerticalSubtractionProblem(['42', '18'])).map((slot) => slot.key), [
    'replacement.tens', 'replacement.ones',
  ])
  assert.deepEqual(slots(buildVerticalSubtractionProblem(['100', '27'])).map((slot) => slot.key), [
    'replacement.hundreds', 'replacement.tens', 'replacement.ones',
  ])
})

test('multiplication has distinct scratch slots for each carry step and sum carries', () => {
  const found = slots(buildVerticalMultiplicationProblem(['47', '26']))
  assert(found.some((slot) => slot.key.startsWith('multiply_carry.1.')))
  assert(found.some((slot) => slot.key.startsWith('multiply_carry.2.')))
  assert(found.some((slot) => slot.key.startsWith('sum_carry.')))
  assert.equal(new Set(found.map((slot) => slot.key)).size, found.length)
})

test('notes are digits-only, two digits maximum, explicitly keyed, and bounded', () => {
  assert.equal(VERTICAL_MATH_WORKING_NOTE_LIMIT, 192)
  const validKeys = ['carry.ones', 'carry.tens']
  let notes = updateVerticalMathWorkingNote({}, 'carry.ones', '12', { validKeys })
  notes = updateVerticalMathWorkingNote(notes, 'carry.tens', 'x', { validKeys })
  notes = updateVerticalMathWorkingNote(notes, 'result.ones', '9', { validKeys })
  assert.deepEqual(notes, { 'carry.ones': '12' })
  assert.deepEqual(sanitizeVerticalMathWorkingNotes({ 'carry.ones': '123', 'carry.tens': '4' }, { validKeys }), { 'carry.tens': '4' })
  const oversized = Object.fromEntries(Array.from({ length: VERTICAL_MATH_WORKING_NOTE_LIMIT + 10 }, (_, index) => [
    'multiply_carry.' + (index + 1) + '.ones', '1',
  ]))
  assert.equal(Object.keys(sanitizeVerticalMathWorkingNotes(oversized)).length, VERTICAL_MATH_WORKING_NOTE_LIMIT)
  const bounded = sanitizeVerticalMathWorkingNotes({
    'carry.ones': '09',
    'carry.tens': 7,
    'carry.hundreds': '',
    'carry.thousands': '1.5',
    ['carry.' + 'x'.repeat(81)]: '1',
  })
  assert.deepEqual(bounded, { 'carry.ones': '09', 'carry.tens': '7' })
})

test('activity-scoped snapshots restore only for the exact activity', () => {
  const saved = createVerticalMathWorkingNotes('activity-a', { 'carry.ones': '9' })
  assert.deepEqual(restoreVerticalMathWorkingNotes(saved, { activityId: 'activity-a' }).notes, { 'carry.ones': '9' })
  assert.deepEqual(restoreVerticalMathWorkingNotes(saved, { activityId: 'activity-b' }).notes, {})
})

test('activity id helper state stays isolated between otherwise identical note sets', () => {
  const forActivity = (activityId) => createVerticalMathWorkingNotes(activityId, { 'carry.ones': '9' })
  const first = forActivity('helper-a')
  const second = forActivity('helper-b')
  assert.deepEqual(restoreVerticalMathWorkingNotes(first, { activityId: second.activityId }).notes, {})
  assert.deepEqual(restoreVerticalMathWorkingNotes(second, { activityId: second.activityId }).notes, { 'carry.ones': '9' })
})

test('incorrect notes do not enter the view or affect answer evaluation in teaching or test', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  const base = createVerticalMathView(problem)
  const entered = enterVerticalMathFullAnswer(problem, base, '73')
  assert.equal(entered.ok, true)
  const before = evaluateVerticalMath(problem, entered.view)
  const notes = updateVerticalMathWorkingNote({}, 'carry.ones', '99', {
    validKeys: slots(problem).map((slot) => slot.key),
  })
  const after = evaluateVerticalMath(problem, entered.view)
  assert.deepEqual(notes, { 'carry.ones': '99' })
  assert.deepEqual(after, before)
  assert.deepEqual(entered.view.entries, { 'result.tens': '7', 'result.ones': '3' })
})
