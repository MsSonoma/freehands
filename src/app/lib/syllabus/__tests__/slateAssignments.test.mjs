import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { POST as assignSlate } from '../../../api/syllabus/slate-assignments/route.js'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function request(body) {
  return new Request('http://localhost/api/syllabus/slate-assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

function repository() {
  const writes = []
  return {
    writes,
    async findOwnedLearner(learnerId, facilitatorId) {
      return learnerId === LEARNER && facilitatorId === FACILITATOR
        ? { id: LEARNER, approved_lessons: { 'math/fractions.json': true } }
        : null
    },
    async findFacilitatorTimeZone() { return 'UTC' },
    async findSyllabus() { return { id: 'syllabus-1', active_revision_id: 'revision-1' } },
    async findRevision() { return { id: 'revision-1', effective_from: '2026-09-01', weekly_pattern: { wednesday: [{ subject: 'math' }] } } },
    async listForecastItems() {
      return [{ id: 'forecast-1', lesson_key: 'math/fractions.json', subject: 'math', title: 'Fractions', planned_date: '2026-09-02', sort_order: 0, item_type: 'lesson' }]
    },
    async listLessonAssociations() {
      return [{ id: 1, lesson_key: 'math/fractions.json', subject: 'math', title: 'Fractions', readiness_state: 'available', instructional_teacher: 'webb' }]
    },
    async listSlateAssignments() { return [] },
    async listLessonSchedule() { return [] },
    async listAllTrackedSessions() { return [] },
    async listAllLessonSessionEvents() { return [] },
    async createSlateAssignment(row) { writes.push(row); return { id: '22222222-2222-4222-8222-222222222222', ...row } },
  }
}

test('facilitator assigns Slate to one exact occurrence without changing its instructional teacher', async () => {
  const store = repository()
  const response = await assignSlate(request({ learnerId: LEARNER, lessonKey: 'math/fractions.json', occurrenceId: 'syllabus:forecast-1' }), {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: store,
    now: new Date('2026-09-02T12:00:00Z'),
  })
  assert.equal(response.status, 200)
  assert.equal(store.writes.length, 1)
  assert.equal(store.writes[0].syllabus_occurrence_id, 'syllabus:forecast-1')
  assert.equal(store.writes[0].lesson_key, 'math/fractions.json')
  assert.equal('instructional_teacher' in store.writes[0], false)
})

test('Slate assignment rejects a lesson or occurrence mismatch before writing', async () => {
  const store = repository()
  const response = await assignSlate(request({ learnerId: LEARNER, lessonKey: 'math/other.json', occurrenceId: 'syllabus:forecast-1' }), {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: store,
    now: new Date('2026-09-02T12:00:00Z'),
  })
  assert.equal(response.status, 403)
  assert.equal(store.writes.length, 0)
})

test('Slate assignment migration is RLS-protected and keeps writes service-role-only', () => {
  const sql = fs.readFileSync('supabase/migrations/20260902161410_add_syllabus_slate_assignments.sql', 'utf8')
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /unique \(\s*facilitator_id,\s*learner_id,\s*syllabus_occurrence_id\s*\)/i)
  assert.match(sql, /revoke all on table public\.syllabus_slate_assignments from public, anon, authenticated/i)
  assert.match(sql, /grant select, insert, delete on table public\.syllabus_slate_assignments to service_role/i)
  assert.doesNotMatch(sql, /grant (?:insert|update|delete)[^;]* to authenticated/i)
})
