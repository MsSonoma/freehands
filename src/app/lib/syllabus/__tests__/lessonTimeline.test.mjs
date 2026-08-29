import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { lessonKeyBasename, normalizeLessonKey, resolveLessonKeyAgainst } from '../../lessonKeyNormalization.js'
import { preserveReadinessState } from '../lessonAssociations.server.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'
import { resolveSyllabusLessonMetadata } from '../lessonTimelineInputs.server.mjs'
import { readAllSupabaseRows } from '../supabaseRepository.server.mjs'

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

test('facilitator-owned artifacts without learner association do not enter the learner Syllabus', () => {
  const items = composeSyllabusLessonTimeline({ activeRevision: REVISION, today: '2026-08-26' })
  assert.deepEqual(items, [])
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
