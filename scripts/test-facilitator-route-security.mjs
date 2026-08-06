import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

test('generated lesson approval and edit operations derive storage owner from authenticated user', () => {
  const routes = [
    'src/app/api/facilitator/lessons/approve/route.js',
    'src/app/api/facilitator/lessons/request-changes/route.js',
    'src/app/api/facilitator/lessons/delete/route.js',
  ]

  for (const route of routes) {
    const source = read(route)
    assert.match(source, /facilitator-lessons\/\$\{user\.id\}\/\$\{file\}/, route)
    assert.doesNotMatch(source, /body\?\.userId|requestUserId|targetUserId\s*=\s*userId/, route)
  }
})

test('proposal and availability routes verify learner ownership before acting', () => {
  const proposalRoute = read('src/app/api/facilitator/lessons/propose/route.js')
  const availabilityRoute = read('src/app/api/facilitator/learners/lesson-availability/route.js')

  for (const source of [proposalRoute, availabilityRoute]) {
    assert.match(source, /\.from\('learners'\)/)
    assert.match(source, /facilitator_id\.eq\.\$\{user\.id\}/)
    assert.match(source, /owner_id\.eq\.\$\{user\.id\}/)
    assert.match(source, /user_id\.eq\.\$\{user\.id\}/)
  }
})

test('availability route verifies lesson access when making a lesson available', () => {
  const source = read('src/app/api/facilitator/learners/lesson-availability/route.js')
  assert.match(source, /verifyLessonAccess/)
  assert.match(source, /Lesson not found or unauthorized/)
  assert.match(source, /Approve the lesson content before making it available/)
  assert.match(source, /applyLessonAvailability/)
})

test('Facilitator Home visibly contains the reconstructed primary decision experience', () => {
  const source = read('src/app/facilitator/page.js')
  assert.match(source, /resolveFacilitatorHomeDecision/)
  assert.match(source, /readPreparationSnapshot/)
  assert.match(source, /Primary decision/)
  assert.match(source, /Advanced Tools/)
  assert.match(source, /\/facilitator\/prepare/)
  assert.doesNotMatch(source, /Choose a section to manage your homeschool or classroom/)
})

test('generation route returns canonical identity and keeps new lessons as drafts', () => {
  const source = read('src/app/api/facilitator/lessons/generate/route.js')
  assert.match(source, /normalizeGenerationRequest/)
  assert.match(source, /buildCanonicalLessonIdentity/)
  assert.match(source, /lesson\.approved\s*=\s*false/)
  assert.match(source, /proposalMode && storageError/)
  assert.match(source, /const identity = storageError \? null : buildCanonicalLessonIdentity/)
})

test('advanced generator does not create actionable lesson keys after storage fallback', () => {
  const source = read('src/app/facilitator/generator/page.js')
  assert.match(source, /const storedLessonKey = js\?\.storageError \? null :/)
  assert.match(source, /const lessonKeyToActivate = storedLessonKey/)
})

test('old onboarding no longer bypasses reconstructed preparation flow', () => {
  const addLearnerPage = read('src/app/facilitator/learners/add/page.js')
  assert.match(addLearnerPage, /router\.push\(`\/facilitator\/prepare\$\{learnerParam\}`\)/)
  assert.match(addLearnerPage, /router\.push\('\/facilitator\/prepare'\)/)
  assert.doesNotMatch(addLearnerPage, /router\.push\(`\/facilitator\/generator/)
})

test('preparation draft Save and leave preserves snapshot and exits home', () => {
  const preparePage = read('src/app/facilitator/prepare/page.js')
  assert.match(preparePage, /function saveDraftAndLeave\(\) \{[\s\S]*persist\(STAGES\.DRAFT, \{ lessonIdentity \}\)[\s\S]*router\.push\('\/facilitator'\)/)
  assert.match(preparePage, /onClick=\{saveDraftAndLeave\}[\s\S]*>Save and leave<\/button>/)
  assert.match(preparePage, /onClick=\{abandonFlow\}[\s\S]*>Discard draft setup<\/button>/)
})