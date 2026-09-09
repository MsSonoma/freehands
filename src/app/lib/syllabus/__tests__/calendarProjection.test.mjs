import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { groupSyllabusCalendarItems, syllabusCalendarSelection } from '../calendarProjection.mjs'
import { resolveCalendarLandingParams } from '../../facilitatorCalendarLanding.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

test('calendar projection groups the canonical Syllabus timeline by date without dropping occurrence types', () => {
  const items = [
    { occurrence_id: 'syllabus:1', planned_date: '2026-09-10', sort_order: 1, title: 'Science', lesson_key: 'generated/science.json' },
    { occurrence_id: 'actual:2', planned_date: '2026-09-09', sort_order: 0, title: 'Math', actual_kind: 'completed', lesson_key: 'generated/math.json' },
    { occurrence_id: 'slate:3', planned_date: '2026-09-10', sort_order: 2, title: 'Science practice', item_type: 'slate_assignment', lesson_key: 'generated/science.json' },
    { occurrence_id: 'concept:4', planned_date: '2026-09-11', sort_order: 0, title: 'Writing concept' },
  ]
  const grouped = groupSyllabusCalendarItems(items)
  assert.deepEqual(Object.keys(grouped).sort(), ['2026-09-09', '2026-09-10', '2026-09-11'])
  assert.equal(grouped['2026-09-10'].length, 2)
  assert.equal(grouped['2026-09-10'][1].item_type, 'slate_assignment')
  assert.equal(grouped['2026-09-11'][0].lesson_key, undefined)
})

test('calendar lesson selection carries Syllabus occurrence authority into the shared overlay', () => {
  const selection = syllabusCalendarSelection({
    occurrence_id: 'syllabus:abc',
    planned_date: '2026-09-10',
    lesson_key: 'generated/fractions.json',
    readiness_state: 'draft',
    instructional_teacher: 'webb',
    placement_kind: 'syllabus',
  }, { today: '2026-09-09' })
  assert.equal(selection.occurrenceKey, 'syllabus:abc')
  assert.equal(selection.assignedTeacher, 'webb')
  assert.equal(selection.teacherEditable, true)
  assert.equal(selection.syllabus_state, 'future_unfinished')
})

test('calendar production surface reads Syllabus and no longer owns planned_lessons', () => {
  const calendar = source('facilitator/calendar/page.js')
  assert.match(calendar, /\/api\/syllabus\?learnerId=/)
  assert.match(calendar, /timeline_items/)
  assert.match(calendar, /FacilitatorSyllabusLessonOverlay/)
  assert.doesNotMatch(calendar, /\/api\/planned-lessons/)
  assert.doesNotMatch(calendar, /LessonPlanner/)
  assert.doesNotMatch(calendar, /savePlannedLessons|loadPlannedLessons/)
  assert.doesNotMatch(calendar, /ensurePinAllowed/)
})

test('legacy Calendar authoring URLs resolve to Syllabus', () => {
  assert.equal(resolveCalendarLandingParams('tab=planner').redirectToSyllabus, true)
  assert.equal(resolveCalendarLandingParams('tab=subjects').redirectToSyllabus, true)
  assert.equal(resolveCalendarLandingParams('portfolio=1').openPortfolio, true)
  assert.equal(resolveCalendarLandingParams('').redirectToSyllabus, false)
})

test('production navigation no longer links to Calendar Planner or Calendar Custom Subjects', () => {
  const home = source('facilitator/page.js')
  const generator = source('facilitator/generator/page.js')
  assert.doesNotMatch(home, /calendar\?tab=planner|calendar\?tab=subjects/)
  assert.doesNotMatch(generator, /calendar\?tab=planner/)
  assert.match(generator, /\/facilitator\/syllabus/)
})
test('Mentor calendar and reporting use the canonical Syllabus instead of planned_lessons', () => {
  const mentorCalendar = source('facilitator/generator/counselor/overlays/CalendarOverlay.jsx')
  const counselor = source('facilitator/generator/counselor/CounselorClient.jsx')
  assert.match(mentorCalendar, /\/api\/syllabus\?learnerId=/)
  assert.doesNotMatch(mentorCalendar, /planned-lessons|LessonPlanner/)
  assert.match(counselor, /Loading the Syllabus plan/)
  assert.match(counselor, /\/api\/syllabus\?learnerId=/)
  assert.doesNotMatch(counselor, /\/api\/planned-lessons/)
  assert.equal(fs.existsSync(path.join(appRoot, 'facilitator/calendar/LessonPlanner.jsx')), false)
  assert.equal(fs.existsSync(path.join(appRoot, 'facilitator/calendar/DayViewOverlay.jsx')), false)
})
