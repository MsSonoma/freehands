import test from 'node:test'
import assert from 'node:assert/strict'
import {
  WEBB_ASSISTANCE_TYPES,
  addWebbAssistance,
  classifyWebbObjectiveAttempt,
  compareLearnerToAssistant,
  mergeWebbMasterySummaries,
  summarizeWebbMastery,
} from '../webbMasteryModel.mjs'

const objective = 'Explain why the colonists opposed taxation without representation.'
const learner = (content, id = 'u1') => ({ role: 'user', content, id })
const assistant = (content, id = 'a1') => ({ role: 'assistant', content, id })
const evaluate = (accuracy, sourceMessageIndex) => ({ accuracy, sentenceOk: false, sourceMessageIndex })

test('independent first-response success can establish mastery', () => {
  const result = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective, evaluation: evaluate('correct', 1), conversation: [assistant('What do you already know?'), learner('taxes with no say')] })
  assert.equal(result.coverage, 'covered')
  assert.equal(result.comprehension, 'demonstrated')
  assert.equal(result.mastery, 'mastered')
  assert.equal(result.retention, 'not_measured')
})

test('correct response after teaching is assisted comprehension, not mastery', () => {
  const previous = addWebbAssistance({ attempts: [{ accuracy: 'partial' }] }, { type: WEBB_ASSISTANCE_TYPES.CORRECTION, sourceMessageId: 'a1' })
  const result = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective, evaluation: evaluate('correct', 1), conversation: [assistant('Britain taxed them without representation.'), learner('They paid taxes but had no vote.')], previousEvidence: previous })
  assert.equal(result.coverage, 'covered')
  assert.equal(result.comprehension, 'demonstrated')
  assert.equal(result.mastery, 'pending')
  assert.equal(result.latestAttempt.masteryOutcome, 'assisted_success')
})

test('direct answer request followed by paraphrase remains assisted', () => {
  const previous = addWebbAssistance({ attempts: [{ accuracy: 'partial' }] }, { type: WEBB_ASSISTANCE_TYPES.ANSWER_REVEALED, sourceMessageId: 'a1' })
  const result = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective, evaluation: evaluate('correct', 1), conversation: [assistant('The colonists had taxes but no representation.'), learner('They were taxed but had no say.')], previousEvidence: previous })
  assert.equal(result.comprehension, 'demonstrated')
  assert.equal(result.mastery, 'pending')
  assert.equal(result.latestAttempt.independenceStatus, 'answer_revealed')
})

test('exact and clear copy reproduction establish coverage but not comprehension or mastery', () => {
  const supplied = 'The colonists opposed taxes because they had no representation in Parliament.'
  assert.equal(compareLearnerToAssistant({ learnerText: supplied, assistantText: `Remember: ${supplied}` }).copied, true)
  const result = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective, evaluation: evaluate('correct', 1), conversation: [assistant(supplied), learner(supplied)] })
  assert.equal(result.coverage, 'covered')
  assert.equal(result.comprehension, 'not_demonstrated')
  assert.equal(result.mastery, 'pending')
  assert.equal(result.latestAttempt.masteryOutcome, 'unavailable')
})

test('partial or incorrect first response remains uncovered and unmastered', () => {
  for (const accuracy of ['partial', 'incorrect']) {
    const result = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective, evaluation: evaluate(accuracy, 1), conversation: [assistant('What do you know?'), learner('taxes')] })
    assert.equal(result.coverage, 'not_covered')
    assert.equal(result.comprehension, 'not_demonstrated')
    assert.equal(result.mastery, 'pending')
  }
})

test('mixed completed concepts retain pending mastery and never claim retention', () => {
  const summary = summarizeWebbMastery(['A', 'B', 'C'], {
    0: { coverage: 'covered', comprehension: 'demonstrated', mastery: 'mastered' },
    1: { coverage: 'covered', comprehension: 'demonstrated', mastery: 'pending' },
    2: { coverage: 'covered', comprehension: 'not_demonstrated', mastery: 'pending' },
  })
  assert.deepEqual(summary.masteryPending, ['B', 'C'])
  assert.deepEqual(summary.mastered, ['A'])
  assert.equal(summary.retention, 'not_measured')
})

test('a later clean session can establish mastery for a previously pending concept', () => {
  const later = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective, evaluation: evaluate('correct', 1), conversation: [assistant('Why did the colonists object?'), learner('They were taxed without getting a voice.')], previousEvidence: {} })
  assert.equal(later.mastery, 'mastered')
  const merged = mergeWebbMasterySummaries(
    { concepts: [{ objective, mastery: 'pending' }], masteryPending: [objective], mastered: [] },
    summarizeWebbMastery([objective], { 0: later }),
  )
  assert.deepEqual(merged.masteryPending, [])
  assert.deepEqual(merged.mastered, [objective])
})
