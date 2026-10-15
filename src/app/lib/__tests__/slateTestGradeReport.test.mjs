import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSlateTestReportFromEvents, slateTestResultStatus, summarizeSlateTestResults } from '../slateTestGradeReport.mjs'

test('correct is one point, partial is half credit, incorrect is zero', () => {
  const results = [
    { correct: true, judgmentStatus: 'correct' },
    { correct: false, judgmentStatus: 'partial' },
    { correct: false, judgmentStatus: 'incorrect' },
    { correct: true, judgmentStatus: 'correct' },
  ]
  assert.deepEqual(summarizeSlateTestResults(results), {
    correct: 2, partial: 1, incorrect: 1, ungraded: 0,
    total: 4, points: 2.5, percentage: 63, complete: true,
  })
  assert.equal(slateTestResultStatus({ correct: true }), 'correct')
  assert.equal(slateTestResultStatus({ correct: false }), 'incorrect')
  assert.equal(summarizeSlateTestResults([...results, {}]).percentage, null)
})

test('durable canonical evidence reconstructs question-level marks and reasons', () => {
  const events = [
    { event_type: 'item_presented', payload: { question_index: 0, item: { question: 'How can you check 94 - 38 = 56?' } } },
    { event_type: 'answer_evaluated', payload: { question_index: 0, response_value: '56 + 38 = 94', correct_answer: 'Use inverse addition', judgment_reason: 'The inverse equation confirms the subtraction.' }, result: { correct: true, judgment_status: 'correct' } },
    { event_type: 'item_presented', payload: { question_index: 1, item: { question: 'Explain why columns align.' } } },
    { event_type: 'answer_evaluated', payload: { question_index: 1, response_value: 'Ones go with ones', correct_answer: 'Equal place values align', judgment_reason: 'The response identifies the alignment but not why it works.' }, result: { correct: false, judgment_status: 'partial' } },
  ]
  const report = buildSlateTestReportFromEvents(events, 75)
  assert.equal(report.percentage, 75)
  assert.equal(report.legacy, false)
  assert.equal(report.items[0].question, 'How can you check 94 - 38 = 56?')
  assert.equal(report.items[0].answer, '56 + 38 = 94')
  assert.equal(report.items[0].judgmentReason, 'The inverse equation confirms the subtraction.')
  assert.equal(report.score.percentage, 75)
})

test('older judgments are labeled legacy and their recorded scores are not silently changed', () => {
  const events = [
    { event_type: 'item_presented', payload: { question_index: 3, item: { question: '254 - 121?' } } },
    { event_type: 'answer_evaluated', payload: { question_index: 3, response_value: 'The answer is 133', correct_answer: '133' }, result: { correct: false } },
  ]
  const report = buildSlateTestReportFromEvents(events, 50)
  assert.equal(report.legacy, true)
  assert.equal(report.percentage, 50)
  assert.equal(report.items[0].judgmentReason, '')
  assert.equal(report.items[0].correct, false)
  assert.equal(buildSlateTestReportFromEvents([], 50), null)
})
