import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildLiftoffSnapshotFeatureState, canRestoreLiftoffSnapshot } from '../slateLiftoff.mjs'
import {
  createSlateMathTestSession,
  formatSlateMathTestResponse,
  mathTestSubmissionReady,
  restoreSlateMathTestDraft,
  slateTestMathFingerprint,
} from '../slateMathTest.mjs'
import {
  buildMathActivityProblem,
  recordMathSessionHelp,
  submitMathSession,
  updateMathSessionView,
} from '../../../lib/math/mathSession.mjs'
import { evaluateMathTestAnswer } from '../../../lib/math/mathTestAnswer.mjs'
import { routeMathTextInput } from '../../../lib/math/mathTextInput.mjs'
import { enterVerticalMathRowAnswer } from '../../../lib/math/verticalMath.mjs'

function enterText(state, text, selectedLocation = null, requestId = 'input') {
  const problem = buildMathActivityProblem(state.spec)
  const routed = routeMathTextInput(problem, state.view, text, { selectedLocation })
  if (routed.kind !== 'entry') return { routed, state }
  const updated = updateMathSessionView(state, routed.view, {
    activityId: state.activityId,
    expectedRevision: state.revision,
    requestId,
  })
  assert.equal(updated.ok, true)
  return { routed, state: updated.state }
}

const slateExperienceSource = readFileSync(
  new URL('../../session/slate/SlateLiftoffExperience.jsx', import.meta.url),
  'utf8',
)

test('wrong shorter test answers submit without public correctness feedback', () => {
  const item = { question: '999 + 1 = ?', expected: '1000' }
  let state = createSlateMathTestSession({ item, activityId: 'shorter' }).state
  state = enterText(state, '9').state
  assert.equal(mathTestSubmissionReady(state), true)
  assert.equal(evaluateMathTestAnswer(buildMathActivityProblem(state.spec), state.view).correct, false)

  const submitted = submitMathSession(state, {
    activityId: state.activityId,
    expectedRevision: state.revision,
    requestId: 'submit-shorter',
  })
  assert.equal(submitted.ok, true)
  assert.equal(submitted.submission.evaluation, undefined)
  assert.equal(submitted.submission.entries && typeof submitted.submission.entries, 'object')
  assert.equal(formatSlateMathTestResponse(state), '9')

  const help = recordMathSessionHelp(state, {
    activityId: state.activityId,
    expectedRevision: state.revision,
    requestId: 'test-help',
    kind: 'line_help',
  })
  assert.equal(help.ok, false)
  assert.equal(help.code, 'TEST_HELP_LOCKED')
  assert.equal(state.attempts.length, 0)

  const duplicate = submitMathSession(submitted.state, {
    activityId: state.activityId,
    expectedRevision: state.revision,
    requestId: 'submit-shorter',
  })
  assert.equal(duplicate.ok, true)
  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.state.attempts.length, submitted.state.attempts.length)
})

test('regular numeric text and directly edited grid produce the same response record', () => {
  const item = { question: 'What is 40 + 2?', expectedAny: ['42'] }
  const textStart = createSlateMathTestSession({ item, activityId: 'text' }).state
  const textState = enterText(textStart, '42').state

  const gridStart = createSlateMathTestSession({ item, activityId: 'grid' }).state
  const problem = buildMathActivityProblem(gridStart.spec)
  const gridEntry = enterVerticalMathRowAnswer(problem, gridStart.view, problem.resultRow.id, '42')
  assert.equal(gridEntry.ok, true)
  const gridUpdated = updateMathSessionView(gridStart, gridEntry.view, {
    activityId: gridStart.activityId,
    expectedRevision: gridStart.revision,
    requestId: 'grid-input',
  })
  assert.equal(gridUpdated.ok, true)
  assert.equal(formatSlateMathTestResponse(textState), formatSlateMathTestResponse(gridUpdated.state))
  assert.deepEqual(textState.view.entries, gridUpdated.state.view.entries)
})

test('division routing is neutral when ambiguous and preserves partial answer rows', () => {
  const item = { question: 'Solve: 100 ÷ 8', expected: '12 remainder 4' }
  let state = createSlateMathTestSession({ item, activityId: 'division' }).state
  const problem = buildMathActivityProblem(state.spec)
  const ambiguous = routeMathTextInput(problem, state.view, '12')
  assert.equal(ambiguous.kind, 'clarification')
  assert.doesNotMatch(ambiguous.message, /correct|wrong|answer is/i)

  state = enterText(state, '12', `${problem.answerRows[0].id}.*`, 'quotient').state
  assert.equal(mathTestSubmissionReady(state), false)
  const beforeRemainder = { ...state.view.entries }
  state = enterText(state, '4', `${problem.answerRows[1].id}.*`, 'remainder').state
  assert.equal(mathTestSubmissionReady(state), true)
  for (const [location, value] of Object.entries(beforeRemainder)) assert.equal(state.view.entries[location], value)
  assert.equal(formatSlateMathTestResponse(state), '12 r 4')
})

test('test clarification replaces router examples with numbers-free directions', () => {
  const clarificationBranch = slateExperienceSource.match(
    /if \(route\.kind === 'clarification'\) \{([\s\S]*?)\n\s*\}/,
  )?.[1] || ''
  assert.match(clarificationBranch, /Enter both the quotient and remainder, or select an answer row\./)
  assert.match(clarificationBranch, /Select the space or answer row for this entry\./)
  assert.doesNotMatch(clarificationBranch, /route\.message|\d/)
  assert.match(slateExperienceSource, /if \(route\.kind === 'invalid'\) \{\s*setAssessmentMathError\(route\.message\)/)
})

test('lesson completion rechecks ownership after transcript update before final UI', () => {
  assert.match(
    slateExperienceSource,
    /await updateTranscriptLiveSegment\([\s\S]*?\n\s*\} catch \{\}\s*\n\s*if \(!stillOwns\(\)\) return\s*\n\s*const completionText/,
  )
})

test('test completion failures surface in math status without clearing retry state', () => {
  const start = slateExperienceSource.indexOf('const submitAssessmentAnswer = useCallback')
  const end = slateExperienceSource.indexOf('\n  }, [appendTranscript', start)
  const submitAssessmentSource = slateExperienceSource.slice(start, end)
  const recoveryCatch = submitAssessmentSource.match(
    /\} catch \(cause\) \{([\s\S]*?)\n\s*\} finally/,
  )?.[1] || ''

  assert.match(recoveryCatch, /setAssessmentMathError\(cause\?\.message \|\| 'The independent assessment could not continue\.'\)/)
  assert.doesNotMatch(recoveryCatch, /setError|setAssessmentMathPending|assessmentMathPendingRef|setAssessmentAnswer|setTestResults/)
})

test('draft session, text, destination, pending id, and fingerprint survive same-execution snapshots', () => {
  const item = { question: '7 × 6', answer: '42' }
  const state = enterText(createSlateMathTestSession({ item, activityId: 'draft' }).state, '4').state
  const fingerprint = slateTestMathFingerprint(item, state.spec)
  const pending = { id: 'pending-1', index: 0, question: item.question, status: 'evidence' }
  const featureState = buildLiftoffSnapshotFeatureState({
    occurrenceId: 'occ', executionSessionId: 'exec', phase: 'test', liftoff: { turnNumber: 3 },
    assessmentMathSession: state, assessmentMathPending: pending,
    assessmentMathText: '4', assessmentMathTextLocation: 'result.*',
    assessmentMathFingerprint: fingerprint,
  })
  assert.strictEqual(featureState.assessmentMathSession, state)
  assert.strictEqual(featureState.assessmentMathPending, pending)
  assert.equal(featureState.assessmentMathText, '4')
  assert.equal(featureState.assessmentMathTextLocation, 'result.*')
  assert.equal(featureState.assessmentMathFingerprint, fingerprint)
  assert.equal(canRestoreLiftoffSnapshot({ featureState }, { occurrenceId: 'occ', executionSessionId: 'exec' }), true)

  const transferred = { featureState, ownershipHandoff: { targetExecutionSessionId: 'exec-2' } }
  assert.equal(canRestoreLiftoffSnapshot(transferred, { occurrenceId: 'occ', executionSessionId: 'exec-2' }), true)
  const sameExecutionDraft = restoreSlateMathTestDraft(featureState)
  assert.strictEqual(sameExecutionDraft.session, state)
  assert.strictEqual(sameExecutionDraft.pending, pending)
  assert.equal(sameExecutionDraft.text, '4')

  const restartedDraft = restoreSlateMathTestDraft(featureState, { restart: true })
  assert.deepEqual(restartedDraft, { session: null, pending: null, text: '', textLocation: '', fingerprint: '' })
})
