import assert from 'node:assert/strict'
import test from 'node:test'

import {
  newestSnapshot,
  rehomeSnapshotForTakeover,
  snapshotLessonMatchesExecution,
  snapshotMatchesScope,
  snapshotUpdatedAtMs,
} from '../../lib/snapshotTakeoverHandoff.mjs'

const learnerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const lessonKey = 'math/continuity.json'
const sourceBrowser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const targetBrowser = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function snapshot(lastUpdated, extra = {}) {
  return {
    sessionId: sourceBrowser,
    learnerId,
    lessonKey,
    currentPhase: 'test',
    phaseData: { test: { answers: ['A', 'B'] } },
    lastUpdated,
    ...extra,
  }
}

test('takeover handoff chooses the freshest browser or durable snapshot without changing learning state', () => {
  const durable = snapshot('2026-09-16T17:00:00.000Z', { phaseData: { test: { answers: ['A'] } } })
  const local = snapshot('2026-09-16T17:01:00.000Z')
  assert.equal(newestSnapshot(durable, local), local)
  assert.ok(snapshotUpdatedAtMs(local) > snapshotUpdatedAtMs(durable))
})

test('snapshot filename identity reconciles with the subject-qualified protected execution lesson', () => {
  assert.equal(snapshotLessonMatchesExecution('continuity', 'math/continuity.json'), true)
  assert.equal(snapshotLessonMatchesExecution('continuity.json', 'generated/continuity.json'), true)
  assert.equal(snapshotLessonMatchesExecution('continuity', 'math/different.json'), false)
})
test('takeover snapshot scope requires the exact learner, lesson, and source browser', () => {
  const value = snapshot('2026-09-16T17:01:00.000Z')
  assert.equal(snapshotMatchesScope(value, { learnerId, lessonKey, browserSessionId: sourceBrowser }), true)
  assert.equal(snapshotMatchesScope(value, { learnerId, lessonKey, browserSessionId: targetBrowser }), false)
  assert.equal(snapshotMatchesScope({ ...value, lessonKey: 'math/other.json' }, { learnerId, lessonKey, browserSessionId: sourceBrowser }), false)
})

test('takeover rehomes only ownership identity and preserves exact test progress', () => {
  const source = snapshot('2026-09-16T17:01:00.000Z')
  const moved = rehomeSnapshotForTakeover(source, {
    targetBrowserSessionId: targetBrowser,
    sourceExecutionSessionId: '11111111-1111-4111-8111-111111111111',
    targetExecutionSessionId: '22222222-2222-4222-8222-222222222222',
    claimSource: 'source_device',
    now: new Date('2026-09-16T17:02:00.000Z'),
  })
  assert.equal(moved.sessionId, targetBrowser)
  assert.deepEqual(moved.phaseData, source.phaseData)
  assert.equal(moved.currentPhase, 'test')
  assert.equal(moved.lastUpdated, source.lastUpdated)
  assert.equal(moved.ownershipHandoff.claimSource, 'source_device')
})