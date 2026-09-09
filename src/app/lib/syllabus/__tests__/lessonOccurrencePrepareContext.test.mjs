import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const facilitatorPageSource = fs.readFileSync(
  new URL('../../../facilitator/syllabus/page.js', import.meta.url),
  'utf8',
)
const prepareSource = fs.readFileSync(
  new URL('../../../facilitator/prepare/page.js', import.meta.url),
  'utf8',
)

function sourceBetween(source, startMarker, endMarker) {
  const normalizedSource = source.replace(/\r\n/g, '\n')
  const start = normalizedSource.indexOf(startMarker)
  const end = normalizedSource.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`)
  return normalizedSource.slice(start, end)
}

const lessonWorkflowSource = sourceBetween(
  facilitatorPageSource,
  'function openFacilitatorLessonWorkflow(item) {',
  '\n\n  function openReviewHistory',
)
const occurrenceContextSource = sourceBetween(
  lessonWorkflowSource,
  'const occurrenceId =',
  '\n    router.push',
)
const initialUrlParsingSource = sourceBetween(
  prepareSource,
  'const params = new URLSearchParams(window.location.search)',
  '\n        if (paramOriginalScheduledDate)',
)
const persistSource = sourceBetween(
  prepareSource,
  'function persist(nextStage, extras = {}) {',
  '\n  function activeBoundaries()',
)
const reassignmentSource = sourceBetween(
  prepareSource,
  'const reassigned = reassignPreparationSnapshotLearner({',
  '\n    }, learnerId)',
)

test('Prepare occurrenceId comes only from a non-empty item.occurrence_id', () => {
  assert.match(occurrenceContextSource, /String\(item\.occurrence_id \|\| ''\)\.trim\(\)/)
  assert.match(occurrenceContextSource, /occurrenceId=\$\{encodeURIComponent\(occurrenceId\)\}/)
})

test('Prepare expectedActiveRevisionId comes from revision.id', () => {
  assert.match(lessonWorkflowSource, /const revisionId = String\(syllabus\?\.active_revision\?\.id \|\| ''\)\.trim\(\)/)
  assert.match(occurrenceContextSource, /expectedActiveRevisionId=\$\{encodeURIComponent\(revisionId\)\}/)
})

test('schedule and reschedule stay native while the detail-overlay Prepare workflow keeps occurrence context', () => {
  assert.match(facilitatorPageSource, /if \(\['schedule', 'reschedule'\]\.includes\(action\?\.id\)\)/)
  assert.doesNotMatch(lessonWorkflowSource, /scheduleId=|originalScheduledDate=/)
  assert.match(lessonWorkflowSource, /facilitator\/prepare\?[^\r\n]+\$\{occurrenceContext\}/)
})

test('item.id is not a fallback for occurrenceId', () => {
  assert.doesNotMatch(occurrenceContextSource, /item\.id/)
})

test('lineage_id is not exact occurrence authority', () => {
  assert.doesNotMatch(occurrenceContextSource, /lineage_id/)
})

test('planned_date is not exact occurrence authority', () => {
  assert.doesNotMatch(occurrenceContextSource, /planned_date/)
})

test('Prepare reads occurrenceId from the URL', () => {
  assert.match(initialUrlParsingSource, /params\.get\(['"]occurrenceId['"]\)/)
})

test('Prepare reads expectedActiveRevisionId from the URL', () => {
  assert.match(initialUrlParsingSource, /params\.get\(['"]expectedActiveRevisionId['"]\)/)
})

test('Prepare stores exact occurrence URL values in dedicated ephemeral state', () => {
  assert.match(prepareSource, /const\s+\[syllabusOccurrenceId,\s*setSyllabusOccurrenceId\]\s*=\s*useState\(['"]{2}\)/)
  assert.match(prepareSource, /const\s+\[syllabusExpectedActiveRevisionId,\s*setSyllabusExpectedActiveRevisionId\]\s*=\s*useState\(['"]{2}\)/)
  assert.match(initialUrlParsingSource, /setSyllabusOccurrenceId\(paramOccurrenceId\)/)
  assert.match(initialUrlParsingSource, /setSyllabusExpectedActiveRevisionId\(paramExpectedActiveRevisionId\)/)
})

test('ephemeral occurrence state is excluded from snapshot and persist objects', () => {
  const directUrlSnapshotSource = sourceBetween(
    prepareSource,
    'writePreparationSnapshot({',
    '\n          })',
  )
  for (const source of [directUrlSnapshotSource, persistSource, reassignmentSource]) {
    assert.doesNotMatch(source, /syllabusOccurrenceId|syllabusExpectedActiveRevisionId/)
  }
})

test('ephemeral occurrence state is not written to localStorage', () => {
  assert.doesNotMatch(prepareSource, /localStorage[^\r\n]*(?:syllabusOccurrenceId|syllabusExpectedActiveRevisionId)/)
  assert.doesNotMatch(prepareSource, /(?:syllabusOccurrenceId|syllabusExpectedActiveRevisionId)[^\r\n]*localStorage/)
})
