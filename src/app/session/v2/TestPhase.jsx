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
 * - Prefetches N+1 question during N playback (eliminates wait times)
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
import { ttsCache } from '../utils/ttsCache';
import { buildAcceptableList, judgeAnswer } from './judging';
import { deriveCorrectAnswerText, ensureQuestionMark, formatQuestionForSpeech } from '../utils/questionFormatting';

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
  "Time for the test.",
  "Let's start the test.",
  "Ready for your test?",
  "Let's see what you learned."
];

export class TestPhase {
  // Private state
  #audioEngine = null;
  #eventBus = null;
  #timerService = null;
  #questions = [];
  
  #state = 'idle'; // 'idle' | 'playing-question' | 'awaiting-answer' | 'reviewing' | 'complete'
  #currentQuestionIndex = 0;
  #answers = []; // Array of { question, userAnswer, correctAnswer, isCorrect, type }
  #score = 0;
  #reviewIndex = 0;
  #timerMode = 'play'; // 'play' | 'work'
  
  #listeners = new Map();
  #audioEndListener = null;
  #questionPlaybackToken = 0;
  #interactionInFlight = false;
  #resumeState = null;

  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#eventBus = options.eventBus;
    this.#timerService = options.timerService;
    this.#questions = options.questions || [];
    this.#resumeState = options.resumeState || null;
    
    if (!this.#audioEngine) {
      throw new Error('TestPhase requires audioEngine');
    }
    
    if (this.#questions.length === 0) {
      throw new Error('TestPhase requires at least one question');
    }
    
    // Normalize questions to standard format
    this.#questions = this.#questions.map((q, index) => {
      const type = q.type || 'mc';

      const opts = Array.isArray(q.options) ? q.options : (Array.isArray(q.choices) ? q.choices : []);
      const correctIndex = typeof q.correct === 'number'
        ? q.correct
        : (typeof q.answer === 'number' ? q.answer : null);

      let answer = q.answer ?? q.correct ?? '';
      if (typeof answer === 'number' && Number.isFinite(answer) && opts && opts.length) {
        const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.:\)\-]\s*/i;
        const raw = String(opts[answer] ?? '').trim();
        answer = raw.replace(anyLabel, '').trim();
      }

      return {
        id: q.id || `q${index}`,
        type,
        sourceType: (type === 'fill' || type === 'fib') ? 'fib' : (q.sourceType || null),
        question: q.question || q.text || '',
        options: opts,
        answer,
        correct: correctIndex,
        hint: q.hint || '',
        expectedAny: Array.isArray(q.expectedAny) ? q.expectedAny : undefined,
        keywords: Array.isArray(q.keywords) ? q.keywords : undefined,
        minKeywords: Number.isInteger(q.minKeywords) ? q.minKeywords : undefined
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
  async start(options = {}) {
    const skipPlayPortion = options?.skipPlayPortion === true;
    // Resume path: skip intro/go and jump directly to the stored question/review index.
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
          this.#timerService.transitionToWork('test');
        } else {
          this.#timerService.startPlayTimer('test');
        }
      }

      const nextIndex = Math.min(
        Math.max(this.#resumeState.nextQuestionIndex ?? 0, 0),
        this.#questions.length
      );

      this.#currentQuestionIndex = nextIndex;

      // If questions already finished, restore review position.
      if (this.#currentQuestionIndex >= this.#questions.length) {
        this.#state = 'reviewing';
        this.#reviewIndex = Math.max(Math.min(this.#resumeState.reviewIndex ?? 0, this.#answers.length), 0);
        this.startReview();
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
    // IMPORTANT: Do not await AudioEngine.playAudio() here. If the user presses
    // Skip (AudioEngine.stop), AudioEngine intentionally removes HTMLAudio/WebAudio
    // handlers, which can leave the underlying playback promise unresolved.
    // We must advance the UI gate on the AudioEngine 'end' event (completed OR skipped).
    const intro = INTRO_PHRASES[Math.floor(Math.random() * INTRO_PHRASES.length)];
    this.#state = 'playing-intro';
    this.#emit('stateChange', { state: 'playing-intro' });

    const finishIntro = () => {
      if (this.#state !== 'playing-intro') return;

      // Show Go button gate (V1 pacing pattern)
      this.#state = 'awaiting-go';
      this.#timerMode = 'play';

      // Start play timer (3 minutes exploration time)
      if (this.#timerService) {
        this.#timerService.startPlayTimer('test');
      }

      this.#emit('stateChange', { state: 'awaiting-go', timerMode: 'play' });
    };

    // Set up audio end listener for intro - advance on both completed and skipped
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
    }
    this.#audioEndListener = (data) => {
      if (data.completed || data.skipped) {
        finishIntro();
      }
    };
    this.#audioEngine.on('end', this.#audioEndListener);

    try {
      const introAudio = await fetchTTS(intro);
      this.#audioEngine.playAudio(introAudio || '', [intro]).catch((err) => {
        console.error('[TestPhase] Intro playback error:', err);
        finishIntro();
      });
    } catch (err) {
      console.error('[TestPhase] Intro TTS failed:', err);
      finishIntro();
    }
  }
  
  // Public API: User clicked Go button
  async go() {
    if (this.#state !== 'awaiting-go') {
      console.warn('[TestPhase] Cannot go in state:', this.#state);
      return;
    }
    
    // Transition to work mode
    this.#timerMode = 'work';
    if (this.#timerService) {
      this.#timerService.transitionToWork('test');
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
      console.warn('[TestPhase] Cannot submit answer in state:', this.#state);
      return;
    }

    // Prevent double-submits / submit+skip races while judging/feedback is in-flight.
    if (this.#interactionInFlight) {
      return;
    }
    this.#interactionInFlight = true;
    
    try {
      const question = this.#questions[this.#currentQuestionIndex];
      const acceptable = buildAcceptableList(question);
      const isCorrect = await judgeAnswer(answer, acceptable, question);

      // V1 Test rule: single attempt. If correct, praise and advance.
      // If incorrect, speak the correct answer and advance.
      if (isCorrect) {
        this.#score++;
      }

      const correctText = deriveCorrectAnswerText(question, acceptable) || String(question.answer || '');

      // Emit result (single-attempt test).
      this.#emit('answerSubmitted', {
        questionIndex: this.#currentQuestionIndex,
        isCorrect,
        correctAnswer: isCorrect ? correctText : undefined,
        score: this.#score,
        totalQuestions: this.#questions.length
      });
    
      // Request granular snapshot save (V1 behavioral parity)
      this.#emit('requestSnapshotSave', {
        trigger: 'test-answer',
        data: {
          nextQuestionIndex: Math.min(this.#currentQuestionIndex + 1, this.#questions.length),
          score: this.#score,
          totalQuestions: this.#questions.length,
          questions: this.#questions,
          answers: [...this.#answers],
          timerMode: this.#timerMode,
          reviewIndex: this.#reviewIndex
        }
      });

      if (isCorrect) {
        // Record answer
        this.#answers.push({
          questionId: question.id,
          type: question.type,
          question: question.question,
          options: question.options,
          userAnswer: answer,
          correctAnswer: correctText,
          isCorrect: true
        });

        // Check if we've reached the target count before playing feedback
        const reachedTarget = this.#answers.length >= this.#questions.length;
        console.log('[TestPhase] After correct answer - answers:', this.#answers.length, 'questions:', this.#questions.length, 'reachedTarget:', reachedTarget);

        // Play praise for correct answers (V1 engagement pattern)
        const praise = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
        try {
          this.#audioEngine.stop();
          this.#state = 'playing-feedback';
          this.#emit('stateChange', { state: 'playing-feedback' });
          const praiseUrl = await fetchTTS(praise);
          await this.#audioEngine.playAudio(praiseUrl, [praise]);
        } catch (error) {
          console.warn('[TestPhase] Failed to play praise:', error);
        }

        // Enter review if target reached, otherwise move to next question
        console.log('[TestPhase] About to check reachedTarget:', reachedTarget);
        if (reachedTarget) {
          console.log('[TestPhase] Calling enterReview()');
          this.#enterReview();
        } else {
          console.log('[TestPhase] Advancing to next question');
          const nextIndex = this.#currentQuestionIndex + 1;
          this.#currentQuestionIndex = nextIndex;
          this.#playCurrentQuestion();
        }
        return;
      }

      // Incorrect: speak correct answer immediately, then advance (no retries)
      const reveal = correctText ? `Not quite right. The correct answer is ${correctText}.` : "Not quite right.";
      try {
        this.#audioEngine.stop();
        this.#state = 'playing-feedback';
        this.#emit('stateChange', { state: 'playing-feedback' });
        const revealUrl = await fetchTTS(reveal);
        if (revealUrl) {
          await this.#audioEngine.playAudio(revealUrl, [reveal]);
        }
      } catch (error) {
        console.warn('[TestPhase] Failed to play reveal:', error);
      }

      // Record answer
      this.#answers.push({
        questionId: question.id,
        type: question.type,
        question: question.question,
        options: question.options,
        userAnswer: answer,
        correctAnswer: correctText,
        isCorrect: false
      });

      this.#emit('answerRevealed', {
        questionIndex: this.#currentQuestionIndex,
        correctAnswer: correctText
      });

      // Check if we've reached the target count
      const reachedTarget = this.#answers.length >= this.#questions.length;
      console.log('[TestPhase] After incorrect answer - answers:', this.#answers.length, 'questions:', this.#questions.length, 'reachedTarget:', reachedTarget);

      // Enter review if target reached, otherwise move to next question
      console.log('[TestPhase] About to check reachedTarget:', reachedTarget);
      if (reachedTarget) {
        console.log('[TestPhase] Calling enterReview()');
        this.#enterReview();
      } else {
        console.log('[TestPhase] Advancing to next question');
        const nextIndex = this.#currentQuestionIndex + 1;
        this.#currentQuestionIndex = nextIndex;
        this.#playCurrentQuestion();
      }
    } finally {
      this.#interactionInFlight = false;
    }
  }
  
  // Public API: Skip question (counts as incorrect)
  skip() {
    if (this.#state !== 'awaiting-answer') return;

    // Prevent skip racing with an in-flight submit.
    if (this.#interactionInFlight) {
      return;
    }
    this.#interactionInFlight = true;
    
    const question = this.#questions[this.#currentQuestionIndex];

    // Stop any current question TTS so it cannot continue after skipping.
    try {
      this.#audioEngine.stop();
    } catch {}
    
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

    this.#emit('requestSnapshotSave', {
      trigger: 'test-skip',
      data: {
        nextQuestionIndex: Math.min(this.#currentQuestionIndex + 1, this.#questions.length),
        score: this.#score,
        totalQuestions: this.#questions.length,
        questions: this.#questions,
        answers: [...this.#answers],
        timerMode: this.#timerMode,
        reviewIndex: this.#reviewIndex
      }
    });
    
    const nextIndex = this.#currentQuestionIndex + 1;
    this.#currentQuestionIndex = nextIndex;
    if (nextIndex >= this.#questions.length) {
      this.#enterReview();
    } else {
      this.#playCurrentQuestion();
    }
    this.#interactionInFlight = false;
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
    const playbackToken = ++this.#questionPlaybackToken;

    if (this.#currentQuestionIndex >= this.#questions.length) {
      this.#enterReview();
      return;
    }
    
    const questionIndex = this.#currentQuestionIndex;
    const question = this.#questions[questionIndex];
    
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
    
    const spokenQuestion = ensureQuestionMark(formatQuestionForSpeech(question, { layout: 'multiline' }));

    // Check cache first (instant if prefetched)
    let audioBase64 = ttsCache.get(spokenQuestion);
    
    if (!audioBase64) {
      // Cache miss - fetch synchronously
      audioBase64 = await fetchTTS(spokenQuestion);
      if (audioBase64) {
        ttsCache.set(spokenQuestion, audioBase64);
      }
    }

    // If the user mashed skip/next and we advanced while TTS was loading, do not
    // play stale audio for an old question.
    if (
      playbackToken !== this.#questionPlaybackToken ||
      this.#currentQuestionIndex !== questionIndex ||
      this.#state === 'complete' ||
      this.#state === 'reviewing'
    ) {
      return;
    }
    
    // Prefetch next question in background (eliminates wait on Next click)
    const nextIndex = this.#currentQuestionIndex + 1;
    if (nextIndex < this.#questions.length) {
      const nextQ = this.#questions[nextIndex];
      const nextSpoken = ensureQuestionMark(formatQuestionForSpeech(nextQ, { layout: 'multiline' }));
      ttsCache.prefetch(nextSpoken);
    }
    
    // TTS plays in background - don't await so user can answer while listening
    this.#audioEngine.playAudio(audioBase64 || '', [spokenQuestion]).catch(err => {
      console.error('[TestPhase] Question TTS playback error:', err);
    });
  }
  
  // Private: Question progression
  #advanceQuestion() {
    this.#currentQuestionIndex++;
    this.#playCurrentQuestion();
  }
  
  // Private: Enter review mode
  #enterReview() {
    console.log('[TestPhase] #enterReview called');
    this.#state = 'reviewing';
    this.#reviewIndex = 0;
    
    const grade = this.#calculateGrade();
    console.log('[TestPhase] Grade calculated:', grade, 'score:', this.#score, 'questions:', this.#questions.length);
    
    console.log('[TestPhase] Emitting testQuestionsComplete event');
    this.#emit('testQuestionsComplete', {
      score: this.#score,
      totalQuestions: this.#questions.length,
      percentage: grade,
      grade: this.#calculateLetterGrade(grade),
      answers: this.#answers
    });
    
    console.log('[TestPhase] Calling showReviewQuestion');
    this.#showReviewQuestion();
  }
  
  // Private: Show review question
  #showReviewQuestion() {
    console.log('[TestPhase] #showReviewQuestion called, reviewIndex:', this.#reviewIndex, 'answers.length:', this.#answers.length);
    if (this.#reviewIndex >= this.#answers.length) {
      console.log('[TestPhase] Review complete, calling #complete()');
      this.#complete();
      return;
    }
    
    const answer = this.#answers[this.#reviewIndex];
    console.log('[TestPhase] Emitting reviewQuestion event for index:', this.#reviewIndex);
    
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
  
  // Public: Cleanup
  destroy() {
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#listeners.clear();
  }
}
