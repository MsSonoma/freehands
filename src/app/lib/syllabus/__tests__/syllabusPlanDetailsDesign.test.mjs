import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const documentSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
const documentCss = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.module.css'), 'utf8')
const editorSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusPlanEditor.js'), 'utf8')
const editorCss = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusPlanEditor.module.css'), 'utf8')
const facilitatorHome = fs.readFileSync(path.resolve('src/app/facilitator/page.js'), 'utf8')
const facilitatorSyllabus = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')

test('plan configuration is collapsed behind one Plan details disclosure and revision bookkeeping is hidden', () => {
  assert.match(documentSource, /<details className=\{styles\.planDetails\}>\s*<summary>Plan details<\/summary>/)
  assert.doesNotMatch(documentSource, /<details className=\{styles\.planDetails\} open/)
  assert.doesNotMatch(documentSource, /styles\.revisionMark|>Revision \{revision\?\.revision_number/)
  assert.doesNotMatch(documentCss, /\.revisionMark|\.summaryRule/)
  const detailsStart = documentSource.indexOf('<details className={styles.planDetails}>')
  const navStart = documentSource.indexOf('<nav className={styles.timelineNav}', detailsStart)
  const details = documentSource.slice(detailsStart, navStart)
  for (const label of ['Goals', 'Subjects', 'Weekly pattern', 'Teaching guidance']) assert.ok(details.includes(label))
})

test('weekly pattern is a Monday-through-Sunday calendar strip that keeps empty days visible', () => {
  assert.match(documentSource, /const PLAN_DAYS = \['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'\]/)
  assert.match(documentSource, /PLAN_DAYS\.map\(\(day\) =>/)
  assert.match(documentSource, /subjects\.length \? subjects\.join\(' \/ '\) : <>\&mdash;<\/>/)
  assert.match(documentCss, /\.planPatternScroller \{ overflow-x:auto/)
  assert.match(documentCss, /\.planPatternGrid \{ min-width:690px; display:grid; grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/)
  assert.match(editorCss, /\.weekScroller \{ overflow-x:auto/)
  assert.match(editorCss, /\.weekGrid \{ min-width:760px; display:grid; grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/)
})

test('all four plan sections remain editable through the shared facilitator editor', () => {
  for (const section of ['goals', 'subjects', 'weekly_pattern', 'teaching_guidance']) {
    assert.ok(documentSource.includes(`onEditSection('${section}')`))
  }
  assert.match(facilitatorHome, /import SyllabusPlanEditor from '@\/app\/components\/syllabus\/SyllabusPlanEditor'/)
  assert.match(facilitatorHome, /onEditSection=\{syllabusPlanningAccess\.can_change_intent \? setEditingSyllabusSection : null\}/)
  assert.match(facilitatorHome, /editingSyllabusSection && syllabusModel\.kind === 'active' && <SyllabusPlanEditor/)
  assert.match(facilitatorSyllabus, /editingSection && syllabus\?\.has_active_syllabus && <SyllabusPlanEditor/)
})

test('shared editor preserves revision safety while plan configuration stays independent of lesson-capacity PINs', () => {
  assert.match(editorSource, /fetch\('\/api\/syllabus\/activate'/)
  assert.match(editorSource, /expectedActiveRevisionId: revision\.id/)
  assert.match(editorSource, /planDetails:/)
  assert.doesNotMatch(editorSource, /SYLLABUS_CAPACITY_PIN_REQUIRED|requestFacilitatorPinException/)
  assert.doesNotMatch(editorSource, /snapshot:\s*\{\s*\.\.\.draft/)
  assert.match(editorSource, /normalizedTeachingGuidance/)
  assert.match(editorSource, /addWeeklyPatternSlot/)
  assert.match(editorSource, /removeWeeklyPatternSlot/)
  assert.doesNotMatch(editorSource, /revision_number|Revision \d|Revision \{/)
  assert.match(documentSource, /revisionId: revision\?\.id/)
})

test('weekly pattern editor makes empty days explicit and does not preselect a subject', () => {
  assert.match(editorSource, />No lessons<\/p>/)
  assert.match(editorSource, /'Add lesson'/)
  assert.match(editorSource, /<option value="">Choose subject<\/option>/)
  assert.match(editorSource, /Object\.prototype\.hasOwnProperty\.call\(slotSubjects, day\)/)
  assert.doesNotMatch(editorSource, /slotSubjects\[day\] \|\| subjectName\(draft\.subjects\?\.\[0\]\)/)
  assert.match(editorSource, /Days can be empty/)
})

test('Syllabus document reduces fixed vertical chrome before the lesson week', () => {
  assert.match(documentCss, /padding:clamp\(14px,2\.5vw,28px\)/)
  assert.match(documentCss, /\.documentHeader[^}]*padding-bottom:12px/)
  assert.match(documentCss, /\.timelineNav[^}]*padding:12px 0 6px/)
  assert.match(documentCss, /\.weekHeader[^}]*padding:11px 0 9px/)
  assert.doesNotMatch(documentSource, /copy\.note/)
})