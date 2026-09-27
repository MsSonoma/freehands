import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const documentSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
const documentCss = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.module.css'), 'utf8')
const planEditorSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusPlanEditor.js'), 'utf8')
const curriculumEditorSource = fs.readFileSync(path.resolve('src/app/components/syllabus/CurriculumGuidanceEditor.js'), 'utf8')
const curriculumEditorCss = fs.readFileSync(path.resolve('src/app/components/syllabus/CurriculumGuidanceEditor.module.css'), 'utf8')
const facilitatorHome = fs.readFileSync(path.resolve('src/app/facilitator/page.js'), 'utf8')
const facilitatorCss = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/syllabus.module.css'), 'utf8')
const learningForecastSource = fs.readFileSync(path.resolve('src/app/lib/syllabus/learningForecast.mjs'), 'utf8')
const learningForecastServerSource = fs.readFileSync(path.resolve('src/app/lib/syllabus/learningForecast.server.mjs'), 'utf8')

test('active Syllabus exposes one Plan details button instead of the old disclosure', () => {
  assert.match(documentSource, /onClick=\{\(\) => onEditSection\('plan_details'\)\}>Plan details<\/button>/)
  assert.match(documentSource, /<header className=\{styles\.documentHeader\}>[\s\S]*className=\{styles\.planDetailsButton\}[\s\S]*onEditSection\('plan_details'\)/)
  assert.match(documentCss, /\.planDetailsButton/)
  assert.doesNotMatch(documentSource, /styles\.planDetailsAction/)
  assert.doesNotMatch(documentSource, /<details className=\{styles\.planDetails\}>/)
  assert.doesNotMatch(documentSource, /onEditSection\('(goals|subjects|weekly_pattern|teaching_guidance)'\)/)
  assert.doesNotMatch(documentSource, /revision\?\.goals\?\.legacy_notes/)
})

test('active Syllabus puts Learners beside Plan details and opens learner management as an overlay', () => {
  assert.match(documentSource, /className=\{styles\.documentHeaderActions\}/)
  assert.match(documentSource, /aria-haspopup="dialog"[\s\S]*>Learners<\/button>/)
  assert.match(documentSource, /className=\{styles\.planDetailsButton\}/)
  assert.match(facilitatorHome, /<LearnersOverlay/)
  assert.match(facilitatorHome, /onOpenLearners=\{\(\) => setLearnersOverlayVisibility\(true\)\}/)
  assert.doesNotMatch(documentSource, /learnerMenuOpen|aria-label="Choose learner"/)
  assert.doesNotMatch(facilitatorHome, /<select value=\{learnerId\}/)
  assert.match(facilitatorHome, /syllabus\?\.has_active_syllabus && !draft \? styles\.activeSyllabusPage/)
  assert.match(facilitatorCss, /\.activeSyllabusPage \{ padding-top: 10px; \}/)
  assert.match(documentCss, /\.changeLearnerButton,\.planDetailsButton/)
})

test('Plan Details combines subjects, weekly pattern, and Curriculum Guidance in one overlay', () => {
  assert.match(planEditorSource, /section === 'teaching_guidance' \|\| section === 'plan_details'/)
  assert.match(planEditorSource, /includePlanStructure=\{section === 'plan_details'\}/)
  assert.match(curriculumEditorSource, /includePlanStructure = false/)
  assert.match(curriculumEditorSource, /<h3>Subjects<\/h3>/)
  assert.match(curriculumEditorSource, /<h3>Weekly pattern<\/h3>/)
  assert.match(curriculumEditorSource, /<h3>Curriculum Guidance<\/h3>/)
  assert.match(curriculumEditorSource, /<h3>Personal goals<\/h3>/)
  assert.match(curriculumEditorSource, /fetch\('\/api\/syllabus\/activate'/)
  assert.match(curriculumEditorSource, /planDetails:\s*\{[\s\S]*subjects: planDraft\.subjects,[\s\S]*weekly_pattern: planDraft\.weekly_pattern/)
  assert.match(curriculumEditorSource, /fetch\('\/api\/syllabus\/curriculum'/)
})

test('combined Weekly Pattern remains a Monday-through-Sunday editable calendar strip', () => {
  assert.match(curriculumEditorSource, /const PLAN_DAYS = \['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'\]/)
  assert.match(curriculumEditorSource, /PLAN_DAYS\.map\(\(day\) =>/)
  assert.match(curriculumEditorSource, />No lessons<\/p>/)
  assert.match(curriculumEditorSource, /<option value="">Choose subject<\/option>/)
  assert.match(curriculumEditorSource, /Object\.prototype\.hasOwnProperty\.call\(slotSubjects, day\)/)
  assert.match(curriculumEditorCss, /\.weekScroller \{[\s\S]*overflow-x: auto/)
  assert.match(curriculumEditorCss, /\.weekGrid \{[\s\S]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/)
})

test('Curriculum Guidance Personal goals are the only Syllabus goal editing source', () => {
  assert.match(curriculumEditorSource, /<h3>Personal goals<\/h3>/)
  assert.match(curriculumEditorSource, /goals: draft\.goals/)
  assert.doesNotMatch(planEditorSource, /section === 'goals'/)
  assert.doesNotMatch(planEditorSource, /goals: draft\.goals/)
  assert.doesNotMatch(facilitatorHome, /<h2>Goals<\/h2>/)
  assert.doesNotMatch(facilitatorHome, /Current learner goals notes/)
  assert.doesNotMatch(learningForecastSource, /goals: activeRevision\.goals/)
  assert.doesNotMatch(learningForecastServerSource, /goals: activeRevision\.goals/)
})

test('Plan Details preserves revision safety and does not use lesson-capacity PINs', () => {
  assert.match(curriculumEditorSource, /expectedActiveRevisionId: activeRevisionId/)
  assert.match(curriculumEditorSource, /const planChanged = includePlanStructure/)
  assert.match(curriculumEditorSource, /setActiveRevisionId\(planJson\?\.active_revision\?\.id \|\| activeRevisionId\)/)
  assert.doesNotMatch(curriculumEditorSource, /SYLLABUS_CAPACITY_PIN_REQUIRED|requestFacilitatorPinException/)
})

test('proposal-only Curriculum Guidance stays focused while active Plan Details gets plan structure', () => {
  assert.match(planEditorSource, /includePlanStructure=\{section === 'plan_details'\}/)
  assert.match(curriculumEditorSource, /\{includePlanStructure && <>/)
  assert.match(curriculumEditorSource, /includePlanStructure \? 'Plan Details' : 'Curriculum Guidance'/)
})

test('Syllabus document still keeps fixed vertical chrome compact before the lesson week', () => {
  assert.match(documentCss, /padding:clamp\(14px,2\.5vw,28px\)/)
  assert.match(documentCss, /\.documentHeader[^}]*padding-bottom:12px/)
  assert.match(documentCss, /\.timelineNav[^}]*padding:12px 0 6px/)
  assert.match(documentCss, /\.weekHeader[^}]*padding:11px 0 9px/)
})
