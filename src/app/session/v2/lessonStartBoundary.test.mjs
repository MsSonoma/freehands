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

test('passive initialization waits for authorized, loaded lesson before canonical tracking', () => {
  assert.match(sessionPage, /useSessionTracking\(\s*learnerProfile\?\.id \|\| null,\s*goldenKeyLessonKey \|\| null,\s*false,/)
  assert.match(sessionPage, /executionAuthorization !== 'allowed'[\s\S]{0,500}!snapshotLoaded \|\| !audioReady/)
  assert.match(sessionPage, /\(resumePhase && resumePhase !== 'idle'\)\) return/)
  assert.match(sessionPage, /autoStartedLessonRef\.current === identity/)

  const snapshotInitialization = between(
    sessionPage,
    '// Initialize SnapshotService after lesson loads',
    '// Pre-Begin conflict watch:'
  )
  assert.doesNotMatch(snapshotInitialization, /startTrackedSession|startLessonSession|\/execution\/start/)
})

test('fresh lesson starts automatically while saved progress retains Resume and Start Over', () => {
  assert.ok(sessionPage.includes('offerResume ? ('))
  assert.ok(sessionPage.includes('Resume'))
  assert.ok(sessionPage.includes('Start Over'))
  assert.match(sessionPage, /autoStartedLessonRef\.current = identity;\s*void handleStartSessionClick\(\)/)
  assert.doesNotMatch(sessionPage, />\s*Begin (?:Discussion|Comprehension|Exercise|Worksheet|Test)\s*</)

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

test('resume reuses tracking identity and Start Over restarts immediately', () => {
  assert.ok(trackingHook.includes('return sessionStartResultRef.current || { id: sessionIdRef.current };'))
  assert.ok(trackingHook.includes('sessionStartResultRef.current = result'))
  assert.match(sessionPage, /startOverInProgressRef\.current = true[\s\S]*?resumePhaseRef\.current = null[\s\S]*?Restart immediately after the educator chooses Start Over.[\s\S]*?setCurrentPhase\('idle'\)/)

  const startOver = between(
    sessionPage,
    'startOverInProgressRef.current = true',
    'disabled={!(audioReady && snapshotLoaded) || startSessionLoading}'
  )
  assert.match(startOver, /await handleStartSessionClick\(\{ ignoreResume: true \}\)/)
  assert.doesNotMatch(startOver, /startTrackedSession/)
})

test('pre-start conflict checks are read-only while start and takeover stay protected', () => {
  const preBegin = between(sessionPage, '// Pre-Begin conflict watch:', '// Initialize TimerService')
  assert.match(preBegin, /checkLessonSessionConflict/)
  assert.doesNotMatch(preBegin, /startTrackedSession|\/execution\/start/)
  assert.match(trackingClient, /Check-only:[\s\S]*?Does NOT create or modify any session rows/)
  assert.match(sessionPage, /requireProtectedSessionCreation\(\(\) => withTimeout\([\s\S]*?startTrackedSession\(/)
  assert.match(sessionPage, /fetch\('\/api\/syllabus\/execution\/takeover'/)
  assert.match(sessionPage, /startTrackedSession\([\s\S]{0,500}true,[\s\S]{0,500}expectedConflict\.id/)
})

test('SESSION_STARTED evidence is emitted only after protected canonical start succeeds', () => {
  const startSession = between(sessionPage, 'const startSession = async', 'const handleStartSessionClick = useCallback')
  assertOrdered(startSession, [
    'const sessionResult = await requireProtectedSessionCreation',
    'trackedSessionIdForEvidence = sessionResult.id',
    'evidenceClient.initialize({',
    'recordSessionStarted({ initialPhase })',
  ])
  assert.doesNotMatch(sessionPage.slice(0, sessionPage.indexOf('const startSession = async')), /recordSessionStarted\(/)
})

test('new question phases and Discussion start without obsolete Begin controls', () => {
  for (const phase of ['comprehension', 'exercise', 'worksheet', 'test']) {
    const segmentStart = sessionPage.indexOf('const start' + phase[0].toUpperCase() + phase.slice(1) + 'Phase = () => {')
    assert.notEqual(segmentStart, -1)
    const segment = sessionPage.slice(segmentStart, segmentStart + 30000)
    assert.ok(segment.includes("if (!shouldAutoStart && phase.start)"))
    assert.ok(segment.includes("void handleBeginPhase('" + phase + "')"))
  }
  assert.match(sessionPage, /data\.state === 'ready' && currentPhaseRef\.current === 'discussion'/)
})

test('Sonoma evidence uses the Syllabus lesson key consistently', () => {
  const itemContext = between(sessionPage, 'const getEvidenceItemContext = useCallback', 'const getActiveEvidenceItemContext = useCallback')
  assert.ok(itemContext.includes('lessonKey: goldenKeyLessonKey || lessonKey'))

  const eligibility = between(sessionPage, 'const prepareMasteryEligibility = useCallback', 'const recordMasteryCheckResult = useCallback')
  assert.ok(eligibility.includes('buildItemIdentity({ lessonKey: goldenKeyLessonKey || lessonKey'))
  assert.ok(eligibility.includes('lessonKey: goldenKeyLessonKey || lessonKey,'))

  const tracking = between(sessionPage, 'let evidenceClientForBaseline = null', 'const markBaselineUnavailableAndBegin = async')
  assert.ok(tracking.includes('lessonKey: goldenKeyLessonKey || lessonKey || null'))
})
