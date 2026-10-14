import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVerticalMultiplicationProblem, createVerticalMultiplicationView } from './verticalMultiplication.mjs'
import {
  multiplicationScratchSlotIds, multiplicationScratchIsShiftZero,
  sanitizeMultiplicationScratchEntries, updateMultiplicationScratchEntry,
} from './multiplicationScratch.mjs'

test('partial-product row count is the multiplier coefficient digit count', () => {
  for (const [first, second, count] of [
    ['9', '8', 1], ['47', '26', 2], ['123', '405', 3],
    ['12.3', '4.56', 3], ['1234567', '9876543', 7],
    ['7', '0.004', 4],
  ]) {
    const problem = buildVerticalMultiplicationProblem([first, second])
    assert.equal(problem.partialRows.length, count, first + ' times ' + second)
    assert.equal(problem.layout.filter((item) => item.rowId?.startsWith('partial.')).length, count)
    assert.deepEqual(problem.partialRows.map((row) => row.id),
      Array.from({ length: count }, (_, index) => 'partial.' + (index + 1)))
    // The canonical math-session view still conceals solved work and grades no scratch entries.
    const base = createVerticalMultiplicationView(problem)
    assert(problem.partialRows.every((row) => row.cells.every((cell) =>
      base.hidden.includes(cell.id))))
    assert(!Object.keys(base.entries).length)
  }
})

test('only non-shift positions are editable; shift zeros appear as fixed place value', () => {
  const problem = buildVerticalMultiplicationProblem(['47', '26'])
  const [first, second] = problem.partialRows
  assert.deepEqual(multiplicationScratchSlotIds(problem), [
    'partial.1.hundreds', 'partial.1.tens', 'partial.1.ones',
    'partial.2.hundreds', 'partial.2.tens',
  ])
  assert.equal(multiplicationScratchIsShiftZero(second, second.cells.find((cell) => cell.place === 0)), true)
  assert.equal(multiplicationScratchIsShiftZero(first, first.cells.find((cell) => cell.place === 0)), false)
  assert.equal(multiplicationScratchSlotIds(problem).includes('partial.2.ones'), false)
  assert.equal(multiplicationScratchSlotIds(problem).includes('result.ones'), false)
})

test('scratch entries only include learner-entered single digits, not hidden calculated values', () => {
  const problem = buildVerticalMultiplicationProblem(['123', '405'])
  assert.deepEqual(sanitizeMultiplicationScratchEntries(problem, null), {})
  assert.deepEqual(sanitizeMultiplicationScratchEntries(problem, {
    'partial.1.ones': '5',
    'partial.2.ones': '7',
    'partial.2.tens': '0',
    'partial.3.hundreds': '2',
    'partial.3.thousands': '10',
    'result.ones': '8',
    anything: '9',
  }), {
    'partial.1.ones': '5',
    'partial.2.tens': '0',
    'partial.3.hundreds': '2',
  })
  assert.deepEqual(updateMultiplicationScratchEntry(problem, {}, 'partial.1.ones', '5'),
    { 'partial.1.ones': '5' })
  assert.deepEqual(updateMultiplicationScratchEntry(problem, { 'partial.1.ones': '5' }, 'partial.1.ones', ''), {})
  assert.equal(updateMultiplicationScratchEntry(problem, {}, 'partial.1.ones', '56'), null)
  assert.equal(updateMultiplicationScratchEntry(problem, {}, 'partial.2.ones', '0'), null)
})
