import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const syllabusDocumentSource = fs.readFileSync(
  new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url),
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

const actionHrefSource = sourceBetween(
  syllabusDocumentSource,
  'const actionHref = (item, actionId) => {',
  '\n\n  return (',
)
const occurrenceContextSource = sourceBetween(
  actionHrefSource,
  'const occurrenceContext =',
  '\n      return `/facilitator/prepare?',
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
  assert.match(occurrenceContextSource, /typeof\s+item\.occurrence_id\s*===\s*['"]string['"]/)
  assert.match(occurrenceContextSource, /item\.occurrence_id\.trim\(\)/)
  assert.match(occurrenceContextSource, /occurrenceId=\$\{encodeURIComponent\(item\.occurrence_id\)\}/)
})

test('Prepare expectedActiveRevisionId comes from revision.id', () => {
  assert.match(occurrenceContextSource, /expectedActiveRevisionId=\$\{encodeURIComponent\(revision\.id\)\}/)
})

test('occurrence context shares the Prepare href with reschedule context', () => {
  assert.match(actionHrefSource, /scheduleId=\$\{encodeURIComponent\(item\.id\s*\|\|\s*['"]{2}\)\}/)
  assert.match(actionHrefSource, /originalScheduledDate=\$\{encodeURIComponent\([^}]+\)\}/)
  assert.match(actionHrefSource, /facilitator\/prepare\?[^\r\n]+\$\{scheduleContext\}\$\{occurrenceContext\}/)
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
