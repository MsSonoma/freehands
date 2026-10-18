import assert from 'node:assert/strict'
import test from 'node:test'

import { removeLessonWithFacilitatorOverride } from '../lessonOccurrenceOverride.server.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = '22222222-2222-4222-8222-222222222222'
const EXECUTION = '33333333-3333-4333-8333-333333333333'
const OTHER_EXECUTION = '44444444-4444-4444-8444-444444444444'
const KEY = 'generated/lesson.json'
const REVISION = 'rev-1'

function attempt(id, source = 'scheduled:plan-1', key = KEY, extra = {}) {
  return {
    occurrence_id: `actual:${id}`, lesson_key: key, item_type: 'lesson', placement_kind: 'actual',
    source_occurrence_id: source, ...extra,
  }
}

const source = {
  occurrence_id: 'scheduled:plan-1', lesson_key: KEY, item_type: 'lesson',
  placement_kind: 'scheduled', id: 'plan-1',
}

function harness({ target = attempt(EXECUTION), timeline = null, trackedSessions = null, record = null, revision = REVISION } = {}) {
  const recorded = []
  const items = timeline || [source, target, attempt(OTHER_EXECUTION)]
  const repository = {
    listAllTrackedSessions: async () => trackedSessions || [
      { id: EXECUTION, lesson_id: KEY, session_id: 'browser-a' },
      { id: OTHER_EXECUTION, lesson_id: KEY, session_id: 'browser-b' },
    ],
  }
  const deps = {
    getActiveSyllabus: async () => ({
      active_revision: { id: revision }, timeline_items: items, forecast_items: [],
    }),
    recordRemoval: record || (async (params) => {
      recorded.push(params)
      return { removed: true }
    }),
  }
  const run = (input = {}) => removeLessonWithFacilitatorOverride({
    repository, admin: {}, facilitatorId: FACILITATOR, learnerId: LEARNER,
    lessonKey: KEY, occurrenceId: target.occurrence_id, evidenceDisposition: 'keep',
    expectedActiveRevisionId: REVISION, dependencies: deps, ...input,
  })
  return { run, recorded }
}

test('a started actual occurrence can be hidden while keeping its evidence', async () => {
  const h = harness()
  const result = await h.run()
  assert.equal(result.removed, true)
  assert.equal(result.evidenceDisposition, 'keep')
  assert.equal(result.linkedSessionCount, 1)
  assert.deepEqual(h.recorded[0].p_execution_session_ids, [EXECUTION])
  assert.equal(h.recorded[0].p_evidence_disposition, 'keep')
})

test('completed actual occurrence can have evidence deleted without deleting sibling attempts', async () => {
  const h = harness()
  const result = await h.run({ evidenceDisposition: 'delete' })
  assert.equal(result.evidenceDisposition, 'delete')
  assert.deepEqual(h.recorded[0].p_execution_session_ids, [EXECUTION])
})

test('the planned occurrence targets all actual attempts of exactly that plan', async () => {
  const h = harness({ target: source, timeline: [
    source, attempt(EXECUTION), attempt(OTHER_EXECUTION, 'scheduled:plan-2'),
  ] })
  const result = await h.run()
  assert.equal(result.linkedSessionCount, 1)
  assert.deepEqual(h.recorded[0].p_execution_session_ids, [EXECUTION])
})

test('a scheduled-but-not-started lesson can be removed with no evidence', async () => {
  const h = harness({ target: source, timeline: [source] })
  const result = await h.run()
  assert.equal(result.linkedSessionCount, 0)
  assert.deepEqual(h.recorded[0].p_execution_session_ids, [])
})

test('historical attested lessons can be hidden or deleted without a canonical session', async () => {
  const item = { occurrence_id: 'historical:history-record', item_type: 'lesson', placement_kind: 'historical',
    historical_record: true, source_occurrence_id: 'syllabus:forecast-old', lesson_key: KEY }
  const h = harness({ target: item, timeline: [item] })
  const result = await h.run({ evidenceDisposition: 'delete' })
  assert.equal(result.removed, true)
  assert.deepEqual(h.recorded[0].p_execution_session_ids, [])
})

test('a wrong lesson key, stale revision, and ambiguous row never reach mutation', async () => {
  const h = harness()
  await assert.rejects(h.run({ lessonKey: 'generated/wrong.json' }), /no longer available/)
  await assert.rejects(h.run({ expectedActiveRevisionId: 'stale' }), /active Syllabus changed/)
  const target = attempt(EXECUTION)
  const duplicate = harness({ target, timeline: [target, { ...target }] })
  await assert.rejects(duplicate.run(), /ambiguous/)
  assert.equal(h.recorded.length, 0)
  assert.equal(duplicate.recorded.length, 0)
})

test('an unverifiable session prevents removal rather than affecting a different learner', async () => {
  const h = harness({ trackedSessions: [{ id: OTHER_EXECUTION, lesson_id: KEY }] })
  await assert.rejects(h.run(), /linked session could not be verified/)
  assert.equal(h.recorded.length, 0)
})

test('the service reports a database failure without reporting success', async () => {
  const h = harness({ record: async () => { throw new Error('failed transaction') } })
  await assert.rejects(h.run(), /failed transaction/)
})

test('unexpected lack of an explicit removal receipt is not success', async () => {
  const h = harness({ record: async () => ({ removed: false }) })
  await assert.rejects(h.run(), /Removal could not be verified/)
})

test('legacy bare lesson keys remain removable when the timeline identifies the exact session', async () => {
  const h = harness({ trackedSessions: [
    { id: EXECUTION, lesson_id: 'lesson.json', session_id: 'browser-a' },
    { id: OTHER_EXECUTION, lesson_id: 'generated/lesson.json', session_id: 'browser-b' },
  ] })
  const result = await h.run()
  assert.equal(result.removed, true)
  assert.deepEqual(h.recorded[0].p_execution_session_ids, [EXECUTION])
})
