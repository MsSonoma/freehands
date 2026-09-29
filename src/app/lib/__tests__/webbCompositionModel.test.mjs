import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assembleWebbCompositionEssay,
  buildWebbCompositionPlan,
  WEBB_COMPOSITION_PROTOCOL_VERSION,
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
  2: { text: 'a candle', provenance: 'learner-message', sourceMessageId: 'u2', objectivePrompt: 'What is one example of an artifact?', objectivePromptSourceMessageId: 'a2' },
  3: { text: "it's you get one side of it", provenance: 'learner-message', sourceMessageId: 'u3' },
  4: { text: 'people have to compare it with other sources to see the whole story.', provenance: 'learner-message', sourceMessageId: 'u4' },
  5: { text: 'it is more believable when theirs 2 sources', provenance: 'learner-message', sourceMessageId: 'u5' },
  6: { text: 'it is more believable when theirs more sources', provenance: 'learner-message', sourceMessageId: 'u6' },
}

const PLAN = {
  protocolVersion: 'webb-composition-v1',
  controllingIdea: 'Historians understand the past by examining and comparing evidence.',
  slots: [
    { id: 'topic', role: 'topic', focus: 'introduce how historians learn from evidence', connection: 'frames the paragraph', sourceObjectiveIndices: [] },
    { id: 'body-1', role: 'body', focus: 'describe useful kinds of historical evidence', connection: 'gives the reader the evidence historians examine', sourceObjectiveIndices: [0, 1] },
    { id: 'body-2', role: 'body', focus: 'explain that one source can show only one side', connection: 'shows why evidence has limits', sourceObjectiveIndices: [3] },
    { id: 'body-3', role: 'body', focus: 'explain why historians compare sources', connection: 'responds to those limits without repeating reliability twice', sourceObjectiveIndices: [4, 5, 6] },
    { id: 'conclusion', role: 'conclusion', focus: 'close on why using evidence carefully matters', connection: 'synthesizes the paragraph', sourceObjectiveIndices: [] },
  ],
}

test('new composition plan is a deterministic one-to-one projection of the objective blueprint', () => {
  const plan = buildWebbCompositionPlan(OBJECTIVES, learnerNotes)
  assert.equal(plan.protocolVersion, WEBB_COMPOSITION_PROTOCOL_VERSION)
  assert.deepEqual(compositionPlanViolations(plan, OBJECTIVES.length), [])
  assert.equal(plan.slots.length, OBJECTIVES.length)
  assert.deepEqual(plan.slots.map(slot => slot.sourceObjectiveIndices), OBJECTIVES.map((_, index) => [index]))
  assert.equal(plan.slots[0].role, 'topic')
  assert.equal(plan.slots.at(-1).role, 'conclusion')
  assert.ok(plan.slots.slice(1, -1).every(slot => slot.role === 'body'))
})

test('topic and conclusion are structural while body slots expose their learner notes', () => {
  const plan = buildWebbCompositionPlan(OBJECTIVES, learnerNotes)
  assert.deepEqual(compositionSlotSource(plan.slots[0], OBJECTIVES, learnerNotes), { objectives: [], notes: [] })
  assert.deepEqual(compositionSlotSource(plan.slots.at(-1), OBJECTIVES, learnerNotes), { objectives: [], notes: [] })
  for (let index = 1; index < plan.slots.length - 1; index += 1) {
    const source = compositionSlotSource(plan.slots[index], OBJECTIVES, learnerNotes)
    assert.deepEqual(source.objectives.map(row => row.objectiveIndex), [index])
    assert.deepEqual(source.notes.map(row => row.text), [learnerNotes[index].text])
    if (index === 2) {
      assert.equal(source.notes[0].objectivePrompt, 'What is one example of an artifact?')
      assert.equal(source.notes[0].objectivePromptSourceMessageId, 'a2')
    }
  }
})

test('legacy v1 composition plans remain readable for in-progress work', () => {
  const plan = normalizeWebbCompositionPlan(PLAN, OBJECTIVES.length)
  assert.deepEqual(compositionPlanViolations(plan, OBJECTIVES.length), [])
  assert.deepEqual(plan.slots[3].sourceObjectiveIndices, [4, 5, 6])
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

test('plan-writing no longer calls a second planner or merges, omits, or reorders learner notes', async () => {
  let modelCalls = 0
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'plan-writing', lesson: { title: 'Questioning Historical Evidence', subject: 'social studies', grade: 5 }, objectives: OBJECTIVES, learnerNotes }),
  }), { apiKey: 'offline-test', callModel: async () => { modelCalls += 1; throw new Error('composition planning must be deterministic') } })
  assert.equal(response.status, 200)
  assert.equal(modelCalls, 0)
  const data = await response.json()
  assert.equal(data.compositionPlan.protocolVersion, WEBB_COMPOSITION_PROTOCOL_VERSION)
  assert.equal(data.compositionPlan.slots.length, OBJECTIVES.length)
  assert.deepEqual(data.compositionPlan.slots.map(slot => slot.sourceObjectiveIndices), OBJECTIVES.map((_, index) => [index]))
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

test('conclusion position fit does not require new factual information', async () => {
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check-writing',
      slot: PLAN.slots.at(-1),
      controllingIdea: PLAN.controllingIdea,
      text: 'That is why comparing evidence helps historians understand the past.',
      lesson: { title: 'Questioning Historical Evidence', subject: 'social studies', grade: 5 },
      priorSentences: ['Historians examine evidence.', 'They compare sources to check what happened.'],
    }),
  }), { apiKey: 'offline-test', callModel: async () => 'correct|yes|yes|no|yes' })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.addsNewInformation, false)
  assert.equal(result.positionFit, true)
})

test('writing evaluation treats topic and conclusion as structural roles rather than note conversions', async () => {
  const plan = buildWebbCompositionPlan(OBJECTIVES, learnerNotes)
  for (const index of [0, plan.slots.length - 1]) {
    const source = compositionSlotSource(plan.slots[index], OBJECTIVES, learnerNotes)
    const response = await POST(new Request('http://localhost/api/webb-objectives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check-writing', slot: plan.slots[index], controllingIdea: plan.controllingIdea,
        sourceObjectives: source.objectives, sourceNotes: source.notes,
        text: index === 0 ? 'Historical evidence helps people understand the past.' : 'Using several sources helps historians understand the whole story.',
        lesson: { title: 'Questioning Historical Evidence', subject: 'social studies', grade: 5 }, priorSentences: ['Historians examine evidence.', 'They compare sources to check what happened.'],
      }),
    }), { apiKey: 'offline-test', callModel: async (system, user) => {
      assert.match(system, /does not need to restate the first research note/i)
      assert.match(system, /does not need to restate the final research note/i)
      const input = JSON.parse(user)
      assert.deepEqual(input.learner_research_notes, [])
      assert.deepEqual(input.source_objectives, [])
      return 'correct|yes|yes|yes|yes'
    } })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).sentenceOk, true)
  }
})

test('one-sentence slot rejects two learner sentences even when the semantic grader says yes', async () => {
  const plan = buildWebbCompositionPlan(OBJECTIVES, learnerNotes)
  const index = 2
  const source = compositionSlotSource(plan.slots[index], OBJECTIVES, learnerNotes)
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check-writing', slot: plan.slots[index], controllingIdea: plan.controllingIdea,
      sourceObjectives: source.objectives, sourceNotes: source.notes,
      text: 'An artifact is an object from the past. A candle can be an artifact.',
      lesson: { title: 'Questioning Historical Evidence', subject: 'social studies', grade: 5 }, priorSentences: [],
    }),
  }), { apiKey: 'offline-test', callModel: async () => 'correct|yes|yes|yes|yes' })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.sentenceOk, false)
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
