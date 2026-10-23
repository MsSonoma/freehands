import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { judgeAnswer, judgeTestAnswer, buildAcceptableList } from '../../session/v2/judging.js'
import { summarizeSlateTestResults } from '../slateTestGradeReport.mjs'
import { buildSonomaTestGradeReport, normalizeSavedSonomaTestAnswers } from '../sonomaTestGradeReport.mjs'
import { assertStage1EventType } from '../masteryEvidence/schema.js'

test('MC and true/false are graded by the existing deterministic answer key', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => { throw Error('Keyed questions must not call the model') }
  try {
    const mc = { type: 'mc', choices: ['A', 'B', 'C'], correct: 1 }
    const right = await judgeTestAnswer('B', buildAcceptableList(mc), mc)
    assert.equal(right.status, 'correct')
    assert.equal(right.evaluationMode, 'answer_key')
    const wrong = await judgeTestAnswer('C', buildAcceptableList(mc), mc)
    assert.equal(wrong.status, 'incorrect')
    const tf = { type: 'tf', answer: true, expectedAny: ['True'] }
    assert.equal((await judgeTestAnswer('True', buildAcceptableList(tf), tf)).status, 'correct')
    assert.equal((await judgeTestAnswer('False', buildAcceptableList(tf), tf)).status, 'incorrect')
  } finally { globalThis.fetch = origFetch }
})

test('semantic judgments preserve correct/partial/incorrect, reasons and existing boolean compatibility', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/judge-short-answer')
    const body = JSON.parse(options.body)
    calls.push(body)
    const answer = String(body.learnerAnswer)
    const status = answer === 'complete' ? 'correct' : answer === 'some understanding' ? 'partial' : 'incorrect'
    return { ok: true, json: async () => ({ correct: status === 'correct', status, reason: 'The response shows the corresponding degree of understanding.' }) }
  }
  const question = { type: 'short', question: 'Explain a habitat.', expectedAny: ['A place where an animal lives.'], requiresReasoning: true }
  try {
    const refs = buildAcceptableList(question)
    const correct = await judgeTestAnswer('complete', refs, question)
    const partial = await judgeTestAnswer('some understanding', refs, question)
    const incorrect = await judgeTestAnswer('wrong', refs, question)
    assert.deepEqual([correct.status, partial.status, incorrect.status], ['correct','partial','incorrect'])
    assert.equal(partial.correct, false)
    assert.match(partial.reason,/degree of understanding/)
    assert.equal(calls[1].requiresReasoning,true)
    assert.equal(await judgeAnswer('some understanding', refs, question), false)
    assert.equal(summarizeSlateTestResults([
      { judgmentStatus: correct.status },
      { judgmentStatus: partial.status },
      { judgmentStatus: incorrect.status },
    ]).percentage, 50)
  } finally { globalThis.fetch = original }
})

test('unavailable semantic evaluation retains an ungraded result, never a wrong one', async () => {
  const original = globalThis.fetch
  let attempts = 0
  globalThis.fetch = async () => { attempts++; return { ok: false, status: 503 } }
  try {
    const q = { type: 'fib', question: 'A _____ is a home for an animal.', expectedAny: ['habitat'] }
    const result = await judgeTestAnswer('habitat', buildAcceptableList(q), q)
    assert.equal(result.status,'ungraded')
    assert.equal(result.correct,null)
    assert.equal(attempts,3)
    assert.equal(summarizeSlateTestResults([{ judgmentStatus:'correct' }, {judgmentStatus:result.status}]).percentage,null)
  } finally {globalThis.fetch=original}
})

test('historical Sonoma Test reporting preserves recorded mismatch and original decisions', () => {
  const events = [
    {phase:'test',event_type:'item_presented',payload:{question_index:0,item:{question:'What is habitat?'}}},
    {phase:'test',event_type:'answer_evaluated',payload:{question_index:0,response_value:'Animal home'},result:{correct:true}},
    {phase:'test',event_type:'item_presented',payload:{question_index:1,item:{question:'What is climate?'}}},
    {phase:'test',event_type:'answer_evaluated',payload:{question_index:1,response_value:'The local air'},result:{correct:false}},
  ]
  const report = buildSonomaTestGradeReport(events,0)
  assert.equal(report.legacy,true)
  assert.equal(report.recordedPercentage,0)
  assert.equal(report.derivedPercentage,50)
  assert.equal(report.scoreMismatch,true)
  assert.equal(report.items[0].originalStatus,'correct')
  assert.equal(report.items[1].originalStatus,'incorrect')
  assert.equal(report.items[1].judgmentReason,'')
})

test('facilitator review preserves the initial decision and records revisions independently', () => {
  assert.doesNotThrow(() => assertStage1EventType('test_grade_reviewed'))
  const events = [
    {phase:'test',event_type:'item_presented',payload:{question_index:0,item:{question:'Describe a desert climate.'}}},
    {phase:'test',event_type:'answer_evaluated',payload:{question_index:0,response_value:'Hot and dry',judgment_reason:'Missing essential details.'},result:{correct:false,judgment_status:'partial'}},
    {phase:'test',event_type:'test_grade_reviewed',occurred_at:'2026-10-23T13:00:00Z',payload:{question_index:0,previous_status:'partial',revised_status:'correct',revised_reason:'The prompt only required a basic description.',reviewed_by:'pin_verified_facilitator'}},
  ]
  const report = buildSonomaTestGradeReport(events,100)
  assert.equal(report.items[0].originalStatus,'partial')
  assert.equal(report.items[0].judgmentStatus,'correct')
  assert.equal(report.items[0].reviews.length,1)
  assert.equal(report.items[0].reviews[0].previousStatus,'partial')
  assert.equal(report.score.percentage,100)
  assert.equal(report.scoreMismatch,false)
})

test('Test writes the answer before its snapshot and does not emit answer reveal while answering', () => {
  const phase = fs.readFileSync('src/app/session/v2/TestPhase.jsx','utf8')
  const submit = phase.slice(phase.indexOf('async submitAnswer('),phase.indexOf('// Public API: Skip question'))
  assert.ok(submit.indexOf('this.#answers.push(result)') < submit.indexOf("trigger: 'test-answer'"))
  assert.doesNotMatch(submit,/this\.#emit\('answerRevealed'/)
  assert.match(phase, /applyFacilitatorReview\(index, status, reason\)/)
  assert.match(phase, /getResults\(\)/)
})

test('completion uses finalized reference and preserves missing grade as null', () => {
  const session = fs.readFileSync('src/app/session/v2/SessionPageV2.jsx','utf8')
  const route = fs.readFileSync('src/app/api/syllabus/execution/complete/route.js','utf8')
  assert.match(session,/test_percentage: testGradeRef\.current\?\.percentage \?\? null/)
  assert.match(session,/testPercentage: testGradeRef\.current\?\.percentage \?\? null/)
  assert.match(route,/rawPercentage == null \|\| rawPercentage === '' \? null : Number\(rawPercentage\)/)
  assert.doesNotMatch(route,/const percentage = Number\(body\?\.testPercentage\)/)
})


test('existing saved Sonoma Test decisions retain their original score on resume', () => {
  const legacy = [
    { questionId:'a', userAnswer:'true', isCorrect:true },
    { questionId:'b', userAnswer:'false', isCorrect:false },
    { questionId:'c', userAnswer:null, isCorrect:false, skipped:true },
  ]
  const normalized = normalizeSavedSonomaTestAnswers(legacy)
  assert.deepEqual(normalized.map(q => q.judgmentStatus), ['correct','incorrect','incorrect'])
  assert.equal(normalized.every(q => q.legacyEvaluation === true), true)
  assert.equal(summarizeSlateTestResults(normalized).percentage, 33)
  assert.deepEqual(legacy.map(q => q.judgmentStatus), [undefined,undefined,undefined])
  const native = { questionId:'d', isCorrect:false, judgmentStatus:'partial', judgmentReason:'Some mastery.' }
  assert.deepEqual(normalizeSavedSonomaTestAnswers([native])[0], native)
})

test('resume into Test review preserves saved review position and legacy judgment normalization', () => {
  const phase = fs.readFileSync('src/app/session/v2/TestPhase.jsx','utf8')
  assert.match(phase, /normalizeSavedSonomaTestAnswers\(this\.#resumeState\.answers\)/)
  assert.match(phase, /this\.startReview\(\{ preserveIndex: true \}\)/)
  assert.match(phase, /if \(!preserveIndex\) this\.#reviewIndex = 0/)
  const session = fs.readFileSync('src/app/session/v2/SessionPageV2.jsx','utf8')
  assert.match(session, /phase\.on\('reviewStart', \(\) => \{/)
})

test('facilitator review reason uses Sonoma keyboard without opening native keyboard', () => {
  const source = fs.readFileSync('src/app/session/v2/SessionPageV2.jsx','utf8')
  assert.match(source, /openReviewKeyboard=\{openSonomaTextInput\}/)
  assert.match(source, /inputMode="none"\s+onPointerDown=\{\(event\) => openReviewKeyboard/)
})

test('incomplete historical events do not manufacture a new test percentage', () => {
  const events = [
    { phase:'test', event_type:'item_presented', payload:{question_index:0,total_questions:3,item:{question:'First?'}} },
    { phase:'test', event_type:'answer_evaluated', payload:{question_index:0,response_value:'A'}, result:{correct:true} },
    { phase:'test', event_type:'item_presented', payload:{question_index:1,total_questions:3,item:{question:'Second?'}} },
    { phase:'test', event_type:'answer_evaluated', payload:{question_index:1,response_value:'B'}, result:{correct:false} },
    { phase:'test', event_type:'item_presented', payload:{question_index:2,total_questions:3,item:{question:'Third?'}} },
  ]
  const report = buildSonomaTestGradeReport(events, 33)
  assert.equal(report.expectedCount, 3)
  assert.equal(report.observedCount, 2)
  assert.equal(report.incomplete, true)
  assert.equal(report.derivedPercentage, null)
  assert.equal(report.recordedPercentage, 33)
  assert.equal(report.scoreMismatch, false)
})

test('separate Slate and Webb evidence histories do not inherit Sonoma grading reports', async () => {
  const { aggregateFacilitatorEvidenceSession } = await import('../masteryEvidence/reporting.js')
  const events = [
    { phase:'test', event_type:'item_presented', payload:{question_index:0,item:{question:'First?'}} },
    { phase:'test', event_type:'answer_evaluated', payload:{question_index:0,response_value:'answer'}, result:{correct:true} },
  ]
  const slate = aggregateFacilitatorEvidenceSession({
    trackedSession:{ instructional_teacher:'slate' }, events,
  })
  const webb = aggregateFacilitatorEvidenceSession({
    trackedSession:{ instructional_teacher:'webb' }, events,
  })
  assert.equal(slate.test_report, null)
  assert.equal(webb.test_report, null)
})
