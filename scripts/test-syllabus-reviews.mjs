import assert from 'node:assert/strict'
import { test } from 'node:test'

import { MASTERY_OUTCOMES } from '../src/app/lib/masteryEvidence/mastery.js'
import {
  DAILY_REVIEW_PROTOCOL_VERSION,
  REVIEW_TYPES,
} from '../src/app/lib/masteryEvidence/followUps.js'
import {
  buildFollowUpAvailability,
  startFollowUpRun,
} from '../src/app/lib/masteryEvidence/followUps.service.js'
import {
  buildDailyReviewCycles,
  buildSyllabusReviewProjection,
  buildWeeklyReviewCycles,
} from '../src/app/lib/syllabus/reviewProjection.mjs'
import { selectSyllabusWeek, syllabusDayPresentation } from '../src/app/lib/syllabus/timeline.mjs'
import { POST as postSlateCompletion } from '../src/app/api/slate/completions/route.js'

const lesson = {
  id: 'fractions-review',
  title: 'Fractions',
  dailyFollowup: [{ id: 'daily-1', question: 'Name one half.', expectedAny: ['1/2'] }],
  weeklyReview: [{ id: 'weekly-1', question: 'Which is one half?', choices: ['1/3', '1/2'], correct: 1 }],
}

function anchor(overrides = {}) {
  return {
    event_id: 'anchor-event-1',
    event_type: 'mastery_check_result',
    occurred_at: '2026-09-24T15:00:00.000Z',
    session_id: 'lesson-session-1',
    lesson_key: 'generated/fractions.json',
    lesson_id: lesson.id,
    concept_id: 'fractions:half',
    mastery_cycle_id: 'cycle-1',
    mastery_check_id: 'mastery-check-1',
    mastery_outcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS,
    ...overrides,
  }
}

function repositoryFor(evidenceEvents = [anchor()]) {
  const data = {
    learner: {
      id: '11111111-1111-4111-8111-111111111111',
      facilitator_id: 'user-1',
      daily_followups_enabled: true,
      weekly_reviews_enabled: false,
      weekly_review_day: 'friday',
    },
    evidenceEvents,
    runs: [],
    items: [],
    events: [],
  }
  return {
    data,
    async findOwnedLearner({ userId, learnerId }) {
      return userId === 'user-1' && learnerId === data.learner.id ? { ...data.learner } : null
    },
    async getProfileTimezone() { return 'America/New_York' },
    async listEvidenceEvents() { return [...data.evidenceEvents] },
    async listReviewRuns() { return [...data.runs] },
    async listReviewItems() { return [...data.items] },
    async listReviewEvents() { return [...data.events] },
    async insertRun(run) { data.runs.push({ ...run }); return { ...run } },
    async findRunByCycle({ learnerId, reviewType, cycleKey }) {
      return data.runs.find((run) => run.learner_id === learnerId && run.review_type === reviewType && run.cycle_key === cycleKey) || null
    },
    async insertItems(items) { data.items.push(...items.map((item) => ({ ...item }))); return items },
    async getRun({ userId, runId }) {
      return data.runs.find((run) => run.id === runId && run.facilitator_id === userId) || null
    },
    async insertEvent(event) { data.events.push({ ...event }); return { ...event } },
    async updateRun({ runId, updates }) {
      const run = data.runs.find((entry) => entry.id === runId)
      Object.assign(run, updates)
      return { ...run }
    },
  }
}

const completedLesson = (overrides = {}) => ({
  item_type: 'lesson',
  occurrence_id: 'syllabus:lesson-1',
  lesson_key: 'generated/fractions.json',
  planned_date: '2026-09-24',
  sort_order: 0,
  subject: 'Math',
  title: 'Fractions',
  readiness_state: 'completed',
  ...overrides,
})

test('Daily Review groups all lessons on a Syllabus day and waits for every lesson', () => {
  const cycles = buildDailyReviewCycles({
    enabled: true,
    today: '2026-09-24',
    timeZone: 'America/New_York',
    timelineItems: [
      completedLesson(),
      completedLesson({
        occurrence_id: 'syllabus:lesson-2',
        lesson_key: 'generated/geometry.json',
        title: 'Geometry',
        readiness_state: 'available',
        sort_order: 1,
      }),
    ],
  })
  assert.equal(cycles.length, 1)
  assert.equal(cycles[0].lessonCount, 2)
  assert.equal(cycles[0].completedCount, 1)
  assert.equal(cycles[0].ready, false)
})

test('Weekly Review maps lessons into the selected weekday review cycle', () => {
  const cycles = buildWeeklyReviewCycles({
    enabled: true,
    reviewDay: 'friday',
    today: '2026-09-25',
    timeZone: 'America/New_York',
    timelineItems: [
      completedLesson({ planned_date: '2026-09-21' }),
      completedLesson({ occurrence_id: 'syllabus:lesson-2', lesson_key: 'generated/science.json', planned_date: '2026-09-24', title: 'Science' }),
    ],
  })
  assert.equal(cycles.length, 1)
  assert.equal(cycles[0].reviewDate, '2026-09-25')
  assert.equal(cycles[0].completedCount, 2)
  assert.equal(cycles[0].ready, true)
})

test('Syllabus projection creates review items, not lesson items, with per-lesson progress', () => {
  const availability = {
    cards: [{
      id: 'daily-review:America/New_York:2026-09-24',
      review_type: REVIEW_TYPES.DAILY_REVIEW,
      cycle_key: 'America/New_York:2026-09-24',
      run_id: null,
      remaining_count: 1,
    }],
    completed_cycles: [],
  }
  const projection = buildSyllabusReviewProjection({
    timelineItems: [completedLesson()],
    settings: { daily_followups_enabled: true, weekly_reviews_enabled: false, weekly_review_day: 'friday' },
    today: '2026-09-24',
    timeZone: 'America/New_York',
    availability,
  })
  assert.equal(projection.items.length, 1)
  assert.equal(projection.items[0].item_type, 'review')
  assert.equal(projection.items[0].lesson_key, undefined)
  assert.equal(projection.items[0].review_ready, true)
  assert.equal(projection.items[0].review_progress.lessons[0].completed, true)
})

test('Same-day Daily Review starts under its own protocol without changing delayed Daily Follow-Up semantics', async () => {
  const repository = repositoryFor()
  const cycle = {
    review_type: REVIEW_TYPES.DAILY_REVIEW,
    cycleKey: 'America/New_York:2026-09-24',
    reviewDate: '2026-09-24',
    timeZone: 'America/New_York',
    lessonKeys: ['generated/fractions.json'],
    lessonCount: 1,
    completedCount: 1,
    ready: true,
  }
  const availability = await buildFollowUpAvailability({
    repository,
    userId: 'user-1',
    learnerId: repository.data.learner.id,
    loadLesson: async () => lesson,
    now: '2026-09-24T20:00:00.000Z',
    includePrivate: true,
    dailyReviewCycles: [cycle],
  })
  const card = availability.cards.find((entry) => entry.review_type === REVIEW_TYPES.DAILY_REVIEW)
  assert.ok(card)
  const run = await startFollowUpRun({
    repository,
    userId: 'user-1',
    learnerId: repository.data.learner.id,
    card,
    now: '2026-09-24T20:00:00.000Z',
  })
  assert.equal(run.review_type, REVIEW_TYPES.DAILY_REVIEW)
  assert.equal(run.protocol_version, DAILY_REVIEW_PROTOCOL_VERSION)
})
test('Completed reviews collapse to one daily review history marker', () => {
  const presentations = syllabusDayPresentation([
    {
      id: 'review:daily',
      item_type: 'review',
      review_type: REVIEW_TYPES.DAILY_REVIEW,
      review_status: 'completed',
      planned_date: '2026-09-26',
      sort_order: 100,
      review_progress: { lessons: [{ title: 'Fractions', completed: true }] },
    },
    {
      id: 'review:weekly',
      item_type: 'review',
      review_type: REVIEW_TYPES.WEEKLY_REVIEW,
      review_status: 'completed',
      planned_date: '2026-09-26',
      sort_order: 101,
      review_progress: { lessons: [{ title: 'Science', completed: true }] },
    },
  ], [])

  assert.equal(presentations.length, 1)
  assert.equal(presentations[0].item.item_type, 'review_history')
  assert.equal(presentations[0].item.reviews.length, 2)
})

test('generic review history stays separate from Slate history on the same day', () => {
  const presentations = syllabusDayPresentation([
    {
      id: 'review:weekly',
      item_type: 'review',
      review_type: REVIEW_TYPES.WEEKLY_REVIEW,
      review_status: 'completed',
      planned_date: '2026-09-26',
      sort_order: 100,
      review_teacher: 'webb',
      review_progress: { lessons: [{ title: 'Science', completed: true }] },
    },
    {
      id: 'slate-completion:1',
      item_type: 'slate_history',
      planned_date: '2026-09-26',
      sort_order: 101,
      title: 'Fractions',
      subject: 'Math',
    },
  ], [])
  assert.equal(presentations.length, 2)
  assert.deepEqual(presentations.map(({ item }) => item.item_type).sort(), ['review_history', 'slate_review_history'])
  assert.equal(presentations.find(({ item }) => item.item_type === 'review_history').item.reviews[0].review_teacher, 'webb')
})
test('Completed reviews are projected onto their actual local completion date', () => {
  const projection = buildSyllabusReviewProjection({
    timelineItems: [completedLesson({ planned_date: '2026-09-25' })],
    settings: { daily_followups_enabled: true, weekly_reviews_enabled: false, weekly_review_day: 'friday' },
    today: '2026-09-26',
    timeZone: 'America/New_York',
    availability: {
      cards: [],
      completed_cycles: [{
        review_type: REVIEW_TYPES.DAILY_REVIEW,
        cycle_key: 'America/New_York:2026-09-25',
        completed_at: '2026-09-27T02:15:00.000Z',
      }],
    },
  })

  assert.equal(projection.items.length, 1)
  assert.equal(projection.items[0].review_status, 'completed')
  assert.equal(projection.items[0].planned_date, '2026-09-26')
})
test('server-verified legacy Slate completions backfill the compact marker on their completion day', () => {
  const week = selectSyllabusWeek([
    {
      id: 'lesson-water',
      item_type: 'lesson',
      planned_date: '2026-08-20',
      title: 'The Water Cycle',
      subject: 'Science',
      historical_activity_annotations: [{
        kind: 'slate_drill_history',
        historical_activity_id: 'water-slate',
        planned_date: '2026-08-27',
        occurred_at: '2026-08-27T13:53:53.558Z',
        lesson_key: 'generated/water.json',
        title: 'The Water Cycle',
        subject: 'Science',
      }],
    },
    {
      id: 'historical:grammar-slate',
      item_type: 'lesson',
      planned_date: '2026-08-27',
      title: 'Grammar',
      subject: 'Language Arts',
      historical_activity_only: true,
      historical_activity_annotations: [{
        kind: 'slate_drill_history',
        historical_activity_id: 'grammar-slate',
        planned_date: '2026-08-27',
        occurred_at: '2026-08-27T16:02:59.369Z',
        lesson_key: 'generated/grammar.json',
        title: 'Grammar',
        subject: 'Language Arts',
      }],
    },
  ], { weekStart: '2026-08-24', today: '2026-09-26' })

  const day = week.days.find((entry) => entry.date === '2026-08-27')
  assert.ok(day)
  assert.equal(day.items.filter((item) => item.item_type === 'slate_history').length, 2)
  assert.equal(day.items.some((item) => item.historical_activity_only === true), false)

  const presentations = syllabusDayPresentation(day.items, [])
  assert.equal(presentations.length, 1)
  assert.equal(presentations[0].item.item_type, 'slate_review_history')
  assert.equal(presentations[0].item.slate_completions.length, 2)
  assert.deepEqual(presentations[0].item.slate_completions.map((item) => item.title).sort(), ['Grammar', 'The Water Cycle'])
})
test('Mr. Slate completion endpoint records a durable supplemental completion', async () => {
  const learnerId = '11111111-1111-4111-8111-111111111111'
  const facilitatorId = '22222222-2222-4222-8222-222222222222'
  const inserted = []
  const repository = {
    async findOwnedLearner(id, ownerId) {
      return id === learnerId && ownerId === facilitatorId ? { id: learnerId } : null
    },
    async insertSlateCompletion(row) {
      inserted.push(row)
      return { id: '33333333-3333-4333-8333-333333333333', ...row }
    },
  }
  const request = new Request('http://localhost/api/slate/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      learnerId,
      lessonKey: 'generated/fractions.json',
      occurrenceId: 'syllabus:fractions-1',
      runPurpose: 'practice',
      startedAt: '2026-09-26T13:40:00.000Z',
      completedAt: '2026-09-26T13:55:00.000Z',
      lessonTitle: 'Fractions',
      subject: 'Math',
    }),
  })
  const response = await postSlateCompletion(request, {
    requestContext: { user: { id: facilitatorId, user_metadata: { timezone: 'America/New_York' } }, admin: {} },
    repository,
    now: new Date('2026-09-26T14:00:00.000Z'),
    requireSlateAssignableSyllabusOccurrence: async () => ({
      lessonKey: 'generated/fractions.json',
      occurrenceId: 'syllabus:fractions-1',
    }),
  })
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0].source, 'slate_session_v1')
  assert.equal(inserted[0].lesson_key, 'generated/fractions.json')
  assert.equal(inserted[0].syllabus_occurrence_id, 'syllabus:fractions-1')
  assert.equal(inserted[0].completed_at, '2026-09-26T13:55:00.000Z')
  assert.match(inserted[0].source_identity, /^[0-9a-f]{64}$/)
})
