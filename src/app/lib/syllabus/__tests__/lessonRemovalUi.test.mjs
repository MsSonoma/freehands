import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const prepareSource = readFileSync(new URL('../../../facilitator/prepare/page.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const editorSource = readFileSync(new URL('../../../facilitator/lessons/edit/page.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`)
  return source.slice(start, end)
}

test('Prepare exposes separately scoped exact and broad removal choices', () => {
  assert.match(prepareSource, /syllabusOccurrenceId\s*&&\s*\([\s\S]*Remove this occurrence from Syllabus/)
  assert.match(prepareSource, /learnerLessonBound\s*===\s*true\s*&&\s*\([\s\S]*Remove lesson from learner/)
  assert.match(prepareSource, /Only this planned occurrence\./)
  assert.match(prepareSource, /All current and future placements for this learner\./)
  assert.match(prepareSource, /This removes only this occurrence from the Syllabus\. The lesson, other occurrences, and existing learning history remain\./)
  assert.match(prepareSource, /This removes the lesson from this learner's current and future plan and availability\. The lesson itself and existing learning history remain\./)
})

test('Prepare exact removal uses only occurrence authority and preserves protected records', () => {
  const exactAction = between(
    prepareSource,
    'async function removeExactSyllabusOccurrence()',
    'async function removeLessonFromLearner()',
  )
  assert.match(exactAction, /!selectedLearner\s*\|\|\s*!lessonIdentity\?\.lessonKey\s*\|\|\s*!syllabusOccurrenceId/)
  assert.match(exactAction, /fetch\('\/api\/syllabus\/lesson-occurrences',\s*\{[\s\S]*method:\s*'DELETE'/)
  assert.match(exactAction, /const payload\s*=\s*\{\s*learnerId,\s*lessonKey:\s*lessonIdentity\.lessonKey,\s*occurrenceId:\s*syllabusOccurrenceId,?\s*\}/)
  assert.match(exactAction, /if\s*\(syllabusExpectedActiveRevisionId\)\s*\{\s*payload\.expectedActiveRevisionId\s*=\s*syllabusExpectedActiveRevisionId/)
  assert.doesNotMatch(exactAction, /lesson-availability/)
  assert.match(exactAction, /clearPreparationSnapshot\(\)[\s\S]*router\.push\('\/facilitator\/syllabus'\)/)

  assert.match(prepareSource, /syllabusOccurrenceId\.startsWith\('actual:'\)\s*\|\|\s*syllabusOccurrenceId\.startsWith\('historical:'\)/)
  assert.match(prepareSource, /disabled=\{removalBusy\s*\|\|\s*exactOccurrenceIsProtected\}/)
  assert.match(prepareSource, /Completed and historical records are preserved and cannot be removed with this control\./)
})

test('Prepare broad removal is gated by current server binding truth', () => {
  const broadAction = between(
    prepareSource,
    'async function removeLessonFromLearner()',
    'function finishFlow()',
  )
  assert.match(broadAction, /learnerLessonBound\s*!==\s*true/)
  assert.match(broadAction, /fetch\('\/api\/facilitator\/learners\/lesson-availability',\s*\{[\s\S]*method:\s*'POST'/)
  assert.match(broadAction, /body:\s*JSON\.stringify\(\{\s*learnerId,\s*lessonKey:\s*lessonIdentity\.lessonKey,\s*available:\s*false,?\s*\}\)/)
  assert.doesNotMatch(broadAction, /lesson-occurrences/)
  assert.match(broadAction, /clearPreparationSnapshot\(\)[\s\S]*router\.push\('\/facilitator\/syllabus'\)/)

  assert.match(prepareSource, /fetch\(`\/api\/facilitator\/learners\/lesson-availability\?\$\{params\}`,[\s\S]*setLearnerLessonBound\(json\?\.currentlyBound\s*===\s*true\)/)
  assert.match(prepareSource, /setLearnerLessonBound\(false\)[\s\S]*if\s*\(!pinChecked\s*\|\|\s*!isAuthenticated\s*\|\|\s*!learnerId\s*\|\|\s*!lessonIdentity\?\.lessonKey\)\s*return/)

  const persistAction = between(prepareSource, 'function persist(', 'function activeBoundaries()')
  assert.doesNotMatch(persistAction, /syllabusOccurrenceId|syllabusExpectedActiveRevisionId/)
  const urlSnapshot = between(prepareSource, 'writePreparationSnapshot({', '          })')
  assert.doesNotMatch(urlSnapshot, /syllabusOccurrenceId|syllabusExpectedActiveRevisionId/)
})

test('lesson editor is grant-only while retaining server binding truth', () => {
  assert.match(editorSource, /fetch\(`\/api\/facilitator\/learners\/lesson-availability\?\$\{params\}`/)
  assert.match(editorSource, /setAssignedLearners\(result\.currentlyBound\s*\?\s*\[learner\.id\]\s*:\s*\[\]\)/)
  assert.match(editorSource, /Grant Access/)
  assert.match(editorSource, /available:\s*true/)
  assert.match(editorSource, /Already assigned/)
  assert.doesNotMatch(editorSource, /Remove from learner/)
  assert.doesNotMatch(editorSource, /available:\s*!isCurrentlyAssigned/)
  assert.doesNotMatch(editorSource, /available:\s*false/)
})
