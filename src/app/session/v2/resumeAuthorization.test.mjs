import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  canRestoreSnapshotForExecution,
  deriveResumePhaseFromSnapshot,
  rejectSnapshotForActiveExecution,
} from './resumePhase.js'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function snapshot(sessionId = A) {
  return {
    sessionId,
    currentPhase: 'exercise',
    phaseData: { exercise: { nextQuestionIndex: 1, answers: [{ response: 'answer' }] } },
  }
}

function allowed(overrides = {}) {
  return {
    snapshot: snapshot(),
    executionAuthorization: 'allowed',
    authorizedOccurrenceId: 'syllabus:source-a',
    authorizedResumeBrowserSessionId: A,
    subject: 'math',
    ...overrides,
  }
}

test('source occurrence restores only its exactly authorized snapshot session', () => {
  const owned = snapshot(A)
  assert.equal(canRestoreSnapshotForExecution(allowed({ snapshot: owned })), true)
  assert.equal(deriveResumePhaseFromSnapshot(owned), 'exercise')
  assert.equal(canRestoreSnapshotForExecution(allowed({ snapshot: snapshot(B) })), false)
})

test('direct Retry and a different repeated occurrence remain fresh', () => {
  assert.equal(canRestoreSnapshotForExecution(allowed({
    authorizedOccurrenceId: 'actual:tracked-a',
    authorizedResumeBrowserSessionId: null,
  })), false)
  assert.equal(canRestoreSnapshotForExecution(allowed({
    authorizedOccurrenceId: 'syllabus:source-b',
    authorizedResumeBrowserSessionId: B,
    snapshot: snapshot(A),
  })), false)
})

test('PIN-authorized Continue retains resume identity while failed authorization restores nothing', () => {
  assert.equal(canRestoreSnapshotForExecution(allowed({ authorizedResumeBrowserSessionId: A })), true)
  assert.equal(canRestoreSnapshotForExecution(allowed({ executionAuthorization: 'denied' })), false)
  assert.equal(canRestoreSnapshotForExecution(allowed({ executionAuthorization: 'pending' })), false)
})

test('demo and no-active-Syllabus compatibility retain legacy snapshot behavior', () => {
  assert.equal(canRestoreSnapshotForExecution(allowed({
    subject: 'demo',
    authorizedOccurrenceId: '',
    authorizedResumeBrowserSessionId: null,
  })), true)
  assert.equal(canRestoreSnapshotForExecution(allowed({
    authorizedOccurrenceId: 'legacy:math/lesson.json:2026-08-23',
    authorizedResumeBrowserSessionId: null,
  })), true)
})

test('rejection clears only in-memory state and cannot drive downstream phase resume', () => {
  let deletes = 0
  for (const currentPhase of ['comprehension', 'exercise', 'worksheet', 'test']) {
    let activeSnapshot = { ...snapshot(A), currentPhase }
    const service = {
      get snapshot() { return activeSnapshot },
      clearLoadedSnapshot() { activeSnapshot = null },
      deleteSnapshot() { deletes += 1 },
    }

    rejectSnapshotForActiveExecution(service)
    assert.equal(service.snapshot, null)
    assert.equal(deriveResumePhaseFromSnapshot(service.snapshot), null)
  }
  assert.equal(deletes, 0)

  const source = fs.readFileSync(path.resolve('src/app/session/v2/SessionPageV2.jsx'), 'utf8')
  const initialization = source.slice(source.indexOf('// Initialize SnapshotService after lesson loads'), source.indexOf('// Pre-Begin conflict watch'))
  assert.match(initialization, /executionAuthorization !== 'allowed'/)
  assert.match(initialization, /rejectSnapshotForActiveExecution\(service\)/)
  assert.ok(initialization.indexOf('canRestoreSnapshotForExecution') < initialization.indexOf('deriveResumePhaseFromSnapshot'))
  assert.doesNotMatch(initialization, /deleteSnapshot\(/)
})
