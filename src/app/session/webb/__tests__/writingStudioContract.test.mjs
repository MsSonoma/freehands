import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../page.jsx', import.meta.url), 'utf8')
const studio = fs.readFileSync(new URL('../WebbWritingStudio.jsx', import.meta.url), 'utf8')
const route = fs.readFileSync(new URL('../../../api/webb-objectives/route.js', import.meta.url), 'utf8')
  + fs.readFileSync(new URL('../../../lib/webbObjectiveEvaluation.mjs', import.meta.url), 'utf8')
const model = fs.readFileSync(new URL('../../../lib/webbLearningModel.mjs', import.meta.url), 'utf8')

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
  assert.match(page, /objective=\{objectives\[writingIndex\]\}/)
  assert.match(studio, />\s*What you showed\s*</)
  assert.match(studio, /\{currentObjective\}/)
  assert.match(studio, />\s*Your note\s*</)
  assert.match(studio, />\s*Previous attempt\s*</)
  assert.match(studio, /'Try again'/)
  assert.match(studio, />\s*Your essay so far\s*</)
  assert.match(studio, /webb-writing-glow/)
  assert.match(studio, /'Next sentence'/)
  assert.match(studio, /'Finish essay'/)
  assert.match(page, /function handleNextWritingSentence\(\)/)
  assert.match(page, /onNextSentence=\{handleNextWritingSentence\}/)
  assert.doesNotMatch(page, /setTimeout\(\(\) => \{[\s\S]{0,500}WEBB_WRITING_SUBPHASES\.COMMITTED/)
  assert.doesNotMatch(studio, /learnerNotes/)
})

test('writing resume restores the durable composition stage instead of re-entering research', () => {
  assert.match(model, /WEBB_SNAPSHOT_VERSION = 6/)
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

test('normal Mrs. Webb chat input is hidden while the writing studio is active', () => {
  assert.match(page, /\{isChatting && !writingMode && \(/)
  assert.match(page, /open=\{isChatting && writingMode\}/)
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
