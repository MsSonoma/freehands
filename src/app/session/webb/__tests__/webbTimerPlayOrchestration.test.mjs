import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const webbPage = readFileSync(new URL('../page.jsx', import.meta.url), 'utf8')
const writingStudio = readFileSync(new URL('../WebbWritingStudio.jsx', import.meta.url), 'utf8')
const playOverlay = readFileSync(new URL('../WebbPlayBreakOverlay.jsx', import.meta.url), 'utf8')
const expiredOverlay = readFileSync(new URL('../../v2/PlayTimeExpiredOverlay.jsx', import.meta.url), 'utf8')
const sfx = readFileSync(new URL('../../utils/sfx.js', import.meta.url), 'utf8')

test('Mrs. Webb response timers retry after phase and TTS state changes', () => {
  assert.doesNotMatch(
    webbPage,
    /responseArmSignatureRef\.current = signature\s+let cancelled = false/,
    'a response must not be marked armed before the pending TTS wait succeeds',
  )
  assert.match(webbPage, /startWebbResponseTurn\('research', signature\)/)
  assert.match(webbPage, /startWebbResponseTurn\('writing', signature\)/)
})

test('mid-writing play can only start from the committed sentence action', () => {
  const midpointStarts = webbPage.match(/queueWebbPlayBreak\('writing-midpoint'\)/g) || []
  assert.equal(midpointStarts.length, 1)

  const handlerStart = webbPage.indexOf('async function handleNextWritingSentence()')
  const handlerEnd = webbPage.indexOf('// Complete lesson via Mrs. Webb', handlerStart)
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart)
  const handler = webbPage.slice(handlerStart, handlerEnd)
  assert.match(handler, /queueWebbPlayBreak\('writing-midpoint'\)/)
  assert.match(writingStudio, /playtimeDue \? 'Start Play Time'/)
})

test('Mrs. Webb play expiration uses the shared 30-second return overlay', () => {
  assert.match(playOverlay, /PlayTimeExpiredOverlay/)
  assert.match(playOverlay, /setShowExpiredCountdown\(true\)/)
  assert.doesNotMatch(playOverlay, /remainingSeconds <= 0\) finish\('expired'\)/)
  assert.match(expiredOverlay, /const WARNING_DURATION = 30/)
})

test('skipping the return countdown stops active or pending alarm playback', () => {
  const startNowStart = expiredOverlay.indexOf('const handleStartNow')
  const startNowEnd = expiredOverlay.indexOf('useEffect(() =>', startNowStart)
  assert.ok(startNowStart >= 0 && startNowEnd > startNowStart)
  assert.match(expiredOverlay.slice(startNowStart, startNowEnd), /stopSfx\(ALARM_SFX/)
  assert.match(sfx, /export function stopSfx/)
  assert.match(sfx, /playbackGeneration/)
})
