import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { buildLessonGeneratorReviewHref } from '../../facilitatorLessonWorkflow.mjs'

const syllabusSource = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const generatorSource = fs.readFileSync(new URL('../../../facilitator/generator/page.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const prepareSource = fs.readFileSync(new URL('../../../facilitator/prepare/page.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const documentSource = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`)
  return source.slice(start, end)
}

const openWorkflow = between(syllabusSource, 'function openFacilitatorLessonWorkflow(item) {', '\n\n  function openReviewHistory')

test('Syllabus draft review sends exact occurrence authority into Lesson Generator', () => {
  assert.match(openWorkflow, /buildLessonGeneratorReviewHref/)
  assert.match(openWorkflow, /occurrenceId: String\(item\.occurrence_id \|\| ''\)\.trim\(\)/)
  assert.match(openWorkflow, /expectedActiveRevisionId: String\(syllabus\?\.active_revision\?\.id \|\| ''\)\.trim\(\)/)
  assert.doesNotMatch(openWorkflow, /item\.id|lineage_id/)
})

test('review href preserves date, occurrence, and active revision without treating date as occurrence authority', () => {
  const href = buildLessonGeneratorReviewHref({
    learnerId: 'learner-1',
    lessonKey: 'generated/fractions.json',
    source: 'syllabus',
    plannedDate: '2026-09-11',
    occurrenceId: 'forecast:lineage-1',
    expectedActiveRevisionId: 'revision-1',
  })
  const url = new URL(`http://localhost${href}`)
  assert.equal(url.pathname, '/facilitator/generator')
  assert.equal(url.searchParams.get('plannedDate'), '2026-09-11')
  assert.equal(url.searchParams.get('occurrenceId'), 'forecast:lineage-1')
  assert.equal(url.searchParams.get('expectedActiveRevisionId'), 'revision-1')
})

test('Generator reads exact review context and returns it with the approved lesson identity', () => {
  assert.match(generatorSource, /params\.get\('occurrenceId'\)/)
  assert.match(generatorSource, /params\.get\('expectedActiveRevisionId'\)/)
  assert.match(generatorSource, /buildLessonWorkflowReturnHref\(\{ source: entryContext\.source, learnerId: intendedLearnerId, plannedDate: entryContext\.plannedDate, lessonKey: generatedLessonKey, occurrenceId: entryContext\.occurrenceId \}\)/)
})

test('Syllabus return opens the correct week and focuses the exact lesson or occurrence', () => {
  assert.match(syllabusSource, /startOfSyllabusWeek\(returnDate\)/)
  assert.match(syllabusSource, /setReturnFocus\(\{ plannedDate: returnDate, lessonKey: returnParams\.get\('lessonKey'\) \|\| '', occurrenceId: returnParams\.get\('occurrenceId'\) \|\| '' \}\)/)
  assert.match(documentSource, /focusOccurrenceId/)
  assert.match(documentSource, /focusPlannedDate/)
  assert.match(documentSource, /dateOnly\(candidate\?\.planned_date\) === dateOnly\(focusPlannedDate\)/)
  assert.match(documentSource, /sourceOccurrence === String\(focusOccurrenceId\)/)
  assert.match(documentSource, /String\(candidate\?\.lesson_key \|\| ''\) === String\(focusLessonKey\)/)
  assert.match(documentSource, /onSelectLesson\(match,/)
})

test('legacy Prepare handoff forwards exact context without persisting a new preparation workflow', () => {
  assert.match(prepareSource, /params\.get\('occurrenceId'\)/)
  assert.match(prepareSource, /params\.get\('expectedActiveRevisionId'\)/)
  assert.match(prepareSource, /buildLessonGeneratorReviewHref\(\{ learnerId, lessonKey, source, plannedDate, occurrenceId, expectedActiveRevisionId \}\)/)
  assert.match(prepareSource, /clearPreparationSnapshot\(\)/)
  assert.doesNotMatch(prepareSource, /writePreparationSnapshot|syllabusOccurrenceId|syllabusExpectedActiveRevisionId/)
})