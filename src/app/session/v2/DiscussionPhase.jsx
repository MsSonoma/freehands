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
    console.log('[DiscussionPhase] start() called, state:', this.#state);
    
    if (this.#state !== 'idle') {
      console.warn('[DiscussionPhase] Cannot start - already running');
      return;
    }
    
    this.#state = 'playing-greeting';
    
    // Generate greeting: "Hi [name], ready to learn about [topic]?"
    const greetingText = `Hi ${this.#learnerName}, ready to learn about ${this.#lessonTitle}?`;
    
    console.log('[DiscussionPhase] Emitting greetingPlaying event, text:', greetingText);
    this.#eventBus.emit('greetingPlaying', { greetingText });
    
    try {
      // Check cache first
      let greetingAudio = ttsCache.get(greetingText);
      
      if (!greetingAudio) {
        console.log('[DiscussionPhase] Fetching TTS for greeting...');
        greetingAudio = await fetchTTS(greetingText);
        console.log('[DiscussionPhase] TTS fetched, length:', greetingAudio?.length);
        if (greetingAudio) {
          ttsCache.set(greetingText, greetingAudio);
        }
      } else {
        console.log('[DiscussionPhase] Using cached greeting audio');
      }
      
      // Listen for audio completion - automatically proceed to teaching
      this.#setupAudioEndListener(() => {
        console.log('[DiscussionPhase] Audio end listener fired');
        this.#state = 'complete';
        this.#eventBus.emit('greetingComplete', {});
        // Automatically begin teaching after greeting
        this.#eventBus.emit('discussionComplete', {});
      });
      
      // Play greeting
      console.log('[DiscussionPhase] Playing greeting audio...');
      await this.#audioEngine.playAudio(greetingAudio || '', [greetingText]);
      
    } catch (error) {
      console.error('[DiscussionPhase] Error playing greeting:', error);
      this.#state = 'idle';
      throw error;
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
    
    // Create new listener - advance on both completed and skipped
    this.#audioEndListener = (data) => {
      if (data.completed || data.skipped) {
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
