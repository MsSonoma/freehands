import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n')
const overlay = read('src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js')
const session = read('src/app/session/v2/SessionPageV2.jsx')
const assessmentSets = read('src/app/session/assessment/assessmentSets.js')
const printPdf = read('src/app/session/assessment/printPdf.js')
const assessmentModule = await import(pathToFileURL(path.join(root, 'src/app/session/assessment/assessmentSets.js')).href)

test('facilitator lesson overlay exposes print mode without launching a lesson', () => {
  assert.match(overlay, />Print<\/button>/)
  assert.match(overlay, /Print Worksheet/)
  assert.match(overlay, /Print Test/)
  assert.match(overlay, /Printing here does not start the lesson/)

  const start = overlay.indexOf('async function handlePrintMaterial(kind)')
  const end = overlay.indexOf('async function removeExactSyllabusOccurrence()', start)
  assert.ok(start >= 0 && end > start)
  const handler = overlay.slice(start, end)
  assert.ok(handler.indexOf("window.open('about:blank', '_blank')") < handler.indexOf('await getStoredAssessments'))
  assert.match(handler, /getStoredAssessments\(item\.lesson_key/)
  assert.match(handler, /buildAssessmentPhaseSets/)
  assert.match(handler, /saveAssessments\(item\.lesson_key/)
  assert.match(handler, /createAssessmentPdf/)
  assert.doesNotMatch(handler, /router\.push|buildInstructionalSessionRoute/)
})

test('lesson session and syllabus printing share canonical assessment/PDF helpers', () => {
  assert.match(session, /buildAssessmentPhaseSets/)
  assert.match(session, /resolveLearnerAssessmentTarget/)
  assert.match(session, /createAssessmentPdf/)
  assert.match(session, /shareOrPreviewAssessmentPdf/)
  assert.match(overlay, /buildAssessmentPhaseSets/)
  assert.match(overlay, /createAssessmentPdf/)
  assert.match(overlay, /import\('@\/app\/session\/assessment\/printPdf'\)/)
})

test('canonical assessment builder preserves stable phase roles and reserved test pool', () => {
  assert.match(assessmentSets, /getReservedAssessmentItems\(lessonData\)/)
  assert.match(assessmentSets, /tagItemsForPhase\(buildPhase\(comprehensionTarget\), 'comprehension'\)/)
  assert.match(assessmentSets, /tagItemsForPhase\(buildPhase\(worksheetTarget\), 'worksheet'\)/)
  assert.match(assessmentSets, /ASSESSMENT_ROLES\.ASSESSMENT_RESERVED/)
  assert.match(assessmentSets, /resolveLearnerAssessmentTargets/)
})

test('shared PDF helper keeps native mobile share and new-tab preview fallbacks', () => {
  assert.match(printPdf, /navigator\?\.canShare/)
  assert.match(printPdf, /navigator\.share/)
  assert.match(printPdf, /win\.location\.href = url/)
  assert.match(printPdf, /window\.location\.href = url/)
  assert.match(printPdf, /anchor\.download = fileName/)
})


test('shared assessment builder produces requested canonical phase sizes', () => {
  const lessonData = {
    multiplechoice: Array.from({ length: 8 }, (_, index) => ({ question: `MC ${index}`, choices: ['A', 'B'], answer: 'A' })),
    truefalse: Array.from({ length: 4 }, (_, index) => ({ question: `TF ${index}`, answer: true })),
    fillintheblank: [{ question: 'Fill ____', answer: 'blank' }],
    shortanswer: [{ question: 'Short answer', answer: 'answer' }],
    test: [
      { question: 'Reserved 1', choices: ['A', 'B'], answer: 'A' },
      { question: 'Reserved 2', choices: ['A', 'B'], answer: 'B' },
    ],
  }
  const sets = assessmentModule.buildAssessmentPhaseSets({
    lessonData,
    targets: { comprehension: 2, exercise: 3, worksheet: 4, test: 2 },
    random: () => 0.37,
  })
  assert.equal(sets.comprehension.length, 2)
  assert.equal(sets.exercise.length, 3)
  assert.equal(sets.worksheet.length, 4)
  assert.equal(sets.test.length, 2)
  assert.ok(sets.test.every((item) => item.assessmentRole === 'assessment_reserved'))
})

test('learner assessment target resolution matches the session precedence and legacy fallback', () => {
  const storage = { getItem: (key) => key === 'target_test_learner-1' ? '12' : null }
  const learner = { id: 'learner-1', comprehension: 6, targets: { comprehension: 7, test: 9 }, discussion: 5 }
  assert.equal(assessmentModule.resolveLearnerAssessmentTarget(learner, 'comprehension', { learnerId: learner.id, storage }), 6)
  assert.equal(assessmentModule.resolveLearnerAssessmentTarget(learner, 'test', { learnerId: learner.id, storage }), 9)
  assert.equal(assessmentModule.resolveLearnerAssessmentTarget({ id: 'learner-1', discussion: 5 }, 'comprehension', { learnerId: 'learner-1', storage }), 5)
})
