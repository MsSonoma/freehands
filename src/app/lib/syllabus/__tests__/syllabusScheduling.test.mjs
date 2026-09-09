import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  buildLessonSchedulePayload,
  buildSchedulableLessonOptions,
  canAddLessonToSyllabusDay,
  postLessonScheduleWithCapacityPin,
} from '../syllabusScheduling.mjs'

const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test('picker exposes canonical public keys and only approved facilitator lessons', () => {
  const options = buildSchedulableLessonOptions({
    publicLessonsBySubject: {
      math: [{ file: 'fractions.json', title: 'Fractions', grade: '5' }, { file: 'draft.json', title: 'Downloaded Draft' }],
      science: [{ file: 'water.json', title: 'Water Cycle', grade: '4' }],
    },
    facilitatorLessons: [
      { file: 'approved.json', title: 'Owned Ready', subject: 'language arts', approved: true, needsUpdate: false },
      { file: 'approved-update.json', title: 'Owned Ready Update', subject: 'math', approved: true, needsUpdate: true },
      { file: 'draft.json', title: 'Owned Draft', subject: 'math', approved: false },
    ],
  })
  assert.deepEqual(options.map((option) => option.lessonKey).sort(), [
    'generated/approved-update.json',
    'generated/approved.json',
    'math/fractions.json',
    'science/water.json',
  ])
  assert.equal(options.some((option) => option.lessonKey === 'generated/draft.json'), false)
  assert.equal(options.some((option) => option.lessonKey === 'math/draft.json'), false)
})

test('schedule payload preserves canonical placement fields and exact schedule row identity', () => {
  assert.deepEqual(buildLessonSchedulePayload({
    learnerId: LEARNER,
    lessonKey: 'math/fractions.json',
    scheduledDate: '2026-09-08',
  }), {
    learnerId: LEARNER,
    lessonKey: 'math/fractions.json',
    scheduledDate: '2026-09-08',
  })
  assert.deepEqual(buildLessonSchedulePayload({
    learnerId: LEARNER,
    lessonKey: 'generated/fractions.json',
    scheduledDate: '2026-09-09',
    scheduleId: 'schedule-1',
    forecastLineageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    exceptionPin: '2468',
  }), {
    learnerId: LEARNER,
    lessonKey: 'generated/fractions.json',
    scheduledDate: '2026-09-09',
    scheduleId: 'schedule-1',
    forecastLineageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    exceptionPin: '2468',
  })
})

test('forecast schedule migration adds nullable lineage and the partial learner-lineage uniqueness rule', () => {
  const sql = fs.readFileSync(new URL('../../../../../supabase/migrations/20260905120000_add_lesson_schedule_forecast_lineage.sql', import.meta.url), 'utf8')
  assert.match(sql, /add column if not exists forecast_lineage_id uuid/i)
  assert.match(sql, /unique index[\s\S]*\(learner_id, forecast_lineage_id\)[\s\S]*where forecast_lineage_id is not null/i)
  assert.doesNotMatch(sql, /foreign key|references syllabus_forecast_items/i)
})

test('only scheduling-authorized facilitators can add on current or future days', () => {
  assert.equal(canAddLessonToSyllabusDay({ role: 'facilitator', day: '2026-09-08', today: '2026-09-08', schedulingAllowed: true }), true)
  assert.equal(canAddLessonToSyllabusDay({ role: 'facilitator', day: '2026-09-09', today: '2026-09-08', schedulingAllowed: true }), true)
  assert.equal(canAddLessonToSyllabusDay({ role: 'facilitator', day: '2026-09-07', today: '2026-09-08', schedulingAllowed: true }), false)
  assert.equal(canAddLessonToSyllabusDay({ role: 'learner', day: '2026-09-09', today: '2026-09-08', schedulingAllowed: true }), false)
  assert.equal(canAddLessonToSyllabusDay({ role: 'facilitator', day: '2026-09-09', today: '2026-09-08', schedulingAllowed: false }), false)
})

test('capacity response requests the existing PIN exception and retries the identical placement once', async () => {
  const payloads = []
  const result = await postLessonScheduleWithCapacityPin({
    payload: buildLessonSchedulePayload({ learnerId: LEARNER, lessonKey: 'math/fractions.json', scheduledDate: '2026-09-08' }),
    postSchedule: async (payload) => {
      payloads.push(payload)
      return new Response(JSON.stringify(payloads.length === 1
        ? { code: 'SYLLABUS_CAPACITY_PIN_REQUIRED', error: 'Capacity exceeded' }
        : { success: true }), { status: payloads.length === 1 ? 409 : 200 })
    },
    requestPin: async (message) => { assert.equal(message, 'Capacity exceeded'); return '2468' },
  })
  assert.equal(result.response.status, 200)
  assert.deepEqual(payloads, [
    { learnerId: LEARNER, lessonKey: 'math/fractions.json', scheduledDate: '2026-09-08' },
    { learnerId: LEARNER, lessonKey: 'math/fractions.json', scheduledDate: '2026-09-08', exceptionPin: '2468' },
  ])
})

test('Syllabus placement uses the native dialog, canonical route, PIN retry, and authoritative reload', () => {
  const page = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  const detailOverlay = fs.readFileSync(new URL('../../../components/syllabus/FacilitatorSyllabusLessonOverlay.js', import.meta.url), 'utf8')
  const saveStart = page.indexOf('async function saveLessonSchedule')
  const saveSource = page.slice(saveStart, page.indexOf('async function handleLessonAction', saveStart))
  assert.match(document, />Add lesson</)
  assert.match(document, /canAddLessonToSyllabusDay/)
  assert.ok(!document.includes('const actionHref'))
  assert.ok(page.includes("if (['schedule', 'reschedule'].includes(action?.id))"))
  assert.ok(detailOverlay.includes("item.is_explicit_schedule ? 'Reschedule' : 'Schedule'"))
  assert.match(page, /SyllabusScheduleDialog/)
  assert.ok(saveSource.includes("fetch('/api/lesson-schedule'"))
  assert.ok(saveSource.includes('postLessonScheduleWithCapacityPin'))
  assert.ok(saveSource.includes('await loadCurrent(requestLearnerId)'))
  assert.doesNotMatch(saveSource, /setSyllabus|setLearningProposal|timeline_items/)
  assert.ok(page.includes('item?.is_explicit_schedule === true'))
  assert.ok(page.includes("item?.placement_kind === 'scheduled'"))
  assert.ok(detailOverlay.includes('Use existing lesson'))
  assert.match(page, /existingLessonKey/)
  assert.ok(page.includes('forecastLineageId: scheduleDialog.item?.forecast_lineage_id || scheduleDialog.item?.lineage_id'))
})
