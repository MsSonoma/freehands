import assert from 'node:assert/strict'
import test from 'node:test'
import { removeLessonTranscriptEvidence } from '../transcriptEvidenceRemoval.server.mjs'

const facilitatorId = 'facilitator-1'
const learnerId = 'learner-1'
const lessonKey = 'generated/fractions.json'
const base = `v1/${facilitatorId}/${learnerId}/fractions`
const first = { id: 'execution-1', session_id: 'browser-1', lesson_id: lessonKey,
  instructional_teacher: 'sonoma', started_at: '2026-10-18T14:00:00.000Z' }
const second = { id: 'execution-2', session_id: 'browser-2', lesson_id: lessonKey,
  instructional_teacher: 'sonoma', started_at: '2026-10-18T15:00:00.000Z' }
const entry = (startedAt, text) => ({ startedAt, completedAt: startedAt, lines: [{ role: 'user', text }] })

function fakeStorage(contents = {}) {
  const objects = new Map(Object.entries(contents))
  const removed = []
  const saved = []
  const store = {
    async download(path) {
      return objects.has(path)
        ? { data: { text: async () => objects.get(path) }, error: null }
        : { data: null, error: { statusCode: 404, message: 'Not found' } }
    },
    async remove(paths) {
      removed.push(...paths)
      for (const path of paths) objects.delete(path)
      return { error: null }
    },
  }
  const admin = { storage: { from: (name) => { assert.equal(name, 'transcripts'); return store } } }
  const writeArtifacts = async (_store, args) => {
    saved.push(args)
    objects.set(`${args.basePath}/ledger.json`, JSON.stringify(args.ledger))
  }
  return { admin, removed, saved, objects, writeArtifacts }
}

const remove = (storage, selectedSessions, allSessions) => removeLessonTranscriptEvidence({
  admin: storage.admin, facilitatorId, learnerId, lessonKey, lessonTitle: 'Fractions',
  learnerName: 'Learner', selectedSessions, allSessions, writeArtifacts: storage.writeArtifacts,
})

test('removes one session transcript but preserves the other attempt in consolidated files', async () => {
  const firstEntry = entry('2026-10-18T14:00:01Z', 'first')
  const secondEntry = entry('2026-10-18T15:00:01Z', 'second')
  const storage = fakeStorage({
    [`${base}/ledger.json`]: JSON.stringify([firstEntry, secondEntry]),
    [`${base}/sessions/browser-1/ledger.json`]: JSON.stringify([firstEntry]),
    [`${base}/sessions/browser-2/ledger.json`]: JSON.stringify([secondEntry]),
  })
  const result = await remove(storage, [first], [first, second])
  assert.equal(result.status, 'complete')
  assert.deepEqual(storage.saved[0].ledger, [secondEntry])
  assert.equal(storage.objects.has(`${base}/sessions/browser-1/ledger.json`), false)
  assert.equal(storage.objects.has(`${base}/sessions/browser-2/ledger.json`), true)
  assert.equal(storage.removed.some((path) => path.includes('browser-2')), false)
})

test('duplicate start times are ambiguous and preserve all shared transcript files', async () => {
  const ambiguous = entry('2026-10-18T14:00:00Z', 'shared')
  const storage = fakeStorage({
    [`${base}/ledger.json`]: JSON.stringify([ambiguous, ambiguous]),
    [`${base}/sessions/browser-1/ledger.json`]: JSON.stringify([ambiguous]),
  })
  const result = await remove(storage, [first], [first, second])
  assert.equal(result.status, 'incomplete')
  assert.equal(storage.removed.length, 0)
  assert.equal(storage.saved.length, 0)
})

test('legacy consolidated-only transcript is removed only when exactly one session owns the time', async () => {
  const storage = fakeStorage({ [`${base}/ledger.json`]: JSON.stringify([
    entry('2026-10-18T14:00:10Z', 'legacy'),
  ]) })
  const result = await remove(storage, [first], [first])
  assert.equal(result.status, 'complete')
  assert.deepEqual(storage.saved[0].ledger, [])
})

test('ambiguous consolidated-only segment is preserved rather than assigned to a sibling', async () => {
  const concurrent = { ...second, started_at: '2026-10-18T14:00:05Z' }
  const storage = fakeStorage({ [`${base}/ledger.json`]: JSON.stringify([
    entry('2026-10-18T14:00:02Z', 'ambiguous'),
  ]) })
  const result = await remove(storage, [first], [first, concurrent])
  assert.equal(result.status, 'incomplete')
  assert.equal(storage.saved.length, 0)
  assert.equal(storage.removed.length, 0)
})
