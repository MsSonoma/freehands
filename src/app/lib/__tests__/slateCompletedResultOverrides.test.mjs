import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { applySlateTestResultOverrides, buildSlateTestReportFromEvents } from '../slateTestGradeReport.mjs'

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const liftoff = source('../../session/slate/SlateLiftoffExperience.jsx')
const modal = source('../../components/FacilitatorOverrideModal.jsx')
const reportView = source('../../session/slate/SlateIndependentTestReport.jsx')
const route = source('../../api/slate-liftoff/records/overrides/route.js')

test('facilitator corrections are additive; original independent results and mastery evidence are unchanged', () => {
  const events = [
    { event_type: 'item_presented', payload: { question_index: 0, item: { question: 'One plus one?', expectedAny: ['2'] } } },
    { event_type: 'answer_evaluated', payload: { question_index: 0, response_value: '2', judgment_reason: 'Correct.' }, result: { correct: true, judgment_status: 'correct' } },
    { event_type: 'item_presented', payload: { question_index: 1, item: { question: 'Two plus two?', expectedAny: ['4'] } } },
    { event_type: 'answer_evaluated', payload: { question_index: 1, response_value: 'Four', judgment_reason: 'No credit.' }, result: { correct: false, judgment_status: 'incorrect' } },
  ]
  const original = buildSlateTestReportFromEvents(events, 50)
  const before = JSON.stringify(original)
  const reviewed = applySlateTestResultOverrides(original, [
    { id: '1', action: 'grade', question_index: 1, corrected_status: 'partial', feedback: 'The learner named four.', created_at: '2026-11-03T01:00:00Z' },
    { id: '2', action: 'grade', question_index: 1, corrected_status: 'correct', feedback: 'Written answer is correct.', created_at: '2026-11-03T02:00:00Z' },
    { id: '3', action: 'question', question_index: 0, feedback: 'The example is ambiguous.', created_at: '2026-11-03T03:00:00Z' },
  ])
  assert.equal(JSON.stringify(original), before)
  assert.equal(original.percentage, 50)
  assert.equal(reviewed.percentage, 50)
  assert.equal(reviewed.score.percentage, 50)
  assert.equal(reviewed.adjustedPercentage, 100)
  assert.equal(reviewed.items[1].judgmentStatus, 'incorrect')
  assert.equal(reviewed.items[1].facilitatorGradeReview.corrected_status, 'correct')
  assert.equal(reviewed.items[0].facilitatorQuestionReview.action, 'question')
  assert.equal(reviewed.items[0].item.expectedAny[0], '2')
})

test('result view remains until explicit close, scrolls, and heartbeat does not dismiss completed lessons', () => {
  assert.match(liftoff, /completionSettledRef\.current = true/)
  assert.match(liftoff, /if \(completionSettledRef\.current\) return/)
  assert.match(liftoff, /data-slate-completed-results/)
  assert.match(liftoff, /data-slate-results-scroll[^>]*overflowY: 'auto'/)
  assert.match(liftoff, /CLOSE RESULTS/)
  assert.match(liftoff, /localStorage\.removeItem\(resultMarkerKey\)/)
  assert.match(liftoff, /loadCompletedReport\(savedResultExecution\)/)
})

test('shared facilitator PIN overlay and server authority protect recorded grade corrections', () => {
  assert.match(modal, /targetType === 'result'/)
  assert.match(modal, /requestFacilitatorPinException/)
  assert.match(modal, /correctedStatus, feedback: feedback\.trim\(\), pin: pinRef\.current/)
  assert.match(reportView, /FacOR: Correct grade/)
  assert.match(reportView, /FacOR: Bad question/)
  assert.match(route, /verifyFacilitatorPinForUser/)
  assert.match(route, /learning_evidence_events/)
  assert.match(route, /slate_test_result_overrides/)
  assert.doesNotMatch(route, /\.update\(/)
})
