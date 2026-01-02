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
          question: q,
          answer: ''
        };
      }
      
      // Structured question
      return {
        id: q.id || `q${index}`,
        question: q.question || q.text || '',
        answer: q.answer || q.correct || '',
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
    const isCorrect = this.#checkAnswer(answer, question.answer);
    
    if (isCorrect) {
      this.#score++;
    }
    
    // Record answer
    this.#answers.push({
      questionId: question.id,
      question: question.question,
      userAnswer: answer,
      correctAnswer: question.answer,
      isCorrect: isCorrect
    });
    
    this.#emit('answerSubmitted', {
      questionIndex: this.#currentQuestionIndex,
      isCorrect: isCorrect,
      correctAnswer: question.answer,
      score: this.#score,
      totalQuestions: this.#questions.length
    });
    
    // Request granular snapshot save (V1 behavioral parity)
    this.#emit('requestSnapshotSave', {
      trigger: 'worksheet-answer',
      data: {
        questionIndex: this.#currentQuestionIndex,
        score: this.#score,
        totalQuestions: this.#questions.length
      }
    });
    
    // Play praise for correct answers (V1 engagement pattern)
    if (isCorrect) {
      const praise = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
      try {
        this.#state = 'playing-feedback';
        this.#emit('stateChange', { state: 'playing-feedback' });
        const praiseUrl = await fetchTTS(praise);
        await this.#audioEngine.playAudio(praiseUrl, [praise]);
      } catch (error) {
        console.warn('[WorksheetPhase] Failed to play praise:', error);
      }
    }
    
    // Move to next question or complete
    this.#advanceQuestion();
  }
  
  // Public API: Skip question
  skip() {
    if (this.#state !== 'awaiting-answer') return;
    
    const question = this.#questions[this.#currentQuestionIndex];
    
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
    
    this.#state = 'playing-question';
    
    this.#emit('questionStart', {
      questionIndex: this.#currentQuestionIndex,
      question: question,
      totalQuestions: this.#questions.length
    });
    
    // Listen for audio end
    this.#setupAudioEndListener(() => {
      this.#state = 'awaiting-answer';
      this.#emit('questionReady', {
        questionIndex: this.#currentQuestionIndex,
        question: question
      });
    });
    
    // Check cache first (instant if prefetched)
    let audioBase64 = ttsCache.get(question.question);
    
    if (!audioBase64) {
      // Cache miss - fetch synchronously
      audioBase64 = await fetchTTS(question.question);
      if (audioBase64) {
        ttsCache.set(question.question, audioBase64);
      }
    }
    
    // Prefetch next question in background (eliminates wait on Next click)
    const nextIndex = this.#currentQuestionIndex + 1;
    if (nextIndex < this.#questions.length) {
      const nextQuestion = this.#questions[nextIndex].question;
      ttsCache.prefetch(nextQuestion);
    }
    
    await this.#audioEngine.playAudio(audioBase64 || '', [question.question]);
  }
  
  // Private: Answer validation
  #checkAnswer(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;
    
    // Normalize for comparison (case-insensitive, trim whitespace)
    const normalize = (str) => String(str).toLowerCase().trim().replace(/\s+/g, ' ');
    
    const normalizedUser = normalize(userAnswer);
    const normalizedCorrect = normalize(correctAnswer);
    
    // Exact match after normalization
    if (normalizedUser === normalizedCorrect) return true;
    
    // Allow partial match if user answer contains the correct answer
    // (e.g., "The answer is photosynthesis" matches "photosynthesis")
    if (normalizedUser.includes(normalizedCorrect)) return true;
    
    return false;
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
