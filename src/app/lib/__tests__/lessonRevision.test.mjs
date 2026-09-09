import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  lessonRevisionAvailabilityTransition,
  lessonRevisionSessionIsActive,
} from '../lessonRevision.server.mjs'

test('lesson revision revokes learner availability without removing unrelated lessons', () => {
  const result = lessonRevisionAvailabilityTransition({
    'generated/fractions.json': true,
    'math/geometry.json': true,
  }, 'generated/fractions.json')
  assert.equal(result.changed, true)
  assert.equal(result.approvedLessons['generated/fractions.json'], undefined)
  assert.equal(result.approvedLessons['math/geometry.json'], true)
})

test('lesson revision availability transition is a no-op when artifact is not exposed', () => {
  const result = lessonRevisionAvailabilityTransition({ 'math/geometry.json': true }, 'generated/fractions.json')
  assert.equal(result.changed, false)
  assert.deepEqual(result.approvedLessons, { 'math/geometry.json': true })
})

test('lesson revision blocks a live teaching lease but ignores an expired lease', () => {
  const now = new Date('2026-09-09T14:00:00.000Z')
  assert.equal(lessonRevisionSessionIsActive({ ended_at: null, last_activity_at: '2026-09-09T13:58:00.000Z' }, { now }), true)
  assert.equal(lessonRevisionSessionIsActive({ ended_at: null, last_activity_at: '2026-09-09T13:50:00.000Z' }, { now }), false)
  assert.equal(lessonRevisionSessionIsActive({ ended_at: '2026-09-09T13:59:00.000Z', last_activity_at: '2026-09-09T13:58:00.000Z' }, { now }), false)
})

test('canonical revision source protects historical lesson artifacts', () => {
  const source = fs.readFileSync(new URL('../lessonRevision.server.mjs', import.meta.url), 'utf8')
  assert.match(source, /LESSON_REVISION_HISTORICAL_ARTIFACT/)
  assert.match(source, /already has learner-session evidence/)
})

test('request-changes resets shared state before writing revised content', () => {
  const source = fs.readFileSync(new URL('../../api/facilitator/lessons/request-changes/route.js', import.meta.url), 'utf8')
  assert.match(source, /revised\.approved = false/)
  assert.match(source, /synchronizeLessonRevisionState/)
  assert.match(source, /LESSON_REVISION_STORAGE_FAILED/)
  assert.ok(source.indexOf('await synchronize({') < source.indexOf('lessonStorage.update('))
})

test('all generated lesson surfaces use the shared regeneration dialog', () => {
  const files = [
    '../../components/syllabus/FacilitatorSyllabusLessonOverlay.js',
    '../../facilitator/prepare/page.js',
    '../../facilitator/generator/page.js',
    '../../facilitator/lessons/page.js',
    '../../facilitator/calendar/page.js',
    '../../facilitator/calendar/DayViewOverlay.jsx',
    '../../facilitator/generator/counselor/overlays/GeneratedLessonsOverlay.jsx',
  ]
  for (const path of files) {
    const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /LessonRevisionDialog/, path)
    assert.match(source, /Regenerate with changes|revisionTarget|revisionOpen/, path)
  }
})

test('calendar distinguishes concept revision from generated lesson regeneration', () => {
  const source = fs.readFileSync(new URL('../../facilitator/calendar/DayViewOverlay.jsx', import.meta.url), 'utf8')
  assert.match(source, /Lesson plan revision notes \(optional\)/)
  assert.match(source, /Revise lesson plan/)
  assert.match(source, /Regenerate with changes/)
  assert.doesNotMatch(source, /Redo prompt update \(optional\)/)
  const mentorCalendar = fs.readFileSync(new URL('../../facilitator/generator/counselor/overlays/CalendarOverlay.jsx', import.meta.url), 'utf8')
  assert.match(mentorCalendar, /Lesson plan revision notes \(optional\)/)
  assert.match(mentorCalendar, /Revise lesson plan/)
  assert.doesNotMatch(mentorCalendar, /Redo prompt update \(optional\)/)
})