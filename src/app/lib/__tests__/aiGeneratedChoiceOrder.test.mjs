import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canonicalizeAiGeneratedChoiceItems,
  canonicalizeAiGeneratedLessonChoices,
} from '../aiGeneratedChoiceOrder.mjs'

const zeroRng = () => 0

function allAQuestions(count = 8) {
  return Array.from({ length: count }, (_, index) => ({
    id: `q-${index + 1}`,
    type: 'mc',
    question: `Question ${index + 1}`,
    choices: [`right-${index + 1}`, `wrong-a-${index + 1}`, `wrong-b-${index + 1}`, `wrong-c-${index + 1}`],
    correct: 0,
    expectedAny: [`right-${index + 1}`],
  }))
}

test('all-A four-choice AI output is balanced before storage without changing the semantic answer', () => {
  const source = allAQuestions(8)
  const original = structuredClone(source)
  const canonical = canonicalizeAiGeneratedChoiceItems(source, { rng: zeroRng })

  const positions = canonical.map((item) => item.correct)
  assert.notDeepEqual(positions, Array(8).fill(0))
  for (const position of [0, 1, 2, 3]) {
    assert.equal(positions.filter((value) => value === position).length, 2)
  }
  canonical.forEach((item, index) => {
    assert.equal(item.choices[item.correct], `right-${index + 1}`)
    assert.deepEqual(item.expectedAny, [`right-${index + 1}`])
  })
  assert.deepEqual(source, original)
})

test('numeric answer pointers are remapped with the same semantic choice', () => {
  const source = [{
    question: 'Pick blue',
    options: ['blue', 'red', 'green', 'yellow'],
    answer: 0,
    expectedAny: ['blue'],
  }]
  const [canonical] = canonicalizeAiGeneratedChoiceItems(source, { rng: zeroRng })
  assert.equal(canonical.options[canonical.answer], 'blue')
  assert.deepEqual(canonical.expectedAny, ['blue'])
})

test('conflicting numeric pointers fail safe instead of guessing', () => {
  const source = [{
    question: 'Ambiguous pointer',
    choices: ['one', 'two', 'three', 'four'],
    correct: 0,
    answer: 1,
    expectedAny: ['one'],
  }]
  assert.deepEqual(canonicalizeAiGeneratedChoiceItems(source, { rng: zeroRng }), source)
})

test('true-false and open-response items are not reordered', () => {
  const source = [
    { type: 'tf', question: 'True?', choices: ['True', 'False'], correct: 0, expectedAny: ['true'] },
    { question: 'True?', choices: ['True', 'False'], correct: 0, expectedAny: ['true'] },
    { type: 'short', question: 'Explain this.', expectedAny: ['answer'] },
  ]
  assert.deepEqual(canonicalizeAiGeneratedChoiceItems(source, { rng: zeroRng }), source)
})

test('lesson canonicalization covers AI-authored instructional and held-out pools only', () => {
  const source = {
    title: 'Fractions',
    multiplechoice: allAQuestions(4),
    test: allAQuestions(4),
    retention: allAQuestions(4),
    dailyFollowup: allAQuestions(4),
    weeklyReview: allAQuestions(4),
    worksheet: allAQuestions(4),
  }
  const original = structuredClone(source)
  const canonical = canonicalizeAiGeneratedLessonChoices(source, { rng: zeroRng })

  for (const field of ['multiplechoice', 'test', 'retention', 'dailyFollowup', 'weeklyReview']) {
    assert.deepEqual(new Set(canonical[field].map((item) => item.correct)), new Set([0, 1, 2, 3]))
  }
  assert.deepEqual(canonical.worksheet, source.worksheet)
  assert.deepEqual(source, original)
})
