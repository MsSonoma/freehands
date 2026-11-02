import assert from 'node:assert/strict'
import test from 'node:test'
import { canAdoptLegacyRestartSnapshot } from '../restartSnapshotScope.mjs'

const scope = { learnerId: 'learner', lessonKey: 'generated/lesson.json', occurrenceId: 'restart:attempt', browserSessionId: 'browser', startedAt: '2026-11-02T16:48:55Z', teacher: 'sonoma' }
const snapshot = { learnerId: 'learner', lessonKey: 'generated/lesson.json', sessionId: 'browser', currentPhase: 'test', lastUpdated: '2026-11-02T17:48:55Z' }
test('saved Sonoma test checkpoint can be adopted when it postdates the exact attempt start', () => {
  assert.equal(canAdoptLegacyRestartSnapshot(snapshot, scope), true)
})
test('prior Slate snapshot is not adopted from the same browser identity', () => {
  assert.equal(canAdoptLegacyRestartSnapshot({ ...snapshot, lastUpdated: '2026-11-02T15:27:31Z', featureState: { instructionalTeacher: 'slate' } }, scope), false)
  assert.equal(canAdoptLegacyRestartSnapshot({ ...snapshot, featureState: { instructionalTeacher: 'slate' } }, scope), false)
  assert.equal(canAdoptLegacyRestartSnapshot({ ...snapshot, featureState: { occurrenceId: 'syllabus:original' } }, scope), false)
})
