import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

// Run after npm run build. Uses a disposable browser and mocked network only.
// Set PLAYWRIGHT_MODULE to another installed playwright-core path as needed.
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.resolve('artifacts/forecast-reconcile-20260914/browser/node_modules/playwright-core'))
const output = path.resolve('artifacts/forecast-reconcile-20260914')
fs.mkdirSync(output, { recursive: true })
const origin = 'http://127.0.0.1:3194'
const serverLog = fs.openSync(path.join(output, 'browser-server.log'), 'w')
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3194', '-H', '127.0.0.1'], { cwd: process.cwd(), stdio: ['ignore', serverLog, serverLog] })
const OWNER = '11111111-1111-4111-8111-111111111111'
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const env = fs.readFileSync('.env.local', 'utf8')
const supabase = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1] || '')
const stamp = Math.floor(Date.now() / 1000)
const encode = (x) => Buffer.from(JSON.stringify(x)).toString('base64url')
const access = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: OWNER, aud: 'authenticated', exp: stamp + 3600 })}.fixture-only`
const user = { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', user_metadata: {} }
const session = { access_token: access, refresh_token: 'fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: stamp + 3600, user }
const date = '2026-09-14'
let active = 'qa-revision-1', revisionNumber = 1, failForecast = false, forecastDelay = 2200
let blockSyllabusReadsAfterGeneration = false
let approvedLesson = false
let committed = [{ id: 'qa-committed', occurrence_id: 'qa-committed', lineage_id: 'committed', planned_date: date, sort_order: 0, title: 'Committed Math', subject: 'Math', lesson_key: 'generated/committed.json', readiness_state: 'approved', item_type: 'lesson', origin: 'facilitator', placement_kind: 'scheduled', is_explicit_schedule: true }]
let daysOff = [{ date: '2026-09-16', reason: 'Family day' }]
let materializationAttempts = 0
let suggestions = [
  { lineage_id: 'habitats', planned_date: date, sort_order: 1, subject: 'Science', title: 'Compare habitats', description: 'Explain two habitats using familiar examples.' },
  { lineage_id: 'writing', planned_date: '2026-09-15', sort_order: 0, subject: 'Language Arts', title: 'Explain a character', description: 'Use a story detail to explain a character choice.' },
  { lineage_id: 'carry-unfinished', planned_date: '2026-09-17', sort_order: 0, subject: 'Math', title: 'Unfinished Fractions', description: 'Carry the unfinished lesson forward.', metadata: { learning_forecast: { carry_existing_lesson_key: 'generated/unfinished-fractions.json', carry_source_occurrence_id: 'syllabus:old-fractions', carry_source_date: '2026-09-10', planning_move: 'continue' } } },
  { lineage_id: 'holiday', planned_date: '2026-09-16', sort_order: 0, subject: 'Science', title: 'Holiday suggestion must be hidden' },
  { lineage_id: 'collision', planned_date: date, sort_order: 0, subject: 'Math', title: 'Occupied suggestion must be hidden' },
  { lineage_id: 'outside', planned_date: '2026-09-21', sort_order: 0, subject: 'Math', title: 'Outside window must be hidden' },
].map(x => ({ ...x, id: x.lineage_id, item_type: 'lesson', origin: 'learning_forecast', lesson_key: null }))
const revision = () => ({ id: active, base_revision_id: null, revision_number: revisionNumber, effective_from: date, subjects: ['Math', 'Science', 'Language Arts'].map(name => ({ name })), goals: { legacy_notes: 'Connect ideas and build understanding.' }, weekly_pattern: { monday: [{ subject: 'Math' }, { subject: 'Science' }], tuesday: [{ subject: 'Language Arts' }], wednesday: [{ subject: 'Science' }], thursday: [{ subject: 'Math' }] }, teaching_guidance: {}, planning_policy: {} })
const proposal = () => ({ id: `proposal-${active}`, base_revision_id: active, proposal_kind: 'learning_forecast', activated_at: null })
const payload = (learnerId) => ({ has_active_syllabus: true, active_revision: revision(), syllabus: { learner_id: learnerId, active_revision_id: active }, resolved_today: date, forecast_items: committed, timeline_items: committed, no_school_dates: daysOff, proposed_learning_forecast: { revision: proposal(), forecast_items: learnerId === A ? suggestions : [] } })
const results = [], requests = [], unexpected = [], errors = []
let browser
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${origin}/api/health`); if (r.status) break } catch {}
    await sleep(200)
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' })
  context.setDefaultTimeout(7000)
  await context.addInitScript(({ storageKey, session, learnerId }) => {
    localStorage.setItem(storageKey, JSON.stringify(session))
    if (!localStorage.getItem('learner_id')) localStorage.setItem('learner_id', learnerId)
    sessionStorage.setItem('facilitator_section_active', '1')
  }, { storageKey: `sb-${supabase.hostname.split('.')[0]}-auth-token`, session, learnerId: A })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } })
    if (url.origin === supabase.origin) {
      if (request.method() === 'OPTIONS') return json({})
      if (url.pathname === '/auth/v1/user') return json(user)
      if (url.pathname.includes('/rest/v1/profiles')) return json({ id: OWNER, full_name: 'Fixture educator', subscription_tier: 'pro', plan_tier: 'pro' })
      if (url.pathname.includes('/rest/v1/learners')) return json([{ id: A, name: 'Avery', grade: '5th', facilitator_id: OWNER }, { id: B, name: 'Blair', grade: '4th', facilitator_id: OWNER }])
      if (request.method() !== 'GET') unexpected.push(`${request.method()} ${url.pathname}`)
      return json([])
    }
    if (url.origin !== origin) return route.abort()
    if (!url.pathname.startsWith('/api/')) return route.continue()
    requests.push({ method: request.method(), path: url.pathname, query: url.search, body: request.postDataJSON?.() })
    if (url.pathname === '/api/syllabus') {
      if (blockSyllabusReadsAfterGeneration) { unexpected.push('Redundant Syllabus reload after generation'); return json({ error: 'Unexpected redundant reload' }, 500) }
      const data = payload(url.searchParams.get('learnerId'))
      if (url.searchParams.get('view') === 'shell') return json({ ...data, timeline_items: undefined, forecast_items: [] })
      return json(data)
    }
    if (url.pathname === '/api/syllabus/forecast') {
      const body = request.postDataJSON()
      const id = body.learnerId, expected = body.expectedActiveRevisionId
      await sleep(forecastDelay)
      if (failForecast) return json({ error: 'Controlled forecast failure' }, 502)
      const rows = id === A ? suggestions : [{ ...suggestions[0], lineage_id: 'blair', title: 'Blair only suggestion' }]
      return json({ kind: 'proposal', proposal_revision: { ...proposal(), base_revision_id: expected }, active_revision_id: expected, forecast_items: rows })
    }
    if (url.pathname === '/api/syllabus/materialize') {
      const body = request.postDataJSON()
      assert.equal(body.expectedActiveRevisionId, active)
      let item = committed.find(x => x.lineage_id === body.lineageId)
      if (item) assert.equal(body.proposalRevisionId, undefined, 'Active entry must not be re-adopted from a proposal')
      else {
        item = suggestions.find(x => x.lineage_id === body.lineageId)
        assert.ok(item)
        assert.equal(body.proposalRevisionId, proposal().id)
        active = `qa-revision-${++revisionNumber}`
        item = { ...item, occurrence_id: item.lineage_id, placement_kind: 'intent' }
        committed.push(item)
        suggestions = suggestions.filter(x => x.lineage_id !== item.lineage_id)
      }
      if (body.lineageId === 'carry-unfinished') {
        assert.equal(body.existingLessonKey, 'generated/unfinished-fractions.json')
        active = `qa-revision-${++revisionNumber}`
        Object.assign(item, { lesson_key: body.existingLessonKey, readiness_state: 'approved', generation_status: undefined })
        return json({ ok: true, kind: 'existing_lesson_bound', lesson_key: body.existingLessonKey, syllabus: payload(body.learnerId) })
      }
      if (++materializationAttempts <= 2) {
        item.generation_status = 'generation_failed'
        return json({ code: 'MATERIALIZATION_GENERATION_FAILED', error: 'This lesson could not be generated. Retry this same Syllabus entry.' }, 502)
      }
      active = `qa-revision-${++revisionNumber}`
      Object.assign(item, { lesson_key: `generated/${item.lineage_id}.json`, readiness_state: 'draft', generation_status: 'bound' })
      await sleep(1100)
      blockSyllabusReadsAfterGeneration = true
      return json({ ok: true, kind: 'materialized', lesson_key: `generated/${item.lineage_id}.json`, syllabus: payload(body.learnerId) })
    }
    if (url.pathname === '/api/facilitator/lessons/get') return json({
      id: 'habitats', title: 'Compare habitats', subject: 'science', grade: '5', difficulty: 'intermediate',
      description: 'Explain two habitats using familiar examples.', approved: approvedLesson,
      vocab: [], teachingNotes: 'Use familiar examples.', truefalse: [], multiplechoice: [], fillintheblank: [], shortanswer: [], test: [],
    })
    if (url.pathname === '/api/facilitator/lessons/approve') {
      const body = request.postDataJSON()
      assert.equal(body.learnerId, A)
      assert.equal(body.file, 'habitats.json')
      approvedLesson = true
      const item = committed.find(row => row.lineage_id === 'habitats')
      item.readiness_state = 'approved'
      return json({ ok: true, approved: true, lessonKey: item.lesson_key,
        lesson: { title: item.title, subject: 'science', approved: true },
        association: { learner_id: A, lesson_key: item.lesson_key, readiness_state: 'approved' },
      })
    }
    if (url.pathname === '/api/facilitator/pin') return json({ hasPin: false })
    if (request.method() !== 'GET') unexpected.push(`${request.method()} ${url.pathname}`)
    return json([])
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/facilitator`)
  const habitat = page.locator('[data-forecast-lineage="habitats"]')
  await habitat.waitFor()
  assert.equal(await habitat.getAttribute('role'), 'button')
  await habitat.click()
  await page.getByText('These suggestions are refreshing.', { exact: false }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Generate lesson', exact: true }).isEnabled(), false)
  await page.getByRole('button', { name: 'Close', exact: true }).first().click()
  await page.locator('[data-forecast-lineage="writing"]').focus()
  await page.keyboard.press('Enter')
  await page.getByRole('dialog').waitFor()
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Generate lesson' && !b.disabled))
  await page.getByRole('button', { name: 'Close', exact: true }).first().click()
  forecastDelay = 80
  results.push('Saved forecast rows open by click and keyboard during slow refresh; conflicting actions unlock in the already-open overlay.')
  assert.equal(await page.locator('[aria-label="Avery Syllabus"]').count(), 1)
  assert.equal(await page.getByText('Committed Math', { exact: true }).count(), 1)
  assert.equal(await page.getByText('Occupied suggestion must be hidden', { exact: true }).count(), 0)
  assert.equal(await page.getByText('Holiday suggestion must be hidden', { exact: true }).count(), 0)
  assert.equal(await page.getByText('Outside window must be hidden', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Plan ahead', exact: true }).count(), 0)
  assert.equal(await page.locator('[aria-label="Ms. Sonoma forecast"]').count(), 0)
  assert.equal(await habitat.evaluate(el => el.closest('[data-syllabus-day]').dataset.syllabusDay), date)
  assert.equal(await habitat.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(241, 240, 237)')
  results.push('Home renders one full Syllabus, with automatic grey lessons in open dated slots, not in a separate panel.')
  results.push('Existing commitments, days off, and the seven-day boundary suppress conflicting suggestions.')
  const carry = page.locator('[data-forecast-lineage="carry-unfinished"]')
  await carry.click()
  await page.getByRole('heading', { name: 'Forecast suggestion - unfinished lesson', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Carry lesson forward', exact: true }).click()
  await carry.waitFor({ state: 'detached' })
  assert.equal(requests.findLast((entry) => entry.path === '/api/syllabus/materialize')?.body?.existingLessonKey, 'generated/unfinished-fractions.json')
  results.push('An unfinished lesson stays a grey Forecast suggestion until the facilitator carries that exact existing lesson forward.')
  await habitat.click()
  await page.getByRole('button', { name: 'Generate with changes', exact: true }).click()
  await page.getByPlaceholder('For example: make it more hands-on, or review cold fronts first.').fill('Use familiar backyard examples.')
  await page.getByRole('button', { name: 'Close', exact: true }).first().click()
  await habitat.click()
  await page.getByRole('button', { name: 'Create your own lesson', exact: true }).click()
  await page.getByRole('button', { name: 'Generate my lesson', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Close', exact: true }).first().click()
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
  results.push('Both forecast editing choices open their real forms, and closing the overlay releases page scrolling.')
  await page.reload()
  await habitat.waitFor()
  results.push('Reload restores the full Syllabus and automatically reloads its grey forecast.')
  await habitat.click()
  await page.getByRole('button', { name: 'Generate lesson', exact: true }).click()
  await habitat.getByText('Generation failed - retry', { exact: true }).waitFor()
  assert.equal(await page.locator('[data-forecast-lineage="habitats"]').count(), 1)
  await page.locator('[data-forecast-lineage="writing"]').waitFor()
  await page.locator('[data-forecast-lineage="habitats"][role="button"]').click()
  await page.getByRole('button', { name: 'Retry generation', exact: true }).click()
  await habitat.getByText('Generation failed - retry', { exact: true }).waitFor()
  results.push('Failure refreshes the same dated entry; an immediate retry targets active lineage rather than adopting again.')
  await page.reload()
  await habitat.getByText('Generation failed - retry', { exact: true }).waitFor()
  assert.equal(await page.getByText('Planned concept', { exact: true }).count(), 0)
  await page.locator('[data-forecast-lineage="habitats"][role="button"]').click()
  await page.getByRole('button', { name: 'Generate with changes', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Create your own lesson', exact: true }).waitFor()
  await page.evaluate(() => { window.__noReloadMarker = 'continuous-lesson-workflow' })
  const readCountBeforeGeneration = requests.filter(x => x.path === '/api/syllabus').length
  await page.getByRole('button', { name: 'Retry generation', exact: true }).click()
  results.push('Reload preserves failure status and the same generation controls; retry does not create another planned object.')
  await page.locator('[data-forecast-lineage="writing"]').click()
  await page.getByText('Another lesson is being generated.', { exact: false }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Generate lesson', exact: true }).isEnabled(), false)
  await habitat.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Close', exact: true }).first().click()
  assert.equal(requests.filter(x => x.path === '/api/syllabus').length, readCountBeforeGeneration)
  assert.equal(await page.evaluate(() => window.__noReloadMarker), 'continuous-lesson-workflow')
  blockSyllabusReadsAfterGeneration = false
  results.push('During generation other details stay clickable; the returned draft updates immediately without a Syllabus reload.')
  await page.getByText('Compare habitats', { exact: true }).waitFor()
  await page.locator('[data-forecast-lineage="writing"]').waitFor()
  assert.equal(committed.find(x => x.lineage_id === 'habitats').readiness_state, 'draft')
  assert.equal(requests.filter(x => x.path.includes('/approve')).length, 0)
  results.push('Selecting one suggestion produces a draft in the same slot, preserves other suggestions, and never auto-approves.')
  await page.getByRole('button', { name: 'Open details for Compare habitats', exact: true }).click()
  await page.getByRole('button', { name: 'Review & approve draft', exact: true }).click()
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/facilitator' && url.searchParams.get('review') === 'complete')
  const approvedRow = page.getByRole('button', { name: 'Open details for Compare habitats', exact: true })
  await approvedRow.waitFor()
  assert.ok((await approvedRow.textContent()).includes('approved'))
  assert.equal(await page.getByRole('dialog').count(), 0)
  assert.equal(await approvedRow.evaluate(el => el.closest('[data-syllabus-day]').dataset.syllabusDay), date)
  assert.equal(await page.evaluate(() => window.__noReloadMarker), 'continuous-lesson-workflow')
  assert.equal(requests.filter(x => x.path === '/api/facilitator/lessons/approve').length, 1)
  assert.equal(requests.filter(x => x.path === '/api/syllabus/lesson-associations' && x.method === 'POST').length, 0)
  results.push('Draft review -> approval -> same scheduled entry completes without browser reload, duplicate approval, or a stuck overlay.')
  await page.locator('select').first().selectOption(B)
  await page.getByText('Blair only suggestion', { exact: true }).waitFor()
  assert.equal(await page.locator('[data-forecast-lineage="writing"]').count(), 0)
  results.push('Switching learners removes the prior learner forecast.')
  failForecast = true
  await page.reload()
  await page.getByRole('button', { name: 'Retry forecast', exact: true }).waitFor()
  failForecast = false
  await page.getByRole('button', { name: 'Retry forecast', exact: true }).click()
  await page.getByText('Blair only suggestion', { exact: true }).waitFor()
  results.push('Forecast failure has a working inline retry and does not remove scheduled lessons.')
  const old = await fetch(`${origin}/facilitator/syllabus?learnerId=${A}&date=2026-09-15`, { redirect: 'manual' })
  assert.equal(old.status, 307)
  assert.equal(old.headers.get('location'), `/facilitator?learnerId=${A}&date=2026-09-15`)
  await page.goto(`${origin}/facilitator/syllabus?learnerId=${A}&date=2026-09-15`)
  await page.locator('[aria-label="Avery Syllabus"]').waitFor()
  assert.equal(new URL(page.url()).pathname, '/facilitator')
  results.push('The old Syllabus URL redirects to Home and preserves learner/date context.')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('[data-forecast-lineage="writing"]').waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2))
  await page.screenshot({ path: path.join(output, 'facilitator-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.screenshot({ path: path.join(output, 'facilitator-desktop.png'), fullPage: true })
  results.push('Mobile and tablet widths render without horizontal overflow.')
  // Exercise timeout through the actual built page; shorten only the forecast deadline in this isolated context.
  await context.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) => nativeSetTimeout(handler, delay === 65000 ? 350 : delay, ...args)
  })
  forecastDelay = 1600
  const timeoutPage = await context.newPage()
  timeoutPage.on('pageerror', error => errors.push(error.message))
  await timeoutPage.goto(`${origin}/facilitator?learnerId=${A}`)
  const cachedWriting = timeoutPage.locator('[data-forecast-lineage="writing"]')
  await cachedWriting.waitFor()
  await timeoutPage.getByRole('button', { name: 'Retry forecast', exact: true }).waitFor()
  await cachedWriting.click()
  assert.equal(await timeoutPage.getByRole('button', { name: 'Generate lesson', exact: true }).isEnabled(), true)
  await timeoutPage.getByRole('button', { name: 'Close', exact: true }).first().click()
  forecastDelay = 80
  await timeoutPage.getByRole('button', { name: 'Retry forecast', exact: true }).click()
  await timeoutPage.getByRole('button', { name: 'Retry forecast', exact: true }).waitFor({ state: 'detached' })
  await cachedWriting.click()
  await timeoutPage.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Generate lesson' && !b.disabled))
  assert.equal(await timeoutPage.getByRole('button', { name: 'Generate lesson', exact: true }).isEnabled(), true)
  await sleep(1650)
  await timeoutPage.close()
  results.push('A timed-out refresh preserves clickable saved suggestions, releases action locks, and retries without a page reload.')
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed: results.length, results, errors, unexpected, forecastRequests: requests.filter(x => x.path === '/api/syllabus/forecast').length }, null, 2))
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
} catch (error) {
  fs.writeFileSync(path.join(output, 'browser-failure.json'), JSON.stringify({ error: error.stack, results, errors, unexpected, requests }, null, 2))
  console.error(error.stack)
  process.exitCode = 1
} finally {
  await browser?.close()
  if (!server.killed) server.kill()
  fs.closeSync(serverLog)
}