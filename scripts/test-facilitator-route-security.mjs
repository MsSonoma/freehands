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

test('availability route verifies lesson access before mutating learner availability', () => {
  const source = read('src/app/api/facilitator/learners/lesson-availability/route.js')
  assert.match(source, /verifyLessonAccess/)
  assert.match(source, /Lesson not found or unauthorized/)
  assert.match(source, /Approve the lesson content before making it available/)
  assert.match(source, /applyLessonAvailability/)
})

test('generation route returns canonical identity and keeps new lessons as drafts', () => {
  const source = read('src/app/api/facilitator/lessons/generate/route.js')
  assert.match(source, /normalizeGenerationRequest/)
  assert.match(source, /buildCanonicalLessonIdentity/)
  assert.match(source, /lesson\.approved\s*=\s*false/)
  assert.match(source, /identity,/) 
})