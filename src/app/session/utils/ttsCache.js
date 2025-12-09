/**
 * TTS Cache - Prefetch and cache TTS audio for smoother playback
 * 
 * Implements LRU cache with background prefetching to eliminate
 * waiting time between questions/sentences.
 */

const MAX_CACHE_SIZE = 10;

class TTSCache {
  constructor() {
    this.cache = new Map(); // text -> { audio: base64, timestamp: number }
    this.pendingFetches = new Map(); // text -> AbortController
  }

  /**
   * Get cached TTS audio if available
   * @param {string} text - Text to retrieve
   * @returns {string|null} Base64 audio or null if not cached
   */
  get(text) {
    if (!text) return null;
    const normalized = this.normalizeText(text);
    const entry = this.cache.get(normalized);
    if (entry) {
      // Update timestamp for LRU
      entry.timestamp = Date.now();
      return entry.audio;
    }
    return null;
  }

  /**
   * Store TTS audio in cache
   * @param {string} text - Text key
   * @param {string} audio - Base64 audio data
   */
  set(text, audio) {
    if (!text || !audio) return;
    const normalized = this.normalizeText(text);
    
    // Evict oldest if cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }
    
    this.cache.set(normalized, {
      audio,
      timestamp: Date.now()
    });
  }

  /**
   * Prefetch TTS audio in background
   * @param {string} text - Text to prefetch
   * @param {function} onComplete - Optional callback with (error, audio)
   */
  async prefetch(text, onComplete = null) {
    if (!text) return;
    const normalized = this.normalizeText(text);
    
    // Skip if already cached or being fetched
    if (this.cache.has(normalized) || this.pendingFetches.has(normalized)) {
      return;
    }

    // Create AbortController for this fetch
    const controller = new AbortController();
    this.pendingFetches.set(normalized, controller);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });

      if (!response.ok) {
        // Retry once on failure
        await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {});
        const retryResponse = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal
        });
        
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          const audio = this.extractAudio(data);
          if (audio) {
            this.set(text, audio);
            if (onComplete) onComplete(null, audio);
          }
        }
      } else {
        const data = await response.json();
        const audio = this.extractAudio(data);
        if (audio) {
          this.set(text, audio);
          if (onComplete) onComplete(null, audio);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Silent failure for prefetch
        if (onComplete) onComplete(err, null);
      }
    } finally {
      this.pendingFetches.delete(normalized);
    }
  }

  /**
   * Cancel a pending prefetch
   * @param {string} text - Text to cancel
   */
  cancelPrefetch(text) {
    if (!text) return;
    const normalized = this.normalizeText(text);
    const controller = this.pendingFetches.get(normalized);
    if (controller) {
      controller.abort();
      this.pendingFetches.delete(normalized);
    }
  }

  /**
   * Clear all cached audio and pending fetches
   */
  clear() {
    // Cancel all pending fetches
    for (const controller of this.pendingFetches.values()) {
      controller.abort();
    }
    this.pendingFetches.clear();
    this.cache.clear();
  }

  /**
   * Evict the oldest entry from cache
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Normalize text for consistent cache keys
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    return String(text || '').trim().toLowerCase();
  }

  /**
   * Extract audio from TTS API response
   * @param {object} data - API response data
   * @returns {string} Base64 audio
   */
  extractAudio(data) {
    let b64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
    if (b64) {
      // Remove data URL prefix if present
      b64 = b64.replace(/^data:audio\/[^;]+;base64,/, '');
    }
    return b64;
  }

  /**
   * Get cache statistics
   * @returns {object} Stats
   */
  getStats() {
    return {
      size: this.cache.size,
      pending: this.pendingFetches.size,
      maxSize: MAX_CACHE_SIZE
    };
  }
}

// Export singleton instance
export const ttsCache = new TTSCache();
