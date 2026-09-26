import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchForecastJson } from '../forecastClient.mjs'
import { isCurrentLearnerSnapshot, resolveSyllabusSelection, lessonMutationBlockReason } from '../interactionState.mjs'
import { buildLessonWorkflowReturnHref } from '../../facilitatorLessonWorkflow.mjs'

const lesson = { lineage_id: 'lineage-a', item_type: 'lesson', origin: 'learning_forecast', planned_date: '2026-09-14', title: 'Fractions', lesson_key: null }
const snapshot = (items = []) => ({ has_active_syllabus: true, active_revision: { id: 'revision' }, syllabus: { learner_id: 'learner' }, forecast_items: items, timeline_items: items, resolved_today: '2026-09-14' })

test('forecast timeout releases a hung request, including its body, and aborts transport', async () => {
  for (const bodyStalls of [false, true]) {
    let signal
    const fetchImpl = async (_, options) => {
      signal = options.signal
      return bodyStalls ? { json: () => new Promise(() => {}) } : new Promise(() => {})
    }
    await assert.rejects(fetchForecastJson('/forecast', {}, { timeoutMs: 10, fetchImpl }), { name: 'TimeoutError' })
    assert.equal(signal.aborted, true)
  }
})
test('successful forecast retains body, response status, and clears the timeout', async () => {
  let signal
  const result = await fetchForecastJson('/forecast', {}, { timeoutMs: 15, fetchImpl: async (_, options) => {
    signal = options.signal
    return { ok: true, status: 200, json: async () => ({ kind: 'proposal' }) }
  } })
  assert.equal(result.json.kind, 'proposal')
  assert.equal(result.response.status, 200)
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.equal(signal.aborted, false)
})
test('learner-switch cancellation releases a hung forecast and does not report success', async () => {
  const controller = new AbortController()
  const pending = fetchForecastJson('/forecast', { signal: controller.signal }, { timeoutMs: 1000, fetchImpl: () => new Promise(() => {}) })
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})
test('HTTP and transport failures remain failures rather than empty successful forecasts', async () => {
  const { response, json } = await fetchForecastJson('/forecast', {}, { fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({ error: 'failed' }) }) })
  assert.equal(response.ok, false)
  assert.equal(json.error, 'failed')
  await assert.rejects(fetchForecastJson('/forecast', {}, { fetchImpl: async () => { throw new Error('offline') } }), /offline/)
})
test('only a full snapshot for the requested learner is used as a mutation response', () => {
  assert.equal(isCurrentLearnerSnapshot(snapshot(), 'learner'), true)
  assert.equal(isCurrentLearnerSnapshot(snapshot(), 'other'), false)
  assert.equal(isCurrentLearnerSnapshot({ ...snapshot(), timeline_items: null }, 'learner'), false)
  assert.equal(isCurrentLearnerSnapshot({ ...snapshot(), active_revision: null }, 'learner'), false)
})
test('open details follow the exact lesson from suggestion to draft to approved without reload', () => {
  const original = { item: lesson, suggested: true }
  assert.equal(resolveSyllabusSelection(original, snapshot(), [lesson]), original)
  const draft = { ...lesson, occurrence_id: 'actual-slot', lesson_key: 'generated/fractions.json', readiness_state: 'draft' }
  const selected = resolveSyllabusSelection(original, snapshot([draft]))
  assert.equal(selected.item.lesson_key, draft.lesson_key)
  assert.equal(selected.suggested, false)
  const approved = resolveSyllabusSelection(selected, snapshot([{ ...draft, readiness_state: 'approved' }]))
  assert.equal(approved.item.readiness_state, 'approved')
  assert.equal(approved.item.lineage_id, lesson.lineage_id)
})
test('removed or ambiguous entries close rather than retaining stale mutation controls', () => {
  assert.equal(resolveSyllabusSelection({ item: lesson }, snapshot()), null)
  assert.equal(resolveSyllabusSelection({ item: lesson }, snapshot([{ ...lesson }, { ...lesson }])), null)
})
test('historical selection never switches to a future repeat with the same lineage', () => {
  const historical = { ...lesson, occurrence_id: 'history-1', historical_record: true }
  assert.equal(resolveSyllabusSelection({ item: historical }, snapshot([{ ...lesson, occurrence_id: 'future-1' }])), null)
})
test('forecast refresh restricts provisional writes only; active and draft details stay usable', () => {
  assert.match(lessonMutationBlockReason({ item: lesson, suggested: true, forecastBusy: true }), /refreshing/)
  assert.equal(lessonMutationBlockReason({ item: lesson, suggested: false, forecastBusy: true }), '')
  assert.equal(lessonMutationBlockReason({ item: { ...lesson, lesson_key: 'generated/a.json' }, suggested: false, materializingLineage: 'other' }), '')
})
test('generation blocks conflicting writes with an explanation, not opening details', () => {
  assert.match(lessonMutationBlockReason({ item: lesson, materializingLineage: lesson.lineage_id }), /keep reading/)
  assert.match(lessonMutationBlockReason({ item: lesson, materializingLineage: 'other' }), /details stay available/)
  assert.equal(lessonMutationBlockReason({ item: lesson }), '')
})
test('completed approval returns exact context without automatically reopening review', () => {
  const url = new URL('https://app.test' + buildLessonWorkflowReturnHref({ source: 'syllabus', learnerId: 'learner', plannedDate: lesson.planned_date, lessonKey: 'generated/a.json', occurrenceId: 'slot', reviewComplete: true }))
  assert.equal(url.pathname, '/facilitator')
  assert.equal(url.searchParams.get('review'), 'complete')
  assert.equal(url.searchParams.get('learnerId'), 'learner')
  assert.equal(url.searchParams.get('date'), lesson.planned_date)
  assert.equal(url.searchParams.get('occurrenceId'), 'slot')
})
test('open details promote a completed planned occurrence to its canonical actual record', () => {
  const planned = {
    ...lesson,
    occurrence_id: 'syllabus:planned-1',
    lesson_key: 'generated/fractions.json',
    readiness_state: 'approved',
    assigned_instructional_teacher: 'sonoma',
  }
  const actual = {
    ...planned,
    occurrence_id: 'actual:session-1',
    source_occurrence_id: 'syllabus:planned-1',
    placement_kind: 'actual',
    actual_kind: 'completed',
    readiness_state: 'completed',
    actual_instructional_teacher: 'webb',
    actual_at: '2026-09-14T16:00:00Z',
  }
  const selected = resolveSyllabusSelection({
    item: planned,
    suggested: false,
    currentLesson: { hasProgress: true, hasLessonArtifact: true },
    historicalActivityAllowed: true,
    assignedTeacher: 'sonoma',
  }, snapshot([actual]))
  assert.equal(selected.item.occurrence_id, 'actual:session-1')
  assert.equal(selected.syllabus_state, 'completed_historical')
  assert.equal(selected.assignedTeacher, 'webb')
  assert.equal(selected.currentLesson.hasProgress, false)
  assert.equal(selected.historicalActivityAllowed, false)
  assert.equal(selected.teacherEditable, false)
})