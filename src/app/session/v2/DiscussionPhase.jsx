/**
 * DiscussionPhase.jsx
 * Manages discussion activities before teaching phase
 * Plays discussion prompts with TTS and captures student responses
 * 
 * Activities:
 * - Ask: Open-ended question about the topic
 * - Riddle: Fun riddle related to the topic
 * - Poem: Short poem introducing the topic
 * - Story: Mini-story related to the topic
 * - Fill-in-Fun: Interactive fill-in-blank game
 * 
 * Events emitted:
 * - discussionStart: { activity } - Discussion activity started
 * - promptPlaying: { activity, audio } - TTS audio playing
 * - promptComplete: { activity } - TTS finished
 * - responseSubmitted: { activity, response } - Student submitted response
 * - activitySkipped: { activity } - Activity skipped
 * - discussionComplete: { activity, response } - Discussion complete
 */

'use client';

export class DiscussionPhase {
  constructor(audioEngine, ttsService, eventBus) {
    this.audioEngine = audioEngine;
    this.ttsService = ttsService;
    this.eventBus = eventBus;
    
    // Internal state
    this.currentActivity = null;
    this.state = 'idle'; // idle | playing-prompt | awaiting-response | complete
    this.currentResponse = '';
    this.abortController = null;
    
    // Bind public methods
    this.start = this.start.bind(this);
    this.skip = this.skip.bind(this);
    this.submitResponse = this.submitResponse.bind(this);
    // Private methods are automatically bound
  }
  
  /**
   * Start a discussion activity
   * @param {string} activity - Activity type: 'ask' | 'riddle' | 'poem' | 'story' | 'fill-in-fun'
   * @param {string} prompt - The prompt text to play
   */
  async start(activity, prompt) {
    if (this.state !== 'idle') {
      console.warn('[DiscussionPhase] Cannot start - already running');
      return;
    }
    
    this.currentActivity = activity;
    this.state = 'playing-prompt';
    this.currentResponse = '';
    this.abortController = new AbortController();
    
    this.eventBus.emit('discussionStart', { activity });
    
    try {
      // Fetch TTS audio for the prompt
      const audioUrl = await this.ttsService.fetchTTS(prompt);
      
      // Check if aborted during fetch
      if (this.abortController.signal.aborted) {
        console.log('[DiscussionPhase] Aborted during TTS fetch');
        return;
      }
      
      this.eventBus.emit('promptPlaying', { activity, audio: audioUrl });
      
      // Listen for audio completion
      const cleanup = this.audioEngine.on('playbackComplete', this.#handleAudioComplete);
      
      // Play the prompt
      await this.audioEngine.play(audioUrl);
      
      // Clean up listener
      cleanup();
      
      // Check if aborted during playback
      if (this.abortController.signal.aborted) {
        console.log('[DiscussionPhase] Aborted during playback');
        return;
      }
      
      // Prompt finished - wait for response
      this.state = 'awaiting-response';
      this.eventBus.emit('promptComplete', { activity });
      
    } catch (error) {
      console.error('[DiscussionPhase] Error playing prompt:', error);
      this.state = 'idle';
      this.currentActivity = null;
      this.abortController = null;
    }
  }
  
  /**
   * Submit student response to discussion prompt
   * @param {string} response - Student's typed response
   */
  submitResponse(response) {
    if (this.state !== 'awaiting-response') {
      console.warn('[DiscussionPhase] Cannot submit - not awaiting response');
      return;
    }
    
    this.currentResponse = response;
    this.state = 'complete';
    
    this.eventBus.emit('responseSubmitted', { 
      activity: this.currentActivity, 
      response 
    });
    
    this.eventBus.emit('discussionComplete', { 
      activity: this.currentActivity, 
      response 
    });
    
    // Reset state
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
    this.audioEngine.stop();
    this.currentActivity = null;
    this.state = 'idle';
    this.currentResponse = '';
    this.abortController = null;
  }
}
