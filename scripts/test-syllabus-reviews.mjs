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
