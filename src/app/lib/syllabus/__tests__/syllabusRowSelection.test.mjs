import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const documentSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
const learnerSource = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
const facilitatorSource = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')
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
  assert.match(learnerSource, /const requiresSyllabusPin = syllabusState === 'completed_historical'/)
  assert.match(learnerSource, /if \(syllabusItem && requiresSyllabusPin && !syllabusExceptionApproved\)/)
  assert.match(learnerSource, /Practice with Mr\. Slate/)
})

test('facilitator Syllabus uses one detail overlay and one state-aware primary lesson workflow', () => {
  assert.match(facilitatorSource, /onSelectLesson=\{\(item, context\) => setSelectedSyllabusLesson\(\{ item, \.\.\.context \}\)\}/)
  assert.match(facilitatorSource, /<FacilitatorSyllabusLessonOverlay/)
  assert.match(overlaySource, /const primaryLabel = item\.readiness_state === 'draft' \? 'Prepare lesson' : 'Review lesson'/)
  for (const control of ['Assigned teacher', 'Review history', 'Schedule Mr. Slate', 'Record historical activity']) {
    assert.match(overlaySource, new RegExp(control.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(overlaySource, />Open</)
  assert.doesNotMatch(overlaySource, />Make available</)
})
