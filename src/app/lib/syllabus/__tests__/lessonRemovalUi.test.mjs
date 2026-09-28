import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const overlaySource = readFileSync(new URL('../../../components/syllabus/FacilitatorSyllabusLessonOverlay.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const editorSource = readFileSync(new URL('../../../facilitator/lessons/edit/page.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const lessonEditorSource = readFileSync(new URL('../../../../components/LessonEditor.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const mentorToolRegistrySource = readFileSync(new URL('../../../../lib/mentor/toolRegistry.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const deleteRouteSource = readFileSync(new URL('../../../api/facilitator/lessons/delete/route.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`)
  return source.slice(start, end)
}

test('shared lesson details exposes separately scoped exact and broad removal choices', () => {
  assert.match(overlaySource, /Remove this occurrence/)
  assert.match(overlaySource, /Remove lesson from learner/)
  assert.match(overlaySource, /This removes only this occurrence from the Syllabus\. The lesson, other occurrences, and existing learning history remain\./)
  assert.match(overlaySource, /This removes the lesson from this learner's current and future plan and availability\. The lesson itself and existing learning history remain\./)
})

test('exact removal uses occurrence authority and preserves historical records', () => {
  const exactAction = between(overlaySource, 'async function removeExactSyllabusOccurrence()', 'async function removeLessonFromLearner()')
  assert.match(overlaySource, /exactOccurrenceIsProtected = sourceOccurrenceId\.startsWith\('actual:'\) \|\| sourceOccurrenceId\.startsWith\('historical:'\)/)
  assert.match(overlaySource, /canRemoveExactOccurrence = coreAuthority && canChangeIntent && !isHistorical && Boolean\(sourceOccurrenceId\) && !exactOccurrenceIsProtected/)
  assert.match(exactAction, /fetch\('\/api\/syllabus\/lesson-occurrences'/)
  assert.match(exactAction, /method: 'DELETE'/)
  assert.match(exactAction, /occurrenceId: sourceOccurrenceId/)
  assert.match(exactAction, /payload\.expectedActiveRevisionId = activeRevisionId/)
  assert.doesNotMatch(exactAction, /lesson-availability/)
})

test('broad removal is gated by current server binding truth', () => {
  const broadAction = between(overlaySource, 'async function removeLessonFromLearner()', 'function editLesson()')
  assert.match(overlaySource, /setLearnerLessonBound\(json\?\.currentlyBound === true\)/)
  assert.match(overlaySource, /canRemoveFromLearner = coreAuthority && learnerLessonBound === true && !isHistorical/)
  assert.match(broadAction, /fetch\('\/api\/facilitator\/learners\/lesson-availability'/)
  assert.match(broadAction, /method: 'POST'/)
  assert.match(broadAction, /body: JSON\.stringify\(\{ learnerId, lessonKey: item\.lesson_key, available: false \}\)/)
  assert.doesNotMatch(broadAction, /lesson-occurrences/)
})

test('legacy lesson assignment actions are absent and generated deletion is verified server-side', () => {
  assert.doesNotMatch(editorSource, /showAssign|assignedLearners|Grant Access|Already assigned|onAssign/)
  assert.doesNotMatch(lessonEditorSource, /onAssign|Assign to learners|>\s*✓ Assign\s*</)
  assert.doesNotMatch(mentorToolRegistrySource, /assign_lesson/)
  assert.match(editorSource, /fetch\('\/api\/facilitator\/lessons\/delete'/)
  assert.match(editorSource, /result\?\.deleted !== true/)
  assert.doesNotMatch(editorSource, /\.from\('lessons'\)[\s\S]{0,180}\.remove\(/)
  assert.match(deleteRouteSource, /\.remove\(\[storagePath\]\)/)
  assert.match(deleteRouteSource, /Lesson deletion could not be verified/)
  assert.match(deleteRouteSource, /deleted:true/)
})