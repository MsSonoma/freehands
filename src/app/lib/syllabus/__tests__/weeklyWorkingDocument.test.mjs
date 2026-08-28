import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { requestFacilitatorPinException } from '../../pinGate.js'
import { evaluateManualSyllabusPlacement, findSnapshotCapacityConflict, syllabusCapacitySlots } from '../capacity.mjs'
import { addWeeklyPatternSlot, removeWeeklyPatternSlot, weeklyPatternCapacity } from '../timeline.mjs'

const PATTERN = {
  monday: [{ subject: 'math' }, { subject: 'science' }],
  tuesday: [{ subject: 'math' }, { subject: 'math' }],
}

test('weekly pattern slots represent total daily and per-subject capacity', () => {
  assert.deepEqual(syllabusCapacitySlots(PATTERN, '2026-08-31').map((slot) => slot.subject), ['math', 'science'])
  assert.deepEqual(syllabusCapacitySlots(PATTERN, '2026-09-01').map((slot) => slot.subject), ['math', 'math'])
})

test('weekly pattern editor operations add and remove duplicate subject slots', () => {
  const withTwoMath = addWeeklyPatternSlot(addWeeklyPatternSlot({}, 'monday', 'math'), 'monday', 'math')
  assert.equal(weeklyPatternCapacity(withTwoMath, 'monday'), 2)
  assert.deepEqual(withTwoMath.monday, [{ subject: 'math' }, { subject: 'math' }])
  const withOneMath = removeWeeklyPatternSlot(withTwoMath, 'monday', 0)
  assert.deepEqual(withOneMath.monday, [{ subject: 'math' }])
  assert.equal(weeklyPatternCapacity(withTwoMath, 'monday'), 2)
})

test('automatic/manual normal placement cannot exceed daily or subject capacity', () => {
  const subjectFull = evaluateManualSyllabusPlacement({
    weeklyPattern: PATTERN, date: '2026-08-31', subject: 'math', lessonKey: 'math/new.json',
    intents: [{ id: 'math-1', lesson_key: 'math/one.json', subject: 'math', date: '2026-08-31' }],
  })
  assert.equal(subjectFull.allowed, false)
  assert.equal(subjectFull.conflict, 'subject_capacity')

  const dayFull = evaluateManualSyllabusPlacement({
    weeklyPattern: PATTERN, date: '2026-08-31', subject: 'math', lessonKey: 'math/new.json',
    intents: [
      { id: 'math-1', lesson_key: 'math/one.json', subject: 'math', date: '2026-08-31' },
      { id: 'science-1', lesson_key: 'science/one.json', subject: 'science', date: '2026-08-31' },
    ],
  })
  assert.equal(dayFull.allowed, false)
  assert.equal(dayFull.conflict, 'daily_capacity')
  assert.match(dayFull.message, /Facilitator PIN/)
})

test('a placement check is idempotent and never changes standing capacity', () => {
  const before = structuredClone(PATTERN)
  const result = evaluateManualSyllabusPlacement({
    weeklyPattern: PATTERN, date: '2026-08-31', subject: 'math', lessonKey: 'math/one.json',
    intents: [{ id: 'existing', lesson_key: 'math/one.json', subject: 'math', date: '2026-08-31' }],
  })
  assert.equal(result.allowed, true)
  assert.equal(result.idempotent, true)
  assert.deepEqual(PATTERN, before)
})

test('authored snapshot activation detects over-capacity placement without changing its pattern', () => {
  const snapshot = {
    weekly_pattern: { monday: [{ subject: 'math' }] },
    forecast_items: [
      { id: 'one', subject: 'math', planned_date: '2026-08-31', sort_order: 0 },
      { id: 'two', subject: 'math', planned_date: '2026-08-31', sort_order: 1 },
    ],
  }
  const before = structuredClone(snapshot.weekly_pattern)
  const conflict = findSnapshotCapacityConflict(snapshot)
  assert.equal(conflict.conflict, 'daily_capacity')
  assert.match(conflict.message, /Facilitator PIN/)
  assert.deepEqual(snapshot.weekly_pattern, before)
})

test('snapshot activation counts existing Calendar occupancy and reconciles one corresponding moved forecast', () => {
  const snapshot = {
    weekly_pattern: { monday: [{ subject: 'math' }] },
    forecast_items: [{ id: 'new', lesson_key: 'math/new.json', subject: 'math', planned_date: '2026-08-31' }],
  }
  const conflict = findSnapshotCapacityConflict(snapshot, {
    schedules: [{ id: 'calendar', lesson_key: 'math/existing.json', subject: 'math', scheduled_date: '2026-08-31' }],
  })
  assert.equal(conflict.conflict, 'daily_capacity')

  const moved = findSnapshotCapacityConflict(snapshot, {
    schedules: [{ id: 'moved', lesson_key: 'math/new.json', subject: 'math', scheduled_date: '2026-09-07' }],
  })
  assert.equal(moved, null)
})

test('explicit exception PIN verifies every requested departure and ignores cached facilitator state', async () => {
  let prompted = 0
  const pin = await requestFacilitatorPinException({
    isBrowser: true,
    isInFacilitatorSection: () => true,
    fetchServerPrefsAndHasPin: async () => ({ hasPin: true }),
    promptForPinMasked: async ({ message }) => { prompted += 1; assert.match(message, /planned for Thursday/); return '2468' },
    verifyPinServer: async (value) => value === '2468',
    message: 'This lesson is planned for Thursday. Enter the Facilitator PIN to do it today.',
  })
  assert.equal(pin, '2468')
  assert.equal(prompted, 1)
})

test('rejected or missing exception PIN leaves the action blocked', async () => {
  const rejected = await requestFacilitatorPinException({
    isBrowser: true,
    fetchServerPrefsAndHasPin: async () => ({ hasPin: true }),
    promptForPinMasked: async () => '0000',
    verifyPinServer: async () => false,
  })
  assert.equal(rejected, null)
  const missing = await requestFacilitatorPinException({
    isBrowser: true,
    fetchServerPrefsAndHasPin: async () => ({ hasPin: false }),
  })
  assert.equal(missing, null)
})

test('schedule mutation requires verified PIN only for an explicit capacity exception', () => {
  const route = fs.readFileSync(path.resolve('src/app/api/lesson-schedule/route.js'), 'utf8')
  assert.match(route, /SYLLABUS_CAPACITY_PIN_REQUIRED/)
  assert.match(route, /verifyFacilitatorPinForUser/)
  assert.match(route, /if \(!capacity\.allowed\)/)
  assert.match(route, /exceptionPin/)
  assert.doesNotMatch(route, /weekly_pattern\s*:/)
})

test('inference remains a read-only composition and has no lesson_schedule write', () => {
  const composer = fs.readFileSync(path.resolve('src/app/lib/syllabus/lessonTimeline.mjs'), 'utf8')
  assert.doesNotMatch(composer, /from\(['"]lesson_schedule|insert\(|upsert\(|update\(/)
})

test('facilitator Syllabus editor exposes daily capacity and duplicate-slot controls', () => {
  const page = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')
  assert.match(page, /two Math entries means two Math slots that day/i)
  assert.match(page, /addWeeklyPatternSlot/)
  assert.match(page, /removeWeeklyPatternSlot/)
  assert.match(page, /automatic lesson slot/)
})
