import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const file = (p) => readFileSync(p, 'utf8')
const judge = file('src/app/api/judge-short-answer/route.js')
const slate = file('src/app/session/slate/SlateLiftoffExperience.jsx')
const evidence = file('src/app/lib/masteryEvidence/client.js')
const record = file('src/app/api/slate-liftoff/records/route.js')
const overlay = file('src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js')

test('existing shared semantic judge never treats malformed AI output as incorrect', () => {
  assert.match(judge, /parseShortAnswerJudgment/)
  assert.match(judge, /max_completion_tokens: tokenBudget/)
  assert.match(judge, /status: 503/)
  assert.doesNotMatch(judge, /judgement\.includes\('CORRECT'\)/)
})

test('Slate independent test retains partial reasoning, explanation, and retry-on-error', () => {
  const submit = slate.slice(slate.indexOf('const submitAssessmentAnswer = useCallback'), slate.indexOf("  }, [appendTranscript", slate.indexOf('const submitAssessmentAnswer = useCallback')))
  assert.match(submit, /const judgment = await judgeAssessmentItem/)
  assert.match(submit, /judgmentStatus: judgment\.status/)
  assert.match(submit, /judgmentReason: judgment\.reason/)
  assert.match(submit, /persistLiftoffSnapshot/)
  assert.doesNotMatch(submit, /reason.*appendTranscript\('assistant'/)
  assert.match(slate, /Grading is temporarily unavailable\. Your answer is saved/)
  assert.match(slate, /const score = summarizeSlateTestResults\(results\)/)
})

test('report exists after test and in facilitator historical records, without inventing a regrade', () => {
  assert.match(slate, /<SlateIndependentTestReport items=\{testResults\} percentage=\{finalPercentage\}/)
  assert.match(evidence, /judgment_status: String\(judgmentStatus\)/)
  assert.match(evidence, /judgment_reason: String\(judgmentReason\)/)
  assert.match(record, /buildSlateTestReportFromEvents/)
  assert.match(record, /\.eq\('facilitator_id', context\.user\.id\)/)
  assert.match(overlay, /View independent test grading report/)
  assert.match(overlay, /legacy=\{liftoffRecord\.test_report\.legacy\}/)
})
