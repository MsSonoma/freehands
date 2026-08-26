import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { buildLegacySeed } from '../legacySeed.server.mjs'
import { createMasteryReforecastProposal } from '../proposals.server.mjs'
import { buildMasteryReforecast } from '../reforecast.mjs'
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

function masteryReport(kind, {
  subject = 'math',
  lessonKey = 'math/fractions.json',
  sessionId = `session-${kind}`,
} = {}) {
  const findings = {
    consider_review: { section: 'retention', state: 'needs_review', label: 'Review recommended after 1 week' },
    consider_future_independent_check: { section: 'independent_evidence', state: 'assisted_success', label: 'Correct with assistance' },
    consider_review_then_check: { section: 'independent_evidence', state: 'needs_recovery', label: 'Independent demonstration not yet established' },
    continue_normally: { section: 'retention', state: 'not_measured', label: 'Retention not yet measured' },
  }
  const finding = findings[kind]
  const report = {
    report_version: 'facilitator-evidence-v1',
    session: { id: sessionId, started_at: '2026-08-22T14:00:00.000Z' },
    lesson: { key: lessonKey, subject, title: 'Fractions' },
    target: { scope: 'concept', concept_id: 'concept:fractions' },
    independent_evidence: { state: 'independent_success', label: 'Demonstrated independently' },
    retention: { state: 'not_measured', label: 'Retention not yet measured' },
    options: [{ kind, evidence_kind: 'proposed', label: {
      consider_review: 'Consider a review session.',
      consider_future_independent_check: 'Consider another independent check in a future session.',
      consider_review_then_check: 'Consider more review followed by a fresh independent check.',
      continue_normally: 'Continue normally; retention has not yet been measured.',
    }[kind] }],
    provenance: { evidence_session_id: `evidence-${kind}` },
  }
  report[finding.section] = { state: finding.state, label: finding.label }
  return report
}

function multiSubjectSnapshot() {
  const input = snapshot('Fractions A', '2026-08-24')
  input.subjects = [{ name: 'math' }, { name: 'science' }]
  input.weekly_pattern = {
    monday: [{ subject: 'math' }],
    tuesday: [{ subject: 'science' }],
  }
  input.forecast_items = [
    input.forecast_items[0],
    { ...input.forecast_items[0], lineage_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', planned_date: '2026-08-25', subject: 'science', title: 'Cells', lesson_key: 'science/cells.json' },
    { ...input.forecast_items[0], lineage_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', planned_date: '2026-08-31', title: 'Fractions B' },
    { ...input.forecast_items[0], lineage_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', planned_date: '2026-09-07', title: 'Fractions C' },
  ]
  return input
}

function memoryRepository() {
  const state = {
    learners: [{ id: LEARNER, facilitator_id: FACILITATOR, name: 'Avery', goals_notes: 'Read more.' }],
    syllabi: [], revisions: [], forecast: [], writes: 0,
  }
  let id = 0
  let proposalQueue = Promise.resolve()
  const clone = (value) => structuredClone(value)
  const repository = {
    state,
    beforeCommit: null,
    beforeMasteryReplace: null,
    async findOwnedLearner(learnerId, facilitatorId) { return clone(state.learners.find((row) => row.id === learnerId && row.facilitator_id === facilitatorId) || null) },
    async findSyllabus(facilitatorId, learnerId) { return clone(state.syllabi.find((row) => row.facilitator_id === facilitatorId && row.learner_id === learnerId) || null) },
    async createOrFindSyllabus(facilitatorId, learnerId) {
      state.writes++
      const row = { id: `syllabus-${++id}`, facilitator_id: facilitatorId, learner_id: learnerId, active_revision_id: null }
      state.syllabi.push(row); return clone(row)
    },
    async findRevision(revisionId, syllabusId) { return clone(state.revisions.find((row) => row.id === revisionId && row.syllabus_id === syllabusId) || null) },
    async findLatestMasteryProposal(syllabusId, baseRevisionId) {
      return clone(state.revisions.filter((row) => row.syllabus_id === syllabusId
        && row.base_revision_id === baseRevisionId
        && !row.activated_at
        && row.proposal_kind === 'mastery_reforecast')
        .sort((a, b) => b.revision_number - a.revision_number)[0] || null)
    },
    async replaceMasteryProposal({ syllabusId, expectedActiveRevisionId, planning, proposalKey }) {
      let release
      const prior = proposalQueue
      proposalQueue = new Promise((resolve) => { release = resolve })
      await prior
      try {
        if (repository.beforeMasteryReplace) await repository.beforeMasteryReplace()
        const syllabus = state.syllabi.find((row) => row.id === syllabusId)
        if (!syllabus || syllabus.active_revision_id !== expectedActiveRevisionId) {
          const error = new Error('Syllabus active revision changed')
          error.code = '40001'
          throw error
        }
        const existing = state.revisions.find((row) => row.syllabus_id === syllabusId
          && row.base_revision_id === expectedActiveRevisionId
          && !row.activated_at
          && row.proposal_kind === 'mastery_reforecast')
        if (existing?.proposal_key === proposalKey && existing.effective_from === planning.effective_from) {
          return { revision: clone(existing), reused: true }
        }
        if (existing) {
          state.writes++
          state.revisions = state.revisions.filter((row) => row.id !== existing.id)
          state.forecast = state.forecast.filter((row) => row.revision_id !== existing.id)
        }
        state.writes++
        const revision = {
          id: `revision-${++id}`,
          syllabus_id: syllabusId,
          revision_number: Math.max(0, ...state.revisions.filter((row) => row.syllabus_id === syllabusId).map((row) => row.revision_number)) + 1,
          base_revision_id: expectedActiveRevisionId,
          effective_from: planning.effective_from,
          schema_version: planning.schema_version,
          goals: clone(planning.goals),
          subjects: clone(planning.subjects),
          weekly_pattern: clone(planning.weekly_pattern),
          teaching_guidance: clone(planning.teaching_guidance),
          planning_policy: clone(planning.planning_policy),
          legacy_provenance: clone(planning.legacy_provenance),
          change_reason: planning.change_reason,
          proposal_kind: 'mastery_reforecast',
          proposal_key: proposalKey,
          activated_at: null,
        }
        state.revisions.push(revision)
        state.writes++
        state.forecast.push(...planning.forecast_items.map((item) => ({
          ...clone(item), id: `forecast-${++id}`, revision_id: revision.id,
        })))
        return { revision: clone(revision), reused: false }
      } finally {
        release()
      }
    },
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

test('a reporting review recommendation creates an inactive proposal without changing active history', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const activeRevisionBefore = structuredClone(repository.state.revisions[0])
  const activeForecastBefore = structuredClone(repository.state.forecast.filter((item) => item.revision_id === active.active_revision.id))

  const result = await createMasteryReforecastProposal({
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    expectedActiveRevisionId: active.active_revision.id,
    reports: [masteryReport('consider_review')],
    now: NOW,
  })

  assert.equal(result.kind, 'proposal')
  assert.equal(result.proposal_revision.revision_number, 2)
  assert.equal(result.proposal_revision.base_revision_id, active.active_revision.id)
  assert.equal(result.proposal_revision.activated_at, null)
  assert.equal(repository.state.syllabi[0].active_revision_id, active.active_revision.id)
  assert.deepEqual(repository.state.revisions[0], activeRevisionBefore)
  assert.deepEqual(repository.state.forecast.filter((item) => item.revision_id === active.active_revision.id), activeForecastBefore)
  assert.equal(result.changes[0].item_type, 'review')
  assert.equal(result.changes[0].recommendation.kind, 'consider_review')
  assert.equal(result.changes[0].finding.state, 'needs_review')
})

test('review occupies the next subject slot and ripples only that subject forward', () => {
  const input = multiSubjectSnapshot()
  const scienceBefore = structuredClone(input.forecast_items.filter((item) => item.subject === 'science'))
  const result = buildMasteryReforecast({ activeRevision: { id: 'active-1', ...input }, forecastItems: input.forecast_items, reports: [masteryReport('consider_review')], today: '2026-08-23' })
  const math = result.snapshot.forecast_items.filter((item) => item.subject === 'math')
  assert.deepEqual(math.map((item) => item.item_type), ['review', 'lesson', 'lesson', 'lesson'])
  assert.deepEqual(math.map((item) => item.planned_date), ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14'])
  assert.deepEqual(math.slice(1).map((item) => item.lineage_id), [
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  ])
  assert.deepEqual(result.snapshot.forecast_items.filter((item) => item.subject === 'science'), scienceBefore)
})

test('independent check occupies a future subject slot before prior instruction', () => {
  const input = multiSubjectSnapshot()
  const result = buildMasteryReforecast({ activeRevision: { id: 'active-1', ...input }, forecastItems: input.forecast_items, reports: [masteryReport('consider_future_independent_check')], today: '2026-08-23' })
  const math = result.snapshot.forecast_items.filter((item) => item.subject === 'math')
  assert.deepEqual(math.map((item) => item.item_type), ['check', 'lesson', 'lesson', 'lesson'])
  assert.deepEqual(math.map((item) => item.planned_date), ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14'])
  assert.notEqual(math[0].planned_date, math[1].planned_date)
})

test('review then check consume sequential weekly slots before the intact prior sequence', () => {
  const input = multiSubjectSnapshot()
  const result = buildMasteryReforecast({ activeRevision: { id: 'active-1', ...input }, forecastItems: input.forecast_items, reports: [masteryReport('consider_review_then_check')], today: '2026-08-23' })
  const math = result.snapshot.forecast_items.filter((item) => item.subject === 'math')
  assert.deepEqual(math.map((item) => item.item_type), ['review', 'check', 'lesson', 'lesson', 'lesson'])
  assert.deepEqual(math.map((item) => item.planned_date), ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'])
  assert.deepEqual(math.slice(2).map((item) => item.title), ['Fractions A', 'Fractions B', 'Fractions C'])
  assert.deepEqual(math.slice(2).map((item) => item.lineage_id), [
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  ])
})

test('no approved future subject slot returns an explicit conservative no-action result', () => {
  const input = snapshot()
  input.weekly_pattern = {}
  const result = buildMasteryReforecast({ activeRevision: { id: 'active-1', ...input }, forecastItems: input.forecast_items, reports: [masteryReport('consider_review_then_check')], today: '2026-08-23' })
  assert.equal(result.kind, 'no_action')
  assert.match(result.reason, /weekly pattern does not provide enough future math slots/i)
})

test('unsafe slot projection performs no proposal writes and returns the reason to the facilitator', async () => {
  const repository = memoryRepository()
  const input = snapshot()
  input.weekly_pattern = {}
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: input, now: NOW })
  const writesBefore = repository.state.writes
  const result = await createMasteryReforecastProposal({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: active.active_revision.id, reports: [masteryReport('consider_review_then_check')], now: NOW })
  assert.equal(result.kind, 'no_action')
  assert.match(result.message, /weekly pattern does not provide enough future math slots/i)
  assert.equal(repository.state.writes, writesBefore)
})

test('no actionable reporting option creates no proposal or write churn', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const writesBefore = repository.state.writes
  const revisionsBefore = structuredClone(repository.state.revisions)

  const result = await createMasteryReforecastProposal({
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    expectedActiveRevisionId: active.active_revision.id,
    reports: [masteryReport('continue_normally')],
    now: NOW,
  })

  assert.equal(result.kind, 'no_action')
  assert.equal(repository.state.writes, writesBefore)
  assert.deepEqual(repository.state.revisions, revisionsBefore)
})

test('two concurrent identical mastery checks converge on one inactive proposal', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const args = {
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    expectedActiveRevisionId: active.active_revision.id,
    reports: [masteryReport('consider_review')],
    now: NOW,
  }
  const [first, second] = await Promise.all([
    createMasteryReforecastProposal(args),
    createMasteryReforecastProposal(args),
  ])
  assert.equal(first.proposal_revision.id, second.proposal_revision.id)
  assert.equal([first.reused, second.reused].filter(Boolean).length, 1)
  assert.equal(repository.state.revisions.length, 2)
  assert.equal(repository.state.revisions.filter((row) => !row.activated_at && row.proposal_kind === 'mastery_reforecast').length, 1)
  assert.equal(repository.state.syllabi[0].active_revision_id, active.active_revision.id)
})

test('unrelated subject evidence leaves the forecast stable and creates no proposal', () => {
  const input = snapshot()
  const result = buildMasteryReforecast({
    activeRevision: { id: 'active-1', ...input },
    forecastItems: input.forecast_items,
    reports: [masteryReport('consider_review', { subject: 'science', lessonKey: 'science/cells.json' })],
    today: '2026-08-23',
  })
  assert.equal(result, null)
})

test('reforecasting preserves educator-owned sections, unaffected lineages, and past history', () => {
  const input = snapshot('Past Fractions', '2026-08-24')
  input.forecast_items.push({
    ...input.forecast_items[0],
    lineage_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    planned_date: '2026-08-27',
    title: 'Future Fractions',
    sort_order: 1,
  })
  const original = structuredClone(input.forecast_items)
  const result = buildMasteryReforecast({
    activeRevision: { id: 'active-1', ...input },
    forecastItems: input.forecast_items,
    reports: [masteryReport('consider_review')],
    today: '2026-08-26',
  })

  assert.deepEqual(input.forecast_items, original)
  assert.equal(result.snapshot.forecast_items.some((item) => item.planned_date < '2026-08-26'), false)
  assert.equal(result.snapshot.forecast_items.some((item) => item.lineage_id === 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), true)
  for (const field of ['goals', 'subjects', 'weekly_pattern', 'teaching_guidance', 'planning_policy', 'legacy_provenance']) {
    assert.deepEqual(result.snapshot[field], input[field])
  }
})

test('proposal creation rejects unauthorized and stale active pointers', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  await assert.rejects(
    createMasteryReforecastProposal({ repository, facilitatorId: OTHER, learnerId: LEARNER, expectedActiveRevisionId: active.active_revision.id, reports: [masteryReport('consider_review')], now: NOW }),
    (error) => error.status === 403,
  )
  await assert.rejects(
    createMasteryReforecastProposal({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: 'stale-revision', reports: [masteryReport('consider_review')], now: NOW }),
    (error) => error.status === 409 && error.code === 'REFORECAST_CONFLICT',
  )
})

test('a mastery proposal activates only through the explicit activation operation', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const proposal = await createMasteryReforecastProposal({
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    expectedActiveRevisionId: active.active_revision.id,
    reports: [masteryReport('consider_review_then_check')],
    now: NOW,
  })
  assert.equal(repository.state.syllabi[0].active_revision_id, active.active_revision.id)

  const activated = await activateProposedSyllabus({
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id,
    expectedActiveRevisionId: active.active_revision.id,
    now: NOW,
  })
  assert.equal(repository.state.syllabi[0].active_revision_id, proposal.proposal_revision.id)
  assert.ok(activated.active_revision.activated_at)
  assert.equal(activated.forecast_items.filter((item) => item.origin === 'mastery_reforecast').length, 2)
})

test('an earlier-date proposal cannot be activated as a stale current forecast', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const proposal = await createMasteryReforecastProposal({
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    expectedActiveRevisionId: active.active_revision.id,
    reports: [masteryReport('consider_review')],
    now: NOW,
  })
  await assert.rejects(
    activateProposedSyllabus({
      repository,
      facilitatorId: FACILITATOR,
      learnerId: LEARNER,
      proposalRevisionId: proposal.proposal_revision.id,
      expectedActiveRevisionId: active.active_revision.id,
      now: new Date('2026-08-24T14:00:00.000Z'),
    }),
    (error) => error.status === 409 && error.code === 'PROPOSAL_STALE',
  )
  assert.equal(repository.state.syllabi[0].active_revision_id, active.active_revision.id)
})

test('concurrent different mastery checks leave one canonical proposal and reject the superseded sibling', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const base = { repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: active.active_revision.id, now: NOW }
  const [review, check] = await Promise.all([
    createMasteryReforecastProposal({ ...base, reports: [masteryReport('consider_review')] }),
    createMasteryReforecastProposal({ ...base, reports: [masteryReport('consider_future_independent_check')] }),
  ])
  const canonical = repository.state.revisions.find((row) => !row.activated_at && row.proposal_kind === 'mastery_reforecast')
  assert.ok(canonical)
  assert.equal(repository.state.revisions.filter((row) => !row.activated_at && row.proposal_kind === 'mastery_reforecast').length, 1)
  assert.equal(repository.state.syllabi[0].active_revision_id, active.active_revision.id)
  const superseded = [review, check].find((result) => result.proposal_revision.id !== canonical.id)
  assert.ok(superseded)
  await assert.rejects(
    activateProposedSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, proposalRevisionId: superseded.proposal_revision.id, expectedActiveRevisionId: active.active_revision.id, now: NOW }),
    (error) => error.status === 409 && ['PROPOSAL_STALE', 'PROPOSAL_SUPERSEDED'].includes(error.code),
  )
  const activated = await activateProposedSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, proposalRevisionId: canonical.id, expectedActiveRevisionId: active.active_revision.id, now: NOW })
  assert.equal(activated.active_revision.id, canonical.id)
})

test('concurrent active-pointer change rejects mastery persistence without leaving an inactive proposal', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  const competitor = { ...structuredClone(repository.state.revisions[0]), id: 'mastery-competitor', revision_number: 2, base_revision_id: active.active_revision.id, activated_at: NOW.toISOString() }
  repository.state.revisions.push(competitor)
  repository.beforeMasteryReplace = async () => {
    repository.state.syllabi[0].active_revision_id = competitor.id
    repository.beforeMasteryReplace = null
  }
  await assert.rejects(
    createMasteryReforecastProposal({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: active.active_revision.id, reports: [masteryReport('consider_review')], now: NOW }),
    (error) => error.status === 409 && error.code === 'REFORECAST_CONFLICT',
  )
  assert.equal(repository.state.revisions.some((row) => !row.activated_at && row.proposal_kind === 'mastery_reforecast'), false)
})

test('atomic mastery replacement preserves unrelated inactive proposal types and revision numbering', async () => {
  const repository = memoryRepository()
  const active = await activateSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, snapshot: snapshot(), now: NOW })
  repository.state.revisions.push({
    ...structuredClone(repository.state.revisions[0]),
    id: 'manual-proposal',
    revision_number: 2,
    base_revision_id: active.active_revision.id,
    activated_at: null,
    change_reason: 'Facilitator draft',
    proposal_kind: null,
    proposal_key: null,
  })
  const result = await createMasteryReforecastProposal({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: active.active_revision.id, reports: [masteryReport('consider_review')], now: NOW })
  assert.equal(result.proposal_revision.revision_number, 3)
  assert.ok(repository.state.revisions.some((row) => row.id === 'manual-proposal'))
})

test('new migration atomically enforces one canonical mastery proposal and hardens activation', () => {
  const sql = fs.readFileSync(path.resolve('supabase', 'migrations', '20260824081735_harden_syllabus_mastery_proposals.sql'), 'utf8')
  assert.match(sql, /add column if not exists proposal_kind text/i)
  assert.match(sql, /create unique index syllabus_revisions_one_mastery_proposal_per_base[\s\S]*where activated_at is null and proposal_kind = 'mastery_reforecast'/i)
  const replaceStart = sql.indexOf('create or replace function public.replace_syllabus_mastery_proposal(')
  const replaceEnd = sql.indexOf('revoke all on function public.replace_syllabus_mastery_proposal', replaceStart)
  const replacement = sql.slice(replaceStart, replaceEnd)
  assert.match(replacement, /security invoker/i)
  assert.match(replacement, /from public\.syllabi[\s\S]*for update/i)
  assert.match(replacement, /delete from public\.syllabus_revisions[\s\S]*insert into public\.syllabus_revisions[\s\S]*insert into public\.syllabus_forecast_items/i)
  assert.match(replacement, /exception when unique_violation/i)
  assert.match(sql, /revoke all on function public\.replace_syllabus_mastery_proposal[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.replace_syllabus_mastery_proposal[\s\S]*to service_role/i)
  const activationStart = sql.indexOf('create or replace function public.commit_syllabus_revision_activation(')
  const activation = sql.slice(activationStart)
  assert.match(activation, /proposal_kind is distinct from 'mastery_reforecast'/i)
  assert.match(activation, /Mastery reforecast proposal is superseded or non-canonical/i)
  const repositorySource = fs.readFileSync(path.resolve('src', 'app', 'lib', 'syllabus', 'supabaseRepository.server.mjs'), 'utf8')
  const proposalSource = fs.readFileSync(path.resolve('src', 'app', 'lib', 'syllabus', 'proposals.server.mjs'), 'utf8')
  assert.match(repositorySource, /rpc\('replace_syllabus_mastery_proposal'/)
  assert.doesNotMatch(proposalSource, /insertRevision|deleteInactiveRevision|nextRevisionNumber/)
})

test('the Syllabus mastery path consumes reporting options and has no medal threshold dependency', () => {
  const source = fs.readFileSync(path.resolve('src', 'app', 'lib', 'syllabus', 'reforecast.mjs'), 'utf8')
  assert.match(source, /report\?\.options/)
  assert.doesNotMatch(source, /learner_medals|best_percent|bestPercent|LOW_SCORE|HIGH_SCORE|medal/i)
  assert.doesNotMatch(source, /(?:<=|>=)\s*(?:65|70|80|85)/)
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
  const reforecastRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/syllabus/reforecast/route.js'), 'utf8')
  const revisionsService = fs.readFileSync(path.join(process.cwd(), 'src/app/lib/syllabus/revisions.server.mjs'), 'utf8')
  assert.match(activationRoute, /loadSyllabusAccess/)
  assert.match(activationRoute, /requireSyllabusFuturePlanning\(access\)/)
  assert.match(activationRoute, /establishFromCurrentPlan/)
  assert.match(activationRoute, /establishSyllabusFromLegacyPlan/)
  assert.match(activationRoute, /teachingGuidanceOverride: body\?\.teachingGuidanceOverride/)
  assert.match(reforecastRoute, /loadSyllabusAccess/)
  assert.match(reforecastRoute, /requireSyllabusFuturePlanning\(access\)/)
  assert.match(revisionsService, /buildLegacySeed/)
  assert.match(revisionsService, /if \(!allowFutureIntentChanges\)/)
  assert.match(revisionsService, /requireNoActiveRevision && syllabus\.active_revision_id/)
})
