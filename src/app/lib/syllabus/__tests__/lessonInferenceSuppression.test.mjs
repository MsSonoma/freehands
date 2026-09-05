import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { setLessonAssociationInferenceSuppressed } from '../lessonAssociations.server.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'

const FACILITATOR_ID = '11111111-1111-4111-8111-111111111111'
const LEARNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LESSON_KEY = 'generated/fractions.json'
const MIGRATION_PATH = path.resolve('supabase/migrations/20260904212950_add_syllabus_inferred_placement_suppression.sql')

const REVISION = {
  id: 'revision-1',
  effective_from: '2026-09-01',
  weekly_pattern: { monday: [{ subject: 'math' }] },
}

function association(overrides = {}) {
  return {
    id: 'association-1',
    facilitator_id: FACILITATOR_ID,
    learner_id: LEARNER_ID,
    lesson_key: LESSON_KEY,
    subject: 'math',
    title: 'Fractions',
    readiness_state: 'available',
    association_source: 'prepare',
    instructional_teacher: 'webb',
    ...overrides,
  }
}

function compose(overrides = {}) {
  return composeSyllabusLessonTimeline({
    activeRevision: REVISION,
    associations: [association()],
    today: '2026-09-07',
    ...overrides,
  })
}

function helperAdmin({ learnerOwned = true, existingAssociation = association() } = {}) {
  const state = { eqCalls: [], payloads: [], existingAssociation: structuredClone(existingAssociation) }
  return {
    state,
    from(table) {
      if (table === 'learners') {
        return {
          select(columns) {
            assert.equal(columns, 'id')
            return this
          },
          eq(column, value) {
            assert.deepEqual([column, value], ['id', LEARNER_ID])
            return this
          },
          or(filter) {
            assert.equal(filter, `facilitator_id.eq.${FACILITATOR_ID},owner_id.eq.${FACILITATOR_ID},user_id.eq.${FACILITATOR_ID}`)
            return this
          },
          async maybeSingle() {
            return { data: learnerOwned ? { id: LEARNER_ID } : null, error: null }
          },
        }
      }
      assert.equal(table, 'syllabus_lesson_associations')
      return {
        update(payload) {
          state.payloads.push(structuredClone(payload))
          return {
            eq(column, value) {
              state.eqCalls.push([column, value])
              return this
            },
            select(columns) {
              assert.equal(columns, '*')
              return this
            },
            async maybeSingle() {
              if (!state.existingAssociation) return { data: null, error: null }
              state.existingAssociation = { ...state.existingAssociation, ...payload }
              return { data: structuredClone(state.existingAssociation), error: null }
            },
          }
        },
      }
    },
  }
}

for (const [label, suppression] of [
  ['missing suppression field', undefined],
  ['false suppression', false],
  ['string suppression', 'true'],
]) {
  test(`${label} preserves inferred placement`, () => {
    const row = association()
    if (suppression !== undefined) row.inferred_placement_suppressed = suppression
    const items = compose({ associations: [row] })
    assert.equal(items.length, 1)
    assert.equal(items[0].placement_kind, 'inferred')
  })
}

test('literal true suppresses an inferred occurrence', () => {
  const items = compose({ associations: [association({ inferred_placement_suppressed: true })] })
  assert.deepEqual(items, [])
})

test('literal true suppresses needs_placement when no weekly slot is available', () => {
  const items = compose({
    activeRevision: { ...REVISION, weekly_pattern: {} },
    associations: [association({ inferred_placement_suppressed: true })],
  })
  assert.deepEqual(items, [])
})

test('suppressed association enriches an explicit forecast', () => {
  const [item] = compose({
    associations: [association({ inferred_placement_suppressed: true })],
    forecastItems: [{
      id: 'forecast-1',
      lesson_key: LESSON_KEY,
      planned_date: '2026-09-07',
      sort_order: 0,
      item_type: 'lesson',
    }],
  })
  assert.equal(item.placement_kind, 'syllabus')
  assert.equal(item.readiness_state, 'available')
  assert.equal(item.subject, 'math')
  assert.equal(item.title, 'Fractions')
  assert.equal(item.assigned_instructional_teacher, 'webb')
})

test('suppressed association enriches an explicit schedule', () => {
  const [item] = compose({
    associations: [association({ inferred_placement_suppressed: true })],
    schedules: [{ id: 'schedule-1', lesson_key: LESSON_KEY, scheduled_date: '2026-09-07', sort_order: 0 }],
  })
  assert.equal(item.placement_kind, 'scheduled')
  assert.equal(item.readiness_state, 'available')
  assert.equal(item.subject, 'math')
  assert.equal(item.title, 'Fractions')
  assert.equal(item.assigned_instructional_teacher, 'webb')
})

test('suppressed association does not hide an actual occurrence', () => {
  const [item] = compose({
    associations: [association({ inferred_placement_suppressed: true })],
    sessions: [{
      id: 'session-1',
      lesson_id: LESSON_KEY,
      instructional_teacher: 'sonoma',
      started_at: '2026-09-06T10:00:00Z',
      ended_at: '2026-09-06T11:00:00Z',
    }],
  })
  assert.equal(item.placement_kind, 'actual')
  assert.equal(item.title, 'Fractions')
  assert.equal(item.subject, 'math')
  assert.equal(item.assigned_instructional_teacher, 'webb')
})

test('suppressed association does not hide a legitimate historical representation', () => {
  const [item] = compose({
    associations: [association({ inferred_placement_suppressed: true })],
    legacyActivities: [{
      id: 'history-1',
      lesson_key: LESSON_KEY,
      syllabus_occurrence_id: 'syllabus:legacy-1',
      instructional_teacher: 'sonoma',
      activity_type: 'instructional_completion',
      occurred_at: '2026-09-05T11:00:00Z',
      provenance: 'canonical_legacy_import',
    }],
  })
  assert.equal(item.placement_kind, 'historical')
  assert.equal(item.title, 'Fractions')
  assert.equal(item.subject, 'math')
  assert.equal(item.readiness_state, 'available')
})

test('helper canonicalizes and scopes an exact two-column association update', async () => {
  const admin = helperAdmin()
  const result = await setLessonAssociationInferenceSuppressed({
    admin,
    facilitatorId: FACILITATOR_ID,
    learnerId: LEARNER_ID,
    lessonKey: 'lessons/facilitator/fractions.json',
    suppressed: true,
    verifyLearner: false,
  })
  assert.deepEqual(admin.state.eqCalls, [
    ['facilitator_id', FACILITATOR_ID],
    ['learner_id', LEARNER_ID],
    ['lesson_key', LESSON_KEY],
  ])
  assert.deepEqual(Object.keys(admin.state.payloads[0]).sort(), ['inferred_placement_suppressed', 'updated_at'])
  assert.equal(admin.state.payloads[0].inferred_placement_suppressed, true)
  assert.ok(Number.isFinite(Date.parse(admin.state.payloads[0].updated_at)))
  assert.equal(result.inferred_placement_suppressed, true)
  assert.equal(result.readiness_state, 'available')
  assert.equal(result.title, 'Fractions')
  assert.equal(result.subject, 'math')
  assert.equal(result.association_source, 'prepare')
  assert.equal(result.instructional_teacher, 'webb')
})

test('helper rejects non-boolean suppression before mutation', async () => {
  const admin = helperAdmin()
  await assert.rejects(
    () => setLessonAssociationInferenceSuppressed({
      admin, facilitatorId: FACILITATOR_ID, learnerId: LEARNER_ID, lessonKey: LESSON_KEY, suppressed: 'true', verifyLearner: false,
    }),
    (error) => error?.status === 400 && error?.code === 'INVALID_LESSON_ASSOCIATION',
  )
  assert.deepEqual(admin.state.payloads, [])
})

test('helper rejects an unauthorized learner before mutation', async () => {
  const admin = helperAdmin({ learnerOwned: false })
  await assert.rejects(
    () => setLessonAssociationInferenceSuppressed({
      admin, facilitatorId: FACILITATOR_ID, learnerId: LEARNER_ID, lessonKey: LESSON_KEY, suppressed: true,
    }),
    (error) => error?.status === 403 && error?.code === 'FORBIDDEN',
  )
  assert.deepEqual(admin.state.payloads, [])
})

test('helper rejects a missing exact association', async () => {
  const admin = helperAdmin({ existingAssociation: null })
  await assert.rejects(
    () => setLessonAssociationInferenceSuppressed({
      admin, facilitatorId: FACILITATOR_ID, learnerId: LEARNER_ID, lessonKey: LESSON_KEY, suppressed: false, verifyLearner: false,
    }),
    (error) => error?.status === 404 && error?.code === 'LESSON_ASSOCIATION_NOT_FOUND',
  )
})

test('migration adds only the suppression column and its comment', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8')
  assert.match(sql, /add\s+column\s+inferred_placement_suppressed\s+boolean\s+not\s+null\s+default\s+false/i)
  assert.match(sql, /comment\s+on\s+column\s+public\.syllabus_lesson_associations\.inferred_placement_suppressed\s+is/i)
  assert.doesNotMatch(sql, /\b(?:create|alter|drop)\s+policy\b|\bgrant\b|\brevoke\b|\b(?:create|alter|drop)\s+(?:or\s+replace\s+)?(?:trigger|function)\b/i)
})
