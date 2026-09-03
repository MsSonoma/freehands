import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { DELETE as removeSlate, POST as scheduleSlate } from '../../../api/syllabus/slate-assignments/route.js'
import { createSyllabusRepository } from '../supabaseRepository.server.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function request(body, method = 'POST') {
  return new Request('http://localhost/api/syllabus/slate-assignments', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

function repository() {
  const writes = []
  const deletes = []
  return {
    writes,
    deletes,
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
    async deleteSlateAssignment(facilitatorId, learnerId, assignmentId) {
      deletes.push({ facilitatorId, learnerId, assignmentId })
      return facilitatorId === FACILITATOR && learnerId === LEARNER && assignmentId === '22222222-2222-4222-8222-222222222222'
        ? { id: assignmentId }
        : null
    },
  }
}

test('facilitator schedules Slate on a separate date for one exact occurrence without changing its instructional teacher', async () => {
  const store = repository()
  const response = await scheduleSlate(request({ learnerId: LEARNER, lessonKey: 'math/fractions.json', occurrenceId: 'syllabus:forecast-1', scheduledDate: '2026-09-09', runPurpose: 'practice' }), {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: store,
    now: new Date('2026-09-02T12:00:00Z'),
  })
  assert.equal(response.status, 200)
  assert.equal(store.writes.length, 1)
  assert.equal(store.writes[0].syllabus_occurrence_id, 'syllabus:forecast-1')
  assert.equal(store.writes[0].lesson_key, 'math/fractions.json')
  assert.equal(store.writes[0].scheduled_date, '2026-09-09')
  assert.equal(store.writes[0].run_purpose, 'practice')
  assert.equal('instructional_teacher' in store.writes[0], false)
})

test('one instructional occurrence accepts multiple scheduled dates and purposes', async () => {
  const store = repository()
  for (const body of [
    { learnerId: LEARNER, lessonKey: 'math/fractions.json', occurrenceId: 'syllabus:forecast-1', scheduledDate: '2026-09-09', runPurpose: 'practice' },
    { learnerId: LEARNER, lessonKey: 'math/fractions.json', occurrenceId: 'syllabus:forecast-1', scheduledDate: '2026-09-16', runPurpose: 'retention' },
    { learnerId: LEARNER, lessonKey: 'math/fractions.json', occurrenceId: 'syllabus:forecast-1', scheduledDate: '2026-09-16', runPurpose: 'practice' },
  ]) {
    const response = await scheduleSlate(request(body), {
      requestContext: { user: { id: FACILITATOR }, admin: {} },
      repository: store,
      now: new Date('2026-09-02T12:00:00Z'),
    })
    assert.equal(response.status, 200)
  }
  assert.deepEqual(store.writes.map((row) => [row.scheduled_date, row.run_purpose]), [
    ['2026-09-09', 'practice'],
    ['2026-09-16', 'retention'],
    ['2026-09-16', 'practice'],
  ])
})

function conflictAdmin(existingRows) {
  const observedFilters = []
  return {
    observedFilters,
    from(table) {
      assert.equal(table, 'syllabus_slate_assignments')
      return {
        insert() {
          return {
            select() {
              return { async single() { return { data: null, error: { code: '23505', message: 'duplicate key' } } } }
            },
          }
        },
        select() {
          const filters = []
          const query = {
            eq(column, value) { filters.push([column, value]); return query },
            async maybeSingle() {
              observedFilters.push(filters)
              const matches = existingRows.filter((row) => filters.every(([column, value]) => row[column] === value))
              return matches.length === 1
                ? { data: matches[0], error: null }
                : { data: null, error: matches.length > 1 ? { code: 'PGRST116', message: 'multiple rows' } : null }
            },
          }
          return query
        },
      }
    },
  }
}

test('identical scheduling retries resolve only the complete scheduled-session identity', async () => {
  const exact = {
    id: 'exact-session', facilitator_id: FACILITATOR, learner_id: LEARNER,
    syllabus_occurrence_id: 'syllabus:forecast-1', scheduled_date: '2026-09-16', run_purpose: 'retention',
  }
  const admin = conflictAdmin([
    { ...exact, id: 'other-date', scheduled_date: '2026-09-09' },
    { ...exact, id: 'other-purpose', run_purpose: 'practice' },
    exact,
  ])
  const repository = createSyllabusRepository(admin)
  assert.equal(await repository.createSlateAssignment(exact), exact)
  assert.equal(await repository.createSlateAssignment(exact), exact)
  assert.deepEqual(admin.observedFilters, [
    [
      ['facilitator_id', FACILITATOR], ['learner_id', LEARNER],
      ['syllabus_occurrence_id', 'syllabus:forecast-1'], ['scheduled_date', '2026-09-16'], ['run_purpose', 'retention'],
    ],
    [
      ['facilitator_id', FACILITATOR], ['learner_id', LEARNER],
      ['syllabus_occurrence_id', 'syllabus:forecast-1'], ['scheduled_date', '2026-09-16'], ['run_purpose', 'retention'],
    ],
  ])
})

test('a uniqueness collision cannot resolve a different date or run purpose', async () => {
  const requested = {
    facilitator_id: FACILITATOR, learner_id: LEARNER,
    syllabus_occurrence_id: 'syllabus:forecast-1', scheduled_date: '2026-09-16', run_purpose: 'retention',
  }
  const admin = conflictAdmin([
    { ...requested, id: 'other-date', scheduled_date: '2026-09-09' },
    { ...requested, id: 'other-purpose', run_purpose: 'practice' },
  ])
  await assert.rejects(
    createSyllabusRepository(admin).createSlateAssignment(requested),
    (error) => error.code === '23505' && /duplicate key/.test(error.message),
  )
})

test('repeating the identical occurrence/date/purpose POST remains idempotent', async () => {
  const store = repository()
  const persisted = []
  store.createSlateAssignment = async (row) => {
    const existing = persisted.find((entry) =>
      entry.facilitator_id === row.facilitator_id
      && entry.learner_id === row.learner_id
      && entry.syllabus_occurrence_id === row.syllabus_occurrence_id
      && entry.scheduled_date === row.scheduled_date
      && entry.run_purpose === row.run_purpose)
    if (existing) return existing
    const created = { id: '22222222-2222-4222-8222-222222222222', ...row }
    persisted.push(created)
    return created
  }
  const body = {
    learnerId: LEARNER,
    lessonKey: 'math/fractions.json',
    occurrenceId: 'syllabus:forecast-1',
    scheduledDate: '2026-09-16',
    runPurpose: 'retention',
  }
  const responses = []
  for (let attempt = 0; attempt < 2; attempt += 1) {
    responses.push(await scheduleSlate(request(body), {
      requestContext: { user: { id: FACILITATOR }, admin: {} },
      repository: store,
      now: new Date('2026-09-02T12:00:00Z'),
    }))
  }
  assert.deepEqual(responses.map((response) => response.status), [200, 200])
  assert.equal(persisted.length, 1)
  assert.deepEqual((await responses[0].json()).assignment, (await responses[1].json()).assignment)
})

test('Slate scheduling rejects a lesson or occurrence mismatch before writing', async () => {
  const store = repository()
  const response = await scheduleSlate(request({ learnerId: LEARNER, lessonKey: 'math/other.json', occurrenceId: 'syllabus:forecast-1', scheduledDate: '2026-09-09' }), {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: store,
    now: new Date('2026-09-02T12:00:00Z'),
  })
  assert.equal(response.status, 403)
  assert.equal(store.writes.length, 0)
})

test('Slate scheduling requires a canonical purpose and a non-past date on or after instruction', async () => {
  const store = repository()
  for (const body of [
    { learnerId: LEARNER, lessonKey: 'math/fractions.json', occurrenceId: 'syllabus:forecast-1', scheduledDate: 'not-a-date' },
    { learnerId: LEARNER, lessonKey: 'math/fractions.json', occurrenceId: 'syllabus:forecast-1', scheduledDate: '2026-09-01' },
    { learnerId: LEARNER, lessonKey: 'math/fractions.json', occurrenceId: 'syllabus:forecast-1', scheduledDate: '2026-09-09', runPurpose: 'made_up' },
  ]) {
    const response = await scheduleSlate(request(body), {
      requestContext: { user: { id: FACILITATOR }, admin: {} },
      repository: store,
      now: new Date('2026-09-02T12:00:00Z'),
    })
    assert.equal(response.status, 400)
  }
  assert.equal(store.writes.length, 0)
})

test('removing a scheduled Slate session remains facilitator and learner scoped', async () => {
  const store = repository()
  const assignmentId = '22222222-2222-4222-8222-222222222222'
  const response = await removeSlate(request({ learnerId: LEARNER, assignmentId }, 'DELETE'), {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: store,
  })
  assert.equal(response.status, 200)
  assert.deepEqual(store.deletes, [{ facilitatorId: FACILITATOR, learnerId: LEARNER, assignmentId }])

  const otherLearner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const crossLearner = await removeSlate(request({ learnerId: otherLearner, assignmentId }, 'DELETE'), {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: store,
  })
  assert.equal(crossLearner.status, 404)
  assert.deepEqual(store.deletes.at(-1), { facilitatorId: FACILITATOR, learnerId: otherLearner, assignmentId })
})

test('Slate assignment migration is RLS-protected and keeps writes service-role-only', () => {
  const sql = fs.readFileSync('supabase/migrations/20260902161410_add_syllabus_slate_assignments.sql', 'utf8')
  const scheduling = fs.readFileSync('supabase/migrations/20260903005713_schedule_syllabus_slate_sessions.sql', 'utf8')
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /unique \(\s*facilitator_id,\s*learner_id,\s*syllabus_occurrence_id\s*\)/i)
  assert.match(sql, /revoke all on table public\.syllabus_slate_assignments from public, anon, authenticated/i)
  assert.match(sql, /grant select, insert, delete on table public\.syllabus_slate_assignments to service_role/i)
  assert.doesNotMatch(sql, /grant (?:insert|update|delete)[^;]* to authenticated/i)
  assert.match(scheduling, /add column scheduled_date date/i)
  assert.match(scheduling, /add column run_purpose text not null default 'practice'/i)
  assert.match(scheduling, /drop constraint syllabus_slate_assignments_occurrence_unique/i)
  assert.match(scheduling, /create unique index syllabus_slate_assignments_scheduled_session_unique[\s\S]*facilitator_id,[\s\S]*learner_id,[\s\S]*syllabus_occurrence_id,[\s\S]*scheduled_date,[\s\S]*run_purpose[\s\S]*where scheduled_date is not null/i)
  assert.match(scheduling, /'practice'[\s\S]*'independent_mastery'[\s\S]*'recovery'[\s\S]*'daily_followup'[\s\S]*'weekly_review'[\s\S]*'retention'/i)
  assert.doesNotMatch(scheduling, /lesson_schedule|instructional_teacher/i)
})
