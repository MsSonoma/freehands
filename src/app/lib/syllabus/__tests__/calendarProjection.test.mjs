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

test('calendar projection includes the inactive AI forecast as provisional future planning without overriding active intent', () => {
  const timeline = [
    { occurrence_id: 'syllabus:active', lineage_id: 'active', planned_date: '2026-09-14', sort_order: 0, subject: 'Math', title: 'Educator plan' },
  ]
  const proposals = [
    { id: 'forecast-duplicate', lineage_id: 'forecast-duplicate', planned_date: '2026-09-14', sort_order: 0, subject: 'Math', title: 'Duplicate AI idea', origin: 'learning_forecast', lesson_key: null },
    { id: 'forecast-science', lineage_id: 'forecast-science', planned_date: '2026-09-16', sort_order: 0, subject: 'Science', title: 'Energy transfer', origin: 'learning_forecast', lesson_key: null },
    { id: 'forecast-off', lineage_id: 'forecast-off', planned_date: '2026-09-17', sort_order: 0, subject: 'History', title: 'Blocked suggestion', origin: 'learning_forecast', lesson_key: null },
  ]
  const grouped = groupSyllabusCalendarItems(timeline, { proposedForecastItems: proposals, noSchoolDates: [{ date: '2026-09-17' }] })
  assert.equal(grouped['2026-09-14'].length, 1)
  assert.equal(grouped['2026-09-14'][0].title, 'Educator plan')
  assert.equal(grouped['2026-09-16'][0].planning_state, 'forecast')
  assert.equal(grouped['2026-09-16'][0].presentation_kind, 'suggested_inactive')
  assert.equal(grouped['2026-09-17'], undefined)
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
  assert.equal(selection.suggested, false)
})

test('calendar selection marks forecast proposal lineage as suggested for the shared details overlay', () => {
  const selection = syllabusCalendarSelection({
    occurrence_id: 'forecast:lineage-1',
    lineage_id: 'lineage-1',
    planned_date: '2026-09-15',
    origin: 'learning_forecast',
    planning_state: 'forecast',
    presentation_kind: 'suggested_inactive',
    lesson_key: null,
  }, { today: '2026-09-10' })
  assert.equal(selection.suggested, true)
  assert.equal(selection.occurrenceKey, 'forecast:lineage-1')
})

test('calendar is a second view of the same Syllabus future plan and can refresh and act on provisional forecast lineage', () => {
  const calendar = source('facilitator/calendar/page.js')
  const month = source('facilitator/calendar/LessonCalendar.js')
  assert.match(calendar, /\/api\/syllabus\?learnerId=/)
  assert.match(calendar, /timeline_items/)
  assert.match(calendar, /proposed_learning_forecast/)
  assert.match(calendar, /fetch\('\/api\/syllabus\/forecast'/)
  assert.match(calendar, /buildAutomaticForecastAttemptIdentity/)
  assert.match(calendar, /\/api\/syllabus\/planning/)
  assert.match(calendar, /\/api\/syllabus\/materialize/)
  assert.match(calendar, /canChangeIntent=\{planningAccess\.can_change_intent\}/)
  assert.match(calendar, /onGenerateWithChanges=\{generateForecastWithChanges\}/)
  assert.match(month, /Forecast:/)
  assert.doesNotMatch(calendar, /Curriculum planning stays in Syllabus|Open in Syllabus to prepare this concept/)
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
  assert.match(mentorCalendar, /proposed_learning_forecast/)
  assert.match(mentorCalendar, /AI forecast suggestion/)
  assert.doesNotMatch(mentorCalendar, /planned-lessons|LessonPlanner|Planning changes belong in Syllabus/)
  assert.match(counselor, /Loading the Syllabus plan/)
  assert.match(counselor, /\/api\/syllabus\?learnerId=/)
  assert.doesNotMatch(counselor, /\/api\/planned-lessons/)
  assert.equal(fs.existsSync(path.join(appRoot, 'facilitator/calendar/LessonPlanner.jsx')), false)
  assert.equal(fs.existsSync(path.join(appRoot, 'facilitator/calendar/DayViewOverlay.jsx')), false)
})
