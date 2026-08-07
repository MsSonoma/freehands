import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  DEMO_LEARNER,
  SONOMA_TEACHER_ID,
  buildLessonSessionRoute,
  canUseAnonymousTeacher,
  getLessonListRequest,
  initializeDemoLearner,
  requiresDemoAuthGate,
  resolveTeacherForLearner,
  shouldAutoShowLearnerTutorial,
  shouldAutoShowSessionTutorial,
  shouldUseAccountPersistence,
} from '../demoLearner.mjs'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  }
}

test('Demo Learner initialization writes the canonical local identity', () => {
  const storage = memoryStorage()
  const learner = initializeDemoLearner(storage)

  assert.deepEqual(learner, DEMO_LEARNER)
  assert.equal(storage.getItem('learner_id'), 'demo')
  assert.equal(storage.getItem('learner_name'), 'Demo Learner')
  assert.equal(storage.getItem('learner_grade'), '4')
  assert.equal(storage.getItem('selected_teacher'), SONOMA_TEACHER_ID)
})

for (const staleTeacher of ['slate', 'webb']) {
  test(`Demo Learner overwrites stale ${staleTeacher} teacher state`, () => {
    const storage = memoryStorage({ selected_teacher: staleTeacher })
    initializeDemoLearner(storage)
    assert.equal(storage.getItem('selected_teacher'), SONOMA_TEACHER_ID)
  })
}

test('only Demo Learner with Ms. Sonoma qualifies for the anonymous teacher path', () => {
  assert.equal(canUseAnonymousTeacher('demo', 'sonoma'), true)
  assert.equal(canUseAnonymousTeacher('demo', 'slate'), false)
  assert.equal(canUseAnonymousTeacher('demo', 'webb'), false)
  assert.equal(canUseAnonymousTeacher('unsigned-arbitrary-id', 'sonoma'), false)
})

test('unsupported Demo Learner teachers remain authentication gated', () => {
  assert.equal(requiresDemoAuthGate('demo', 'sonoma'), false)
  assert.equal(requiresDemoAuthGate('demo', 'slate'), true)
  assert.equal(requiresDemoAuthGate('demo', 'webb'), true)
  assert.equal(requiresDemoAuthGate('real-learner-id', 'sonoma'), false)
})

test('real learners retain their selected teacher behavior', () => {
  assert.equal(resolveTeacherForLearner('real-learner-id', 'slate'), 'slate')
  assert.equal(resolveTeacherForLearner('real-learner-id', 'webb'), 'webb')
})

test('Demo Learner is pinned to Ms. Sonoma when a lesson launches', () => {
  assert.equal(resolveTeacherForLearner('demo', 'slate'), 'sonoma')
  assert.equal(
    buildLessonSessionRoute({
      learnerId: 'demo',
      subject: 'demo',
      fileName: 'welcome_to_math.json',
      selectedTeacher: 'slate',
    }),
    '/session?subject=demo&lesson=welcome_to_math.json'
  )
})

test('real learner lesson routes retain Slate and Webb behavior', () => {
  assert.equal(buildLessonSessionRoute({ learnerId: 'real', subject: 'math', fileName: 'one.json', selectedTeacher: 'slate' }), '/session/slate')
  assert.equal(buildLessonSessionRoute({ learnerId: 'real', subject: 'math', fileName: 'one.json', selectedTeacher: 'webb' }), '/session/webb')
})

test('Demo Learner uses the anonymous demo lesson endpoint only', () => {
  assert.deepEqual(getLessonListRequest('demo'), { url: '/api/lessons/demo', subject: 'demo' })
  assert.deepEqual(getLessonListRequest('real learner'), {
    url: '/api/learner/available-lessons?learner_id=real%20learner',
    subject: null,
  })
})

test('Demo Learner suppresses automatic learner tutorials while real learners retain them', () => {
  assert.equal(shouldAutoShowLearnerTutorial({ learnerResolved: true, learnerId: 'demo', tutorialSeen: false }), false)
  assert.equal(shouldAutoShowLearnerTutorial({ learnerResolved: true, learnerId: 'real', tutorialSeen: false }), true)
  assert.equal(shouldAutoShowLearnerTutorial({ learnerResolved: true, learnerId: 'real', tutorialSeen: true }), false)
})

test('Demo Learner suppresses the automatic V2 session tutorial', () => {
  assert.equal(shouldAutoShowSessionTutorial({ learnerId: 'demo', tutorialSeen: false }), false)
})

test('real learners retain automatic V2 session tutorial behavior', () => {
  assert.equal(shouldAutoShowSessionTutorial({ learnerId: 'real', tutorialSeen: false }), true)
  assert.equal(shouldAutoShowSessionTutorial({ learnerId: 'real', tutorialSeen: true }), false)
})

test('skipping the V2 session tutorial for Demo does not write the seen flag', () => {
  const storage = memoryStorage({ learner_id: 'demo' })
  const shouldShow = shouldAutoShowSessionTutorial({
    learnerId: storage.getItem('learner_id'),
    tutorialSeen: Boolean(storage.getItem('ms_session_tutorial_seen')),
  })

  assert.equal(shouldShow, false)
  assert.equal(storage.getItem('ms_session_tutorial_seen'), null)
})

test('account persistence excludes only empty and Demo Learner identities', () => {
  assert.equal(shouldUseAccountPersistence('demo'), false)
  assert.equal(shouldUseAccountPersistence(null), false)
  assert.equal(shouldUseAccountPersistence('real-learner-id'), true)
})

test('Facilitator Home and real learner creation retain required authentication gates', () => {
  const gatedPages = [
    path.resolve('src', 'app', 'facilitator', 'page.js'),
    path.resolve('src', 'app', 'facilitator', 'learners', 'add', 'page.js'),
  ]

  for (const page of gatedPages) {
    const source = fs.readFileSync(page, 'utf8')
    assert.match(source, /useAccessControl\(\{ requiredAuth: 'required' \}\)/)
    assert.match(source, /<GatedOverlay/)
  }
})

test('real learner creation authenticates before any local compatibility fallback', () => {
  const source = fs.readFileSync(path.resolve('src', 'app', 'facilitator', 'learners', 'clientApi.js'), 'utf8')
  assert.match(source, /if \(!supabase \|\| !hasSupabaseEnv\(\)\) \{\s*throw new Error\('Please log in to create learners'\)/)
  const authGuard = source.indexOf("if (!uid) throw new Error('Please log in to create learners')")
  const compatibilityFallback = source.indexOf("if (supabaseLearnersMode === 'disabled')", source.indexOf('export async function createLearner'))

  assert.ok(authGuard >= 0)
  assert.ok(compatibilityFallback >= 0)
  assert.ok(authGuard < compatibilityFallback)
})

test('all four curated demo lessons exist and carry the expected session identity', () => {
  const expected = new Map([
    ['welcome_to_math.json', 'math'],
    ['welcome_to_science.json', 'science'],
    ['welcome_to_language_arts.json', 'language arts'],
    ['welcome_to_social_studies.json', 'social studies'],
  ])
  const demoDir = path.resolve('public', 'lessons', 'demo')
  const files = fs.readdirSync(demoDir).filter((file) => file.endsWith('.json')).sort()

  assert.deepEqual(files, [...expected.keys()].sort())
  for (const file of files) {
    const lesson = JSON.parse(fs.readFileSync(path.join(demoDir, file), 'utf8'))
    assert.equal(String(lesson.subject).toLowerCase(), expected.get(file))
    assert.ok(lesson.title)
    assert.ok(Array.isArray(lesson.multiplechoice) && lesson.multiplechoice.length > 0)
    assert.equal(
      buildLessonSessionRoute({ learnerId: 'demo', subject: 'demo', fileName: file, selectedTeacher: 'webb' }),
      `/session?subject=demo&lesson=${file}`
    )
  }
})
