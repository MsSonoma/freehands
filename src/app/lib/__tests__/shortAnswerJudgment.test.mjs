import assert from 'node:assert/strict'
import test from 'node:test'
import { parseShortAnswerJudgment } from '../shortAnswerJudgment.mjs'

test('semantic judgments preserve status and a concrete reason', () => {
  const correct = parseShortAnswerJudgment(JSON.stringify({ status: 'correct', reason: 'The inverse equation verifies the subtraction.' }))
  assert.deepEqual(correct, { status: 'correct', correct: true, reason: 'The inverse equation verifies the subtraction.' })
  const partial = parseShortAnswerJudgment(JSON.stringify({ status: 'partial', reason: 'The example aligns columns but does not explain the place-value relationship.' }))
  assert.equal(partial.correct, false)
  assert.equal(partial.status, 'partial')
  const incorrect = parseShortAnswerJudgment(JSON.stringify({ status: 'incorrect', reason: 'The stated subtraction changes the wrong value.' }))
  assert.equal(incorrect.correct, false)
})

test('empty, truncated, or unrecognized model output is an evaluation error, never incorrect', () => {
  for (const raw of ['', 'INCORRECT', '{"status":"incorrect"}', '{"status":"incorrect","reason":""}', '{"status":"unknown","reason":"Something else"}', '{"status":"correct"']) {
    assert.throws(() => parseShortAnswerJudgment(raw), /invalid JSON|incomplete judgment/, raw)
  }
})
