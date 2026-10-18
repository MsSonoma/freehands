import assert from 'node:assert/strict'
import test from 'node:test'

import {
  visiblePlanningOccurrences,
  visibleLessonTimeline,
  removedEvidenceSessionIds,
  removedTimelineSessionIds,
  removedLessonBlocksInference,
} from '../lessonRemovalProjection.mjs'

const key = 'generated/fractions.json'
const removal = (overrides = {}) => ({
  lesson_key: key,
  occurrence_id: 'actual:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  source_occurrence_id: 'scheduled:plan-1',
  evidence_disposition: 'keep',
  execution_session_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  ...overrides,
})

test('removing a started attempt hides it and its source, not sibling attempts or other lessons', () => {
  const source = { lesson_key: key, occurrence_id: 'scheduled:plan-1' }
  const first = { lesson_key: key, occurrence_id: removal().occurrence_id, source_occurrence_id: source.occurrence_id }
  const sibling = { lesson_key: key, occurrence_id: 'actual:other-attempt', source_occurrence_id: source.occurrence_id }
  const unrelated = { lesson_key: 'generated/geometry.json', occurrence_id: first.occurrence_id }
  assert.deepEqual(visibleLessonTimeline([source, first, sibling, unrelated], [removal()]), [sibling, unrelated])
})

test('removing a parent occurrence hides its linked actual attempts without hiding other plans', () => {
  const row = removal({ occurrence_id: 'scheduled:plan-1', source_occurrence_id: 'scheduled:plan-1' })
  const items = [
    { lesson_key: key, occurrence_id: 'scheduled:plan-1' },
    { lesson_key: key, occurrence_id: 'actual:attempt-1', source_occurrence_id: 'scheduled:plan-1' },
    { lesson_key: key, occurrence_id: 'slate-completion:review-1', syllabus_occurrence_id: 'scheduled:plan-1' },
    { lesson_key: key, occurrence_id: 'scheduled:plan-2' },
  ]
  assert.deepEqual(visibleLessonTimeline(items, [row]), [items[3]])
})

test('hidden forecast lineages do not reappear in a later revision', () => {
  const rows = [
    { lesson_key: key, id: 'forecast-new', lineage_id: 'lineage-1' },
    { lesson_key: key, id: 'forecast-sibling', lineage_id: 'lineage-2' },
    { lesson_key: 'generated/other.json', id: 'forecast-new', lineage_id: 'lineage-1' },
  ]
  const marker = removal({ source_occurrence_id: 'syllabus:forecast-old', forecast_lineage_id: 'lineage-1' })
  assert.deepEqual(visiblePlanningOccurrences(rows, [marker], 'syllabus'), [rows[1], rows[2]])
})

test('scheduled source removal is scoped to one exact schedule ID', () => {
  const plans = [
    { lesson_key: key, id: 'plan-1' },
    { lesson_key: key, id: 'plan-2' },
  ]
  assert.deepEqual(visiblePlanningOccurrences(plans, [removal()], 'scheduled'), [plans[1]])
})

test('keeping evidence removes the session from the timetable, not the mastery evidence archive', () => {
  assert.equal(removedEvidenceSessionIds([removal()]).size, 0)
  assert.deepEqual([...removedTimelineSessionIds([removal()])], removal().execution_session_ids)
  assert.equal(removedLessonBlocksInference(key, [removal()]), true)
})

test('deleting evidence excludes only named source session IDs', () => {
  const deleted = removal({ evidence_disposition: 'delete' })
  assert.deepEqual([...removedEvidenceSessionIds([deleted])], deleted.execution_session_ids)
  assert.equal(removedLessonBlocksInference(key, [deleted]), true)
  assert.equal(removedLessonBlocksInference('generated/other.json', [deleted]), false)
})

test('a hidden historical lesson does not become a new inferred lesson when the evidence is retained', () => {
  const item = { lesson_key: key, occurrence_id: 'historical:record-1', placement_kind: 'historical' }
  const marker = removal({
    occurrence_id: item.occurrence_id,
    source_occurrence_id: 'syllabus:previous-plan',
    evidence_disposition: 'keep',
    execution_session_ids: [],
  })
  assert.deepEqual(visibleLessonTimeline([item], [marker]), [])
  assert.equal(removedLessonBlocksInference(key, [marker]), true)
})
