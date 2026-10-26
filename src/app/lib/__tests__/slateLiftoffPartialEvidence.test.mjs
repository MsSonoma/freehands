import assert from 'node:assert/strict'
import test from 'node:test'
import { filterLiftoffPartialEvidence } from '../slateLiftoffPartialEvidence.mjs'

const observation = (componentId, result, responseStatus, responseQuote) => ({
  componentId, result, responseStatus, responseQuote, independent: true,
})

test('correct answer credited while omitted explanation and identification remain unobserved', () => {
  const rows = [
    observation('calculate', 'independent_success', 'correct', '8'),
    observation('explain', 'failure', 'not_addressed', ''),
    observation('identify', 'failure', 'incorrect', ''),
  ]
  const result = filterLiftoffPartialEvidence(rows, '8')
  assert.deepEqual(result.map(row => row.componentId), ['calculate'])
})

test('two correct components and one actual wrong response preserve both successes and failure', () => {
  const result = filterLiftoffPartialEvidence([
    observation('calculate', 'independent_success', 'correct', '8'),
    observation('identify', 'independent_success', 'correct', 'division'),
    observation('explain', 'failure', 'incorrect', 'because six times eight is forty'),
  ], '8; division; because six times eight is forty')
  assert.deepEqual(result.map(row => row.result), ['independent_success', 'independent_success', 'failure'])
})

test('an observed mistake and a correct explanation can coexist', () => {
  const result = filterLiftoffPartialEvidence([
    observation('calculate', 'failure', 'incorrect', '9'),
    observation('reason', 'independent_success', 'correct', 'six groups of eight'),
  ], '9, but six groups of eight')
  assert.deepEqual(result.map(row => row.componentId), ['calculate', 'reason'])
})

test('unquoted or mismatched observations are discarded rather than making the learner wrong', () => {
  const result = filterLiftoffPartialEvidence([
    observation('explain', 'failure', 'incorrect', 'not supplied'),
    observation('identify', 'failure', 'incorrect', ''),
    observation('calculate', 'independent_success', 'correct', '8'),
  ], '8')
  assert.deepEqual(result.map(row => row.componentId), ['calculate'])
})

test('later missing evidence can be credited on its own turn', () => {
  const first = filterLiftoffPartialEvidence([
    observation('calculate', 'independent_success', 'correct', '8'),
    observation('identify', 'failure', 'not_addressed', ''),
  ], '8')
  const second = filterLiftoffPartialEvidence([
    observation('identify', 'independent_success', 'correct', 'division'),
  ], 'division')
  assert.deepEqual([...first, ...second].map(row => row.componentId), ['calculate', 'identify'])
})

test('complete correct response records all evidence', () => {
  const result = filterLiftoffPartialEvidence([
    observation('calculate', 'independent_success', 'correct', '8'),
    observation('identify', 'independent_success', 'correct', 'division'),
  ], '8, division')
  assert.equal(result.length, 2)
})
