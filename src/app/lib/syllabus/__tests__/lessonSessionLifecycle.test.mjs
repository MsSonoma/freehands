import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { resolveLessonSessionLifecycle } from '../../lessonSessionLifecycle.mjs'

const ended = { id: 'session-1', started_at: '2026-08-27T14:00:00Z', ended_at: '2026-08-27T15:00:00Z' }

for (const [eventType, expected] of [
  ['completed', 'completed'],
  ['incomplete', 'incomplete'],
  ['restarted', 'incomplete'],
  ['exited', 'incomplete'],
]) {
  test(`explicit ${eventType} lifecycle evidence resolves as ${expected}`, () => {
    const result = resolveLessonSessionLifecycle(ended, [{ id: 'event-1', event_type: eventType, occurred_at: '2026-08-27T15:00:00Z' }])
    assert.equal(result.status, expected)
    assert.equal(result.legacyFallback, false)
  })
}

test('ended session without relevant lifecycle evidence keeps legacy completion fallback', () => {
  const result = resolveLessonSessionLifecycle(ended, [{ event_type: 'started', occurred_at: ended.started_at }])
  assert.equal(result.status, 'completed')
  assert.equal(result.legacyFallback, true)
})

test('open session remains in progress', () => {
  assert.equal(resolveLessonSessionLifecycle({ ...ended, ended_at: null }, []).status, 'in-progress')
})

test('learner-history and learner completion count consume the shared resolved status', () => {
  const route = fs.readFileSync(path.resolve('src/app/api/learner/lesson-history/route.js'), 'utf8')
  const lessons = fs.readFileSync(path.resolve('src/app/learn/lessons/page.js'), 'utf8')
  const webb = fs.readFileSync(path.resolve('src/app/session/webb/page.jsx'), 'utf8')
  const slate = fs.readFileSync(path.resolve('src/app/session/slate/page.jsx'), 'utf8')
  const counselorCalendar = fs.readFileSync(path.resolve('src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx'), 'utf8')
  assert.match(route, /resolveLessonSessionLifecycle\(session, eventsBySession\.get\(session\.id\) \|\| \[\]\)\.status/)
  assert.doesNotMatch(route, /status: endedAt \? 'completed'/)
  assert.match(lessons, /sonomaSessions\.filter\(s => s\.status === 'completed'\)/)
  assert.match(webb, /filter\(s => s\.status === 'completed'/)
  assert.match(slate, /filter\(s => s\.status === 'completed'/)
  assert.doesNotMatch(counselorCalendar, /endedAt \? 'completed'/)
})
