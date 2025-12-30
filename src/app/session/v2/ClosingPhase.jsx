/**
 * ClosingPhase - Session closing with encouragement
 * 
 * Plays closing message with TTS.
 * Zero coupling to session state or other phases.
 * 
 * Architecture:
 * - Generates or uses predefined closing message
 * - Plays with TTS via AudioEngine
 * - Emits closingComplete event
 * 
 * Usage:
 *   const phase = new ClosingPhase({ audioEngine, lessonTitle });
 *   phase.on('closingComplete', () => endSession());
 *   await phase.start();
 */

import { fetchTTS } from './services';

export class ClosingPhase {
  // Private state
  #audioEngine = null;
  #lessonTitle = '';
  #closingMessage = '';
  
  #state = 'idle'; // 'idle' | 'playing' | 'complete'
  
  #listeners = new Map();
  #audioEndListener = null;
  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#lessonTitle = options.lessonTitle || 'this lesson';
    
    if (!this.#audioEngine) {
      throw new Error('ClosingPhase requires audioEngine');
    }
    
    // Generate closing message
    this.#closingMessage = this.#generateClosingMessage();
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
        console.error('[ClosingPhase] Event callback error:', event, err);
      }
    });
  }
  
  // Public API: Start phase
  async start() {
    this.#state = 'playing';
    
    this.#emit('stateChange', {
      state: 'playing',
      message: this.#closingMessage
    });
    
    // Listen for audio end
    this.#setupAudioEndListener(() => {
      this.#complete();
    });
    
    // Fetch TTS and play closing message
    const audioBase64 = await fetchTTS(this.#closingMessage);
    await this.#audioEngine.playAudio(audioBase64 || '', [this.#closingMessage]);
  }
  
  // Public API: Skip (end immediately)
  skip() {
    this.#audioEngine.stop();
    this.#complete();
  }
  
  // Getters
  get state() {
    return this.#state;
  }
  
  get closingMessage() {
    return this.#closingMessage;
  }
  
  // Private: Generate closing message
  #generateClosingMessage() {
    // Simple encouraging message
    const messages = [
      `Great work on ${this.#lessonTitle}! You did a wonderful job today.`,
      `Nice job completing ${this.#lessonTitle}! Keep up the great work.`,
      `Excellent work on ${this.#lessonTitle}! You're doing amazing.`,
      `Way to go! You finished ${this.#lessonTitle} beautifully.`
    ];
    
    // Pick random message
    const index = Math.floor(Math.random() * messages.length);
    return messages[index];
  }
  
  // Private: Completion
  #complete() {
    this.#state = 'complete';
    
    // Remove audio listener
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#emit('closingComplete', {
      message: this.#closingMessage
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
