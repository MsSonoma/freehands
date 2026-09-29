import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../page.jsx', import.meta.url), 'utf8')
const studio = fs.readFileSync(new URL('../WebbWritingStudio.jsx', import.meta.url), 'utf8')
const route = fs.readFileSync(new URL('../../../api/webb-objectives/route.js', import.meta.url), 'utf8')
  + fs.readFileSync(new URL('../../../lib/webbObjectiveEvaluation.mjs', import.meta.url), 'utf8')
const model = fs.readFileSync(new URL('../../../lib/webbLearningModel.mjs', import.meta.url), 'utf8')
const historyOverlay = fs.readFileSync(new URL('../../../components/syllabus/LessonHistoryOverlay.js', import.meta.url), 'utf8')

test('objective coverage cannot fabricate a writing note', () => {
  assert.match(route, /noteReadyIndices/)
  assert.match(route, /Array\.isArray\(understoodIndices\) \? understoodIndices/)
  assert.match(route, /!understood\.has\(i\)/)
  assert.doesNotMatch(route, /createVerbatimLearnerRecord/)
  assert.match(page, /mergeWebbObjectiveResult/)
  assert.match(page, /Let's save that to our notes\./)
  assert.match(page, /Goal achieved &middot; Note saved/)
})

test('composition needs source-verified notes while discussion uses demonstrated comprehension', () => {
  assert.match(page, /hasAllWritingReadyNotes\(objectives, learnerNotes\)/)
  assert.match(page, /understoodIndices: current\.understoodObj/)
  assert.match(page, /allObjectivesMet: progress\.allObjectivesMet/)
  assert.doesNotMatch(page, /learnerNotes\[i\]\?\.text \|\| '\.\.\.'/)
  assert.doesNotMatch(page, /Note unavailable/)
})

test('writing studio keeps objective context and learner-controlled commit gates', () => {
  assert.match(page, /<WebbWritingStudio/)
  assert.match(page, /objective=\{activeWritingPlan \? '' : objectives\[writingIndex\]\}/)
  assert.match(studio, />\s*What you showed\s*</)
  assert.match(studio, /\{currentObjective\}/)
  assert.match(studio, /Your research note/)
  assert.match(studio, />\s*Previous attempt\s*</)
  assert.match(studio, /'Try again'/)
  assert.match(studio, /finalView \? 'Your essay' : 'Your essay so far'/)
  assert.match(studio, /webb-writing-glow/)
  assert.match(studio, /'Next sentence'/)
  assert.match(studio, /'Finish essay'/)
  assert.match(page, /function handleNextWritingSentence\(\)/)
  assert.match(page, /onNextSentence=\{handleNextWritingSentence\}/)
  assert.doesNotMatch(page, /setTimeout\(\(\) => \{[\s\S]{0,500}WEBB_WRITING_SUBPHASES\.COMMITTED/)
  assert.doesNotMatch(studio, /learnerNotes/)
})

test('writing evaluation is aware of ordered essay position without taking learner authorship', () => {
  assert.match(route, /SLOT_FIT/)
  assert.match(route, /ADDS_NEW_INFORMATION/)
  assert.match(route, /PARAGRAPH_FIT/)
  assert.match(route, /prior_accepted_learner_sentences/)
  assert.match(page, /writingTotalObjectives: totalSentences/)
  assert.match(page, /writingPriorSentences: priorSentences/)
  assert.match(page, /positionFit: evaluation\.positionFit, slotFit: evaluation\.slotFit/)
  assert.match(model, /accepted: accuracy === 'correct' && sentenceOk === true && fitsSlot && addsForAcceptance && fitsParagraph/)
  assert.match(route, /Do not require a transition word/)
  assert.match(route, /authoritative content boundary/)
  assert.match(page, /slot\.sourceObjectiveIndices\?\.length && !slotSource\.notes\.length/)
})

test('writing resume restores the durable composition stage instead of re-entering research', () => {
  assert.match(model, /WEBB_SNAPSHOT_VERSION = 8/)
  assert.match(model, /restoreWebbCompositionState/)
  assert.match(page, /const composition = restoreWebbCompositionState/)
  assert.match(page, /composition\.webbStage === WEBB_SESSION_STAGES\.RESEARCH/)
  assert.match(page, /pendingWritingReviewRef\.current = composition\.pendingWritingReview/)
  assert.match(page, /submitWritingAttemptRef\.current/)
  assert.match(page, /reuseMessage: pending\.message/)
  assert.match(page, /writingSubphase: WEBB_WRITING_SUBPHASES\.COMMITTED/)
  assert.match(page, /webbStageRef\.current !== WEBB_SESSION_STAGES\.RESEARCH/)
  assert.match(page, /webbStage: requestedStage/)
})

test('keyboard-visible writing keeps objective, note, retry context, and sentence input in the compact stack', () => {
  assert.match(studio, /keyboardCompact/)
  assert.match(studio, /What you showed/)
  assert.match(studio, /Your research note/)
  assert.match(studio, /Previous attempt/)
  assert.match(studio, /rows=\{keyboardCompact \? 2 : 4\}/)
  assert.match(studio, /minHeight: keyboardCompact \? 52 : 132/)
  assert.match(studio, /fontSize: keyboardCompact \? 16/)
})

test('writing storage state is explicit and Mrs. Webb source stays free of mojibake', () => {
  assert.match(studio, /storageWarning = ''/)
  assert.match(page, /storageWarning=\{storageError\}/)
  const mojibake = /\uFFFD|Ã|Â|â€|â€™|â†|â”|ðŸ/u
  for (const source of [page, studio, model, historyOverlay]) assert.doesNotMatch(source, mojibake)
  assert.match(model, /\["“\]/)
  assert.match(model, /\["”\]/)
})

test('finished essays stay in the current Writing Studio instead of the retired copy-down view', () => {
  assert.match(page, /open=\{isChatting && \(writingMode \|\| essayMode\)\}/)
  assert.match(page, /subphase=\{essayMode \? WEBB_WRITING_SUBPHASES\.COMMITTED : writingSubphase\}/)
  assert.match(page, /finalView=\{essayMode\}/)
  assert.match(page, /writingAllAccepted && essay \? \(\) => setEssayMode\(true\) : handleStartWriting/)
  assert.doesNotMatch(page, /Essay full-screen overlay|Copy It Down|Copy it onto paper/)
  assert.match(studio, /finalView \? 'Your essay' : 'Your essay so far'/)
  assert.match(studio, /Complete Lesson/)
  assert.match(studio, /Back to lesson/)
})

test('normal Mrs. Webb chat input is hidden while active writing uses the Writing Studio', () => {
  assert.match(page, /\{isChatting && !writingMode && \(/)
  assert.match(page, /open=\{isChatting && \(writingMode \|\| essayMode\)\}/)
})
test('startup preparation errors do not imply learner work was lost before input opens', () => {
  assert.match(page, /Mrs\. Webb could not prepare this lesson yet\. Please retry\./)
  assert.doesNotMatch(page, /no answer has been lost/)
})

test('Mrs. Webb cannot expose first-turn input before objective tracking is ready', () => {
  const start = page.indexOf('const selectLesson = useCallback(async (lesson, forceNew = false) => {')
  const end = page.indexOf('async function submitWritingAttempt', start)
  assert.ok(start >= 0 && end > start)
  const startup = page.slice(start, end)
  const prepareObjectives = startup.indexOf('startupObjectives = await generateObjectives(lesson)')
  const startSession = startup.indexOf('await startProtectedInstructionalSession({')
  const loadExposure = startup.indexOf('await loadPriorObjectiveExposure(startupObjectives, lesson)')
  const openChat = startup.indexOf('setPhase(PHASE.CHATTING)')
  assert.ok(prepareObjectives >= 0, 'objectives must be awaited during startup')
  assert.ok(startSession > prepareObjectives, 'objective generation must complete before a protected session starts')
  assert.ok(loadExposure > startSession, 'prior exposure must be loaded after evidence/session initialization')
  assert.ok(openChat > loadExposure, 'chat input must remain closed until objective tracking is ready')
  assert.doesNotMatch(startup.slice(openChat), /generateObjectives\(lesson\)/)
  assert.match(page, /if \(!res\.ok\) throw new Error\('Mrs\. Webb could not prepare the learning goals for this lesson\.'\)/)
})


test('Mrs. Webb acknowledges resume immediately while protected state is restored', () => {
  assert.match(page, /const \[resumeBusy,\s*setResumeBusy\]\s*=\s*useState\(false\)/)
  assert.match(page, /async function handleResume\(\) \{[\s\S]*if \(resumeBusy\) return[\s\S]*setResumeBusy\(true\)/)
  assert.match(page, /finally \{[\s\S]*setResumeBusy\(false\)/)
  assert.match(page, /onClick=\{handleResume\} disabled=\{resumeBusy\}/)
  assert.match(page, /resumeBusy \? 'Resuming…' : '▶ Resume'/)
  assert.match(page, /onClick=\{handleRestartFromPrompt\} disabled=\{resumeBusy\}/)
})

test('slow writing and completion transitions expose busy state without skipping persistence', () => {
  assert.match(page, /const \[writingStartBusy,\s*setWritingStartBusy\]\s*=\s*useState\(false\)/)
  assert.match(page, /setWritingStartBusy\(true\)[\s\S]*await prepareCompositionPlan\(\)[\s\S]*await persistCompositionArtifact/)
  assert.match(page, /writingStartBusy \? 'Preparing writing…'/)

  const completionStart = page.indexOf('async function handleCompleteLesson()')
  const completionEnd = page.indexOf('async function interpretArticle()', completionStart)
  assert.ok(completionStart >= 0 && completionEnd > completionStart)
  const completion = page.slice(completionStart, completionEnd)
  const markSaving = completion.indexOf("setCompletionState('saving')")
  const persistFinal = completion.indexOf("persistCompositionArtifact({ plan: compositionPlan, accepted: acceptedSentences, status: 'final' })")
  assert.ok(markSaving >= 0 && persistFinal > markSaving, 'completion feedback must appear before the awaited server persistence step')
  assert.match(studio, /completionState === 'saving' \? 'Recording completion\.\.\.'/)
})
