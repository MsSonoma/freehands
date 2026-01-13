/**
 * TeachingController - Manages two-stage teaching flow
 * 
 * V2 Architecture: Calls GPT to generate definitions and examples text,
 * then splits into sentences for sentence-by-sentence navigation.
 * 
 * Flow:
 * 1. Extract vocab terms from lesson JSON (just the terms, not definitions)
 * 2. Call GPT to generate kid-friendly definitions text
 * 3. Split GPT response into sentences
 * 4. User navigates sentence-by-sentence with gate controls
 * 5. At definitions gate, transition to examples
 * 6. Call GPT to generate examples text
 * 7. Split into sentences, navigate, gate, complete
 * 
 * Events emitted:
 * - stageChange: { stage, totalSentences }
 * - sentenceAdvance: { stage, index, total }
 * - sentenceComplete: { stage, index, total }
 * - finalGateReached: { stage }
 * - requestSnapshotSave: { trigger, data }
 * - teachingComplete: { vocabCount, exampleCount }
 */

import { fetchTTS } from './services';
import { ttsCache } from '../utils/ttsCache';

export class TeachingController {
  // Private state
  #audioEngine = null;
  #lessonData = null;
  #lessonMeta = null; // { subject, difficulty, lessonId, lessonTitle }
  
  #stage = 'idle'; // 'idle' | 'loading-definitions' | 'definitions' | 'loading-examples' | 'examples' | 'complete'
  #vocabSentences = [];
  #exampleSentences = [];
  #currentSentenceIndex = 0;
  #isInSentenceMode = true;
  #awaitingFirstPlay = false;
  
  #listeners = new Map();
  #audioEndListener = null;
  
  // Background prefetch promises - started early, awaited when needed
  #definitionsGptPromise = null;
  #examplesGptPromise = null;
  #definitionsGatePromptPromise = null;
  #examplesGatePromptPromise = null;

  // Rate-limit / spam guards
  #prefetchStarted = false;
  #definitionsCooldownUntilMs = 0;
  #examplesCooldownUntilMs = 0;
  #definitionsRateLimited = false;
  #examplesRateLimited = false;

  #gatePromptActive = false;
  #gatePromptStage = null;
  #gatePromptSkipped = false;
  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#lessonData = options.lessonData;
    this.#lessonMeta = options.lessonMeta || {};
    
    console.log('[TeachingController] Constructor - lessonData:', this.#lessonData?.title);
    console.log('[TeachingController] Constructor - vocab count:', this.#lessonData?.vocab?.length);
    console.log('[TeachingController] Constructor - vocab sample:', JSON.stringify(this.#lessonData?.vocab?.slice(0, 2)));
    
    if (!this.#audioEngine) {
      throw new Error('TeachingController requires audioEngine');
    }
  }

  #getNowMs() {
    return Date.now();
  }

  #getRetryAfterMs(response) {
    try {
      const raw = response?.headers?.get?.('retry-after') || response?.headers?.get?.('Retry-After') || '';
      const seconds = parseInt(String(raw || '').trim(), 10);
      if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    } catch {}
    // Conservative default: avoid immediate retry loops.
    return 15000;
  }

  #buildRateLimitSentence(ms) {
    const secs = Math.max(1, Math.ceil((ms || 0) / 1000));
    return `Too many requests right now. Please wait ${secs} seconds, then press Next.`;
  }

  async #maybeRetryRateLimited(stage) {
    const now = this.#getNowMs();

    if (stage === 'definitions' && this.#definitionsRateLimited) {
      if (now < this.#definitionsCooldownUntilMs) {
        this.#currentSentenceIndex = 0;
        this.#awaitingFirstPlay = false;
        await this.#playCurrentDefinition();
        return true;
      }

      // Cooldown passed: retry fetch.
      this.#definitionsRateLimited = false;
      this.#definitionsCooldownUntilMs = 0;
      this.#vocabSentences = [];
      this.#definitionsGptPromise = null;

      this.#stage = 'loading-definitions';
      this.#emit('loading', { stage: 'definitions' });
      await this.#ensureDefinitionsLoaded();

      this.#stage = 'definitions';
      this.#currentSentenceIndex = 0;
      this.#awaitingFirstPlay = false;
      this.#emit('stageChange', { stage: 'definitions', totalSentences: this.#vocabSentences.length });
      await this.#playCurrentDefinition();
      return true;
    }

    if (stage === 'examples' && this.#examplesRateLimited) {
      if (now < this.#examplesCooldownUntilMs) {
        this.#currentSentenceIndex = 0;
        this.#awaitingFirstPlay = false;
        await this.#playCurrentExample();
        return true;
      }

      // Cooldown passed: retry fetch.
      this.#examplesRateLimited = false;
      this.#examplesCooldownUntilMs = 0;
      this.#exampleSentences = [];
      this.#examplesGptPromise = null;

      this.#stage = 'loading-examples';
      this.#emit('loading', { stage: 'examples' });
      await this.#ensureExamplesLoaded();

      this.#stage = 'examples';
      this.#currentSentenceIndex = 0;
      this.#awaitingFirstPlay = false;
      this.#emit('stageChange', { stage: 'examples', totalSentences: this.#exampleSentences.length });
      await this.#playCurrentExample();
      return true;
    }

    return false;
  }
  
  // Public API: Start all prefetches in background (call on Begin click)
  prefetchAll() {
    console.log('[TeachingController] Starting background prefetch of all GPT content');

    if (this.#prefetchStarted) {
      console.log('[TeachingController] Prefetch already started - skipping');
      return;
    }
    this.#prefetchStarted = true;
    
    // Start definitions GPT (don't await) - then prefetch TTS for first few sentences.
    // IMPORTANT: Stagger downstream GPT calls to reduce 429 risk.
    // Prefetch promises should never produce unhandled rejections.
    this.#definitionsGptPromise = this.#fetchDefinitionsFromGPT()
      .then(sentences => {
        // Prefetch TTS for first 3 definition sentences
        sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
        return sentences;
      })
      .catch(err => {
        console.error('[TeachingController] Definitions prefetch error:', err);
        return [];
      });
    
    // Start examples GPT after definitions completes (reduces parallel GPT fanout).
    this.#examplesGptPromise = this.#definitionsGptPromise
      .catch(() => [])
      .then(() => this.#fetchExamplesFromGPT())
      .then(sentences => {
        // Prefetch TTS for first 3 example sentences
        sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
        return sentences;
      })
      .catch(err => {
        console.error('[TeachingController] Examples prefetch error:', err);
        return [];
      });
    
    // Gate prompts are nice-to-have; fetch them after their parent content starts.
    this.#definitionsGatePromptPromise = this.#definitionsGptPromise
      .catch(() => [])
      .then(() => this.#fetchGatePromptFromGPT('definitions'))
      .then(text => {
      if (text) ttsCache.prefetch(text);
      return text;
    });
    
    this.#examplesGatePromptPromise = this.#examplesGptPromise
      .catch(() => [])
      .then(() => this.#fetchGatePromptFromGPT('examples'))
      .then(text => {
      if (text) ttsCache.prefetch(text);
      return text;
    });
    
    // Also prefetch the intro TTS
    ttsCache.prefetch("First let's go over some definitions.");
    ttsCache.prefetch("Now let's see this in action.");
    ttsCache.prefetch("Do you have any questions?");
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
        console.error('[TeachingController] Event callback error:', event, err);
      }
    });
  }

  #buildSnapshotPayload() {
    return {
      stage: this.#stage,
      sentenceIndex: this.#currentSentenceIndex,
      isInSentenceMode: this.#isInSentenceMode,
      vocabSentences: this.#vocabSentences,
      exampleSentences: this.#exampleSentences
    };
  }

  #emitSnapshot(trigger) {
    this.#emit('requestSnapshotSave', {
      trigger,
      data: this.#buildSnapshotPayload()
    });
  }
  
  // Public API: Start teaching flow
  async startTeaching(options = {}) {
    const { autoplayFirstSentence = true, resumeState = null } = options;
    if (!this.#lessonData) {
      throw new Error('No lesson data provided');
    }

    // If resuming directly into examples, bypass definitions intro and go straight there.
    if (resumeState?.stage === 'examples') {
      await this.#startExamples({ resumeState });
      return;
    }

    // Resume into definitions (or fresh start if no resume state).
    await this.#startDefinitions({ autoplayFirstSentence, resumeState });
  }
  
  // Public API: Sentence navigation
  async nextSentence() {
    if (this.#stage === 'definitions') {
      const handled = await this.#maybeRetryRateLimited('definitions');
      if (handled) return;
    }
    if (this.#stage === 'examples') {
      const handled = await this.#maybeRetryRateLimited('examples');
      if (handled) return;
    }

    // If in loading stage, stop current audio, await content, then play first sentence
    if (this.#stage === 'loading-definitions') {
      console.log('[TeachingController] nextSentence during loading-definitions - awaiting content');
      this.#audioEngine.stop(); // Stop intro audio
      await this.#ensureDefinitionsLoaded();
      if (this.#vocabSentences.length > 0) {
        this.#stage = 'definitions';
        this.#currentSentenceIndex = 0;
        this.#awaitingFirstPlay = false;
        this.#emit('stageChange', { stage: 'definitions', totalSentences: this.#vocabSentences.length });
        this.#playCurrentDefinition();
      }
      return;
    }
    if (this.#stage === 'loading-examples') {
      console.log('[TeachingController] nextSentence during loading-examples - awaiting content');
      this.#audioEngine.stop(); // Stop intro audio
      await this.#ensureExamplesLoaded();
      if (this.#exampleSentences.length > 0) {
        this.#stage = 'examples';
        this.#currentSentenceIndex = 0;
        this.#awaitingFirstPlay = false;
        this.#emit('stageChange', { stage: 'examples', totalSentences: this.#exampleSentences.length });
        this.#playCurrentExample();
      }
      return;
    }
    
    if (this.#stage === 'idle' || this.#stage === 'complete') {
      return;
    }
    
    if (this.#stage === 'definitions' && this.#awaitingFirstPlay) {
      this.#awaitingFirstPlay = false;
      this.#playCurrentDefinition();
      return;
    }
    if (this.#stage === 'examples' && this.#awaitingFirstPlay) {
      this.#awaitingFirstPlay = false;
      this.#playCurrentExample();
      return;
    }
    if (this.#stage === 'definitions') {
      this.#advanceDefinition();
    } else if (this.#stage === 'examples') {
      this.#advanceExample();
    }
  }
  
  async repeatSentence() {
    try {
      if (this.#stage === 'definitions') {
        const handled = await this.#maybeRetryRateLimited('definitions');
        if (handled) return;
      }
      if (this.#stage === 'examples') {
        const handled = await this.#maybeRetryRateLimited('examples');
        if (handled) return;
      }

      // If in loading stage, stop current audio, await content, then play first sentence
      if (this.#stage === 'loading-definitions') {
        this.#audioEngine.stop();
        await this.#ensureDefinitionsLoaded();
        if (this.#vocabSentences.length > 0) {
          this.#stage = 'definitions';
          this.#currentSentenceIndex = 0;
          this.#awaitingFirstPlay = false;
          this.#emit('stageChange', { stage: 'definitions', totalSentences: this.#vocabSentences.length });
          this.#playCurrentDefinition();
        }
        return;
      }
      if (this.#stage === 'loading-examples') {
        this.#audioEngine.stop();
        await this.#ensureExamplesLoaded();
        if (this.#exampleSentences.length > 0) {
          this.#stage = 'examples';
          this.#currentSentenceIndex = 0;
          this.#awaitingFirstPlay = false;
          this.#emit('stageChange', { stage: 'examples', totalSentences: this.#exampleSentences.length });
          this.#playCurrentExample();
        }
        return;
      }

      if (this.#stage === 'idle' || this.#stage === 'complete') {
        return;
      }

      if (this.#stage === 'definitions' && this.#awaitingFirstPlay) {
        this.#awaitingFirstPlay = false;
        this.#playCurrentDefinition();
        return;
      }
      if (this.#stage === 'examples' && this.#awaitingFirstPlay) {
        this.#awaitingFirstPlay = false;
        this.#playCurrentExample();
        return;
      }
      if (this.#stage === 'definitions') {
        this.#playCurrentDefinition();
      } else if (this.#stage === 'examples') {
        this.#playCurrentExample();
      }
    } catch (err) {
      console.error('[TeachingController] repeatSentence error:', err);
      this.#emit('error', { type: 'teaching', action: 'repeatSentence', error: String(err?.message || err) });
    }
  }
  
  async skipToExamples() {
    try {
      if (this.#stage === 'definitions' || this.#stage === 'loading-definitions') {
        await this.#startExamples();
      }
    } catch (err) {
      console.error('[TeachingController] skipToExamples error:', err);
      this.#emit('error', { type: 'teaching', action: 'skipToExamples', error: String(err?.message || err) });
    }
  }
  
  restartStage() {
    if (this.#stage === 'definitions') {
      if (this.#definitionsRateLimited) {
        void this.#maybeRetryRateLimited('definitions').catch(err => {
          console.error('[TeachingController] restartStage retry (definitions) error:', err);
          this.#emit('error', { type: 'teaching', action: 'restartStage', stage: 'definitions', error: String(err?.message || err) });
        });
        return;
      }
      this.#currentSentenceIndex = 0;
      this.#isInSentenceMode = true;
      this.#awaitingFirstPlay = false;
      this.#playCurrentDefinition();
    } else if (this.#stage === 'examples') {
      if (this.#examplesRateLimited) {
        void this.#maybeRetryRateLimited('examples').catch(err => {
          console.error('[TeachingController] restartStage retry (examples) error:', err);
          this.#emit('error', { type: 'teaching', action: 'restartStage', stage: 'examples', error: String(err?.message || err) });
        });
        return;
      }
      this.#currentSentenceIndex = 0;
      this.#isInSentenceMode = true;
      this.#awaitingFirstPlay = false;
      this.#playCurrentExample();
    }
  }
  
  // Getters
  get stage() {
    return this.#stage;
  }
  
  get currentSentenceIndex() {
    return this.#currentSentenceIndex;
  }
  
  get totalSentences() {
    if (this.#stage === 'definitions') {
      return this.#vocabSentences.length;
    } else if (this.#stage === 'examples') {
      return this.#exampleSentences.length;
    }
    return 0;
  }
  
  get isInSentenceMode() {
    return this.#isInSentenceMode;
  }
  
  get currentSentence() {
    if (this.#stage === 'definitions') {
      return this.#vocabSentences[this.#currentSentenceIndex] || '';
    } else if (this.#stage === 'examples') {
      return this.#exampleSentences[this.#currentSentenceIndex] || '';
    }
    return '';
  }
  
  // Private: Extract vocab terms from lesson
  #getVocabTerms() {
    const vocab = this.#lessonData?.vocab || [];
    if (!Array.isArray(vocab)) return [];
    
    // Extract and deduplicate vocab terms
    const termMap = new Map();
    for (const v of vocab) {
      const raw = (typeof v === 'string') ? v : (v?.term || v?.word || v?.key || '');
      const term = (raw || '').trim();
      if (term) {
        termMap.set(term.toLowerCase(), term);
      }
    }
    return Array.from(termMap.values());
  }
  
  #splitIntoSentences(text) {
    if (!text) return [];
    
    try {
      const lines = String(text).split(/\n+/);
      const out = [];
      for (const lineRaw of lines) {
        const line = String(lineRaw).replace(/[\t ]+/g, ' ').trimEnd();
        if (!line) continue;
        // Split on sentence-ending punctuation followed by whitespace
        const parts = line
          .split(/(?<=[.?!]["']?)\s+/)
          .map((part) => String(part).trim())
          .filter(Boolean);
        if (parts.length) out.push(...parts);
      }
      return out.length ? out : [String(text).trim()];
    } catch {
      return [String(text).trim()];
    }
  }
  
  // Private: Call GPT for definitions
  async #fetchDefinitionsFromGPT() {
    const now = this.#getNowMs();
    if (now < this.#definitionsCooldownUntilMs) {
      this.#definitionsRateLimited = true;
      const remainingMs = this.#definitionsCooldownUntilMs - now;
      const msg = this.#buildRateLimitSentence(remainingMs);
      this.#emit('error', { type: 'gpt', stage: 'definitions', status: 429, retryAfterMs: remainingMs });
      return [msg];
    }

    console.log('[TeachingController] fetchDefinitionsFromGPT called');
    console.log('[TeachingController] lessonData.vocab:', this.#lessonData?.vocab?.length, 'items');
    const terms = this.#getVocabTerms();
    console.log('[TeachingController] getVocabTerms returned:', terms.length, 'terms:', terms);
    if (terms.length === 0) {
      console.warn('[TeachingController] No vocab terms found - SKIPPING DEFINITIONS');
      return [];
    }
    
    const vocabCsv = terms.join(', ');
    const lessonTitle = this.#lessonData?.title || 'this lesson';
    const grade = this.#lessonData?.grade || '';
    const teachingNotes = this.#lessonData?.teachingNotes || '';
    
    // Build vocab context for GPT (include definitions from JSON if available)
    const vocabContext = (this.#lessonData?.vocab || [])
      .filter(v => v?.term && v?.definition)
      .map(v => `${v.term}: ${v.definition}`)
      .join('\n');
    
    const instruction = [
      `Grade: ${grade}`,
      `Lesson (do not read aloud): "${lessonTitle}"`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the definitions.',
      `Definitions: Define these words: ${vocabCsv}. Keep it warm, playful, and brief. Do not ask a question.`,
      '',
      vocabContext ? `Reference definitions (paraphrase naturally, preserve accuracy):\n${vocabContext}` : '',
      teachingNotes ? `Teaching notes: ${teachingNotes}` : '',
      '',
      'CRITICAL ACCURACY: All definitions must be factually accurate. If vocab definitions are provided above, base your teaching on that content - paraphrase naturally but preserve meaning exactly.',
      '',
      'Kid-friendly: Use simple everyday words a 5 year old can understand. Keep sentences short (about 6-12 words). One idea per sentence.',
      '',
      'Always respond with natural spoken text only. No emojis, decorative characters, or symbols.'
    ].filter(Boolean).join('\n');
    
    try {
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          input: '',
          context: {
            phase: 'teaching',
            step: 'definitions',
            lessonTitle,
            vocab: this.#lessonData?.vocab || []
          },
          skipAudio: true
        })
      });
      
      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          const retryAfterMs = this.#getRetryAfterMs(response);
          this.#definitionsCooldownUntilMs = this.#getNowMs() + retryAfterMs;
          this.#definitionsRateLimited = true;
          this.#emit('error', { type: 'gpt', stage: 'definitions', status, retryAfterMs });
          return [this.#buildRateLimitSentence(retryAfterMs)];
        }

        this.#definitionsRateLimited = false;
        this.#emit('error', { type: 'gpt', stage: 'definitions', status });
        return ['We had trouble loading the definitions. Please press Next again.'];
      }
      
      const data = await response.json();
      const text = data.reply || data.text || '';
      
      if (!text) {
        console.warn('[TeachingController] Empty GPT response for definitions');
        return [];
      }
      
      const sentences = this.#splitIntoSentences(text);
      console.log('[TeachingController] GPT definitions split into', sentences.length, 'sentences');

      this.#definitionsRateLimited = false;
      return sentences;
      
    } catch (err) {
      console.error('[TeachingController] GPT definitions error:', err);
      this.#definitionsRateLimited = false;
      return ['We had trouble loading the definitions. Please press Next again.'];
    }
  }
  
  // Private: Call GPT for examples
  async #fetchExamplesFromGPT() {
    const now = this.#getNowMs();
    if (now < this.#examplesCooldownUntilMs) {
      this.#examplesRateLimited = true;
      const remainingMs = this.#examplesCooldownUntilMs - now;
      const msg = this.#buildRateLimitSentence(remainingMs);
      this.#emit('error', { type: 'gpt', stage: 'examples', status: 429, retryAfterMs: remainingMs });
      return [msg];
    }

    const terms = this.#getVocabTerms();
    const lessonTitle = this.#lessonData?.title || 'this lesson';
    const grade = this.#lessonData?.grade || '';
    const teachingNotes = this.#lessonData?.teachingNotes || '';
    
    const vocabContext = terms.length > 0 
      ? `Use these vocabulary words naturally in your examples: ${terms.join(', ')}.`
      : '';
    
    const instruction = [
      `Grade: ${grade}`,
      `Lesson (do not read aloud): "${lessonTitle}"`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the examples.',
      `Examples: Show 2-3 tiny worked examples appropriate for this lesson. ${vocabContext} You compute every step. Be concise, warm, and playful. Do not add definitions or broad explanations. Give only the examples.`,
      '',
      teachingNotes ? `Teaching notes: ${teachingNotes}` : '',
      '',
      'CRITICAL ACCURACY: All examples must be correct. Verify accuracy before presenting.',
      '',
      'Kid-friendly: Use simple everyday words. Keep sentences short (about 6-12 words). One idea per sentence.',
      '',
      'Always respond with natural spoken text only. No emojis, decorative characters, or symbols.'
    ].filter(Boolean).join('\n');
    
    try {
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          input: '',
          context: {
            phase: 'teaching',
            step: 'examples',
            lessonTitle,
            vocab: this.#lessonData?.vocab || []
          },
          skipAudio: true
        })
      });
      
      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          const retryAfterMs = this.#getRetryAfterMs(response);
          this.#examplesCooldownUntilMs = this.#getNowMs() + retryAfterMs;
          this.#examplesRateLimited = true;
          this.#emit('error', { type: 'gpt', stage: 'examples', status, retryAfterMs });
          return [this.#buildRateLimitSentence(retryAfterMs)];
        }

        this.#examplesRateLimited = false;
        this.#emit('error', { type: 'gpt', stage: 'examples', status });
        return ['We had trouble loading the examples. Please press Next again.'];
      }
      
      const data = await response.json();
      const text = data.reply || data.text || '';
      
      if (!text) {
        console.warn('[TeachingController] Empty GPT response for examples');
        return [];
      }
      
      const sentences = this.#splitIntoSentences(text);
      console.log('[TeachingController] GPT examples split into', sentences.length, 'sentences');

      this.#examplesRateLimited = false;
      return sentences;
      
    } catch (err) {
      console.error('[TeachingController] GPT examples error:', err);
      this.#examplesRateLimited = false;
      return ['We had trouble loading the examples. Please press Next again.'];
    }
  }
  
  // Private: Fetch gate prompt sample questions from GPT
  async #fetchGatePromptFromGPT(stage) {
    const lessonTitle = this.#lessonMeta?.lessonTitle || this.#lessonData?.title || 'this topic';
    const subject = this.#lessonMeta?.subject || 'math';
    const difficulty = this.#lessonMeta?.difficulty || 'medium';
    
    const stageLabel = stage === 'definitions' ? 'vocabulary definitions' : 'examples';
    
    const instruction = [
      `The lesson is "${lessonTitle}".`,
      `We just covered ${stageLabel}.`,
      'Generate 2-3 short example questions a child might ask about this topic.',
      'Start with: "You could ask questions like..."',
      'Then list the questions briefly and naturally.',
      'Keep it very short and friendly.',
      'Do not answer the questions.',
      'Kid-friendly style rules: Use simple everyday words a 5-7 year old can understand. Keep sentences short (about 6-12 words).',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, or symbols.'
    ].join(' ');
    
    try {
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          input: '',
          context: {
            phase: 'teaching',
            subject,
            difficulty,
            lessonTitle,
            step: 'gate-example-questions',
            stage
          },
          skipAudio: true
        })
      });
      
      if (!response.ok) return null;
      const data = await response.json();
      return data.reply || data.text || null;
    } catch (err) {
      console.error('[TeachingController] Gate prompt GPT error:', err);
      return null;
    }
  }
  
  // Private: Definitions stage
  async #startDefinitions({ autoplayFirstSentence = true, resumeState = null } = {}) {
    console.log('[TeachingController] #startDefinitions called');

    // Resume path: preload stored sentences and skip intros when snapshot data exists.
    const resumeIntoDefinitions = resumeState && resumeState.stage === 'definitions';
    if (resumeIntoDefinitions && Array.isArray(resumeState.vocabSentences) && resumeState.vocabSentences.length) {
      this.#vocabSentences = resumeState.vocabSentences;
    }

    if (!resumeIntoDefinitions) {
      // Set loading stage - nextSentence will await content if called during this
      this.#stage = 'loading-definitions';
      this.#currentSentenceIndex = 0;
      this.#isInSentenceMode = true;

      // Speak intro
      const introText = "First let's go over some definitions.";
      let introAudio = ttsCache.get(introText);
      if (!introAudio) {
        introAudio = await fetchTTS(introText);
        if (introAudio) ttsCache.set(introText, introAudio);
      }
      await this.#audioEngine.playAudio(introAudio || '', [introText]);

      // If user skipped during intro and triggered nextSentence, stage might have changed
      // In that case, definitions are already loaded and playing - don't double-load
      if (this.#stage !== 'loading-definitions') {
        console.log('[TeachingController] Stage changed during intro (user skipped) - content already handled');
        return;
      }
    }

    // Ensure definitions are loaded (uses prefetch if available)
    await this.#ensureDefinitionsLoaded();

    if (this.#vocabSentences.length === 0) {
      console.warn('[TeachingController] No definitions generated, SKIPPING TO EXAMPLES');
      await this.#startExamples({ resumeState: resumeState?.stage === 'examples' ? resumeState : null });
      return;
    }

    // NOW set stage to definitions (content is ready, user can interact)
    this.#stage = 'definitions';
    this.#isInSentenceMode = resumeIntoDefinitions ? (resumeState.isInSentenceMode !== false) : true;
    const targetIndex = Math.max(0, Math.min(resumeIntoDefinitions ? (resumeState.sentenceIndex || 0) : 0, this.#vocabSentences.length - 1));
    this.#currentSentenceIndex = targetIndex;

    // Emit stage change AFTER data is ready (no loading state)
    this.#emit('stageChange', {
      stage: 'definitions',
      totalSentences: this.#vocabSentences.length
    });

    this.#emitSnapshot('begin-teaching-definitions');

    this.#awaitingFirstPlay = resumeIntoDefinitions ? false : !autoplayFirstSentence;

    if (!this.#isInSentenceMode) {
      await this.#playGatePrompt('definitions');
      return;
    }

    if (!this.#awaitingFirstPlay) {
      await this.#playCurrentDefinition();
      return;
    }

    // Prefetch first sentence TTS on await gate when not autoplaying
    const firstSentence = this.#vocabSentences[this.#currentSentenceIndex];
    if (firstSentence) {
      ttsCache.prefetch(firstSentence);
    }
  }
  
  async #playCurrentDefinition() {
    const sentence = this.#vocabSentences[this.#currentSentenceIndex];
    if (!sentence) return;
    
    // Listen for audio end
    this.#setupAudioEndListener(() => {
      this.#emit('sentenceComplete', {
        stage: 'definitions',
        index: this.#currentSentenceIndex,
        total: this.#vocabSentences.length
      });
    });
    
    // Check cache first
    let audioBase64 = ttsCache.get(sentence);
    
    if (!audioBase64) {
      audioBase64 = await fetchTTS(sentence);
      if (audioBase64) {
        ttsCache.set(sentence, audioBase64);
      }
    }
    
    // Prefetch next sentence
    const nextIndex = this.#currentSentenceIndex + 1;
    if (nextIndex < this.#vocabSentences.length) {
      ttsCache.prefetch(this.#vocabSentences[nextIndex]);
    }
    
    await this.#audioEngine.playAudio(audioBase64 || '', [sentence]);
  }
  
  #advanceDefinition() {
    if (!this.#isInSentenceMode) {
      // At final gate - transition to examples
      this.#startExamples();
      return;
    }
    
    const nextIndex = this.#currentSentenceIndex + 1;
    
    if (nextIndex >= this.#vocabSentences.length) {
      // Reached end - show final gate
      this.#isInSentenceMode = false;
      this.#emit('finalGateReached', { stage: 'definitions' });

      // Play gate prompt (uses prefetched GPT content)
      this.#emitSnapshot('teaching-definition-gate');
      this.#playGatePrompt('definitions');
      return;
    }
    
    this.#currentSentenceIndex = nextIndex;
    this.#emit('sentenceAdvance', {
      stage: 'definitions',
      index: this.#currentSentenceIndex,
      total: this.#vocabSentences.length
    });

    this.#emitSnapshot('teaching-definition');

    this.#playCurrentDefinition();
  }
  
  // Private: Examples stage
  async #startExamples({ resumeState = null } = {}) {
    // Set loading stage to block nextSentence/repeatSentence during intro and GPT fetch
    const resumeIntoExamples = resumeState && resumeState.stage === 'examples';
    this.#stage = 'loading-examples';
    this.#currentSentenceIndex = resumeIntoExamples ? Math.max(0, resumeState.sentenceIndex || 0) : 0;
    this.#isInSentenceMode = resumeIntoExamples ? (resumeState.isInSentenceMode !== false) : true;

    if (resumeIntoExamples && Array.isArray(resumeState.exampleSentences) && resumeState.exampleSentences.length) {
      this.#exampleSentences = resumeState.exampleSentences;
    }

    if (!resumeIntoExamples) {
      // Speak intro
      const introText = "Now let's see this in action.";
      let introAudio = ttsCache.get(introText);
      if (!introAudio) {
        introAudio = await fetchTTS(introText);
        if (introAudio) ttsCache.set(introText, introAudio);
      }
      await this.#audioEngine.playAudio(introAudio || '', [introText]);

      // If user skipped during intro and triggered nextSentence, stage might have changed
      if (this.#stage !== 'loading-examples') {
        console.log('[TeachingController] Stage changed during examples intro (user skipped) - content already handled');
        return;
      }
    }

    // Ensure examples are loaded (uses prefetch if available)
    await this.#ensureExamplesLoaded();

    if (this.#exampleSentences.length === 0) {
      console.warn('[TeachingController] No examples generated, completing teaching');
      this.#completeTeaching();
      return;
    }

    // NOW set stage to examples (content is ready, user can interact)
    this.#stage = 'examples';

    // Emit stage change AFTER data is ready (no loading state)
    this.#emit('stageChange', {
      stage: 'examples',
      totalSentences: this.#exampleSentences.length
    });

    this.#emitSnapshot('begin-teaching-examples');

    this.#awaitingFirstPlay = false;

    if (!this.#isInSentenceMode) {
      await this.#playGatePrompt('examples');
      return;
    }

    await this.#playCurrentExample();
  }
  
  async #playCurrentExample() {
    const sentence = this.#exampleSentences[this.#currentSentenceIndex];
    if (!sentence) return;
    
    this.#setupAudioEndListener(() => {
      this.#emit('sentenceComplete', {
        stage: 'examples',
        index: this.#currentSentenceIndex,
        total: this.#exampleSentences.length
      });
    });
    
    let audioBase64 = ttsCache.get(sentence);
    
    if (!audioBase64) {
      audioBase64 = await fetchTTS(sentence);
      if (audioBase64) {
        ttsCache.set(sentence, audioBase64);
      }
    }
    
    const nextIndex = this.#currentSentenceIndex + 1;
    if (nextIndex < this.#exampleSentences.length) {
      ttsCache.prefetch(this.#exampleSentences[nextIndex]);
    }
    
    await this.#audioEngine.playAudio(audioBase64 || '', [sentence]);
  }
  
  #advanceExample() {
    if (!this.#isInSentenceMode) {
      // At final gate - teaching complete
      this.#completeTeaching();
      return;
    }
    
    const nextIndex = this.#currentSentenceIndex + 1;
    
    if (nextIndex >= this.#exampleSentences.length) {
      // Reached end - show final gate
      this.#isInSentenceMode = false;
      this.#emit('finalGateReached', { stage: 'examples' });
      this.#emitSnapshot('teaching-example-gate');
      this.#playGatePrompt('examples');
      return;
    }
    
    this.#currentSentenceIndex = nextIndex;
    this.#emit('sentenceAdvance', {
      stage: 'examples',
      index: this.#currentSentenceIndex,
      total: this.#exampleSentences.length
    });
    
    this.#emitSnapshot('teaching-example');

    this.#playCurrentExample();
  }
  
  // Private: Completion
  #completeTeaching() {
    this.#stage = 'complete';
    
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#emit('teachingComplete', {
      vocabCount: this.#vocabSentences.length,
      exampleCount: this.#exampleSentences.length
    });
  }
  
  // Private: Gate prompt - uses prefetched GPT content for zero latency
  // 1. Speak "Do you have any questions?"
  // 2. Speak prefetched GPT sample questions (or fallback)
  async #playGatePrompt(stage) {
    const lessonTitle = this.#lessonMeta?.lessonTitle || this.#lessonData?.title || 'this topic';

    this.#gatePromptActive = true;
    this.#gatePromptStage = stage;
    this.#gatePromptSkipped = false;
    this.#emit('gatePromptStart', { stage });
    let gateError = null;
    try {
    
    // 1. Speak "Do you have any questions?"
    const questionText = 'Do you have any questions?';
    let questionAudio = ttsCache.get(questionText);
    if (!questionAudio) {
      questionAudio = await fetchTTS(questionText);
      if (questionAudio) ttsCache.set(questionText, questionAudio);
    }
    await this.#audioEngine.playAudio(questionAudio || '', [questionText]);
    
    // 2. Get prefetched GPT content (should already be ready)
    let sampleText = null;
    const prefetchPromise = stage === 'definitions' 
      ? this.#definitionsGatePromptPromise 
      : this.#examplesGatePromptPromise;
    
    if (prefetchPromise) {
      try {
        sampleText = await prefetchPromise;
        console.log('[TeachingController] Using prefetched gate prompt for', stage);
      } catch (err) {
        console.error('[TeachingController] Prefetched gate prompt error:', err);
      }
      // Clear the promise
      if (stage === 'definitions') {
        this.#definitionsGatePromptPromise = null;
      } else {
        this.#examplesGatePromptPromise = null;
      }
    }
    
    // 3. Fallback if prefetch failed or returned empty
    const cleanTitle = (lessonTitle || 'this topic').trim();
    if (!sampleText) {
      sampleText = `You could ask questions like... What does ${cleanTitle} mean in simple words? How would we use ${cleanTitle} in real life? Could you show one more example?`;
    }
    
    // 4. Speak GPT-generated (or fallback) sample questions
    let sampleAudio = ttsCache.get(sampleText);
    if (!sampleAudio) {
      sampleAudio = await fetchTTS(sampleText);
      if (sampleAudio) ttsCache.set(sampleText, sampleAudio);
    }
    await this.#audioEngine.playAudio(sampleAudio || '', [sampleText]);
    } catch (err) {
      gateError = err;
      throw err;
    } finally {
      if (this.#gatePromptActive) {
        this.#emit('gatePromptComplete', { stage, error: gateError, skipped: this.#gatePromptSkipped });
      }
      this.#gatePromptActive = false;
      this.#gatePromptStage = null;
      this.#gatePromptSkipped = false;
    }
  }

  skipGatePrompt() {
    if (!this.#gatePromptActive) return;
    this.#gatePromptSkipped = true;
    try {
      this.#audioEngine.stop();
    } catch {}
    this.#emit('gatePromptComplete', { stage: this.#gatePromptStage, skipped: true });
    this.#gatePromptActive = false;
    this.#gatePromptStage = null;
  }
  
  // Private: Ensure definitions are loaded (await pending promise if needed)
  async #ensureDefinitionsLoaded() {
    if (this.#vocabSentences.length > 0) return; // Already loaded
    
    if (this.#definitionsGptPromise) {
      console.log('[TeachingController] Awaiting pending definitions GPT promise');
      this.#emit('loading', { stage: 'definitions' });
      try {
        this.#vocabSentences = await this.#definitionsGptPromise;
        console.log('[TeachingController] Definitions loaded:', this.#vocabSentences.length, 'sentences');
      } finally {
        // Clear promise even on error so a later user action can retry.
        this.#definitionsGptPromise = null;
      }
    } else {
      // No promise pending and no content - fetch now
      console.log('[TeachingController] No pending promise, fetching definitions now');
      this.#emit('loading', { stage: 'definitions' });
      this.#vocabSentences = await this.#fetchDefinitionsFromGPT();
      console.log('[TeachingController] Definitions fetched:', this.#vocabSentences.length, 'sentences');
    }
  }
  
  // Private: Ensure examples are loaded (await pending promise if needed)
  async #ensureExamplesLoaded() {
    if (this.#exampleSentences.length > 0) return; // Already loaded
    
    if (this.#examplesGptPromise) {
      console.log('[TeachingController] Awaiting pending examples GPT promise');
      this.#emit('loading', { stage: 'examples' });
      try {
        this.#exampleSentences = await this.#examplesGptPromise;
        console.log('[TeachingController] Examples loaded:', this.#exampleSentences.length, 'sentences');
      } finally {
        // Clear promise even on error so a later user action can retry.
        this.#examplesGptPromise = null;
      }
    } else {
      // No promise pending and no content - fetch now
      console.log('[TeachingController] No pending promise, fetching examples now');
      this.#emit('loading', { stage: 'examples' });
      this.#exampleSentences = await this.#fetchExamplesFromGPT();
      console.log('[TeachingController] Examples fetched:', this.#exampleSentences.length, 'sentences');
    }
  }
  
  // Private: Audio coordination
  #setupAudioEndListener(callback) {
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
    }
    
    this.#audioEndListener = (data) => {
      // Advance on both completed and skipped playback
      if (data.completed || data.skipped) {
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
