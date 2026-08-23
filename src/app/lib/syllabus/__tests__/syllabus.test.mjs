import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { buildLegacySeed } from '../legacySeed.server.mjs'
import { activateSyllabus, getActiveSyllabus } from '../revisions.server.mjs'
import { isCalendarDate, validateSnapshot } from '../schema.mjs'
import { GET as getSyllabusRoute } from '../../../api/syllabus/route.js'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = new Date('2026-08-23T14:00:00.000Z')

function snapshot(title = 'Fractions', date = '2026-08-24') {
  return {
    effective_from: '2026-08-23',
    goals: { legacy_notes: 'Build confidence.' },
    subjects: [{ name: 'math' }],
    weekly_pattern: { monday: [{ subject: 'math' }] },
    teaching_guidance: { curriculum_preferences: { focus_topics: ['fractions'] } },
    planning_policy: { automatic_reforecasting: false },
    legacy_provenance: { sources: {} },
    forecast_items: [{
      lineage_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      planned_date: date,
      subject: 'math',
      title,
      lesson_key: 'math/fractions.json',
      item_type: 'lesson',
      origin: 'facilitator',
      sort_order: 0,
      metadata: {},
    }],
  }
}

function memoryRepository() {
  const state = {
    learners: [{ id: LEARNER, facilitator_id: FACILITATOR, name: 'Avery', goals_notes: 'Read more.' }],
    syllabi: [], revisions: [], forecast: [], writes: 0,
  }
  let id = 0
  const clone = (value) => structuredClone(value)
  const repository = {
    state,
    beforeCommit: null,
    async findOwnedLearner(learnerId, facilitatorId) { return clone(state.learners.find((row) => row.id === learnerId && row.facilitator_id === facilitatorId) || null) },
    async findSyllabus(facilitatorId, learnerId) { return clone(state.syllabi.find((row) => row.facilitator_id === facilitatorId && row.learner_id === learnerId) || null) },
    async createOrFindSyllabus(facilitatorId, learnerId) {
      state.writes++
      const row = { id: `syllabus-${++id}`, facilitator_id: facilitatorId, learner_id: learnerId, active_revision_id: null }
      state.syllabi.push(row); return clone(row)
    },
    async findRevision(revisionId, syllabusId) { return clone(state.revisions.find((row) => row.id === revisionId && row.syllabus_id === syllabusId) || null) },
    async nextRevisionNumber(syllabusId) { return Math.max(0, ...state.revisions.filter((row) => row.syllabus_id === syllabusId).map((row) => row.revision_number)) + 1 },
    async insertRevision(row) {
      state.writes++
      const saved = { ...clone(row), id: `revision-${++id}`, activated_at: null }
      state.revisions.push(saved); return clone(saved)
    },
    async insertForecastItems(revisionId, items) {
      state.writes++
      const saved = items.map((item) => ({ ...clone(item), id: `forecast-${++id}`, revision_id: revisionId }))
      state.forecast.push(...saved); return clone(saved)
    },
    async commitRevisionActivation({ syllabusId, revisionId, expectedActiveRevisionId }) {
      state.writes++
      if (repository.beforeCommit) await repository.beforeCommit()
      const syllabus = state.syllabi.find((item) => item.id === syllabusId)
      const revision = state.revisions.find((item) => item.id === revisionId && item.syllabus_id === syllabusId)
      if (!syllabus || syllabus.active_revision_id !== expectedActiveRevisionId || revision?.base_revision_id !== expectedActiveRevisionId) {
        const error = new Error('Syllabus active revision changed')
        error.code = '40001'
        throw error
      }
      if (!revision || revision.activated_at) throw new Error('Invalid proposed revision')
      revision.activated_at = NOW.toISOString()
      syllabus.active_revision_id = revisionId
      syllabus.updated_at = NOW.toISOString()
      return clone(revision)
    },
    async deleteInactiveRevision(revisionId) {
      state.writes++
      state.revisions = state.revisions.filter((row) => row.id !== revisionId || row.activated_at)
      state.forecast = state.forecast.filter((row) => row.revision_id !== revisionId || state.revisions.some((revision) => revision.id === revisionId))
    },
    async listForecastItems(revisionId) {
      return clone(state.forecast.filter((row) => row.revision_id === revisionId).sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.sort_order - b.sort_order))
    },
    async readLegacyPlanning() {
      return clone({
        scheduleTemplates: [{ id: 'template-1', active: true, pattern: { monday: [{ subject: 'math' }] } }],
        curriculumPreferences: { id: 'prefs-1', banned_words: ['spoiler'], focus_topics: ['fractions'], subject_preferences: { math: { focusTopics: ['ratios'] } } },
        plannedLessons: [
          { id: 'past', scheduled_date: '2026-08-22', lesson_data: { title: 'Past lesson', subject: 'math' } },
          { id: 'future', scheduled_date: '2026-08-25', lesson_data: { title: 'Future lesson', subject: 'science' } },
        ],
        customSubjects: [{ id: 'catalog-1', name: 'Robotics' }],
      })
    },
  }
  return repository
}

test('a facilitator cannot read another facilitator syllabus through the server API', async () => {
  const repository = memoryRepository()
  const response = await getSyllabusRoute(
    new Request(`http://localhost/api/syllabus?learnerId=${LEARNER}`, { headers: { Authorization: 'Bearer test' } }),
    { requestContext: { user: { id: OTHER }, admin: {} }, repository },
  )
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'Learner not found or unauthorized' })
})

test('legacy seed is read-only, preserves guidance, offers catalog subjects, and excludes past plans', async () => {
  const repository = memoryRepository()
  const before = structuredClone(repository.state)
  const seed = await buildLegacySeed({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, now: NOW })

  assert.equal(repository.state.writes, 0)
  assert.deepEqual(repository.state, before)
  assert.equal(seed.goals.legacy_notes, 'Read more.')
  assert.deepEqual(seed.subjects.map((item) => item.name), ['math', 'science'])
  assert.deepEqual(seed.available_subjects, [{ id: 'catalog-1', name: 'Robotics' }])
  assert.equal(seed.forecast_items.length, 1)
  assert.equal(seed.forecast_items[0].title, 'Future lesson')
  assert.deepEqual(seed.teaching_guidance.curriculum_preferences.subject_preferences, { math: { focusTopics: ['ratios'] } })
})

test('first and second activation append revisions and preserve prior revision and forecast rows', async () => {
  const repository = memoryRepository()
  const first = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const firstRevisionBefore = structuredClone(repository.state.revisions[0])
  const firstForecastBefore = structuredClone(repository.state.forecast.filter((row) => row.revision_id === first.active_revision.id))

  const second = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot('Decimals', '2026-08-31'), now: NOW })
  assert.equal(first.active_revision.revision_number, 1)
  assert.equal(first.active_revision.base_revision_id, null)
  assert.equal(second.active_revision.revision_number, 2)
  assert.equal(second.active_revision.base_revision_id, first.active_revision.id)
  assert.deepEqual(repository.state.revisions[0], firstRevisionBefore)
  assert.deepEqual(repository.state.forecast.filter((row) => row.revision_id === first.active_revision.id), firstForecastBefore)
  assert.equal(repository.state.revisions.length, 2)
  assert.equal(repository.state.forecast.length, 2)
})

test('active retrieval follows the pointer and forecast ordering is date then sort order', async () => {
  const repository = memoryRepository()
  const first = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const secondSnapshot = snapshot('Later-created revision')
  secondSnapshot.forecast_items = [
    { ...secondSnapshot.forecast_items[0], lineage_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', planned_date: '2026-08-27', title: 'Third', sort_order: 0 },
    { ...secondSnapshot.forecast_items[0], lineage_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', planned_date: '2026-08-26', title: 'Second', sort_order: 2 },
    { ...secondSnapshot.forecast_items[0], lineage_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', planned_date: '2026-08-26', title: 'First', sort_order: 1 },
  ]
  const second = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: secondSnapshot, now: NOW })
  repository.state.syllabi[0].active_revision_id = first.active_revision.id

  const active = await getActiveSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER })
  assert.equal(active.active_revision.id, first.active_revision.id)
  assert.notEqual(active.active_revision.id, second.active_revision.id)
  assert.deepEqual(second.forecast_items.map((item) => item.title), ['First', 'Second', 'Third'])
})

test('missing complete-snapshot sections fail instead of becoming empty', () => {
  const partial = snapshot()
  delete partial.teaching_guidance
  assert.throws(() => validateSnapshot(partial, { today: '2026-08-23' }), /Missing required snapshot sections: teaching_guidance/)
})

test('Phase 1 activation rejects past and future effective dates instead of creating scheduled current revisions', () => {
  const input = snapshot()
  input.effective_from = '2026-08-22'
  assert.throws(() => validateSnapshot(input, { today: '2026-08-23' }), /requires effective_from to equal today/)
  input.effective_from = '2026-08-24'
  assert.throws(() => validateSnapshot(input, { today: '2026-08-23' }), /requires effective_from to equal today/)
  delete input.effective_from
  assert.equal(validateSnapshot(input, { today: '2026-08-23' }).effective_from, '2026-08-23')
})

test('future-effective activation is rejected before any Syllabus write', async () => {
  const repository = memoryRepository()
  const input = snapshot()
  input.effective_from = '2026-08-24'
  await assert.rejects(
    activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: input, now: NOW }),
    /requires effective_from to equal today/,
  )
  assert.equal(repository.state.writes, 0)
  assert.equal(repository.state.revisions.length, 0)
})

test('strict calendar validation rejects normalized impossible dates', () => {
  assert.equal(isCalendarDate('2026-02-28'), true)
  assert.equal(isCalendarDate('2026-02-31'), false)
  const invalidEffective = snapshot()
  invalidEffective.effective_from = '2026-02-31'
  assert.throws(() => validateSnapshot(invalidEffective, { today: '2026-08-23' }), /effective_from must be a valid/)
  const invalidForecast = snapshot()
  invalidForecast.forecast_items[0].planned_date = '2026-02-31'
  assert.throws(() => validateSnapshot(invalidForecast, { today: '2026-08-23' }), /planned_date is invalid/)
})

test('forecast and weekly pattern subjects must be declared case-insensitively', () => {
  const valid = snapshot()
  valid.subjects = [{ name: 'Math' }]
  assert.equal(validateSnapshot(valid, { today: '2026-08-23' }).subjects[0].name, 'Math')

  const missingForecast = snapshot()
  missingForecast.forecast_items[0].subject = 'science'
  assert.throws(() => validateSnapshot(missingForecast, { today: '2026-08-23' }), /forecast_items\[0\]\.subject references undeclared subject "science"/)

  const missingWeekly = snapshot()
  missingWeekly.weekly_pattern.tuesday = [{ subject: 'science' }]
  assert.throws(() => validateSnapshot(missingWeekly, { today: '2026-08-23' }), /weekly_pattern\.tuesday\[0\] references undeclared subject "science"/)
})

test('a concurrent pointer change leaves the losing proposal inactive and safely cleaned up', async () => {
  const repository = memoryRepository()
  const first = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const competitor = {
    ...structuredClone(repository.state.revisions[0]),
    id: 'competitor-revision',
    revision_number: 2,
    base_revision_id: first.active_revision.id,
    activated_at: '2026-08-23T14:01:00.000Z',
  }
  repository.state.revisions.push(competitor)
  repository.beforeCommit = async () => {
    repository.state.syllabi[0].active_revision_id = competitor.id
    repository.beforeCommit = null
  }

  await assert.rejects(
    activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot('Losing proposal'), now: NOW }),
    (error) => error.status === 409 && error.code === 'ACTIVATION_CONFLICT',
  )

  assert.equal(repository.state.syllabi[0].active_revision_id, competitor.id)
  assert.equal(repository.state.revisions.length, 2)
  assert.equal(repository.state.revisions.some((revision) => revision.revision_number === 3), false)
  assert.equal(repository.state.forecast.some((item) => item.title === 'Losing proposal'), false)
})

test('SQL trigger coverage protects identity, forecast reparenting, lineage, and atomic activation', () => {
  const sql = fs.readFileSync(path.resolve('supabase', 'migrations', '20260823204917_add_syllabus_foundation.sql'), 'utf8')

  assert.match(sql, /create trigger syllabi_guard_active_pointer\s+before insert or update on public\.syllabi/i)
  for (const field of ['id', 'facilitator_id', 'learner_id', 'created_at']) {
    assert.match(sql, new RegExp(`new\\.${field} is distinct from old\\.${field}`, 'i'))
  }
  assert.match(sql, /r\.syllabus_id = new\.id and r\.activated_at is not null/i)

  assert.match(sql, /old_revision_activated or new_revision_activated/i)
  assert.match(sql, /before insert or update or delete on public\.syllabus_forecast_items/i)
  assert.match(sql, /base\.id = new\.base_revision_id[\s\S]*base\.syllabus_id = new\.syllabus_id[\s\S]*base\.activated_at is not null/i)

  assert.match(sql, /create or replace function public\.commit_syllabus_revision_activation/i)
  assert.match(sql, /security invoker/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /active_revision_id is distinct from p_expected_active_revision_id/i)
  assert.match(sql, /effective_from is distinct from current_date/i)
  assert.match(sql, /revoke all on function public\.commit_syllabus_revision_activation\(uuid, uuid, uuid\)[\s\S]*from public, anon, authenticated/i)
})

test('all active pointer changes require the activation transaction marker', () => {
  const sql = fs.readFileSync(path.resolve('supabase', 'migrations', '20260823204917_add_syllabus_foundation.sql'), 'utf8')
  const guardStart = sql.indexOf('create or replace function public.guard_syllabus_active_pointer()')
  const guardEnd = sql.indexOf('drop trigger if exists syllabi_guard_active_pointer', guardStart)
  const guard = sql.slice(guardStart, guardEnd)

  assert.match(guard, /new\.active_revision_id is distinct from old\.active_revision_id/i)
  assert.match(guard, /current_setting\('app\.syllabus_activation_commit', true\) is distinct from 'on'/i)
  assert.match(guard, /Syllabus active revision may only change through the activation commit function/i)
})

test('the pointer marker gate also covers direct clear and rollback attempts', () => {
  const sql = fs.readFileSync(path.resolve('supabase', 'migrations', '20260823204917_add_syllabus_foundation.sql'), 'utf8')
  const guardStart = sql.indexOf('create or replace function public.guard_syllabus_active_pointer()')
  const guardEnd = sql.indexOf('drop trigger if exists syllabi_guard_active_pointer', guardStart)
  const guard = sql.slice(guardStart, guardEnd)
  const markerGate = guard.indexOf("new.active_revision_id is distinct from old.active_revision_id")
  const nonNullTargetCheck = guard.indexOf('if new.active_revision_id is not null')

  assert.ok(markerGate > 0, 'a changed pointer, including a clear or rollback, must enter the marker gate')
  assert.ok(nonNullTargetCheck > markerGate, 'the marker gate must run before the non-null target validation')
  assert.doesNotMatch(guard.slice(0, nonNullTargetCheck), /new\.active_revision_id is not null[\s\S]*current_setting/i)
})

test('the atomic RPC sets the marker before it changes the active pointer', () => {
  const sql = fs.readFileSync(path.resolve('supabase', 'migrations', '20260823204917_add_syllabus_foundation.sql'), 'utf8')
  const rpcStart = sql.indexOf('create or replace function public.commit_syllabus_revision_activation(')
  const rpcEnd = sql.indexOf('revoke all on function public.commit_syllabus_revision_activation', rpcStart)
  const rpc = sql.slice(rpcStart, rpcEnd)

  const markerIndex = rpc.indexOf("set_config('app.syllabus_activation_commit', 'on', true)")
  const pointerIndex = rpc.indexOf('set active_revision_id = p_revision_id')
  assert.ok(markerIndex > 0)
  assert.ok(pointerIndex > markerIndex)
})

test('authenticated has read-only Syllabus tables and commit execution remains service-role-only', () => {
  const sql = fs.readFileSync(path.resolve('supabase', 'migrations', '20260823204917_add_syllabus_foundation.sql'), 'utf8')

  assert.match(sql, /revoke all on table\s+public\.syllabi,\s+public\.syllabus_revisions,\s+public\.syllabus_forecast_items\s+from anon,\s*authenticated/i)
  assert.match(sql, /grant select on table\s+public\.syllabi,\s+public\.syllabus_revisions,\s+public\.syllabus_forecast_items\s+to authenticated/i)
  assert.doesNotMatch(sql, /grant\s+(?:[^;]*\b(?:insert|update|delete)\b[^;]*)\s+on table[^;]*to authenticated/i)

  assert.match(sql, /revoke all on function public\.commit_syllabus_revision_activation\(uuid, uuid, uuid\)\s+from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.commit_syllabus_revision_activation\(uuid, uuid, uuid\)\s+to service_role/i)
  assert.doesNotMatch(sql, /grant execute on function public\.commit_syllabus_revision_activation\([^;]+to (?:public|anon|authenticated)/i)
})

test('the conservative subject editor does not offer free-form replacement or future activation dates', () => {
  const source = fs.readFileSync(path.resolve('src', 'app', 'facilitator', 'syllabus', 'page.js'), 'utf8')
  assert.doesNotMatch(source, /type="date"/)
  assert.match(source, /Effective today/)
  assert.match(source, /disabled=\{referenced\}/)
  assert.match(source, /referencedSubjects\.has/)
})
