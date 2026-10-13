import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { separateLiftoffTranscriptQuestion } from '../slateLiftoffTranscript.mjs'

const slate = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const captions = fs.readFileSync(path.resolve('src/app/session/components/CaptionPanel.js'), 'utf8')
const api = fs.readFileSync(path.resolve('src/app/api/slate-liftoff/route.js'), 'utf8')

test('Slate Liftoff renders the full saved transcript with the shared scrollable caption panel', () => {
  assert.match(slate, /const \[transcriptLines, setTranscriptLines\] = useState\(\[\]\)/)
  assert.match(slate, /setTranscriptLines\(next\)/)
  assert.match(slate, /setTranscriptLines\(transcriptRef\.current\)/)
  assert.match(slate, /<CaptionPanel/)
  assert.match(slate, /sentences=\{transcriptLines\}/)
  assert.match(slate, /captionStartIndex=\{transcriptStartIndex\}/)
  assert.match(slate, /phase === 'test'/)
  assert.match(slate, /kind: 'test_start'/)
  assert.match(slate, /boxRef=\{transcriptBoxRef\}/)
})

test('active teaching math is routed through CaptionPanel in-scroller tail content', () => {
  assert.match(captions, /tailContent = null/)
  assert.match(captions, /const hasTailContent = Boolean\(tailContent\)/)
  const panelIndex = captions.indexOf('data-ms-caption-panel className=')
  const tailContentIndex = captions.indexOf('{tailContent}', panelIndex)
  const tailSpacerIndex = captions.indexOf('data-ms-caption-tail-spacer', panelIndex)
  assert.ok(panelIndex >= 0)
  assert.ok(tailContentIndex > panelIndex)
  assert.ok(tailSpacerIndex > tailContentIndex)
  assert.match(captions, /displayItems\.length, hasTailContent, boxRef, recomputeScrollState/)
  assert.match(slate, /const activeMathTranscriptContent = phase === 'active' && activeMathSpec \? \([\s\S]*<VerticalMathWorkspace[\s\S]*phase="teaching"[\s\S]*This math activity needs attention before it can be submitted\.[\s\S]*\{mathError &&/)
  assert.match(slate, /data-slate-active-math-transcript-tail[\s\S]*<VerticalMathWorkspace[\s\S]*showFullAnswerInputs=\{false\}/)
  assert.match(slate, /tailContent=\{activeMathTranscriptContent\}/)
  assert.match(slate, /stackedHeight=\{activeMathSpec \? 'clamp\(260px, 42vh, 460px\)' : null\}/)
  assert.doesNotMatch(slate, /\{phase === 'active' && activeMathSpec && \(\s*<div/)
})

test('current Liftoff diagnostic questions are transcript lines with hand and replay before answering', () => {
  assert.match(slate, /const initialQuestion = String\(initialState\.currentAction\?\.problem\?\.prompt/)
  assert.match(slate, /const initialLines = separateLiftoffTranscriptQuestion\(init\.learnerMessage, initialQuestion\)/)
  assert.match(slate, /if \(initialLines\.question\) appendTranscript\('assistant', initialLines\.question, \{ kind: 'liftoff_question' \}\)/)
  assert.match(slate, /const nextQuestion = readyForTest \? '' : String\(nextState\.currentAction\?\.problem\?\.prompt/)
  assert.match(slate, /const nextLines = separateLiftoffTranscriptQuestion\(turn\.learnerMessage, nextQuestion\)/)
  assert.match(slate, /if \(nextLines\.question\) appendTranscript\('assistant', nextLines\.question, \{ kind: 'liftoff_question' \}\)/)
  assert.match(slate, /activeQuestion && !questionAlreadyPresent/)
  assert.match(captions, /const canStudy = !!studyEnabled/)
})


test('Liftoff separates an API-appended question once without losing spoken teaching', () => {
  assert.deepEqual(separateLiftoffTranscriptQuestion('First, multiply the two numbers.\n\nHow much is six times seven?', 'How much is six times seven?'), {
    response: 'First, multiply the two numbers.',
    question: 'How much is six times seven?',
  })
  assert.deepEqual(separateLiftoffTranscriptQuestion('Use the facts you know.', 'What is 4 + 4?'), {
    response: 'Use the facts you know.',
    question: 'What is 4 + 4?',
  })
  assert.deepEqual(separateLiftoffTranscriptQuestion('You mastered the skill.', ''), {
    response: 'You mastered the skill.',
    question: '',
  })
  assert.deepEqual(separateLiftoffTranscriptQuestion('What is 4 + 4? Explain in your own way.', 'What is 4 + 4?'), {
    response: 'What is 4 + 4? Explain in your own way.',
    question: '',
  })
})

test('independent test allows question replay but does not expose study help', () => {
  assert.match(slate, /phase !== 'test'/)
  assert.match(slate, /studyEnabled=\{!busy && !lineHelpBusy && phase !== 'test'\}/)
  assert.match(slate, /lineHelpTarget && phase !== 'test'/)
  assert.match(slate, /replayTranscriptLine\(\{ text: questionText\(currentAssessment\) \}\)/)
})

test('Slate transcript sentences replay through Slate TTS without adding a Liftoff turn', () => {
  assert.match(slate, /const replayTranscriptLine = useCallback/)
  assert.match(slate, /void speak\(text\)/)
  assert.match(slate, /onReplayRequest=\{replayTranscriptLine\}/)
  assert.match(captions, /onClick=\{canReplay && replayEnabled \? \(\) => onReplayRequest\(s, originalIndex\)/)
})

test('Slate transcript hand opens line-specific rephrase and ask controls', () => {
  assert.match(slate, /onStudyRequest=\{openLineHelp\}/)
  assert.match(slate, /teacherName="Mr\. Slate"/)
  assert.match(slate, /EXPLAIN IT ANOTHER WAY/)
  assert.match(slate, /Ask Mr\. Slate about this line/)
  assert.match(slate, /requestLineHelp\('rephrase'\)/)
  assert.match(slate, /requestLineHelp\('ask'\)/)
})

test('shared caption hand and replay labels are teacher aware', () => {
  assert.match(captions, /teacherName = 'Ms\. Sonoma'/)
  assert.match(captions, /Study this with \$\{teacherName\}/)
  assert.match(captions, /\$\{teacherName\} is speaking/)
})

test('Slate line help is a stateless non-progressing API mode with answer-protection rules', () => {
  assert.match(api, /requestedMode === 'line_help'/)
  assert.match(api, /function lineHelpPrompt/)
  assert.match(api, /This is transcript help only, not a Liftoff instructional turn/)
  assert.match(api, /Do not diagnose mastery, update evidence, choose a next Liftoff move, advance the lesson/)
  assert.match(api, /do not solve it, reveal its answer, or give a targeted hint/)
  assert.match(api, /return NextResponse\.json\(\{ ok: true, mode, reply:/)
})

test('opening Slate line help holds normal answer controls rather than advancing the lesson', () => {
  assert.match(slate, /const lessonInteractionHeld = Boolean\(lineHelpTarget\) \|\| lineHelpBusy/)
  assert.match(slate, /disabled=\{busy \|\| lessonInteractionHeld\}/)
  assert.match(slate, /disabled=\{busy \|\| lessonInteractionHeld \|\| !answer\.trim\(\)\}/)
})

test('Slate keeps its own visual system and does not inherit Sonoma transcript styling', () => {
  assert.match(slate, /teacherName="Mr\. Slate"/)
  assert.match(slate, /background: C\.surface2/)
  assert.match(slate, /fontFamily: C\.font/)
  assert.match(slate, /handBorder: C\.accent/)
  assert.match(slate, /handBackground: C\.surface/)
  assert.match(slate, /color: C\.accent/)
  assert.match(captions, /theme = null/)
  assert.match(captions, /\.\.\.\(theme \|\| \{\}\)/)
})

test('Slate transcript history does not displace the primary learner answer field', () => {
  assert.doesNotMatch(slate, /stackedHeight="300px"/)
  assert.match(slate, /placeholder="Show your thinking or answer Mr\. Slate\."/)
  const answerIndex = slate.indexOf('placeholder="Show your thinking or answer Mr. Slate."')
  const helpIndex = slate.indexOf("{lineHelpTarget && phase !== 'test'")
  assert.ok(answerIndex >= 0)
  assert.ok(helpIndex > answerIndex)
  assert.match(slate, /data-slate-primary-answer-form[\s\S]*position: 'sticky', bottom: 0[\s\S]*flexWrap: 'wrap'/)
})
