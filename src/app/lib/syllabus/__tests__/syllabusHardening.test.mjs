import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { createScrollLockManager } from '../../scrollLock.mjs'
import { ensurePinAllowed } from '../../pinGate.js'
import { getActiveSyllabus } from '../revisions.server.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test('Syllabus shell read stops before timeline, history, evidence, and forecast hydration', async () => {
  const heavyCalls = []
  const repository = {
    async findOwnedLearner(learnerId, facilitatorId) {
      assert.equal(learnerId, LEARNER)
      assert.equal(facilitatorId, FACILITATOR)
      return { id: LEARNER, facilitator_id: FACILITATOR, approved_lessons: {} }
    },
    async findFacilitatorTimeZone() { return 'America/New_York' },
    async findSyllabus() { return { id: 'syllabus-1', facilitator_id: FACILITATOR, learner_id: LEARNER, active_revision_id: 'revision-1' } },
    async findRevision() {
      return {
        id: 'revision-1',
        syllabus_id: 'syllabus-1',
        revision_number: 7,
        effective_from: '2026-09-10',
        goals: { legacy_notes: 'Keep learning.' },
        subjects: [{ name: 'Math' }],
        weekly_pattern: { monday: [{ subject: 'Math' }] },
        teaching_guidance: {},
      }
    },
    async listForecastItems() { heavyCalls.push('forecast'); throw new Error('heavy read should not run') },
    async listLessonAssociations() { heavyCalls.push('associations'); throw new Error('heavy read should not run') },
    async listAllTrackedSessions() { heavyCalls.push('sessions'); throw new Error('heavy read should not run') },
    async listAllLessonSessionEvents() { heavyCalls.push('events'); throw new Error('heavy read should not run') },
    async listAllSlateEvidenceSessions() { heavyCalls.push('slate evidence'); throw new Error('heavy read should not run') },
  }

  const result = await getActiveSyllabus({
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    now: new Date('2026-09-10T16:00:00-04:00'),
    view: 'shell',
  })

  assert.equal(result.has_active_syllabus, true)
  assert.equal(result.active_revision.id, 'revision-1')
  assert.equal(result.timeline_items, null)
  assert.deepEqual(result.forecast_items, [])
  assert.equal(result.proposed_learning_forecast, null)
  assert.deepEqual(heavyCalls, [])
})

test('shared scroll lock keeps nested owners locked and restores the exact baseline after the final close', () => {
  const fakeDocument = {
    documentElement: { style: { overflow: 'visible', height: 'auto' } },
    body: { style: { overflow: 'scroll', height: 'calc(100vh - 10px)' } },
  }
  const manager = createScrollLockManager({ getDocument: () => fakeDocument })

  const releaseParent = manager.acquire()
  assert.equal(manager.activeCount(), 1)
  assert.equal(fakeDocument.documentElement.style.overflow, 'hidden')
  assert.equal(fakeDocument.body.style.overflow, 'hidden')
  assert.equal(fakeDocument.body.style.height, 'calc(100vh - 10px)')

  const releaseNestedSession = manager.acquire({ viewport: true })
  assert.equal(manager.activeCount(), 2)
  assert.equal(fakeDocument.documentElement.style.height, '100svh')
  assert.equal(fakeDocument.body.style.height, '100svh')

  releaseParent()
  assert.equal(manager.activeCount(), 1)
  assert.equal(fakeDocument.body.style.overflow, 'hidden')
  assert.equal(fakeDocument.body.style.height, '100svh')

  releaseNestedSession()
  assert.equal(manager.activeCount(), 0)
  assert.equal(fakeDocument.documentElement.style.overflow, 'visible')
  assert.equal(fakeDocument.documentElement.style.height, 'auto')
  assert.equal(fakeDocument.body.style.overflow, 'scroll')
  assert.equal(fakeDocument.body.style.height, 'calc(100vh - 10px)')

  releaseNestedSession()
  assert.equal(manager.activeCount(), 0)
})

test('an already-authorized facilitator refresh bypasses PIN preference and prompt work', async () => {
  let preferenceReads = 0
  let prompts = 0
  const allowed = await ensurePinAllowed('facilitator-page', {
    isBrowser: true,
    isInFacilitatorSection: () => true,
    fetchServerPrefsAndHasPin: async () => { preferenceReads += 1; return { hasPin: true, prefs: { facilitatorPage: true } } },
    promptForPinMasked: async () => { prompts += 1; return '1234' },
    verifyPinServer: async () => true,
  })
  assert.equal(allowed, true)
  assert.equal(preferenceReads, 0)
  assert.equal(prompts, 0)
})

test('facilitator layout owns refresh authorization and Syllabus no longer adds its own page PIN gate', () => {
  const layout = fs.readFileSync(path.resolve('src/app/facilitator/layout.js'), 'utf8')
  const page = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')
  assert.match(layout, /if \(checkFacilitatorSection\(\)\) \{/)
  assert.match(layout, /setSectionAuthorized\(true\)/)
  assert.match(layout, /ensurePinAllowed\('facilitator-page'\)/)
  assert.doesNotMatch(page, /ensurePinAllowed\('facilitator-syllabus'\)/)
  assert.doesNotMatch(page, /pinChecked/)
})

test('facilitator Syllabus paints a shell, yields, hydrates full contents, then permits automatic forecasting', () => {
  const page = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')
  const route = fs.readFileSync(path.resolve('src/app/api/syllabus/route.js'), 'utf8')
  const shellRequest = page.indexOf('&view=shell')
  const yieldAfterShell = page.indexOf('await yieldToBrowser()', shellRequest)
  const fullRequest = page.indexOf('const response = await fetch(`/api/syllabus?learnerId=', yieldAfterShell)
  assert.ok(shellRequest >= 0)
  assert.ok(yieldAfterShell > shellRequest)
  assert.ok(fullRequest > yieldAfterShell)
  assert.match(page, /contentLoading/)
  assert.match(page, /if \(!syllabusHydrated\) return undefined/)
  assert.match(page, /contentLoading=\{contentLoading && !Array\.isArray\(syllabus\.timeline_items\)\}/)
  assert.match(page, /onEditSection=\{planningAccess\.can_change_intent && syllabusHydrated/)
  assert.match(route, /searchParams\.get\('view'\) === 'shell' \? 'shell' : 'full'/)
})

test('all Syllabus modal scroll owners use the shared lock instead of restoring body overflow themselves', () => {
  const files = [
    'src/app/facilitator/syllabus/page.js',
    'src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js',
    'src/app/components/syllabus/LessonHistoryOverlay.js',
    'src/app/components/syllabus/SyllabusPlanEditor.js',
    'src/app/components/syllabus/SyllabusScheduleDialog.js',
    'src/components/SettingsOverlay.jsx',
    'src/app/HeaderBar.js',
  ]
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(file), 'utf8')
    assert.doesNotMatch(source, /document\.body\.style\.overflow|body\.style\.overflow\s*=/, file)
    assert.match(source, /acquirePageScrollLock/, file)
  }
})