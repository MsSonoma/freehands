import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLessonGeneratorReviewHref,
  buildLessonWorkflowReturnHref,
  normalizeLessonWorkflowSource,
} from '../facilitatorLessonWorkflow.mjs'

test('draft review links stay inside the Lesson Generator and preserve planning context', () => {
  const href = buildLessonGeneratorReviewHref({
    learnerId: 'learner-1',
    lessonKey: 'generated/division.json',
    source: 'syllabus',
    plannedDate: '2026-09-11',
    occurrenceId: 'forecast:lineage-1',
    expectedActiveRevisionId: 'revision-1',
  })
  const url = new URL(`http://localhost${href}`)
  assert.equal(url.pathname, '/facilitator/generator')
  assert.equal(url.searchParams.get('mode'), 'review')
  assert.equal(url.searchParams.get('source'), 'syllabus')
  assert.equal(url.searchParams.get('learnerId'), 'learner-1')
  assert.equal(url.searchParams.get('lessonKey'), 'generated/division.json')
  assert.equal(url.searchParams.get('plannedDate'), '2026-09-11')
  assert.equal(url.searchParams.get('occurrenceId'), 'forecast:lineage-1')
  assert.equal(url.searchParams.get('expectedActiveRevisionId'), 'revision-1')
})

test('workflow return destinations preserve exact planning focus', () => {
  const syllabus = new URL('http://localhost' + buildLessonWorkflowReturnHref({
    source: 'syllabus',
    learnerId: 'learner 1',
    plannedDate: '2026-09-11',
    lessonKey: 'generated/division.json',
    occurrenceId: 'forecast:lineage-1',
  }))
  assert.equal(syllabus.pathname, '/facilitator/syllabus')
  assert.equal(syllabus.searchParams.get('learnerId'), 'learner 1')
  assert.equal(syllabus.searchParams.get('date'), '2026-09-11')
  assert.equal(syllabus.searchParams.get('lessonKey'), 'generated/division.json')
  assert.equal(syllabus.searchParams.get('occurrenceId'), 'forecast:lineage-1')

  const calendar = new URL('http://localhost' + buildLessonWorkflowReturnHref({
    source: 'calendar', learnerId: 'learner 1', plannedDate: '2026-09-11', lessonKey: 'generated/division.json',
  }))
  assert.equal(calendar.pathname, '/facilitator/calendar')
  assert.equal(calendar.searchParams.get('learnerId'), 'learner 1')
  assert.equal(calendar.searchParams.get('date'), '2026-09-11')
  assert.equal(buildLessonWorkflowReturnHref({ source: 'library', learnerId: 'learner 1' }), '/facilitator/lessons')
})
test('unknown workflow sources fall back to the lesson library', () => {
  assert.equal(normalizeLessonWorkflowSource('other'), 'library')
  assert.equal(buildLessonWorkflowReturnHref({ source: 'other' }), '/facilitator/lessons')
})
