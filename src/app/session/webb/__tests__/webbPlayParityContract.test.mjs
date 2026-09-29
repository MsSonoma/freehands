import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const overlay = fs.readFileSync(new URL('../WebbPlayBreakOverlay.jsx', import.meta.url), 'utf8')
const page = fs.readFileSync(new URL('../page.jsx', import.meta.url), 'utf8')
const webbChatRoute = fs.readFileSync(new URL('../../../api/webb-chat/route.js', import.meta.url), 'utf8')
const writingStudio = fs.readFileSync(new URL('../WebbWritingStudio.jsx', import.meta.url), 'utf8')
const fullscreenPlayTimer = fs.readFileSync(new URL('../../v2/FullscreenPlayTimerOverlay.jsx', import.meta.url), 'utf8')
const responseTimer = fs.readFileSync(new URL('../WebbResponseTimer.jsx', import.meta.url), 'utf8')

test('Mrs. Webb play surface matches the core Ms. Sonoma play controls', () => {
  assert.match(overlay, />\s*GO!\s*</)
  assert.match(overlay, /Play with Mrs\. Webb/)
  assert.match(overlay, />\s*Games\s*</)
  assert.match(overlay, />\s*Fullscreen Timer\s*</)
  assert.match(overlay, /FullscreenPlayTimerOverlay/)
  assert.match(overlay, /GamesOverlay/)
})

test('Play with Mrs. Webb exposes the same play menu categories', () => {
  for (const label of ['Joke', 'Riddle', 'Poem', 'Story', 'Fill-in-Fun']) {
    assert.equal(overlay.includes(label), true)
  }
  assert.match(page, /requestedActivity/)
  assert.match(page, /You are Mrs\. Webb during a short learner play break/)
  assert.match(page, /This is play time, not instruction/)
})

test('Mrs. Webb play timer uses PIN-gated shared facilitator controls', () => {
  assert.match(overlay, /ensurePinAllowed\('timer'\)/)
  assert.match(overlay, /TimerControlOverlay/)
  assert.match(overlay, /onUpdateTime=\{onUpdateElapsed\}/)
  assert.match(overlay, /onTogglePause=\{onTogglePause\}/)
})

test('Mrs. Webb work timer opens the same PIN-gated timer controls during research and writing', () => {
  assert.match(responseTimer, /onClick=\{onClick\}/)
  assert.match(page, /handleWebbWorkTimerOpen/)
  assert.match(page, /ensurePinAllowed\('timer'\)/)
  assert.equal((page.match(/onClick=\{handleWebbWorkTimerOpen\}/g) || []).length, 2)
  assert.match(page, /timerType="work"/)
  assert.match(page, /onUpdateTime=\{handleWebbWorkElapsedUpdate\}/)
  assert.match(page, /onTogglePause=\{handleWebbWorkPauseToggle\}/)
  assert.match(page, /current\.facilitatorPaused === true/)
})

test('Golden Key changes are wired into the active Mrs. Webb break', () => {
  assert.match(page, /applyGoldenKeyToLesson/)
  assert.match(page, /setWebbPlayGoldenKeyBonus/)
  assert.match(page, /handleWebbSuspendGoldenKey/)
  assert.match(page, /handleWebbUnsuspendGoldenKey/)
  assert.match(page, /goldenKeySuspended: webbGoldenKeySuspended/)
  assert.match(page, /restoredBreakCandidate\.isPaused/)
})

test('GO ends play instead of advancing instructional evidence', () => {
  assert.match(overlay, /finish\('go'\)/)
  assert.doesNotMatch(overlay, /saveWebbCompletion/)
  assert.doesNotMatch(overlay, /objectiveEvidence/)
})


test('research-to-writing play break owns the transition sequence', () => {
  const playAnnouncement = page.indexOf('You can play until the play timer runs out.')
  const breakActivation = page.indexOf('commitActivePlayBreak(breakState)')

  assert.ok(playAnnouncement >= 0)
  assert.ok(breakActivation > playAnnouncement)
  assert.match(page, /deferTransitionForPlay: transitionPlayDue/)
  assert.match(page, /activePlayBreakRef\.current \|\| pendingPlayMilestoneRef\.current/)
  assert.match(page, /current\.milestone === 'research-to-writing'/)
  assert.match(page, /Welcome back! Playtime is over, and now it is time to turn your research notes into writing\./)
  assert.match(webbChatRoute, /allObjectivesMet && deferTransitionForPlay/)
  assert.match(webbChatRoute, /Do not mention writing, the next phase, the Start writing button/)
})


test('new Mrs. Webb speech replaces stale queued and playing speech', () => {
  assert.match(page, /ttsQueueRef\.current = \[t\]/)
  assert.match(page, /currentAudio\.pause\(\)/)
  assert.match(page, /ttsGenRef\.current\+\+/)
})

test('research midpoint defers its Socratic question until the learner returns from play', () => {
  assert.match(page, /deferQuestionForPlay: researchMidpointPlayDue/)
  assert.match(page, /queueWebbPlayBreak\('research-midpoint'\)/)
  assert.match(page, /current\.milestone === 'research-midpoint'/)
  assert.match(page, /resumeAfterPlay: true/)
  assert.match(webbChatRoute, /A timed play break is due before the next Socratic question/)
  assert.match(webbChatRoute, /Welcome them back warmly/)
})

test('writing midpoint waits for the learner to choose Playtime, then resumes on the next sentence', () => {
  const submitStart = page.indexOf('async function submitWritingAttempt')
  const submitEnd = page.indexOf('async function completeResearchTurn', submitStart)
  const submitWritingAttempt = page.slice(submitStart, submitEnd)

  assert.doesNotMatch(submitWritingAttempt, /queueWebbPlayBreak\('writing-midpoint'\)/)
  assert.match(submitWritingAttempt, /choose Playtime when you're ready/)
  assert.match(page, /acceptedCount >= writingMidpointThreshold[\s\S]*queueWebbPlayBreak\('writing-midpoint'\)/)
  assert.match(page, /current\.milestone === 'writing-midpoint'[\s\S]*handleNextWritingSentence\(\)/)
  assert.match(page, /const writingTransitionBusy = !!activePlayBreak \|\| !!pendingPlayMilestoneRef\.current/)
  assert.match(page, /playtimeDue=\{writingMidpointTransitionDue\}/)
  assert.match(writingStudio, /disabled=\{transitionBusy\}/)
  assert.match(writingStudio, /playtimeDue \? 'Playtime'/)
  assert.match(writingStudio, /Play break starting\.\.\./)
})

test('Mrs. Webb play overlays stay above Writing Studio', () => {
  assert.match(writingStudio, /zIndex: 1400/)
  assert.match(overlay, /zIndex: 1500/)
  assert.match(fullscreenPlayTimer, /zIndex: 1600/)
})
