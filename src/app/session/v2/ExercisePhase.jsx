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

export class ExercisePhase {
  // Private state
  #audioEngine = null;
  #questions = [];
  
  #state = 'idle'; // 'idle' | 'playing-question' | 'awaiting-answer' | 'complete'
  #currentQuestionIndex = 0;
  #answers = []; // Array of { question, userAnswer, correctAnswer, isCorrect }
  #score = 0;
  
  #listeners = new Map();
  #audioEndListener = null;
  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#questions = options.questions || [];
    
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
      return {
        id: q.id || `q${index}`,
        type: q.type || 'mc', // 'mc' (multiple choice) or 'tf' (true/false)
        question: q.question || q.text || '',
        options: q.options || [],
        answer: q.answer || q.correct || ''
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
  async start() {
    this.#currentQuestionIndex = 0;
    this.#answers = [];
    this.#score = 0;
    
    await this.#playCurrentQuestion();
  }
  
  // Public API: Submit answer
  submitAnswer(answer) {
    if (this.#state !== 'awaiting-answer') {
      console.warn('[ExercisePhase] Cannot submit answer in state:', this.#state);
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
      score: this.#score,
      totalQuestions: this.#questions.length
    });
    
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
    
    // Fetch TTS and play question
    const audioBase64 = await fetchTTS(question.question);
    await this.#audioEngine.playAudio(audioBase64 || '', [question.question]);
  }
  
  // Private: Answer validation
  #checkAnswer(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;
    
    // Normalize for comparison
    const normalize = (str) => String(str).toLowerCase().trim();
    return normalize(userAnswer) === normalize(correctAnswer);
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
    
    // Create new listener
    this.#audioEndListener = (data) => {
      if (data.completed) {
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
