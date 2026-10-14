import assert from 'node:assert/strict'
import test from 'node:test'
import { validateSlateTestAlignment } from '../slateTestAlignment.mjs'
import { buildLiftoffSnapshotFeatureState } from '../slateLiftoff.mjs'

const objectives = [
  { id: 'estimate', name: 'Estimate before calculating', description: 'Round values to estimate the answer.', evidenceType: 'calculation' },
  { id: 'defend', name: 'Choose and defend an efficient strategy', description: 'Explain why a chosen strategy works and is efficient.', evidenceType: 'reasoned_explanation' },
]

function alignedItems() {
  return [
    { id: 'a1', objectiveId: 'estimate', question: 'Estimate 2,213 + 4,286 to the nearest hundred.', expectedAny: ['6,500'] },
    { id: 'a2', objectiveId: 'estimate', question: 'Estimate 5,122 + 3,145 to the nearest hundred.', expectedAny: ['8,200'] },
    { id: 'a3', objectiveId: 'estimate', question: 'Estimate 7,451 + 1,234 to the nearest hundred.', expectedAny: ['8,600'] },
    { id: 'b1', objectiveId: 'defend', question: 'For 48 × 25, choose a strategy and explain why it is efficient.', expectedAny: ['Multiply by one hundred then divide by four, because twenty-five is a quarter of one hundred.'] },
    { id: 'b2', objectiveId: 'defend', question: 'Choose a strategy for 99 × 17 and justify why it works.', expectedAny: ['Calculate one hundred groups of seventeen and subtract one group of seventeen.'] },
    { id: 'b3', objectiveId: 'defend', question: 'Compare two methods of calculating 42 × 15 and explain why they are equivalent.', expectedAny: ['Split fifteen into ten plus five; distributing forty-two across both parts gives the same product.'] },
  ]
}

function lesson() {
  return { title: 'Choosing and Defending Multi-Digit Strategies', learningObjectives: objectives }
}

test('assesses every objective with written reasoning where teaching demands a defense', () => {
  const result = validateSlateTestAlignment({ lesson: lesson(), testItems: alignedItems() })
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.deepEqual(result.coveredIds.sort(), ['defend', 'estimate'])
})

test('defense questions require a real reference explanation rather than an answer number', () => {
  const broken = alignedItems()
  broken[3] = { ...broken[3], expectedAny: ['1200'] }
  const result = validateSlateTestAlignment({ lesson: lesson(), testItems: broken })
  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('reasoning_reference_missing:defend'))
})

test('a defense lesson cannot silently redefine all objectives as calculation', () => {
  const simple = { title: 'Defending Strategies', learningObjectives: [
    { id: 'calc', name: 'Calculate products', evidenceType: 'calculation' },
  ] }
  const problems = Array.from({ length: 6 }, (_, index) => ({ objectiveId: 'calc', question: `What is ${index + 7} × 5?`, expectedAny: [String((index + 7) * 5)] }))
  const result = validateSlateTestAlignment({ lesson: simple, testItems: problems })
  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('lesson_reasoning_missing_from_objectives'))
})

test('tagging an arithmetic-only question as a defense does not make it aligned', () => {
  const broken = alignedItems()
  broken[3] = { ...broken[3], question: 'What is 48 × 25?', expectedAny: ['1200'] }
  const result = validateSlateTestAlignment({ lesson: lesson(), testItems: broken })
  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('reasoning_not_assessed:defend'))
})

test('fails when any objective is missing even if questions are about the right topic', () => {
  const testItems = alignedItems().map(row => ({ ...row, objectiveId: 'estimate' }))
  const result = validateSlateTestAlignment({ lesson: lesson(), testItems })
  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('objective_not_assessed:defend'))
})

test('rejects an identical teaching question in an independent test', () => {
  const value = lesson()
  value.multiplechoice = [{ question: 'Estimate 2,213 + 4,286 to the nearest hundred.' }]
  const result = validateSlateTestAlignment({ lesson: value, testItems: alignedItems() })
  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('exposed_test_question:1'))
})

test('held-out questions cannot recycle the same numeric problem with new wording', () => {
  const state = { components: objectives.map(objective => ({ ...objective, essential: true })),
    problemHistory: [{ prompt: 'Calculate 2,213 + 4,286 using place value.' }] }
  const result = validateSlateTestAlignment({ lesson: lesson(), liftoff: state, testItems: alignedItems() })
  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('repeated_math_instance:1'))
})

test('more than six essential Liftoff components can each be tested', () => {
  const components = Array.from({ length: 8 }, (_, index) => ({
    id: `skill-${index}`, name: `Skill ${index}`,
    description: 'Calculate the result independently.', essential: true,
  }))
  const testItems = components.map((component, index) => ({
    objectiveId: component.id,
    question: `What is ${index + 21} plus 8?`,
    expectedAny: [String(index + 29)],
  }))
  const result = validateSlateTestAlignment({
    lesson: { title: 'Practicing calculation' },
    liftoff: { components },
    testItems,
  })
  assert.equal(result.ok, true, JSON.stringify(result.errors))
})

test('the real legacy Tester failure is not accepted merely because it shares a curriculum concept', () => {
  const liftoff = { components: [
    { id: 'estimate-before-solving', name: 'Estimate before calculating', essential: true },
    { id: 'choose-and-justify-strategy', name: 'Choose and defend an efficient strategy', essential: true },
  ] }
  const legacy = [
    { question: 'What is 6,708 + 4,395?', correct: 2, choices: ['11,102', '11,104', '11,103', '11,113'], conceptId: 'whole-number-operations' },
    { question: 'What is 10,000 - 6,438?', correct: 3, choices: ['3,652', '3,562', '3,452', '3,552'], conceptId: 'whole-number-operations' },
    { question: 'What is 407 × 16?', correct: 1, choices: ['6412', '6512', '6612', '6712'], conceptId: 'whole-number-operations' },
    { question: 'How many apples go in each of 12 crates?', expectedAny: ['228'], conceptId: 'whole-number-operations' },
    { question: 'How many folders remain?', expectedAny: ['240'], conceptId: 'whole-number-operations' },
    { question: 'Which estimate checks the product?', expectedAny: ['90,000'], conceptId: 'whole-number-operations' },
  ]
  const result = validateSlateTestAlignment({ lesson: { title: 'Choosing and Defending Multi-Digit Strategies' }, liftoff, testItems: legacy })
  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('objective_not_assessed:choose-and-justify-strategy'))
})

test('aligned test items are preserved in the Liftoff snapshot for resume', () => {
  const items = alignedItems()
  const snapshot = buildLiftoffSnapshotFeatureState({ phase: 'test', testItems: items })
  assert.deepEqual(snapshot.testItems, items)
  assert.equal(snapshot.phase, 'test')
})
