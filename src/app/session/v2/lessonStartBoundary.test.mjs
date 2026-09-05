import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const sessionPage = fs.readFileSync(path.resolve('src/app/session/v2/SessionPageV2.jsx'), 'utf8')
const trackingHook = fs.readFileSync(path.resolve('src/app/hooks/useSessionTracking.js'), 'utf8')
const trackingClient = fs.readFileSync(path.resolve('src/app/lib/sessionTracking.js'), 'utf8')

function between(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`)
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`)
  return source.slice(startIndex, endIndex)
}

function assertOrdered(source, markers) {
  let previous = -1
  for (const marker of markers) {
    const index = source.indexOf(marker)
    assert.ok(index > previous, `${marker} must appear after the preceding boundary`)
    previous = index
  }
}

test('passive Sonoma page initialization cannot start canonical tracking', () => {
  assert.match(sessionPage, /useSessionTracking\(\s*learnerProfile\?\.id \|\| null,\s*goldenKeyLessonKey \|\| null,\s*false,/)
  assert.doesNotMatch(sessionPage, /Auto-start the session as soon as the page is ready/)
  assert.doesNotMatch(sessionPage, /useEffect\(\(\) => \{[\s\S]{0,500}handleStartSessionClick\(/)

  const snapshotInitialization = between(
    sessionPage,
    '// Initialize SnapshotService after lesson loads',
    '// Pre-Begin conflict watch:'
  )
  assert.doesNotMatch(snapshotInitialization, /startTrackedSession|startLessonSession|\/execution\/start/)
})

test('fresh Begin and Resume are the deliberate canonical start boundary', () => {
  assert.match(sessionPage, /offerResume \? \([\s\S]*?'Resume'[\s\S]*?\) : \([\s\S]*?onClick=\{\(\) => handleStartSessionClick\(\)\}[\s\S]*?'Begin'/)

  const startSession = between(sessionPage, 'const startSession = async', 'const handleStartSessionClick = useCallback')
  assertOrdered(startSession, [
    'startTrackedSession(',
    'trackedSessionIdForEvidence = sessionResult.id',
    'evidenceClient.initialize({',
    'recordSessionStarted({ initialPhase })',
    'buildRetentionPlan({',
    'buildBaselinePlan({',
    'beginInstruction(null)',
  ])
})

test('baseline and retention remain behind canonical identity and ahead of instruction', () => {
  const startSession = between(sessionPage, 'const startSession = async', 'const handleStartSessionClick = useCallback')
  assert.match(startSession, /if \(trackedSessionIdForEvidence\) \{[\s\S]*?evidenceClient\.initialize\(\{[\s\S]*?sessionId: trackedSessionIdForEvidence/)
  assert.match(startSession, /buildRetentionPlan\([\s\S]*?activateRetention\(/)
  assert.match(startSession, /buildBaselinePlan\([\s\S]*?activateBaseline\(/)
  assert.match(startSession, /target && target !== 'idle'[\s\S]*?RESUME_AFTER_INSTRUCTION/)
})

test('resume reuses tracking identity and Start Over waits at the fresh Begin gate', () => {
  assert.match(trackingHook, /if \(sessionIdRef\.current\) \{\s*return \{ id: sessionIdRef\.current \};?\s*\}/)
  assert.match(sessionPage, /startOverInProgressRef\.current = true[\s\S]*?resumePhaseRef\.current = null[\s\S]*?Start Over only resets durable progress[\s\S]*?setCurrentPhase\('idle'\)/)

  const startOver = between(
    sessionPage,
    'startOverInProgressRef.current = true',
    'disabled={!(audioReady && snapshotLoaded) || startSessionLoading}'
  )
  assert.doesNotMatch(startOver, /startTrackedSession|handleStartSessionClick/)
})

test('pre-Begin conflict checks are read-only while start and takeover stay protected', () => {
  const preBegin = between(sessionPage, '// Pre-Begin conflict watch:', '// Initialize TimerService')
  assert.match(preBegin, /checkLessonSessionConflict/)
  assert.doesNotMatch(preBegin, /startTrackedSession|\/execution\/start/)
  assert.match(trackingClient, /Check-only:[\s\S]*?Does NOT create or modify any session rows/)
  assert.match(sessionPage, /requireProtectedSessionCreation\(\(\) => withTimeout\([\s\S]*?startTrackedSession\(/)
  assert.match(sessionPage, /startTrackedSession\(browserSessionId, deviceName, pinCode, conflictingSession\?\.id, authorizedOccurrenceId, 'sonoma'\)/)
})

test('SESSION_STARTED evidence is emitted only after deliberate canonical start succeeds', () => {
  const startSession = between(sessionPage, 'const startSession = async', 'const handleStartSessionClick = useCallback')
  assertOrdered(startSession, [
    'const sessionResult = await requireProtectedSessionCreation',
    'trackedSessionIdForEvidence = sessionResult.id',
    'evidenceClient.initialize({',
    'recordSessionStarted({ initialPhase })',
  ])
  assert.doesNotMatch(sessionPage.slice(0, sessionPage.indexOf('const startSession = async')), /recordSessionStarted\(/)
})
