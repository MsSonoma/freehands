import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { lessonKeyBasename, normalizeLessonKey, resolveLessonKeyAgainst } from '../../lessonKeyNormalization.js'
import { preserveReadinessState } from '../lessonAssociations.server.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'
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

test('open session is in progress in NOW', () => {
  const current = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    sessions: [{ lesson_id: 'generated/fractions.json', started_at: '2026-08-18T10:00:00Z', ended_at: null }],
    today: '2026-08-26',
  })[0]
  assert.equal(current.planned_date, '2026-08-26')
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

test('a newer in-progress attempt is not hidden by older completion evidence for the same lesson', () => {
  const item = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    sessions: [
      { id: 'old-session', lesson_id: 'generated/fractions.json', started_at: '2026-08-10T10:00:00Z', ended_at: '2026-08-10T11:00:00Z' },
      { id: 'current-session', lesson_id: 'generated/fractions.json', started_at: '2026-08-25T10:00:00Z', ended_at: null },
    ],
    sessionEvents: [{ session_id: 'old-session', lesson_id: 'generated/fractions.json', event_type: 'completed', occurred_at: '2026-08-10T11:00:00Z' }],
    today: '2026-08-26',
  })[0]
  assert.equal(item.actual_kind, 'in_progress')
  assert.equal(item.readiness_state, 'in_progress')
  assert.equal(item.planned_date, '2026-08-26')
})

test('newer in-progress attempt outranks older ended-at fallback completion', () => {
  const item = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    sessions: [
      { id: 'legacy-ended', lesson_id: 'math/fractions.json', started_at: '2026-08-10T10:00:00Z', ended_at: '2026-08-10T11:00:00Z' },
      { id: 'new-open', lesson_id: 'math/fractions.json', started_at: '2026-08-25T10:00:00Z', ended_at: null },
    ],
    today: '2026-08-26',
  })[0]
  assert.equal(item.actual_kind, 'in_progress')
  assert.equal(item.actual_at, '2026-08-25T10:00:00Z')
  assert.equal(item.planned_date, '2026-08-26')
})

test('newer explicit incomplete attempt outranks older completion', () => {
  const item = composeSyllabusLessonTimeline({
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
  })[0]
  assert.equal(item.actual_kind, 'incomplete')
  assert.equal(item.actual_at, '2026-08-20T10:45:00Z')
})

test('newer completed attempt outranks older incomplete', () => {
  const item = composeSyllabusLessonTimeline({
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
  })[0]
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
  assert.match(route, /status: endedAt \? 'completed' : 'in-progress'/)
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

test('old active-revision forecast intent is carried into NOW instead of fabricating PAST', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    forecastItems: [{ lesson_key: 'generated/fractions.json', planned_date: '2026-08-10', subject: 'math', title: 'Fractions' }],
    today: '2026-08-26',
  })
  assert.ok(items.every((item) => item.planned_date === '2026-08-26'))
  assert.ok(items.every((item) => item.is_overdue_intent))
  assert.deepEqual(items.map((item) => item.original_placement_date), ['2026-08-10'])
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
  const learner = fs.readFileSync(path.resolve('src/app/learn/lessons/page.js'), 'utf8')
  assert.match(prepare, /async function saveForLater\(\)[\s\S]*await preserveLessonAssociation\(\)/)
  assert.match(prepare, /remains in this learner\\'s Syllabus forecast/)
  assert.match(prepare, /JSON\.stringify\(\{ learnerId, lessonKey: explicitLessonKey \}\)/)
  assert.doesNotMatch(prepare, /JSON\.stringify\(\{ learnerId, lessonKey: explicitLessonKey, readinessState|associationSource \}\)/)
  assert.match(learner, /syllabusModel\.kind !== 'active' && <div[\s\S]*Lesson library and learning tools/)
  assert.match(learner, /display: syllabusModel\.kind === 'active' && !selectedLesson \? 'none' : 'flex'/)
})

test('active Syllabus composition does not live-read legacy planned lessons', () => {
  const revisions = fs.readFileSync(path.resolve('src/app/lib/syllabus/revisions.server.mjs'), 'utf8')
  const repository = fs.readFileSync(path.resolve('src/app/lib/syllabus/supabaseRepository.server.mjs'), 'utf8')
  assert.doesNotMatch(revisions, /listPlannedLessons|plannedLessons/)
  assert.match(revisions, /listLessonSchedule', facilitatorId, learnerId, activeRevision\.effective_from/)
  assert.match(revisions, /listAllTrackedSessions', learnerId/)
  assert.match(revisions, /listAllLessonSessionEvents', learnerId/)
  assert.doesNotMatch(revisions, /optionalList\('listRecentTrackedSessions'|optionalList\('listLessonSessionEvents'/)
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
