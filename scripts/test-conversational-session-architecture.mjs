import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function source(path) {
  return readFileSync(join(root, path), 'utf8')
}

function assertIncludes(haystack, needle, message = `Expected source to include: ${needle}`) {
  assert.ok(haystack.includes(needle), message)
}

function assertNotIncludes(haystack, needle, message = `Expected source not to include: ${needle}`) {
  assert.ok(!haystack.includes(needle), message)
}

function extractFunctionBody(text, functionName) {
  const start = text.indexOf(`const ${functionName} =`)
  assert.notEqual(start, -1, `Could not find ${functionName}`)

  const openBrace = text.indexOf('{', start)
  assert.notEqual(openBrace, -1, `Could not find ${functionName} body`)

  let depth = 0
  for (let index = openBrace; index < text.length; index += 1) {
    const char = text[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return text.slice(openBrace, index + 1)
  }

  throw new Error(`Could not extract ${functionName} body`)
}

test('public conversational API routes are present', () => {
  assert.ok(existsSync(join(root, 'src/app/api/sonoma-discussion/route.js')), 'Missing /api/sonoma-discussion route')
  assert.ok(existsSync(join(root, 'src/app/api/sonoma-exercise/route.js')), 'Missing /api/sonoma-exercise route')

  assertIncludes(source('src/app/api/sonoma-discussion/route.js'), 'export async function POST')
  assertIncludes(source('src/app/api/sonoma-exercise/route.js'), 'export async function POST')
})

test('PhaseOrchestrator normal learning path is Discussion to Exercise', () => {
  const orchestrator = source('src/app/session/v2/PhaseOrchestrator.jsx')

  assertIncludes(orchestrator, "this.#transitionTo('discussion')")
  assertIncludes(orchestrator, "this.#transitionTo('exercise')")
  assertIncludes(orchestrator, "onDiscussionComplete()")
  assertIncludes(orchestrator, "onExerciseComplete()")
  assertNotIncludes(
    orchestrator,
    "onDiscussionComplete() {\n    this.#transitionTo('teaching')",
    'Discussion completion must not route learners into the old Teaching phase',
  )
})

test('DiscussionPhase is the active Socratic comprehension model', () => {
  const discussion = source('src/app/session/v2/DiscussionPhase.jsx')

  assertIncludes(discussion, "const WEBB_OBJECTIVES_URL   = '/api/webb-objectives'")
  assertIncludes(discussion, "const SONOMA_DISCUSSION_URL = '/api/sonoma-discussion'")
  assertIncludes(discussion, 'async submitMessage(userText)')
  assertIncludes(discussion, "action: 'check'")
  assertIncludes(discussion, 'conversation:')
  assertIncludes(discussion, 'fetch(SONOMA_DISCUSSION_URL')
  assertIncludes(discussion, 'messages:')
  assertIncludes(discussion, "this.#eventBus.emit('discussionMessage', { role: 'user', text })")
  assertIncludes(discussion, "this.#eventBus.emit('discussionMessage', { role: 'assistant', text: replyText })")
  assertIncludes(discussion, "this.#eventBus.emit('discussionObjectiveComplete'")
  assertIncludes(discussion, "this.#eventBus.emit('discussionComplete'")
  assertIncludes(discussion, 'nextSentence()')
  assertIncludes(discussion, 'repeatCurrentSentence()')
  assertIncludes(discussion, "this.#eventBus.emit('discussionSentenceChange'")
})

test('SessionPageV2 wires sentence playback, learner chat, and conversational exercise', () => {
  const session = source('src/app/session/v2/SessionPageV2.jsx')
  const startExercisePhase = extractFunctionBody(session, 'startExercisePhase')

  assertIncludes(session, "import { ExerciseConversationPhase } from './ExerciseConversationPhase'")
  assertIncludes(session, 'const [discussionSentenceInfo, setDiscussionSentenceInfo] = useState')
  assertIncludes(session, "eventBusRef.current.on('discussionSentenceChange'")
  assertIncludes(session, 'discussionPhaseRef.current.submitMessage(discussionResponse)')
  assertIncludes(startExercisePhase, 'const phase = new ExerciseConversationPhase')
  assertIncludes(startExercisePhase, "phase.on('exerciseConvMessage'")
  assertIncludes(session, 'exercisePhaseRef.current?.submitMessage(selectedExerciseAnswer)')
  assertIncludes(session, 'exercisePhaseRef.current?.submitMessage(val)')
  assertIncludes(session, 'exerciseCurrentQuestionIndex')
  assertNotIncludes(
    startExercisePhase,
    'const phase = new ExercisePhase',
    'Normal exercise startup must use ExerciseConversationPhase, not the old ExercisePhase controller',
  )
})

test('Stage 2 evidence emitters remain attached to conversational session behavior', () => {
  const session = source('src/app/session/v2/SessionPageV2.jsx')
  const startExercisePhase = extractFunctionBody(session, 'startExercisePhase')
  const startTestPhase = extractFunctionBody(session, 'startTestPhase')

  assertIncludes(session, 'STAGE_2_EVIDENCE_EVENT_TYPES.REPEAT_USED')
  assertIncludes(session, 'STAGE_2_EVIDENCE_EVENT_TYPES.VISUAL_AID_USED')
  assertIncludes(session, 'recordAskUsed')
  assertIncludes(session, 'identityItem: item || null')
  assertIncludes(startExercisePhase, "recordEvidenceItemPresented('exercise', data)")
  assertIncludes(startExercisePhase, "recordEvidenceAnswerSubmitted('exercise', data)")
  assertIncludes(startExercisePhase, "recordEvidenceHintGiven('exercise', data)")
  assertIncludes(startExercisePhase, "recordEvidenceRetryRequested('exercise', data)")
  assertIncludes(startExercisePhase, "recordEvidenceAnswerRevealed('exercise', data)")
  assertIncludes(startTestPhase, "recordEvidenceItemPresented('test', data)")
  assertIncludes(startTestPhase, "recordEvidenceAnswerSubmitted('test', data)")
  assertIncludes(startTestPhase, "recordEvidenceAnswerRevealed('test', data)")
})
