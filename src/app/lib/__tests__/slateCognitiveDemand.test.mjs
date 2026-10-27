import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeSlateCognitiveDemand, validateSlateCognitiveDemand } from '../slateCognitiveDemand.mjs'

test('accepts a single Moon comparison operation', () => {
  const result = validateSlateCognitiveDemand({
    prompt: 'Which Moon position shows more of the bright half from Earth?',
    criterion: 'Compare which position shows more of the bright half.',
    demandType: 'compare',
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.deepEqual(result.operations, ['compare'])
})

test('rejects compare plus explanation bundling', () => {
  const result = analyzeSlateCognitiveDemand({
    prompt: 'Compare the two Moon positions and explain why the visible lit portion changes.',
    criterion: 'Compare the positions and explain the change.',
    demandType: 'compare',
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'stacked_cognitive_demands')
  assert.ok(result.operations.includes('compare'))
  assert.ok(result.operations.includes('explain'))
})

test('rejects engineering evaluation plus evidence plus explanation bundling', () => {
  const result = validateSlateCognitiveDemand({
    prompt: 'Which design better meets the rules? Use the test results to explain why.',
    criterion: 'Evaluate the better design using evidence and explain why.',
    demandType: 'evaluate',
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'stacked_cognitive_demands')
})

test('accepts a focused explanation when the observation is supplied', () => {
  const result = validateSlateCognitiveDemand({
    prompt: 'The Sun lights half of the Moon in both positions. Why can the Moon still look different from Earth?',
    criterion: 'Explain why the Moon can look different from Earth even though half is lit.',
    demandType: 'explain',
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.deepEqual(result.operations, ['explain'])
})

test('rejects several requested outputs hidden under one identify verb', () => {
  const result = validateSlateCognitiveDemand({
    prompt: 'State the design problem, one criterion for success, and one constraint.',
    criterion: 'State the problem, criterion, and constraint.',
    demandType: 'identify',
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'multiple_response_targets')
})
