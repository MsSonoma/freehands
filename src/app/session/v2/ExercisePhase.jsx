/**
 * ExercisePhase - Multiple choice and true/false questions with scoring
 * 
 * Consumes AudioEngine for question playback.
 * Manages question progression and score tracking.
 * Zero coupling to session state or other phases.
 * 
 * Architecture:
 * - Loads exercise questions from lesson data
 * - Plays each question with TTS
 * - Prefetches N+1 question during N playback (eliminates wait times)
 * - Presents multiple choice or true/false options
 * - Validates answers and tracks score
 * - Emits exerciseComplete with results
 * 
 * Usage:
 *   const phase = new ExercisePhase({ audioEngine, questions });
 *   phase.on('exerciseComplete', (results) => saveScore(results));
 *   await phase.start();
 */

import { fetchTTS } from './services';
import { ttsCache } from '../utils/ttsCache';
import { buildAcceptableList, judgeAnswer } from './judging';
import { deriveCorrectAnswerText, formatQuestionForSpeech } from '../utils/questionFormatting';
import { HINT_FIRST, HINT_SECOND, pickHint } from '../utils/feedbackMessages';

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
  "Time for some practice questions.",
  "Let's try some exercises.",
  "Ready to practice?",
  "Let's see how much you know."
];

export class ExercisePhase {
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
      throw new Error('ExercisePhase requires audioEngine');
    }
    
    if (this.#questions.length === 0) {
      throw new Error('ExercisePhase requires at least one question');
    }
    
    // Normalize questions to standard format
    this.#questions = this.#questions.map((q, index) => {
      if (typeof q === 'string') {
        // Simple string question - treat as true/false
        return {
          id: `q${index}`,
          type: 'tf',
          question: q,
          options: ['True', 'False'],
          answer: 'True'
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
        type: q.type || 'mc', // 'mc' (multiple choice) or 'tf' (true/false)
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
        console.error('[ExercisePhase] Event callback error:', event, err);
      }
    });
  }
  
  // Public API: Start phase
  async start(options = {}) {
    const skipPlayPortion = options?.skipPlayPortion === true;
    // Resume path: skip intro/go and jump straight to the stored question.
    if (this.#resumeState) {
      if (Array.isArray(this.#resumeState.questions) && this.#resumeState.questions.length) {
        this.#questions = this.#resumeState.questions;
      }

      this.#score = Number(this.#resumeState.score || 0);
      this.#answers = Array.isArray(this.#resumeState.answers) ? this.#resumeState.answers : [];
      this.#timerMode = this.#resumeState.timerMode || 'work';
      if (skipPlayPortion) {
        this.#timerMode = 'work';
      }

      if (this.#timerService) {
        if (this.#timerMode === 'work') {
          this.#timerService.transitionToWork('exercise');
        } else {
          this.#timerService.startPlayTimer('exercise');
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

    // Skip intro + play timer and jump straight into work mode.
    if (skipPlayPortion) {
      this.#state = 'awaiting-go';
      await this.go();
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
      console.error('[ExercisePhase] Intro TTS failed:', err);
    }
    
    // Show Go button gate (V1 pacing pattern)
    this.#state = 'awaiting-go';
    this.#timerMode = 'play';
    
    // Start play timer (3 minutes exploration time)
    if (this.#timerService) {
      this.#timerService.startPlayTimer('exercise');
    }
    
    this.#emit('stateChange', { state: 'awaiting-go', timerMode: 'play' });
  }
  
  // Public API: User clicked Go button
  async go() {
    if (this.#state !== 'awaiting-go') {
      console.warn('[ExercisePhase] Cannot go in state:', this.#state);
      return;
    }
    
    // Transition to work mode
    this.#timerMode = 'work';
    if (this.#timerService) {
      this.#timerService.transitionToWork('exercise');
    }
    
    this.#currentQuestionIndex = 0;
    this.#answers = [];
    this.#score = 0;
    
    await this.#playCurrentQuestion();
  }
  
  // Public API: Submit answer
  async submitAnswer(answer) {
    if (this.#state !== 'awaiting-answer') {
      console.warn('[ExercisePhase] Cannot submit answer in state:', this.#state);
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
      trigger: 'exercise-answer',
      data: {
        nextQuestionIndex: Math.min(this.#currentQuestionIndex + 1, this.#questions.length),
        score: this.#score,
        totalQuestions: this.#questions.length,
        questions: this.#questions,
        answers: [...this.#answers],
        timerMode: this.#timerMode
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
        console.error('[ExercisePhase] Praise TTS failed:', err);
      }
    }
    
    if (!isCorrect) {
      // Wrong: hint, hint, then reveal on 3rd (V1 parity).
      if (attempts < 3) {
        const qKey = String(question.id || this.#currentQuestionIndex);
        const hint = attempts === 1 ? pickHint(HINT_FIRST, qKey) : pickHint(HINT_SECOND, qKey);
        try {
          // Ensure question TTS cannot overlap feedback.
          this.#audioEngine.stop();
        } catch {}

        try {
          this.#state = 'playing-feedback';
          this.#emit('stateChange', { state: 'playing-feedback' });
          const hintUrl = await fetchTTS(hint);
          if (hintUrl) {
            await this.#audioEngine.playAudio(hintUrl, [hint]);
          }
        } catch (error) {
          console.warn('[ExercisePhase] Failed to play hint:', error);
        }

        // Return to awaiting-answer so learner can try again.
        this.#state = 'awaiting-answer';
        this.#emit('stateChange', { state: 'awaiting-answer', timerMode: this.#timerMode });
        return;
      }

      // Reveal and advance
      this.#emit('answerRevealed', {
        questionIndex: this.#currentQuestionIndex,
        correctAnswer: correctText
      });

      const reveal = correctText ? `The correct answer is ${correctText}.` : "Let's move on.";
      try {
        try { this.#audioEngine.stop(); } catch {}
        this.#state = 'playing-feedback';
        this.#emit('stateChange', { state: 'playing-feedback' });
        const revealUrl = await fetchTTS(reveal);
        if (revealUrl) {
          await this.#audioEngine.playAudio(revealUrl, [reveal]);
        }
      } catch (error) {
        console.warn('[ExercisePhase] Failed to play reveal:', error);
      }

      this.#advanceQuestion();
      return;
    }

    // Move to next question or complete
    this.#advanceQuestion();
  }
  
  // Public API: Skip question
  skip() {
    // Stop any audio first
    try {
      this.#audioEngine.stop();
    } catch {}
    
    // Handle skip based on current state
    if (this.#state === 'playing-intro') {
      // Skip intro and go to awaiting-go
      this.#state = 'awaiting-go';
      this.#timerMode = 'play';
      
      if (this.#timerService) {
        this.#timerService.startPlayTimer('exercise');
      }
      
      this.#emit('stateChange', { state: 'awaiting-go', timerMode: 'play' });
      return;
    }
    
    if (this.#state === 'awaiting-go') {
      // Treat as clicking GO button
      this.go();
      return;
    }
    
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

    this.#emit('requestSnapshotSave', {
      trigger: 'exercise-skip',
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
      console.error('[ExercisePhase] Question TTS playback error:', err);
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
    
    this.#emit('exerciseComplete', {
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
