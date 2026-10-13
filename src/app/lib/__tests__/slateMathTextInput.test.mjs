import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildMathActivityProblem, createMathSession } from '../../../lib/math/mathSession.mjs'
import { applyVerticalMathCommand } from '../../../lib/math/verticalMath.mjs'
import { routeMathTextInput } from '../../../lib/math/mathTextInput.mjs'
import {
  buildMathConversationContext,
  shouldSendSlateMathConversation,
  slateMathHelpPendingMatches,
  slateMathPendingMatchesText,
} from '../slateMath.mjs'

const source = readFileSync(new URL('../../session/slate/SlateLiftoffExperience.jsx', import.meta.url), 'utf8')

test('conversation routing is teaching-only and questions remain help on a complete grid', () => {
  const route = { kind: 'conversation', text: 'Why do I regroup?' }
  assert.equal(shouldSendSlateMathConversation({ route, gridComplete: false, phase: 'teaching' }), true)
  assert.equal(shouldSendSlateMathConversation({ route, gridComplete: true, phase: 'teaching' }), true)
  assert.equal(shouldSendSlateMathConversation({ route, gridComplete: false, phase: 'test' }), false)
  assert.equal(shouldSendSlateMathConversation({ route: { kind: 'conversation', text: 'My explanation' }, gridComplete: true }), false)
  assert.equal(shouldSendSlateMathConversation({ route: { kind: 'conversation', text: "I don\u2019t know" }, gridComplete: true, phase: 'teaching' }), true)
})

test('pending submission and help retries require identical composer text and ownership', () => {
  const submissionPending = { turnNumber: 3, learnerResponse: '73', submission: { activityId: 'a', submittedRevision: 4 } }
  assert.equal(slateMathPendingMatchesText({ pending: submissionPending, activityId: 'a', revision: 5, turnNumber: 3, text: '73' }), true)
  assert.equal(slateMathPendingMatchesText({ pending: submissionPending, activityId: 'a', revision: 5, turnNumber: 3, text: 'because' }), false)
  const helpPending = { kind: 'composer_help', activityId: 'a', helpedRevision: 5, turnNumber: 3, text: 'help?' }
  assert.equal(slateMathHelpPendingMatches({ pending: helpPending, activityId: 'a', revision: 5, turnNumber: 3, text: 'help?' }), true)
  assert.equal(slateMathHelpPendingMatches({ pending: helpPending, activityId: 'b', revision: 5, turnNumber: 3, text: 'help?' }), false)
})

test('conversation context exposes displayed decimals but conceals noneditable saved values', () => {
  const spec = { operation: 'addition', operands: ['1.2', '3.45'], commands: [] }
  const made = createMathSession(spec, { activityId: 'context' })
  assert.equal(made.ok, true)
  const problem = buildMathActivityProblem(spec)
  let view = made.state.view
  const concealed = applyVerticalMathCommand(problem, view, { action: 'hide', locations: ['operand.1.ones'], editable: false })
  assert.equal(concealed.ok, true)
  view = { ...concealed.view, entries: { ...concealed.view.entries, 'operand.1.ones': '9' } }
  const context = buildMathConversationContext({ prompt: 'Add the numbers.', problem, view })
  assert.match(context, /3\s*\.\s*4\s*5/)
  assert.doesNotMatch(context, /9/)
  assert.ok(context.length <= 2400)
})

test('active math uses one learner answer while preserving line-help and legacy retries', () => {
  assert.match(source, /const submitLiftoffAnswer = useCallback/)
  assert.match(source, /kind: 'text_answer'/)
  assert.match(source, /learnerResponse = answer\.trim\(\)/)
  assert.match(source, /mode: 'line_help'/)
  assert.match(source, /kind: 'composer_help'/)
  assert.match(source, /isMathConversationQuestion\(learnerResponse\)/)
  assert.match(source, /mathSession: savedWork, mathWorkingNotes:/)
  assert.match(source, /pending\?\.submission && !slateMathReceiptMatches/)
  assert.match(source, /placeholder="Show your thinking or answer Mr\. Slate\."/)
  assert.match(source, /<textarea\s+ref=\{answerInputRef\}\s+value=\{answer\}/)
  assert.match(source, /<form data-slate-primary-answer-form onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitLiftoffAnswer\(\) \}\}/)
  assert.equal((source.match(/data-slate-primary-answer-form onSubmit/g) || []).length, 1)
  const problem = buildMathActivityProblem({ operation: 'addition', operands: ['47', '26'], commands: [] })
  const state = createMathSession({ operation: 'addition', operands: ['47', '26'], commands: [] }, { activityId: 'route' }).state
  assert.equal(routeMathTextInput(problem, state.view, '73').kind, 'entry')
})

test('independent test always grades the written answer and never requires grid completion', () => {
  assert.match(source, /let rawAnswer = choiceValue == null \? assessmentAnswer\.trim\(\)/)
  const start = source.indexOf('const submitAssessmentAnswer = useCallback')
  const end = source.indexOf('\n  }, [appendTranscript', start)
  const submit = source.slice(start, end)
  assert.match(submit, /const correct = await judgeAssessmentItem\(item, pending\.answer\)/)
  assert.doesNotMatch(submit, /routeMathTextInput|mathTestSubmissionReady|evaluateMathTestAnswer|submitMathSession/)
  assert.match(source, /phase="test"/)
  assert.match(source, /showCheck=\{false\}/)
  assert.match(source, /USE THIS RESULT IN ANSWER/)
  assert.match(source, /insertSlateMathResult\(assessmentAnswer, assessmentWorkspaceValue\)/)
})

test('active UI binds teaching phase and preserves completed entry text for retries', () => {
  assert.match(source, /shouldSendSlateMathConversation\(\{\s*route,\s*gridComplete:\s*initiallyComplete,\s*phase:\s*activeMath\.phase\s*\}\)/)
  assert.doesNotMatch(source, /setMathSession\(activeMath\)\s*setMathError\(''\)\s*setAnswer\(''\)\s*scheduleMathSnapshot\(\)/)
  assert.match(source, /if \(!gridComplete\) \{\s*if \(route\.kind === 'entry'\) setAnswer\(''\)/)

  const pending = { turnNumber: 3, learnerResponse: '73', submission: { activityId: 'a', submittedRevision: 4 } }
  assert.equal(slateMathPendingMatchesText({ pending, activityId: 'a', revision: 5, turnNumber: 3, text: '73' }), true)
  assert.equal(slateMathPendingMatchesText({ pending, activityId: 'a', revision: 5, turnNumber: 3, text: '74' }), false)
})
