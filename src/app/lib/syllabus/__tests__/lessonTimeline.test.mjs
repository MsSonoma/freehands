import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { lessonKeyBasename, normalizeLessonKey, resolveLessonKeyAgainst } from '../../lessonKeyNormalization.js'
import { preserveReadinessState } from '../lessonAssociations.server.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'
import { syllabusTeacherLabel } from '../instructionalTeacher.mjs'
import { loadSlateEvidenceInputs, resolveSyllabusLessonMetadata } from '../lessonTimelineInputs.server.mjs'
import { readAllSupabaseRows } from '../supabaseRepository.server.mjs'
import { syllabusItemActionsFor } from '../timeline.mjs'

const REVISION = {
  id: 'revision-1',
  effective_from: '2026-08-24',
  weekly_pattern: {
    monday: [{ subject: 'math' }],
    tuesday: [{ subject: 'science' }],
  },
}

const association = (overrides = {}) => ({
  id: 1,
  lesson_key: 'generated/fractions.json',
  subject: 'math',
  title: 'Fractions',
  readiness_state: 'draft',
  association_source: 'prepare',
  ...overrides,
})

const forecastLesson = (overrides = {}) => ({
  id: 'forecast-1',
  lesson_key: 'generated/fractions.json',
  subject: 'math',
  title: 'Fractions',
  planned_date: '2026-09-07',
  sort_order: 0,
  item_type: 'lesson',
  ...overrides,
})

const slateReport = ({ state = 'independent_success', retentionState = 'not_measured', occurrenceId = 'syllabus:forecast-1' } = {}) => ({
  session: { id: 'slate:activity-1' },
  lesson: { key: 'generated/fractions.json' },
  syllabus_occurrence_id: occurrenceId,
  independent_evidence: { state },
  retention: { state: retentionState },
  provenance: { evidence_session_id: 'evidence-1' },
})

test('facilitator-owned artifacts without learner association do not enter the learner Syllabus', () => {
  const items = composeSyllabusLessonTimeline({ activeRevision: REVISION, today: '2026-08-26' })
  assert.deepEqual(items, [])
})

test('occurrence-bound Mr. Slate assignment renders as a separate supplemental event', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [forecastLesson()],
    associations: [association({ readiness_state: 'available', instructional_teacher: 'webb' })],
    slateAssignments: [{
      id: '22222222-2222-4222-8222-222222222222',
      lesson_key: 'generated/fractions.json',
      syllabus_occurrence_id: 'syllabus:forecast-1',
      assigned_at: '2026-09-01T12:00:00Z',
    }],
    today: '2026-09-07',
  })
  assert.equal(items.length, 2)
  const lesson = items.find((item) => item.item_type === 'lesson')
  const slate = items.find((item) => item.item_type === 'slate_assignment')
  assert.equal(lesson.assigned_instructional_teacher, 'webb')
  assert.equal(lesson.slate_assigned, true)
  assert.equal(slate.title, 'Mr. Slate: Fractions')
  assert.equal(slate.parent_occurrence_id, lesson.occurrence_id)
  assert.equal(slate.practice_occurrence_id, lesson.occurrence_id)
  assert.equal(slate.planned_date, lesson.planned_date)
})

test('Mr. Slate stays supplemental in learner and facilitator Syllabus actions', () => {
  const item = { item_type: 'lesson', lesson_key: 'math/fractions.json', readiness_state: 'available' }
  const learnerActions = syllabusItemActionsFor({ item, role: 'learner', state: 'completed_historical', hasLessonArtifact: true })
  assert.deepEqual(learnerActions.map((action) => action.id), ['review', 'repeat', 'practice_slate'])
  assert.equal(learnerActions.at(-1).requires_pin, undefined)
  const facilitatorActions = syllabusItemActionsFor({ item, role: 'facilitator', state: 'today_unfinished', hasLessonArtifact: true })
  assert.ok(facilitatorActions.some((action) => action.id === 'assign_slate'))
  assert.deepEqual(syllabusItemActionsFor({ item: { item_type: 'slate_assignment' }, role: 'learner' }), [{ id: 'practice_slate', label: 'Start Mr. Slate' }])
})

test('approved-only generated and public lessons do not become active Syllabus members', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    approvedLessons: {
      'generated/fractions.json': true,
      'math/public-fractions.json': true,
    },
    today: '2026-08-26',
  })
  assert.deepEqual(items, [])
})

test('approved lesson keys remain resolution candidates for legitimate shortened actual evidence', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    approvedLessons: { 'generated/fractions.json': true },
    sessions: [{
      id: 'legacy-short-key', lesson_id: 'fractions',
      started_at: '2026-08-25T10:00:00Z', ended_at: null,
    }],
    today: '2026-08-26',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].lesson_key, 'generated/fractions.json')
  assert.equal(items[0].placement_kind, 'actual')
  assert.equal(items[0].readiness_state, 'in_progress')
})

test('stored generated lesson metadata labels legitimate actual history without creating membership', () => {
  const metadata = [{ lesson_key: 'generated/water-cycle.json', subject: 'science', title: 'The Water Cycle' }]
  assert.deepEqual(composeSyllabusLessonTimeline({ activeRevision: REVISION, lessonMetadata: metadata, today: '2026-08-26' }), [])

  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [{ id: 'historical-lesson', lesson_id: 'generated/water-cycle.json', started_at: '2026-08-25T10:00:00Z', ended_at: '2026-08-25T11:00:00Z' }],
    lessonMetadata: metadata,
    today: '2026-08-26',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].placement_kind, 'actual')
  assert.equal(items[0].subject, 'science')
  assert.equal(items[0].title, 'The Water Cycle')
})

test('explicit composition metadata wins over supplemental storage metadata', () => {
  const [item] = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association({ subject: 'mathematics', title: 'Facilitator-selected title' })],
    lessonMetadata: [{ lesson_key: 'generated/fractions.json', subject: 'science', title: 'Stored title' }],
    today: '2026-08-26',
  })
  assert.equal(item.subject, 'mathematics')
  assert.equal(item.title, 'Facilitator-selected title')
})

test('general remains a valid stored subject and generated is never displayed as an educational subject', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [
      { id: 'general', lesson_id: 'generated/general-topic.json', started_at: '2026-08-25T10:00:00Z' },
      { id: 'namespace', lesson_id: 'generated/namespace-topic.json', started_at: '2026-08-25T11:00:00Z' },
    ],
    lessonMetadata: [
      { lesson_key: 'generated/general-topic.json', subject: 'general', title: 'General Topic' },
      { lesson_key: 'generated/namespace-topic.json', subject: 'generated', title: 'Namespace Topic' },
    ],
    today: '2026-08-26',
  })
  assert.equal(items.find((item) => item.lesson_key.endsWith('general-topic.json')).subject, 'general')
  assert.equal(items.find((item) => item.lesson_key.endsWith('namespace-topic.json')).subject, 'general')
  assert.ok(items.every((item) => item.subject !== 'generated'))
})

test('generated metadata resolution deduplicates legitimate keys and supports a unique legacy short key', async () => {
  const calls = []
  const metadata = await resolveSyllabusLessonMetadata({
    admin: {},
    facilitatorId: 'facilitator-1',
    approvedLessons: { 'generated/short.json': true },
    sessions: [
      { lesson_id: 'generated/repeated.json' },
      { lesson_id: 'generated/repeated.json' },
      { lesson_id: 'short' },
    ],
    sessionEvents: [{ lesson_id: 'generated/repeated.json' }],
    verifyLessonAccess: async ({ lessonKey, requireApproved }) => {
      calls.push([lessonKey, requireApproved])
      return { ok: true, lesson: { subject: 'history', title: `Stored ${lessonKey}` } }
    },
  })
  assert.deepEqual(calls.sort(), [
    ['generated/repeated.json', false],
    ['generated/short.json', false],
  ])
  assert.deepEqual(metadata.map((row) => row.lesson_key).sort(), ['generated/repeated.json', 'generated/short.json'])
})

test('ambiguous short keys are not guessed and resolver failures fail soft', async () => {
  const calls = []
  const metadata = await resolveSyllabusLessonMetadata({
    admin: {},
    facilitatorId: 'facilitator-1',
    approvedLessons: { 'generated/shared.json': true, 'math/shared.json': true },
    sessions: [{ lesson_id: 'shared' }, { lesson_id: 'generated/missing.json' }],
    verifyLessonAccess: async ({ lessonKey }) => {
      calls.push(lessonKey)
      throw new Error('storage unavailable')
    },
  })
  assert.deepEqual(calls, ['generated/missing.json'])
  assert.deepEqual(metadata, [])
})

test('generated artifacts with complete explicit metadata do not trigger a storage read', async () => {
  let calls = 0
  const metadata = await resolveSyllabusLessonMetadata({
    admin: {},
    facilitatorId: 'facilitator-1',
    forecastItems: [{ lesson_key: 'generated/complete.json', subject: 'science', title: 'Complete metadata' }],
    sessions: [{ lesson_id: 'generated/complete.json' }],
    verifyLessonAccess: async () => { calls += 1; return { ok: true } },
  })
  assert.equal(calls, 0)
  assert.deepEqual(metadata, [])
})

test('learner-specific unscheduled lessons receive distinct provisional weekly-pattern slots', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association(), association({ id: 2, lesson_key: 'generated/decimals.json', title: 'Decimals' })],
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => [item.lesson_key, item.planned_date, item.placement_kind]), [
    ['generated/fractions.json', '2026-08-31', 'inferred'],
    ['generated/decimals.json', '2026-09-07', 'inferred'],
  ])
  assert.ok(items.every((item) => item.is_provisional && !item.is_explicit_schedule))
})

test('explicit schedule outranks inferred and occupies the weekly slot without being rewritten', () => {
  const schedules = [{ lesson_key: 'generated/fractions.json', scheduled_date: '2026-08-31' }]
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association(), association({ id: 2, lesson_key: 'generated/decimals.json', title: 'Decimals' })],
    schedules,
    today: '2026-08-26',
  })
  assert.equal(items.find((item) => item.lesson_key.endsWith('fractions.json')).placement_kind, 'scheduled')
  assert.equal(items.find((item) => item.lesson_key.endsWith('decimals.json')).planned_date, '2026-09-07')
  assert.deepEqual(schedules, [{ lesson_key: 'generated/fractions.json', scheduled_date: '2026-08-31' }])
})

test('durable association readiness advances monotonically and never regresses', () => {
  assert.equal(preserveReadinessState('saved', 'approved'), 'approved')
  assert.equal(preserveReadinessState('approved', 'available'), 'available')
  assert.equal(preserveReadinessState('available', 'approved'), 'available')
  assert.equal(preserveReadinessState('available', 'draft'), 'available')
})

test('completed evidence outranks prior schedule and immutable forecast placement', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [{ id: 'forecast-1', lesson_key: 'generated/fractions.json', planned_date: '2026-09-07', subject: 'math', title: 'Fractions', sort_order: 0 }],
    schedules: [{ lesson_key: 'generated/fractions.json', scheduled_date: '2026-08-31' }],
    sessions: [{ id: 'completed-session', lesson_id: 'fractions', started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' }],
    sessionEvents: [{ session_id: 'completed-session', lesson_id: 'fractions', event_type: 'completed', occurred_at: '2026-08-20T10:50:00Z' }],
    today: '2026-08-26',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].planned_date, '2026-08-20')
  assert.equal(items[0].placement_kind, 'actual')
  assert.equal(items[0].readiness_state, 'completed')
  assert.equal(items[0].actual_at, '2026-08-20T10:50:00Z')
})

test('open session remains on its actual start date', () => {
  const current = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    sessions: [{ lesson_id: 'generated/fractions.json', started_at: '2026-08-18T10:00:00Z', ended_at: null }],
    today: '2026-08-26',
  })[0]
  assert.equal(current.planned_date, '2026-08-18')
  assert.equal(current.actual_started_date, '2026-08-18')
  assert.equal(current.readiness_state, 'in_progress')
  assert.equal(current.actual_kind, 'in_progress')
})

test('ended session with no terminal event is completed at ended_at', () => {
  const ended = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    sessions: [{ lesson_id: 'generated/fractions.json', started_at: '2026-08-18T10:00:00Z', ended_at: '2026-08-18T11:00:00Z' }],
    today: '2026-08-26',
  })[0]
  assert.equal(ended.actual_kind, 'completed')
  assert.equal(ended.planned_date, '2026-08-18')
  assert.equal(ended.actual_at, '2026-08-18T11:00:00Z')
  assert.equal(ended.readiness_state, 'completed')
})

test('explicit incomplete event overrides ended_at completion fallback for its attempt', () => {
  const item = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    sessions: [{ id: 'stale-session', lesson_id: 'generated/fractions.json', started_at: '2026-08-18T10:00:00Z', ended_at: '2026-08-18T11:00:00Z' }],
    sessionEvents: [{ session_id: 'stale-session', lesson_id: 'generated/fractions.json', event_type: 'incomplete', occurred_at: '2026-08-18T10:45:00Z' }],
    today: '2026-08-26',
  })[0]
  assert.equal(item.planned_date, '2026-08-18')
  assert.equal(item.placement_kind, 'actual')
  assert.equal(item.actual_kind, 'incomplete')
  assert.equal(item.actual_at, '2026-08-18T10:45:00Z')
})

for (const eventType of ['restarted', 'exited']) {
  test(`explicit ${eventType} event preserves the attempt without ended_at completion fallback`, () => {
    const item = composeSyllabusLessonTimeline({
      activeRevision: REVISION,
      associations: [association()],
      sessions: [{ id: `${eventType}-session`, lesson_id: 'generated/fractions.json', started_at: '2026-08-18T10:00:00Z', ended_at: '2026-08-18T11:00:00Z' }],
      sessionEvents: [{ id: `${eventType}-event`, session_id: `${eventType}-session`, lesson_id: 'generated/fractions.json', event_type: eventType, occurred_at: '2026-08-18T10:45:00Z', metadata: { syllabus_occurrence_id: 'syllabus:original' } }],
      today: '2026-08-26',
    })[0]
    assert.equal(item.actual_kind, 'incomplete')
    assert.equal(item.readiness_state, 'draft')
    assert.equal(item.actual_at, '2026-08-18T10:45:00Z')
    assert.equal(item.source_occurrence_id, 'syllabus:original')
  })
}

test('a newer in-progress attempt preserves the older completion occurrence', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    sessions: [
      { id: 'old-session', lesson_id: 'generated/fractions.json', started_at: '2026-08-10T10:00:00Z', ended_at: '2026-08-10T11:00:00Z' },
      { id: 'current-session', lesson_id: 'generated/fractions.json', started_at: '2026-08-25T10:00:00Z', ended_at: null },
    ],
    sessionEvents: [{ session_id: 'old-session', lesson_id: 'generated/fractions.json', event_type: 'completed', occurred_at: '2026-08-10T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => item.actual_kind), ['completed', 'in_progress'])
  const item = items.at(-1)
  assert.equal(item.actual_kind, 'in_progress')
  assert.equal(item.readiness_state, 'in_progress')
  assert.equal(item.planned_date, '2026-08-25')
})

test('newer in-progress attempt coexists with older ended-at fallback completion', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [
      { id: 'legacy-ended', lesson_id: 'math/fractions.json', started_at: '2026-08-10T10:00:00Z', ended_at: '2026-08-10T11:00:00Z' },
      { id: 'new-open', lesson_id: 'math/fractions.json', started_at: '2026-08-25T10:00:00Z', ended_at: null },
    ],
    today: '2026-08-26',
  })
  assert.equal(items.length, 2)
  const item = items.at(-1)
  assert.equal(item.actual_kind, 'in_progress')
  assert.equal(item.actual_at, '2026-08-25T10:00:00Z')
  assert.equal(item.planned_date, '2026-08-25')
})

test('newer explicit incomplete attempt preserves older completion', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [
      { id: 'old-complete', lesson_id: 'math/fractions.json', started_at: '2026-08-10T10:00:00Z', ended_at: '2026-08-10T11:00:00Z' },
      { id: 'new-incomplete', lesson_id: 'math/fractions.json', started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' },
    ],
    sessionEvents: [
      { session_id: 'old-complete', lesson_id: 'math/fractions.json', event_type: 'completed', occurred_at: '2026-08-10T11:00:00Z' },
      { session_id: 'new-incomplete', lesson_id: 'math/fractions.json', event_type: 'incomplete', occurred_at: '2026-08-20T10:45:00Z' },
    ],
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => item.actual_kind), ['completed', 'incomplete'])
  const item = items.at(-1)
  assert.equal(item.actual_kind, 'incomplete')
  assert.equal(item.actual_at, '2026-08-20T10:45:00Z')
})

test('newer completed attempt preserves older incomplete', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [
      { id: 'old-incomplete', lesson_id: 'math/fractions.json', started_at: '2026-08-10T10:00:00Z', ended_at: '2026-08-10T11:00:00Z' },
      { id: 'new-complete', lesson_id: 'math/fractions.json', started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' },
    ],
    sessionEvents: [
      { session_id: 'old-incomplete', lesson_id: 'math/fractions.json', event_type: 'incomplete', occurred_at: '2026-08-10T10:45:00Z' },
      { session_id: 'new-complete', lesson_id: 'math/fractions.json', event_type: 'completed', occurred_at: '2026-08-20T10:50:00Z' },
    ],
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => item.actual_kind), ['incomplete', 'completed'])
  const item = items.at(-1)
  assert.equal(item.actual_kind, 'completed')
  assert.equal(item.actual_at, '2026-08-20T10:50:00Z')
  assert.equal(item.readiness_state, 'completed')
})

test('legacy ended-session completion appears in PAST without any current intent source', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [{ id: 'legacy-only', lesson_id: 'history/legacy-only.json', started_at: '2026-08-01T10:00:00Z', ended_at: '2026-08-01T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].lesson_key, 'history/legacy-only.json')
  assert.equal(items[0].planned_date, '2026-08-01')
  assert.equal(items[0].placement_kind, 'actual')
  assert.equal(items[0].actual_kind, 'completed')
})

test('paged Syllabus history reads include rows beyond the first page', async () => {
  const source = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }))
  const ranges = []
  const rows = await readAllSupabaseRows(() => ({
    range: async (from, to) => {
      ranges.push([from, to])
      return { data: source.slice(from, to + 1), error: null }
    },
  }), { pageSize: 2 })
  assert.deepEqual(rows, source)
  assert.deepEqual(ranges, [[0, 1], [2, 3], [4, 5]])
})

test('Syllabus terminal semantics remain aligned with the learner lesson-history route', () => {
  const route = fs.readFileSync(path.resolve('src/app/api/learner/lesson-history/route.js'), 'utf8')
  assert.match(route, /resolveLessonSessionLifecycle/)
  assert.doesNotMatch(route, /status: endedAt \? 'completed' : 'in-progress'/)
  assert.match(route, /event_type: 'incomplete'/)
  assert.match(route, /session\.status = 'incomplete'/)
})

test('draft, approved, and available readiness stays separate from placement', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [
      association(),
      association({ id: 2, lesson_key: 'generated/decimals.json', title: 'Decimals', readiness_state: 'approved' }),
      association({ id: 3, lesson_key: 'generated/geometry.json', title: 'Geometry', readiness_state: 'approved' }),
    ],
    approvedLessons: { 'facilitator/geometry.json': true },
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => item.readiness_state), ['draft', 'approved', 'available'])
  assert.ok(items.every((item) => item.placement_kind === 'inferred'))
})

test('literal true availability upgrades an associated draft without manufacturing placement', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    approvedLessons: { 'facilitator/fractions.json': true },
    today: '2026-08-26',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].lesson_key, 'generated/fractions.json')
  assert.equal(items[0].readiness_state, 'available')
  assert.equal(items[0].placement_kind, 'inferred')
  assert.equal(items[0].subject, 'math')
  assert.equal(items[0].title, 'Fractions')
})

test('only literal true availability upgrades an existing Syllabus member', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [
      association({ id: 1, lesson_key: 'generated/false.json', title: 'False availability' }),
      association({ id: 2, lesson_key: 'generated/null.json', title: 'Null availability' }),
      association({ id: 3, lesson_key: 'generated/string.json', title: 'String availability' }),
    ],
    approvedLessons: {
      'generated/false.json': false,
      'generated/null.json': null,
      'generated/string.json': 'true',
    },
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => item.readiness_state), ['draft', 'draft', 'draft'])
})

test('availability upgrades legitimate forecast, schedule, and actual members without replacing their metadata', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [{
      id: 'forecast-science', lesson_key: 'generated/cells.json', planned_date: '2026-08-31',
      subject: 'science', title: 'Cell Structure',
    }],
    schedules: [{
      id: 'schedule-history', lesson_key: 'generated/civics.json', scheduled_date: '2026-09-07',
      subject: 'social studies', title: 'Local Civics',
    }],
    associations: [association({ lesson_key: 'generated/baking.json', subject: 'cooking', title: 'Bread Baking' })],
    sessions: [{
      id: 'actual-cooking', lesson_id: 'generated/baking.json',
      started_at: '2026-08-25T10:00:00Z', ended_at: '2026-08-25T11:00:00Z',
    }],
    approvedLessons: {
      'generated/cells.json': true,
      'generated/civics.json': true,
      'generated/baking.json': true,
      'generated/approved-only.json': true,
    },
    today: '2026-08-26',
  })

  assert.equal(items.length, 3)
  assert.deepEqual(items.map((item) => item.lesson_key).sort(), [
    'generated/baking.json', 'generated/cells.json', 'generated/civics.json',
  ])
  const forecast = items.find((item) => item.lesson_key === 'generated/cells.json')
  const scheduled = items.find((item) => item.lesson_key === 'generated/civics.json')
  const actual = items.find((item) => item.lesson_key === 'generated/baking.json')
  assert.deepEqual([forecast.subject, forecast.title, forecast.readiness_state], ['science', 'Cell Structure', 'available'])
  assert.deepEqual([scheduled.subject, scheduled.title, scheduled.readiness_state], ['social studies', 'Local Civics', 'available'])
  assert.deepEqual([actual.subject, actual.title, actual.readiness_state], ['cooking', 'Bread Baking', 'completed'])
})

test('historical key aliases reconcile only when the identity is defensible', () => {
  assert.equal(normalizeLessonKey('facilitator/fractions.json'), 'generated/fractions.json')
  assert.equal(normalizeLessonKey('Facilitator-Lessons/fractions.json'), 'generated/fractions.json')
  assert.equal(lessonKeyBasename('math/Fractions.json'), 'fractions')
  assert.equal(resolveLessonKeyAgainst('fractions', ['generated/fractions.json']), 'generated/fractions.json')
  assert.equal(resolveLessonKeyAgainst('fractions', ['generated/fractions.json', 'math/fractions.json']), 'fractions')
})

test('past entries come from actual learner history rather than pre-effective forecast rows', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [{ lesson_key: 'generated/fractions.json', planned_date: '2026-09-07', subject: 'math', title: 'Fractions' }],
    sessions: [{ lesson_id: 'fractions', started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' }],
    sessionEvents: [{ lesson_id: 'fractions', event_type: 'completed', occurred_at: '2026-08-20T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.equal(items[0].planned_date < REVISION.effective_from, true)
  assert.equal(items[0].placement_kind, 'actual')
})

test('old active-revision forecast intent is carried through the next eligible open slot instead of fabricating PAST', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [{ lesson_key: 'generated/fractions.json', planned_date: '2026-08-10', subject: 'math', title: 'Fractions' }],
    today: '2026-08-26',
  })
  assert.ok(items.every((item) => item.planned_date === '2026-08-31'))
  assert.ok(items.every((item) => item.is_overdue_intent))
  assert.deepEqual(items.map((item) => item.original_placement_date), ['2026-08-10'])
})

test('overdue unfinished intentions spread through finite future capacity instead of stacking today', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [
      { id: 'old-a', lesson_key: 'generated/a.json', planned_date: '2026-08-10', subject: 'math', title: 'A' },
      { id: 'old-b', lesson_key: 'generated/b.json', planned_date: '2026-08-11', subject: 'math', title: 'B' },
    ],
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => item.planned_date), ['2026-08-31', '2026-09-07'])
  assert.ok(items.every((item) => item.is_overdue_intent))
})

test('an overdue intent actually started today is consumed instead of rolling forward again', () => {
  const activeRevision = { ...REVISION, effective_from: '2026-08-01', weekly_pattern: { monday: [{ subject: 'math' }] } }
  const items = composeSyllabusLessonTimeline({
    activeRevision,
    forecastItems: [{ id: 'overdue-monday', lesson_key: 'generated/fractions.json', planned_date: '2026-08-17', subject: 'math', title: 'Fractions' }],
    sessions: [{ id: 'today-start', lesson_id: 'generated/fractions.json', started_at: '2026-08-24T14:00:00Z', ended_at: null }],
    today: '2026-08-24',
  })
  assert.deepEqual(items.map((item) => [item.occurrence_id, item.planned_date, item.placement_kind]), [
    ['actual:today-start', '2026-08-24', 'actual'],
  ])
})

test('actual occurrence provenance consumes only its overdue intent and preserves a distinct repeat', () => {
  const activeRevision = { ...REVISION, effective_from: '2026-08-01', weekly_pattern: { monday: [{ subject: 'math' }, { subject: 'math' }] } }
  const items = composeSyllabusLessonTimeline({
    activeRevision,
    forecastItems: [
      { id: 'overdue-a', lesson_key: 'generated/fractions.json', planned_date: '2026-08-10', subject: 'math', title: 'Fractions A' },
      { id: 'repeat-b', lesson_key: 'generated/fractions.json', planned_date: '2026-08-17', subject: 'math', title: 'Fractions B' },
    ],
    sessions: [{ id: 'today-start', lesson_id: 'generated/fractions.json', started_at: '2026-08-24T14:00:00Z', ended_at: null }],
    sessionEvents: [{ session_id: 'today-start', lesson_id: 'generated/fractions.json', event_type: 'started', occurred_at: '2026-08-24T14:00:00Z', metadata: { syllabus_occurrence_id: 'syllabus:overdue-a' } }],
    today: '2026-08-24',
  })
  assert.equal(items.filter((item) => item.placement_kind === 'actual').length, 1)
  assert.equal(items.some((item) => item.occurrence_id === 'syllabus:overdue-a'), false)
  assert.equal(items.filter((item) => item.occurrence_id === 'syllabus:repeat-b').length, 1)
  assert.equal(items.find((item) => item.occurrence_id === 'syllabus:repeat-b').planned_date, '2026-08-24')
})

test('actual work today reserves capacity and reconciles its corresponding intent before inference', () => {
  const activeRevision = { ...REVISION, effective_from: '2026-08-01', weekly_pattern: { monday: [{ subject: 'math' }, { subject: 'math' }] } }
  const items = composeSyllabusLessonTimeline({
    activeRevision,
    associations: [association({ id: 'waiting', lesson_key: 'generated/waiting.json', title: 'Waiting' })],
    schedules: [
      { id: 'same', lesson_key: 'generated/fractions.json', subject: 'math', scheduled_date: '2026-08-24' },
      { id: 'explicit', lesson_key: 'generated/explicit.json', subject: 'math', scheduled_date: '2026-08-24' },
    ],
    sessions: [{ id: 'started', lesson_id: 'generated/fractions.json', started_at: '2026-08-24T14:00:00Z', ended_at: null }],
    today: '2026-08-24',
  })
  assert.equal(items.filter((item) => item.lesson_key === 'generated/fractions.json').length, 1)
  assert.deepEqual(items.map((item) => [item.placement_kind, item.planned_date]), [
    ['actual', '2026-08-24'], ['scheduled', '2026-08-24'], ['inferred', '2026-08-31'],
  ])
})

test('two actual lessons consume a two-slot day and force a third inference forward', () => {
  const activeRevision = { ...REVISION, effective_from: '2026-08-01', weekly_pattern: { monday: [{ subject: 'math' }, { subject: 'math' }] } }
  const items = composeSyllabusLessonTimeline({
    activeRevision,
    associations: [association({ id: 'third', lesson_key: 'generated/third.json', title: 'Third' })],
    sessions: [
      { id: 'one', lesson_id: 'generated/one.json', started_at: '2026-08-24T13:00:00Z', ended_at: null },
      { id: 'two', lesson_id: 'generated/two.json', started_at: '2026-08-24T14:00:00Z', ended_at: null },
    ],
    today: '2026-08-24',
  })
  assert.equal(items.find((item) => item.lesson_key === 'generated/third.json').planned_date, '2026-08-31')
})

test('a moved explicit schedule reconciles one unique forecast occurrence across dates', () => {
  const activeRevision = { ...REVISION, effective_from: '2026-08-01', weekly_pattern: { thursday: [{ subject: 'math' }], friday: [{ subject: 'math' }] } }
  const items = composeSyllabusLessonTimeline({
    activeRevision,
    forecastItems: [{ id: 'forecast-thursday', lesson_key: 'generated/fractions.json', subject: 'math', title: 'Fractions', planned_date: '2026-08-27' }],
    schedules: [{ id: 'schedule-friday', lesson_key: 'generated/fractions.json', subject: 'math', scheduled_date: '2026-08-28' }],
    today: '2026-08-24',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].planned_date, '2026-08-28')
  assert.equal(items[0].reconciled_forecast_id, 'forecast-thursday')
})

test('deliberate repeated forecast occurrence remains distinct when one repeat is explicitly scheduled', () => {
  const activeRevision = { ...REVISION, effective_from: '2026-08-01', weekly_pattern: { thursday: [{ subject: 'math' }], friday: [{ subject: 'math' }] } }
  const items = composeSyllabusLessonTimeline({
    activeRevision,
    forecastItems: [
      { id: 'repeat-a', lesson_key: 'generated/fractions.json', subject: 'math', title: 'Fractions A', planned_date: '2026-08-27' },
      { id: 'repeat-b', lesson_key: 'generated/fractions.json', subject: 'math', title: 'Fractions B', planned_date: '2026-09-03' },
    ],
    schedules: [{ id: 'scheduled-a', lesson_key: 'generated/fractions.json', subject: 'math', scheduled_date: '2026-08-27' }],
    today: '2026-08-24',
  })
  assert.deepEqual(items.map((item) => item.occurrence_id), ['scheduled:scheduled-a', 'syllabus:repeat-b'])
})

test('pre-effective schedule-only intent is not resurrected into NOW', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    schedules: [{ lesson_key: 'generated/legacy.json', scheduled_date: '2026-08-11', subject: 'math', title: 'Legacy schedule' }],
    today: '2026-08-26',
  })
  assert.deepEqual(items, [])
})

test('pre-effective actual evidence remains visible even when its old schedule intent is ignored', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    schedules: [{ lesson_key: 'generated/legacy.json', scheduled_date: '2026-08-11', subject: 'math', title: 'Legacy schedule' }],
    sessionEvents: [{ lesson_id: 'legacy', event_type: 'completed', occurred_at: '2026-08-12T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].placement_kind, 'actual')
  assert.equal(items[0].planned_date, '2026-08-12')
})

test('associated lessons with no weekly-pattern subject remain visible for placement', () => {
  const item = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association({ subject: 'robotics' })],
    today: '2026-08-26',
  })[0]
  assert.equal(item.lesson_key, 'generated/fractions.json')
  assert.equal(item.planned_date, '2026-08-26')
  assert.equal(item.placement_kind, 'needs_placement')
  assert.equal(item.needs_placement, true)
  assert.equal(item.is_explicit_schedule, false)
})

test('completed history is preserved without an inferred future obligation', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    sessions: [{ id: 'done-once', lesson_id: 'generated/fractions.json', started_at: '2026-08-18T10:00:00Z', ended_at: '2026-08-18T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.equal(items.length, 1)
  assert.deepEqual(items.map((item) => [item.occurrence_id, item.planned_date, item.placement_kind]), [['actual:done-once', '2026-08-18', 'actual']])
})

test('a deliberate later repeat preserves the original completion and receives its own occurrence identity', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: { ...REVISION, activated_at: '2026-08-25T09:00:00Z' },
    associations: [association()],
    forecastItems: [{ id: 'repeat-item', lesson_key: 'generated/fractions.json', subject: 'math', title: 'Fractions again', planned_date: '2026-08-31', sort_order: 0, created_at: '2026-08-25T09:00:00Z' }],
    sessions: [{ id: 'original-attempt', lesson_id: 'generated/fractions.json', started_at: '2026-08-18T10:00:00Z', ended_at: '2026-08-18T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.equal(items.length, 2)
  assert.deepEqual(items.map((item) => item.occurrence_id), ['actual:original-attempt', 'syllabus:repeat-item'])
  assert.equal(items[1].is_deliberate_repeat, true)
})

test('a schedule genuinely rescheduled after completion remains as deliberate repeat intent', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    schedules: [{
      id: 'rescheduled-after-completion', lesson_key: 'generated/fractions.json', subject: 'math', scheduled_date: '2026-08-31',
      created_at: '2026-08-20T09:00:00Z', updated_at: '2026-08-26T09:00:00Z',
    }],
    sessions: [{ id: 'completed', lesson_id: 'generated/fractions.json', started_at: '2026-08-25T10:00:00Z', ended_at: '2026-08-25T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => item.occurrence_id), ['actual:completed', 'scheduled:rescheduled-after-completion'])
  assert.equal(items[1].is_deliberate_repeat, true)
})

test('an untouched pre-completion schedule remains suppressed after completion', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    schedules: [{
      id: 'old-schedule', lesson_key: 'generated/fractions.json', subject: 'math', scheduled_date: '2026-08-31',
      created_at: '2026-08-20T09:00:00Z', updated_at: '2026-08-20T09:00:00Z',
    }],
    sessions: [{ id: 'completed', lesson_id: 'generated/fractions.json', started_at: '2026-08-25T10:00:00Z', ended_at: '2026-08-25T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => item.occurrence_id), ['actual:completed'])
})

test('finite daily and subject capacity overflows deterministically into later weeks', () => {
  const activeRevision = { ...REVISION, weekly_pattern: { monday: [{ subject: 'math' }, { subject: 'science' }] } }
  const associations = [
    association({ id: 'a', lesson_key: 'generated/math-a.json', title: 'Math A' }),
    association({ id: 'b', lesson_key: 'generated/science-a.json', subject: 'science', title: 'Science A' }),
    association({ id: 'c', lesson_key: 'generated/math-b.json', title: 'Math B' }),
  ]
  const items = composeSyllabusLessonTimeline({ activeRevision, associations, today: '2026-08-26' })
  assert.deepEqual(items.map((item) => [item.lesson_key, item.planned_date, item.sort_order]), [
    ['generated/math-a.json', '2026-08-31', 0],
    ['generated/science-a.json', '2026-08-31', 1],
    ['generated/math-b.json', '2026-09-07', 0],
  ])
})

test('five same-subject lessons distribute across five one-slot Mondays', () => {
  const associations = Array.from({ length: 5 }, (_, index) => association({ id: String(index + 1), lesson_key: `generated/math-${index + 1}.json`, title: `Math ${index + 1}` }))
  const items = composeSyllabusLessonTimeline({ activeRevision: REVISION, associations, today: '2026-08-26' })
  assert.deepEqual(items.map((item) => item.planned_date), ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
  assert.equal(new Set(items.map((item) => `${item.planned_date}:${item.sort_order}`)).size, 5)
})

test('explicit schedule and explicit Syllabus positions consume slots before inference', () => {
  const activeRevision = { ...REVISION, weekly_pattern: { monday: [{ subject: 'math' }, { subject: 'math' }] } }
  const associations = [association({ id: 'waiting', lesson_key: 'generated/waiting.json', title: 'Waiting' })]
  const items = composeSyllabusLessonTimeline({
    activeRevision,
    associations,
    schedules: [{ id: 'scheduled', lesson_key: 'generated/scheduled.json', subject: 'math', title: 'Scheduled', scheduled_date: '2026-08-31' }],
    forecastItems: [{ id: 'placed', lesson_key: 'generated/placed.json', subject: 'math', title: 'Placed', planned_date: '2026-08-31', sort_order: 1 }],
    today: '2026-08-26',
  })
  assert.deepEqual(items.map((item) => [item.placement_kind, item.planned_date, item.sort_order]), [
    ['scheduled', '2026-08-31', 0], ['syllabus', '2026-08-31', 1], ['inferred', '2026-09-07', 0],
  ])
})

test('completed history consumes no future slot and unchanged inference is deterministic', () => {
  const input = {
    activeRevision: REVISION,
    associations: [association(), association({ id: 'next', lesson_key: 'generated/next.json', title: 'Next' })],
    sessions: [{ id: 'done', lesson_id: 'generated/fractions.json', started_at: '2026-08-18T10:00:00Z', ended_at: '2026-08-18T11:00:00Z' }],
    today: '2026-08-26',
  }
  const first = composeSyllabusLessonTimeline(input)
  const second = composeSyllabusLessonTimeline(structuredClone(input))
  assert.deepEqual(first, second)
  assert.equal(first.find((item) => item.lesson_key === 'generated/next.json').planned_date, '2026-08-31')
})

test('association schema and API cannot create manual or inferred placement dates', () => {
  const sql = fs.readFileSync(path.resolve('supabase/migrations/20260826110932_add_syllabus_lesson_associations.sql'), 'utf8')
  const route = fs.readFileSync(path.resolve('src/app/api/syllabus/lesson-associations/route.js'), 'utf8')
  assert.doesNotMatch(sql, /planned_date|scheduled_date/)
  assert.doesNotMatch(route, /plannedDate|scheduledDate|lesson_schedule/)
  assert.match(sql, /revoke all on table public\.syllabus_lesson_associations from public, anon, authenticated/i)
  assert.match(sql, /grant select, insert, update, delete on table public\.syllabus_lesson_associations to service_role/i)
  assert.match(sql, /new_rank < old_rank[\s\S]*new\.readiness_state := old\.readiness_state/i)
  assert.match(sql, /before update of readiness_state[\s\S]*execute function public\.preserve_syllabus_lesson_association_readiness\(\)/i)
})

test('Prepare save-for-later persists learner presence and the learner page has no active-Syllabus library bucket', () => {
  const prepare = fs.readFileSync(path.resolve('src/app/facilitator/prepare/page.js'), 'utf8')
  const learner = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
  assert.match(prepare, /async function saveForLater\(\)[\s\S]*await preserveLessonAssociation\(\)/)
  assert.match(prepare, /remains in this learner\\'s Syllabus forecast/)
  assert.match(prepare, /JSON\.stringify\(\{ learnerId, lessonKey: explicitLessonKey, instructionalTeacher: explicitTeacher \}\)/)
  assert.doesNotMatch(prepare, /JSON\.stringify\(\{ learnerId, lessonKey: explicitLessonKey, readinessState|associationSource \}\)/)
  assert.match(learner, /syllabusModel\.kind !== 'active' && <div[\s\S]*Lesson library and learning tools/)
  assert.match(learner, /display: syllabusModel\.kind === 'active' && !selectedLesson \? 'none' : 'flex'/)
})

test('active Syllabus composition does not live-read legacy planned lessons', () => {
  const revisions = fs.readFileSync(path.resolve('src/app/lib/syllabus/revisions.server.mjs'), 'utf8')
  const timelineInputs = fs.readFileSync(path.resolve('src/app/lib/syllabus/lessonTimelineInputs.server.mjs'), 'utf8')
  const repository = fs.readFileSync(path.resolve('src/app/lib/syllabus/supabaseRepository.server.mjs'), 'utf8')
  assert.doesNotMatch(revisions, /listPlannedLessons|plannedLessons/)
  assert.doesNotMatch(timelineInputs, /listPlannedLessons|plannedLessons/)
  assert.match(timelineInputs, /listLessonSchedule', facilitatorId, learner\.id, activeRevision\.effective_from/)
  assert.match(timelineInputs, /listAllTrackedSessions', learner\.id/)
  assert.match(timelineInputs, /listAllLessonSessionEvents', learner\.id/)
  assert.doesNotMatch(timelineInputs, /optionalList\('listRecentTrackedSessions'|optionalList\('listLessonSessionEvents'/)
  assert.match(repository, /listLessonSchedule\(facilitatorId, learnerId, effectiveFrom\)[\s\S]*\.gte\('scheduled_date', String\(effectiveFrom \|\| ''\)\.slice\(0, 10\)\)/)
})

test('association endpoint derives readiness and source from verified artifact state', () => {
  const route = fs.readFileSync(path.resolve('src/app/api/syllabus/lesson-associations/route.js'), 'utf8')
  assert.match(route, /verifyFacilitatorLessonAccess/)
  assert.match(route, /lesson\.approved === true \? 'approved' : 'draft'/)
  assert.match(route, /associationSource: 'prepare'/)
  assert.doesNotMatch(route, /body\?\.(readinessState|associationSource)/)
})

test('facilitator Syllabus exposes Prepare review actions without changing revision data', () => {
  const source = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')
  assert.match(source, /syllabus\?\.timeline_items \|\| syllabus\?\.forecast_items/)
  assert.match(source, /Prepare \/ review draft/)
  assert.match(source, /\/facilitator\/prepare\?learnerId=/)
})

test('generation now transmits the explicit learner and preserves a draft association server-side', () => {
  const page = fs.readFileSync(path.resolve('src/app/facilitator/generator/page.js'), 'utf8')
  const route = fs.readFileSync(path.resolve('src/app/api/facilitator/lessons/generate/route.js'), 'utf8')
  assert.match(page, /JSON\.stringify\(\{ \.\.\.form, learnerId: intendedLearnerId \}\)/)
  assert.match(route, /requireAssociationLearner/)
  assert.match(route, /readinessState: 'draft'/)
  assert.match(route, /associationSource: 'generator'/)
})

test('future Sonoma lesson exposes the canonical assigned-teacher label', () => {
  const [item] = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: [forecastLesson()], associations: [association({ instructional_teacher: 'sonoma' })], today: '2026-08-26' })
  assert.equal(item.assigned_instructional_teacher, 'sonoma')
  assert.equal(syllabusTeacherLabel(item), 'Assigned teacher: Ms. Sonoma')
})

test('future Webb lesson exposes the canonical assigned-teacher label', () => {
  const [item] = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: [forecastLesson()], associations: [association({ instructional_teacher: 'webb' })], today: '2026-08-26' })
  assert.equal(item.assigned_instructional_teacher, 'webb')
  assert.equal(syllabusTeacherLabel(item), 'Assigned teacher: Mrs. Webb')
})

test('completed Webb history uses its immutable session teacher despite a later Sonoma assignment', () => {
  const [item] = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association({ instructional_teacher: 'sonoma' })],
    sessions: [{ id: 'webb-session', lesson_id: 'generated/fractions.json', instructional_teacher: 'webb', started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' }],
    sessionEvents: [{ session_id: 'webb-session', lesson_id: 'generated/fractions.json', event_type: 'completed', occurred_at: '2026-08-20T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.equal(item.assigned_instructional_teacher, 'sonoma')
  assert.equal(item.actual_instructional_teacher, 'webb')
  assert.equal(syllabusTeacherLabel(item), 'Taught by Mrs. Webb')
})

test('completed Sonoma history displays its immutable session teacher', () => {
  const [item] = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [{ id: 'sonoma-session', lesson_id: 'generated/fractions.json', instructional_teacher: 'sonoma', started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' }],
    sessionEvents: [{ session_id: 'sonoma-session', lesson_id: 'generated/fractions.json', event_type: 'completed', occurred_at: '2026-08-20T11:00:00Z' }],
    today: '2026-08-26',
  })
  assert.equal(item.actual_instructional_teacher, 'sonoma')
  assert.equal(syllabusTeacherLabel(item), 'Taught by Ms. Sonoma')
})

test('one legacy Session V2 completion with a NULL stored teacher is display-attributed to Sonoma without rewriting history', () => {
  const session = { id: 'legacy-session', lesson_id: 'generated/fractions.json', instructional_teacher: null, started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' }
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association({ instructional_teacher: 'webb' })],
    sessions: [session],
    sessionEvents: [{ session_id: 'legacy-session', lesson_id: 'generated/fractions.json', event_type: 'completed', occurred_at: '2026-08-20T11:00:00Z', metadata: { source: 'session-v2', instructional_teacher: 'sonoma' } }],
    today: '2026-08-26',
  })
  assert.equal(items.length, 1)
  const [item] = items
  assert.equal(item.assigned_instructional_teacher, 'webb')
  assert.equal(item.actual_instructional_teacher, 'sonoma')
  assert.equal(item.stored_instructional_teacher, null)
  assert.equal(item.actual_instructional_teacher_provenance, 'legacy_session_v2_sonoma_attribution')
  assert.equal(session.instructional_teacher, null)
  assert.equal(syllabusTeacherLabel(item), 'Taught by Ms. Sonoma')
})

test('repeated qualifying Session V2 completions are each display-attributed to Sonoma without mutating stored history', () => {
  const sessions = [
    { id: 'july-completion', lesson_id: 'generated/fractions.json', instructional_teacher: null, started_at: '2026-07-31T18:00:00Z' },
    { id: 'august-completion', lesson_id: 'generated/fractions.json', instructional_teacher: null, started_at: '2026-08-17T20:00:00Z' },
  ]
  const originalSessions = structuredClone(sessions)
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions,
    sessionEvents: [
      { session_id: 'july-completion', lesson_id: 'generated/fractions.json', event_type: 'completed', occurred_at: '2026-07-31T19:15:10.210Z', metadata: { source: 'session-v2' } },
      { session_id: 'august-completion', lesson_id: 'generated/fractions.json', event_type: 'completed', occurred_at: '2026-08-17T21:54:41.372Z', metadata: { source: 'session-v2' } },
    ],
    today: '2026-09-02',
  })
  assert.equal(items.length, 2)
  assert.ok(items.every((item) => item.actual_instructional_teacher === 'sonoma'))
  assert.ok(items.every((item) => item.stored_instructional_teacher === null))
  assert.ok(items.every((item) => item.actual_instructional_teacher_provenance === 'legacy_session_v2_sonoma_attribution'))
  assert.deepEqual(sessions, originalSessions)
})

test('legacy Sonoma attribution remains per-session and fails closed for wrong source, fallback, and cutoff', () => {
  const compose = (sessions, sessionEvents) => composeSyllabusLessonTimeline({ activeRevision: REVISION, sessions, sessionEvents, today: '2026-09-02' })
  const base = { lesson_id: 'generated/fractions.json', instructional_teacher: null, started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' }
  const event = { lesson_id: base.lesson_id, event_type: 'completed', occurred_at: '2026-08-20T11:00:00Z', metadata: { source: 'session-v2' } }

  const mixedSource = compose(
    [{ ...base, id: 'valid-source' }, { ...base, id: 'wrong-source' }],
    [{ ...event, session_id: 'valid-source' }, { ...event, session_id: 'wrong-source', metadata: { source: 'webb' } }],
  )
  assert.equal(mixedSource.find((item) => item.id === 'actual:valid-source').actual_instructional_teacher, 'sonoma')
  assert.equal(mixedSource.find((item) => item.id === 'actual:wrong-source').actual_instructional_teacher, null)

  const [postCutoff] = compose(
    [{ ...base, id: 'post-cutoff', started_at: '2026-08-29T10:00:00Z', ended_at: '2026-08-29T11:00:00Z' }],
    [{ ...event, session_id: 'post-cutoff', occurred_at: '2026-08-29T11:00:00Z' }],
  )
  assert.equal(postCutoff.actual_instructional_teacher, null)

  const [fallbackOnly] = compose([{ ...base, id: 'no-event' }], [])
  assert.equal(fallbackOnly.actual_kind, 'completed')
  assert.equal(fallbackOnly.actual_instructional_teacher, null)

  const [supersededCompletion] = compose(
    [{ ...base, id: 'superseded-completion' }],
    [
      { ...event, id: 'completed-first', session_id: 'superseded-completion' },
      { ...event, id: 'incomplete-later', session_id: 'superseded-completion', event_type: 'incomplete', occurred_at: '2026-08-20T11:30:00Z' },
    ],
  )
  assert.equal(supersededCompletion.actual_kind, 'incomplete')
  assert.equal(supersededCompletion.actual_instructional_teacher, null)

  const mixedFallback = compose(
    [{ ...base, id: 'valid-event' }, { ...base, id: 'fallback-only' }],
    [{ ...event, session_id: 'valid-event' }],
  )
  assert.equal(mixedFallback.find((item) => item.id === 'actual:valid-event').actual_instructional_teacher, 'sonoma')
  assert.equal(mixedFallback.find((item) => item.id === 'actual:fallback-only').actual_instructional_teacher, null)
})

test('canonical Slate mastery and recovery outcomes create separate annotations', () => {
  const mastered = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: [forecastLesson()], slateEvidenceReports: [slateReport()], today: '2026-08-26' })[0]
  assert.deepEqual(mastered.slate_annotations.map((row) => row.label), ['Mastery: Completed with Mr. Slate'])
  const recovered = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: [forecastLesson()], slateEvidenceReports: [slateReport({ state: 'independent_success_after_recovery' })], today: '2026-08-26' })[0]
  assert.deepEqual(recovered.slate_annotations.map((row) => row.label), ['Mastery: Recovered with Mr. Slate'])
})

test('canonical Slate recovery need is represented without completing instruction', () => {
  const [item] = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: [forecastLesson()], slateEvidenceReports: [slateReport({ state: 'needs_recovery' })], today: '2026-08-26' })
  assert.deepEqual(item.slate_annotations.map((row) => row.label), ['Mastery: Recovery needed'])
  assert.equal(item.readiness_state, 'saved')
  assert.equal(item.actual_kind, undefined)
  assert.equal(item.assigned_instructional_teacher, 'sonoma')
})

test('canonical Slate retention and review success create a separate retention annotation', () => {
  const fromRetention = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: [forecastLesson()], slateEvidenceReports: [slateReport({ state: 'unavailable', retentionState: 'retained' })], today: '2026-08-26' })[0]
  assert.deepEqual(fromRetention.slate_annotations.map((row) => row.label), ['Retention: Completed with Mr. Slate'])
  const fromReview = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [forecastLesson()],
    slateReviewReports: [{ review: { id: 'review-1' }, items: [{ lesson_key: 'generated/fractions.json', syllabus_occurrence_id: 'syllabus:forecast-1', state: 'demonstrated' }] }],
    today: '2026-08-26',
  })[0]
  assert.deepEqual(fromReview.slate_annotations.map((row) => row.label), ['Retention: Completed with Mr. Slate'])
})

test('Slate drill completion and points cannot manufacture mastery or instructional completion', () => {
  const report = { ...slateReport({ state: 'unavailable' }), session: { id: 'slate:drill', completion_state: 'ended' }, score: { points: 500, correct: 20 } }
  const [item] = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: [forecastLesson()], slateEvidenceReports: [report], today: '2026-08-26' })
  assert.deepEqual(item.slate_annotations, [])
  assert.equal(item.readiness_state, 'saved')
  assert.equal(item.actual_instructional_teacher, undefined)
  assert.equal(item.assigned_instructional_teacher, 'sonoma')
})

test('Slate occurrence proof annotates only the matching repeated Syllabus occurrence', () => {
  const forecasts = [forecastLesson(), forecastLesson({ id: 'forecast-2', planned_date: '2026-09-14' })]
  const items = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: forecasts, slateEvidenceReports: [slateReport({ occurrenceId: 'syllabus:forecast-2' })], today: '2026-08-26' })
  assert.deepEqual(items.find((item) => item.id === 'forecast-1').slate_annotations, [])
  assert.deepEqual(items.find((item) => item.id === 'forecast-2').slate_annotations.map((row) => row.label), ['Mastery: Completed with Mr. Slate'])
  const ambiguous = composeSyllabusLessonTimeline({ activeRevision: REVISION, forecastItems: forecasts, slateEvidenceReports: [slateReport({ occurrenceId: null })], today: '2026-08-26' })
  assert.ok(ambiguous.every((item) => item.slate_annotations.length === 0))
})

test('facilitator-recorded Webb completion is separate historical instruction and does not rewrite current assignment', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [
      forecastLesson({ created_at: '2026-08-25T15:00:00Z' }),
      forecastLesson({ id: 'forecast-2', planned_date: '2026-09-14', created_at: '2026-08-25T16:00:00Z' }),
    ],
    associations: [association({ instructional_teacher: 'sonoma' })],
    legacyActivities: [{
      id: 'legacy-webb-1', lesson_key: 'generated/fractions.json', syllabus_occurrence_id: 'syllabus:forecast-1',
      activity_type: 'instructional_completion', instructional_teacher: 'webb', occurred_at: '2026-08-20T15:00:00Z',
      provenance: 'facilitator_recorded_legacy_activity',
    }],
    today: '2026-08-26',
  })
  const historical = items.find((item) => item.historical_record)
  const satisfied = items.find((item) => item.id === 'forecast-1')
  const current = items.find((item) => item.id === 'forecast-2')
  assert.equal(historical.actual_kind, 'completed')
  assert.equal(historical.actual_instructional_teacher, 'webb')
  assert.equal(historical.historical_provenance, 'facilitator_recorded_legacy_activity')
  assert.equal(historical.source_occurrence_id, 'syllabus:forecast-1')
  assert.equal(satisfied, undefined)
  assert.equal(current.assigned_instructional_teacher, 'sonoma')
  assert.equal(current.is_deliberate_repeat, false)
})

test('historical instructional completion consumes only its exact repeated occurrence', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [forecastLesson(), forecastLesson({ id: 'forecast-2', planned_date: '2026-09-14' })],
    legacyActivities: [{
      id: 'legacy-webb-repeat', lesson_key: 'generated/fractions.json', syllabus_occurrence_id: 'syllabus:forecast-1',
      activity_type: 'instructional_completion', instructional_teacher: 'webb', occurred_at: '2026-08-20T15:00:00Z',
      provenance: 'facilitator_recorded_legacy_activity',
    }],
    today: '2026-08-26',
  })
  const historical = items.find((item) => item.historical_record)
  assert.equal(historical.placement_kind, 'historical')
  assert.notEqual(historical.readiness_state, 'completed')
  assert.equal(historical.source_occurrence_id, 'syllabus:forecast-1')
  assert.equal(items.some((item) => item.id === 'forecast-1'), false)
  assert.equal(items.some((item) => item.id === 'forecast-2'), true)
  assert.equal(items.find((item) => item.id === 'forecast-2').is_deliberate_repeat, false)
})

test('legacy Slate drill is labeled only as history and cannot manufacture mastery or instruction', () => {
  const [item] = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [forecastLesson()],
    legacyActivities: [{
      id: 'legacy-slate-1', lesson_key: 'generated/fractions.json', syllabus_occurrence_id: 'syllabus:forecast-1',
      activity_type: 'slate_drill_completion', instructional_teacher: null, occurred_at: '2026-08-20T15:00:00Z',
      provenance: 'facilitator_recorded_legacy_activity',
    }],
    today: '2026-08-26',
  })
  assert.deepEqual(item.historical_activity_annotations.map((row) => row.label), ['Mr. Slate drill completed · historical record'])
  assert.deepEqual(item.slate_annotations, [])
  assert.equal(item.actual_kind, undefined)
  assert.equal(item.actual_instructional_teacher, undefined)
  assert.equal(item.assigned_instructional_teacher, 'sonoma')
})

test('legacy activity occurrence binding never annotates a different repeated lesson', () => {
  const forecasts = [forecastLesson(), forecastLesson({ id: 'forecast-2', planned_date: '2026-09-14' })]
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: forecasts,
    legacyActivities: [{
      id: 'legacy-slate-2', lesson_key: 'generated/fractions.json', syllabus_occurrence_id: 'syllabus:forecast-2',
      activity_type: 'slate_drill_completion', occurred_at: '2026-08-20T15:00:00Z', provenance: 'facilitator_recorded_legacy_activity',
    }],
    today: '2026-08-26',
  })
  assert.deepEqual(items.find((item) => item.id === 'forecast-1').historical_activity_annotations, [])
  assert.deepEqual(items.find((item) => item.id === 'forecast-2').historical_activity_annotations.map((row) => row.label), ['Mr. Slate drill completed · historical record'])
})

test('legacy Slate history prefers the exact canonical actual source occurrence and never cross-binds a repeat', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [
      forecastLesson({ id: 'forecast-1', created_at: '2026-08-24T10:00:00Z' }),
      forecastLesson({ id: 'forecast-2', planned_date: '2026-09-14', created_at: '2026-08-28T10:00:00Z' }),
    ],
    associations: [association({ instructional_teacher: 'webb' })],
    sessions: [{
      id: 'completed-webb',
      lesson_id: 'generated/fractions.json',
      syllabus_occurrence_id: 'syllabus:forecast-1',
      instructional_teacher: 'webb',
      started_at: '2026-08-27T13:00:00Z',
      ended_at: '2026-08-27T14:00:00Z',
    }],
    legacyActivities: [{
      id: 'legacy-slate-actual',
      lesson_key: 'generated/fractions.json',
      syllabus_occurrence_id: 'syllabus:forecast-1',
      activity_type: 'slate_drill_completion',
      occurred_at: '2026-08-27T15:00:00Z',
      provenance: 'facilitator_recorded_legacy_activity',
    }],
    today: '2026-08-29',
  })
  const actual = items.find((item) => item.id === 'actual:completed-webb')
  const repeat = items.find((item) => item.id === 'forecast-2')
  assert.deepEqual(actual.historical_activity_annotations.map((row) => row.label), ['Mr. Slate drill completed · historical record'])
  assert.deepEqual(actual.slate_annotations, [])
  assert.equal(actual.actual_kind, 'completed')
  assert.equal(actual.actual_instructional_teacher, 'webb')
  assert.deepEqual(repeat.historical_activity_annotations, [])
  assert.equal(repeat.assigned_instructional_teacher, 'webb')
})

test('Slate evidence loader uses canonical resolvers and carries the server-owned occurrence into reviews', async () => {
  const evidenceSession = {
    id: 'evidence-1', session_id: 'slate:activity-1', browser_session_id: 'slate:activity-1', facilitator_id: 'facilitator-1', learner_id: 'learner-1',
    lesson_key: 'generated/fractions.json', teaching_protocol_version: 'slate-mastery-retention-v1', mastery_protocol_version: 'independent-mastery-v1',
    syllabus_occurrence_id: 'syllabus:forecast-1', started_at: '2026-08-27T10:00:00Z', ended_at: '2026-08-27T10:30:00Z',
  }
  const masteryEvent = { evidence_session_id: 'evidence-1', event_type: 'mastery_check_result', mastery_protocol_version: 'independent-mastery-v1', mastery_outcome: 'independent_success', mastery_check_id: 'mastery-check-1', occurred_at: '2026-08-27T10:20:00Z' }
  const repository = {
    async listAllSlateEvidenceSessions() { return [evidenceSession] },
    async listEvidenceEvents() { return [masteryEvent] },
    async listAllLearningReviewRuns() { return [{ id: 'review-1', facilitator_id: 'facilitator-1', learner_id: 'learner-1', review_type: 'weekly_review', status: 'completed' }] },
    async listLearningReviewItems() { return [{ id: 'review-item-1', run_id: 'review-1', lesson_key: 'generated/fractions.json', anchor_mastery_check_id: 'mastery-check-1' }] },
    async listLearningReviewEvents() { return [{ run_id: 'review-1', review_item_id: 'review-item-1', event_type: 'review_item_result', review_outcome: 'demonstrated' }] },
  }
  const loaded = await loadSlateEvidenceInputs({ repository, facilitatorId: 'facilitator-1', learnerId: 'learner-1' })
  assert.equal(loaded.slateEvidenceReports[0].independent_evidence.state, 'independent_success')
  assert.equal(loaded.slateEvidenceReports[0].syllabus_occurrence_id, 'syllabus:forecast-1')
  assert.equal(loaded.slateReviewReports[0].items[0].syllabus_occurrence_id, 'syllabus:forecast-1')
})

test('Slate history is loaded for Syllabus display but cannot become an execution dependency', () => {
  const revisions = fs.readFileSync(path.resolve('src/app/lib/syllabus/revisions.server.mjs'), 'utf8')
  const execution = fs.readFileSync(path.resolve('src/app/lib/syllabus/executionAuthorization.server.mjs'), 'utf8')
  assert.match(revisions, /includeSlateEvidence: true/)
  assert.doesNotMatch(execution, /includeSlateEvidence: true/)
})

test('Slate occurrence storage is server-owned, immutable, and never backfilled by the migration', () => {
  const route = fs.readFileSync(path.resolve('src/app/api/evidence/route.js'), 'utf8')
  const migration = fs.readFileSync(path.resolve('supabase/migrations/20260829203631_bind_slate_evidence_to_syllabus_occurrence.sql'), 'utf8')
  assert.match(route, /syllabus_occurrence_id: isSlateActivity \? authorizedOccurrenceId : null/)
  assert.match(migration, /add column syllabus_occurrence_id text/i)
  assert.match(migration, /before update of syllabus_occurrence_id/i)
  assert.doesNotMatch(migration, /update public\.learning_evidence_sessions[\s\S]*syllabus_occurrence_id/i)
})

test('SyllabusDocument renders teacher and Slate labels from the separated read-model fields', () => {
  const document = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
  assert.match(document, /syllabusTeacherLabel\(item\)/)
  assert.match(document, /item\.slate_annotations/)
  assert.match(document, /onTeacherAssignment/)
  assert.match(document, /<option value="sonoma">Ms\. Sonoma<\/option>/)
  assert.match(document, /<option value="webb">Mrs\. Webb<\/option>/)
  assert.doesNotMatch(document, /<option value="slate">/i)
  assert.match(document, /item\.historical_activity_annotations/)
  assert.match(document, /startedOccurrenceIds\.has\(String\(occurrenceKey\)\)/)
  assert.match(document, /instructionalCompletionAllowed = item\?\.placement_kind !== 'actual'/)
  assert.match(document, /selectedActivityType = instructionalCompletionAllowed \? activityType : 'slate_drill_completion'/)
  assert.match(document, /item\.placement_kind !== 'actual' \|\| Boolean\(item\.source_occurrence_id\)/)
  const facilitatorPage = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')
  assert.match(facilitatorPage, /item\?\.source_occurrence_id \|\| item\?\.occurrence_id/)
  assert.match(document, /facilitator-attested legacy Webb completion/)
  assert.doesNotMatch(document, /verified legacy Webb completion/i)
  assert.doesNotMatch(document, /localStorage|getItem\('selected_teacher'\)/)
})

test('learner cards and start action make the server-assigned teacher conspicuous', () => {
  const home = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
  assert.match(home, /Your teacher: \{instructionalTeacherLabel\(cardInstructionalTeacher\)\}/)
  assert.match(home, /Continue with \$\{instructionalTeacherLabel\(assignedInstructionalTeacher\)\}/)
  assert.match(home, /Start with \$\{instructionalTeacherLabel\(assignedInstructionalTeacher\)\}/)
  assert.doesNotMatch(home, /setSelectedTeacher|localStorage\.getItem\('selected_teacher'\)/)
})

test('server-verified pre-Syllabus Webb history renders without consuming a future occurrence', () => {
  const lessonKey = 'generated/grammar.json'
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [forecastLesson({ id: 'future-grammar', lesson_key: lessonKey, title: 'Grammar', planned_date: '2026-08-30' })],
    legacyActivities: [{
      id: 'verified-webb', lesson_key: lessonKey, syllabus_occurrence_id: 'legacy-evidence:webb',
      activity_type: 'instructional_completion', instructional_teacher: 'webb', occurred_at: '2026-08-27T15:50:27Z',
      provenance: 'server_verified_legacy_transcript_v1', source_identity: 'webb-source',
    }],
    today: '2026-08-30',
  })
  const historical = items.find((item) => item.id === 'historical:verified-webb')
  const future = items.find((item) => item.id === 'future-grammar')
  assert.equal(historical.historical_record, true)
  assert.equal(historical.actual_instructional_teacher, 'webb')
  assert.equal(historical.source_occurrence_id, 'legacy-evidence:webb')
  assert.ok(future, 'the current/future occurrence remains visible')
  assert.equal(future.actual_kind, undefined)
})

test('server-verified pre-Syllabus Slate history renders standalone as drill history, never mastery', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    legacyActivities: [{
      id: 'verified-slate', lesson_key: 'generated/decimal.json', syllabus_occurrence_id: 'legacy-evidence:slate',
      activity_type: 'slate_drill_completion', instructional_teacher: null, occurred_at: '2026-08-24T16:10:32Z',
      provenance: 'server_verified_legacy_transcript_v1', source_identity: 'slate-source',
    }],
    today: '2026-08-30',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].historical_activity_only, true)
  assert.equal(items[0].actual_kind, null)
  assert.equal(items[0].assigned_instructional_teacher, null)
  assert.equal(items[0].actual_instructional_teacher, null)
  assert.deepEqual(items[0].slate_annotations, [])
  assert.deepEqual(items[0].historical_activity_annotations.map((row) => row.label), ['Mr. Slate drill completed · historical record'])
})

test('verified Slate history groups only with one unambiguous same-day historical instruction', () => {
  const lessonKey = 'generated/grammar.json'
  const base = {
    lesson_key: lessonKey,
    occurred_at: '2026-08-27T15:50:27Z',
    provenance: 'server_verified_legacy_transcript_v1',
  }
  const grouped = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    legacyActivities: [
      { ...base, id: 'webb-1', syllabus_occurrence_id: 'legacy-evidence:webb-1', activity_type: 'instructional_completion', instructional_teacher: 'webb' },
      { ...base, id: 'slate-1', syllabus_occurrence_id: 'legacy-evidence:slate-1', activity_type: 'slate_drill_completion', instructional_teacher: null },
    ],
    today: '2026-08-30',
  })
  assert.equal(grouped.length, 1)
  assert.equal(grouped[0].actual_instructional_teacher, 'webb')
  assert.deepEqual(grouped[0].historical_activity_annotations.map((row) => row.label), ['Mr. Slate drill completed · historical record'])

  const repeated = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    legacyActivities: [
      { ...base, id: 'webb-1', syllabus_occurrence_id: 'legacy-evidence:webb-1', activity_type: 'instructional_completion', instructional_teacher: 'webb' },
      { ...base, id: 'webb-2', syllabus_occurrence_id: 'legacy-evidence:webb-2', activity_type: 'instructional_completion', instructional_teacher: 'webb' },
      { ...base, id: 'slate-1', syllabus_occurrence_id: 'legacy-evidence:slate-1', activity_type: 'slate_drill_completion', instructional_teacher: null },
    ],
    today: '2026-08-30',
  })
  assert.equal(repeated.filter((item) => item.actual_instructional_teacher === 'webb').length, 2)
  const standaloneSlate = repeated.find((item) => item.historical_activity_only)
  assert.ok(standaloneSlate, 'ambiguous repeated evidence remains standalone')
  assert.equal(repeated.filter((item) => item.historical_activity_annotations.length > 0).length, 1)
})

test('verified Slate history targets the unique completed same-day attempt while preserving Science, Community, and Water state', () => {
  const science = 'generated/science-review.json'
  const community = 'generated/community-helpers.json'
  const water = 'generated/water-cycle.json'
  const verifiedSlate = (id, lessonKey, occurredAt) => ({
    id,
    lesson_key: lessonKey,
    syllabus_occurrence_id: `legacy-evidence:${id}`,
    activity_type: 'slate_drill_completion',
    instructional_teacher: null,
    occurred_at: occurredAt,
    provenance: 'server_verified_legacy_transcript_v1',
  })
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [
      { id: 'science-completed', lesson_id: science, instructional_teacher: 'sonoma', started_at: '2026-08-18T18:00:00Z' },
      { id: 'science-incomplete', lesson_id: science, instructional_teacher: 'sonoma', started_at: '2026-08-18T20:00:00Z' },
      { id: 'community-incomplete', lesson_id: community, instructional_teacher: 'sonoma', started_at: '2026-08-27T12:00:00Z' },
      { id: 'water-completed', lesson_id: water, instructional_teacher: 'sonoma', started_at: '2026-08-26T14:00:00Z' },
    ],
    sessionEvents: [
      { session_id: 'science-completed', lesson_id: science, event_type: 'completed', occurred_at: '2026-08-18T19:00:00Z' },
      { session_id: 'science-incomplete', lesson_id: science, event_type: 'incomplete', occurred_at: '2026-08-18T21:00:00Z' },
      { session_id: 'community-incomplete', lesson_id: community, event_type: 'incomplete', occurred_at: '2026-08-27T13:00:00Z' },
      { session_id: 'water-completed', lesson_id: water, event_type: 'completed', occurred_at: '2026-08-26T15:00:00Z' },
    ],
    legacyActivities: [
      verifiedSlate('science-slate', science, '2026-08-18T22:57:03.981Z'),
      verifiedSlate('community-slate', community, '2026-08-27T13:42:22.749Z'),
      verifiedSlate('water-slate', water, '2026-08-27T13:53:53.558Z'),
    ],
    today: '2026-08-30',
  })
  const scienceCompleted = items.find((item) => item.id === 'actual:science-completed')
  const scienceIncomplete = items.find((item) => item.id === 'actual:science-incomplete')
  assert.equal(scienceCompleted.actual_kind, 'completed')
  assert.equal(scienceCompleted.historical_activity_annotations.length, 1)
  assert.equal(scienceIncomplete.actual_kind, 'incomplete')
  assert.deepEqual(scienceIncomplete.historical_activity_annotations, [])
  assert.equal(items.some((item) => item.historical_activity_only && item.lesson_key === science), false)

  const communityItem = items.find((item) => item.id === 'actual:community-incomplete')
  assert.equal(communityItem.actual_kind, 'incomplete')
  assert.equal(communityItem.historical_activity_annotations.length, 1)
  assert.equal(items.some((item) => item.historical_activity_only && item.lesson_key === community), false)

  const waterItem = items.find((item) => item.id === 'actual:water-completed')
  assert.equal(waterItem.planned_date, '2026-08-26')
  assert.equal(waterItem.historical_activity_annotations.length, 1)
  assert.equal(items.some((item) => item.historical_activity_only && item.lesson_key === water), false)
})

test('verified Slate history remains standalone for same-day and cross-date instructional ambiguity', () => {
  const lessonKey = 'generated/ambiguous-history.json'
  const compose = ({ sessions, sessionEvents, occurredAt }) => composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions,
    sessionEvents,
    legacyActivities: [{
      id: 'ambiguous-slate', lesson_key: lessonKey, syllabus_occurrence_id: 'legacy-evidence:ambiguous-slate',
      activity_type: 'slate_drill_completion', instructional_teacher: null, occurred_at: occurredAt,
      provenance: 'server_verified_legacy_transcript_v1',
    }],
    today: '2026-08-30',
  })
  const session = (id, startedAt) => ({ id, lesson_id: lessonKey, instructional_teacher: 'sonoma', started_at: startedAt })
  const event = (sessionId, eventType, occurredAt) => ({ session_id: sessionId, lesson_id: lessonKey, event_type: eventType, occurred_at: occurredAt })
  const assertStandalone = (items) => {
    assert.equal(items.filter((item) => item.historical_activity_only).length, 1)
    assert.ok(items.filter((item) => item.placement_kind === 'actual').every((item) => item.historical_activity_annotations.length === 0))
  }

  assertStandalone(compose({
    sessions: [session('completed-a', '2026-08-18T10:00:00Z'), session('completed-b', '2026-08-18T12:00:00Z')],
    sessionEvents: [event('completed-a', 'completed', '2026-08-18T11:00:00Z'), event('completed-b', 'completed', '2026-08-18T13:00:00Z')],
    occurredAt: '2026-08-18T14:00:00Z',
  }))
  assertStandalone(compose({
    sessions: [session('cross-date-a', '2026-08-17T10:00:00Z'), session('cross-date-b', '2026-08-19T10:00:00Z')],
    sessionEvents: [event('cross-date-a', 'completed', '2026-08-17T11:00:00Z'), event('cross-date-b', 'completed', '2026-08-19T11:00:00Z')],
    occurredAt: '2026-08-18T14:00:00Z',
  }))
  assertStandalone(compose({
    sessions: [session('incomplete-a', '2026-08-18T10:00:00Z'), session('incomplete-b', '2026-08-18T12:00:00Z')],
    sessionEvents: [event('incomplete-a', 'incomplete', '2026-08-18T11:00:00Z'), event('incomplete-b', 'incomplete', '2026-08-18T13:00:00Z')],
    occurredAt: '2026-08-18T14:00:00Z',
  }))
})

test('the Aug 17–23 recovery composes four instructional representations with two Sonoma, two Webb, and four Slate drills', () => {
  const multiply = 'generated/5_Multiplying_Fractions_intermediate.json'
  const science = 'generated/5_4th_Grade_Review_of_Science_intermediate.json'
  const language = 'generated/5_Review_of_4th_Grade_Language_Arts_intermediate.json'
  const social = 'generated/5_4th_Grade_Review_for_5th_Grade_Social_Studies_intermediate.json'
  const sessions = [
    { id: 'multiply-jul-14', lesson_id: multiply, instructional_teacher: null, started_at: '2026-07-14T18:00:00Z' },
    { id: 'multiply-jul-31', lesson_id: multiply, instructional_teacher: null, started_at: '2026-07-31T18:00:00Z' },
    { id: 'multiply-aug-1', lesson_id: multiply, instructional_teacher: null, started_at: '2026-08-01T18:00:00Z' },
    { id: 'multiply-aug-17', lesson_id: multiply, instructional_teacher: null, started_at: '2026-08-17T20:00:00Z' },
    { id: 'science-completed', lesson_id: science, instructional_teacher: null, started_at: '2026-08-18T20:00:00Z' },
    { id: 'science-incomplete', lesson_id: science, instructional_teacher: null, started_at: '2026-08-18T22:00:00Z' },
  ]
  const sessionEvents = [
    { session_id: 'multiply-jul-14', lesson_id: multiply, event_type: 'incomplete', occurred_at: '2026-07-14T19:00:00Z', metadata: { source: 'session-v2' } },
    { session_id: 'multiply-jul-31', lesson_id: multiply, event_type: 'completed', occurred_at: '2026-07-31T19:15:10.210Z', metadata: { source: 'session-v2' } },
    { session_id: 'multiply-aug-1', lesson_id: multiply, event_type: 'incomplete', occurred_at: '2026-08-01T19:00:00Z', metadata: { source: 'session-v2' } },
    { session_id: 'multiply-aug-17', lesson_id: multiply, event_type: 'completed', occurred_at: '2026-08-17T21:54:41.372Z', metadata: { source: 'session-v2' } },
    { session_id: 'science-completed', lesson_id: science, event_type: 'completed', occurred_at: '2026-08-18T21:59:52.870Z', metadata: { source: 'session-v2' } },
    { session_id: 'science-incomplete', lesson_id: science, event_type: 'incomplete', occurred_at: '2026-08-18T22:30:00Z', metadata: { source: 'session-v2' } },
  ]
  const verified = (id, lessonKey, activityType, occurredAt, teacher = null) => ({
    id, lesson_key: lessonKey, syllabus_occurrence_id: `legacy-evidence:${id}`, activity_type: activityType,
    instructional_teacher: teacher, occurred_at: occurredAt, provenance: 'server_verified_legacy_transcript_v1', source_identity: `${id}-source`,
  })
  const legacyActivities = [
    verified('language-webb', language, 'instructional_completion', '2026-08-19T17:46:05.427Z', 'webb'),
    verified('social-webb', social, 'instructional_completion', '2026-08-21T22:12:24.493Z', 'webb'),
    verified('multiply-slate', multiply, 'slate_drill_completion', '2026-08-17T20:26:39.243Z'),
    verified('science-slate', science, 'slate_drill_completion', '2026-08-18T22:57:03.981Z'),
    verified('language-slate', language, 'slate_drill_completion', '2026-08-19T20:10:02.770Z'),
    verified('social-slate', social, 'slate_drill_completion', '2026-08-21T22:45:31.584Z'),
  ]
  const items = composeSyllabusLessonTimeline({ activeRevision: REVISION, sessions, sessionEvents, legacyActivities, today: '2026-08-30' })
  const expectedTarget = new Map([
    [multiply, { date: '2026-08-17', teacher: 'sonoma', slateId: 'multiply-slate' }],
    [science, { date: '2026-08-18', teacher: 'sonoma', slateId: 'science-slate' }],
    [language, { date: '2026-08-19', teacher: 'webb', slateId: 'language-slate' }],
    [social, { date: '2026-08-21', teacher: 'webb', slateId: 'social-slate' }],
  ])
  const targetCompleted = items.filter((item) => {
    const expected = expectedTarget.get(item.lesson_key)
    return expected && item.planned_date === expected.date && item.actual_kind === 'completed'
  })
  assert.equal(targetCompleted.length, 4)
  assert.equal(targetCompleted.filter((item) => item.actual_instructional_teacher === 'sonoma').length, 2)
  assert.equal(targetCompleted.filter((item) => item.actual_instructional_teacher === 'webb').length, 2)
  for (const item of targetCompleted) {
    const expected = expectedTarget.get(item.lesson_key)
    assert.equal(item.actual_instructional_teacher, expected.teacher)
    assert.deepEqual(item.historical_activity_annotations.map((row) => row.historical_activity_id), [expected.slateId])
    assert.deepEqual(item.historical_activity_annotations.map((row) => row.label), ['Mr. Slate drill completed · historical record'])
  }

  const scienceIncomplete = items.find((item) => item.id === 'actual:science-incomplete')
  assert.equal(scienceIncomplete.actual_kind, 'incomplete')
  assert.deepEqual(scienceIncomplete.historical_activity_annotations, [])
  const multiplyingHistory = items.filter((item) => item.lesson_key === multiply && item.placement_kind === 'actual')
  assert.equal(multiplyingHistory.length, 4)
  assert.equal(items.find((item) => item.id === 'actual:multiply-jul-31').actual_instructional_teacher, 'sonoma')
  assert.deepEqual(items.find((item) => item.id === 'actual:multiply-jul-14').historical_activity_annotations, [])
  assert.deepEqual(items.find((item) => item.id === 'actual:multiply-aug-1').historical_activity_annotations, [])
  assert.equal(items.filter((item) => item.historical_activity_only).length, 0)
  assert.ok(items.every((item) => item.slate_annotations.length === 0))
})

test('the Aug 24–30 recovery preserves canonical instruction state while rendering four historical Slate facts', () => {
  const decimal = 'generated/5_Decimal_Operations_Addition_and_Subtraction_intermediate.json'
  const water = 'generated/5_The_Water_Cycle_intermediate.json'
  const community = 'generated/5_Emma_A_social_studies_lesson_on_community_helpers_intermediate.json'
  const grammar = 'generated/5_Grammar_Their_Theyre_There_intermediate.json'
  const sessions = [
    { id: 'decimal-session', lesson_id: decimal, instructional_teacher: 'sonoma', started_at: '2026-08-24T14:00:00Z', ended_at: '2026-08-24T15:00:00Z' },
    { id: 'water-session', lesson_id: water, instructional_teacher: 'sonoma', started_at: '2026-08-26T14:00:00Z', ended_at: '2026-08-26T15:00:00Z' },
    { id: 'community-session', lesson_id: community, instructional_teacher: 'sonoma', started_at: '2026-08-27T12:00:00Z', ended_at: '2026-08-27T13:00:00Z' },
  ]
  const sessionEvents = [
    { session_id: 'decimal-session', lesson_id: decimal, event_type: 'completed', occurred_at: '2026-08-24T15:00:00Z', metadata: { source: 'session-v2' } },
    { session_id: 'water-session', lesson_id: water, event_type: 'completed', occurred_at: '2026-08-26T15:00:00Z', metadata: { source: 'session-v2' } },
    { session_id: 'community-session', lesson_id: community, event_type: 'incomplete', occurred_at: '2026-08-27T13:00:00Z', metadata: { source: 'session-v2' } },
  ]
  const verified = (id, lessonKey, activityType, occurredAt, teacher = null) => ({
    id, lesson_key: lessonKey, syllabus_occurrence_id: `legacy-evidence:${id}`, activity_type: activityType,
    instructional_teacher: teacher, occurred_at: occurredAt, provenance: 'server_verified_legacy_transcript_v1', source_identity: `${id}-source`,
  })
  const legacyActivities = [
    verified('grammar-webb', grammar, 'instructional_completion', '2026-08-27T15:50:27.408Z', 'webb'),
    verified('decimal-slate', decimal, 'slate_drill_completion', '2026-08-24T16:10:32.749Z'),
    verified('water-slate', water, 'slate_drill_completion', '2026-08-27T13:53:53.558Z'),
    verified('community-slate', community, 'slate_drill_completion', '2026-08-27T13:42:22.749Z'),
    verified('grammar-slate', grammar, 'slate_drill_completion', '2026-08-27T16:02:59.369Z'),
  ]
  const items = composeSyllabusLessonTimeline({ activeRevision: REVISION, sessions, sessionEvents, legacyActivities, today: '2026-08-30' })
  const byKey = (lessonKey) => items.find((item) => item.lesson_key === lessonKey && !item.historical_activity_only)
  assert.equal(byKey(decimal).historical_activity_annotations.length, 1)
  assert.equal(byKey(water).historical_activity_annotations.length, 1)
  assert.equal(byKey(community).actual_kind, 'incomplete')
  assert.equal(byKey(community).historical_activity_annotations.length, 1)
  assert.equal(byKey(grammar).actual_instructional_teacher, 'webb')
  assert.equal(byKey(grammar).historical_activity_annotations.length, 1)
  assert.equal(items.filter((item) => item.actual_kind === 'completed').length, 3)
  assert.ok(items.every((item) => item.slate_annotations.length === 0))
})
