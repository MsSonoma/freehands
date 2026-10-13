import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const slate = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const verticalMathWorkspace = fs.readFileSync(path.resolve('src/components/math/VerticalMathWorkspace.jsx'), 'utf8')
const webbDictation = fs.readFileSync(path.resolve('src/app/session/webb/WebbDictationButton.jsx'), 'utf8')
const slateLiftoffForm = slate.slice(slate.indexOf("{phase === 'active' && ("), slate.indexOf("{isAssessment && currentAssessment && ("))

test('Liftoff keeps its textarea and shrinks it to two rows', () => {
  assert.match(slateLiftoffForm, /<textarea/)
  assert.match(slateLiftoffForm, /rows=\{2\}/)
  assert.equal((slateLiftoffForm.match(/<textarea/g) || []).length, 1)
  assert.match(slateLiftoffForm, /value=\{answer\}/)
  assert.match(slateLiftoffForm, /onChange=\{\(event\) => setAnswer\(event\.target\.value\)\}/)
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
  assert.match(slateLiftoffForm, /onBeforeRecord=\{\(\) => answerInputRef\.current\?\.blur\(\)\}/)
  assert.match(slateLiftoffForm, /onTranscript=\{\(text\) => setAnswer\(\(current\) => \[current\.trim\(\), text\]\.filter\(Boolean\)\.join\(' '\)\)\}/)
  assert.doesNotMatch(slateLiftoffForm.slice(slateLiftoffForm.indexOf('onTranscript='), slateLiftoffForm.indexOf('/>', slateLiftoffForm.indexOf('onTranscript='))), /submitLiftoffAnswer/)
  assert.match(webbDictation, /getReusableMicrophoneStream/)
  assert.match(webbDictation, /fetch\('\/api\/stt'/)
})

test('Slate does not alter the independent test answer input', () => {
  const testForm = slate.slice(slate.indexOf("questionType(currentAssessment) === 'multiplechoice'"), slate.indexOf("lineHelpTarget && phase !== 'test'"))
  assert.match(testForm, /<input value=\{assessmentAnswer\}/)
  assert.match(testForm, /onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitAssessmentAnswer\(\) \}\}/)
  assert.doesNotMatch(testForm, /WebbDictationButton/)
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
