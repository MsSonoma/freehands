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

  #initialized = false;
  #initializePromise = null;
  
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

  // Video unlock bookkeeping (iOS Safari requires play() during user gesture)
  #videoUnlockRequested = false;
  
  constructor(options = {}) {
    this.#videoElement = options.videoElement || null;
  }
  
  // Public API: Event subscription
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event).push(callback);

    // If the UI subscribes after playback has already started, immediately
    // deliver the current caption so transcripts don't stay blank.
    if (event === 'captionChange') {
      try {
        const idx = Math.max(0, Math.min(this.#lastSentences.length - 1, this.#currentCaptionIndex));
        const text = this.#lastSentences[idx] || '';
        callback({ index: this.#currentCaptionIndex, text });
      } catch {
        // Ignore subscriber sync errors
      }
    }
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
    if (this.#initialized) return;
    if (this.#initializePromise) return this.#initializePromise;

    const withTimeout = async (promise, ms, label) => {
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      });
      try {
        return await Promise.race([promise, timeout]);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    this.#initializePromise = (async () => {
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

      // Resume AudioContext, but never let this hang indefinitely on mobile browsers.
      if (this.#audioContext && this.#audioContext.state === 'suspended') {
        try {
          await withTimeout(this.#audioContext.resume(), 1000, 'AudioContext.resume');
        } catch {
          // Ignore - some browsers will reject/resume later; initialization should not deadlock.
        }
      }

      // Play silent audio to unlock HTMLAudio on iOS.
      // IMPORTANT: do not await play(); on iOS/Safari it can remain pending and deadlock UI.
      try {
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        silentAudio.muted = true;
        silentAudio.volume = 0;
        const p = silentAudio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        // Ignore errors from silent audio
      }

      // Video unlock (must happen inside user gesture; pause can happen later).
      // IMPORTANT: Do NOT play-and-immediately-pause in the same tick; on some browsers
      // (notably iOS Safari) that can prevent the play() call from "unlocking" future playback.
      this.#requestVideoUnlock();

      this.#initialized = true;
    })().finally(() => {
      this.#initializePromise = null;
    });

    return this.#initializePromise;
  }

  #requestVideoUnlock() {
    if (this.#videoUnlockRequested) return;
    this.#videoUnlockRequested = true;

    const video = this.#videoElement;
    if (!video) return;

    try { video.muted = true; } catch {}
    try { video.playsInline = true; } catch {}
    try { video.preload = 'auto'; } catch {}

    // Pause as soon as playback actually starts (playing event), so we end in a paused state
    // while still getting the autoplay "unlock" side effect from play().
    const handlePlaying = () => {
      try { video.pause(); } catch {}
      try { video.currentTime = 0; } catch {}
      try { video.removeEventListener('playing', handlePlaying); } catch {}
    };

    try {
      video.addEventListener('playing', handlePlaying);
    } catch {}

    try {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          try { video.removeEventListener('playing', handlePlaying); } catch {}
        });
      }
    } catch {
      try { video.removeEventListener('playing', handlePlaying); } catch {}
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

    // Emit the first caption immediately so transcript shows even before timeupdate fires
    const clampedIndex = Math.max(0, Math.min(sentences.length - 1, startIndex));
    this.#currentCaptionIndex = clampedIndex;
    this.#emit('captionChange', {
      index: this.#currentCaptionIndex,
      text: sentences[clampedIndex] || ''
    });
    this.#isPlaying = true;
    this.#emit('start', { sentences, startIndex });
    
    // NOTE: Video playback is started by audio.onplay handler in #playHTMLAudio
    // or by #playSynthetic. This ensures video syncs with actual audio start.
    
    // Choose playback path
    if (!base64Audio) {
      // Synthetic path (no audio) - start video here since there's no audio.onplay
      this.#startVideo();
      await this.#playSynthetic(sentences, startIndex);
      return;
    }

    // Try HTMLAudio first (better mobile compatibility). If both audio paths fail
    // (bad base64, autoplay restrictions, decode errors), fall back to synthetic
    // so the learner still gets captions and the session can proceed.
    try {
      await this.#playHTMLAudio(base64Audio, sentences, startIndex, options);
      return;
    } catch (err) {
      console.warn('[AudioEngine] HTMLAudio failed, trying WebAudio:', err);
    }

    try {
      await this.#playWebAudio(base64Audio, sentences, startIndex, options);
      return;
    } catch (err2) {
      console.error('[AudioEngine] Both audio paths failed; falling back to synthetic captions:', err2);
      this.#emit('error', err2);
      await this.#playSynthetic(sentences, startIndex);
    }
  }
  
  stop() {
    const wasPlaying = this.#isPlaying;
    
    // Stop HTMLAudio - remove handlers FIRST to prevent spurious events
    if (this.#audioElement) {
      try {
        // Remove event handlers before manipulating audio element
        this.#audioElement.onended = null;
        this.#audioElement.onerror = null;
        this.#audioElement.ontimeupdate = null;
        this.#audioElement.onpause = null;
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
    
    // Emit 'end' with skipped: true so controllers can advance
    if (wasPlaying) {
      this.#emit('end', { completed: false, skipped: true });
    }
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
  
  // Replay the last played audio from the beginning
  replay() {
    if (!this.#lastSentences || this.#lastSentences.length === 0) {
      console.warn('[AudioEngine] No previous audio to replay');
      return;
    }
    
    this.playAudio(this.#lastAudioBase64, this.#lastSentences, 0);
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
  
  get hasAudioToReplay() {
    return !!(this.#lastAudioBase64 && this.#lastSentences && this.#lastSentences.length > 0);
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
      
      audio.ontimeupdate = () => {
        if (!audio.duration || audio.duration <= 0) return;
        
        const progress = audio.currentTime / audio.duration;
        const index = Math.min(
          sentences.length - 1,
          Math.floor(progress * sentences.length)
        );
        
        if (index !== this.#currentCaptionIndex) {
          this.#currentCaptionIndex = index + startIndex;
          this.#emit('captionChange', {
            index: this.#currentCaptionIndex,
            text: sentences[index] || ''
          });
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
      
      // Start video when audio play succeeds (more reliable than onplay event)
      if (playPromise && playPromise.then) {
        playPromise.then(() => {
          this.#startVideo();
        }).catch(reject);
      } else {
        // Fallback for browsers that don't return a promise
        this.#startVideo();
      }
      
      // Arm initial guard with estimated duration
      const estimatedDuration = this.#computeHeuristicDuration(sentences);
      this.#armSpeechGuard(estimatedDuration + 2);
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
  
  // Private: Video coordination - plays/pauses video in sync with TTS
  // Video is a loop that continues from current position, no seeking
  #startVideo() {
    if (!this.#videoElement) return;
    
    try {
      const playPromise = this.#videoElement.play();
      
      if (playPromise && playPromise.catch) {
        playPromise.catch(err => {
          // Retry once after 100ms (Chrome autoplay quirk)
          setTimeout(() => {
            try {
              this.#videoElement?.play()?.catch(() => {});
            } catch {}
          }, 100);
        });
      }
    } catch {}
  }
  
  // Private: Cleanup
  #cleanup() {
    this.#isPlaying = false;
    
    // Pause video when audio ends (video syncs with TTS)
    if (this.#videoElement) {
      try {
        this.#videoElement.pause();
      } catch {}
    }
    
    this.#clearCaptionTimers();
    this.#clearSpeechGuard();
  }
  
  // Private: Utilities
  #parseAudioInput(rawInput) {
    if (!rawInput) return null;

    const raw = String(rawInput).trim();
    if (!raw) return null;

    // Accept either a data URL or a raw base64 string.
    const match = raw.match(/^data:(audio\/[^;]+);base64,(.*)$/i);
    const contentType = match?.[1] || 'audio/mpeg';
    let b64 = (match?.[2] || raw).trim();

    // Normalize: strip whitespace, base64url -> base64, add padding.
    b64 = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';
    else if (pad === 1) b64 += '===';

    return { contentType, b64 };
  }

  #base64ToBlob(base64) {
    const parsed = this.#parseAudioInput(base64);
    if (!parsed) return new Blob([], { type: 'audio/mpeg' });

    const { contentType, b64 } = parsed;
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: contentType });
  }
  
  #base64ToArrayBuffer(base64) {
    const parsed = this.#parseAudioInput(base64);
    if (!parsed) return new Uint8Array(0).buffer;

    const raw = atob(parsed.b64);
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
