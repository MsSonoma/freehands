import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import {
  selectTestRephraseSources,
  createTestRephraseInstruction,
  applyRephrasedTestQuestions,
  rephraseAssessmentTest,
  assessmentQuestionType,
  requestRephrasedAssessmentTest,
} from '../../session/assessment/testRephrase.mjs'
import { buildAcceptableList, judgeAnswer } from '../../session/v2/judging.js'
import { isTrueFalse, isMultipleChoice, isFillInBlank } from '../../session/utils/questionFormatting.js'

function lesson() {
  const make = (kind, n, ext) => Array.from({ length: n }, (_, i) => ({
    id: kind + '-' + (i + 1),
    question: kind + ' example ' + (i + 1) + '?',
    ...ext,
  }))
  return {
    title: 'Animal habitats', grade: '4th',
    learningObjectives: [
      { id: 'identify', name: 'Identify habitats', evidenceType: 'recognition' },
      { id: 'explain', name: 'Explain adaptations', evidenceType: 'reasoned_explanation' },
    ],
    test: [
      { id: 'test-identify', objectiveId: 'identify', question: 'What is a desert habitat?', expectedAny: ['dry land'] },
      { id: 'test-explain', objectiveId: 'explain', question: 'Explain why a camel can survive in a desert.', expectedAny: ['It stores fat for energy and is adapted to dry conditions.'] },
    ],
    multiplechoice: make('MC', 10, { choices: ['forest', 'desert', 'ocean', 'mountain'], correct: 1, expectedAny: ['desert'] }),
    truefalse: make('TF', 10, { answer: true, expectedAny: ['true'] }),
    fillintheblank: make('FITB', 10, { expectedAny: ['habitat'] }).map(item => ({ ...item, question: item.question + ' The animal lives in the _____. ' })),
    shortanswer: make('SA', 10, { expectedAny: ['habitat'] }),
  }
}

function paraphrase(sources) {
  return { items: sources.map(item => ({
    id: item.id,
    question: 'In other words, ' + item.question,
  })) }
}

test('the Test can borrow source wording without removing any generated practice item', () => {
  const source = lesson()
  const original = structuredClone(source)
  const selected = selectTestRephraseSources(source, 10, () => 0.34)
  assert.equal(selected.length, 10)
  assert.ok(selected.some(isMultipleChoice))
  assert.ok(selected.some(isTrueFalse))
  assert.ok(selected.some(isFillInBlank))
  assert.ok(selected.some(item => assessmentQuestionType(item) === 'short'))
  assert.ok(selected.every(item => item.assessmentRole === 'assessment_reserved'))
  assert.ok(source.learningObjectives.every(obj => selected.some(item => item.objectiveId === obj.id)))
  assert.equal(new Set(selected.map(item => item.question.toLowerCase())).size, 10)
  assert.deepEqual(source, original)
})

test('rephrased items retain the complete grading contract and evidence lineage', async () => {
  const sources = selectTestRephraseSources(lesson(), 10, () => 0.34)
  const rewritten = applyRephrasedTestQuestions(sources, paraphrase(sources))
  assert.equal(rewritten.length, 10)
  for (let i = 0; i < sources.length; i++) {
    const before = sources[i], after = rewritten[i]
    assert.notEqual(after.question, before.question)
    assert.equal(after.id, before.id)
    assert.equal(after.type, before.type)
    assert.equal(after.sourceType, before.sourceType)
    assert.deepEqual(after.choices, before.choices)
    assert.deepEqual(after.correct, before.correct)
    assert.deepEqual(after.answer, before.answer)
    assert.deepEqual(after.expectedAny, before.expectedAny)
    assert.deepEqual(after.rewordedFrom, before.rewordedFrom)
  }
  const mc = rewritten.find(isMultipleChoice)
  assert.equal(await judgeAnswer(mc.choices[mc.correct], buildAcceptableList(mc), mc), true)
  assert.equal(await judgeAnswer(mc.choices[(mc.correct + 1) % mc.choices.length], buildAcceptableList(mc), mc), false)
  const tf = rewritten.find(isTrueFalse)
  assert.equal(await judgeAnswer('True', buildAcceptableList(tf), tf), true)
  assert.equal(await judgeAnswer('False', buildAcceptableList(tf), tf), false)
  const fib = rewritten.find(isFillInBlank)
  assert.deepEqual(buildAcceptableList(fib), ['habitat'])
})

test('bad model responses are rejected instead of silently damaging graded questions', () => {
  const sources = selectTestRephraseSources(lesson(), 10, () => 0.34)
  assert.equal(applyRephrasedTestQuestions(sources, 'not JSON'), null)
  assert.equal(applyRephrasedTestQuestions(sources, { items: sources.map(item => ({id:item.id,question:item.question})) }), null)
  const duplicated = paraphrase(sources)
  duplicated.items[1].question = duplicated.items[0].question
  assert.equal(applyRephrasedTestQuestions(sources, duplicated), null)
  const brokenBlank = paraphrase(sources)
  const blankIndex = sources.findIndex(isFillInBlank)
  brokenBlank.items[blankIndex].question = 'Choose the habitat instead.'
  assert.equal(applyRephrasedTestQuestions(sources, brokenBlank), null)
  const missing = paraphrase(sources)
  missing.items.pop()
  assert.equal(applyRephrasedTestQuestions(sources, missing), null)
})

test('rewording instructions explicitly preserve the four formats, answer and numbers', () => {
  const sources = selectTestRephraseSources(lesson(), 10, () => 0.34)
  const instruction = createTestRephraseInstruction(sources,{ previousQuestions:['Earlier practice item'] })
  assert.match(instruction, /Retain each question.s format \(mc, tf, fib, short\)/)
  assert.match(instruction, /Do NOT turn choice\/true-false\/blank questions into written answers/)
  assert.match(instruction, /same options and correct answer/)
  assert.match(instruction, /identical skill/)
  assert.match(instruction, /Earlier practice item/)
})

test('the full rephrase operation accepts a different-worded deck of the same length', async () => {
  const source = lesson()
  let calls = 0
  const result = await rephraseAssessmentTest({
    lessonData: source, targetCount: 10, random: () => 0.34,
    callModel: async prompt => {
      calls++
      const json = /Questions: (\[.*\])\.$/s.exec(prompt)
      const items = JSON.parse(json[1])
      return JSON.stringify({items:items.map(item=>({id:item.id,question:'Could you answer this: '+item.question}))})
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.length, 10)
  assert.equal(result.filter(isMultipleChoice).length > 0, true)
  assert.equal(result.filter(isTrueFalse).length > 0, true)
  assert.equal(result.filter(isFillInBlank).length > 0, true)
})

test('the request uses existing Sonoma API and accepts JSON rewording, never replacement answer keys', async () => {
  let called = 0
  const result = await requestRephrasedAssessmentTest({
    lessonData: lesson(), targetCount: 10, random: () => 0.34,
    fetchImpl: async (url, config) => {
      called++
      assert.equal(url, '/api/sonoma')
      assert.equal(config.method, 'POST')
      const body = JSON.parse(config.body)
      assert.equal(body.skipAudio, true)
      assert.equal(body.responseMode, 'text')
      const input = JSON.parse(body.instruction.split('Questions: ')[1].slice(0, -1))
      assert.equal(input.length, 10)
      const items = input.map(item => ({ id: item.id, question: 'Could you explain this differently: ' + item.question }))
      return { ok: true, json: async () => ({ reply: JSON.stringify({items}) }) }
    },
  })
  assert.equal(called, 1)
  assert.equal(result.length, 10)
  assert.ok(result.every(item => item.rewordedFrom?.question && item.question !== item.rewordedFrom.question))
})

test('session and print paths reuse saved rephrased questions without touching lesson generation', () => {
  const session = fs.readFileSync('src/app/session/v2/SessionPageV2.jsx', 'utf8')
  const overlay = fs.readFileSync('src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js', 'utf8')
  assert.ok(session.includes('await prepareRephrasedTestDeckRef.current?.()'))
  assert.ok(session.includes('if (snapshotServiceRef.current?.snapshot?.phaseData?.test) return generatedTestRef.current'))
  assert.ok(session.includes('generatedTestRef.current = reworded'))
  assert.ok(session.includes('await saveAssessments(lessonKey, revised, { learnerId, replaceTest: true })'))
  assert.ok(overlay.includes('await requestRephrasedAssessmentTest'))
  assert.ok(overlay.includes('snapshot?.phaseData?.test'))
  assert.ok(overlay.includes('await saveAssessments(item.lesson_key, { ...sets, test: reworded }, { learnerId, replaceTest: true })'))
})

test('only an explicit unstarted-Test replacement changes an existing saved deck', () => {
  const storageSource = fs.readFileSync('src/app/session/assessment/assessmentStore.js', 'utf8')
  const start = storageSource.indexOf('function mergePools(')
  const end = storageSource.indexOf('async function fetchRemoteAssessments(', start)
  const code = storageSource.slice(start, end)
  const merge = vm.runInNewContext(
    '(function(){ const normalizeShape = (value) => value || {}; ' + code + '; return mergePools })()',
  )
  const original = {
    test: [{ question: 'Original Test' }],
    worksheet: [{ question: 'Unchanged Worksheet' }],
    comprehension: [{ question: 'Unchanged Comprehension' }],
    exercise: [{ question: 'Unchanged Exercise' }],
  }
  const updated = { test: [{ question: 'Rephrased Test' }], worksheet: [{ question: 'Overwrite attempt' }] }
  assert.equal(merge(original, updated).test[0].question, 'Original Test')
  const replaced = merge(original, updated, { replaceTest: true })
  assert.equal(replaced.test[0].question, 'Rephrased Test')
  assert.equal(replaced.worksheet[0].question, 'Unchanged Worksheet')
  assert.equal(replaced.comprehension[0].question, 'Unchanged Comprehension')
  assert.equal(replaced.exercise[0].question, 'Unchanged Exercise')
  assert.equal(merge(original, {test: []}, {replaceTest:true}).test[0].question, 'Original Test')
})

test('explicit Test formats are not overwritten by an answer that happens to be true', () => {
  const blank = { type: 'fib', sourceType: 'fib', question: 'A _____ statement', expectedAny: ['true'] }
  const choices = { type: 'mc', sourceType: 'mc', question: 'Select a value', choices: ['true', 'false', 'unknown'], correct: 0, expectedAny: ['true'] }
  const short = { type: 'short', sourceType: 'short', question: 'Describe the statement.', expectedAny: ['true'] }
  assert.equal(isTrueFalse(blank), false)
  assert.equal(isTrueFalse(choices), false)
  assert.equal(isTrueFalse(short), false)
  assert.equal(isFillInBlank(blank), true)
  assert.equal(isMultipleChoice(choices), true)
})

test('rephrased short answer is graded using its new wording and original reference answer', async () => {
  const selected = selectTestRephraseSources(lesson(), 10, () => 0.34)
  const rewritten = applyRephrasedTestQuestions(selected, paraphrase(selected))
  const item = rewritten.find((question) => assessmentQuestionType(question) === 'short' && question.sourceRole === 'test_reword')
  assert.ok(item, 'one generated short answer is selected')
  const savedFetch = globalThis.fetch
  let judgeCalls = 0
  globalThis.fetch = async (url, init) => {
    judgeCalls++
    assert.equal(url, '/api/judge-short-answer')
    const body = JSON.parse(init.body)
    assert.equal(body.question, item.question)
    assert.equal(body.expectedAny[0], item.expectedAny[0])
    return { ok: true, json: async () => ({ correct: body.learnerAnswer === 'habitat', status: body.learnerAnswer === 'habitat' ? 'correct' : 'incorrect', reason: 'The answer was evaluated against the requested concept.' }) }
  }
  try {
    assert.equal(await judgeAnswer('habitat', buildAcceptableList(item), item), true)
    assert.equal(await judgeAnswer('wrong', buildAcceptableList(item), item), false)
  } finally {
    globalThis.fetch = savedFetch
  }
  assert.equal(judgeCalls, 2)
})

test('rephrased Test carries objective/source metadata into evidence while retaining grading keys', async () => {
  const { summarizeEvidenceItem, createLegacyItemFingerprint } = await import('../masteryEvidence/items.js')
  const { buildItemIdentity } = await import('../masteryEvidence/identity.js')
  const selected = selectTestRephraseSources(lesson(), 10, () => 0.34)
  const rewritten = applyRephrasedTestQuestions(selected, paraphrase(selected))
  const item = rewritten.find((question) => question.objectiveId === 'identify')
  assert.ok(item)
  const summary = summarizeEvidenceItem(item)
  assert.equal(summary.question, item.question)
  assert.equal(summary.source_type, item.type)
  assert.equal(item.rewordedFrom.question !== item.question, true)
  assert.equal(item.assessmentRole, 'assessment_reserved')
  const identity = await buildItemIdentity({ lessonKey: 'demo-habitats', lessonData: lesson(), item })
  assert.ok(identity.stableItemId)
  assert.ok(identity.itemContentHash)
  assert.ok(identity.conceptId)
  const fingerprint = createLegacyItemFingerprint({ lessonKey: 'demo-habitats', phase: 'test', item, questionIndex: 0 })
  assert.match(fingerprint, /^legacy:/)
})

test('a truncated full Test reply is retried in smaller batches without changing answer data', async () => {
  const sources = selectTestRephraseSources(lesson(), 10, () => 0.34)
  let calls = 0
  const result = await rephraseAssessmentTest({
    lessonData: lesson(), targetCount: 10, random: () => 0.34,
    callModel: async (instruction) => {
      calls++
      if (calls === 1) return '{"items":['
      const match = /Questions: (\[.*\])\.$/s.exec(instruction)
      const items = JSON.parse(match[1])
      assert.ok(items.length <= 4)
      return { items: items.map((item) => ({
        id: item.id,
        question: 'Please consider this instead: ' + item.question,
      })) }
    },
  })
  assert.equal(calls, 4)
  assert.equal(result.length, sources.length)
  assert.equal(new Set(result.map((item) => item.question.toLowerCase())).size, sources.length)
  result.forEach((item, index) => {
    assert.equal(item.type, sources[index].type)
    assert.deepEqual(item.expectedAny, sources[index].expectedAny)
    assert.deepEqual(item.choices, sources[index].choices)
  })
})
