import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { GET, POST, DELETE } from '../../../api/no-school-dates/route.js'
import { buildFuturePlanningProjection } from '../futurePlanningProjection.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function deps({ owned = true } = {}) {
  const state = { dates: [{ id: 'date-1', date: '2026-09-14', reason: 'Holiday: Family day' }], writes: [], deletes: [] }
  return {
    state,
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: {
      async findOwnedLearner(id, owner) { return owned && id === LEARNER && owner === FACILITATOR ? { id } : null },
      async listNoSchoolDates() { return structuredClone(state.dates) },
      async upsertNoSchoolDate(row) { state.writes.push(structuredClone(row)); return { id: 'saved', ...row } },
      async deleteNoSchoolDate(owner, id, date) { state.deletes.push({ owner, id, date }); return { id: 'deleted' } },
    },
  }
}

test('hardened no-school API validates ownership and date while preserving facilitator authorship', async () => {
  const allowed = deps()
  const get = await GET(new Request(`http://local/api/no-school-dates?learnerId=${LEARNER}`), allowed)
  assert.equal(get.status, 200)
  assert.deepEqual((await get.json()).dates.map((row) => row.date), ['2026-09-14'])

  const post = await POST(new Request('http://local/api/no-school-dates', { method: 'POST', body: JSON.stringify({ learnerId: LEARNER, date: '2026-09-15', reason: 'Day off: Travel' }) }), allowed)
  assert.equal(post.status, 200)
  assert.deepEqual(allowed.state.writes[0], { facilitator_id: FACILITATOR, learner_id: LEARNER, date: '2026-09-15', reason: 'Day off: Travel' })

  const del = await DELETE(new Request(`http://local/api/no-school-dates?learnerId=${LEARNER}&date=2026-09-15`, { method: 'DELETE' }), allowed)
  assert.equal(del.status, 200)
  assert.deepEqual(allowed.state.deletes[0], { owner: FACILITATOR, id: LEARNER, date: '2026-09-15' })

  const forbidden = await GET(new Request(`http://local/api/no-school-dates?learnerId=${LEARNER}`), deps({ owned: false }))
  assert.equal(forbidden.status, 403)
  const invalid = await POST(new Request('http://local/api/no-school-dates', { method: 'POST', body: JSON.stringify({ learnerId: LEARNER, date: '2026-02-31' }) }), allowed)
  assert.equal(invalid.status, 400)
})

test('future planning excludes no-school dates from recurring open slots', () => {
  const plan = buildFuturePlanningProjection({
    weeklyPattern: { monday: [{ subject: 'Math' }], tuesday: [{ subject: 'Science' }] },
    timelineItems: [],
    proposedForecastItems: [],
    noSchoolDates: [{ date: '2026-09-08', reason: 'Holiday' }],
    rangeStart: '2026-09-07',
    rangeEnd: '2026-09-13',
    today: '2026-09-01',
    includeOpenSlots: true,
  })
  assert.equal(plan.open_slots.some((slot) => slot.planned_date === '2026-09-08'), false)
  assert.equal(plan.open_slots.some((slot) => slot.planned_date === '2026-09-07' && slot.subject === 'Math'), true)
})
test('Syllabus and Calendar share day actions and all new instructional write paths recognize no-school authority', () => {
  const root = new URL('../../../', import.meta.url)
  const source = (relative) => fs.readFileSync(new URL(relative, root), 'utf8')
  const document = source('components/syllabus/SyllabusDocument.js')
  const dialog = source('components/syllabus/SyllabusDayActionDialog.js')
  const syllabusPage = source('facilitator/syllabus/page.js')
  const calendarPage = source('facilitator/calendar/page.js')
  const calendar = source('facilitator/calendar/LessonCalendar.js')
  const schedule = source('api/lesson-schedule/route.js')
  const slate = source('api/syllabus/slate-assignments/route.js')
  const materialization = source('lib/syllabus/materialization.server.mjs')
  assert.match(document, />\+<\/button>/)
  assert.match(calendar, />\+<\/button>/)
  for (const page of [syllabusPage, calendarPage]) {
    assert.match(page, /SyllabusDayActionDialog/)
    assert.match(page, /\/facilitator\/generator\?/)
    assert.match(page, /plannedDate/)
    assert.match(page, /expectedActiveRevisionId/)
    assert.match(page, /\/api\/no-school-dates/)
  }
  const generator = source('facilitator/generator/page.js')
  assert.match(generator, /Lesson generator mode/)
  assert.match(generator, />Simple<\/button>/)
  assert.match(generator, />Detailed<\/button>/)
  assert.match(generator, /action: 'create_day'/)
  assert.match(generator, /generationSpec/)
  assert.doesNotMatch(dialog, /Lesson title|Brief description/)
  for (const text of [dialog, schedule, slate, materialization]) assert.match(text, /day off|no-school|NO_SCHOOL_DATE/i)
})
