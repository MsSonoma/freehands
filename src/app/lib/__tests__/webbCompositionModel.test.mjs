import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assembleWebbCompositionEssay,
  compositionPlanViolations,
  compositionSlotSource,
  findNearDuplicateAcceptedSentence,
  nextCompositionSlotIndex,
  normalizeWebbCompositionPlan,
} from '../webbCompositionModel.mjs'
import { POST } from '../../api/webb-objectives/route.js'
import { restoreWebbCompositionState, WEBB_SESSION_STAGES } from '../webbLearningModel.mjs'

const OBJECTIVES = [
  'The learner can explain that historical evidence comes from documents, photographs, and artifacts.',
  'The learner can explain that a primary source is an original source from the time being studied.',
  'The learner can explain that an artifact is an object made or used by people in the past.',
  'The learner can explain that a source may show one perspective and can be affected by bias.',
  'The learner can explain that historians compare sources to check information.',
  'The learner can explain that a reliable source can be supported by other evidence.',
  'The learner can explain that historians use multiple sources because one source may not tell the whole story.',
]

const learnerNotes = {
  0: { text: 'evidence is from documents, artifacts, photographs.', provenance: 'learner-message', sourceMessageId: 'u0' },
  1: { text: 'a primary source is an original thing from being studied.', provenance: 'learner-message', sourceMessageId: 'u1' },
  2: { text: 'a candle', provenance: 'learner-message', sourceMessageId: 'u2' },
  3: { text: "it's you get one side of it", provenance: 'learner-message', sourceMessageId: 'u3' },
  4: { text: 'people have to compare it with other sources to see the whole story.', provenance: 'learner-message', sourceMessageId: 'u4' },
  5: { text: 'it is more believable when theirs 2 sources', provenance: 'learner-message', sourceMessageId: 'u5' },
  6: { text: 'it is more believable when theirs more sources', provenance: 'learner-message', sourceMessageId: 'u6' },
}

const PLAN = {
  controllingIdea: 'Historians understand the past by examining and comparing evidence.',
  slots: [
    { id: 'topic', role: 'topic', focus: 'introduce how historians learn from evidence', connection: 'frames the paragraph', sourceObjectiveIndices: [] },
    { id: 'body-1', role: 'body', focus: 'describe useful kinds of historical evidence', connection: 'gives the reader the evidence historians examine', sourceObjectiveIndices: [0, 1] },
    { id: 'body-2', role: 'body', focus: 'explain that one source can show only one side', connection: 'shows why evidence has limits', sourceObjectiveIndices: [3] },
    { id: 'body-3', role: 'body', focus: 'explain why historians compare sources', connection: 'responds to those limits without repeating reliability twice', sourceObjectiveIndices: [4, 5, 6] },
    { id: 'conclusion', role: 'conclusion', focus: 'close on why using evidence carefully matters', connection: 'synthesizes the paragraph', sourceObjectiveIndices: [] },
  ],
}

test('composition plan is separate from mastery objectives and may group or omit research', () => {
  const plan = normalizeWebbCompositionPlan(PLAN, OBJECTIVES.length)
  assert.deepEqual(compositionPlanViolations(plan, OBJECTIVES.length), [])
  assert.equal(plan.slots[0].role, 'topic')
  assert.deepEqual(plan.slots[0].sourceObjectiveIndices, [])
  assert.deepEqual(plan.slots.at(-1).sourceObjectiveIndices, [])
  assert.deepEqual(plan.slots[3].sourceObjectiveIndices, [4, 5, 6])
  assert.equal(plan.slots.some(slot => slot.sourceObjectiveIndices.includes(2)), false, 'the weak candle note is allowed to stay mastery evidence without becoming an essay sentence')
})

test('body slot preserves exact learner research provenance while topic and conclusion need no mastery note', () => {
  const plan = normalizeWebbCompositionPlan(PLAN, OBJECTIVES.length)
  const grouped = compositionSlotSource(plan.slots[3], OBJECTIVES, learnerNotes)
  assert.deepEqual(grouped.notes.map(note => note.text), [
    'people have to compare it with other sources to see the whole story.',
    'it is more believable when theirs 2 sources',
    'it is more believable when theirs more sources',
  ])
  assert.deepEqual(compositionSlotSource(plan.slots[0], OBJECTIVES, learnerNotes), { objectives: [], notes: [] })
})

test('today-style repeated source sentence is detected before it can become another body sentence', () => {
  const duplicate = findNearDuplicateAcceptedSentence('it is more believable when theirs more sources', {
    2: { text: 'it is more believable when theirs 2 sources', provenance: 'learner-message' },
  }, 3)
  assert.ok(duplicate)
  assert.equal(duplicate.index, 2)
})

test('composition assembly is slot-based and requires every sentence to remain learner-authored', () => {
  const plan = normalizeWebbCompositionPlan(PLAN, OBJECTIVES.length)
  const accepted = Object.fromEntries(plan.slots.map((slot, index) => [index, { text: `Learner sentence ${index + 1}.`, provenance: 'learner-message', slotId: slot.id }]))
  assert.equal(nextCompositionSlotIndex(plan, accepted), -1)
  assert.equal(assembleWebbCompositionEssay(plan, accepted), 'Learner sentence 1. Learner sentence 2. Learner sentence 3. Learner sentence 4. Learner sentence 5.')
  accepted[3] = { text: 'AI sentence.', provenance: 'generated' }
  assert.equal(assembleWebbCompositionEssay(plan, accepted), '')
})

test('resume uses composition slots rather than mastery-objective count', () => {
  const accepted = {
    0: { text: 'Topic sentence.', provenance: 'learner-message' },
    1: { text: 'Body one.', provenance: 'learner-message' },
    2: { text: 'Body two.', provenance: 'learner-message' },
    3: { text: 'Body three.', provenance: 'learner-message' },
  }
  const restored = restoreWebbCompositionState({
    webbStage: WEBB_SESSION_STAGES.WRITING, writingMode: true, writingIndex: 3, writingSubphase: 'committed',
    compositionPlan: PLAN, acceptedSentences: accepted, writingAttempts: {},
  }, OBJECTIVES)
  assert.equal(restored.writingIndex, 3)
  assert.equal(restored.writingSubphase, 'committed')
  assert.equal(restored.compositionPlan.slots.length, 5)
  assert.equal(nextCompositionSlotIndex(restored.compositionPlan, restored.acceptedSentences), 4)
})

test('plan-writing can group overlapping objectives and omit a weak example without changing mastery objectives', async () => {
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'plan-writing', lesson: { title: 'Questioning Historical Evidence', subject: 'social studies', grade: 5 }, objectives: OBJECTIVES, learnerNotes }),
  }), { apiKey: 'offline-test', callModel: async (system, user, _maxTokens, _temperature, responseFormat) => {
    assert.match(system, /Mastery objectives and essay sentences are separate/i)
    assert.match(system, /may synthesize multiple closely related objectives/i)
    assert.equal(responseFormat?.type, 'json_object')
    const input = JSON.parse(user)
    assert.equal(input.research.length, 7)
    return JSON.stringify(PLAN)
  } })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.deepEqual(data.compositionPlan.slots[3].sourceObjectiveIndices, [4, 5, 6])
  assert.equal(data.compositionPlan.slots.some(slot => slot.sourceObjectiveIndices.includes(2)), false)
})

test('writing evaluation deterministically rejects today-style repetition even if semantic evaluator says yes', async () => {
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check-writing',
      slot: PLAN.slots[3],
      controllingIdea: PLAN.controllingIdea,
      sourceObjectives: [{ objectiveIndex: 6, objective: OBJECTIVES[6] }],
      sourceNotes: [learnerNotes[6]],
      text: 'it is more believable when theirs more sources',
      lesson: { title: 'Questioning Historical Evidence', subject: 'social studies', grade: 5 },
      priorSentences: ['Historians look at evidence.', 'it is more believable when theirs 2 sources'],
    }),
  }), { apiKey: 'offline-test', callModel: async () => 'correct|yes|yes|yes|yes' })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.addsNewInformation, false)
  assert.equal(result.positionFit, false)
  assert.equal(result.duplicateOfIndex, 1)
})

test('final paragraph coherence check never asks the model to rewrite learner prose', async () => {
  const acceptedSentences = Object.fromEntries(PLAN.slots.map((slot, index) => [index, { text: `Learner sentence ${index + 1}.`, provenance: 'learner-message', slotId: slot.id }]))
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check-paragraph', lesson: { title: 'History' }, compositionPlan: PLAN, acceptedSentences }),
  }), { apiKey: 'offline-test', callModel: async (system, user, _maxTokens, _temperature, responseFormat) => {
    assert.match(system, /Do not rewrite, edit, or suggest any sentence/i)
    assert.equal(responseFormat?.type, 'json_object')
    assert.equal(JSON.parse(user).learner_sentences.length, 5)
    return JSON.stringify({ coherent: false, problemSlotIndex: 3, reasonCode: 'repetition' })
  } })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { coherent: false, problemSlotIndex: 3, reasonCode: 'repetition' })
})
