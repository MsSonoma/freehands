import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const instructionalSql = read('supabase/migrations/20260909010000_harden_instructional_session_ownership.sql')
const goldenSql = read('supabase/migrations/20260909011000_harden_golden_key_lifecycle.sql')
const trackingHook = read('src/app/hooks/useSessionTracking.js')
const trackingClient = read('src/app/lib/sessionTracking.js')
const sessionPage = read('src/app/session/v2/SessionPageV2.jsx')
const snapshotRoute = read('src/app/api/snapshots/route.js')
const snapshotService = read('src/app/session/v2/SnapshotService.jsx')
const evidenceRoute = read('src/app/api/evidence/route.js')
const webbPage = read('src/app/session/webb/page.jsx')
const learnerHome = read('src/app/learn/LearnerHome.js')
const learnerApi = read('src/app/facilitator/learners/clientApi.js')

test('instructional execution ownership distinguishes completion, movement, takeover, and lease expiry', () => {
  assert.match(instructionalSql, /ended_reason is null or ended_reason in \('completed', 'moved', 'taken_over', 'expired', 'released'\)/)
  assert.match(instructionalSql, /v_lease_cutoff timestamptz := v_now - interval '5 minutes'/)
  assert.ok(instructionalSql.includes("ended_reason = 'expired'"))
  assert.ok(instructionalSql.includes('and session_id <> p_browser_session_id'))
  assert.match(instructionalSql, /p_expected_conflicting_session_id <> v_conflicting_active\.id/)
  assert.match(instructionalSql, /same browser: ordinary lesson move/i)
  assert.match(instructionalSql, /when v_takeover and session_id <> p_browser_session_id then 'taken_over'\s+else 'moved'/)
  assert.match(instructionalSql, /create or replace function public\.heartbeat_lesson_session/)
  assert.match(instructionalSql, /ended_reason = 'completed'/)
})

test('instructional watcher renews exact ownership and only takeover opens takeover UI', () => {
  assert.match(trackingClient, /fetch\('\/api\/syllabus\/execution\/heartbeat'/)
  assert.match(trackingClient, /JSON\.stringify\(\{ sessionId, learnerId, browserSessionId \}\)/)
  assert.match(trackingHook, /setInterval\(heartbeat, 15000\)/)
  assert.match(trackingHook, /if \(reason === 'taken_over'\)/)
  assert.match(trackingHook, /onSessionTakenOver/)
  assert.match(trackingHook, /onSessionEnded/)
  assert.match(sessionPage, /if \(!normalized \|\| normalized === 'completed'\) return;/)
  assert.match(sessionPage, /snapshotServiceRef\.current\?\.fenceWrites/)
  assert.match(sessionPage, /timerServiceRef\.current\?\.pause/)
  assert.match(sessionPage, /audioEngineRef\.current\?\.stop/)
  assert.match(sessionPage, /orchestratorRef\.current\?\.destroy/)
})

test('shared snapshots and educational evidence reject writes from a losing execution owner', () => {
  assert.match(snapshotRoute, /verifySnapshotExecutionOwner/)
  assert.match(snapshotRoute, /executionSessionId/)
  assert.match(snapshotRoute, /browserSessionId/)
  assert.match(snapshotRoute, /code: 'SNAPSHOT_OWNERSHIP_LOST'/)
  assert.match(snapshotRoute, /status: 409/)
  assert.match(snapshotService, /bindExecutionOwner\(\{ executionSessionId, browserSessionId \} = \{\}\)/)
  assert.match(snapshotService, /fenceWrites\(reason = 'ownership-lost'\)/)
  assert.match(snapshotService, /if \(this\.#writesFenced\) return \{ success: false, blocked: true, ownershipLost: true \}/)
  assert.match(evidenceRoute, /verifyEvidenceExecutionOwner/)
  assert.match(evidenceRoute, /code: 'EVIDENCE_OWNERSHIP_LOST'/)
})

test('Mrs. Webb adopts the shared protected session and freezes chat/TTS after ownership loss', () => {
  assert.match(webbPage, /useSessionTracking/)
  assert.match(webbPage, /adoptWebbTrackedSession/)
  assert.match(webbPage, /freezeWebbExecution\('taken_over'\)/)
  assert.match(webbPage, /ttsQueueRef\.current = \[\]/)
  assert.match(webbPage, /ttsCurrentRef\.current\.pause\(\)/)
  assert.match(webbPage, /webbOwnershipEndedReason/)
})

test('Golden Key application and finalization are atomic and completion-idempotent', () => {
  assert.match(goldenSql, /create table if not exists public\.golden_key_session_finalizations/)
  assert.match(goldenSql, /execution_session_id uuid primary key/)
  assert.match(goldenSql, /from public\.learners[\s\S]*for update;/)
  assert.match(goldenSql, /state', 'already_applied'/)
  assert.match(goldenSql, /golden_keys = v_remaining,\s*active_golden_keys = v_active/)
  assert.match(goldenSql, /state', 'already_finalized'/)
  assert.match(goldenSql, /v_session\.ended_reason is distinct from 'completed'/)
  assert.match(goldenSql, /v_active := v_active - v_lesson_key/)
  assert.match(goldenSql, /v_keys := v_keys \+ 1/)
})

test('Golden Key selection does not spend inventory before launch and partial learner updates preserve unrelated mastery targets', () => {
  assert.match(learnerHome, /applyGoldenKeyToLesson\(\{ learnerId, lessonKey: thisLessonKey \}\)/)
  assert.doesNotMatch(learnerHome, /golden_key_pending_lesson/)
  assert.doesNotMatch(learnerHome, /golden_keys:\s*learner\.golden_keys\s*-\s*1/)
  assert.match(sessionPage, /finalizeGoldenKeyForSession/)
  assert.match(sessionPage, /featureState:\s*\{/)
  assert.match(sessionPage, /golden-key-suspended/)
  assert.match(learnerApi, /\.\.\.\(t\.comprehension !== undefined \? \{ comprehension: Number\(t\.comprehension\) \} : \{\}\)/)
  assert.match(learnerApi, /\.\.\.\(updates\.name !== undefined \? \{ name: updates\.name \} : \{\}\)/)
  assert.match(learnerApi, /\.\.\.\(updates\.grade !== undefined \? \{ grade: updates\.grade \} : \{\}\)/)
})
