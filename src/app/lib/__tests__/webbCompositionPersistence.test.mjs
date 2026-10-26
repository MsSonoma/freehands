import test from 'node:test'
import assert from 'node:assert/strict'
import { POST } from '../../api/webb-compositions/route.js'
import { buildWebbCompositionPlan } from '../webbCompositionModel.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = '22222222-2222-4222-8222-222222222222'
const EXECUTION = '33333333-3333-4333-8333-333333333333'
const BROWSER = '44444444-4444-4444-8444-444444444444'
const LESSON = 'generated/test-webb.json'
const OCCURRENCE = 'scheduled:test-occurrence'

const PLAN = {
  protocolVersion: 'webb-composition-v1',
  controllingIdea: 'Historians compare evidence to understand the past.',
  slots: [
    { id: 'topic', role: 'topic', focus: 'introduce the paragraph', connection: 'frames the paragraph', sourceObjectiveIndices: [] },
    { id: 'body-1', role: 'body', focus: 'explain evidence', connection: 'adds evidence', sourceObjectiveIndices: [0] },
    { id: 'body-2', role: 'body', focus: 'explain comparison', connection: 'builds on evidence', sourceObjectiveIndices: [1] },
    { id: 'conclusion', role: 'conclusion', focus: 'close the paragraph', connection: 'synthesizes it', sourceObjectiveIndices: [] },
  ],
}

function fakeAdmin(onUpsert) {
  return {
    from(table) {
      const state = { table }
      const builder = {
        select() { return builder },
        eq() { return builder },
        order() { return builder },
        limit() {
          if (table === 'lesson_session_events') return Promise.resolve({ data: [{ metadata: { syllabus_occurrence_id: OCCURRENCE } }], error: null })
          return builder
        },
        maybeSingle() {
          if (table === 'lesson_sessions') return Promise.resolve({ data: { id: EXECUTION, learner_id: LEARNER, lesson_id: LESSON, session_id: BROWSER, instructional_teacher: 'webb', ended_at: null }, error: null })
          return Promise.resolve({ data: null, error: null })
        },
        upsert(row) { state.row = row; onUpsert?.(row); return builder },
        single() { return Promise.resolve({ data: { id: '55555555-5555-4555-8555-555555555555', ...state.row }, error: null }) },
      }
      return builder
    },
  }
}

function requestBody(overrides = {}) {
  return {
    learnerId: LEARNER,
    lessonKey: LESSON,
    occurrenceId: OCCURRENCE,
    executionSessionId: EXECUTION,
    browserSessionId: BROWSER,
    status: 'final',
    objectives: ['Explain historical evidence.', 'Explain source comparison.'],
    learnerNotes: {
      0: { text: 'evidence can be documents', provenance: 'learner-message', sourceMessageId: 'u1' },
      1: { text: 'compare sources to see more sides', provenance: 'learner-message', sourceMessageId: 'u2' },
    },
    compositionPlan: PLAN,
    acceptedSentences: {
      0: { text: 'Historians use evidence to learn about the past.', provenance: 'learner-message', sourceMessageId: 'w1' },
      1: { text: 'Evidence can come from documents and other sources.', provenance: 'learner-message', sourceMessageId: 'w2' },
      2: { text: 'They compare sources so they can see more than one side.', provenance: 'learner-message', sourceMessageId: 'w3' },
      3: { text: 'Using evidence carefully helps historians understand the past.', provenance: 'learner-message', sourceMessageId: 'w4' },
    },
    essay: 'Caller supplied text must never be trusted.',
    ...overrides,
  }
}

const deps = (admin) => ({
  requestContext: { user: { id: FACILITATOR }, admin },
  repository: { findOwnedLearner: async () => ({ id: LEARNER }) },
})

test('final composition is assembled server-side from learner-authored slot records', async () => {
  let stored = null
  const response = await POST(new Request('http://localhost/api/webb-compositions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody()),
  }), deps(fakeAdmin(row => { stored = row })))
  assert.equal(response.status, 200)
  const result = await response.json()
  const expected = 'Historians use evidence to learn about the past. Evidence can come from documents and other sources. They compare sources so they can see more than one side. Using evidence carefully helps historians understand the past.'
  assert.equal(stored.essay, expected)
  assert.equal(result.composition.essay, expected)
  assert.notEqual(result.composition.essay, 'Caller supplied text must never be trusted.')
  assert.equal(stored.status, 'final')
  assert.equal(stored.accepted_sentences[2].sourceMessageId, 'w3')
})

test('final composition rejects a generated sentence instead of laundering it into learner work', async () => {
  const body = requestBody()
  body.acceptedSentences[2] = { text: 'Generated sentence.', provenance: 'generated' }
  let writes = 0
  const response = await POST(new Request('http://localhost/api/webb-compositions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), deps(fakeAdmin(() => { writes += 1 })))
  assert.equal(response.status, 400)
  assert.equal(writes, 0)
  assert.match((await response.json()).error, /requires every learner-authored slot/i)
})

test('composition persistence rejects a session that is not a verified Mrs. Webb execution', async () => {
  const admin = fakeAdmin()
  const originalFrom = admin.from
  admin.from = (table) => {
    const builder = originalFrom(table)
    if (table === 'lesson_sessions') builder.maybeSingle = () => Promise.resolve({ data: { id: EXECUTION, learner_id: LEARNER, lesson_id: LESSON, session_id: BROWSER, instructional_teacher: 'sonoma' }, error: null })
    return builder
  }
  const response = await POST(new Request('http://localhost/api/webb-compositions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody()),
  }), deps(admin))
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /could not be verified/i)
})


test('previous v2 compositions keep their protocol identity when persisted', async () => {
  const previousPlan = {
    protocolVersion: 'webb-composition-v2-objective-blueprint',
    controllingIdea: 'Historians compare evidence to understand the past.',
    slots: [
      { id: 'objective-1', role: 'topic', focus: 'Explain historical evidence.', connection: 'previous opening role', sourceObjectiveIndices: [0] },
      { id: 'objective-2', role: 'conclusion', focus: 'Explain source comparison.', connection: 'previous closing role', sourceObjectiveIndices: [1] },
    ],
  }
  let stored = null
  const response = await POST(new Request('http://localhost/api/webb-compositions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody({
      compositionPlan: previousPlan,
      acceptedSentences: {
        0: { text: 'Historians use evidence to learn about the past.', provenance: 'learner-message', sourceMessageId: 'old-w1' },
        1: { text: 'Comparing evidence helps historians understand the past.', provenance: 'learner-message', sourceMessageId: 'old-w2' },
      },
    })),
  }), deps(fakeAdmin(row => { stored = row })))

  assert.equal(response.status, 200)
  assert.equal(stored.protocol_version, 'webb-composition-v2-objective-blueprint')
  assert.equal(stored.composition_plan.protocolVersion, 'webb-composition-v2-objective-blueprint')
})

test('Emma composition persists every objective sentence plus separate topic and conclusion', async () => {
  const objectives = [
    'Understand maps.', 'Describe physical maps.', 'Explain climate.',
    'Distinguish human-made features.', 'Explain regions.', 'Explain settlement.', 'Explain migration.',
  ]
  const notes = Object.fromEntries(objectives.map((_, index) => [
    index, { text: 'Emma note ' + index, provenance: 'learner-message', sourceMessageId: 'note-' + index },
  ]))
  const plan = buildWebbCompositionPlan(objectives, notes)
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
  const acceptedSentences = Object.fromEntries(sentences.map((text, index) => [index, {
    text, provenance: 'learner-message', sourceMessageId: 'writing-' + index,
    accepted: true, accuracy: 'correct', sentenceOk: true, positionFit: true, paragraphFit: true,
  }]))
  let stored = null
  const response = await POST(new Request('http://localhost/api/webb-compositions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody({
      objectives, learnerNotes: notes, compositionPlan: plan, acceptedSentences,
    })),
  }), deps(fakeAdmin(row => { stored = row })))
  assert.equal(response.status, 200)
  assert.equal(stored.status, 'final')
  assert.equal(stored.essay, sentences.join(' '))
  assert.equal(stored.accepted_sentences[3].text, sentences[3])
  assert.ok(stored.finalized_at)
})
