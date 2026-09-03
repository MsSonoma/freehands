import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { buildLegacySeed } from '../legacySeed.server.mjs'
import { activateProposedSyllabus, activateSyllabus, establishSyllabusFromLegacyPlan, getActiveSyllabus } from '../revisions.server.mjs'
import { isCalendarDate, validateSnapshot } from '../schema.mjs'
import {
  applyTeachingGuidanceOverride,
  teachingGuidanceOverrideFrom,
  TEACHING_GUIDANCE_FIELDS,
  updateTeachingGuidanceList,
} from '../teachingGuidance.mjs'
import { GET as getSyllabusRoute } from '../../../api/syllabus/route.js'
import { POST as activateSyllabusRoute } from '../../../api/syllabus/activate/route.js'

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
        scheduleTemplates: [{ id: 'template-1', active: true, pattern: { monday: [{ subject: 'math' }], tuesday: [{ subject: 'science' }] } }],
        curriculumPreferences: {
          id: 'prefs-1',
          banned_words: ['spoiler'],
          focus_topics: ['fractions'],
          legacy_source_mode: 'preserve-me',
          subject_preferences: { math: { focusTopics: ['ratios'], legacySubjectMode: 'preserve-me-too' } },
        },
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
  assert.deepEqual(seed.teaching_guidance.curriculum_preferences.subject_preferences, { math: { focusTopics: ['ratios'], legacySubjectMode: 'preserve-me-too' } })
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

test('Free establishment uses the canonical legacy seed and rejects arbitrary authored activation', async () => {
  const repository = memoryRepository()
  await assert.rejects(
    activateSyllabus({
      repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot('Injected future intent'), now: NOW, allowFutureIntentChanges: false,
    }),
    (error) => error?.status === 403 && error?.code === 'SYLLABUS_PLANNING_REQUIRED',
  )
  assert.equal(repository.state.writes, 0)

  const first = await establishSyllabusFromLegacyPlan({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, now: NOW })
  assert.equal(first.active_revision.revision_number, 1)
  assert.equal(first.active_revision.goals.legacy_notes, 'Read more.')
  assert.deepEqual(first.forecast_items.map((item) => item.title), ['Future lesson'])
  assert.equal(first.forecast_items[0].origin, 'legacy_import')
  const writesAfterEstablishment = repository.state.writes
  await assert.rejects(
    establishSyllabusFromLegacyPlan({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, now: NOW }),
    (error) => error?.status === 403 && error?.code === 'SYLLABUS_PLANNING_REQUIRED',
  )
  assert.equal(repository.state.writes, writesAfterEstablishment)
  assert.equal(repository.state.revisions.length, 1)
})

test('activation route rebuilds Free establishment server-side and preserves paid authored activation', async () => {
  const freeRepository = memoryRepository()
  const canonicalSeed = await buildLegacySeed({ repository: freeRepository, facilitatorId: FACILITATOR, learnerId: LEARNER, now: NOW })
  const injected = snapshot('Injected future intent')
  injected.goals.legacy_notes = 'Injected goals'
  const rejectedAuthoredResponse = await activateSyllabusRoute(
    new Request('http://localhost/api/syllabus/activate', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId: LEARNER, snapshot: injected }),
    }),
    {
      requestContext: { user: { id: FACILITATOR }, admin: {} },
      repository: freeRepository,
      syllabusAccess: { can_change_intent: false },
      now: NOW,
    },
  )
  assert.equal(rejectedAuthoredResponse.status, 403)
  assert.equal(freeRepository.state.writes, 0)

  const freeResponse = await activateSyllabusRoute(
    new Request('http://localhost/api/syllabus/activate', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learnerId: LEARNER,
        establishFromCurrentPlan: true,
        snapshot: injected,
        teachingGuidanceOverride: {
          curriculum_preferences: {
            focus_topics: ['geometry'],
            banned_words: [],
            subject_preferences: {
              math: { focusTopics: [], bannedConcepts: ['unsupported shortcut'] },
            },
          },
        },
      }),
    }),
    {
      requestContext: { user: { id: FACILITATOR }, admin: {} },
      repository: freeRepository,
      syllabusAccess: { can_change_intent: false },
      now: NOW,
    },
  )
  assert.equal(freeResponse.status, 201)
  const freeResult = await freeResponse.json()
  assert.equal(freeResult.active_revision.goals.legacy_notes, 'Read more.')
  assert.deepEqual(freeResult.active_revision.subjects, canonicalSeed.subjects)
  assert.deepEqual(freeResult.active_revision.weekly_pattern, canonicalSeed.weekly_pattern)
  assert.deepEqual(freeResult.active_revision.planning_policy, canonicalSeed.planning_policy)
  assert.deepEqual(freeResult.active_revision.legacy_provenance, canonicalSeed.legacy_provenance)
  assert.equal(freeResult.active_revision.effective_from, canonicalSeed.effective_from)
  assert.deepEqual(freeResult.forecast_items.map((item) => item.title), ['Future lesson'])
  assert.deepEqual(freeResult.forecast_items.map((item) => item.lineage_id), canonicalSeed.forecast_items.map((item) => item.lineage_id))
  assert.equal(freeResult.forecast_items.some((item) => item.title === 'Injected future intent'), false)
  const preferences = freeResult.active_revision.teaching_guidance.curriculum_preferences
  assert.deepEqual(preferences.focus_topics, ['geometry'])
  assert.deepEqual(preferences.banned_words, [])
  assert.equal(preferences.legacy_source_mode, 'preserve-me')
  assert.deepEqual(preferences.subject_preferences.math.focusTopics, [])
  assert.deepEqual(preferences.subject_preferences.math.bannedConcepts, ['unsupported shortcut'])
  assert.equal(preferences.subject_preferences.math.legacySubjectMode, 'preserve-me-too')

  const secondFreeResponse = await activateSyllabusRoute(
    new Request('http://localhost/api/syllabus/activate', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId: LEARNER, establishFromCurrentPlan: true }),
    }),
    {
      requestContext: { user: { id: FACILITATOR }, admin: {} },
      repository: freeRepository,
      syllabusAccess: { can_change_intent: false },
      now: NOW,
    },
  )
  assert.equal(secondFreeResponse.status, 403)
  assert.equal(freeRepository.state.revisions.length, 1)

  const paidRepository = memoryRepository()
  const paidResponse = await activateSyllabusRoute(
    new Request('http://localhost/api/syllabus/activate', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId: LEARNER, snapshot: injected }),
    }),
    {
      requestContext: { user: { id: FACILITATOR }, admin: {} },
      repository: paidRepository,
      syllabusAccess: { can_change_intent: true },
      now: NOW,
    },
  )
  assert.equal(paidResponse.status, 201)
  assert.equal((await paidResponse.json()).forecast_items[0].title, 'Injected future intent')
})

test('Teaching Guidance override rejects future-intent smuggling and invalid payloads before writes', async () => {
  const invalidOverrides = [
    { curriculum_preferences: { focus_topics: [], forecast_items: [{ title: 'smuggled' }] } },
    { curriculum_preferences: { focus_topics: [], weekly_pattern: { monday: [] } } },
    { curriculum_preferences: { focus_topics: [], subjects: [{ name: 'smuggled' }] } },
    { curriculum_preferences: { focus_topics: 'not-an-array' } },
  ]
  for (const teachingGuidanceOverride of invalidOverrides) {
    const repository = memoryRepository()
    const response = await activateSyllabusRoute(
      new Request('http://localhost/api/syllabus/activate', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId: LEARNER, establishFromCurrentPlan: true, teachingGuidanceOverride }),
      }),
      {
        requestContext: { user: { id: FACILITATOR }, admin: {} },
        repository,
        syllabusAccess: { can_change_intent: false },
        now: NOW,
      },
    )
    assert.equal(response.status, 400)
    assert.equal(repository.state.writes, 0)
    assert.equal(repository.state.revisions.length, 0)
  }
})

test('Teaching Guidance helpers edit known fields, preserve unknown fields, and support empty arrays', () => {
  const initial = {
    curriculum_preferences: {
      id: 'prefs-1',
      focus_topics: ['fractions'],
      unknownGlobal: { preserve: true },
      subject_preferences: { math: { focusTopics: ['ratios'], unknownSubject: 'preserve' } },
    },
  }
  const field = TEACHING_GUIDANCE_FIELDS.find((item) => item.subjectKey === 'focusTopics')
  const edited = updateTeachingGuidanceList(initial, { field, subject: 'math', values: [] })
  assert.deepEqual(edited.curriculum_preferences.subject_preferences.math.focusTopics, [])
  assert.deepEqual(initial.curriculum_preferences.subject_preferences.math.focusTopics, ['ratios'])
  const override = teachingGuidanceOverrideFrom(edited)
  const applied = applyTeachingGuidanceOverride(initial, override)
  assert.deepEqual(applied.curriculum_preferences.subject_preferences.math.focusTopics, [])
  assert.equal(applied.curriculum_preferences.subject_preferences.math.unknownSubject, 'preserve')
  assert.deepEqual(applied.curriculum_preferences.unknownGlobal, { preserve: true })
})

test('activation route keeps authentication and learner ownership protections', async () => {
  const unauthorized = await activateSyllabusRoute(new Request('http://localhost/api/syllabus/activate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ learnerId: LEARNER }),
  }))
  assert.equal(unauthorized.status, 401)

  const repository = memoryRepository()
  const forbidden = await activateSyllabusRoute(
    new Request('http://localhost/api/syllabus/activate', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId: LEARNER, establishFromCurrentPlan: true }),
    }),
    {
      requestContext: { user: { id: OTHER }, admin: {} },
      repository,
      syllabusAccess: { can_change_intent: false },
      now: NOW,
    },
  )
  assert.equal(forbidden.status, 403)
  assert.equal(repository.state.writes, 0)
})

test('manual activation counts existing Calendar occupancy and a valid PIN authorizes only that activation', async () => {
  const repository = memoryRepository()
  repository.listLessonSchedule = async () => [{ id: 'calendar-1', lesson_key: 'math/calendar.json', subject: 'math', scheduled_date: '2026-08-24' }]
  repository.listLessonAssociations = async () => []
  const deps = {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository,
    syllabusAccess: { can_change_intent: true },
    now: NOW,
    verifyFacilitatorPinForUser: async (_admin, _user, pin) => pin === '2468',
  }
  const makeRequest = (exceptionPin) => new Request('http://localhost/api/syllabus/activate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ learnerId: LEARNER, snapshot: snapshot(), ...(exceptionPin ? { exceptionPin } : {}) }),
  })
  const blocked = await activateSyllabusRoute(makeRequest(), deps)
  assert.equal(blocked.status, 409)
  assert.equal((await blocked.json()).code, 'SYLLABUS_CAPACITY_PIN_REQUIRED')
  const allowed = await activateSyllabusRoute(makeRequest('2468'), deps)
  assert.equal(allowed.status, 201)
  assert.deepEqual((await allowed.json()).active_revision.weekly_pattern, { monday: [{ subject: 'math' }] })
})

test('retired mastery proposals cannot be activated through the generic proposal endpoint', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const proposal = {
    ...structuredClone(active.active_revision),
    id: 'mastery-capacity-proposal',
    revision_number: 2,
    base_revision_id: active.active_revision.id,
    proposal_kind: 'mastery_reforecast',
    effective_from: '2026-08-23',
    activated_at: null,
  }
  repository.state.revisions.push(proposal)
  repository.state.forecast.push({ ...snapshot().forecast_items[0], id: 'proposal-forecast', revision_id: proposal.id })
  await assert.rejects(
    activateProposedSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, proposalRevisionId: proposal.id, expectedActiveRevisionId: active.active_revision.id, now: NOW }),
    (error) => error?.code === 'PROPOSAL_KIND_RETIRED',
  )
  assert.equal(repository.state.syllabi[0].active_revision_id, active.active_revision.id)
})

test('initial establishment cannot silently activate an over-capacity canonical seed', async () => {
  const repository = memoryRepository()
  repository.readLegacyPlanning = async () => ({
    scheduleTemplates: [{ id: 'one-slot', active: true, pattern: { monday: [{ subject: 'math' }] } }],
    curriculumPreferences: null,
    plannedLessons: [
      { id: 'one', scheduled_date: '2026-08-24', lesson_data: { title: 'One', subject: 'math' } },
      { id: 'two', scheduled_date: '2026-08-24', lesson_data: { title: 'Two', subject: 'math' } },
    ],
    customSubjects: [],
  })
  await assert.rejects(
    establishSyllabusFromLegacyPlan({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, now: NOW }),
    (error) => error?.code === 'SYLLABUS_CAPACITY_PIN_REQUIRED',
  )
  assert.equal(repository.state.writes, 0)
  const allowed = await establishSyllabusFromLegacyPlan({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, now: NOW, allowCapacityException: true })
  assert.equal(allowed.active_revision.revision_number, 1)
})

test('Free establishment fails explicitly when the legacy plan cannot be read safely', async () => {
  const repository = memoryRepository()
  repository.readLegacyPlanning = async () => { throw new Error('legacy storage unavailable') }
  await assert.rejects(
    establishSyllabusFromLegacyPlan({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, now: NOW }),
    (error) => error?.status === 500 && error?.code === 'LEGACY_SEED_UNAVAILABLE' && /could not be read safely/.test(error.message),
  )
  assert.equal(repository.state.writes, 0)
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
  const second = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: secondSnapshot, now: NOW, allowCapacityException: true })
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

test('current application surfaces expose no mastery-reforecast creation or presentation path', () => {
  const root = process.cwd()
  assert.equal(fs.existsSync(path.join(root, 'src/app/api/syllabus/reforecast/route.js')), false)
  assert.equal(fs.existsSync(path.join(root, 'src/app/lib/syllabus/proposals.server.mjs')), false)
  assert.equal(fs.existsSync(path.join(root, 'src/app/lib/syllabus/reforecast.mjs')), false)

  const facilitatorPage = fs.readFileSync(path.join(root, 'src/app/facilitator/syllabus/page.js'), 'utf8')
  const documentSource = fs.readFileSync(path.join(root, 'src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
  const revisionsSource = fs.readFileSync(path.join(root, 'src/app/lib/syllabus/revisions.server.mjs'), 'utf8')
  const repositorySource = fs.readFileSync(path.join(root, 'src/app/lib/syllabus/supabaseRepository.server.mjs'), 'utf8')
  for (const currentSource of [facilitatorPage, documentSource, revisionsSource, repositorySource]) {
    assert.doesNotMatch(currentSource, /api\/syllabus\/reforecast|createMasteryReforecastProposal|buildMasteryReforecast|proposed_reforecast|findLatestMasteryProposal|replaceMasteryProposal/)
  }
  assert.doesNotMatch(facilitatorPage, /Check mastery evidence|Activate proposed reforecast|masteryProposal/)
  assert.doesNotMatch(documentSource, /proposedReforecast|Mastery proposals for general review|Mastery note/)
  assert.match(revisionsSource, /proposal\.proposal_kind !== 'learning_forecast'/)
  assert.match(revisionsSource, /PROPOSAL_KIND_RETIRED/)
})

test('snapshot validation reserves mastery-reforecast origin for server-owned legacy compatibility', () => {
  const legacy = snapshot('Historical review')
  legacy.forecast_items[0].origin = 'mastery_reforecast'
  legacy.forecast_items[0].item_type = 'review'
  legacy.forecast_items[0].metadata = { mastery_reforecast: { source: 'legacy' } }
  assert.throws(() => validateSnapshot(legacy, { today: '2026-08-23' }), /origin is invalid/)
  const readable = validateSnapshot(legacy, { today: '2026-08-23', allowLegacyOrigins: true })
  assert.equal(readable.forecast_items[0].origin, 'mastery_reforecast')
})

test('historical mastery proposal database machinery remains inert and service-role-only', () => {
  const sql = fs.readFileSync(path.resolve('supabase', 'migrations', '20260824081735_harden_syllabus_mastery_proposals.sql'), 'utf8')
  assert.match(sql, /replace_syllabus_mastery_proposal/i)
  assert.match(sql, /revoke all on function public\.replace_syllabus_mastery_proposal[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.replace_syllabus_mastery_proposal[\s\S]*to service_role/i)
  const repositorySource = fs.readFileSync(path.resolve('src', 'app', 'lib', 'syllabus', 'supabaseRepository.server.mjs'), 'utf8')
  assert.doesNotMatch(repositorySource, /replace_syllabus_mastery_proposal|replaceMasteryProposal/)
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

test('the conservative subject editor keeps activation effective today while Slate scheduling has its own explicit date', () => {
  const source = fs.readFileSync(path.resolve('src', 'app', 'facilitator', 'syllabus', 'page.js'), 'utf8')
  assert.match(source, /Schedule Mr\. Slate/)
  assert.match(source, /type="date"/)
  assert.match(source, /scheduledDate/)
  assert.match(source, /Effective today/)
  assert.match(source, /disabled=\{referenced\}/)
  assert.match(source, /referencedSubjects\.has/)
})

test('Syllabus Teaching Guidance uses connected human-readable controls instead of raw subject JSON', () => {
  const source = fs.readFileSync(path.resolve('src', 'app', 'facilitator', 'syllabus', 'page.js'), 'utf8')
  assert.doesNotMatch(source, /JSON\.stringify\(preferences\.subject_preferences/)
  assert.match(source, /teaching_guidance: updateTeachingGuidanceList\(current\.teaching_guidance/)
  assert.match(source, /teachingGuidanceOverride: teachingGuidanceOverrideFrom\(normalizedGuidance\)/)
  assert.match(source, /<GuidanceListEditor/)
  assert.deepEqual(TEACHING_GUIDANCE_FIELDS.map((field) => field.label), [
    'Focus topics', 'Focus concepts', 'Focus keywords', 'Avoid topics', 'Avoid concepts', 'Avoid words',
  ])
})

test('future Syllabus mutations enforce the canonical entitlement on the server routes', () => {
  const activationRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/syllabus/activate/route.js'), 'utf8')
  const forecastRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/syllabus/forecast/route.js'), 'utf8')
  const revisionsService = fs.readFileSync(path.join(process.cwd(), 'src/app/lib/syllabus/revisions.server.mjs'), 'utf8')
  assert.match(activationRoute, /loadSyllabusAccess/)
  assert.match(activationRoute, /requireSyllabusFuturePlanning\(access\)/)
  assert.match(activationRoute, /establishFromCurrentPlan/)
  assert.match(activationRoute, /establishSyllabusFromLegacyPlan/)
  assert.match(activationRoute, /teachingGuidanceOverride: body\?\.teachingGuidanceOverride/)
  assert.match(forecastRoute, /loadSyllabusAccess/)
  assert.match(forecastRoute, /requireSyllabusFuturePlanning\(access\)/)
  assert.match(revisionsService, /buildLegacySeed/)
  assert.match(revisionsService, /if \(!allowFutureIntentChanges\)/)
  assert.match(revisionsService, /requireNoActiveRevision && syllabus\.active_revision_id/)
})
