import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const documentSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
const learnerSource = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
const facilitatorSource = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')
const facilitatorHomeSource = fs.readFileSync(path.resolve('src/app/facilitator/page.js'), 'utf8')
const overlaySource = fs.readFileSync(path.resolve('src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js'), 'utf8')

test('normal Syllabus lesson rows select details instead of rendering action-button clusters', () => {
  assert.match(documentSource, /onSelectLesson/)
  assert.match(documentSource, /role=\{onSelectLesson \? 'button' : undefined\}/)
  assert.match(documentSource, /onKeyDown=\{onSelectLesson/)
  assert.doesNotMatch(documentSource, /syllabusItemActionsFor/)
  assert.doesNotMatch(documentSource, /syllabusActionPresentation/)
  assert.doesNotMatch(documentSource, /className=\{styles\.lessonAction\}/)
  assert.doesNotMatch(documentSource, /Make available/)
  const forecastStart = documentSource.indexOf('function ForecastSuggestion')
  const forecastEnd = documentSource.indexOf('export default function SyllabusDocument', forecastStart)
  assert.doesNotMatch(documentSource.slice(forecastStart, forecastEnd), /item\.description/)
})

test('learner Syllabus selection opens detail first and applies PIN only when starting', () => {
  assert.match(learnerSource, /onSelectLesson=\{\(item, context\) => openSyllabusLesson\(item, context\)\}/)
  const selectionStart = learnerSource.indexOf('async function openSyllabusLesson')
  const selectionEnd = learnerSource.indexOf('// Recent tab:', selectionStart)
  assert.ok(selectionStart >= 0 && selectionEnd > selectionStart)
  const selection = learnerSource.slice(selectionStart, selectionEnd)
  assert.doesNotMatch(selection, /ensureFacilitatorPinException|ensurePinAllowed/)
  assert.doesNotMatch(selection, /if \(lessonKey && !preparedLesson\)[\s\S]*return/)
  assert.match(selection, /const lesson = preparedLesson \|\|/)
  assert.match(learnerSource, /Lesson details are available, but this lesson is still being prepared\./)
  assert.match(learnerSource, /const requiresSyllabusPin = syllabusState === 'completed_historical'/)
  assert.match(learnerSource, /if \(syllabusItem && requiresSyllabusPin && !syllabusExceptionApproved\)/)
  assert.match(learnerSource, /Practice with Mr\. Slate/)
})

test('facilitator lesson overlay is the operational control center after row selection', () => {
  assert.match(facilitatorSource, /onSelectLesson=\{\(item, context\) => setSelectedSyllabusLesson\(\{ item, \.\.\.context \}\)\}/)
  assert.match(facilitatorSource, /<FacilitatorSyllabusLessonOverlay/)
  for (const control of ['Assigned teacher', 'Start now', 'Make available', 'Edit lesson', 'Schedule Mr. Slate', 'Review history', 'Review & approve draft']) {
    assert.match(overlaySource, new RegExp(control.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(overlaySource, /fetch\('\/api\/facilitator\/learners\/lesson-availability'/)
  assert.match(overlaySource, /fetch\('\/api\/syllabus\/lesson-associations'/)
  assert.match(overlaySource, /postLessonScheduleWithCapacityPin/)
  assert.match(overlaySource, /buildInstructionalSessionRoute/)
  assert.match(overlaySource, /instructionalTeacher: assignedTeacher/)
  assert.match(overlaySource, /occurrenceId,/)
  assert.match(overlaySource, /item\.readiness_state === 'draft'/)
  assert.doesNotMatch(overlaySource, /'Prepare lesson' : 'Review lesson'/)
})
test('every production facilitator Syllabus surface supplies the same operational overlay authority context', () => {
  assert.match(facilitatorHomeSource, /onSelectLesson=\{\(item, context\) => setSelectedSyllabusLesson\(\{ item, \.\.\.context \}\)\}/)
  assert.match(facilitatorHomeSource, /<FacilitatorSyllabusLessonOverlay/)
  for (const prop of ['learnerId={learnerId}', 'accessToken={authToken}', 'planTier={plan}', "resolvedToday={syllabusPayload?.resolved_today || ''}", "activeRevisionId={syllabusModel.revision?.id || ''}"]) {
    assert.ok(facilitatorHomeSource.includes(prop), `Facilitator Home missing ${prop}`)
  }
  for (const prop of ['learnerId={learnerId}', 'accessToken={token}', 'planTier={planTier}', "resolvedToday={syllabus?.resolved_today || ''}", "activeRevisionId={syllabus?.active_revision?.id || ''}"]) {
    assert.ok(facilitatorSource.includes(prop), `Dedicated Syllabus missing ${prop}`)
  }
  assert.match(learnerSource, /onSelectLesson=\{\(item, context\) => openSyllabusLesson\(item, context\)\}/)
})
test('shared facilitator overlay can fall back to server-owned core operations without host-specific handlers', () => {
  assert.match(overlaySource, /const coreAuthority = Boolean\(learnerId && accessToken && item\.lesson_key\)/)
  assert.match(overlaySource, /typeof onTeacherAssignment === 'function' \|\| coreAuthority/)
  assert.match(overlaySource, /typeof onSchedule === 'function' \|\| coreAuthority/)
  assert.match(overlaySource, /typeof onReviewHistory === 'function' \|\| coreAuthority/)
  assert.match(overlaySource, /typeof onRepeat === 'function' \|\| coreAuthority/)
  assert.match(overlaySource, /typeof onScheduleSlate === 'function' \|\| canScheduleSlateCore/)
})
