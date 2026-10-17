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
import { slateScratchUiForQuestion } from '../slateMathScratch.mjs'
import { enterVerticalMathRowAnswer } from '../../../lib/math/verticalMath.mjs'
import { updateVerticalMathWorkingNote } from '../../../lib/math/verticalMathNotes.mjs'

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

test('bare arithmetic in a test opens the prepopulated Question Math Workspace without solving it', () => {
  const item = { type: 'fillintheblank', question: '247 + 38 =', expected: '285' }
  const result = createSlateMathTestSession({ item, activityId: 'test-question-one' })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, 'test')
  assert.deepEqual(result.state.spec.operands, ['247', '38'])
  const problem = buildMathActivityProblem(result.state.spec)
  assert.deepEqual(problem.operands, ['247', '38'])
  assert.equal(Object.keys(result.state.view.entries).length, 0)

  const shown = slateScratchUiForQuestion(null, result.state.activityId, result.state.spec, 'test')
  assert.equal(shown.visible, true)
  const hidden = slateScratchUiForQuestion({ ...shown, visible: false }, result.state.activityId, result.state.spec, 'test')
  assert.equal(hidden.visible, true)

  const next = createSlateMathTestSession({
    item: { question: '8 × 7 =', expected: '56' }, activityId: 'test-question-two',
  })
  assert.equal(next.ok, true)
  const nextShown = slateScratchUiForQuestion(hidden, next.state.activityId, next.state.spec, 'test')
  assert.equal(nextShown.visible, true)
})

test('current comma-grouped multiple-choice arithmetic opens the existing question grid and keeps choice answers', () => {
  const item = {
    question: 'What is 10,000 - 6,438?',
    choices: [{ letter: 'A', text: '3,562' }, { letter: 'B', text: '3,662' }],
    correct: 'A',
  }
  const result = createSlateMathTestSession({ item, activityId: 'current-slate-math-test' })
  assert.equal(result.ok, true)
  assert.equal(result.resolved.kind, 'math')
  assert.equal(result.state.phase, 'test')
  assert.deepEqual(result.state.spec.operands, ['10000', '6438'])
  assert.deepEqual(result.state.view.entries, {})
  const problem = buildMathActivityProblem(result.state.spec)
  assert.deepEqual(problem.operands, ['10000', '6438'])
  assert.equal(slateScratchUiForQuestion(null, result.state.activityId, result.state.spec, 'test').visible, true)

  const mathBranch = slateExperienceSource.slice(
    slateExperienceSource.indexOf(") : assessmentMathResolution.kind === 'math' ? ("),
    slateExperienceSource.indexOf(") : questionType(currentAssessment) === 'multiplechoice' ? ("),
  )
  assert.match(mathBranch, /<VerticalMathWorkspace/)
  assert.match(mathBranch, /phase="test"/)
  assert.match(mathBranch, /showCheck=\{false\}/)
  assert.match(mathBranch, /questionType\(currentAssessment\) === 'multiplechoice' \? \(/)
  assert.match(mathBranch, /submitAssessmentAnswer\(letter\)/)
  assert.match(mathBranch, /footer=\{questionType\(currentAssessment\) === 'multiplechoice' \? null/)
})

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

test('working notes stay outside text routing, view entries, evaluation, and test submission', () => {
  const item = { question: 'What is 47 + 26?', expected: '73' }
  let state = createSlateMathTestSession({ item, activityId: 'note-separation' }).state
  state = enterText(state, '73').state
  const evaluationBeforeNotes = evaluateMathTestAnswer(buildMathActivityProblem(state.spec), state.view)
  const entriesBeforeNotes = structuredClone(state.view.entries)
  const notes = updateVerticalMathWorkingNote({}, 'carry.ones', '9', { validKeys: ['carry.ones'] })
  const submitted = submitMathSession(state, {
    activityId: state.activityId,
    expectedRevision: state.revision,
    requestId: 'submit-note-separation',
  })

  assert.deepEqual(notes, { 'carry.ones': '9' })
  assert.deepEqual(state.view.entries, entriesBeforeNotes)
  assert.deepEqual(evaluateMathTestAnswer(buildMathActivityProblem(state.spec), state.view), evaluationBeforeNotes)
  assert.equal(Object.hasOwn(submitted.submission, 'notes'), false)
  assert.equal(Object.hasOwn(submitted.submission.entries, 'carry.ones'), false)
  assert.match(slateExperienceSource, /const learnerResponse = answer\.trim\(\)/)
  assert.match(slateExperienceSource, /\{phase === 'active' && !introTeaching && !pendingAdvance && \(\s*<form data-slate-primary-answer-form/)
  assert.match(slateExperienceSource, /kind: 'optional_work'/)
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

test('independent test submits a single text response without math-routing hints or early grade', () => {
  const start = slateExperienceSource.indexOf('const submitAssessmentAnswer = useCallback')
  const end = slateExperienceSource.indexOf('\n  }, [appendTranscript', start)
  const submit = slateExperienceSource.slice(start, end)
  assert.match(submit, /const judgment = await judgeAssessmentItem\(item, pending\.answer\)/)
  assert.match(submit, /status: 'judge'/)
  assert.match(submit, /mathWorking: pending\.working/)
  assert.doesNotMatch(submit, /routeMathTextInput|mathTestSubmissionReady|evaluateMathTestAnswer|submitMathSession|privateEvaluation/)
  assert.doesNotMatch(submit, /correct answer is|incorrect|right answer/i)
  assert.match(slateExperienceSource, /showCheck=\{false\}/)
  assert.match(slateExperienceSource, /phase="test"/)
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
