/**
 * ComprehensionPhase - Multiple comprehension questions with scoring
 * 
 * Consumes AudioEngine for question playback.
 * Manages question progression and score tracking.
 * Zero coupling to session state or other phases.
 * 
 * Architecture:
 * - Loads comprehension questions from lesson data
 * - Plays each question with TTS
 * - Prefetches N+1 question during N playback (eliminates wait times)
 * - Presents short-answer or fill-in-blank questions
 * - Validates answers and tracks score
 * - Opening actions (play timer) before work mode
 * - Emits comprehensionComplete with results
 * 
 * Usage:
 *   const phase = new ComprehensionPhase({ audioEngine, eventBus, timerService, questions });
 *   phase.on('comprehensionComplete', (results) => saveScore(results));
 *   await phase.start();
 *   await phase.go(); // After opening actions
 */

import { fetchTTS } from './services';
import { ttsCache } from '../utils/ttsCache';
import { buildAcceptableList, judgeAnswer } from './judging';
import { deriveCorrectAnswerText, formatQuestionForSpeech } from '../utils/questionFormatting';

// V1 praise phrases for correct answers
const PRAISE_PHRASES = [
  'Great job!',
  'Excellent!',
  'You got it!',
  'Nice work!',
  'Well done!',
  'Perfect!',
  'Awesome!',
  'Fantastic!'
];

// Intro phrases for phase start (V1 pacing pattern)
const INTRO_PHRASES = [
  "Now let's check your understanding.",
  "Time to see what you learned.",
  "Let's test your knowledge.",
  "Ready for a question?"
];

export class ComprehensionPhase {
  // Private state
  #audioEngine = null;
  #eventBus = null;
  #timerService = null;
  #questions = [];
  #wrongAttempts = new Map();
  
  #state = 'idle'; // 'idle' | 'playing-intro' | 'awaiting-go' | 'awaiting-answer' | 'playing-feedback' | 'complete'
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
      throw new Error('ComprehensionPhase requires audioEngine');
    }
    
    if (this.#questions.length === 0) {
      throw new Error('ComprehensionPhase requires at least one question');
    }
    
    // Normalize questions to standard format
    this.#questions = this.#questions.map((q, index) => {
      if (typeof q === 'string') {
        // Simple string question
        return {
          id: `q${index}`,
          type: 'shortanswer',
          question: q,
          options: [],
          answer: ''
        };
      }
      
      // Structured question
      const opts = Array.isArray(q.options) ? q.options : (Array.isArray(q.choices) ? q.choices : []);
      const correctIndex = typeof q.correct === 'number'
        ? q.correct
        : (typeof q.answer === 'number' ? q.answer : null);

      // Prefer answer text when present; if answer is numeric index, map to option text.
      let answer = q.answer ?? q.correct ?? '';
      if (typeof answer === 'number' && Number.isFinite(answer) && opts && opts.length) {
        const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.:\)\-]\s*/i;
        const raw = String(opts[answer] ?? '').trim();
        answer = raw.replace(anyLabel, '').trim();
      }

      return {
        id: q.id || `q${index}`,
        type: q.type || 'shortanswer',
        question: q.question || q.text || '',
        options: opts,
        answer,
        correct: correctIndex
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
        console.error('[ComprehensionPhase] Event callback error:', event, err);
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
      console.error('[ComprehensionPhase] Intro TTS failed:', err);
    }
    
    // Show Go button gate (V1 pacing pattern)
    this.#state = 'awaiting-go';
    this.#timerMode = 'play';
    
    // Start play timer (3 minutes exploration time for opening actions)
    if (this.#timerService) {
      this.#timerService.startPlayTimer('comprehension');
    }
    
    this.#emit('stateChange', { state: 'awaiting-go', timerMode: 'play' });
  }
  
  // Public API: User clicked Go button
  async go() {
    if (this.#state !== 'awaiting-go') {
      console.warn('[ComprehensionPhase] Cannot go in state:', this.#state);
      return;
    }
    
    // Transition to work mode
    this.#timerMode = 'work';
    if (this.#timerService) {
      this.#timerService.transitionToWork('comprehension');
    }
    
    this.#currentQuestionIndex = 0;
    this.#answers = [];
    this.#score = 0;
    
    await this.#playCurrentQuestion();
  }
  
  // Public API: Submit answer
  async submitAnswer(answer) {
    if (this.#state !== 'awaiting-answer') {
      console.warn('[ComprehensionPhase] Cannot submit answer in state:', this.#state);
      return;
    }
    
    const question = this.#questions[this.#currentQuestionIndex];
    const acceptable = buildAcceptableList(question);
    const isCorrect = await judgeAnswer(answer, acceptable, question);

    // Track wrong attempts before emitting so attempt count is accurate.
    let attempts = this.#wrongAttempts.get(question.id) || 0;
    if (!isCorrect) {
      attempts += 1;
      this.#wrongAttempts.set(question.id, attempts);
    } else {
      this.#wrongAttempts.delete(question.id);
      attempts = 0;
    }
    
    if (isCorrect) {
      this.#score++;
    }

    const correctText = deriveCorrectAnswerText(question, acceptable) || String(question.answer || '');
    
    // Record answer
    this.#answers.push({
      questionId: question.id,
      question: question.question,
      userAnswer: answer,
      correctAnswer: correctText,
      isCorrect: isCorrect
    });
    
    this.#emit('answerSubmitted', {
      questionIndex: this.#currentQuestionIndex,
      isCorrect: isCorrect,
      attempts,
      score: this.#score,
      totalQuestions: this.#questions.length,
      correctAnswer: correctText
    });
    
    // Request granular snapshot save (V1 behavioral parity)
    this.#emit('requestSnapshotSave', {
      trigger: 'comprehension-answer',
      data: {
        questionIndex: this.#currentQuestionIndex,
        score: this.#score,
        totalQuestions: this.#questions.length
      }
    });
    
    // Play praise TTS if correct (V1 behavior)
    if (isCorrect) {
      this.#state = 'playing-feedback';
      const praise = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
      
      try {
        const praiseAudio = await fetchTTS(praise);
        await this.#audioEngine.playAudio(praiseAudio || '', [praise]);
      } catch (err) {
        console.error('[ComprehensionPhase] Praise TTS failed:', err);
      }
    }
    
    if (!isCorrect) {
      // After three tries, reveal and advance
      if (attempts >= 3) {
        this.#emit('answerRevealed', {
          questionIndex: this.#currentQuestionIndex,
          correctAnswer: correctText
        });
        this.#advanceQuestion();
      }
      return;
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
      score: this.#score,
      totalQuestions: this.#questions.length,
      correctAnswer: question.answer
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
    
    // V1 Test pattern: Set awaiting-answer BEFORE TTS so buttons appear immediately
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
      console.error('[ComprehensionPhase] Question TTS playback error:', err);
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
    
    this.#emit('comprehensionComplete', {
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
