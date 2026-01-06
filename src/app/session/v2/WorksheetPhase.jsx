/**
 * WorksheetPhase - Fill-in-blank questions with text input
 * 
 * Consumes AudioEngine for question playback.
 * Manages question progression and score tracking.
 * Zero coupling to session state or other phases.
 * 
 * Architecture:
 * - Loads fill-in-blank questions from lesson data
 * - Plays each question with TTS
 * - Prefetches N+1 question during N playback (eliminates wait times)
 * - Presents text input for answers
 * - Validates answers (case-insensitive, trimmed)
 * - Tracks score
 * - Emits worksheetComplete with results
 * 
 * Usage:
 *   const phase = new WorksheetPhase({ audioEngine, questions });
 *   phase.on('worksheetComplete', (results) => saveScore(results));
 *   await phase.start();
 */

import { fetchTTS } from './services';
import { ttsCache } from '../utils/ttsCache';
import { buildAcceptableList, judgeAnswer } from './judging';
import { deriveCorrectAnswerText, formatQuestionForSpeech } from '../utils/questionFormatting';
import { HINT_FIRST, HINT_SECOND, pickHint } from '../utils/feedbackMessages';

// Praise phrases for correct answers (matches V1 engagement pattern)
const PRAISE_PHRASES = [
  "Great job!",
  "That's correct!",
  "Perfect!",
  "Excellent work!",
  "You got it!",
  "Well done!",
  "Fantastic!",
  "Nice work!"
];

// Intro phrases for phase start (matches V1 pacing)
const INTRO_PHRASES = [
  "Time for the worksheet.",
  "Let's fill in some blanks.",
  "Ready for the worksheet?",
  "Let's complete these sentences."
];

export class WorksheetPhase {
  // Private state
  #audioEngine = null;
  #eventBus = null;
  #timerService = null;
  #questions = [];
  #wrongAttempts = new Map();
  #resumeState = null;
  
  #state = 'idle'; // 'idle' | 'playing-question' | 'awaiting-answer' | 'complete'
  #currentQuestionIndex = 0;
  #answers = []; // Array of { question, userAnswer, correctAnswer, isCorrect }
  #score = 0;
  #timerMode = 'play'; // 'play' | 'work'
  
  #listeners = new Map();
  #audioEndListener = null;
  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#eventBus = options.eventBus;
    this.#timerService = options.timerService;
    this.#questions = options.questions || [];
    this.#resumeState = options.resumeState || null;
    
    if (!this.#audioEngine) {
      throw new Error('WorksheetPhase requires audioEngine');
    }
    
    if (this.#questions.length === 0) {
      throw new Error('WorksheetPhase requires at least one question');
    }
    
    // Normalize questions to standard format
    this.#questions = this.#questions.map((q, index) => {
      if (typeof q === 'string') {
        // Simple string question
        return {
          id: `q${index}`,
          sourceType: 'fib',
          question: q,
          answer: ''
        };
      }
      
      // Structured question
      return {
        id: q.id || `q${index}`,
        sourceType: q.sourceType || q.type || q.questionType || 'fib',
        type: q.type ?? q.questionType ?? undefined,
        question: q.question || q.text || q.prompt || '',
        // Preserve all answer schema variants so buildAcceptableList/judgeAnswer
        // can behave consistently with other phases.
        expectedAny: Array.isArray(q.expectedAny) ? q.expectedAny : undefined,
        expected: q.expected ?? undefined,
        answer: q.answer ?? q.correct ?? '',
        correct: (typeof q.correct === 'number' ? q.correct : undefined),
        choices: Array.isArray(q.choices) ? q.choices : undefined,
        options: Array.isArray(q.options) ? q.options : undefined,
        hint: q.hint || ''
      };
    });
  }
  
  // Public API: Event subscription
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (!this.#listeners.has(event)) return;
    const callbacks = this.#listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
  
  #emit(event, data) {
    if (!this.#listeners.has(event)) return;
    this.#listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[WorksheetPhase] Event callback error:', event, err);
      }
    });
  }
  
  // Public API: Start phase
  async start() {
    // Resume path: skip intro/go and jump straight to the stored question.
    if (this.#resumeState) {
      if (Array.isArray(this.#resumeState.questions) && this.#resumeState.questions.length) {
        this.#questions = this.#resumeState.questions;
      }

      this.#score = Number(this.#resumeState.score || 0);
      this.#answers = Array.isArray(this.#resumeState.answers) ? this.#resumeState.answers : [];
      this.#timerMode = this.#resumeState.timerMode || 'work';

      if (this.#timerService) {
        if (this.#timerMode === 'work') {
          this.#timerService.transitionToWork('worksheet');
        } else {
          this.#timerService.startPlayTimer('worksheet');
        }
      }

      const nextIndex = Math.min(
        Math.max(this.#resumeState.nextQuestionIndex ?? 0, 0),
        this.#questions.length
      );

      this.#currentQuestionIndex = nextIndex;

      if (this.#currentQuestionIndex >= this.#questions.length) {
        this.#complete();
        return;
      }

      this.#state = 'awaiting-answer';
      this.#emit('stateChange', { state: 'awaiting-answer', timerMode: this.#timerMode });
      await this.#playCurrentQuestion();
      return;
    }

    // Play intro TTS (V1 pacing pattern)
    const intro = INTRO_PHRASES[Math.floor(Math.random() * INTRO_PHRASES.length)];
    this.#state = 'playing-intro';
    this.#emit('stateChange', { state: 'playing-intro' });
    
    try {
      const introAudio = await fetchTTS(intro);
      await this.#audioEngine.playAudio(introAudio || '', [intro]);
    } catch (err) {
      console.error('[WorksheetPhase] Intro TTS failed:', err);
    }
    
    // Show Go button gate (V1 pacing pattern)
    this.#state = 'awaiting-go';
    this.#timerMode = 'play';
    
    // Start play timer (3 minutes exploration time)
    if (this.#timerService) {
      this.#timerService.startPlayTimer('worksheet');
    }
    
    this.#emit('stateChange', { state: 'awaiting-go', timerMode: 'play' });
  }
  
  // Public API: User clicked Go button
  async go() {
    if (this.#state !== 'awaiting-go') {
      console.warn('[WorksheetPhase] Cannot go in state:', this.#state);
      return;
    }
    
    // Transition to work mode
    this.#timerMode = 'work';
    if (this.#timerService) {
      this.#timerService.transitionToWork('worksheet');
    }
    this.#emit('stateChange', { state: 'working', timerMode: 'work' });
    
    this.#currentQuestionIndex = 0;
    this.#answers = [];
    this.#score = 0;
    
    await this.#playCurrentQuestion();
  }
  
  // Public API: Submit answer
  async submitAnswer(answer) {
    if (this.#state !== 'awaiting-answer') {
      console.warn('[WorksheetPhase] Cannot submit answer in state:', this.#state);
      return;
    }
    
    const question = this.#questions[this.#currentQuestionIndex];
    const acceptable = buildAcceptableList(question);
    const isCorrect = await judgeAnswer(answer, acceptable, question);

    // Track wrong attempts so hint/reveal logic matches V1/V2 comprehension.
    let attempts = this.#wrongAttempts.get(question.id) || 0;
    if (!isCorrect) {
      attempts += 1;
      this.#wrongAttempts.set(question.id, attempts);
    } else {
      this.#wrongAttempts.delete(question.id);
      attempts = 0;
      this.#score++;
    }

    const correctText = deriveCorrectAnswerText(question, acceptable) || String(question.answer || '');

    // Emit attempt result, but do NOT reveal the correct answer on early misses.
    this.#emit('answerSubmitted', {
      questionIndex: this.#currentQuestionIndex,
      isCorrect,
      correctAnswer: isCorrect ? correctText : undefined,
      attempts,
      score: this.#score,
      totalQuestions: this.#questions.length
    });
    
    // Request granular snapshot save (V1 behavioral parity)
    this.#emit('requestSnapshotSave', {
      trigger: 'worksheet-answer',
      data: {
        nextQuestionIndex: Math.min(this.#currentQuestionIndex + 1, this.#questions.length),
        score: this.#score,
        totalQuestions: this.#questions.length,
        questions: this.#questions,
        answers: [...this.#answers],
        timerMode: this.#timerMode
      }
    });
    
    if (isCorrect) {
      // Record final answer
      this.#answers.push({
        questionId: question.id,
        question: question.question,
        userAnswer: answer,
        correctAnswer: correctText,
        isCorrect: true
      });

      // Play praise for correct answers (V1 engagement pattern)
      const praise = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
      try {
        this.#state = 'playing-feedback';
        this.#emit('stateChange', { state: 'playing-feedback' });
        const praiseUrl = await fetchTTS(praise);
        await this.#audioEngine.playAudio(praiseUrl, [praise]);
      } catch (error) {
        console.warn('[WorksheetPhase] Failed to play praise:', error);
      }

      // Move to next question or complete
      this.#advanceQuestion();
      return;
    }

    // Incorrect: hint, hint, reveal on 3rd (spoken feedback only)
    if (attempts < 3) {
      const qKey = String(question.id || this.#currentQuestionIndex);
      const hint = attempts === 1 ? pickHint(HINT_FIRST, qKey) : pickHint(HINT_SECOND, qKey);
      try {
        const hintUrl = await fetchTTS(hint);
        if (hintUrl) {
          await this.#audioEngine.playAudio(hintUrl, [hint]);
        }
      } catch (error) {
        console.warn('[WorksheetPhase] Failed to play hint:', error);
      }
      return;
    }

    // Reveal and advance
    this.#wrongAttempts.delete(question.id);
    const reveal = correctText ? `The correct answer is ${correctText}.` : "Let's move on.";
    try {
      const revealUrl = await fetchTTS(reveal);
      if (revealUrl) {
        await this.#audioEngine.playAudio(revealUrl, [reveal]);
      }
    } catch (error) {
      console.warn('[WorksheetPhase] Failed to play reveal:', error);
    }

    // Record final answer as incorrect after 3 attempts
    this.#answers.push({
      questionId: question.id,
      question: question.question,
      userAnswer: answer,
      correctAnswer: correctText,
      isCorrect: false
    });

    this.#emit('answerRevealed', {
      questionIndex: this.#currentQuestionIndex,
      correctAnswer: correctText
    });

    this.#advanceQuestion();
  }
  
  // Public API: Skip question
  skip() {
    if (this.#state !== 'awaiting-answer') return;
    
    const question = this.#questions[this.#currentQuestionIndex];

    // Stop any current question TTS so it cannot continue after skipping
    try {
      this.#audioEngine.stop();
    } catch {}
    
    // Record as skipped (incorrect)
    this.#answers.push({
      questionId: question.id,
      question: question.question,
      userAnswer: null,
      correctAnswer: question.answer,
      isCorrect: false
    });
    
    this.#emit('questionSkipped', {
      questionIndex: this.#currentQuestionIndex,
      correctAnswer: question.answer,
      score: this.#score,
      totalQuestions: this.#questions.length
    });

    this.#emit('requestSnapshotSave', {
      trigger: 'worksheet-skip',
      data: {
        nextQuestionIndex: Math.min(this.#currentQuestionIndex + 1, this.#questions.length),
        score: this.#score,
        totalQuestions: this.#questions.length,
        questions: this.#questions,
        answers: [...this.#answers],
        timerMode: this.#timerMode
      }
    });
    
    this.#advanceQuestion();
  }
  
  // Getters
  get state() {
    return this.#state;
  }
  
  get currentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) return null;
    return this.#questions[this.#currentQuestionIndex];
  }
  
  get currentQuestionIndex() {
    return this.#currentQuestionIndex;
  }
  
  get totalQuestions() {
    return this.#questions.length;
  }
  
  get score() {
    return this.#score;
  }
  
  get answers() {
    return [...this.#answers];
  }
  
  // Private: Question playback
  async #playCurrentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) {
      this.#complete();
      return;
    }
    
    const question = this.#questions[this.#currentQuestionIndex];
    
    this.#emit('questionStart', {
      questionIndex: this.#currentQuestionIndex,
      question: question,
      totalQuestions: this.#questions.length
    });
    
    // V1 Test pattern: Set awaiting-answer BEFORE TTS so input appears immediately
    // User can answer while question is still being read aloud
    this.#state = 'awaiting-answer';
    this.#emit('questionReady', {
      questionIndex: this.#currentQuestionIndex,
      question: question
    });
    
    // Format question for TTS (add "True/False:" prefix for TF, letter options for MC)
    const formattedQuestion = formatQuestionForSpeech(question);
    
    // Check cache first (instant if prefetched)
    let audioBase64 = ttsCache.get(formattedQuestion);
    
    if (!audioBase64) {
      // Cache miss - fetch synchronously
      audioBase64 = await fetchTTS(formattedQuestion);
      if (audioBase64) {
        ttsCache.set(formattedQuestion, audioBase64);
      }
    }
    
    // Prefetch next question in background (eliminates wait on Next click)
    const nextIndex = this.#currentQuestionIndex + 1;
    if (nextIndex < this.#questions.length) {
      const nextQuestion = formatQuestionForSpeech(this.#questions[nextIndex]);
      ttsCache.prefetch(nextQuestion);
    }
    
    // TTS plays in background - don't await so user can answer while listening
    this.#audioEngine.playAudio(audioBase64 || '', [formattedQuestion]).catch(err => {
      console.error('[WorksheetPhase] Question TTS playback error:', err);
    });
  }
  
  // Private: Question progression
  #advanceQuestion() {
    this.#currentQuestionIndex++;
    this.#playCurrentQuestion();
  }
  
  // Private: Completion
  #complete() {
    this.#state = 'complete';
    
    // Remove audio listener
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#emit('worksheetComplete', {
      score: this.#score,
      totalQuestions: this.#questions.length,
      percentage: Math.round((this.#score / this.#questions.length) * 100),
      answers: [...this.#answers]
    });
  }
  
  // Private: Audio coordination
  #setupAudioEndListener(callback) {
    // Remove previous listener
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
    }
    
    // Create new listener - advance on both completed and skipped
    this.#audioEndListener = (data) => {
      if (data.completed || data.skipped) {
        callback();
      }
    };
    
    this.#audioEngine.on('end', this.#audioEndListener);
  }
  
  // Public: Cleanup
  destroy() {
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#listeners.clear();
  }
}
