import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const overlay = fs.readFileSync(new URL('../WebbPlayBreakOverlay.jsx', import.meta.url), 'utf8')
const page = fs.readFileSync(new URL('../page.jsx', import.meta.url), 'utf8')

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
