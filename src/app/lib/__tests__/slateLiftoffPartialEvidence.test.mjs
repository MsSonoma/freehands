import assert from 'node:assert/strict'
import test from 'node:test'
import { filterLiftoffPartialEvidence, validateLiftoffEvidenceAgainstDemand } from '../slateLiftoffPartialEvidence.mjs'

const observation = (componentId, result, responseStatus, responseQuote) => ({
  componentId, result, responseStatus, responseQuote, independent: true,
})

test('correct answer credited while omitted explanation and identification remain unobserved', () => {
  const rows = [
    observation('calculate', 'independent_success', 'correct', '8'),
    observation('explain', 'failure', 'not_addressed', ''),
    observation('identify', 'failure', 'incorrect', ''),
  ]
  const result = filterLiftoffPartialEvidence(rows, '8')
  assert.deepEqual(result.map(row => row.componentId), ['calculate'])
})

test('two correct components and one actual wrong response preserve both successes and failure', () => {
  const result = filterLiftoffPartialEvidence([
    observation('calculate', 'independent_success', 'correct', '8'),
    observation('identify', 'independent_success', 'correct', 'division'),
    observation('explain', 'failure', 'incorrect', 'because six times eight is forty'),
  ], '8; division; because six times eight is forty')
  assert.deepEqual(result.map(row => row.result), ['independent_success', 'independent_success', 'failure'])
})

test('an observed mistake and a correct explanation can coexist', () => {
  const result = filterLiftoffPartialEvidence([
    observation('calculate', 'failure', 'incorrect', '9'),
    observation('reason', 'independent_success', 'correct', 'six groups of eight'),
  ], '9, but six groups of eight')
  assert.deepEqual(result.map(row => row.componentId), ['calculate', 'reason'])
})

test('unquoted or mismatched observations are discarded rather than making the learner wrong', () => {
  const result = filterLiftoffPartialEvidence([
    observation('explain', 'failure', 'incorrect', 'not supplied'),
    observation('identify', 'failure', 'incorrect', ''),
    observation('calculate', 'independent_success', 'correct', '8'),
  ], '8')
  assert.deepEqual(result.map(row => row.componentId), ['calculate'])
})

test('later missing evidence can be credited on its own turn', () => {
  const first = filterLiftoffPartialEvidence([
    observation('calculate', 'independent_success', 'correct', '8'),
    observation('identify', 'failure', 'not_addressed', ''),
  ], '8')
  const second = filterLiftoffPartialEvidence([
    observation('identify', 'independent_success', 'correct', 'division'),
  ], 'division')
  assert.deepEqual([...first, ...second].map(row => row.componentId), ['calculate', 'identify'])
})

test('complete correct response records all evidence', () => {
  const result = filterLiftoffPartialEvidence([
    observation('calculate', 'independent_success', 'correct', '8'),
    observation('identify', 'independent_success', 'correct', 'division'),
  ], '8, division')
  assert.equal(result.length, 2)
})


const demandAction = {
  targetComponentIds: ['moon-view'],
  problem: {
    prompt: 'What changes in the lit part of the Moon that we can see?',
    instanceKey: 'moon-view:visible-lit-part',
    responseContract: {
      version: 'question-demand-v1',
      contractId: 'question-demand-moon-view',
      targetComponentId: 'moon-view',
      demandType: 'describe',
      criterion: 'Describe what changes in the visible lit part of the Moon.',
    },
  },
}

test('question-bound gate rejects a failure for an unasked broader criterion', () => {
  const result = validateLiftoffEvidenceAgainstDemand({
    learnerResponse: 'We see lit and unlit parts, and what we can see changes.',
    currentAction: demandAction,
    demandJudgment: {
      contractId: 'question-demand-moon-view',
      status: 'satisfied',
      responseQuote: 'what we can see changes',
      reason: 'The learner described the requested visible change.',
    },
    feedbackDisposition: 'affirm',
    observations: [
      { componentId: 'moon-view', result: 'independent_success', responseStatus: 'correct', responseQuote: 'what we can see changes', basis: 'asked_target', independent: true },
      { componentId: 'objective-2', result: 'failure', responseStatus: 'incorrect', responseQuote: 'lit and unlit parts', basis: 'asked_target', independent: true },
    ],
  })
  assert.equal(result.valid, false)
  assert.deepEqual(result.observations.map(row => [row.componentId, row.result]), [['moon-view', 'independent_success']])
  assert.ok(result.violations.includes('asked_target_component_mismatch'))
})

test('ambiguous answer cannot be converted into target failure', () => {
  const result = validateLiftoffEvidenceAgainstDemand({
    learnerResponse: 'The same side faces Earth, but a different side may face the Sun.',
    currentAction: demandAction,
    demandJudgment: {
      contractId: 'question-demand-moon-view',
      status: 'ambiguous',
      responseQuote: '',
      reason: 'The answer is related but does not cleanly resolve the exact question.',
    },
    feedbackDisposition: 'clarify',
    observations: [
      { componentId: 'moon-view', result: 'failure', responseStatus: 'incorrect', responseQuote: 'The same side faces Earth', basis: 'asked_target', independent: true },
    ],
  })
  assert.equal(result.valid, false)
  assert.equal(result.observations.length, 0)
  assert.ok(result.violations.includes('negative_target_judgment_mismatch'))
})

test('explicit volunteered contradiction can still be admitted outside the asked target', () => {
  const result = validateLiftoffEvidenceAgainstDemand({
    learnerResponse: 'The bright part changes because Earth is spinning around its axis.',
    currentAction: demandAction,
    demandJudgment: {
      contractId: 'question-demand-moon-view',
      status: 'not_addressed',
      responseQuote: '',
      reason: 'The exact requested visible change was not supplied.',
    },
    feedbackDisposition: 'correct',
    observations: [
      {
        componentId: 'objective-2',
        result: 'failure',
        responseStatus: 'incorrect',
        responseQuote: 'because Earth is spinning around its axis',
        basis: 'volunteered_contradiction',
        contradiction: 'Earth rotation causes Moon phases.',
        independent: true,
      },
    ],
  })
  assert.equal(result.valid, true)
  assert.equal(result.observations[0].basis, 'volunteered_contradiction')
  assert.equal(result.observations[0].accepted, true)
})

test('legacy question rejects ordinary negative evidence without a response contract', () => {
  const result = validateLiftoffEvidenceAgainstDemand({
    learnerResponse: 'Rotation.',
    currentAction: { targetComponentIds: ['moon-view'], problem: { prompt: 'What is the path called?', instanceKey: 'legacy' } },
    demandJudgment: { contractId: '', status: 'incorrect', responseQuote: 'Rotation', reason: 'Wrong word.' },
    feedbackDisposition: 'correct',
    observations: [
      { componentId: 'moon-view', result: 'failure', responseStatus: 'incorrect', responseQuote: 'Rotation', basis: 'asked_target', independent: true },
    ],
  })
  assert.equal(result.valid, false)
  assert.equal(result.observations.length, 0)
  assert.ok(result.violations.includes('legacy_uncontracted_negative'))
})
