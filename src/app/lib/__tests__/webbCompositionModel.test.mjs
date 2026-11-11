import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assembleWebbCompositionEssay,
  buildWebbCompositionPlan,
  WEBB_COMPOSITION_PROTOCOL_VERSION,
  PREVIOUS_WEBB_COMPOSITION_PROTOCOL_VERSION,
  compositionPlanViolations,
  compositionSlotSource,
  findNearDuplicateAcceptedSentence,
  normalizeWebbWritingGroups,
  nextCompositionSlotIndex,
  normalizeWebbCompositionPlan,
} from '../webbCompositionModel.mjs'
import { POST } from '../../api/webb-objectives/route.js'
import { alignWebbWritingPlanOnResume, createWritingAttempt, restoreWebbCompositionState, WEBB_SESSION_STAGES } from '../webbLearningModel.mjs'

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

const BLUEPRINT = {
  controllingIdea: 'Historians build a fuller understanding of the past by examining different kinds of evidence, recognizing source limits, and comparing support across sources.',
  discourseMode: 'explanation',
  closingGoal: 'close by synthesizing why comparing multiple kinds of evidence produces a fuller account of the past',
  bodyUnits: OBJECTIVES.map((objective, index) => ({
    id: `body-${index + 1}`,
    objective,
    clue: `history concept ${index + 1}`,
    rhetoricalJob: index === 0
      ? 'establish the kinds of evidence historians can examine'
      : `develop the next distinct evidence-reasoning step ${index + 1}`,
    connection: index === 0
      ? 'establishes what counts as evidence before the paragraph explains how historians evaluate it'
      : `builds on the preceding evidence idea by adding a distinct reason historians need the next step ${index + 1}`,
  })),
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

test('new composition plan adds structural framing around every objective-derived body sentence', () => {
  const plan = buildWebbCompositionPlan(OBJECTIVES, learnerNotes, BLUEPRINT)
  assert.equal(plan.protocolVersion, WEBB_COMPOSITION_PROTOCOL_VERSION)
  assert.deepEqual(compositionPlanViolations(plan, OBJECTIVES.length), [])
  assert.equal(plan.slots.length, OBJECTIVES.length + 2)
  assert.equal(plan.slots[0].role, 'topic')
  assert.equal(plan.slots.at(-1).role, 'conclusion')
  assert.deepEqual(plan.slots[0].sourceObjectiveIndices, [])
  assert.deepEqual(plan.slots.at(-1).sourceObjectiveIndices, [])
  assert.deepEqual(plan.slots.slice(1, -1).map(slot => slot.sourceObjectiveIndices), OBJECTIVES.map((_, index) => [index]))
  assert.ok(plan.slots.slice(1, -1).every(slot => slot.role === 'body'))
})

test('topic and conclusion are structural while every body slot exposes its learner note', () => {
  const plan = buildWebbCompositionPlan(OBJECTIVES, learnerNotes, BLUEPRINT)
  assert.deepEqual(compositionSlotSource(plan.slots[0], OBJECTIVES, learnerNotes), { objectives: [], notes: [] })
  assert.deepEqual(compositionSlotSource(plan.slots.at(-1), OBJECTIVES, learnerNotes), { objectives: [], notes: [] })
  for (let slotIndex = 1; slotIndex < plan.slots.length - 1; slotIndex += 1) {
    const objectiveIndex = slotIndex - 1
    const source = compositionSlotSource(plan.slots[slotIndex], OBJECTIVES, learnerNotes)
    assert.deepEqual(source.objectives.map(row => row.objectiveIndex), [objectiveIndex])
    assert.deepEqual(source.notes.map(row => row.text), [learnerNotes[objectiveIndex].text])
    if (objectiveIndex === 2) {
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

test('v2 in-progress essays migrate without losing accepted prose and restore the two displaced objective sentences', () => {
  const previousPlan = {
    protocolVersion: 'webb-composition-v2-objective-blueprint',
    controllingIdea: OBJECTIVES[0],
    slots: OBJECTIVES.map((objective, index) => ({
      id: 'objective-' + (index + 1),
      role: index === 0 ? 'topic' : (index === OBJECTIVES.length - 1 ? 'conclusion' : 'body'),
      focus: objective,
      connection: 'previous objective-position writing',
      sourceObjectiveIndices: [index],
    })),
  }
  const acceptedSentences = {
    0: { text: 'Old topic sentence.', provenance: 'learner-message', objectiveIndex: 0, slotIndex: 0, slotId: 'objective-1', slotRole: 'topic' },
    1: { text: 'Old body from objective two.', provenance: 'learner-message', objectiveIndex: 1, slotIndex: 1, slotId: 'objective-2', slotRole: 'body' },
    2: { text: 'Old body from objective three.', provenance: 'learner-message', objectiveIndex: 2, slotIndex: 2, slotId: 'objective-3', slotRole: 'body' },
    6: { text: 'Old conclusion sentence.', provenance: 'learner-message', objectiveIndex: 6, slotIndex: 6, slotId: 'objective-7', slotRole: 'conclusion' },
  }
  const restored = restoreWebbCompositionState({
    webbStage: WEBB_SESSION_STAGES.WRITING,
    writingMode: true,
    writingIndex: 6,
    writingSubphase: 'committed',
    compositionPlan: previousPlan,
    learnerNotes,
    acceptedSentences,
    writingAttempts: {
      1: [{ text: 'Old body from objective two.', provenance: 'learner-message', objectiveIndex: 1, slotIndex: 1, slotId: 'objective-2', slotRole: 'body' }],
    },
  }, OBJECTIVES)

  assert.equal(restored.compositionPlan.protocolVersion, PREVIOUS_WEBB_COMPOSITION_PROTOCOL_VERSION)
  assert.equal(restored.compositionPlan.slots.length, OBJECTIVES.length + 2)
  assert.equal(restored.acceptedSentences[0].text, 'Old topic sentence.')
  assert.equal(restored.acceptedSentences[0].objectiveIndex, null)
  assert.equal(restored.acceptedSentences[2].text, 'Old body from objective two.')
  assert.equal(restored.acceptedSentences[2].objectiveIndex, 1)
  assert.equal(restored.acceptedSentences[3].text, 'Old body from objective three.')
  assert.equal(restored.acceptedSentences[8].text, 'Old conclusion sentence.')
  assert.equal(restored.acceptedSentences[8].objectiveIndex, null)
  assert.equal(restored.acceptedSentences[1], undefined)
  assert.equal(restored.acceptedSentences[7], undefined)
  assert.equal(restored.writingAttempts[2][0].slotIndex, 2)
  assert.equal(restored.writingAttempts[2][0].objectiveIndex, 1)
  assert.equal(restored.writingIndex, 1)
  assert.equal(nextCompositionSlotIndex(restored.compositionPlan, restored.acceptedSentences), 1)
})

test('completed v2 essays remain historical artifacts and are not rewritten by the migration', () => {
  const previousPlan = {
    protocolVersion: 'webb-composition-v2-objective-blueprint',
    controllingIdea: OBJECTIVES[0],
    slots: OBJECTIVES.map((objective, index) => ({
      id: 'objective-' + (index + 1),
      role: index === 0 ? 'topic' : (index === OBJECTIVES.length - 1 ? 'conclusion' : 'body'),
      focus: objective,
      connection: 'previous objective-position writing',
      sourceObjectiveIndices: [index],
    })),
  }
  const acceptedSentences = Object.fromEntries(previousPlan.slots.map((slot, index) => [index, {
    text: 'Historical learner sentence ' + (index + 1) + '.',
    provenance: 'learner-message',
    slotId: slot.id,
    slotRole: slot.role,
  }]))
  const essay = Object.values(acceptedSentences).map(sentence => sentence.text).join(' ')
  const restored = restoreWebbCompositionState({
    webbStage: WEBB_SESSION_STAGES.ESSAY,
    writingMode: false,
    writingIndex: OBJECTIVES.length - 1,
    writingSubphase: 'idle',
    compositionPlan: previousPlan,
    learnerNotes,
    acceptedSentences,
    writingAttempts: {},
    essay,
    essayMode: true,
  }, OBJECTIVES)

  assert.equal(restored.compositionPlan.protocolVersion, 'webb-composition-v2-objective-blueprint')
  assert.equal(restored.compositionPlan.slots.length, OBJECTIVES.length)
  assert.equal(restored.essay, essay)
  assert.equal(Object.keys(restored.acceptedSentences).length, OBJECTIVES.length)
})

test('plan-writing can fall back safely if the optional semantic grouping call fails', async () => {
  let modelCalls = 0
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'plan-writing', lesson: { title: 'Questioning Historical Evidence', subject: 'social studies', grade: 5 }, objectives: OBJECTIVES, learnerNotes, blueprint: BLUEPRINT }),
  }), { apiKey: 'offline-test', callModel: async () => { modelCalls += 1; throw new Error('composition planning must be deterministic') } })
  assert.equal(response.status, 200)
  assert.equal(modelCalls, 1)
  const data = await response.json()
  assert.equal(data.compositionPlan.protocolVersion, WEBB_COMPOSITION_PROTOCOL_VERSION)
  assert.equal(data.compositionPlan.slots.length, OBJECTIVES.length + 1)
  assert.deepEqual(data.compositionPlan.slots[0].sourceObjectiveIndices, [])
  assert.deepEqual(data.compositionPlan.slots.slice(1, -1).map(slot => slot.sourceObjectiveIndices), [[0],[1],[2],[3],[4],[5,6]])
  assert.deepEqual(compositionPlanViolations(data.compositionPlan, OBJECTIVES.length), [])
  assert.deepEqual(data.compositionPlan.slots.at(-1).sourceObjectiveIndices, [])
})
test('writing evaluation records near-repetition without making novelty a rejection condition', async () => {
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
  assert.equal(result.positionFit, true)
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
  const plan = buildWebbCompositionPlan(OBJECTIVES, learnerNotes, BLUEPRINT)
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
      assert.match(system, /A topic introduces the big idea/i)
      assert.match(system, /a conclusion closes the previously accepted ideas/i)
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
  const plan = buildWebbCompositionPlan(OBJECTIVES, learnerNotes, BLUEPRINT)
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


test('Emma regression: every mastered objective remains a body sentence between separate topic and conclusion sentences', () => {
  const objectives = [
    'Maps help people understand a place.',
    'Physical maps show natural landforms.',
    'Climate describes usual long-term weather.',
    'Natural and human-made features are different.',
    'Regions share some geographic features.',
    'Settlements often develop near water.',
    'Migration and population density describe people.',
  ]
  const notes = Object.fromEntries(objectives.map((_, index) => [
    index, { text: 'Learner research note ' + index, provenance: 'learner-message', sourceMessageId: 'note-' + index },
  ]))
  const blueprint = {
    controllingIdea: 'Maps and geographic patterns help explain how places and people are organized.',
    discourseMode: 'explanation',
    closingGoal: 'close by connecting maps, regions, and settlement patterns to understanding places',
    bodyUnits: objectives.map((objective, index) => ({
      id: `body-${index + 1}`,
      objective,
      clue: `geography concept ${index + 1}`,
      rhetoricalJob: `develop geographic idea ${index + 1}`,
      connection: index === 0
        ? 'establishes how maps help explain place before adding specific geographic patterns'
        : `extends the geographic explanation with a distinct related idea ${index + 1}`,
    })),
  }
  const plan = buildWebbCompositionPlan(objectives, notes, blueprint)
  const sentences = [
    "It's important to know about maps, regions, and human settlement.",
    'Maps help people understand a place.',
    'A physical map shows natural features such as mountains, rivers, and plains.',
    'Climate is the usual pattern of weather in a place over a long time.',
    'A house is made by people and a tree is made by nature.',
    'A region can have common features, but it could still have different landforms too.',
    'People may settle near water or a coast.',
    'Migration and population density describe where and how people live.',
    "And that's why maps, regions, and human settlement help us understand places.",
  ]
  const approved = Object.fromEntries(sentences.map((sentence, index) => [index, {
    text: sentence,
    provenance: 'learner-message',
    sourceMessageId: 'writing-' + index,
    accepted: true, accuracy: 'correct', sentenceOk: true, positionFit: true, paragraphFit: true,
  }]))
  assert.equal(plan.slots.length, objectives.length + 2)
  assert.deepEqual(plan.slots.slice(1, -1).map(slot => slot.sourceObjectiveIndices[0]), objectives.map((_, index) => index))
  assert.equal(nextCompositionSlotIndex(plan, approved), -1)
  assert.equal(assembleWebbCompositionEssay(plan, approved), sentences.join(' '))

  const missingFirstObjectiveSentence = { ...approved }
  delete missingFirstObjectiveSentence[1]
  assert.equal(nextCompositionSlotIndex(plan, missingFirstObjectiveSentence), 1)
  assert.equal(assembleWebbCompositionEssay(plan, missingFirstObjectiveSentence), '')

  const missingFinalObjectiveSentence = { ...approved }
  delete missingFinalObjectiveSentence[7]
  assert.equal(nextCompositionSlotIndex(plan, missingFinalObjectiveSentence), 7)
  assert.equal(assembleWebbCompositionEssay(plan, missingFinalObjectiveSentence), '')
})


test('one distinct idea may produce a short complete composition without padding to five body objectives', () => {
  const objectives = ['The learner can explain how choices reveal a theme.']
  const notes = { 0: { text: "Returning the wallet built trust.", provenance: 'learner-message' } }
  const blueprint = {
    controllingIdea: 'A character choice can reveal a story theme.',
    discourseMode: 'explanation',
    closingGoal: 'close the established connection between choice and message',
    bodyUnits: [{ id: 'body-1', objective: objectives[0], clue: 'character choice',
      rhetoricalJob: 'show what the choice communicates', connection: 'establishes the evidence for the theme' }],
  }
  const plan = buildWebbCompositionPlan(objectives, notes, blueprint, [[0]])
  assert.equal(plan.slots.length, 3)
  assert.deepEqual(compositionPlanViolations(plan, objectives.length), [])
  const accepted = Object.fromEntries(plan.slots.map((slot, index) => [index, {
    text: ['Choices can show what a story means.', 'Returning the wallet builds trust.', 'That choice helps show the message.'][index],
    provenance: 'learner-message', slotId: slot.id,
  }]))
  assert.equal(assembleWebbCompositionEssay(plan, accepted).split('.').length, 4)
})

test('grouped source notes remain traceable but create one learner writing job', () => {
  const objectives = ['Choice shows honesty.', 'The owner trusts Maya.', 'The ending reinforces the theme.']
  const notes = Object.fromEntries(objectives.map((_, i) => [i, {
    text: ['Maya returned the wallet.', 'Maya was trusted after returning the wallet.', 'Honesty built trust.'][i],
    provenance: 'learner-message', sourceMessageId: 'note-' + i,
  }]))
  const blueprint = {
    controllingIdea: 'Maya shows that honesty builds trust.',
    discourseMode: 'explanation',
    closingGoal: 'synthesize the meaning of the honest choice',
    bodyUnits: objectives.map((objective, i) => ({
      id: 'body-' + (i + 1), objective, clue: 'theme part ' + i,
      rhetoricalJob: 'one aspect of the example ' + i,
      connection: 'grounds a related theme idea in the story ' + i,
    })),
  }
  const groups = normalizeWebbWritingGroups([[0, 1, 2]], objectives.length)
  const plan = buildWebbCompositionPlan(objectives, notes, blueprint, groups)
  assert.equal(plan.slots.length, 3)
  assert.deepEqual(plan.slots[1].sourceObjectiveIndices, [0, 1, 2])
  assert.deepEqual(compositionSlotSource(plan.slots[1], objectives, notes).notes.map(n => n.sourceMessageId), ['note-0', 'note-1', 'note-2'])
  assert.deepEqual(compositionPlanViolations(plan, objectives.length), [])
})

test('resuming a v4 lesson can retire duplicate future writing jobs without moving accepted prose', () => {
  const original = buildWebbCompositionPlan(OBJECTIVES, learnerNotes, BLUEPRINT)
  const old = { ...original, protocolVersion: 'webb-composition-v4-blueprint' }
  const accepted = {
    0: { text: 'Character choices can reveal a story theme.', provenance: 'learner-message' },
    1: { text: 'A theme is a message about life.', provenance: 'learner-message' },
    2: { text: 'An honest wallet return builds trust and shows the theme.', provenance: 'learner-message' },
  }
  const shorter = buildWebbCompositionPlan(OBJECTIVES, learnerNotes, BLUEPRINT,
    [[0], [1, 2, 3, 4, 5, 6]], old, accepted)
  assert.equal(shorter.slots.length, 4)
  assert.deepEqual(shorter.slots[2].sourceObjectiveIndices, [1, 2, 3, 4, 5, 6])
  assert.deepEqual(compositionPlanViolations(shorter, OBJECTIVES.length), [])
  const resumed = alignWebbWritingPlanOnResume({
    webbStage: 'writing', writingMode: true, writingIndex: 3, writingSubphase: 'review',
    writingDraft: '', acceptedSentences: accepted, compositionPlan: old,
    writingAttempts: { 3: [{ text: 'Rejected but valid attempt.', accepted: false }] },
    chatMessages: [{ role: 'assistant', content: 'Try again.' }],
  }, shorter)
  assert.deepEqual(resumed.acceptedSentences, accepted)
  assert.equal(resumed.writingIndex, 3)
  assert.equal(resumed.writingSubphase, 'focus')
  assert.equal(resumed.writingAttempts[3], undefined, 'old rejected body attempt cannot become a conclusion attempt')
  const restored = restoreWebbCompositionState(resumed, OBJECTIVES)
  assert.equal(restored.writingIndex, 3)
  assert.equal(restored.compositionPlan.slots[3].role, 'conclusion')
  assert.equal(nextCompositionSlotIndex(restored.compositionPlan, accepted), 3)
  assert.equal(assembleWebbCompositionEssay(shorter, accepted), '', 'unfinished essay must never be fabricated')
})

test('plan-writing groups repeated research into one writing thought while preserving all objective notes', async () => {
  let calls = 0
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'plan-writing', objectives: OBJECTIVES, learnerNotes, blueprint: BLUEPRINT }),
  }), { apiKey: 'offline-test', callModel: async () => {
    calls += 1
    return '{"groups":[[0],[1,2,3,4,5,6]]}'
  } })
  assert.equal(response.status, 200)
  assert.equal(calls, 1)
  const { compositionPlan: plan } = await response.json()
  assert.equal(plan.slots.length, 4)
  assert.deepEqual(plan.slots[2].sourceObjectiveIndices, [1, 2, 3, 4, 5, 6])
  assert.deepEqual(compositionPlanViolations(plan, OBJECTIVES.length), [])
})


test('November 11 wallet theme submissions do not fail for a repeated note or correctable verb tense', async () => {
  const priorSentences = [
    'The choices a character makes can help the reader trace the theme of a story.',
    'In writing, the theme is the full message about life and the topic is a subject.',
    "If the theme was that honesty builds trust and a character returned a wallet and earned the owner's trust, her choice supported the theme.",
  ]
  const note = "Maya's honest choice leads to the owner's trust, which supports the theme of the story."
  const attempts = [
    "Returning the wallet lead to the wallet's owner's trust, which supports the theme of the story.",
    "Returning the wallet leads to the wallet's owner's trust, which supports the theme of the story.",
  ]
  for (const text of attempts) {
    const response = await POST(new Request('http://localhost/api/webb-objectives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check-writing', slot: { id: 'body-3', role: 'body',
          focus: 'Explain how a story detail supports the theme.', sourceObjectiveIndices: [2, 3] },
        controllingIdea: 'Honest choices can build trust.',
        sourceObjectives: [{ objectiveIndex: 2, objective: 'Explain how a story detail supports the theme.' }],
        sourceNotes: [{ objectiveIndex: 2, text: note, provenance: 'learner-message' }],
        priorSentences, text,
      }),
    }), { apiKey: 'offline-test', callModel: async (system) => {
      assert.match(system, /minor verb-tense/i)
      assert.match(system, /ADDS_NEW_INFORMATION: advisory only/i)
      return 'correct|yes|yes|no|yes'
    } })
    assert.equal(response.status, 200)
    const evaluation = await response.json()
    assert.equal(evaluation.positionFit, true)
    assert.equal(evaluation.sentenceOk, true)
    assert.equal(evaluation.addsNewInformation, false)
    const record = createWritingAttempt({
      slotIndex: 3, slotRole: 'body', text, message: { id: 'learner-submission' },
      ...evaluation,
    })
    assert.equal(record.accepted, true)
    assert.equal(record.text, text)
  }
})
