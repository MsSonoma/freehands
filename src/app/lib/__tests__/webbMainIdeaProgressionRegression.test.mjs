import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyWebbLearnerResponseEligibility, classifyWebbObjectiveAttempt, addWebbAssistance, findClearAnswerReproduction, WEBB_ASSISTANCE_TYPES } from '../webbMasteryModel.mjs'
import { evaluateWebbObjectives } from '../webbObjectiveEvaluation.mjs'
import { emptyWebbObjectiveState, mergeWebbObjectiveResult, webbObjectiveProgress, shouldRecoverWebbNotes } from '../webbObjectiveState.mjs'

const objective = 'The learner can explain that the main idea is the most important message of an informational text.'
const question = 'If an article explains that exercise strengthens muscles and improves heart health, what important message would the article give about exercise?'
const assistant = (content, id, prompt) => ({ role: 'assistant', content, id, ...(prompt ? { objectivePrompt: prompt, objectiveIndex: 0 } : {}) })
const user = (content, id) => ({ role: 'user', content, id })
const correct = JSON.stringify({ evaluations: [{ objectiveIndex: 0, accuracy: 'correct', sentenceOk: true, noteReady: true, evidenceKind: 'meaning' }] })

test('Webb does not grade learner confusion or objections as failed objective responses', async () => {
  const comments = ["So I don't understand?", "I guess you won't accept answers unless they are full sentences.", "You keep saying I'm missing a part, but what is it?", "I am an adult and this is making me angry. How is a child supposed to get credit?"]
  for (const content of comments) {
    let calls = 0
    const result = await evaluateWebbObjectives({ objectives: [objective], conversation: [assistant('What is the main idea?', 'a0'), user(content, 'u0')], callModel: async () => { calls++; return correct } })
    assert.equal(classifyWebbLearnerResponseEligibility(content).eligible, false, content)
    assert.equal(calls, 0)
    assert.deepEqual(result.newlyUnderstood, [])
    assert.deepEqual(result.objectiveEvidence, {})
  }
})

test('learner descriptions of a character feeling angry remain gradable answers', () => {
  assert.equal(classifyWebbLearnerResponseEligibility('He made me angry because he never listened.').eligible, true)
})

test('missing composition notes never take priority over uncompleted learning objectives', () => {
  const goals = [objective, 'The learner can identify supporting details.']
  const pending = webbObjectiveProgress(goals, { understoodObj: [0], learnerNotes: {} })
  assert.deepEqual(pending.remainingIndices, [1])
  assert.deepEqual(pending.missingNoteIndices, [0])
  assert.equal(shouldRecoverWebbNotes(pending), false)
  assert.equal(shouldRecoverWebbNotes(pending, true), true)
  const finished = webbObjectiveProgress(goals, { understoodObj: [0, 1], learnerNotes: {} })
  assert.equal(shouldRecoverWebbNotes(finished), true)
})

test('an explicitly supplied answer remains reproduction, even inside a passage-style question', () => {
  const source = 'If an article says the main idea is exercise improves health, what important message does that article give?'
  const lines = [assistant(source, 'a0', source), user('exercise improves health', 'u0')]
  assert.ok(findClearAnswerReproduction(lines, 1))
})

test('fresh main idea application completes the active objective after a reproduced definition without inventing independent mastery', async () => {
  const prefix = [assistant('The main idea is the most important message. What is it?', 'a0'), user('The main idea is the most important message', 'u0')]
  const repeated = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective, conversation: prefix, evaluation: { sourceMessageIndex: 1, accuracy: 'correct', sentenceOk: true, noteReady: true }, priorPromptExposed: false })
  assert.equal(repeated.comprehension, 'not_demonstrated')
  const previous = addWebbAssistance(repeated, { type: WEBB_ASSISTANCE_TYPES.CORRECTION, sourceMessageIndex: 2 })
  const conversation = [...prefix, assistant(question, 'a1', question), user('exercise strengthens muscles and that improves health', 'u1')]
  const result = await evaluateWebbObjectives({ objectives: [objective, 'The learner can identify supporting details.'], coveredIndices: [0], targetObjectiveIndex: 0, objectiveEvidence: { 0: previous }, priorPromptExposure: { 0: false, 1: false }, conversation, callModel: async () => correct })
  assert.deepEqual(result.newlyUnderstood, [0])
  assert.equal(result.objectiveEvidence[0].comprehension, 'demonstrated')
  assert.equal(result.objectiveEvidence[0].mastery, 'pending')
  assert.equal(result.objectiveEvidence[0].latestAttempt.masteryOutcome, 'assisted_success')
  const state = mergeWebbObjectiveResult([objective, 'The learner can identify supporting details.'], emptyWebbObjectiveState(), result, conversation)
  assert.deepEqual(webbObjectiveProgress([objective, 'The learner can identify supporting details.'], state).remainingIndices, [1])
})
