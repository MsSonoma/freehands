import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file) => fs.readFileSync(path.resolve(file), 'utf8')

const facilitator = read('src/app/facilitator/page.js')
const syllabus = read('src/app/components/syllabus/SyllabusDocument.js')
const overlay = read('src/app/facilitator/learners/components/LearnersOverlay.jsx')
const legacyPage = read('src/app/facilitator/learners/page.js')
const header = read('src/app/HeaderBar.js')
const counselor = read('src/app/api/counselor/route.js')
const nextConfig = read('next.config.mjs')
const addLearner = read('src/app/facilitator/learners/add/page.js')

test('facilitator learner selection is owned by the Syllabus Learners overlay', () => {
  assert.match(syllabus, />Learners<\/button>/)
  assert.match(syllabus, /aria-haspopup="dialog"/)
  assert.doesNotMatch(syllabus, /learnerMenuOpen|aria-label="Choose learner"|>Change learner<\/button>/)
  assert.match(facilitator, /<LearnersOverlay/)
  assert.match(facilitator, /onOpenLearners=\{\(\) => setLearnersOverlayVisibility\(true\)\}/)
  assert.match(facilitator, /onActivate=\{switchLearner\}/)
  assert.match(facilitator, /persistLearnerSelection\(localStorage, selectedLearner\)/)
})

test('learner card activation and settings are separate actions', () => {
  assert.match(overlay, /onActivate\?\.\(learner\.id\)/)
  assert.match(overlay, /aria-label=\{\`Settings for \$\{learner\.name \|\| 'learner'\}\`\}/)
  assert.match(overlay, /⚙️/)
  assert.match(overlay, /<LearnerEditOverlay/)
  assert.match(overlay, /initialTab: 'basic'/)
  assert.doesNotMatch(overlay, /visibleTabs=/)
})

test('legacy Learners navigation resolves into the Syllabus overlay', () => {
  assert.match(legacyPage, /redirect\('\/facilitator\?overlay=learners'\)/)
  assert.match(nextConfig, /source: '\/facilitator\/learners',[\s\S]*destination: '\/facilitator\?overlay=learners'/)
  assert.match(header, /label: 'Learners', href: '\/facilitator\?overlay=learners'/)
  assert.match(header, /facilitator:open-learners/)
  assert.match(counselor, /learners: '\/facilitator\?overlay=learners'/)
  assert.match(addLearner, /router\.push\('\/facilitator\?overlay=learners'\)/)
})
