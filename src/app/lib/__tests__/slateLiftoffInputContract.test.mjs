import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const slate = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const verticalMathWorkspace = fs.readFileSync(path.resolve('src/components/math/VerticalMathWorkspace.jsx'), 'utf8')
const webbDictation = fs.readFileSync(path.resolve('src/app/session/webb/WebbDictationButton.jsx'), 'utf8')
const slateLiftoffForm = slate.slice(slate.indexOf("{phase === 'active' && !introTeaching && !pendingAdvance && ("), slate.indexOf("{lineHelpTarget && phase !== 'test' && ("))

test('Liftoff keeps its textarea and shrinks it to two rows', () => {
  assert.match(slateLiftoffForm, /<textarea/)
  assert.match(slateLiftoffForm, /rows=\{2\}/)
  assert.equal((slateLiftoffForm.match(/<textarea/g) || []).length, 1)
  assert.match(slateLiftoffForm, /value=\{answer\}/)
  assert.match(slateLiftoffForm, /onChange=\{\(event\) => \{ reminderActivityRef\.current = Date\.now\(\); setAnswer\(event\.target\.value\) \}\}/)
  assert.match(slateLiftoffForm, /disabled=\{busy \|\| lessonInteractionHeld\}/)
  assert.match(slateLiftoffForm, /!answer\.trim\(\) && !mathPending\?\.submission/)
  assert.equal((slateLiftoffForm.match(/data-slate-primary-answer-form/g) || []).length, 1)
})

test('the original active answer form stays sticky, full-width, and responsive', () => {
  assert.match(slateLiftoffForm, /data-slate-primary-answer-form/)
  assert.match(slateLiftoffForm, /position: 'sticky', bottom: 0/)
  assert.match(slateLiftoffForm, /flexWrap: 'wrap'/)
  assert.match(slateLiftoffForm, /flex: '1 1 280px', minWidth: 0, width: '100%'/)
})

test('Enter sends the Liftoff answer and Shift+Enter keeps a newline', () => {
  assert.match(slateLiftoffForm, /onKeyDown=\{\(event\) => \{/)
  assert.match(slateLiftoffForm, /event\.key === 'Enter' && !event\.shiftKey && !event\.nativeEvent\?\.isComposing/)
  assert.match(slateLiftoffForm, /event\.preventDefault\(\)\s+void submitLiftoffAnswer\(\)/)
  assert.match(slateLiftoffForm, /<form data-slate-primary-answer-form onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitLiftoffAnswer\(\) \}\}/)
})

test('Slate reuses Mrs. Webb microphone and inserts recognized words into the draft without sending', () => {
  assert.match(slate, /import WebbDictationButton from '\.\.\/webb\/WebbDictationButton'/)
  assert.match(slateLiftoffForm, /<WebbDictationButton/)
  assert.match(slateLiftoffForm, /disabled=\{busy \|\| lessonInteractionHeld\}/)
  assert.match(slateLiftoffForm, /onBeforeRecord=\{\(\) => \{ reminderActivityRef\.current = Date\.now\(\); answerInputRef\.current\?\.blur\(\) \}\}/)
  assert.match(slateLiftoffForm, /onTranscript=\{\(text\) => setAnswer\(\(current\) => \[current\.trim\(\), text\]\.filter\(Boolean\)\.join\(' '\)\)\}/)
  assert.doesNotMatch(slateLiftoffForm.slice(slateLiftoffForm.indexOf('onTranscript='), slateLiftoffForm.indexOf('/>', slateLiftoffForm.indexOf('onTranscript='))), /submitLiftoffAnswer/)
  assert.match(webbDictation, /getReusableMicrophoneStream/)
  assert.match(webbDictation, /fetch\('\/api\/stt'/)
})

test('independent test written answers use the Liftoff bottom composer, outside the transcript', () => {
  const tail = slate.slice(
    slate.indexOf('const assessmentTranscriptContent = isAssessment && currentAssessment ? ('),
    slate.indexOf('  return (\n    <div className={styles.sessionShell}'),
  )
  const composer = slate.slice(
    slate.indexOf('data-slate-test-answer-form') - 20,
    slate.indexOf("{phase === 'active' && introTeaching && ("),
  )
  assert.doesNotMatch(tail, /<form\b|<textarea\b|<input\b/)
  assert.match(tail, /<VerticalMathWorkspace/)
  assert.match(tail, /submitAssessmentAnswer\('true'\)/)
  assert.match(tail, /submitAssessmentAnswer\(letter\)/)
  assert.match(composer, /data-slate-test-answer-form/)
  assert.match(composer, /<textarea[\s\S]*?data-slate-test-answer-input/)
  assert.match(composer, /rows=\{2\}/)
  assert.match(composer, /data-sonoma-input[\s\S]*?inputMode="none"/)
  assert.match(composer, /position: 'sticky', bottom: 0[\s\S]*?flexWrap: 'wrap'/)
  assert.match(composer, /flex: '1 1 280px', minWidth: 0, width: '100%'/)
  assert.match(composer, /onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitAssessmentAnswer\(\) \}\}/)
  assert.match(composer, /value=\{assessmentAnswer\}/)
  assert.match(composer, /assessmentMathTextRef\.current = event\.target\.value/)
  assert.match(composer, /assessmentWrittenAnswerMode === 'math'\) setAssessmentMathError\(''\)/)
  assert.match(composer, /!assessmentMathPending\?\.status/)
  assert.doesNotMatch(composer, /WebbDictationButton/)
  assert.ok(slate.indexOf('data-slate-test-answer-form') > slate.indexOf('tailContent={isAssessment ? assessmentTranscriptContent : activeMathTranscriptContent}'))
  assert.ok(slate.indexOf('data-slate-test-answer-form') < slate.indexOf('data-slate-primary-answer-form'))
})

test('test answer bar is offered only for written-answer modes and preserves test submission', () => {
  assert.match(slate, /const assessmentWrittenAnswerMode = !isAssessment \|\| !currentAssessment \? null/)
  assert.match(slate, /assessmentMathResolution\.kind === 'invalid' && questionType\(currentAssessment\) === 'shortanswer' \? 'invalid-math'/)
  assert.match(slate, /questionType\(currentAssessment\) === 'multiplechoice' \? null : 'math'/)
  assert.match(slate, /\['multiplechoice', 'truefalse'\]\.includes\(questionType\(currentAssessment\)\) \? null : 'text'/)
  assert.match(slate, /\{assessmentWrittenAnswerMode && \(\s*<form/)
  assert.match(slate, /aria-label="Test answer"/)
  assert.match(slate, /event\.key === 'Enter' && !event\.shiftKey/)
  assert.match(slate, /disabled=\{busy \|\| lessonInteractionHeld \|\| snapshotServiceRef\.current\?\.writesFenced \|\| \(!assessmentAnswer\.trim\(\)/)
  assert.match(slate, /const submitAssessmentAnswer = useCallback\(async \(choiceValue = null\)/)
})

test('Slate disables redundant workspace full-answer inputs while standalone keeps them by default', () => {
  assert.match(verticalMathWorkspace, /showCheck = true, showFullAnswerInputs = true/)
  assert.match(verticalMathWorkspace, /showFullAnswerInputs && divisionAnswersEditable/)
  assert.match(verticalMathWorkspace, /showFullAnswerInputs && !isDivision && entireResultEditable/)
  assert.equal((slate.match(/showFullAnswerInputs=\{false\}/g) || []).length, 2)
  assert.match(verticalMathWorkspace, />Quotient and remainder<\/label>/)
  assert.match(verticalMathWorkspace, />Or type the entire answer<\/label>/)
})

test('Slate math scratch does not instruct a separate grid submission', () => {
  assert.equal((slate.match(/showCheck=\{false\}/g) || []).length, 2)
  assert.doesNotMatch(verticalMathWorkspace, /Complete the requested spaces, then submit to your teacher\./)
  assert.match(verticalMathWorkspace, /<\/\> : null\}/)
  assert.match(verticalMathWorkspace, /Answer feedback is unavailable during a test\./)
  assert.match(verticalMathWorkspace, /Complete the requested spaces, then check your entries\./)
})


test('Slate scratch workspace owns its transfer button and has no decorative divider', () => {
  const workspaceCss = fs.readFileSync(path.resolve('src/components/math/VerticalMathWorkspace.module.css'), 'utf8')
  assert.equal((slate.match(/embeddedScratch/g) || []).length, 2)
  assert.equal((slate.match(/USE THIS RESULT IN ANSWER/g) || []).length, 2)
  assert.match(slate, /footer=\{questionType\(currentAssessment\) === 'multiplechoice' \? null : \(/)
  assert.match(slate, /data-slate-active-math-transcript-tail style=\{\{ marginTop: 12, paddingTop: 8 \}\}/)
  assert.doesNotMatch(slate, /data-slate-active-math-transcript-tail style=\{\{ borderTop:/)
  assert.match(verticalMathWorkspace, /embeddedScratch \? styles\.scratchGrid : ''/)
  assert.match(verticalMathWorkspace, /embeddedScratch \? styles\.scratchBottomArea : ''/)
  assert.match(verticalMathWorkspace, /footer && <div className=\{styles\.workspaceFooter\}>\{footer\}<\/div>/)
  assert.match(workspaceCss, /\.scratchGrid \{\s*margin-left: 0;\s*margin-right: auto;\s*\}/)
  assert.match(workspaceCss, /\.scratchBottomArea \{\s*border-top: 0;\s*padding-top: 0;\s*\}/)
  assert.match(workspaceCss, /\.workspaceFooter > button \{[\s\S]*?border-radius: 8px;[\s\S]*?background: var\(--addition-accent\);[\s\S]*?font: 800 13px/)
  assert.match(workspaceCss, /\.workspaceFooter > button:disabled \{\s*opacity: 0\.5;/)
  assert.match(workspaceCss, /\.mathRule \{\s*border-top: 2px solid/)
  assert.match(workspaceCss, /\.scratchGrid \.operator \{\s*width: 58px;\s*min-width: 58px;/)
  assert.match(workspaceCss, /\.scratchGrid \.mathRule \{\s*margin-left: 58px;/)
  assert.match(workspaceCss, /\.scratchGrid\.multiplicationGrid \.mathRule \{\s*margin-left: 134px;/)
})

test('question workspace stays in transcript while independent work belongs only to the Math tab', () => {
  const supplied = fs.readFileSync(path.resolve('src/app/lib/slateMathScratch.mjs'), 'utf8')
  const manual = fs.readFileSync(path.resolve('src/app/session/slate/SlateManualScratch.jsx'), 'utf8')
  assert.match(supplied, /activityId: originalId, visible: true, operation: math\.operation/)
  assert.match(slate, /data-slate-math-keyboard-tab/)
  assert.match(slate, /onClick=\{\(\) => sonomaKeyboard\.showMathTab\(/)
  assert.match(slate, /data-sonoma-keyboard-toggle/)
  assert.doesNotMatch(slate, /data-slate-manual-math-toggle|data-slate-test-manual-math-toggle|toggleManualScratch/)
  assert.match(slate, /\(phase === 'active' \|\| phase === 'test'\) && sonomaKeyboard\.active\?\.layout === 'math' && sonomaKeyboard\.workspacePortal && createPortal\(/)
  assert.match(slate, /manualScratchUi: manualScratchUiRef\.current/)
  assert.match(manual, /aria-label="First scratch number"/)
  assert.match(manual, /aria-label="Second scratch number"/)
  assert.match(manual, /onOperationChange=\{setOperation\}/)
  assert.match(manual, /operationChoices=\{options\} onOperationChange=\{setOperation\}/)
  assert.doesNotMatch(slate, /onOperationChange=|operationChoices=/)
  assert.match(slate, /\{activeMathMatches && \(activeScratchProblem && activeScratchSession/)
  assert.match(slate, /\{assessmentMathMatches && \(assessmentScratchProblem && assessmentScratchSession/)
})
