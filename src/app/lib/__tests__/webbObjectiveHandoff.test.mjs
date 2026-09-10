import test from 'node:test'
import assert from 'node:assert/strict'
import { POST } from '../../api/webb-objectives/route.js'
import { evaluateWebbObjectives } from '../webbObjectiveEvaluation.mjs'
import { createLearnerNote, evaluationSource } from '../webbLearnerEvidence.mjs'
import { classifyWebbObjectiveAttempt, addWebbAssistance, WEBB_ASSISTANCE_TYPES } from '../webbMasteryModel.mjs'
import { WEBB_SNAPSHOT_VERSION, migrateWebbSnapshot, createWritingAttempt, assembleLearnerEssay } from '../webbLearningModel.mjs'
import { emptyWebbObjectiveState, mergeWebbObjectiveResult, reconcileWebbObjectiveState, webbObjectiveProgress, createWebbObjectiveQueue } from '../webbObjectiveState.mjs'

const AUTHOR = 'The learner understands that The Magic Finger was written by Roald Dahl.'
const NARRATOR = 'The learner understands that the narrator is a girl.'
const OBJECTIVES = [AUTHOR, NARRATOR]
const judgment = (objectiveIndex = 0, accuracy = 'correct', sentenceOk = true, evidenceKind = 'meaning') => JSON.stringify({ evaluations: [{ objectiveIndex, accuracy, sentenceOk, evidenceKind }] })
const noJudgments = JSON.stringify({ evaluations: [] })
const teacher = (content, id = 'a1') => ({ role: 'assistant', content, id })
const learner = (content, id = 'u1') => ({ role: 'user', content, id })
const first = text => [teacher('What do you already know about The Magic Finger?'), learner(text)]

async function routeResult(conversation, raw, extra = {}) {
  const request = new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check', objectives: OBJECTIVES, conversation, priorPromptExposure: { 0: false, 1: false }, ...extra }),
  })
  const response = await POST(request, { apiKey: 'offline-test', callModel: async (system, prompt) => {
    assert.match(system, /Judge that ENTIRE message/)
    assert.doesNotMatch(system, /STUDENT_QUOTE/)
    const input = JSON.parse(prompt)
    assert.equal(typeof input.learner_response, 'string')
    assert.ok(input.context_before_response.every(message => ['user', 'assistant'].includes(message.role)))
    assert.doesNotMatch(system, /MESSAGE_INDEX|STUDENT_QUOTE/)
    assert.equal(input.learner_response, conversation.at(-1).content)
    return raw
  } })
  assert.equal(response.status, 200)
  return response.json()
}

for (const text of ['Roald Dahl wrote the magic finger', 'The Magic Finger was written by Roald Dahl.', 'Roald Dahl']) {
  test('HTTP result -> note -> credit -> next question preserves exact learner text: ' + text, async () => {
    const conversation = first(text)
    const result = await routeResult(conversation, judgment())
    const state = mergeWebbObjectiveResult(OBJECTIVES, emptyWebbObjectiveState(), result, conversation)
    assert.equal(state.learnerNotes[0].text, text)
    assert.equal(state.learnerNotes[0].sourceMessageId, 'u1')
    assert.deepEqual(state.understoodObj, [0])
    const progress = webbObjectiveProgress(OBJECTIVES, state)
    assert.equal(progress.understoodCount, 1)
    assert.deepEqual(progress.remainingObjectives, [NARRATOR])
    assert.deepEqual(progress.completedObjectives, [AUTHOR])
    assert.equal(progress.writingReady, false)
    assert.equal(result.objectiveEvidence[0].mastery, 'mastered')
    assert.equal(result.objectiveEvidence[0].retention, 'not_measured')
    const saved = JSON.parse(JSON.stringify({ snapshotVersion: 5, objectives: OBJECTIVES, chatMessages: conversation, ...state }))
    assert.equal(migrateWebbSnapshot(saved).learnerNotes[0].text, text)
  })
}

test('legacy quote capitalization and terminal punctuation do not rewrite or discard the answer', () => {
  const text = 'roald dahl wrote the magic finger'
  const note = createLearnerNote({ objectiveIndex: 0, conversation: first(text), evaluation: { accuracy: 'correct', sourceMessageIndex: 1, quote: 'Roald Dahl wrote The Magic Finger.' } })
  assert.equal(note.text, text)
})

test('source validation rejects wrong roles, invented words, negation changes and malformed indices', () => {
  const conversation = [teacher('Roald Dahl wrote the book.'), learner('Roald Dahl did not write the book.')]
  for (const sourceMessageIndex of [null, undefined, '', -1, 0, '1junk', 1.5, 99]) {
    assert.equal(evaluationSource(conversation, { sourceMessageIndex }), null)
  }
  assert.equal(evaluationSource(conversation, { sourceMessageIndex: 1, quote: 'Roald Dahl wrote the book.' }), null)
  assert.equal(evaluationSource(first('1.5'), { sourceMessageIndex: 1, quote: '15' }), null)
})

test('invalid objective judgment is an evaluation error, never credited mastery with a missing note', async () => {
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check', objectives: OBJECTIVES, conversation: first('Roald Dahl') }),
  }), { apiKey: 'offline-test', callModel: async () => judgment(999) })
  assert.equal(response.status, 500)
  assert.ok((await response.json()).error)
})

test('v4 already-demonstrated answer recovers its note on resume without a model call or regrading', () => {
  const conversation = first('The Magic Finger was written by Roald Dahl.')
  const evidence = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective: AUTHOR, conversation, evaluation: { accuracy: 'correct', sentenceOk: true, sourceMessageIndex: 1 } })
  conversation.push(teacher('Yes, Roald Dahl wrote The Magic Finger. Can you say that again?', 'a2'))
  const saved = { snapshotVersion: 4, objectives: OBJECTIVES, chatMessages: conversation, understoodObj: [0], coveredObj: [0], objectiveEvidence: { 0: evidence }, learnerNotes: {}, writingDraft: 'Keep my draft', writingAttempts: { 0: [{ text: 'Keep my attempt' }] }, acceptedSentences: {} }
  const before = structuredClone(saved)
  const restored = migrateWebbSnapshot(saved)
  assert.equal(restored.snapshotVersion, WEBB_SNAPSHOT_VERSION)
  assert.equal(restored.learnerNotes[0].text, conversation[1].content)
  assert.deepEqual(restored.objectiveEvidence, saved.objectiveEvidence)
  assert.deepEqual(restored.writingAttempts, saved.writingAttempts)
  assert.equal(restored.writingDraft, 'Keep my draft')
  assert.deepEqual(saved, before)
  assert.deepEqual(migrateWebbSnapshot(restored), restored)
})

test('missing source keeps existing comprehension visible but never manufactures a writing note', () => {
  const conversation = first('Roald Dahl wrote The Magic Finger.')
  const evidence = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective: AUTHOR, conversation, evaluation: { accuracy: 'correct', sourceMessageIndex: 1 } })
  const restored = reconcileWebbObjectiveState([AUTHOR], { understoodObj: [0], objectiveEvidence: { 0: evidence } }, [])
  assert.equal(webbObjectiveProgress([AUTHOR], restored).understoodCount, 1)
  assert.equal(webbObjectiveProgress([AUTHOR], restored).allObjectivesMet, true)
  assert.equal(webbObjectiveProgress([AUTHOR], restored).writingReady, false)
  assert.deepEqual(webbObjectiveProgress([AUTHOR], restored).remainingObjectives, [])
  assert.equal(restored.learnerNotes[0], undefined)
})

test('existing Webb clients recover known comprehension without using note readiness to regrade it', async () => {
  const conversation = first('Roald Dahl wrote The Magic Finger.')
  const evidence = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective: AUTHOR, conversation, evaluation: { accuracy: 'correct', sourceMessageIndex: 1 } })
  const result = await evaluateWebbObjectives({ objectives: [AUTHOR], conversation, legacyNoteReadyIndices: [], coveredIndices: [0], objectiveEvidence: { 0: evidence }, callModel: async () => { throw new Error('must not regrade') } })
  assert.equal(result.learnerNotes[0].text, conversation[1].content)
  assert.deepEqual(result.newlyCompleted, [0])
  assert.deepEqual(result.objectiveEvidence[0], evidence)
})

test('Sonoma completed indices remain excluded from the shared evaluator', async () => {
  let calls = 0
  const result = await evaluateWebbObjectives({ objectives: [AUTHOR], completedIndices: [0], conversation: first('Roald Dahl'), callModel: async () => { calls++; return noJudgments } })
  assert.equal(calls, 0)
  assert.deepEqual(result.newlyCompleted, [])
})

for (const accuracy of ['partial', 'incorrect']) {
  test(accuracy + ' answers remain uncompleted and cannot become notes', async () => {
    const result = await routeResult(first('The book wrote itself.'), judgment(0, accuracy))
    assert.deepEqual(result.newlyCompleted, [])
    assert.deepEqual(result.learnerNotes, {})
    assert.notEqual(result.objectiveEvidence[0].mastery, 'mastered')
  })
}

test('copied explanations remain exposure, not independent mastery or comprehension', async () => {
  const objective = 'Explain why the colonists objected to taxes.'
  const text = 'The colonists opposed taxes because they had no representation in Parliament.'
  const result = await evaluateWebbObjectives({ objectives: [objective], conversation: [teacher(text), learner(text)], priorPromptExposure: { 0: false }, callModel: async () => judgment() })
  assert.deepEqual(result.newlyCompleted, [])
  assert.deepEqual(result.learnerNotes, {})
  assert.equal(result.evaluationStatus[0], 'reproduced')
  assert.equal(result.objectiveEvidence[0].mastery, 'pending')
})

test('assisted comprehension makes a note without being promoted to independent mastery', async () => {
  const objective = 'Explain why the colonists opposed taxation without representation.'
  const result = await evaluateWebbObjectives({ objectives: [objective], conversation: [teacher('Britain taxed them without representation.'), learner('They paid taxes but had no vote.')], objectiveEvidence: { 0: addWebbAssistance({ objective, attempts: [] }, { type: WEBB_ASSISTANCE_TYPES.CORRECTION, sourceMessageIndex: 0 }) }, priorPromptExposure: { 0: false }, callModel: async () => judgment() })
  assert.deepEqual(result.newlyCompleted, [0])
  assert.equal(result.learnerNotes[0].text, 'They paid taxes but had no vote.')
  assert.equal(result.objectiveEvidence[0].mastery, 'pending')
})

test('retrying the same response never creates duplicate attempts or downgrades evidence', () => {
  const conversation = first('Roald Dahl wrote The Magic Finger.')
  const args = { objectiveIndex: 0, objective: AUTHOR, conversation, evaluation: { accuracy: 'correct', sourceMessageIndex: 1 } }
  const prior = classifyWebbObjectiveAttempt(args)
  const replay = classifyWebbObjectiveAttempt({ ...args, previousEvidence: prior, priorPromptExposed: true })
  assert.deepEqual(replay, prior)
  assert.equal(replay.attempts.length, 1)
})

test('model failure does not mutate supplied learning state', async () => {
  const state = emptyWebbObjectiveState()
  await assert.rejects(evaluateWebbObjectives({ objectives: OBJECTIVES, conversation: first('Roald Dahl'), objectiveEvidence: state.objectiveEvidence, callModel: async () => { throw Error('offline') } }), /offline/)
  assert.deepEqual(state, emptyWebbObjectiveState())
  await assert.rejects(evaluateWebbObjectives({ objectives: OBJECTIVES, conversation: first('Roald Dahl'), callModel: async () => '' }), /no result/)
})

test('objective generation repairs bundled draft rows and exposes only the ordered objective strings', async () => {
  const bundled = {
    objectives: [
      { role: 'opening', atomic_focus: 'character and problem', connection: 'sets up the story', objective: 'The learner can explain who the main character is and what problem the character faces.' },
      { role: 'development', atomic_focus: 'first attempt', connection: 'follows the problem', objective: 'The learner can explain what the character tries first.' },
      { role: 'development', atomic_focus: 'turning clue', connection: 'changes the search', objective: 'The learner can explain what clue changes the search.' },
      { role: 'development', atomic_focus: 'resolution', connection: 'resolves the search', objective: 'The learner can explain how the problem is solved.' },
      { role: 'conclusion', atomic_focus: 'lesson and evidence', connection: 'closes on meaning', objective: 'The learner can explain the lesson about responsibility and identify the event that supports it.' },
    ],
  }
  const repaired = {
    objectives: [
      { role: 'opening', atomic_focus: 'central problem', connection: 'establishes the situation', objective: 'The learner can explain the central problem the character faces.' },
      { role: 'development', atomic_focus: 'first attempt', connection: 'shows the first response', objective: 'The learner can explain what the character tries first.' },
      { role: 'development', atomic_focus: 'turning clue', connection: 'changes the search', objective: 'The learner can explain what clue changes the search.' },
      { role: 'development', atomic_focus: 'supporting event', connection: 'provides evidence before interpretation', objective: 'The learner can identify the event that best supports the lesson about responsibility.' },
      { role: 'conclusion', atomic_focus: 'responsibility theme', connection: 'synthesizes the earlier events', objective: 'The learner can explain the lesson the story suggests about responsibility.' },
    ],
  }
  let calls = 0
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate', lesson: {
      title: 'A Lost Dog Comes Home', subject: 'language arts', grade: '4',
      shortanswer: [
        { question: 'What problem does the character face?' },
        { question: 'What does the character try first?' },
        { question: 'What clue changes the search?' },
        { question: 'Which event supports the lesson?' },
        { question: 'What lesson does the story suggest about responsibility?' },
      ],
    } }),
  }), { apiKey: 'offline-test', callModel: async (system, user, _maxTokens, _temperature, responseFormat) => {
    calls += 1
    assert.equal(responseFormat?.type, 'json_object')
    if (calls === 1) {
      assert.match(system, /one focused comprehension question/i)
      return JSON.stringify(bundled)
    }
    assert.match(system, /failed the atomic essay-plan validator/i)
    const repairInput = JSON.parse(user)
    assert.ok(repairInput.validator_violations.some(value => /row 1 combines/.test(value)))
    assert.ok(repairInput.validator_violations.some(value => /row 5 combines/.test(value)))
    return JSON.stringify(repaired)
  } })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(calls, 2)
  assert.deepEqual(data.objectives, repaired.objectives.map(row => row.objective))
  assert.equal(Object.prototype.hasOwnProperty.call(data, 'roles'), false)
})

test('writing evaluator returns a separate structural-position judgment bound to prior learner prose', async () => {
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check-writing', objective: NARRATOR, note: 'the narrator is a girl', text: 'The narrator is a girl.',
      lesson: { title: 'Book response', subject: 'language arts', grade: '5' },
      objectiveIndex: 1, totalObjectives: 3, priorSentences: ['This story begins with an unusual problem.'],
    }),
  }), { apiKey: 'offline-test', callModel: async (system, user) => {
    assert.match(system, /POSITION_FIT/)
    assert.match(system, /Do not require a transition word/)
    const input = JSON.parse(user)
    assert.equal(input.essay_position.objective_index, 1)
    assert.equal(input.essay_position.position_role, 'development')
    assert.deepEqual(input.essay_position.prior_accepted_learner_sentences, ['This story begins with an unusual problem.'])
    assert.equal(input.learner_proposed_sentence, 'The narrator is a girl.')
    return 'correct|yes|no'
  } })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { accuracy: 'correct', sentenceOk: true, positionFit: false })
})

test('explicitly contradictory discourse cues cannot override essay position even when the model says yes', async () => {
  const cases = [
    { text: 'Finally, seeds need water to begin growing.', objectiveIndex: 0, totalObjectives: 5, objective: 'The learner can explain what a seed needs to begin growing.' },
    { text: 'First, plants are important because they provide food for animals.', objectiveIndex: 4, totalObjectives: 5, objective: 'The learner can explain why plants are important in an ecosystem.' },
  ]
  for (const testCase of cases) {
    const response = await POST(new Request('http://localhost/api/webb-objectives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-writing', note: 'accurate learner note', lesson: { title: 'Plants', subject: 'science', grade: '4' }, ...testCase }),
    }), { apiKey: 'offline-test', callModel: async () => 'correct|yes|yes' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { accuracy: 'correct', sentenceOk: true, positionFit: false })
  }
})

test('two completed concepts unlock writing, not automatic essay sentences; refresh preserves retries', async () => {
  const conversation = first('Roald Dahl wrote The Magic Finger.')
  let state = mergeWebbObjectiveResult(OBJECTIVES, emptyWebbObjectiveState(), await routeResult(conversation, judgment()), conversation)
  conversation.push(teacher('Who tells the story?', 'a2'), learner('a girl', 'u2'))
  state = mergeWebbObjectiveResult(OBJECTIVES, state, await routeResult(conversation, judgment(1, 'correct', false), { understoodIndices: state.understoodObj, objectiveEvidence: state.objectiveEvidence }), conversation)
  assert.equal(webbObjectiveProgress(OBJECTIVES, state).writingReady, true)
  const rejected = createWritingAttempt({ objectiveIndex: 1, text: 'a girl', message: conversation[3], accuracy: 'correct', sentenceOk: false })
  assert.equal(rejected.accepted, false)
  const accepted = { 0: createWritingAttempt({ objectiveIndex: 0, text: conversation[1].content, message: conversation[1], accuracy: 'correct', sentenceOk: true }) }
  const saved = migrateWebbSnapshot(JSON.parse(JSON.stringify({ snapshotVersion: 5, objectives: OBJECTIVES, chatMessages: conversation, ...state, writingMode: true, writingIndex: 1, writingSubphase: 'review', writingDraft: 'The narrator is', writingAttempts: { 1: [rejected] }, acceptedSentences: accepted })))
  assert.equal(saved.writingDraft, 'The narrator is')
  assert.equal(saved.writingSubphase, 'review')
  assert.equal(assembleLearnerEssay(OBJECTIVES, saved.acceptedSentences), '')
  accepted[1] = createWritingAttempt({ objectiveIndex: 1, text: 'The narrator is a girl.', message: learner('The narrator is a girl.', 'u3'), accuracy: 'correct', sentenceOk: true })
  assert.equal(assembleLearnerEssay(OBJECTIVES, accepted), 'Roald Dahl wrote The Magic Finger. The narrator is a girl.')
})

test('serialized checks see current state and invalidated in-flight work cannot publish', async () => {
  const queue = createWebbObjectiveQueue()
  const events = []
  let release
  const delayed = new Promise(resolve => { release = resolve })
  const firstRun = queue.run(async isCurrent => { events.push('first'); await delayed; if (isCurrent()) events.push('published-old') })
  const secondRun = queue.run(() => events.push('second'))
  await Promise.resolve()
  queue.invalidate()
  release()
  await Promise.all([firstRun, secondRun])
  await queue.run(() => events.push('new-run'))
  assert.deepEqual(events, ['first', 'new-run'])
})

test('a model-supplied message number cannot redirect credit or notes to the teacher', async () => {
  const conversation = first('Roald Dahl wrote the magic finger')
  const result = await routeResult(conversation, JSON.stringify({ evaluations: [{ objectiveIndex: 0, accuracy: 'correct', sentenceOk: true, evidenceKind: 'fixed_fact', sourceMessageIndex: 0 }] }))
  assert.equal(result.learnerNotes[0].sourceMessageId, 'u1')
  assert.deepEqual(result.newlyCompleted, [0])
})


test('correct fixed facts taught by Webb count as assisted comprehension without requiring invented synonyms', async () => {
  const conversation = [teacher('Roald Dahl wrote The Magic Finger. Who wrote it?'), learner('Roald Dahl wrote The Magic Finger.')]
  const result = await routeResult(conversation, judgment(0, 'correct', true, 'fixed_fact'))
  assert.deepEqual(result.newlyCompleted, [0])
  assert.equal(result.evaluationStatus[0], 'correct')
  assert.equal(result.learnerNotes[0].text, conversation[1].content)
  assert.equal(result.objectiveEvidence[0].mastery, 'pending')
  assert.equal(result.objectiveEvidence[0].latestAttempt.masteryOutcome, 'assisted_success')
  assert.ok(result.objectiveEvidence[0].latestAttempt.reproduction)
  const restored = migrateWebbSnapshot({ snapshotVersion: 5, objectives: OBJECTIVES, chatMessages: conversation, objectiveEvidence: result.objectiveEvidence })
  assert.equal(restored.learnerNotes[0].text, conversation[1].content)
  assert.equal(restored.objectiveEvidence[0].mastery, 'pending')
})

test('a wrong fixed fact is not accepted just because the evaluator identifies the task type', async () => {
  const result = await routeResult(first('Dr. Seuss wrote The Magic Finger.'), judgment(0, 'incorrect', true, 'fixed_fact'))
  assert.deepEqual(result.newlyCompleted, [])
  assert.deepEqual(result.learnerNotes, {})
})


test('short supplied factual names remain assisted, never independent mastery', async () => {
  const conversation = [teacher('Roald Dahl wrote The Magic Finger. Who wrote it?'), learner('Roald Dahl')]
  const result = await routeResult(conversation, judgment(0, 'correct', false, 'fixed_fact'))
  assert.deepEqual(result.newlyCompleted, [0])
  assert.equal(result.objectiveEvidence[0].mastery, 'pending')
  assert.equal(result.objectiveEvidence[0].latestAttempt.masteryOutcome, 'assisted_success')
  assert.equal(result.learnerNotes[0].text, 'Roald Dahl')
})

test('current-turn binding cannot silently substitute an earlier answer', async () => {
  const conversation = [...first('The Magic Finger was written by Roald Dahl.'), teacher('Who is the narrator?', 'a2'), learner('a girl', 'u2')]
  const result = await routeResult(conversation, judgment(1, 'correct', false, 'fixed_fact'))
  assert.equal(result.learnerNotes[1].sourceMessageId, 'u2')
  assert.equal(result.learnerNotes[1].text, 'a girl')
  assert.deepEqual(result.newlyCompleted, [1])
})

test('legacy recovery binds each response chronologically rather than asking the model to locate a message', async () => {
  const conversation = [...first('The Magic Finger was written by Roald Dahl.'), teacher('Who is the narrator?', 'a2'), learner('a girl', 'u2')]
  const seen = []
  const result = await evaluateWebbObjectives({ objectives: OBJECTIVES, conversation, recoverNotes: true,
    callModel: async (_system, prompt) => {
      const input = JSON.parse(prompt); seen.push(input.learner_response)
      return judgment(input.learner_response === 'a girl' ? 1 : 0, 'correct', input.learner_response !== 'a girl', 'fixed_fact')
    } })
  assert.deepEqual(seen, [conversation[1].content, 'a girl'])
  assert.deepEqual(result.newlyCompleted, [0, 1])
  assert.equal(result.learnerNotes[0].sourceMessageId, 'u1')
  assert.equal(result.learnerNotes[1].sourceMessageId, 'u2')
})
