/**
 * AudioEngine - Self-contained audio playback system
 * 
 * Manages all audio playback paths, caption synchronization, and video coordination
 * without any coupling to session state or teaching logic.
 * 
 * Architecture:
 * - Three playback paths: HTMLAudio (preferred), WebAudio (iOS fallback), Synthetic (no audio)
 * - Event-driven: emits 'start', 'end', 'captionChange', 'error'
 * - Single source of truth for audio state (no ref/state duplication)
 * - Deterministic caption timing (one timer system, not three competing systems)
 * 
 * Usage:
 *   const engine = new AudioEngine({ videoElement });
 *   engine.on('captionChange', (index) => setCaptionIndex(index));
 *   engine.on('end', () => enableNextQuestion());
 *   await engine.playAudio(base64, sentences);
 */

export class AudioEngine {
  // Private state
  #audioElement = null;
  #videoElement = null;
  #audioContext = null;
  #gainNode = null;
  #sourceNode = null;
  #audioBuffer = null;
  
  #isPlaying = false;
  #isMuted = false;
  #currentCaptionIndex = 0;
  #captionTimers = [];
  #speechGuardTimer = null;
  
  #lastAudioBase64 = null;
  #lastSentences = [];
  #htmlAudioPausedAt = 0;
  #webAudioStartedAt = 0;
  #webAudioPausedAt = 0;
  
  #listeners = new Map(); // Event listeners
  
  constructor(options = {}) {
    this.#videoElement = options.videoElement || null;
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
        console.error('[AudioEngine] Event callback error:', event, err);
      }
    });
  }
  
  // Public API: Initialize (iOS audio unlock)
  async initialize() {
    // iOS audio unlock - create AudioContext during user gesture
    if (!this.#audioContext || this.#audioContext.state === 'closed') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.#audioContext = new AudioContext();
        this.#gainNode = this.#audioContext.createGain();
        this.#gainNode.gain.value = this.#isMuted ? 0 : 1;
        this.#gainNode.connect(this.#audioContext.destination);
      }
    }
    
    if (this.#audioContext && this.#audioContext.state === 'suspended') {
      await this.#audioContext.resume();
    }
    
    // Play silent audio to unlock HTMLAudio on iOS
    const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    silentAudio.muted = true;
    silentAudio.volume = 0;
    try {
      await silentAudio.play();
    } catch {
      // Ignore errors from silent audio
    }
  }
  
  // Public API: Playback control
  async playAudio(base64Audio, sentences = [], startIndex = 0, options = {}) {
    this.#lastAudioBase64 = base64Audio;
    this.#lastSentences = sentences;
    
    // Stop any existing playback
    this.stop();
    
    // Validate
    if (!Array.isArray(sentences) || sentences.length === 0) {
      console.warn('[AudioEngine] No sentences provided');
      return;
    }
    
    this.#currentCaptionIndex = startIndex;
    this.#isPlaying = true;
    this.#emit('start', { sentences, startIndex });
    
    // Start video playback (V1 behavior - video syncs with audio)
    if (this.#videoElement) {
      try {
        const playPromise = this.#videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('[AudioEngine] Video play failed:', err);
          });
        }
      } catch (err) {
        console.warn('[AudioEngine] Video play error:', err);
      }
    }
    
    // Start video playback (V1 behavior)
    this.#startVideo();
    
    // Choose playback path
    if (!base64Audio) {
      // Synthetic path (no audio)
      await this.#playSynthetic(sentences, startIndex);
    } else {
      // Try HTMLAudio first (better mobile compatibility)
      try {
        await this.#playHTMLAudio(base64Audio, sentences, startIndex, options);
      } catch (err) {
        console.warn('[AudioEngine] HTMLAudio failed, trying WebAudio:', err);
        try {
          await this.#playWebAudio(base64Audio, sentences, startIndex, options);
        } catch (err2) {
          console.error('[AudioEngine] Both audio paths failed:', err2);
          this.#isPlaying = false;
          this.#emit('error', err2);
          this.#emit('end', { completed: false });
        }
      }
    }
  }
  
  stop() {
    // Stop HTMLAudio
    if (this.#audioElement) {
      try {
        this.#audioElement.pause();
        this.#audioElement.src = '';
        this.#audioElement = null;
      } catch {}
    }
    
    // Stop WebAudio
    if (this.#sourceNode) {
      try {
        this.#sourceNode.stop();
        this.#sourceNode.disconnect();
        this.#sourceNode = null;
      } catch {}
    }
    
    // Stop video
    if (this.#videoElement) {
      try {
        this.#videoElement.pause();
      } catch {}
    }
    
    // Clear timers
    this.#clearCaptionTimers();
    this.#clearSpeechGuard();
    
    this.#isPlaying = false;
  }
  
  pause() {
    if (this.#audioElement) {
      try {
        this.#htmlAudioPausedAt = this.#audioElement.currentTime || 0;
        this.#audioElement.pause();
      } catch {}
    }
    
    if (this.#sourceNode && this.#audioContext) {
      try {
        const elapsed = this.#audioContext.currentTime - this.#webAudioStartedAt;
        this.#webAudioPausedAt = elapsed;
        this.#sourceNode.stop();
        this.#sourceNode.disconnect();
        this.#sourceNode = null;
      } catch {}
    }
    
    if (this.#videoElement) {
      try {
        this.#videoElement.pause();
      } catch {}
    }
    
    this.#clearCaptionTimers();
    this.#clearSpeechGuard();
  }
  
  async resume() {
    if (this.#audioElement && this.#htmlAudioPausedAt > 0) {
      try {
        this.#audioElement.currentTime = this.#htmlAudioPausedAt;
        await this.#audioElement.play();
        this.#startVideo();
        
        // Resume caption timers
        const remaining = this.#audioElement.duration - this.#htmlAudioPausedAt;
        this.#scheduleCaptionsForDuration(
          remaining,
          this.#lastSentences,
          this.#currentCaptionIndex
        );
        
        // Resume speech guard
        this.#armSpeechGuard(remaining);
      } catch (err) {
        console.error('[AudioEngine] Resume failed:', err);
      }
    } else if (this.#audioBuffer && this.#webAudioPausedAt > 0) {
      try {
        await this.#resumeWebAudio();
      } catch (err) {
        console.error('[AudioEngine] WebAudio resume failed:', err);
      }
    }
  }
  
  setMuted(muted) {
    this.#isMuted = muted;
    
    if (this.#audioElement) {
      try {
        this.#audioElement.muted = muted;
        this.#audioElement.volume = muted ? 0 : 1;
      } catch {}
    }
    
    if (this.#gainNode) {
      try {
        this.#gainNode.gain.value = muted ? 0 : 1;
      } catch {}
    }
  }
  
  // Getters
  get isPlaying() {
    return this.#isPlaying;
  }
  
  get isMuted() {
    return this.#isMuted;
  }
  
  get currentCaptionIndex() {
    return this.#currentCaptionIndex;
  }
  
  // Private: HTMLAudio path
  async #playHTMLAudio(base64, sentences, startIndex, options = {}) {
    const blob = this.#base64ToBlob(base64);
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      this.#audioElement = audio;
      
      audio.muted = this.#isMuted;
      audio.volume = this.#isMuted ? 0 : 1;
      
      if (options.resumeAtSeconds) {
        audio.currentTime = options.resumeAtSeconds;
      }
      
      audio.onplay = () => {
        this.#startVideo();
      };
      
      audio.ontimeupdate = () => {
        if (!audio.duration || audio.duration <= 0) return;
        
        const progress = audio.currentTime / audio.duration;
        const index = Math.min(
          sentences.length - 1,
          Math.floor(progress * sentences.length)
        );
        
        if (index !== this.#currentCaptionIndex) {
          this.#currentCaptionIndex = index + startIndex;
          this.#emit('captionChange', this.#currentCaptionIndex);
        }
        
        // Rearm guard as we get progress updates
        const remaining = audio.duration - audio.currentTime;
        if (remaining > 0) {
          this.#armSpeechGuard(remaining);
        }
      };
      
      audio.onended = () => {
        this.#cleanup();
        this.#emit('end', { completed: true });
        resolve();
      };
      
      audio.onerror = (err) => {
        this.#cleanup();
        reject(err);
      };
      
      audio.onpause = () => {
        if (this.#videoElement) {
          try {
            this.#videoElement.pause();
          } catch {}
        }
      };
      
      const playPromise = audio.play();
      
      // Arm initial guard with estimated duration
      const estimatedDuration = this.#computeHeuristicDuration(sentences);
      this.#armSpeechGuard(estimatedDuration + 2);
      
      if (playPromise && playPromise.catch) {
        playPromise.catch(reject);
      }
    });
  }
  
  // Private: WebAudio path (iOS fallback)
  async #playWebAudio(base64, sentences, startIndex, options = {}) {
    const arrayBuffer = this.#base64ToArrayBuffer(base64);
    
    return new Promise(async (resolve, reject) => {
      try {
        // Create/resume AudioContext
        if (!this.#audioContext || this.#audioContext.state === 'closed') {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          this.#audioContext = new AudioContext();
          
          this.#gainNode = this.#audioContext.createGain();
          this.#gainNode.gain.value = this.#isMuted ? 0 : 1;
          this.#gainNode.connect(this.#audioContext.destination);
        }
        
        if (this.#audioContext.state === 'suspended') {
          await this.#audioContext.resume();
        }
        
        // Decode audio
        this.#audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);
        
        // Create source
        const source = this.#audioContext.createBufferSource();
        source.buffer = this.#audioBuffer;
        source.connect(this.#gainNode);
        this.#sourceNode = source;
        
        const offset = options.resumeAtSeconds || 0;
        this.#webAudioStartedAt = this.#audioContext.currentTime - offset;
        
        source.onended = () => {
          this.#cleanup();
          this.#emit('end', { completed: true });
          resolve();
        };
        
        // Start playback
        source.start(0, offset);
        this.#startVideo();
        
        // Schedule captions
        const duration = this.#audioBuffer.duration - offset;
        this.#scheduleCaptionsForDuration(duration, sentences, startIndex);
        
        // Arm guard
        this.#armSpeechGuard(duration);
        
      } catch (err) {
        this.#cleanup();
        reject(err);
      }
    });
  }
  
  async #resumeWebAudio() {
    if (!this.#audioBuffer || !this.#audioContext) return;
    
    const source = this.#audioContext.createBufferSource();
    source.buffer = this.#audioBuffer;
    source.connect(this.#gainNode);
    this.#sourceNode = source;
    
    const offset = Math.max(0, this.#webAudioPausedAt);
    this.#webAudioStartedAt = this.#audioContext.currentTime - offset;
    
    source.onended = () => {
      this.#cleanup();
      this.#emit('end', { completed: true });
    };
    
    source.start(0, offset);
    this.#startVideo();
    
    const duration = this.#audioBuffer.duration - offset;
    this.#scheduleCaptionsForDuration(duration, this.#lastSentences, this.#currentCaptionIndex);
    this.#armSpeechGuard(duration);
  }
  
  // Private: Synthetic path (no audio, just captions + video)
  async #playSynthetic(sentences, startIndex) {
    const duration = this.#computeHeuristicDuration(sentences);
    
    this.#startVideo();
    this.#scheduleCaptionsForDuration(duration, sentences, startIndex);
    
    return new Promise((resolve) => {
      this.#speechGuardTimer = setTimeout(() => {
        this.#cleanup();
        this.#emit('end', { completed: true });
        resolve();
      }, duration * 1000);
    });
  }
  
  // Private: Caption scheduling
  #scheduleCaptionsForDuration(durationSeconds, sentences, startIndex) {
    this.#clearCaptionTimers();
    
    if (sentences.length === 0) return;
    
    const interval = (durationSeconds * 1000) / sentences.length;
    
    sentences.forEach((sentence, i) => {
      const timer = setTimeout(() => {
        this.#currentCaptionIndex = startIndex + i;
        this.#emit('captionChange', {
          index: this.#currentCaptionIndex,
          text: sentences[i] || ''
        });
      }, i * interval);
      
      this.#captionTimers.push(timer);
    });
    
    // Mark captions as done at the end
    const doneTimer = setTimeout(() => {
      this.#emit('captionsDone');
    }, durationSeconds * 1000);
    
    this.#captionTimers.push(doneTimer);
  }
  
  #clearCaptionTimers() {
    this.#captionTimers.forEach(timer => clearTimeout(timer));
    this.#captionTimers = [];
  }
  
  // Private: Speech guard (force-stop if audio hangs)
  #armSpeechGuard(seconds) {
    this.#clearSpeechGuard();
    
    const timeout = (seconds * 1000) + 2000; // Add 2s buffer
    this.#speechGuardTimer = setTimeout(() => {
      console.warn('[AudioEngine] Speech guard triggered - forcing stop');
      this.stop();
      this.#emit('end', { completed: false, timeout: true });
    }, timeout);
  }
  
  #clearSpeechGuard() {
    if (this.#speechGuardTimer) {
      clearTimeout(this.#speechGuardTimer);
      this.#speechGuardTimer = null;
    }
  }
  
  // Private: Video coordination
  #startVideo() {
    if (!this.#videoElement) return;
    
    try {
      const playPromise = this.#videoElement.play();
      
      if (playPromise && playPromise.catch) {
        playPromise.catch(err => {
          // Retry once after 100ms (Chrome autoplay quirk)
          setTimeout(() => {
            try {
              this.#videoElement.play();
            } catch {}
          }, 100);
        });
      }
    } catch {}
  }
  
  // Private: Cleanup
  #cleanup() {
    this.#isPlaying = false;
    
    if (this.#videoElement) {
      try {
        this.#videoElement.pause();
      } catch {}
    }
    
    this.#clearCaptionTimers();
    this.#clearSpeechGuard();
  }
  
  // Private: Utilities
  #base64ToBlob(base64) {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'audio/wav';
    const raw = atob(parts[1]);
    const bytes = new Uint8Array(raw.length);
    
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: contentType });
  }
  
  #base64ToArrayBuffer(base64) {
    const parts = base64.split(';base64,');
    const raw = atob(parts[1]);
    const bytes = new Uint8Array(raw.length);
    
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    
    return bytes.buffer;
  }
  
  #computeHeuristicDuration(sentences) {
    const totalWords = sentences.reduce((sum, s) => {
      const text = typeof s === 'string' ? s : (s?.text || '');
      return sum + text.split(/\s+/).filter(Boolean).length;
    }, 0);
    
    // Assume 3.6 words per second average speech rate
    return Math.max(2, totalWords / 3.6);
  }
  
  // Public: Cleanup on destroy
  destroy() {
    this.stop();
    
    if (this.#audioContext) {
      try {
        this.#audioContext.close();
        this.#audioContext = null;
      } catch {}
    }
    
    this.#listeners.clear();
  }
}
