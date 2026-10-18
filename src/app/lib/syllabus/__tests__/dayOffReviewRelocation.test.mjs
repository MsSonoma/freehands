import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { buildSyllabusReviewProjection, buildDailyReviewCycles, buildWeeklyReviewCycles, resolveOneTimeReviewDate } from '../reviewProjection.mjs'
import { buildWeeklyReviewCycle, localReviewDateMidnight, selectDailyReviewAnchors } from '../../masteryEvidence/followUps.js'
import { buildFollowUpAvailability, selectScheduledWeeklyReviewCycles } from '../../masteryEvidence/followUps.service.js'

const zone = 'America/New_York'
const lesson = (id, date, options = {}) => ({
  id,
  occurrence_id: `syllabus:${id}`,
  lesson_key: `math/${id}.json`,
  title: `Lesson ${id}`,
  subject: 'Math',
  item_type: 'lesson',
  planned_date: date,
  readiness_state: 'completed',
  ...options,
})
const move = (source_date, destination_date) => ({ source_date, destination_date })
const settings = {
  daily_followups_enabled: true,
  weekly_reviews_enabled: true,
  weekly_review_day: 'friday',
}

test('Day Off carries Friday weekly review to Monday while retaining the original evidence cycle', () => {
  const original = lesson('earlier', '2026-10-12')
  const reviews = buildSyllabusReviewProjection({
    timelineItems: [original],
    settings,
    timeZone: zone,
    today: '2026-10-19',
    dayOffMoves: [move('2026-10-16', '2026-10-19')],
  })
  const weekly = reviews.weeklyReviewCycles.find((cycle) => cycle.sourceReviewDate === '2026-10-16')
  assert.equal(weekly?.reviewDate, '2026-10-19')
  assert.equal(weekly?.cycleKey, `${zone}:2026-10-16`)
  assert.equal(weekly?.windowStartDate, '2026-10-09')
  assert.equal(weekly?.windowEndDate, '2026-10-16')
  const cards = reviews.items.filter((row) => row.review_type === 'weekly_review')
  assert.equal(cards.some((row) => row.planned_date === '2026-10-16'), false)
  assert.equal(cards.some((row) => row.planned_date === '2026-10-19'
    && row.cycle_key === `${zone}:2026-10-16`), true)
})

test('moved daily review stays separate from a normal review on destination day', () => {
  const moved = lesson('moved', '2026-10-19', {
    metadata: { day_off_moves: [{ source_date: '2026-10-16', destination_date: '2026-10-19', source_sort_order: 0 }] },
  })
  const scheduled = lesson('normal', '2026-10-19')
  const projection = buildSyllabusReviewProjection({
    timelineItems: [moved, scheduled, lesson('earlier', '2026-10-12')],
    settings,
    timeZone: zone,
    today: '2026-10-19',
    dayOffMoves: [move('2026-10-16', '2026-10-19')],
  })
  const daily = projection.items.filter((row) => row.review_type === 'daily_review' && row.planned_date === '2026-10-19')
  assert.equal(daily.length, 2)
  const bySource = Object.fromEntries(daily.map((row) => [row.cycle_key, row]))
  assert.deepEqual(bySource[`${zone}:2026-10-16`].review_progress.lessons.map((item) => item.lesson_key), ['math/moved.json'])
  assert.deepEqual(bySource[`${zone}:2026-10-19`].review_progress.lessons.map((item) => item.lesson_key), ['math/normal.json'])
  assert.equal(projection.items.some((row) => row.review_type === 'daily_review' && row.planned_date === '2026-10-16'), false)
})

test('daily reviews moved onto the same day keep their own evidence even for the same concept', async () => {
  const moved = lesson('moved', '2026-10-19', {
    metadata: { day_off_moves: [{ source_date: '2026-10-16', destination_date: '2026-10-19' }] },
  })
  const normal = lesson('normal', '2026-10-19')
  const cycles = buildDailyReviewCycles({
    timelineItems: [moved, normal], enabled: true, timeZone: zone, today: '2026-10-19',
    dayOffMoves: [move('2026-10-16', '2026-10-19')],
  })
  const evidence = [
    { event_type: 'mastery_check_result', mastery_outcome: 'independent_success',
      concept_id: 'shared-concept', mastery_check_id: 'one', lesson_key: 'math/moved.json',
      lesson_id: 'moved', occurred_at: '2026-10-19T15:00:00Z' },
    { event_type: 'mastery_check_result', mastery_outcome: 'independent_success',
      concept_id: 'shared-concept', mastery_check_id: 'two', lesson_key: 'math/normal.json',
      lesson_id: 'normal', occurred_at: '2026-10-19T16:00:00Z' },
  ]
  const movedCycle = cycles.find((cycle) => cycle.cycleKey.endsWith('2026-10-16'))
  const normalCycle = cycles.find((cycle) => cycle.cycleKey.endsWith('2026-10-19'))
  assert.deepEqual(selectDailyReviewAnchors({ evidenceEvents: evidence, cycle: movedCycle }).map((event) => event.lesson_key), ['math/moved.json'])
  assert.deepEqual(selectDailyReviewAnchors({ evidenceEvents: evidence, cycle: normalCycle }).map((event) => event.lesson_key), ['math/normal.json'])
  const prefs = { daily_followups_enabled: true, weekly_reviews_enabled: false }
  const repo = {
    async findOwnedLearner() { return { id: 'learner', ...prefs } },
    async getProfileTimezone() { return zone },
    async listEvidenceEvents() { return evidence },
    async listReviewRuns() { return [] },
    async listReviewItems() { return [] },
    async listReviewEvents() { return [] },
    async listReviewTeacherPreferences() { return [] },
  }
  const availability = await buildFollowUpAvailability({
    repository: repo, userId: 'owner', learnerId: 'learner',
    now: '2026-10-19T17:00:00Z', dailyReviewCycles: cycles,
    loadLesson: async (key) => ({
      title: key,
      dailyReview: [{ id: key, question: `Explain one thing about ${key}.`, expectedAny: ['I can show what I learned with a clear example.'] }],
    }),
  })
  assert.deepEqual(availability.cards.filter((row) => row.review_type === 'daily_review')
    .map((row) => row.cycle_key).sort(), [
      `${zone}:2026-10-16`, `${zone}:2026-10-19`,
    ])
})

test('weekly review availability shifts to destination without changing the recurring weekday', () => {
  const source = { cycleKey: `${zone}:2026-10-16`, reviewDate: '2026-10-19', sourceReviewDate: '2026-10-16', ready: true }
  const normal = buildWeeklyReviewCycle({ now: '2026-10-17T12:00:00Z', weekday: 'friday', timeZone: zone })
  const before = selectScheduledWeeklyReviewCycles({
    projectedCycles: [source], normalCycle: normal,
    now: '2026-10-17T12:00:00Z', timeZone: zone,
  })
  assert.equal(before.length, 0, 'do not open the review on the Day Off')
  const after = selectScheduledWeeklyReviewCycles({
    projectedCycles: [source], normalCycle: normal,
    now: '2026-10-19T15:00:00Z', timeZone: zone,
  })
  assert.equal(after.length, 1)
  assert.equal(after[0].cycleKey, `${zone}:2026-10-16`)
  assert.equal(after[0].windowEnd, '2026-10-16T04:00:00.000Z')
  assert.equal(after[0].scheduledActivationAt, localReviewDateMidnight('2026-10-19', zone))
  assert.equal(after[0].scheduledActivationAt, '2026-10-19T04:00:00.000Z')
  assert.equal(normal.weekday, 'friday')
})

test('destination keeps both its regular weekly review and an earlier moved weekly review', () => {
  const projectedCycles = [
    { cycleKey: `${zone}:2026-10-16`, reviewDate: '2026-10-23', sourceReviewDate: '2026-10-16' },
    { cycleKey: `${zone}:2026-10-23`, reviewDate: '2026-10-23', sourceReviewDate: '2026-10-23' },
  ]
  const normalCycle = buildWeeklyReviewCycle({ now: '2026-10-23T17:00:00Z', weekday: 'friday', timeZone: zone })
  const selected = selectScheduledWeeklyReviewCycles({
    projectedCycles, normalCycle, now: '2026-10-23T17:00:00Z', timeZone: zone,
  })
  assert.deepEqual(selected.map((cycle) => cycle.cycleKey), [
    `${zone}:2026-10-16`, `${zone}:2026-10-23`,
  ])
  assert.equal(new Set(selected.map((cycle) => cycle.cycleKey)).size, 2)
})

test('learner review endpoint makes moved weekly review actionable on destination, not source', async () => {
  const timelineItems = [lesson('earlier', '2026-10-12')]
  const prefs = { daily_followups_enabled: false, weekly_reviews_enabled: true, weekly_review_day: 'friday' }
  const cycles = buildWeeklyReviewCycles({
    timelineItems, enabled: true, reviewDay: 'friday', timeZone: zone,
    dayOffMoves: [move('2026-10-16', '2026-10-19')],
  })
  const repository = {
    async findOwnedLearner() { return { id: 'learner', ...prefs } },
    async getProfileTimezone() { return zone },
    async listEvidenceEvents() { return [{
      event_type: 'mastery_check_result', mastery_outcome: 'independent_success',
      occurred_at: '2026-10-12T18:00:00.000Z', mastery_check_id: 'check-1',
      lesson_key: 'math/earlier.json', lesson_id: 'earlier', concept_id: 'concept-1',
    }] },
    async listReviewRuns() { return [] },
    async listReviewItems() { return [] },
    async listReviewEvents() { return [] },
    async listReviewTeacherPreferences() { return [] },
  }
  const options = {
    repository, userId: 'owner', learnerId: 'learner',
    weeklyReviewCycles: cycles, dailyReviewCycles: [],
    loadLesson: async () => ({
      title: 'Earlier lesson',
      weeklyReview: [{
        id: 'weekly-1', question: 'Which expression shows 3 groups of 4?',
        choices: ['3 + 4', '3 × 4', '3 - 4', '4 - 3'],
        correct: 1, expectedAny: ['3 × 4'],
      }],
    }),
  }
  const source = await buildFollowUpAvailability({ ...options, now: '2026-10-16T15:00:00Z' })
  assert.equal(source.cards.filter((card) => card.review_type === 'weekly_review').length, 0)
  const destination = await buildFollowUpAvailability({ ...options, now: '2026-10-19T15:00:00Z', includePrivate: true })
  const weekly = destination.cards.filter((card) => card.review_type === 'weekly_review')
  assert.equal(weekly.length, 1)
  assert.equal(weekly[0].cycle_key, `${zone}:2026-10-16`)
  assert.equal(weekly[0].item_count, 1)
  assert.equal(weekly[0]._cycle.scheduledActivationAt, '2026-10-19T04:00:00.000Z')
})

test('two successive one-time moves retain review identity while moving the occurrence again', () => {
  const moves = [
    move('2026-10-16', '2026-10-19'),
    move('2026-10-19', '2026-10-21'),
  ]
  assert.equal(resolveOneTimeReviewDate('2026-10-16', moves), '2026-10-21')
  const [weekly] = buildWeeklyReviewCycles({
    timelineItems: [lesson('earlier', '2026-10-12')],
    enabled: true,
    reviewDay: 'friday',
    timeZone: zone,
    dayOffMoves: moves,
  })
  assert.equal(weekly.cycleKey, `${zone}:2026-10-16`)
  assert.equal(weekly.reviewDate, '2026-10-21')
  const daily = buildDailyReviewCycles({
    timelineItems: [lesson('moved', '2026-10-21', {
      metadata: { day_off_moves: [
        { source_date: '2026-10-16', destination_date: '2026-10-19' },
        { source_date: '2026-10-19', destination_date: '2026-10-21' },
      ] },
    })],
    enabled: true,
    timeZone: zone,
    dayOffMoves: moves,
  })
  assert.equal(daily[0].cycleKey, `${zone}:2026-10-16`)
  assert.equal(daily[0].reviewDate, '2026-10-21')
})

test('API serves the same shifted cycles for calendar display and learner review actions', () => {
  const root = new URL('../../../', import.meta.url)
  const syllabusRoute = fs.readFileSync(new URL('api/syllabus/route.js', root), 'utf8')
  const reviewRoute = fs.readFileSync(new URL('api/learner/follow-ups/route.js', root), 'utf8')
  const repository = fs.readFileSync(new URL('lib/syllabus/supabaseRepository.server.mjs', root), 'utf8')
  const dayOffDialog = fs.readFileSync(new URL('components/syllabus/SyllabusDayActionDialog.js', root), 'utf8')
  assert.match(syllabusRoute, /dayOffMoves/)
  assert.match(syllabusRoute, /weeklyReviewCycles: preliminary\.weeklyReviewCycles/)
  assert.match(reviewRoute, /loadSyllabusReviewCyclesForLearner/)
  assert.match(reviewRoute, /weeklyReviewCycles/)
  assert.match(repository, /from\('syllabus_day_off_moves'\)/)
  assert.match(dayOffDialog, /lessons and Daily or Weekly Reviews/)
})
