/**
 * DiscussionPhase.jsx (V2 Simplified)
 * 
 * V2 Architectural Decision: Greeting-only discussion phase
 * - No opening actions (Ask, Riddle, Poem, Story, Fill-in-Fun, Games)
 * - No play timer (eliminates infinite play timer exploit)
 * - Single "Begin" button advances to teaching after greeting
 * - Opening actions moved to play time in phases 2-5 (Teaching, Repeat, Transition, Comprehension, Closing)
 * 
 * Plays greeting TTS: "Hi [name], ready to learn about [topic]?"
 * Shows Begin button
 * Emits discussionComplete event when Begin clicked
 * 
 * Events emitted:
 * - greetingPlaying: { greetingText } - Greeting TTS started
 * - greetingComplete: { } - Greeting TTS finished
 * - discussionComplete: { } - Begin button clicked, advance to teaching
 */

'use client';

import { fetchTTS } from './services';
import { ttsCache } from '../utils/ttsCache';

export class DiscussionPhase {
  // Private state
  #audioEngine = null;
  #eventBus = null;
  #learnerName = '';
  #lessonTitle = '';
  
  #state = 'idle'; // 'idle' | 'playing-greeting' | 'awaiting-begin' | 'complete'
  #audioEndListener = null;
  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#eventBus = options.eventBus;
    this.#learnerName = options.learnerName || 'friend';
    this.#lessonTitle = options.lessonTitle || 'this topic';
    
    if (!this.#audioEngine) {
      throw new Error('DiscussionPhase requires audioEngine');
    }
    
    if (!this.#eventBus) {
      throw new Error('DiscussionPhase requires eventBus');
    }
  }
  
  /**
   * Start discussion phase - play greeting
   */
  async start() {
    if (this.#state !== 'idle') {
      console.warn('[DiscussionPhase] Cannot start - already running');
      return;
    }
    
    this.#state = 'playing-greeting';
    
    // Generate greeting: "Hi [name], ready to learn about [topic]?"
    const greetingText = `Hi ${this.#learnerName}, ready to learn about ${this.#lessonTitle}?`;
    
    this.#eventBus.emit('greetingPlaying', { greetingText });
    
    try {
      // Check cache first
      let greetingAudio = ttsCache.get(greetingText);
      
      if (!greetingAudio) {
        greetingAudio = await fetchTTS(greetingText);
        if (greetingAudio) {
          ttsCache.set(greetingText, greetingAudio);
        }
      }
      
      // Listen for audio completion
      this.#setupAudioEndListener(() => {
        this.#state = 'awaiting-begin';
        this.#eventBus.emit('greetingComplete', {});
      });
      
      // Play greeting
      await this.#audioEngine.playAudio(greetingAudio || '', [greetingText]);
      
    } catch (error) {
      console.error('[DiscussionPhase] Error playing greeting:', error);
      // Proceed to awaiting-begin even if TTS fails
      this.#state = 'awaiting-begin';
      this.#eventBus.emit('greetingComplete', {});
    }
  }
  
  /**
   * User clicked Begin button - advance to teaching
   */
  begin() {
    if (this.#state !== 'awaiting-begin') {
      console.warn('[DiscussionPhase] Cannot begin - not ready');
      return;
    }
    
    this.#state = 'complete';
    
    // Remove audio listener
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#eventBus.emit('discussionComplete', {});
  }
  
  /**
   * Skip greeting and go straight to teaching
   */
  skip() {
    // Stop any playing audio
    if (this.#state === 'playing-greeting') {
      this.#audioEngine.stop();
    }
    
    this.#state = 'complete';
    
    // Remove audio listener
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#eventBus.emit('discussionComplete', {});
  }
  
  // Getters
  get state() {
    return this.#state;
  }
  
  get learnerName() {
    return this.#learnerName;
  }
  
  get lessonTitle() {
    return this.#lessonTitle;
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
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#state = 'idle';
  }
}

    this.currentActivity = null;
    this.state = 'idle';
    this.abortController = null;
  }
  
  /**
   * Skip current discussion activity
   */
  skip() {
    if (this.state === 'idle') {
      console.warn('[DiscussionPhase] Cannot skip - not active');
      return;
    }
    
    // Abort any pending async operations
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Stop audio if playing
    if (this.state === 'playing-prompt') {
      this.audioEngine.stop();
    }
    
    const activity = this.currentActivity;
    
    // Reset state
    this.state = 'idle';
    this.currentActivity = null;
    this.currentResponse = '';
    this.abortController = null;
    
    this.eventBus.emit('activitySkipped', { activity });
    this.eventBus.emit('discussionComplete', { 
      activity, 
      response: null 
    });
  }
  
  /**
   * Handle audio playback complete
   * @private
   */
  #handleAudioComplete() {
    // Only act if we're in playing-prompt state
    if (this.state === 'playing-prompt') {
      this.state = 'awaiting-response';
      this.eventBus.emit('promptComplete', { 
        activity: this.currentActivity 
      });
    }
  }
  
  /**
   * Get current state
   * @returns {{ activity: string|null, state: string, response: string }}
   */
  getState() {
    return {
      activity: this.currentActivity,
      state: this.state,
      response: this.currentResponse
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Remove AudioEngine listeners
    this.audioEngine.off('end', this.#handleAudioComplete);
    
    this.audioEngine.stop();
    this.currentActivity = null;
    this.state = 'idle';
    this.currentResponse = '';
    this.abortController = null;
  }
}
