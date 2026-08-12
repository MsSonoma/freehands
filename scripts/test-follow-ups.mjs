import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { buildInstructionalLessonView } from '../src/app/lib/masteryEvidence/assessmentIsolation.js'
import { MASTERY_OUTCOMES } from '../src/app/lib/masteryEvidence/mastery.js'
import { RETENTION_OUTCOMES } from '../src/app/lib/masteryEvidence/retention.js'
import {
  DAILY_FOLLOWUP_PROTOCOL_VERSION,
  REVIEW_REASONS,
  REVIEW_TYPES,
  WEEKLY_REVIEW_MAX_ITEMS,
  WEEKLY_REVIEW_OUTCOMES,
  WEEKLY_REVIEW_PROTOCOL_VERSION,
  buildDailyFollowUpPlan,
  buildReviewRunSummary,
  buildWeeklyReviewCycle,
  buildWeeklyReviewPlan,
  classifyWeeklyReviewOutcome,
  qualifyWeeklyReviewOpportunity,
  selectDailyFollowUpAnchors,
  selectWeeklyReviewAnchors,
} from '../src/app/lib/masteryEvidence/followUps.js'
import {
  buildFollowUpAvailability,
  loadFollowUpRunState,
  normalizeFollowUpSettings,
  presentFollowUpItem,
  recordFollowUpAssistance,
  respondToFollowUpItem,
  startFollowUpRun,
} from '../src/app/lib/masteryEvidence/followUps.service.js'

const migrationSource = readFileSync(new URL('../supabase/migrations/20260812090000_add_daily_followups_weekly_reviews.sql', import.meta.url), 'utf8')
const generatorSource = readFileSync(new URL('../src/app/api/facilitator/lessons/generate/route.js', import.meta.url), 'utf8')
const incrementalSource = readFileSync(new URL('../src/app/api/ai/lesson-generate/route.js', import.meta.url), 'utf8')
const learnSource = readFileSync(new URL('../src/app/learn/lessons/page.js', import.meta.url), 'utf8')
const reviewPageSource = readFileSync(new URL('../src/app/learn/follow-ups/[runId]/page.js', import.meta.url), 'utf8')
const reportUiSource = readFileSync(new URL('../src/app/facilitator/learners/[id]/transcripts/EvidenceHistorySection.jsx', import.meta.url), 'utf8')

const lesson = {
  id: 'fractions-review',
  title: 'Fractions',
  baseline: [{ id: 'baseline-1', question: 'What is a fraction?', expectedAny: ['part of a whole'] }],
  multiplechoice: [{ id: 'practice-1', question: 'Pick one half.', choices: ['1/2', '1/3'], correct: 0 }],
  test: [{ id: 'test-1', question: 'Which is one half?', choices: ['2/4', '1/4'], correct: 0 }],
  retention: [{ id: 'legacy-retention-1', question: 'Which equals 0.5?', expectedAny: ['1/2'] }],
  dailyFollowup: [{ id: 'daily-1', question: 'Name a fraction equal to one half.', expectedAny: ['1/2', '2/4'] }],
  weeklyReview: [
    { id: 'weekly-1', question: 'Which fraction is one half?', choices: ['3/4', '1/2'], correct: 1, expectedAny: ['1/2'] },
    { id: 'weekly-2', question: 'True or false: 2/4 equals one half.', answer: true, expectedAny: ['true'] },
  ],
}

function anchor(overrides = {}) {
  return {
    event_id: 'anchor-event-1',
    event_type: 'mastery_check_result',
    occurred_at: '2026-08-08T15:00:00.000Z',
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

function createRepository({ settings = {}, evidenceEvents = [anchor()] } = {}) {
  const data = {
    learner: {
      id: '11111111-1111-4111-8111-111111111111',
      facilitator_id: 'user-1',
      daily_followups_enabled: true,
      weekly_reviews_enabled: true,
      weekly_review_day: 'monday',
      ...settings,
    },
    evidenceEvents: [...evidenceEvents],
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
    async listReviewRuns({ userId, learnerId }) {
      return data.runs.filter((run) => run.facilitator_id === userId && run.learner_id === learnerId)
    },
    async listReviewItems({ userId, learnerId, runIds }) {
      return data.items.filter((item) => item.facilitator_id === userId && item.learner_id === learnerId && runIds.includes(item.run_id))
    },
    async listReviewEvents({ userId, learnerId, runIds }) {
      return data.events.filter((event) => event.facilitator_id === userId && event.learner_id === learnerId && runIds.includes(event.run_id))
    },
    async insertRun(run) { data.runs.push({ ...run }); return { ...run } },
    async findRunByCycle({ learnerId, reviewType, cycleKey }) {
      return data.runs.find((run) => run.learner_id === learnerId && run.review_type === reviewType && run.cycle_key === cycleKey) || null
    },
    async insertItems(items) { data.items.push(...items.map((item) => ({ ...item }))); return items },
    async getRun({ userId, runId }) {
      return data.runs.find((run) => run.id === runId && run.facilitator_id === userId) || null
    },
    async insertEvent(event) {
      const existing = data.events.find((entry) => entry.idempotency_key === event.idempotency_key)
      if (existing) return { ...existing, duplicate: true }
      const created = { event_id: `event-${data.events.length + 1}`, ...event }
      data.events.push(created)
      return created
    },
    async updateRun({ runId, updates }) {
      const run = data.runs.find((entry) => entry.id === runId)
      Object.assign(run, updates)
      return { ...run }
    },
    async updateSettings({ settings: patch }) {
      Object.assign(data.learner, patch)
      return { ...data.learner }
    },
  }
}

const loadLesson = async () => lesson
const userId = 'user-1'
const learnerId = '11111111-1111-4111-8111-111111111111'
const now = '2026-08-12T16:00:00.000Z'

test('new learner Follow-Up settings default off and normalize independently', () => {
  assert.deepEqual(normalizeFollowUpSettings({}), {
    daily_followups_enabled: false,
    weekly_reviews_enabled: false,
    weekly_review_day: 'friday',
  })
  assert.deepEqual(normalizeFollowUpSettings({ daily_followups_enabled: true }), {
    daily_followups_enabled: true,
    weekly_reviews_enabled: false,
    weekly_review_day: 'friday',
  })
})

test('Daily and Weekly plans use separate held-out pools and reject cross-role overlap', async () => {
  const daily = await buildDailyFollowUpPlan({ lessonKey: 'generated/fractions.json', lessonId: lesson.id, lessonData: lesson })
  const weekly = await buildWeeklyReviewPlan({ lessonKey: 'generated/fractions.json', lessonId: lesson.id, lessonData: lesson })
  assert.equal(daily.eligible, true)
  assert.equal(daily.selectedItems[0].sourceRole, 'daily_followup')
  assert.equal(weekly.eligible, true)
  assert.equal(weekly.selectedItems[0].sourceRole, 'weekly_review')

  const contaminated = await buildDailyFollowUpPlan({
    lessonKey: 'generated/fractions.json',
    lessonId: lesson.id,
    lessonData: { ...lesson, dailyFollowup: [lesson.weeklyReview[0]] },
  })
  assert.equal(contaminated.eligible, false)
  assert.equal(contaminated.reason, REVIEW_REASONS.ROLE_OVERLAP)
})

test('Daily requires a strict 24-hour delay and legacy or Daily results consume only Daily', () => {
  const base = anchor({ occurred_at: '2026-08-11T16:00:00.000Z' })
  assert.equal(selectDailyFollowUpAnchors({ evidenceEvents: [base], now: '2026-08-12T15:59:59.000Z' }).length, 0)
  assert.equal(selectDailyFollowUpAnchors({ evidenceEvents: [base], now: '2026-08-12T16:00:00.000Z' }).length, 1)
  assert.equal(selectDailyFollowUpAnchors({
    evidenceEvents: [base, { event_type: 'retention_check_result', retention_anchor_mastery_check_id: base.mastery_check_id }],
    now,
  }).length, 0)
  assert.equal(selectDailyFollowUpAnchors({
    evidenceEvents: [base],
    reviewResultEvents: [{ review_type: REVIEW_TYPES.WEEKLY_REVIEW, anchor_mastery_check_id: base.mastery_check_id }],
    now,
  }).length, 1)
})

test('intervening same-target instruction prevents a Daily opportunity', () => {
  const base = anchor({ occurred_at: '2026-08-10T12:00:00.000Z' })
  const instruction = {
    event_type: 'item_presented',
    occurred_at: '2026-08-11T12:00:00.000Z',
    assessment_role: 'instructional',
    concept_id: base.concept_id,
    lesson_key: base.lesson_key,
  }
  assert.equal(selectDailyFollowUpAnchors({ evidenceEvents: [base, instruction], now }).length, 0)
})

test('weekly cycle uses the profile timezone, remains current after a missed activation, and does not stack', () => {
  const cycle = buildWeeklyReviewCycle({ now: '2026-08-16T20:00:00.000Z', weekday: 'monday', timeZone: 'America/New_York' })
  assert.equal(cycle.cycleKey, 'America/New_York:2026-08-10')
  assert.equal(cycle.activationAt, '2026-08-10T04:00:00.000Z')
  assert.equal(cycle.nextActivationAt, '2026-08-17T04:00:00.000Z')
  assert.equal(cycle.active, true)
})

test('weekly anchor selection stays inside the prior local-week learning window', () => {
  const cycle = buildWeeklyReviewCycle({ now, weekday: 'monday', timeZone: 'America/New_York' })
  const inside = anchor({ mastery_check_id: 'inside', occurred_at: '2026-08-08T15:00:00.000Z' })
  const afterActivation = anchor({ mastery_check_id: 'after', occurred_at: '2026-08-11T15:00:00.000Z' })
  const tooOld = anchor({ mastery_check_id: 'old', occurred_at: '2026-08-02T15:00:00.000Z' })
  assert.deepEqual(selectWeeklyReviewAnchors({ evidenceEvents: [inside, afterActivation, tooOld], cycle }).map((item) => item.mastery_check_id), ['inside'])
})

test('availability can show Daily and Weekly together without making either a lesson', async () => {
  const repository = createRepository()
  const result = await buildFollowUpAvailability({ repository, userId, learnerId, loadLesson, now, includePrivate: true })
  assert.equal(result.kind, 'ok')
  assert.deepEqual(new Set(result.cards.map((card) => card.review_type)), new Set([REVIEW_TYPES.DAILY_FOLLOWUP, REVIEW_TYPES.WEEKLY_REVIEW]))
  assert.ok(result.cards.every((card) => card.item_count <= WEEKLY_REVIEW_MAX_ITEMS))
})

test('completing Daily does not consume Weekly and Weekly records prior Daily retrieval', async () => {
  const repository = createRepository()
  let availability = await buildFollowUpAvailability({ repository, userId, learnerId, loadLesson, now, includePrivate: true })
  const dailyCard = availability.cards.find((card) => card.review_type === REVIEW_TYPES.DAILY_FOLLOWUP)
  const dailyRun = await startFollowUpRun({ repository, userId, learnerId, card: dailyCard, now })
  let dailyState = await loadFollowUpRunState({ repository, userId, runId: dailyRun.id })
  await presentFollowUpItem({ repository, userId, runId: dailyRun.id, itemId: dailyState.currentItem.id, now })
  const dailyResult = await respondToFollowUpItem({ repository, userId, runId: dailyRun.id, itemId: dailyState.currentItem.id, response: '1/2', now })
  assert.equal(dailyResult.result.review_outcome, RETENTION_OUTCOMES.RETAINED)

  availability = await buildFollowUpAvailability({ repository, userId, learnerId, loadLesson, now, includePrivate: true })
  const weeklyCard = availability.cards.find((card) => card.review_type === REVIEW_TYPES.WEEKLY_REVIEW)
  assert.ok(weeklyCard)
  const weeklyRun = await startFollowUpRun({ repository, userId, learnerId, card: weeklyCard, now })
  let weeklyState = await loadFollowUpRunState({ repository, userId, runId: weeklyRun.id })
  await presentFollowUpItem({ repository, userId, runId: weeklyRun.id, itemId: weeklyState.currentItem.id, now })
  const weeklyResult = await respondToFollowUpItem({ repository, userId, runId: weeklyRun.id, itemId: weeklyState.currentItem.id, response: '1/2', now })
  assert.equal(weeklyResult.result.review_outcome, WEEKLY_REVIEW_OUTCOMES.DEMONSTRATED)
  assert.equal(weeklyResult.result.prior_daily_retrieval_observed, true)
})

test('Repeat is non-disqualifying but answer reveal makes the first response assisted', async () => {
  const repository = createRepository({ settings: { weekly_reviews_enabled: false } })
  const availability = await buildFollowUpAvailability({ repository, userId, learnerId, loadLesson, now, includePrivate: true })
  const run = await startFollowUpRun({ repository, userId, learnerId, card: availability.cards[0], now })
  let state = await loadFollowUpRunState({ repository, userId, runId: run.id })
  await presentFollowUpItem({ repository, userId, runId: run.id, itemId: state.currentItem.id, now })
  await recordFollowUpAssistance({ repository, userId, runId: run.id, itemId: state.currentItem.id, kind: 'repeat', now })
  await recordFollowUpAssistance({ repository, userId, runId: run.id, itemId: state.currentItem.id, kind: 'answer_reveal', now })
  const result = await respondToFollowUpItem({ repository, userId, runId: run.id, itemId: state.currentItem.id, response: '1/2', now })
  assert.equal(result.result.review_outcome, RETENTION_OUTCOMES.ASSISTED_REVIEW)
})

test('first response is durable and a repeated submission cannot overwrite the result', async () => {
  const repository = createRepository({ settings: { weekly_reviews_enabled: false } })
  const availability = await buildFollowUpAvailability({ repository, userId, learnerId, loadLesson, now, includePrivate: true })
  const run = await startFollowUpRun({ repository, userId, learnerId, card: availability.cards[0], now })
  const state = await loadFollowUpRunState({ repository, userId, runId: run.id })
  await presentFollowUpItem({ repository, userId, runId: run.id, itemId: state.currentItem.id, now })
  const first = await respondToFollowUpItem({ repository, userId, runId: run.id, itemId: state.currentItem.id, response: 'wrong', now })
  const second = await respondToFollowUpItem({ repository, userId, runId: run.id, itemId: state.currentItem.id, response: '1/2', now })
  assert.equal(first.result.review_outcome, RETENTION_OUTCOMES.NEEDS_REVIEW)
  assert.equal(second.kind, 'conflict')
  assert.equal(repository.data.events.filter((event) => event.event_type === 'learner_response').length, 1)
})

test('presentation revalidates prior exposure after selection and disabled settings block an unpresented item', async () => {
  const repository = createRepository({ settings: { weekly_reviews_enabled: false } })
  const availability = await buildFollowUpAvailability({ repository, userId, learnerId, loadLesson, now, includePrivate: true })
  const run = await startFollowUpRun({ repository, userId, learnerId, card: availability.cards[0], now })
  const state = await loadFollowUpRunState({ repository, userId, runId: run.id })
  repository.data.evidenceEvents.push({
    event_type: 'item_presented',
    occurred_at: now,
    stable_item_id: state.currentItem.stable_item_id,
    item_content_hash: state.currentItem.item_content_hash,
  })
  const exposed = await presentFollowUpItem({ repository, userId, runId: run.id, itemId: state.currentItem.id, now })
  assert.equal(exposed.reason, REVIEW_REASONS.PRIOR_EXPOSURE)

  repository.data.evidenceEvents.pop()
  repository.data.learner.daily_followups_enabled = false
  const disabled = await presentFollowUpItem({ repository, userId, runId: run.id, itemId: state.currentItem.id, now })
  assert.equal(disabled.kind, 'disabled')
})

test('run reads are account-scoped', async () => {
  const repository = createRepository()
  const availability = await buildFollowUpAvailability({ repository, userId, learnerId, loadLesson, now, includePrivate: true })
  const run = await startFollowUpRun({ repository, userId, learnerId, card: availability.cards[0], now })
  assert.equal((await loadFollowUpRunState({ repository, userId: 'user-2', runId: run.id })).kind, 'not_found')
})

test('Weekly qualification and outcome remain separate from Daily retention labels', () => {
  const qualified = qualifyWeeklyReviewOpportunity({
    anchor: anchor(),
    itemIdentity: { stableItemId: 'weekly-1', itemContentHash: 'hash-1' },
    itemExposureId: 'weekly-exposure-1',
  })
  assert.equal(qualified.eligible, true)
  assert.equal(classifyWeeklyReviewOutcome({ qualification: qualified, isCorrect: true }), WEEKLY_REVIEW_OUTCOMES.DEMONSTRATED)
  assert.equal(classifyWeeklyReviewOutcome({ qualification: qualified, isCorrect: false }), WEEKLY_REVIEW_OUTCOMES.NEEDS_REVIEW)
})

test('facilitator summary names protocols and shows Daily retrieval context for Weekly items', () => {
  const summary = buildReviewRunSummary({
    run: { id: 'run-1', review_type: REVIEW_TYPES.WEEKLY_REVIEW, protocol_version: WEEKLY_REVIEW_PROTOCOL_VERSION, status: 'completed' },
    items: [{ id: 'item-1', lesson_key: 'generated/fractions.json', anchor_mastery_check_id: 'mastery-check-1' }],
    events: [{ review_item_id: 'item-1', event_type: 'review_item_result', review_outcome: 'demonstrated', delay_seconds: 200000, prior_daily_retrieval_observed: true }],
  })
  assert.equal(summary.label, 'Weekly Review')
  assert.equal(summary.review.protocol_version, WEEKLY_REVIEW_PROTOCOL_VERSION)
  assert.equal(summary.items[0].prior_daily_retrieval_observed, true)
  assert.notEqual(DAILY_FOLLOWUP_PROTOCOL_VERSION, WEEKLY_REVIEW_PROTOCOL_VERSION)
})

test('instructional payload stripping removes every legacy, Daily, and Weekly reserved pool', () => {
  const view = buildInstructionalLessonView(lesson)
  assert.equal(view.test, undefined)
  assert.equal(view.retention, undefined)
  assert.equal(view.dailyFollowup, undefined)
  assert.equal(view.weeklyReview, undefined)
})

test('migration is additive, secure by default, and exposes no authenticated write policy', () => {
  assert.match(migrationSource, /daily_followups_enabled boolean not null default false/)
  assert.match(migrationSource, /weekly_reviews_enabled boolean not null default false/)
  assert.match(migrationSource, /learning_review_runs_unique_cycle/)
  assert.match(migrationSource, /enable row level security/)
  assert.match(migrationSource, /grant select on table public\.learning_review_events to authenticated/)
  assert.doesNotMatch(migrationSource, /grant (insert|update|delete)/i)
  assert.doesNotMatch(migrationSource, /for (insert|update|delete)/i)
})

test('generation, learner cards, focused flow, and reporting are wired without lesson reopening', () => {
  assert.match(generatorSource, /"dailyFollowup"/)
  assert.match(generatorSource, /"weeklyReview"/)
  assert.match(generatorSource, /"retention": \[/)
  assert.match(generatorSource, /existing in-session Stage 7 path/)
  assert.match(incrementalSource, /'dailyFollowup'/)
  assert.match(incrementalSource, /'weeklyReview'/)
  assert.match(learnSource, /followUpCards\.map/)
  assert.match(reviewPageSource, /Repeat/)
  assert.match(reviewPageSource, /Show answer/)
  assert.doesNotMatch(reviewPageSource, /Start Over/i)
  assert.match(reportUiSource, /Daily Follow-Up/)
  assert.match(reportUiSource, /Weekly Review/)
})
