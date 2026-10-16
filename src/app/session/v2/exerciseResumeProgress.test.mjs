import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveExerciseResumeProgress } from './exerciseResumeProgress.mjs'

const questions = [
  { id: 'q1', question: 'Question one?', answer: 'a' },
  { id: 'q2', question: 'Question two?', answer: 'b' },
  { id: 'q3', question: 'Question three?', answer: 'c' },
]
const correct = index => ({
  questionId: questions[index].id,
  question: questions[index].question,
  isCorrect: true, attemptNumber: 1,
})
const wrong = (index, attemptNumber) => ({
  questionId: questions[index].id,
  question: questions[index].question,
  isCorrect: false, attemptNumber,
})

test('a fresh Exercise starts with question one and play mode', () => {
  assert.deepEqual(resolveExerciseResumeProgress({}, questions), {
    questionIndex: 0, wrongAttempts: 0, timerMode: 'play',
  })
})

test('legacy snapshot after question one resumes at question two without resetting to play', () => {
  assert.deepEqual(resolveExerciseResumeProgress({
    nextQuestionIndex: 0,
    answers: [correct(0)],
    score: 1,
    timerMode: 'play',
    lastAction: 'exercise-answer',
  }, questions), { questionIndex: 1, wrongAttempts: 0, timerMode: 'work' })
})

test('legacy snapshot after two completed questions resumes at question three', () => {
  assert.equal(resolveExerciseResumeProgress({
    nextQuestionIndex: 1, answers: [correct(0), correct(1)],
    score: 2, lastAction: 'exercise-answer',
  }, questions).questionIndex, 2)
})

test('accepted answer saved during feedback keeps the next unanswered index', () => {
  assert.equal(resolveExerciseResumeProgress({
    nextQuestionIndex: 1, answers: [correct(0)],
    score: 1, lastAction: 'exercise-answer',
  }, questions).questionIndex, 1)
})

test('a completed final question can restore at the end, not clamp to the last question', () => {
  assert.equal(resolveExerciseResumeProgress({
    nextQuestionIndex: 2, answers: [correct(0), correct(1), correct(2)],
    score: 3, lastAction: 'exercise-answer',
  }, questions).questionIndex, 3)
})

test('wrong attempts remain on their current question and preserve attempt count', () => {
  assert.deepEqual(resolveExerciseResumeProgress({
    nextQuestionIndex: 1, answers: [correct(0), wrong(1, 1), wrong(1, 2)],
    score: 1, timerMode: 'play', lastAction: 'exercise-attempt',
  }, questions), { questionIndex: 1, wrongAttempts: 2, timerMode: 'work' })
})

test('a third incorrect answer skips only after its reveal was completed', () => {
  const answers = [correct(0), wrong(1, 1), wrong(1, 2), wrong(1, 3)]
  assert.equal(resolveExerciseResumeProgress({
    nextQuestionIndex: 1, answers, lastAction: 'exercise-attempt',
  }, questions).questionIndex, 1)
  assert.equal(resolveExerciseResumeProgress({
    nextQuestionIndex: 1, answers, lastAction: 'exercise-answer',
  }, questions).questionIndex, 2)
})

test('ambiguous duplicate question identifiers never authorize skipping', () => {
  const repeated = [questions[0], { ...questions[0], question: 'Another question?' }]
  assert.equal(resolveExerciseResumeProgress({
    nextQuestionIndex: 0, answers: [correct(0)], lastAction: 'exercise-answer',
  }, repeated).questionIndex, 0)
})

test('Exercise snapshot and UI contracts forbid a second send bar or Tour overlap', () => {
  const phase = readFileSync(new URL('./ExerciseConversationPhase.jsx', import.meta.url), 'utf8')
  const page = readFileSync(new URL('./SessionPageV2.jsx', import.meta.url), 'utf8')
  assert.match(phase, /this\.#emitSnapshotSave\('exercise-answer', this\.#questionIndex \+ 1\)/)
  assert.match(phase, /phaseOverride: 'exercise'/)
  assert.match(phase, /this\.#emitSnapshotSave\('exercise-resume'\)/)
  assert.match(page, /wrongAttempts: savedExercise\.wrongAttempts/)
  assert.match(page, /lastAction: savedExercise\.lastAction/)
  assert.match(page, /const qaPhase = \['comprehension', 'worksheet', 'test'\]/)
  assert.doesNotMatch(page, /qaPhase === 'exercise'/)
  assert.doesNotMatch(page, /submitExerciseAnswer/)
  assert.doesNotMatch(page, /exerciseSubmitting/)
  assert.match(page, /exercisePhaseRef\.current\?\.submitMessage\(choice\.value\)/)
  const videoStart = page.indexOf('<div style={videoInnerStyle}>')
  const tour = page.indexOf('Tour stays inside the video')
  const corner = page.indexOf('data-testid="sonoma-video-top-right"')
  const phaseTimer = page.indexOf('Phase Timer - top left overlay', corner)
  const footer = page.indexOf('Fixed footer with input controls')
  assert.ok(videoStart >= 0 && tour > videoStart && corner > tour && phaseTimer > corner && footer > phaseTimer)

  // All four question-number states share Tour's top-right stack, rather than
  // absolute-positioning a separate ticker at the exact same top/right pixels.
  const topRightStack = page.slice(corner, phaseTimer)
  assert.match(topRightStack, /display: 'flex'/)
  assert.match(topRightStack, /flexDirection: 'column'/)
  assert.match(topRightStack, /alignItems: 'flex-end'/)
  assert.match(topRightStack, /gap: 6/)
  assert.ok(topRightStack.includes("maxWidth: 'calc(100% - 16px)'"))
  assert.ok(topRightStack.includes("pointerEvents: 'auto'"))
  assert.equal((topRightStack.match(/position: 'absolute'/g) || []).length, 1)
  assert.equal((topRightStack.match(/top: 8/g) || []).length, 1)
  assert.equal((topRightStack.match(/right: 8/g) || []).length, 1)
  assert.equal(topRightStack.split('style={videoQuestionCounterStyle}').length - 1, 3)
  assert.ok(topRightStack.includes('{comprehensionScore}/{comprehensionTotalQuestions}'))
  assert.ok(topRightStack.includes('Q {exerciseCurrentQuestionIndex + 1}/{exerciseTotalQuestions}'))
  assert.ok(topRightStack.includes('worksheetScore + 1'))
  assert.ok(topRightStack.includes('testScore + 1'))
  assert.ok(topRightStack.includes("testState === 'awaiting-answer'"))
  assert.ok(page.includes('const videoQuestionCounterStyle = {'))
  assert.match(page, /whiteSpace: 'nowrap'/)
  assert.doesNotMatch(page, /Fixed tutorial toggle button/)
})

test('the real conversational Exercise commits progress before waiting on feedback', async () => {
  const source = readFileSync(new URL('./ExerciseConversationPhase.jsx', import.meta.url), 'utf8')
    .replace(/^import [^\r\n]+[\r\n]*/gm, '')
    .replace('export class ExerciseConversationPhase', 'class ExerciseConversationPhase')
  const ctor = new Function(
    'resolveExerciseResumeProgress', 'fetchTTS', 'buildAcceptableList', 'judgeAnswer',
    'deriveCorrectAnswerText', 'buildInstructionalLessonView',
    source + '\nreturn ExerciseConversationPhase',
  )
  const Phase = ctor(
    resolveExerciseResumeProgress,
    async () => null,
    q => [q.answer],
    async answer => answer === 'correct',
    q => q.answer,
    lesson => lesson,
  )
  const createAudio = () => {
    const listeners = new Set()
    return {
      on: (name, cb) => { if (name === 'end') listeners.add(cb) },
      off: (name, cb) => { if (name === 'end') listeners.delete(cb) },
      stop: () => {},
      playAudio: async () => { queueMicrotask(() => { for (const cb of [...listeners]) cb({ completed: true }) }) },
    }
  }
  let releaseFeedback
  let onFeedbackEntered
  const feedbackEntered = new Promise(resolve => { onFeedbackEntered = resolve })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, request) => {
    const { action } = JSON.parse(request.body)
    if (action === 'ask') return { ok: true, json: async () => ({ text: 'Try this question.' }) }
    if (action === 'feedback') {
      onFeedbackEntered()
      return await new Promise(resolve => {
        releaseFeedback = () => resolve({ ok: true, json: async () => ({ text: 'Well done!' }) })
      })
    }
    throw new Error('Unexpected action: ' + action)
  }
  try {
    const original = new Phase({ audioEngine: createAudio(), lessonData: {}, questions })
    const saves = []
    original.on('requestSnapshotSave', save => saves.push(save))
    await original.start({ skipPlayPortion: true })
    await original.go()
    const submitting = original.submitMessage('correct')
    await feedbackEntered
    const answered = saves.find(save => save.trigger === 'exercise-answer')
    assert.ok(answered, 'the correct answer was saved before feedback finished')
    assert.equal(answered.data.nextQuestionIndex, 1)
    assert.equal(answered.data.score, 1)
    assert.equal(answered.data.phaseOverride, 'exercise')
    const resumed = new Phase({
      audioEngine: createAudio(), lessonData: {}, questions,
      resumeState: { ...answered.data, lastAction: 'exercise-answer' },
    })
    const resumeStates = []
    resumed.on('stateChange', state => resumeStates.push(state))
    await resumed.start()
    assert.equal(resumeStates.at(-1)?.questionIndex, 1)
    assert.equal(resumeStates.at(-1)?.timerMode, 'work')
    assert.equal(resumeStates.at(-1)?.state, 'chatting')
    releaseFeedback()
    await submitting
    resumed.destroy()
    original.destroy()
  } finally {
    globalThis.fetch = originalFetch
    if (releaseFeedback) releaseFeedback()
  }
})
