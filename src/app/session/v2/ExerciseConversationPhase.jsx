/**
 * ExerciseConversationPhase
 *
 * Conversational exercise: one question at a time, chat-based.
 * Ms. Sonoma asks each question naturally; the learner replies in the chat.
 * Uses /api/sonoma-exercise for AI-generated question asks and feedback.
 *
 * Events (via phase.on()):
 *   stateChange         { state, questionIndex, totalQuestions, score, timerMode }
 *   exerciseConvMessage { role: 'assistant'|'user', text }
 *   exerciseComplete    { score, totalQuestions, percentage, answers }
 *   requestSnapshotSave { trigger, data }
 *
 * States: idle | awaiting-go | awaiting-response | chatting | complete
 */

import { fetchTTS } from './services'
import { buildAcceptableList, judgeAnswer } from './judging'
import { deriveCorrectAnswerText } from '../utils/questionFormatting'

const EXERCISE_CONV_URL = '/api/sonoma-exercise'

export class ExerciseConversationPhase {
  #audioEngine = null
  #eventBus    = null   // kept for constructor-compat; events go through #listeners
  #timerService = null
  #questions   = []
  #resumeState = null
  #lessonData  = null
  #learnerName = 'student'

  #state          = 'idle'
  #questionIndex  = 0
  #wrongAttempts  = 0
  #score          = 0
  #answers        = []
  #timerMode      = 'play'
  #destroyed      = false

  #listeners        = new Map()
  #audioEndListener = null

  constructor(options = {}) {
    this.#audioEngine  = options.audioEngine
    this.#eventBus     = options.eventBus
    this.#timerService = options.timerService
    this.#lessonData   = options.lessonData  || null
    this.#learnerName  = options.learnerName || 'student'
    this.#resumeState  = options.resumeState || null

    const rawQuestions = options.questions || []

    if (!this.#audioEngine) throw new Error('ExerciseConversationPhase requires audioEngine')
    if (!rawQuestions.length) throw new Error('ExerciseConversationPhase requires at least one question')

    // Normalize questions (same schema as ExercisePhase)
    this.#questions = rawQuestions.map((q, index) => {
      if (typeof q === 'string') {
        return { id: `q${index}`, type: 'tf', question: q, options: ['True', 'False'], answer: 'True' }
      }
      const opts = Array.isArray(q.options) ? q.options : (Array.isArray(q.choices) ? q.choices : [])
      const correctIndex = typeof q.correct === 'number'
        ? q.correct
        : (typeof q.answer === 'number' ? q.answer : null)
      let answer = q.answer ?? q.correct ?? ''
      if (typeof answer === 'number' && Number.isFinite(answer) && opts.length) {
        const anyLabel = /^\s*\(?[A-Z]\)?\s*[.:\)\-]\s*/i
        answer = String(opts[answer] ?? '').trim().replace(anyLabel, '').trim()
      }
      return {
        id:      q.id || `q${index}`,
        type:    q.type || 'mc',
        question: q.question || q.text || '',
        options: opts,
        answer,
        correct: correctIndex,
      }
    })
  }

  // ── Event subscription ──────────────────────────────────────────────────

  on(event, callback) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, [])
    this.#listeners.get(event).push(callback)
  }

  off(event, callback) {
    if (!this.#listeners.has(event)) return
    const list = this.#listeners.get(event)
    const i = list.indexOf(callback)
    if (i > -1) list.splice(i, 1)
  }

  #emit(event, data) {
    if (!this.#listeners.has(event)) return
    for (const cb of [...this.#listeners.get(event)]) {
      try { cb(data) } catch (err) {
        console.error('[ExerciseConversationPhase] event handler error:', event, err)
      }
    }
  }

  #emitStateChange() {
    this.#emit('stateChange', {
      state:          this.#state,
      questionIndex:  this.#questionIndex,
      totalQuestions: this.#questions.length,
      score:          this.#score,
      timerMode:      this.#timerMode,
    })
  }

  #emitSnapshotSave(trigger) {
    this.#emit('requestSnapshotSave', {
      trigger,
      data: {
        nextQuestionIndex: this.#questionIndex,
        score:             this.#score,
        totalQuestions:    this.#questions.length,
        questions:         this.#questions,
        answers:           [...this.#answers],
        timerMode:         this.#timerMode,
      },
    })
  }

  // ── Audio helpers ────────────────────────────────────────────────────────

  #setupAudioEndListener(callback) {
    this.#removeAudioEndListener()
    this.#audioEndListener = (data) => {
      if (data.completed || data.skipped) {
        this.#removeAudioEndListener()
        callback()
      }
    }
    this.#audioEngine.on('end', this.#audioEndListener)
  }

  #removeAudioEndListener() {
    if (this.#audioEndListener) {
      try { this.#audioEngine.off('end', this.#audioEndListener) } catch {}
      this.#audioEndListener = null
    }
  }

  /**
   * Fetch TTS for text, play it, and resolve when audio ends (or errors).
   * While audio is playing, #state stays as-is — caller manages state.
   */
  async #speakAndWait(text) {
    if (!text || this.#destroyed) return
    let audio = null
    try { audio = await fetchTTS(text) } catch {}
    if (this.#destroyed) return
    await new Promise((resolve) => {
      this.#setupAudioEndListener(() => resolve())
      this.#audioEngine.playAudio(audio || '', [text]).catch(() => {
        this.#removeAudioEndListener()
        resolve()
      })
    })
  }

  // ── API helpers ──────────────────────────────────────────────────────────

  async #getAskText(index) {
    const q = this.#questions[index]
    if (!q) return ''
    try {
      const res = await fetch(EXERCISE_CONV_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         'ask',
          lesson:         this.#lessonData,
          learnerName:    this.#learnerName,
          question:       q,
          questionIndex:  index,
          totalQuestions: this.#questions.length,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return data.text || ''
      }
    } catch {}
    // Fallback
    const intro = index === 0
      ? "Let's practice! Here's your first question:"
      : `Question ${index + 1}:`
    return `${intro} ${q.question}`
  }

  async #getFeedbackText(isCorrect, attemptNumber, isLastQuestion, question) {
    const acceptable    = buildAcceptableList(question)
    const correctAnswer = deriveCorrectAnswerText(question, acceptable) || String(question.answer || '')
    try {
      const res = await fetch(EXERCISE_CONV_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         'feedback',
          lesson:         this.#lessonData,
          learnerName:    this.#learnerName,
          question,
          correctAnswer,
          isCorrect,
          attemptNumber,
          isLastQuestion,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return data.text || ''
      }
    } catch {}
    // Fallbacks
    if (isCorrect && isLastQuestion)  return `Excellent work, ${this.#learnerName}! You've completed the exercise!`
    if (isCorrect)                    return `That's right! Great job!`
    if (attemptNumber >= 3)           return `The correct answer is: ${correctAnswer}. Keep it up!`
    return `Good try! Think carefully and give it another shot.`
  }

  // ── Core flow ────────────────────────────────────────────────────────────

  /**
   * Ask the current question: get AI text → emit → speak → set state=chatting.
   * State is awaiting-response during the entire ask (set by caller beforehand).
   */
  async #askCurrentQuestion() {
    if (this.#destroyed) return
    const text = await this.#getAskText(this.#questionIndex)
    if (this.#destroyed) return
    if (text) {
      this.#emit('exerciseConvMessage', { role: 'assistant', text })
      await this.#speakAndWait(text)
    }
    if (this.#destroyed) return
    // Audio complete — now it's the learner's turn
    this.#state = 'chatting'
    this.#emitStateChange()
  }

  #complete() {
    const total = this.#questions.length
    const pct   = total > 0 ? Math.round((this.#score / total) * 100) : 0
    this.#state = 'complete'
    this.#emitStateChange()
    this.#emit('exerciseComplete', {
      score:          this.#score,
      totalQuestions: total,
      percentage:     pct,
      answers:        [...this.#answers],
    })
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async start(options = {}) {
    const skipPlayPortion = options?.skipPlayPortion === true

    if (this.#resumeState) {
      if (Array.isArray(this.#resumeState.questions) && this.#resumeState.questions.length) {
        this.#questions = this.#resumeState.questions
      }
      this.#score         = Number(this.#resumeState.score || 0)
      this.#answers       = Array.isArray(this.#resumeState.answers) ? this.#resumeState.answers : []
      this.#questionIndex = Math.min(
        Math.max(this.#resumeState.nextQuestionIndex ?? 0, 0),
        Math.max(this.#questions.length - 1, 0),
      )

      const explicitMode   = this.#resumeState.timerMode
      const hasWorkProgress = this.#answers.length > 0 || this.#questionIndex > 0 || this.#score > 0
      const inferredMode   = (explicitMode === 'play' || explicitMode === 'work')
        ? explicitMode
        : (hasWorkProgress ? 'work' : 'play')
      this.#timerMode = skipPlayPortion ? 'work' : inferredMode

      if (skipPlayPortion && this.#timerService) {
        this.#timerService.transitionToWork('exercise')
      }

      if (this.#timerMode === 'play') {
        this.#state = 'awaiting-go'
        this.#emitStateChange()
        return
      }

      // Resume directly into work: re-ask the current question
      this.#timerMode = 'work'
      this.#state     = 'awaiting-response'
      this.#emitStateChange()
      await this.#askCurrentQuestion()
      return
    }

    if (skipPlayPortion) {
      this.#state     = 'awaiting-go'
      this.#timerMode = 'work'
      this.#emitStateChange()
      return
    }

    // Normal start: show the Go gate
    this.#state     = 'awaiting-go'
    this.#timerMode = 'play'
    if (this.#timerService) {
      this.#timerService.startPlayTimer('exercise')
    }
    this.#emitStateChange()
  }

  async go() {
    if (this.#state !== 'awaiting-go') return

    if (this.#timerMode === 'play' && this.#timerService) {
      this.#timerService.transitionToWork('exercise')
    }
    this.#timerMode    = 'work'
    this.#questionIndex = 0
    this.#answers      = []
    this.#score        = 0
    this.#wrongAttempts = 0

    this.#emitSnapshotSave('exercise-go')

    this.#state = 'awaiting-response'
    this.#emitStateChange()
    await this.#askCurrentQuestion()
  }

  async submitMessage(userText) {
    if (this.#state !== 'chatting') return
    const trimmed = String(userText || '').trim()
    if (!trimmed) return

    // Disable input while Ms. Sonoma processes + responds
    this.#state = 'awaiting-response'
    this.#emitStateChange()
    this.#emit('exerciseConvMessage', { role: 'user', text: trimmed })

    try {
      const q          = this.#questions[this.#questionIndex]
      const acceptable = buildAcceptableList(q)
      const isCorrect  = await judgeAnswer(trimmed, acceptable, q)
      if (this.#destroyed) return

      const correctAnswer = deriveCorrectAnswerText(q, acceptable) || String(q.answer || '')
      this.#answers.push({
        questionId:    q.id,
        question:      q.question,
        userAnswer:    trimmed,
        correctAnswer,
        isCorrect,
        attemptNumber: this.#wrongAttempts + 1,
      })

      if (isCorrect) {
        this.#score++
        this.#wrongAttempts = 0
        const isLast       = this.#questionIndex >= this.#questions.length - 1
        const feedbackText = await this.#getFeedbackText(true, 1, isLast, q)
        if (this.#destroyed) return

        if (feedbackText) {
          this.#emit('exerciseConvMessage', { role: 'assistant', text: feedbackText })
          await this.#speakAndWait(feedbackText)
        }
        if (this.#destroyed) return

        this.#emitSnapshotSave('exercise-answer')

        if (isLast) {
          this.#complete()
        } else {
          this.#questionIndex++
          this.#emitStateChange()
          await this.#askCurrentQuestion()
        }
      } else {
        this.#wrongAttempts++
        const isReveal     = this.#wrongAttempts >= 3
        const isLast       = this.#questionIndex >= this.#questions.length - 1
        const feedbackText = await this.#getFeedbackText(
          false,
          this.#wrongAttempts,
          isReveal && isLast,
          q,
        )
        if (this.#destroyed) return

        if (feedbackText) {
          this.#emit('exerciseConvMessage', { role: 'assistant', text: feedbackText })
          await this.#speakAndWait(feedbackText)
        }
        if (this.#destroyed) return

        if (isReveal) {
          this.#emitSnapshotSave('exercise-answer')
          this.#questionIndex++
          this.#wrongAttempts = 0
          if (this.#questionIndex >= this.#questions.length) {
            this.#complete()
          } else {
            this.#emitStateChange()
            await this.#askCurrentQuestion()
          }
        } else {
          // Still on same question — let the learner try again
          this.#state = 'chatting'
          this.#emitStateChange()
        }
      }
    } catch (err) {
      console.error('[ExerciseConversationPhase] submitMessage error:', err)
      if (!this.#destroyed) {
        this.#state = 'chatting'
        this.#emitStateChange()
      }
    }
  }

  /** Skip current question (mark wrong, advance). */
  skip() {
    if (this.#state === 'complete') return
    try { this.#audioEngine.stop() } catch {}
    this.#removeAudioEndListener()
    this.#complete()
  }

  destroy() {
    this.#destroyed = true
    this.#removeAudioEndListener()
    try { this.#audioEngine.stop() } catch {}
    this.#listeners.clear()
  }
}
