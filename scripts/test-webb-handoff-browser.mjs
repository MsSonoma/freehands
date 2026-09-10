/** Actual production-built Webb page, synthetic learners, all external/API traffic intercepted.
 * Run after npm run build. No Supabase data, production accounts, or model APIs are written.
 * Chrome profile and diagnostics stay inside the ignored .next directory.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { POST as objectivesRoute } from '../src/app/api/webb-objectives/route.js'
import { classifyWebbObjectiveAttempt } from '../src/app/lib/webbMasteryModel.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = path.join(root, '.next', 'webb-handoff-qa', String(Date.now()))
fs.mkdirSync(out, { recursive: true })
const port = Number(process.env.WEBB_QA_PORT || 3211)
let debugPort = Number(process.env.WEBB_QA_DEBUG_PORT || 0)
const origin = `http://127.0.0.1:${port}`
const chromePath = process.env.WEBB_QA_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))
if (!chromePath) throw Error('Set WEBB_QA_CHROME to an installed Chrome/Edge executable.')
const publicUrl = fs.readFileSync(path.join(root, '.env.local'), 'utf8').match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1]
if (!publicUrl) throw Error('The production build needs its existing public Supabase configuration.')
const ref = new URL(publicUrl).hostname.split('.')[0]
const learnerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const userId = '11111111-1111-4111-8111-111111111111'
const sessionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const browserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const lessonKey = 'generated/offline-webb-handoff.json'
const AUTHOR = 'The learner understands that The Magic Finger was written by Roald Dahl.'
const NARRATOR = 'The learner understands that the narrator is a girl.'
const objectives = [AUTHOR, NARRATOR]
const lesson = { lessonKey, title: 'The Magic Finger: Book Report', subject: 'language arts', grade: '5', truefalse: [{ question: 'The Magic Finger was written by Roald Dahl.', answer: true }] }
const user = { id: userId, email: 'offline@example.invalid', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: { role: 'facilitator' } }
const jwt = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })).toString('base64url'), 'offline'].join('.')
const auth = { access_token: jwt, refresh_token: 'offline', token_type: 'bearer', expires_in: 999999999, expires_at: 4102444800, user }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn, label, timeout = 16000) { const end = Date.now() + timeout; while (Date.now() < end) { try { if (await fn()) return } catch {} await delay(80) } throw Error('Timed out: ' + label) }
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.pending = new Map(); this.handlers = new Map(); this.id = 0
    this.ready = new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject })
    this.ws.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { const wait = this.pending.get(message.id); this.pending.delete(message.id); if (wait) message.error ? wait.reject(Error(JSON.stringify(message.error))) : wait.resolve(message.result) } else { for (const handler of this.handlers.get(message.method) || []) void handler(message.params) } }
  }
  on(method, handler) { this.handlers.set(method, [...(this.handlers.get(method) || []), handler]) }
  async send(method, params = {}) { await this.ready; const id = ++this.id; const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); this.ws.send(JSON.stringify({ id, method, params })); return result }
  async eval(expression) { const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value }
}
let server, chrome, cdp, injectedScript
const records = [], runtimeErrors = [], unknown = [], passed = []
let mode = 'fresh', generateCount = 0, checkCount = 0
let lastChat = null
const snapshotExpression = `JSON.parse(localStorage.getItem('webb_session_${lessonKey}') || 'null')`
async function fulfill(id, value, status = 200) { await cdp.send('Fetch.fulfillRequest', { requestId: id, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from(JSON.stringify(value)).toString('base64') }) }
async function intercept({ requestId, request, resourceType }) {
  try {
    const url = new URL(request.url)
    const isJson = Object.entries(request.headers).some(([key, value]) => key.toLowerCase() === 'content-type' && String(value).includes('application/json'))
    const body = request.postData && isJson ? JSON.parse(request.postData) : {}
    if (url.origin === origin && url.pathname.startsWith('/api/')) {
      records.push({ path: url.pathname, body })
      if (url.pathname === '/api/learner/available-lessons') return fulfill(requestId, { lessons: [lesson] })
      if (url.pathname === '/api/learner/lesson-history') return fulfill(requestId, { sessions: [] })
      if (url.pathname === '/api/syllabus/execution') return fulfill(requestId, { ok: true, occurrenceId: 'syllabus:offline', instructionalTeacher: 'webb' })
      if (url.pathname === '/api/syllabus/execution/start') return fulfill(requestId, { id: sessionId, session_id: browserId, lesson_id: lessonKey, learner_id: learnerId, instructional_teacher: 'webb', started_at: new Date().toISOString() })
      if (url.pathname === '/api/syllabus/execution/heartbeat') return fulfill(requestId, { ok: true, active: true, session: { id: sessionId, session_id: browserId, ended_at: null } })
      if (url.pathname === '/api/syllabus/execution/complete') return fulfill(requestId, { ok: false, error: 'offline completion outage' }, 503)
      if (url.pathname === '/api/evidence') return fulfill(requestId, { ok: true, exposed_keys: [], exposedKeys: [], evidence_session: { id: sessionId, evidence_status: 'partial' }, accepted: 1 })
      if (url.pathname === '/api/webb-objectives') {
        if (body.action === 'generate') { generateCount++; await delay(1100); return fulfill(requestId, mode === 'startup-error' && generateCount === 1 ? { error: 'offline setup unavailable' } : { objectives }, mode === 'startup-error' && generateCount === 1 ? 503 : 200) }
        if (body.action === 'check-writing') return fulfill(requestId, { accuracy: 'correct', sentenceOk: body.text !== 'a girl', positionFit: true })
        checkCount++
        if (['check-error', 'refresh-error'].includes(mode) && checkCount === 1) return fulfill(requestId, { error: 'offline check unavailable' }, 503)
        const response = await objectivesRoute(new Request(origin + url.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { apiKey: 'offline', callModel: async (_system, prompt) => {
          const input = JSON.parse(prompt)
          const text = input.learner_response
          const objectiveIndex = /girl/i.test(text) ? 1 : /Dahl/i.test(text) ? 0 : -1
          return JSON.stringify({ evaluations: input.remaining_objectives.some(row => row.objectiveIndex === objectiveIndex)
            ? [{ objectiveIndex, accuracy: 'correct', sentenceOk: text !== 'a girl', evidenceKind: 'fixed_fact' }] : [] })
        } })
        return fulfill(requestId, await response.json(), response.status)
      }
      if (url.pathname === '/api/webb-chat') {
        lastChat = body
        const reply = body.writingMode ? 'Use a complete thought while keeping your idea.' : !body.messages?.length ? 'What do you already know about The Magic Finger?' : body.allObjectivesMet ? 'Your notes are ready. Start writing from your notes.' : 'You have told me the author. Who tells the story?'
        return fulfill(requestId, { reply })
      }
      if (url.pathname.endsWith('tts')) return fulfill(requestId, { audio: null })
      if (url.pathname === '/api/webb-resources') return fulfill(requestId, { video: { unavailable: true }, article: null })
      if (url.pathname.includes('/pin')) return fulfill(requestId, { ok: true, hasPin: false })
      unknown.push(url.pathname); return fulfill(requestId, {})
    }
    if (url.hostname === new URL(publicUrl).hostname) {
      if (request.method === 'OPTIONS') return cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,OPTIONS' }] })
      if (url.pathname.includes('/auth/')) return fulfill(requestId, user)
      if (url.pathname.includes('/storage/')) return fulfill(requestId, request.method === 'GET' ? [] : { Key: 'offline' })
      if (url.pathname.includes('lesson_sessions')) return fulfill(requestId, { id: sessionId, session_id: browserId, ended_at: null, lesson_id: lessonKey, learner_id: learnerId })
      return fulfill(requestId, [])
    }
    if (url.origin === origin && resourceType !== 'Media') return cdp.send('Fetch.continueRequest', { requestId })
    return cdp.send('Fetch.failRequest', { requestId, errorReason: 'Aborted' })
  } catch (error) { runtimeErrors.push('intercept: ' + error.message); await fulfill(requestId, { error: 'offline fixture failed' }, 500).catch(() => {}) }
}
async function seed(name, saved = null) {
  mode = name; generateCount = 0; checkCount = 0; lastChat = null
  if (injectedScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injectedScript })
  const source = `(() => {
    if (location.origin !== ${JSON.stringify(origin)}) return;
    if (localStorage.getItem('webb_qa_case') !== ${JSON.stringify(name)}) {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('webb_qa_case', ${JSON.stringify(name)});
      localStorage.setItem('learner_id', ${JSON.stringify(learnerId)});
      localStorage.setItem('learner_name', 'Offline learner');
      localStorage.setItem('sb-${ref}-auth-token', ${JSON.stringify(JSON.stringify(auth))});
      sessionStorage.setItem('lesson_session_id', ${JSON.stringify(browserId)});
      sessionStorage.setItem('webb_pending_lesson_key', ${JSON.stringify(lessonKey)});
      ${saved ? `localStorage.setItem('webb_session_${lessonKey}', ${JSON.stringify(JSON.stringify(saved))});` : ''}
    }
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) { if (window.__failWebbSaves && k.startsWith('webb_session_')) throw new DOMException('offline quota test', 'QuotaExceededError'); return original.call(this, k, v) };
  })()`
  injectedScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source })).identifier
  await cdp.send('Page.navigate', { url: `${origin}/session/webb?learnerId=${learnerId}&occurrenceId=syllabus%3Aoffline` })
}
async function ready() { await until(() => cdp.eval(`!!document.querySelector('textarea[aria-label="Chat with Mrs. Webb"]:not(:disabled)')`), 'chat ready') }
async function type(text, selector = 'textarea[aria-label="Chat with Mrs. Webb"]', submit = true) {
  await cdp.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.focus(); e.setSelectionRange(e.value.length, e.value.length) })()`)
  await cdp.send('Input.insertText', { text })
  if (submit) { if (selector === '#webb-writing-attempt') await cdp.eval(`document.querySelector('#webb-writing-attempt').closest('form').requestSubmit()`); else { await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }) } }
}
async function click(text) { await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(e=>e.innerText.includes(${JSON.stringify(text)})); if(!b)throw Error('Button missing'); b.click() })()`) }
function pass(name) { passed.push(name); console.log('PASS ' + name) }
try {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  let serverLog = ''; server.stdout.on('data', b => { serverLog += b }); server.stderr.on('data', b => { serverLog += b })
  await until(async () => (await fetch(origin)).ok, 'production server', 20000)
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-breakpad', `--crash-dumps-dir=${out}`, `--user-data-dir=${path.join(out, 'profile')}`, `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore' })
  if (!debugPort) {
    const portFile = path.join(out, 'profile', 'DevToolsActivePort')
    await until(() => fs.existsSync(portFile), 'owned Chrome port')
    debugPort = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  }
  await until(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok, 'Chrome')
  const tab = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json()
  cdp = new CDP(tab.webSocketDebuggerUrl); await cdp.ready
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  const ipadLandscapeQa = process.env.WEBB_QA_IPAD_LANDSCAPE === '1'
  const touchQa = process.env.WEBB_QA_MOBILE === '1' || ipadLandscapeQa
  if (ipadLandscapeQa) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: true })
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
  } else if (process.env.WEBB_QA_MOBILE === '1') await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  if (touchQa) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  cdp.on('Runtime.exceptionThrown', p => runtimeErrors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text))
  cdp.on('Fetch.requestPaused', intercept)
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await seed('fresh')
  await until(() => generateCount === 1, 'generation started')
  assert.equal(await cdp.eval(`!!document.querySelector('textarea[aria-label="Chat with Mrs. Webb"]')`), false)
  await ready(); pass('startup waits for objective readiness')
  if (touchQa) {
    assert.notEqual(await cdp.eval(`document.activeElement?.getAttribute?.('aria-label')`), 'Chat with Mrs. Webb')
    await cdp.eval(`(() => { const input=document.querySelector('textarea[aria-label=\"Chat with Mrs. Webb\"]'); input?.focus(); input?.dispatchEvent(new FocusEvent('focusin', { bubbles:true })); })()`)
    await until(() => cdp.eval(`document.activeElement?.getAttribute?.('aria-label') === 'Chat with Mrs. Webb'`), 'touch focus modeled')
    await until(() => cdp.eval(`!!document.querySelector('[data-ms-typing-context]')`), 'focus keeps context visible')
    // Headless Chrome has no software keyboard. Shrink the viewport to model the visualViewport resize mobile browsers send when it opens.
    const keyboardMetrics = ipadLandscapeQa
      ? { width: 1024, height: 420, deviceScaleFactor: 1, mobile: true }
      : { width: 390, height: 520, deviceScaleFactor: 1, mobile: true }
    await cdp.send('Emulation.setDeviceMetricsOverride', keyboardMetrics)
    const keyboardHeightLimit = ipadLandscapeQa ? 430 : 530
    await until(() => cdp.eval(`window.visualViewport?.height <= ${keyboardHeightLimit}`), 'simulated touch keyboard viewport')
    await until(() => cdp.eval(`!!document.querySelector('[data-ms-typing-context]')`), 'touch typing context')
    assert.equal(await cdp.eval(`document.querySelector('[data-ms-typing-context]')?.textContent.includes('What do you already know about The Magic Finger?')`), true)
    await until(() => cdp.eval(`(() => { const panel=document.querySelector('[data-ms-typing-context]'); const input=document.querySelector('textarea[aria-label=\"Chat with Mrs. Webb\"]'); const bottom=(window.visualViewport?.offsetTop||0)+(window.visualViewport?.height||window.innerHeight); return !!panel && !!input && panel.getBoundingClientRect().bottom <= bottom + 1 && input.getBoundingClientRect().bottom <= bottom + 1 })()`), 'typing controls fit the visible viewport')
    await cdp.send('Emulation.setDeviceMetricsOverride', ipadLandscapeQa
      ? { width: 1024, height: 768, deviceScaleFactor: 1, mobile: true }
      : { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    pass('touch typing keeps recent conversation visible without automatic keyboard focus')
  }
  const answer = 'Roald Dahl wrote the magic finger'
  await type(answer)
  await until(() => cdp.eval(`${snapshotExpression}?.learnerNotes?.[0]?.text === ${JSON.stringify(answer)}`), 'original note saved')
  await ready()
  assert.equal(await cdp.eval(`document.body.innerText.includes('1/2')`), true)
  assert.deepEqual(lastChat.remainingObjectives, [NARRATOR])
  assert.deepEqual(lastChat.completedObjectives, [AUTHOR])
  assert.equal(await cdp.eval(`document.querySelector('[role="status"]')?.textContent.includes('Note saved')`), true)
  pass('first answer becomes exact saved note, visible credit and next-question context')
  await type('a girl'); await ready()
  await click('Start writing from my notes')
  await until(() => cdp.eval(`!!document.querySelector('#webb-writing-attempt')`), 'writing focus')
  assert.equal(await cdp.eval(`document.body.textContent.includes(${JSON.stringify(AUTHOR)})`), true)
  assert.equal(await cdp.eval(`document.body.textContent.includes('What you showed')`), true)
  if (touchQa) {
    assert.notEqual(await cdp.eval(`document.activeElement?.id`), 'webb-writing-attempt')
    await cdp.eval(`(() => { const input=document.querySelector('#webb-writing-attempt'); input?.focus(); input?.dispatchEvent(new FocusEvent('focusin', { bubbles:true })); })()`)
    await until(() => cdp.eval(`!!document.querySelector('[data-ms-typing-context]')`), 'writing keeps recent context visible')
    assert.equal(await cdp.eval(`document.querySelector('[data-ms-typing-context]')?.textContent.includes('a girl')`), true)
    assert.equal(await cdp.eval(`parseFloat(getComputedStyle(document.querySelector('#webb-writing-attempt')).fontSize) >= 16`), true)
    pass('writing studio preserves recent conversation while typing')
  }
  await type('Roald Dahl wrote The Magic Finger.', '#webb-writing-attempt')
  await until(() => cdp.eval(`${snapshotExpression}?.writingIndex === 0 && ${snapshotExpression}?.writingSubphase === 'committed'`), 'approved sentence held')
  assert.equal(await cdp.eval(`document.body.textContent.includes('Roald Dahl wrote The Magic Finger.')`), true)
  assert.equal(await cdp.eval(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Next sentence'))`), true)
  await delay(2200)
  assert.equal(await cdp.eval(`${snapshotExpression}?.writingIndex === 0 && ${snapshotExpression}?.writingSubphase === 'committed'`), true)
  await cdp.send('Page.reload', { ignoreCache: true })
  await until(() => cdp.eval(`document.body.innerText.includes('Resume')`), 'committed resume prompt')
  await click('Resume')
  await until(() => cdp.eval(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Next sentence'))`), 'committed gate restored')
  assert.equal(await cdp.eval(`document.body.textContent.includes(${JSON.stringify(AUTHOR)})`), true)
  await click('Next sentence')
  await until(() => cdp.eval(`${snapshotExpression}?.writingIndex === 1 && ${snapshotExpression}?.writingSubphase === 'focus'`), 'next sentence focus')
  assert.equal(await cdp.eval(`document.body.textContent.includes(${JSON.stringify(NARRATOR)})`), true)
  await type('a girl', '#webb-writing-attempt')
  await until(() => cdp.eval(`${snapshotExpression}?.writingSubphase === 'review'`), 'retry comparison')
  await type('The narrator is', '#webb-writing-attempt', false)
  await until(() => cdp.eval(`${snapshotExpression}?.writingDraft === 'The narrator is'`), 'unsent writing draft')
  await cdp.send('Page.reload', { ignoreCache: true })
  await until(() => cdp.eval(`document.body.innerText.includes('Resume')`), 'resume prompt')
  await click('Resume')
  await until(() => cdp.eval(`document.querySelector('#webb-writing-attempt')?.value === 'The narrator is'`), 'writing draft restored')
  assert.equal(await cdp.eval(`document.body.textContent.includes('Previous attempt')`), true)
  await type(' a girl.', '#webb-writing-attempt')
  await until(() => cdp.eval(`${snapshotExpression}?.writingSubphase === 'committed'`), 'final sentence held')
  assert.equal(await cdp.eval(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Finish essay'))`), true)
  assert.equal(await cdp.eval(`${snapshotExpression}?.essay == null`), true)
  await click('Finish essay')
  await until(() => cdp.eval(`${snapshotExpression}?.essay === 'Roald Dahl wrote The Magic Finger. The narrator is a girl.'`), 'complete essay')
  pass('writing objective context and learner-controlled commit gates survive resume and preserve exact final essay')
  await click('Complete Lesson')
  await until(() => cdp.eval(`document.body.innerText.includes('Retry completion')`), 'completion failure preserved')
  assert.equal(await cdp.eval(`${snapshotExpression}?.essay === 'Roald Dahl wrote The Magic Finger. The narrator is a girl.'`), true)
  assert.equal(await cdp.eval(`JSON.parse(localStorage.getItem('webb_completion_v1') || '{}')[${JSON.stringify(learnerId)}]?.[${JSON.stringify(lessonKey)}]?.completed === true`), false)
  const completionRequest = records.filter(row => row.path === '/api/syllabus/execution/complete').at(-1)
  assert.equal(completionRequest.body.occurrenceId, 'syllabus:offline')
  assert.equal(completionRequest.body.source, 'webb')
  pass('protected completion failure keeps the essay and never records false completion')

  const acceptedAuthorSentence = {
    objectiveIndex: 0, text: 'Roald Dahl wrote The Magic Finger.', sourceMessageId: 'accepted-author',
    sourceMessageCreatedAt: '2026-09-10T12:00:00Z', accuracy: 'correct', sentenceOk: true, accepted: true,
    attemptedAt: '2026-09-10T12:00:01Z', assistance: 'mrs-webb-guidance', provenance: 'learner-message',
  }
  const writingNotes = {
    0: { objectiveIndex: 0, objective: AUTHOR, text: answer, accuracy: 'correct', provenance: 'learner-message', sourceMessageId: 'note-author' },
    1: { objectiveIndex: 1, objective: NARRATOR, text: 'a girl', accuracy: 'correct', provenance: 'learner-message', sourceMessageId: 'note-narrator' },
  }
  const interruptedWritingMessage = { role: 'user', content: 'a girl', id: 'pending-writing-u2', createdAt: '2026-09-10T12:05:00Z', kind: 'writing-attempt' }
  const interruptedWritingHistory = [
    { role: 'assistant', content: "Now let's use the next note. Turn just that note into one complete sentence.", id: 'writing-a1', kind: 'writing' },
    interruptedWritingMessage,
  ]
  const writingResumeRecordStart = records.length
  await seed('writing-resume', {
    snapshotVersion: 5, selectedLesson: lesson, objectives, chatMessages: interruptedWritingHistory,
    transcript: interruptedWritingHistory.map(message => ({ role: message.role, text: message.content })),
    coveredObj: [0, 1], understoodObj: [0, 1], objectiveEvidence: {}, learnerNotes: writingNotes,
    writingMode: true, writingIndex: 1, writingSubphase: 'focus', writingDraft: interruptedWritingMessage.content,
    writingAttempts: {}, acceptedSentences: { 0: acceptedAuthorSentence }, essay: null, essayMode: false,
  })
  await until(() => cdp.eval(`document.body.innerText.includes('Resume')`), 'interrupted writing resume prompt')
  await click('Resume')
  await until(() => cdp.eval(snapshotExpression + "?.writingSubphase === 'review'"), 'interrupted writing review replayed')
  assert.equal(await cdp.eval(snapshotExpression + '.webbStage'), 'writing')
  assert.equal(await cdp.eval(snapshotExpression + '.writingMode'), true)
  assert.equal(await cdp.eval(`!!document.querySelector('#webb-writing-attempt')`), true)
  assert.equal(await cdp.eval(`!!document.querySelector('textarea[aria-label=\"Chat with Mrs. Webb\"]')`), false)
  assert.equal(await cdp.eval(snapshotExpression + ".chatMessages.filter(message => message.role === 'user' && message.content === 'a girl').length"), 1)
  assert.equal(lastChat?.writingMode, true)
  assert.equal(lastChat?.writingObjective, NARRATOR)
  assert.equal(lastChat?.writingObjectiveIndex, 1)
  assert.equal(lastChat?.writingTotalObjectives, 2)
  assert.deepEqual(lastChat?.writingPriorSentences, ['Roald Dahl wrote The Magic Finger.'])
  const writingResumeRecords = records.slice(writingResumeRecordStart)
  assert.equal(writingResumeRecords.some(record => record.path === '/api/webb-objectives' && record.body?.action === 'check'), false)
  assert.equal(writingResumeRecords.some(record => record.path === '/api/webb-objectives' && record.body?.action === 'check-writing'), true)
  const writingReviewRequest = writingResumeRecords.find(record => record.path === '/api/webb-objectives' && record.body?.action === 'check-writing')
  assert.equal(writingReviewRequest.body.objectiveIndex, 1)
  assert.equal(writingReviewRequest.body.totalObjectives, 2)
  assert.deepEqual(writingReviewRequest.body.priorSentences, ['Roald Dahl wrote The Magic Finger.'])
  assert.equal(writingResumeRecords.some(record => record.path === '/api/webb-chat' && record.body?.writingMode !== true), false)
  pass('interrupted writing review resumes in composition with Mrs. Webb writing-aware')
  await type('The narrator is a girl.', '#webb-writing-attempt')
  await until(() => cdp.eval(snapshotExpression + "?.writingSubphase === 'committed'"), 'resumed writing accepts corrected sentence')
  assert.equal(await cdp.eval(`[...document.querySelectorAll('button')].some(button => button.textContent.includes('Finish essay'))`), true)
  pass('resumed composition continues accepting sentences after refresh')

  const conversation = [{ role: 'assistant', content: 'What do you already know?', id: 'old-a1' }, { role: 'user', content: answer, id: 'old-u1' }]
  const evidence = classifyWebbObjectiveAttempt({ objectiveIndex: 0, objective: AUTHOR, conversation, evaluation: { accuracy: 'correct', sentenceOk: true, sourceMessageIndex: 1 } })
  conversation.push({ role: 'assistant', content: 'You already named the author. Can you say that again?', id: 'old-a2' })
  await seed('old-resume', { snapshotVersion: 4, selectedLesson: lesson, objectives, chatMessages: conversation, transcript: conversation.map(m => ({ role: m.role, text: m.content })), coveredObj: [0], understoodObj: [0], objectiveEvidence: { 0: evidence }, learnerNotes: {}, writingMode: false, writingAttempts: {}, acceptedSentences: {} })
  await until(() => cdp.eval(`document.body.innerText.includes('Resume')`), 'old resume prompt'); await click('Resume'); await ready()
  await until(() => cdp.eval(`${snapshotExpression}?.learnerNotes?.[0]?.text === ${JSON.stringify(answer)}`), 'old note recovered')
  assert.equal(checkCount, 0); assert.equal(generateCount, 0)
  assert.equal(await cdp.eval(`document.body.innerText.includes('1/2')`), true)
  pass('v4 resume repairs the missing note without re-answering or regrading')

  await seed('untracked-resume', { snapshotVersion: 4, selectedLesson: lesson, objectives, chatMessages: conversation,
    transcript: conversation.map(m => ({ role: m.role, text: m.content })), coveredObj: [], understoodObj: [],
    objectiveEvidence: {}, learnerNotes: {}, writingMode: false, writingAttempts: {}, acceptedSentences: {} })
  await until(() => cdp.eval(`document.body.innerText.includes('Resume')`), 'untracked resume prompt')
  await click('Resume'); await ready()
  await until(() => cdp.eval(`${snapshotExpression}?.learnerNotes?.[0]?.text === ${JSON.stringify(answer)}`), 'untracked response recovered')
  assert.equal(await cdp.eval(`${snapshotExpression}.chatMessages.filter(message => message.role === 'user').length`), 1)
  assert.deepEqual(lastChat.remainingObjectives, [NARRATOR])
  assert.equal(generateCount, 0)
  pass('untracked legacy resume evaluates original words without another learner answer')

  await seed('check-error'); await ready(); await type(answer)
  await until(() => cdp.eval(`document.body.innerText.includes('Retry saved answer')`), 'evaluation failure recovery')
  const beforeChats = records.filter(r => r.path === '/api/webb-chat').length
  await delay(150)
  assert.equal(records.filter(r => r.path === '/api/webb-chat').length, beforeChats)
  await click('Retry saved answer'); await ready()
  assert.equal(await cdp.eval(`${snapshotExpression}.chatMessages.filter(m=>m.role==='user').length`), 1)
  assert.equal(await cdp.eval(`${snapshotExpression}.objectiveEvidence[0].attempts.length`), 1)
  pass('evaluation failure retries the same stored answer without duplicate attempts')

  await seed('refresh-error'); await ready(); await type(answer)
  await until(() => cdp.eval(`document.body.innerText.includes('Retry saved answer')`), 'evaluation failure before refresh')
  await cdp.send('Page.reload', { ignoreCache: true })
  await until(() => cdp.eval(`document.body.innerText.includes('Resume')`), 'pending answer resume prompt')
  await click('Resume'); await ready()
  await until(() => cdp.eval(`${snapshotExpression}?.learnerNotes?.[0]?.text === ${JSON.stringify(answer)}`), 'pending answer resumed')
  assert.equal(await cdp.eval(`${snapshotExpression}.chatMessages.filter(message => message.role === 'user').length`), 1)
  assert.deepEqual(lastChat.remainingObjectives, [NARRATOR])
  pass('refresh during an evaluator outage resumes the saved answer rather than demanding repetition')

  await seed('storage-error'); await ready(); await cdp.eval('window.__failWebbSaves = true'); await type(answer); await ready()
  assert.equal(await cdp.eval(`document.body.innerText.includes('1/2')`), true)
  assert.equal(await cdp.eval(`document.body.innerText.includes('Retry saving')`), true)
  assert.equal(await cdp.eval(`!!document.querySelector('[role="status"]')`), false)
  await cdp.eval('window.__failWebbSaves = false'); await click('Retry saving')
  await until(() => cdp.eval(`${snapshotExpression}?.learnerNotes?.[0]?.text === ${JSON.stringify(answer)}`), 'storage retry')
  assert.equal(await cdp.eval(`document.querySelector('[role="status"]')?.textContent.includes('Note saved')`), true)
  pass('storage failure preserves comprehension and never falsely announces a saved note')
  await type('a girl'); await ready(); await click('Start writing from my notes')
  await until(() => cdp.eval(`!!document.querySelector('#webb-writing-attempt')`), 'writer for storage failure')
  await cdp.eval('window.__failWebbSaves = true')
  await type('My unsent sentence', '#webb-writing-attempt', false)
  await until(() => cdp.eval(`document.body.textContent.includes('Retry saving')`), 'visible writer save failure')
  assert.equal(await cdp.eval(`[...document.querySelectorAll('[role="alert"]')].some(e => e.textContent.includes('Retry saving') && Number(getComputedStyle(e).zIndex) > 1400)`), true)
  await cdp.eval('window.__failWebbSaves = false'); await click('Retry saving')
  await until(() => cdp.eval(`${snapshotExpression}?.writingDraft === 'My unsent sentence'`), 'writer draft saved after retry')
  pass('writing storage failure stays visible above the focus screen and preserves the unsent draft')

  await seed('startup-error')
  await until(() => cdp.eval(`document.body.innerText.includes('Retry preparing lesson')`), 'startup failure visible')
  assert.equal(await cdp.eval(`!!document.querySelector('textarea[aria-label="Chat with Mrs. Webb"]')`), false)
  await click('Retry preparing lesson'); await ready()
  pass('startup failure has a recoverable gate instead of an untracked conversation')
  assert.deepEqual(runtimeErrors, [])
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed, unexpectedApiPaths: [...new Set(unknown)], runtimeErrors, externalTraffic: 'intercepted', productionWrites: 0 }, null, 2))
  fs.writeFileSync(path.join(out, 'server.log'), serverLog)
  console.log(JSON.stringify({ browserScenarios: passed.length, runtimeErrors: runtimeErrors.length, unexpectedApiPaths: [...new Set(unknown)], productionWrites: 0, resultDirectory: out }))
} catch (error) {
  if (cdp) { fs.writeFileSync(path.join(out, 'failure.txt'), String(error.stack) + '\n' + await cdp.eval('document.body.innerText').catch(() => '') + '\n' + JSON.stringify({ records: records.slice(-12), runtimeErrors, unknown }, null, 2)); const image = await cdp.send('Page.captureScreenshot').catch(() => null); if (image) fs.writeFileSync(path.join(out, 'failure.png'), Buffer.from(image.data, 'base64')) }
  console.error(error); console.error('Diagnostics: ' + out); process.exitCode = 1
} finally {
  if (cdp) { void cdp.send('Browser.close').catch(() => {}); await delay(700); cdp.ws.close() }
  for (const proc of [chrome, server]) { if (!proc?.pid) continue; try { if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill('SIGTERM') } catch {} }
}
