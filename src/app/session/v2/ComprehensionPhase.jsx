/**
 * ComprehensionPhase - Ask comprehension question, capture answer, provide feedback
 * 
 * Consumes AudioEngine for question playback.
 * Zero coupling to session state or other phases.
 * 
 * Architecture:
 * - Plays comprehension question with TTS
 * - Captures kid's typed answer
 * - Simple validation (answer exists)
 * - Plays praise TTS after correct answer (V1 behavior)
 * - TTS prefetching for performance (eliminates wait times)
 * - Emits comprehensionComplete event
 * 
 * Usage:
 *   const phase = new ComprehensionPhase({ audioEngine, question });
 *   phase.on('comprehensionComplete', (answer) => saveAnswer(answer));
 *   await phase.start();
 */

import { fetchTTS } from './services';
import { ttsCache } from '../utils/ttsCache';

// V1 praise phrases (from CELEBRATE_CORRECT array)
const PRAISE_PHRASES = [
  'Great job!',
  'Excellent!',
  'You got it!',
  'Nice work!',
  'Well done!',
  'Perfect!',
  'Awesome!',
  'Fantastic!',
  'You are doing great!',
  'Keep it up!'
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
  #question = '';
  #sampleAnswer = '';
  
  #state = 'idle'; // 'idle' | 'playing-question' | 'awaiting-answer' | 'complete'
  #userAnswer = '';
  
  #listeners = new Map();
  #audioEndListener = null;
  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#question = options.question || '';
    this.#sampleAnswer = options.sampleAnswer || '';
    
    if (!this.#audioEngine) {
      throw new Error('ComprehensionPhase requires audioEngine');
    }
    
    if (!this.#question) {
      throw new Error('ComprehensionPhase requires question');
    }
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
    this.#emit('stateChange', { state: 'awaiting-go', question: this.#question });
  }
  
  // Public API: User clicked Go button
  async go() {
    if (this.#state !== 'awaiting-go') {
      console.warn('[ComprehensionPhase] Cannot go in state:', this.#state);
      return;
    }
    
    this.#state = 'playing-question';
    
    this.#emit('stateChange', {
      state: 'playing-question',
      question: this.#question
    });
    
    // Listen for audio end
    this.#setupAudioEndListener(() => {
      this.#state = 'awaiting-answer';
      this.#emit('stateChange', {
        state: 'awaiting-answer'
      });
    });
    
    // Check cache first (instant if prefetched)
    let audioBase64 = ttsCache.get(this.#question);
    
    if (!audioBase64) {
      // Cache miss - fetch synchronously
      audioBase64 = await fetchTTS(this.#question);
      if (audioBase64) {
        ttsCache.set(this.#question, audioBase64);
      }
    }
    
    await this.#audioEngine.playAudio(audioBase64 || '', [this.#question]);
  }
  
  // Public API: Submit answer
  async submitAnswer(answer) {
    if (this.#state !== 'awaiting-answer') {
      console.warn('[ComprehensionPhase] Cannot submit answer in state:', this.#state);
      return;
    }
    
    this.#userAnswer = (answer || '').trim();
    
    if (!this.#userAnswer) {
      this.#emit('error', {
        message: 'Please type an answer before submitting.'
      });
      return;
    }
    
    // Emit answer capture for session tracking
    this.#emit('answerCaptured', {
      question: this.#question,
      answer: this.#userAnswer
    });
    
    // Request granular snapshot save with setTimeout to ensure React state flush
    setTimeout(() => {
      this.#emit('requestSnapshotSave', {
        trigger: 'comprehension-answer',
        data: { question: this.#question, answer: this.#userAnswer }
      });
    }, 0);
    
    // Play praise TTS (V1 behavior - positive reinforcement)
    this.#state = 'playing-feedback';
    this.#emit('stateChange', { state: 'playing-feedback' });
    
    const praise = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
    
    try {
      const praiseAudio = await fetchTTS(praise);
      await this.#audioEngine.playAudio(praiseAudio || '', [praise]);
      
      // Wait for praise to finish, then complete
      this.#setupAudioEndListener(() => {
        this.#complete();
      });
    } catch (err) {
      console.error('[ComprehensionPhase] Praise TTS failed:', err);
      // Complete anyway if praise fails
      this.#complete();
    }
  }
  
  // Public API: Skip (move on without answer)
  skip() {
    this.#userAnswer = '';
    this.#complete();
  }
  
  // Getters
  get state() {
    return this.#state;
  }
  
  get question() {
    return this.#question;
  }
  
  get sampleAnswer() {
    return this.#sampleAnswer;
  }
  
  get userAnswer() {
    return this.#userAnswer;
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
      question: this.#question,
      answer: this.#userAnswer,
      sampleAnswer: this.#sampleAnswer
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
