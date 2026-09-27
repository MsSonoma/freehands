import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const documentSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
const documentCss = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.module.css'), 'utf8')
const facilitatorPage = fs.readFileSync(path.resolve('src/app/facilitator/page.js'), 'utf8')
const calendarPage = fs.readFileSync(path.resolve('src/app/facilitator/calendar/page.js'), 'utf8')
const headerSource = fs.readFileSync(path.resolve('src/app/HeaderBar.js'), 'utf8')
const planEditorSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusPlanEditor.js'), 'utf8')
const curriculumEditorSource = fs.readFileSync(path.resolve('src/app/components/syllabus/CurriculumGuidanceEditor.js'), 'utf8')

test('facilitator Syllabus owns the month view beside the week date range', () => {
  assert.match(documentSource, /className=\{styles\.weekHeaderActions\}[\s\S]*weekRangeLabel[\s\S]*>Month view<\/button>/)
  assert.match(documentSource, />This month<\/button>/)
  assert.match(documentSource, />Week view<\/button>/)
  assert.match(documentSource, /data-syllabus-selected-month=\{monthStart\}/)
  assert.match(documentCss, /\.monthGrid[\s\S]*grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/)
  assert.doesNotMatch(headerSource, /\{ label: 'Month View', href: '\/facilitator\/calendar' \}/)
})

test('month cells open a temporary day overlay and item rows hand off to existing detail overlays', () => {
  assert.match(documentSource, /onClick=\{\(\) => setSelectedMonthDate\(day\)\}/)
  assert.match(documentSource, /className=\{styles\.dayOverlay\}[\s\S]*role="dialog"/)
  assert.match(documentSource, /onClick=\{\(\) => selectMonthItem\(item\)\}/)
  assert.match(documentSource, /onSelectReview\?\.\(item\)/)
  assert.match(documentSource, /onSelectLesson\(item, \{ syllabus_state: state/)
  assert.match(documentCss, /\.dayOverlayBackdrop/)
})

test('standalone Calendar is retired to a compatibility redirect into Syllabus month view', () => {
  assert.match(calendarPage, /params\.set\('view', 'month'\)/)
  assert.match(calendarPage, /router\.replace/)
  assert.doesNotMatch(calendarPage, /LessonCalendar|SyllabusDayActionDialog|GeneratePortfolioModal/)
})

test('Portfolio now lives in Plan Details instead of the retired Calendar surface', () => {
  assert.match(planEditorSource, /portfolioAllowed=\{portfolioAllowed\}/)
  assert.match(planEditorSource, /onOpenPortfolio=\{onOpenPortfolio\}/)
  assert.match(curriculumEditorSource, /<h3>Portfolio<\/h3>/)
  assert.match(curriculumEditorSource, /portfolioAllowed \? 'Open Portfolio' : 'Portfolio requires Pro'/)
  assert.match(facilitatorPage, /<GeneratePortfolioModal/)
  assert.match(facilitatorPage, /onOpenPortfolio=\{openPortfolio\}/)
  assert.match(facilitatorPage, /initialView=\{initialSyllabusView\}/)
})
