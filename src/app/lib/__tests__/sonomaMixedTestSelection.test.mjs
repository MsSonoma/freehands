import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { buildAssessmentPhaseSets } from '../../session/assessment/assessmentSets.js'
import { isFillInBlank, isMultipleChoice, isTrueFalse } from '../../session/utils/questionFormatting.js'
import { buildAcceptableList, judgeAnswer } from '../../session/v2/judging.js'
import { ASSESSMENT_ROLES } from '../masteryEvidence/assessmentIsolation.js'

const targets = { comprehension: 5, exercise: 10, worksheet: 15, test: 10 }

function items(prefix, length, fields = {}) {
  return Array.from({ length }, (_, index) => ({ question: prefix + ' ' + (index + 1) + '?', ...fields }))
}

function lesson() {
  return {
    learningObjectives: [
      { id: 'recognize', name: 'Recognize the answer', evidenceType: 'recognition' },
      { id: 'explain', name: 'Explain a reason', evidenceType: 'reasoned_explanation' },
    ],
    truefalse: items('Practice TF', 10, { answer: true }),
    multiplechoice: items('Practice MC', 10, { choices: ['one', 'two', 'three', 'four'], correct: 2, expectedAny: ['three'] }),
    fillintheblank: items('Practice FIB _____', 10, { expectedAny: ['word'] }),
    shortanswer: items('Practice SA', 10, { expectedAny: ['response'] }),
    test: [
      ...items('Rephrased MC', 4, { choices: ['one', 'two', 'three', 'four'], correct: 2, expectedAny: ['three'], objectiveId: 'recognize' }),
      ...items('Rephrased TF', 4, { answer: true, expectedAny: ['true'], objectiveId: 'recognize' }),
      ...items('Rephrased FIB _____', 4, { expectedAny: ['word'], objectiveId: 'recognize' }),
      ...items('Rephrased explanation', 2, { expectedAny: ['because the answer is correct'], objectiveId: 'explain' }),
    ].map((item, index) => ({ ...item, id: 'reserved-test-' + index })),
  }
}

const build = (source, chosenTargets = targets) =>
  buildAssessmentPhaseSets({ lessonData: source, targets: chosenTargets, random: () => 0.37 })

function textKey(question) {
  return String(question?.question || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim()
}

test('rephrased Test questions are selected only from the held-out Test pool, never taken from practice', () => {
  const source = lesson()
  const sets = build(source)
  assert.equal(sets.test.length, 10)
  const keys = new Set(source.test.map(textKey))
  assert.ok(sets.test.every((item) => keys.has(textKey(item))))
  assert.ok(sets.test.every((item) => item.assessmentRole === ASSESSMENT_ROLES.ASSESSMENT_RESERVED))
  assert.ok(sets.test.every((item) => item.assessment_role === ASSESSMENT_ROLES.ASSESSMENT_RESERVED))
  assert.equal(new Set(sets.test.map(textKey)).size, sets.test.length)
})

test('Test construction does not remove or reshuffle instructional questions', () => {
  const source = lesson()
  const withTest = build(source)
  const withoutTest = build({ ...source, test: [] })
  for (const phase of ['comprehension', 'exercise', 'worksheet']) {
    assert.deepEqual(withTest[phase], withoutTest[phase])
    assert.equal(withTest[phase].length, targets[phase])
  }
})

test('preserves MC, true/false, and fill-in-the-blank formats within rephrased Test items', () => {
  const source = lesson()
  const selected = build(source).test
  assert.ok(selected.some(isMultipleChoice))
  assert.ok(selected.some(isTrueFalse))
  assert.ok(selected.some(isFillInBlank))
  assert.ok(source.learningObjectives.every((objective) => selected.some((q) => q.objectiveId === objective.id)))
})

test('an exact duplicate in Test is never included twice even if item metadata differs', () => {
  const source = lesson()
  source.test.unshift({ ...source.test[0], id: 'different-record', question: ' REPHRASED MC 1??? ' })
  const selected = build(source).test
  assert.equal(selected.length, 10)
  assert.equal(new Set(selected.map(textKey)).size, selected.length)
})

test('selecting a Test does not cycle held-out items to fill a larger target', () => {
  const source = lesson()
  source.test = source.test.slice(0, 6)
  const selected = build(source).test
  assert.equal(selected.length, 6)
  assert.equal(new Set(selected.map(textKey)).size, 6)
  assert.ok(selected.every((item) => item.assessmentRole === ASSESSMENT_ROLES.ASSESSMENT_RESERVED))
})

test('rephrased Test items retain their formats and answer mappings through the UI contract', async () => {
  const selected = build(lesson()).test
  const mc = selected.find(isMultipleChoice)
  const tf = selected.find(isTrueFalse)
  const fib = selected.find(isFillInBlank)
  assert.equal(await judgeAnswer(mc.choices[mc.correct], buildAcceptableList(mc), mc), true)
  assert.equal(await judgeAnswer(mc.choices[(mc.correct + 1) % mc.choices.length], buildAcceptableList(mc), mc), false)
  assert.equal(await judgeAnswer('True', buildAcceptableList(tf), tf), true)
  assert.equal(await judgeAnswer('False', buildAcceptableList(tf), tf), false)

  const previousFetch = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const parsed = JSON.parse(init.body)
    return { ok: true, json: async () => ({ correct: parsed.learnerAnswer === 'word', status: parsed.learnerAnswer === 'word' ? 'correct' : 'incorrect', reason: 'The answer was evaluated against the requested concept.' }) }
  }
  try {
    assert.equal(await judgeAnswer('word', buildAcceptableList(fib), fib), true)
    assert.equal(await judgeAnswer('different', buildAcceptableList(fib), fib), false)
  } finally {
    globalThis.fetch = previousFetch
  }

  const controller = fs.readFileSync('src/app/session/v2/TestPhase.jsx', 'utf8')
  const ui = fs.readFileSync('src/app/session/v2/SessionPageV2.jsx', 'utf8')
  assert.match(controller, /\.\.\.q, \/\/ Preserve question provenance/)
  assert.match(ui, /letter \+ '\. ' \+ \(options\[idx\]\?\.value \|\| ''\)/)
  assert.match(ui, /const val = options\[idx\]\?\.value \|\| letter/)
})
