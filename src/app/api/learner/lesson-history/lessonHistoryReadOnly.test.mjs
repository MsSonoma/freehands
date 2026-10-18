import assert from 'node:assert/strict'
import test from 'node:test'

import { GET } from './route.js'

function createReadOnlySupabase(rowsByTable) {
  const mutations = []
  return {
    mutations,
    from(table) {
      const builder = {
        select() { return builder },
        eq() { return builder },
        gte() { return builder },
        lt() { return builder },
        order() { return builder },
        range() { return Promise.resolve({ data: rowsByTable[table] || [], error: null }) },
        limit() { return Promise.resolve({ data: rowsByTable[table] || [], error: null }) },
        insert(value) { mutations.push({ operation: 'insert', table, value }); return builder },
        update(value) { mutations.push({ operation: 'update', table, value }); return builder },
      }
      return builder
    },
  }
}

test('learner-history GET is read-only even for a session that previously looked stale', async () => {
  const supabase = createReadOnlySupabase({
    lesson_sessions: [{
      id: 'session-1',
      session_id: 'browser-session-1',
      learner_id: 'learner-1',
      lesson_id: 'math/fractions.json',
      instructional_teacher: 'sonoma',
      started_at: '2026-08-27T14:14:27.000Z',
      ended_at: null,
    }],
    lesson_session_events: [{
      id: 'started-1',
      session_id: 'session-1',
      lesson_id: 'math/fractions.json',
      event_type: 'started',
      occurred_at: '2026-08-27T14:14:27.000Z',
      metadata: {},
    }],
    learner_medals: [],
  })

  const response = await GET(
    new Request('http://localhost/api/learner/lesson-history?learner_id=learner-1'),
    { supabase },
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.sessions[0].ended_at, null)
  assert.equal(body.sessions[0].session_id, 'browser-session-1')
  assert.equal(body.sessions[0].status, 'in-progress')
  assert.equal(body.events.some((event) => event.event_type === 'incomplete'), false)
  assert.deepEqual(supabase.mutations, [])
})

test('a removed lesson instance is omitted from learner history even when its evidence was kept', async () => {
  const supabase = createReadOnlySupabase({
    syllabus_lesson_removals: [{ execution_session_ids: ['session-hidden'] }],
    lesson_sessions: [
      { id: 'session-hidden', lesson_id: 'math/fractions.json', started_at: '2026-08-27T14:00:00Z', ended_at: null },
      { id: 'session-visible', lesson_id: 'math/geometry.json', started_at: '2026-08-28T14:00:00Z', ended_at: null },
    ],
    lesson_session_events: [
      { id: 'e-hidden', session_id: 'session-hidden', lesson_id: 'math/fractions.json', event_type: 'started', occurred_at: '2026-08-27T14:00:00Z' },
      { id: 'e-visible', session_id: 'session-visible', lesson_id: 'math/geometry.json', event_type: 'started', occurred_at: '2026-08-28T14:00:00Z' },
    ],
  })
  const response = await GET(
    new Request('http://localhost/api/learner/lesson-history?learner_id=learner-1'),
    { supabase },
  )
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(body.sessions.map((row) => row.id), ['session-visible'])
  assert.deepEqual(body.events.map((row) => row.id), ['e-visible'])
  assert.deepEqual(supabase.mutations, [])
})
