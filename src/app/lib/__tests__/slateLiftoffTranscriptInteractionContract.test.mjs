import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { separateLiftoffTranscriptQuestion, prepareSlateLiftoffAdvance, restoreSlateLiftoffAdvance } from '../slateLiftoffTranscript.mjs'
import { buildLiftoffSnapshotFeatureState } from '../slateLiftoff.mjs'

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
  const panelIndex = captions.indexOf('data-ms-caption-panel data-sonoma-transcript className=')
  const tailContentIndex = captions.indexOf('{tailContent}', panelIndex)
  const tailSpacerIndex = captions.indexOf('data-ms-caption-tail-spacer', panelIndex)
  assert.ok(panelIndex >= 0)
  assert.ok(tailContentIndex > panelIndex)
  assert.ok(tailSpacerIndex > tailContentIndex)
  assert.match(captions, /displayItems, keyboardActive, keyboardHeight, hasTailContent, boxRef, followTranscriptEnd, recomputeScrollState/)
  assert.match(slate, /const activeMathTranscriptContent = phase === 'active' \? \([\s\S]*<VerticalMathWorkspace[\s\S]*phase="teaching"[\s\S]*The scratch workspace is unavailable\.[\s\S]*\{mathError &&/)
  assert.match(slate, /data-slate-active-math-transcript-tail[\s\S]*<VerticalMathWorkspace[\s\S]*showFullAnswerInputs=\{false\}/)
  assert.match(slate, /tailContent=\{isAssessment \? assessmentTranscriptContent : activeMathTranscriptContent\}/)
  assert.match(slate, /stackedHeight=\{isAssessment \? 'min\(72dvh, 720px\)' : \(structuredMathPresented && activeScratchDraft\?\.visible \? 'clamp\(260px, 42vh, 460px\)' : null\)\}/)
  assert.doesNotMatch(slate, /\{phase === 'active' && activeMathSpec && \(\s*<div/)
})

test('current Liftoff diagnostic questions are transcript lines with hand and replay before answering', () => {
  assert.match(slate, /const initialQuestion = String\(initialState\.currentAction\?\.problem\?\.prompt/)
  assert.match(slate, /const initialLines = separateLiftoffTranscriptQuestion\(init\.learnerMessage, initialQuestion\)/)
  assert.match(slate, /const opening = createSlateIntroTeaching\(initialLines\.response, initialLines\.question\)/)
  assert.match(slate, /introSpeechRef\.current = opening\.sentences\[0\]/)
  assert.match(slate, /appendTranscript\('assistant', opening\.sentences\[0\], \{ kind: 'liftoff_teaching_sentence' \}\)/)
  assert.match(slate, /if \(introTeaching\.index < introTeaching\.sentences\.length - 1|introTeaching\.index < introTeaching\.sentences\.length - 1/)
  assert.match(slate, /if \(next\.question\) \{\s*appendTranscript\('assistant', next\.question, \{ kind: 'liftoff_question' \}\)/)
  assert.match(slate, /const nextQuestion = readyForTest \? '' : String\(nextState\.currentAction\?\.problem\?\.prompt/)
  assert.match(slate, /const \{ feedback, pendingAdvance: advance \} = prepareSlateLiftoffAdvance\(/)
  assert.match(slate, /if \(feedback\) void speak\(feedback\)/)
  assert.match(slate, /appendTranscript\('assistant', advance\.question, \{ kind: 'liftoff_question', turnNumber: advance\.turnNumber \}\)/)
  assert.doesNotMatch(slate, /void speak\(turn\.learnerMessage\)/)
  assert.match(slate, /activeQuestion && !restoredIntro && !restoredAdvance && !questionAlreadyPresent/)
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

test('a completed response retains its feedback but holds the next question for a click', () => {
  const message = 'You correctly used inverse addition. Now try a new problem. What is 74 minus 28?'
  const prepared = prepareSlateLiftoffAdvance(message, 'What is 74 minus 28?', { turnNumber: 5 })
  assert.deepEqual(prepared, {
    feedback: 'You correctly used inverse addition. Now try a new problem.',
    pendingAdvance: { kind: 'question', turnNumber: 5, question: 'What is 74 minus 28?' },
  })
  const feature = buildLiftoffSnapshotFeatureState({
    occurrenceId: 'occ-1', executionSessionId: 'exec-1',
    liftoff: { turnNumber: 5, procedureReleased: false,
      currentAction: { problem: { prompt: 'What is 74 minus 28?' } } },
    pendingAdvance: prepared.pendingAdvance,
  })
  assert.deepEqual(feature.pendingAdvance, prepared.pendingAdvance)
  const reloaded = JSON.parse(JSON.stringify(feature))
  assert.deepEqual(restoreSlateLiftoffAdvance(reloaded.pendingAdvance, reloaded.liftoff), prepared.pendingAdvance)
})

test('next question is held even if the model placed it before additional feedback', () => {
  const prepared = prepareSlateLiftoffAdvance(
    'Nicely reasoned. What is 6 times 7? Take your time and work carefully.',
    'What is 6 times 7?', { turnNumber: 8 },
  )
  assert.equal(prepared.feedback, 'Nicely reasoned. Take your time and work carefully.')
  assert.equal(prepared.pendingAdvance.question, 'What is 6 times 7?')
  const withoutEmbedded = prepareSlateLiftoffAdvance(
    'That reasoning was correct.', 'What is 6 times 7?', { turnNumber: 9 },
  )
  assert.equal(withoutEmbedded.feedback, 'That reasoning was correct.')
  assert.equal(withoutEmbedded.pendingAdvance.kind, 'question')
})

test('completion waits for START TEST, and stale saved Next gates are ignored', () => {
  const prepared = prepareSlateLiftoffAdvance('All essential skills are demonstrated.', '', {
    turnNumber: 12, readyForTest: true,
  })
  assert.deepEqual(prepared.pendingAdvance, { kind: 'test', turnNumber: 12 })
  assert.deepEqual(restoreSlateLiftoffAdvance(prepared.pendingAdvance, {
    turnNumber: 12, procedureReleased: true,
  }), prepared.pendingAdvance)
  assert.equal(restoreSlateLiftoffAdvance(prepared.pendingAdvance, {
    turnNumber: 13, procedureReleased: true,
  }), null)
  assert.equal(restoreSlateLiftoffAdvance(prepared.pendingAdvance, {
    turnNumber: 12, procedureReleased: false,
  }), null)
  assert.equal(restoreSlateLiftoffAdvance({ kind: 'question', turnNumber: 12, question: 'Old question?' }, {
    turnNumber: 12, procedureReleased: false,
    currentAction: { problem: { prompt: 'A new question?' } },
  }), null)
})

test('independent test allows question replay but does not expose study help', () => {
  assert.match(slate, /phase !== 'test'/)
  assert.match(slate, /studyEnabled=\{!busy && !lineHelpBusy && phase !== 'test'\}/)
  assert.match(slate, /lineHelpTarget && phase !== 'test'/)
  assert.match(slate, /appendTranscript\('assistant', text, \{ kind: 'test_question', testIndex: index \}\)/)
  assert.match(slate, /appendTestQuestion\(alignedTestItems\[0\], 0\)/)
  assert.match(slate, /onReplayRequest=\{replayTranscriptLine\}/)
  assert.doesNotMatch(slate, /Hear this question again/)
})

test('independent test questions and response tools live in the shared transcript', () => {
  const begin = slate.indexOf('const assessmentTranscriptContent = isAssessment && currentAssessment ? (')
  const end = slate.indexOf('  return (\n    <div className={styles.sessionShell}', begin)
  assert.ok(begin >= 0 && end > begin)
  const tail = slate.slice(begin, end)
  assert.match(tail, /data-slate-test-transcript-tail/)
  assert.doesNotMatch(tail, /data-slate-test-math-toggle/)
  assert.match(tail, /<VerticalMathWorkspace[\s\S]*phase="test"/)
  assert.doesNotMatch(tail, /data-slate-test-manual-math-toggle/)
  assert.match(slate, /data-slate-test-manual-math-toggle/)
  assert.doesNotMatch(tail, /<SlateManualScratch/)
  assert.match(slate, /createPortal\(/)
  assert.match(tail, /submitAssessmentAnswer/)
  assert.match(slate, /tailContent=\{isAssessment \? assessmentTranscriptContent : activeMathTranscriptContent\}/)
  assert.doesNotMatch(slate, /\{isAssessment && currentAssessment && \(\s*<div/)
  assert.match(slate, /if \(resumedPhase === 'test' && !needsReplacement && !restoredAssessmentPending\?\.transcriptRecorded\)/)
  assert.match(slate, /appendTestQuestion\(currentAssessmentItems\[nextIndex\], nextIndex\)/)
  assert.match(slate, /if \(!pending\.transcriptRecorded\) \{\s*appendTestQuestion\(item, submittedIndex\)\s*appendTranscript\('user', pending\.answer\)/)
  assert.match(tail, /showCheck=\{false\}/)
  assert.match(slate, /followTranscriptEnd=\{!isAssessment\}/)
  assert.match(captions, /followTranscriptEnd = true/)
  assert.match(captions, /if \(!followTranscriptEnd \|\| !boxRef\?\.current\) return/)
  assert.match(captions, /const isLast = followTranscriptEnd && displayActiveIndex/)
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
  assert.match(slate, /disabled=\{busy \|\| lessonInteractionHeld \|\| snapshotServiceRef\.current\?\.writesFenced \|\| \(!answer\.trim\(\) && !mathPending\?\.submission\)\}/)
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

test('Slate holds each next question until the learner presses Next, not just until feedback TTS ends', () => {
  const submitStart = slate.indexOf('const submitLiftoffAnswer = useCallback')
  const submitEnd = slate.indexOf('const finishLesson = useCallback', submitStart)
  const submitted = slate.slice(submitStart, submitEnd)
  assert.match(submitted, /pendingAdvanceRef\.current = advance/)
  assert.match(submitted, /setPendingAdvance\(advance\)/)
  assert.match(submitted, /pendingAdvance: advance/)
  assert.match(submitted, /if \(feedback\) appendTranscript\('assistant', feedback\)/)
  assert.match(submitted, /if \(feedback\) void speak\(feedback\)/)
  assert.doesNotMatch(submitted, /appendTranscript\('assistant', advance\.question/)
  assert.doesNotMatch(submitted, /beginIndependentAssessment\(lesson, nextState\)/)
  const clickStart = slate.indexOf('const continueAfterFeedback = useCallback')
  const clickEnd = slate.indexOf('const submitLiftoffAnswer = useCallback', clickStart)
  const clicked = slate.slice(clickStart, clickEnd)
  assert.match(clicked, /await persistLiftoffSnapshot\(\{ phase: 'active', liftoff: current, pendingAdvance: null \}\)/)
  assert.match(clicked, /appendTranscript\('assistant', advance\.question/)
  assert.match(clicked, /void speak\(advance\.question\)/)
  assert.match(clicked, /await beginIndependentAssessment\(lesson, current\)/)
  assert.match(slate, /data-slate-followup-navigation/)
  assert.match(slate, /onClick=\{\(\) => void continueAfterFeedback\(\)\}/)
  assert.match(slate, /'START TEST' : 'NEXT'/)
  assert.match(slate, /phase === 'active' && !introTeaching && !pendingAdvance/)
  assert.match(slate, /introTeachingRef\.current \|\| pendingAdvanceRef\.current \|\| lineHelpTarget/)
  assert.match(slate, /restoreSlateLiftoffAdvance\(feature\.pendingAdvance, feature\.liftoff\)/)
  assert.match(slate, /pendingAdvance: pendingAdvanceValue/)
  assert.match(slate, /const result = await playSlateSpeechUntilEnd\(audio\)/)
})

test('introductory Slate teaching reveals one sentence at a time with learner-controlled advancement', () => {
  assert.match(slate, /createSlateIntroTeaching\(initialLines\.response, initialLines\.question\)/)
  assert.match(slate, /introTeachingRef\.current = opening/)
  assert.match(slate, /introTeaching: opening/)
  assert.match(slate, /introTeaching: introTeachingRef\.current/)
  assert.match(slate, /restoreSlateIntroTeaching\(feature\.introTeaching\)/)
  assert.match(slate, /activeQuestion && !restoredIntro && !restoredAdvance && !questionAlreadyPresent/)
  assert.match(slate, /appendTranscript\('assistant', next\.sentence, \{ kind: 'liftoff_teaching_sentence' \}\)/)
  assert.match(slate, /await speak\(next\.sentence\)/)
  assert.match(slate, /onClick=\{\(\) => void nextIntroSentence\(\)\}/)
  assert.match(slate, /NEXT SENTENCE/)
  assert.match(slate, /START QUESTION/)
  assert.match(slate, /\{phase === 'active' && !introTeaching && !pendingAdvance && \(/)
  assert.match(slate, /introTeachingRef\.current \? null : mathSessionRef\.current/)
  assert.match(slate, /onStudyRequest=\{openLineHelp\}/)
})
