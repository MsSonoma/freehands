import assert from 'node:assert/strict'
import test from 'node:test'
import { isUngeneratedSyllabusLesson, lessonGenerationPresentation, proposalForLesson, withLessonGenerationStates } from '../lessonGenerationState.mjs'
import { buildFuturePlanningProjection } from '../futurePlanningProjection.mjs'
const item = { lineage_id: 'same-lesson', origin: 'learning_forecast', item_type: 'lesson', planned_date: '2026-09-14', sort_order: 0, title: 'Fractions', lesson_key: null }
const proposal = { proposal_revision: { id: 'p1', base_revision_id: 'r1' }, forecast_items: [item] }
test('a selected forecast retries its active lineage, never a copied proposal with the same origin', () => {
  assert.equal(proposalForLesson(item, proposal, [], 'r1'), proposal)
  assert.equal(proposalForLesson(item, proposal, [item], 'r1'), null)
  assert.equal(proposalForLesson(item, proposal, [], 'r2'), null)
  assert.equal(proposalForLesson({ ...item, lineage_id: 'other' }, proposal, [], 'r1'), null)
})
test('safe persisted status maintains the one lesson identity without exposing errors or claiming approval', () => {
  const [failed] = withLessonGenerationStates([item], [{ lineage_id: item.lineage_id, status: 'generation_failed', last_error: 'SECRET URL', generation_input_hash: 'SECRET' }])
  assert.equal(failed.lineage_id, item.lineage_id)
  assert.equal(failed.planned_date, item.planned_date)
  assert.equal(lessonGenerationPresentation(failed).action, 'Retry generation')
  assert.equal(JSON.stringify(failed).includes('SECRET'), false)
  assert.equal(isUngeneratedSyllabusLesson(failed), true)
  const ready = { ...failed, lesson_key: 'generated/exact.json', readiness_state: 'draft' }
  assert.equal(isUngeneratedSyllabusLesson(ready), false)
  assert.equal(withLessonGenerationStates([ready], [{ lineage_id: item.lineage_id, status: 'bound' }])[0].readiness_state, 'draft')
})
test('ambiguous recovery blocks changes while an interrupted request offers deterministic resume', () => {
  assert.equal(lessonGenerationPresentation({ ...item, generation_status: 'recovery_required' }).blocked, true)
  assert.equal(lessonGenerationPresentation({ ...item, generation_status: 'generating' }).action, 'Resume generation')
  assert.equal(lessonGenerationPresentation({ ...item, generation_status: 'generating' }).canEdit, false)
})
test('active entry suppresses the same proposal lineage even if a stale proposal has another date', () => {
  const projection = buildFuturePlanningProjection({ timelineItems: [item], proposedForecastItems: [{ ...item, planned_date: '2026-09-15' }], rangeStart: '2026-09-14', rangeEnd: '2026-09-20' })
  assert.equal(projection.items.length, 1)
  assert.equal(projection.items[0].lineage_id, item.lineage_id)
})
