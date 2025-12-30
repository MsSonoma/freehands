/**
 * TestPhase - Graded assessment questions with review
 * 
 * Consumes AudioEngine for question playback.
 * Manages test progression, grading, and review.
 * Zero coupling to session state or other phases.
 * 
 * Architecture:
 * - Loads test questions (MC/TF/fill-in-blank)
 * - Plays each question with TTS
 * - Presents appropriate UI (radio/text input)
 * - Validates answers and tracks results
 * - Calculates grade and shows review
 * - Emits testComplete with final grade
 * 
 * Usage:
 *   const phase = new TestPhase({ audioEngine, questions });
 *   phase.on('testComplete', (results) => saveGrade(results));
 *   await phase.start();
 */

import { fetchTTS } from './services';

export class TestPhase {
  // Private state
  #audioEngine = null;
  #questions = [];
  
  #state = 'idle'; // 'idle' | 'playing-question' | 'awaiting-answer' | 'reviewing' | 'complete'
  #currentQuestionIndex = 0;
  #answers = []; // Array of { question, userAnswer, correctAnswer, isCorrect, type }
  #score = 0;
  #reviewIndex = 0;
  
  #listeners = new Map();
  #audioEndListener = null;
  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#questions = options.questions || [];
    
    if (!this.#audioEngine) {
      throw new Error('TestPhase requires audioEngine');
    }
    
    if (this.#questions.length === 0) {
      throw new Error('TestPhase requires at least one question');
    }
    
    // Normalize questions to standard format
    this.#questions = this.#questions.map((q, index) => {
      const type = q.type || 'mc';
      
      return {
        id: q.id || `q${index}`,
        type: type,
        question: q.question || q.text || '',
        options: q.options || [],
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
        console.error('[TestPhase] Event callback error:', event, err);
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
      console.warn('[TestPhase] Cannot submit answer in state:', this.#state);
      return;
    }
    
    const question = this.#questions[this.#currentQuestionIndex];
    const isCorrect = this.#checkAnswer(answer, question.answer, question.type);
    
    if (isCorrect) {
      this.#score++;
    }
    
    // Record answer
    this.#answers.push({
      questionId: question.id,
      type: question.type,
      question: question.question,
      options: question.options,
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
    
    // Move to next question or enter review
    this.#advanceQuestion();
  }
  
  // Public API: Skip question (counts as incorrect)
  skip() {
    if (this.#state !== 'awaiting-answer') return;
    
    const question = this.#questions[this.#currentQuestionIndex];
    
    // Record as skipped (incorrect)
    this.#answers.push({
      questionId: question.id,
      type: question.type,
      question: question.question,
      options: question.options,
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
  
  // Public API: Start review
  startReview() {
    if (this.#state !== 'reviewing' && this.#answers.length === 0) return;
    
    this.#reviewIndex = 0;
    this.#state = 'reviewing';
    
    this.#emit('reviewStart', {
      totalQuestions: this.#answers.length,
      score: this.#score,
      percentage: this.#calculateGrade()
    });
    
    this.#showReviewQuestion();
  }
  
  // Public API: Navigate review
  nextReview() {
    if (this.#state !== 'reviewing') return;
    
    this.#reviewIndex++;
    if (this.#reviewIndex >= this.#answers.length) {
      this.#complete();
    } else {
      this.#showReviewQuestion();
    }
  }
  
  previousReview() {
    if (this.#state !== 'reviewing') return;
    
    if (this.#reviewIndex > 0) {
      this.#reviewIndex--;
      this.#showReviewQuestion();
    }
  }
  
  skipReview() {
    if (this.#state !== 'reviewing') return;
    this.#complete();
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
  
  get reviewIndex() {
    return this.#reviewIndex;
  }
  
  get currentReviewAnswer() {
    if (this.#reviewIndex >= this.#answers.length) return null;
    return this.#answers[this.#reviewIndex];
  }
  
  // Private: Question playback
  async #playCurrentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) {
      this.#enterReview();
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
  #checkAnswer(userAnswer, correctAnswer, type) {
    if (!userAnswer || !correctAnswer) return false;
    
    // Normalize for comparison
    const normalize = (str) => String(str).toLowerCase().trim().replace(/\s+/g, ' ');
    
    const normalizedUser = normalize(userAnswer);
    const normalizedCorrect = normalize(correctAnswer);
    
    if (type === 'fill') {
      // Fill-in-blank: exact or partial match
      if (normalizedUser === normalizedCorrect) return true;
      if (normalizedUser.includes(normalizedCorrect)) return true;
      return false;
    }
    
    // MC/TF: exact match
    return normalizedUser === normalizedCorrect;
  }
  
  // Private: Question progression
  #advanceQuestion() {
    this.#currentQuestionIndex++;
    this.#playCurrentQuestion();
  }
  
  // Private: Enter review mode
  #enterReview() {
    this.#state = 'reviewing';
    this.#reviewIndex = 0;
    
    const grade = this.#calculateGrade();
    
    this.#emit('testQuestionsComplete', {
      score: this.#score,
      totalQuestions: this.#questions.length,
      percentage: grade,
      grade: this.#calculateLetterGrade(grade)
    });
    
    this.#showReviewQuestion();
  }
  
  // Private: Show review question
  #showReviewQuestion() {
    if (this.#reviewIndex >= this.#answers.length) {
      this.#complete();
      return;
    }
    
    const answer = this.#answers[this.#reviewIndex];
    
    this.#emit('reviewQuestion', {
      reviewIndex: this.#reviewIndex,
      totalReviews: this.#answers.length,
      answer: answer
    });
  }
  
  // Private: Calculate grade percentage
  #calculateGrade() {
    if (this.#questions.length === 0) return 0;
    return Math.round((this.#score / this.#questions.length) * 100);
  }
  
  // Private: Calculate letter grade
  #calculateLetterGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }
  
  // Private: Completion
  #complete() {
    this.#state = 'complete';
    
    // Remove audio listener
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    const grade = this.#calculateGrade();
    
    this.#emit('testComplete', {
      score: this.#score,
      totalQuestions: this.#questions.length,
      percentage: grade,
      grade: this.#calculateLetterGrade(grade),
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
