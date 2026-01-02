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
  
  // Public API: Start all prefetches in background (call on Begin click)
  prefetchAll() {
    console.log('[TeachingController] Starting background prefetch of all GPT content');
    
    // Start definitions GPT (don't await) - then prefetch TTS for first few sentences
    this.#definitionsGptPromise = this.#fetchDefinitionsFromGPT().then(sentences => {
      // Prefetch TTS for first 3 definition sentences
      sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
      return sentences;
    });
    
    // Start examples GPT (don't await) - then prefetch TTS for first few sentences
    this.#examplesGptPromise = this.#fetchExamplesFromGPT().then(sentences => {
      // Prefetch TTS for first 3 example sentences
      sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
      return sentences;
    });
    
    // Start gate prompt GPT for definitions (don't await) - then prefetch TTS
    this.#definitionsGatePromptPromise = this.#fetchGatePromptFromGPT('definitions').then(text => {
      if (text) ttsCache.prefetch(text);
      return text;
    });
    
    // Start gate prompt GPT for examples (don't await) - then prefetch TTS
    this.#examplesGatePromptPromise = this.#fetchGatePromptFromGPT('examples').then(text => {
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
  
  // Public API: Start teaching flow
  async startTeaching(options = {}) {
    const { autoplayFirstSentence = true } = options;
    if (!this.#lessonData) {
      throw new Error('No lesson data provided');
    }
    
    // Start definitions stage (will call GPT)
    await this.#startDefinitions({ autoplayFirstSentence });
  }
  
  // Public API: Sentence navigation
  async nextSentence() {
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
  }
  
  async skipToExamples() {
    if (this.#stage === 'definitions' || this.#stage === 'loading-definitions') {
      await this.#startExamples();
    }
  }
  
  restartStage() {
    if (this.#stage === 'definitions') {
      this.#currentSentenceIndex = 0;
      this.#isInSentenceMode = true;
      this.#awaitingFirstPlay = false;
      this.#playCurrentDefinition();
    } else if (this.#stage === 'examples') {
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
        throw new Error(`GPT request failed: ${response.status}`);
      }
      
      const data = await response.json();
      const text = data.reply || data.text || '';
      
      if (!text) {
        console.warn('[TeachingController] Empty GPT response for definitions');
        return [];
      }
      
      const sentences = this.#splitIntoSentences(text);
      console.log('[TeachingController] GPT definitions split into', sentences.length, 'sentences');
      return sentences;
      
    } catch (err) {
      console.error('[TeachingController] GPT definitions error:', err);
      return [];
    }
  }
  
  // Private: Call GPT for examples
  async #fetchExamplesFromGPT() {
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
        throw new Error(`GPT request failed: ${response.status}`);
      }
      
      const data = await response.json();
      const text = data.reply || data.text || '';
      
      if (!text) {
        console.warn('[TeachingController] Empty GPT response for examples');
        return [];
      }
      
      const sentences = this.#splitIntoSentences(text);
      console.log('[TeachingController] GPT examples split into', sentences.length, 'sentences');
      return sentences;
      
    } catch (err) {
      console.error('[TeachingController] GPT examples error:', err);
      return [];
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
  async #startDefinitions({ autoplayFirstSentence = true } = {}) {
    console.log('[TeachingController] #startDefinitions called');
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
    
    // Ensure definitions are loaded (uses prefetch if available)
    await this.#ensureDefinitionsLoaded();
    
    if (this.#vocabSentences.length === 0) {
      console.warn('[TeachingController] No definitions generated, SKIPPING TO EXAMPLES');
      await this.#startExamples();
      return;
    }
    
    // NOW set stage to definitions (content is ready, user can interact)
    this.#stage = 'definitions';
    
    // Emit stage change AFTER data is ready (no loading state)
    this.#emit('stageChange', {
      stage: 'definitions',
      totalSentences: this.#vocabSentences.length
    });
    
    this.#awaitingFirstPlay = !autoplayFirstSentence;
    
    if (!autoplayFirstSentence) {
      // Prefetch first sentence TTS
      const firstSentence = this.#vocabSentences[0];
      if (firstSentence) {
        ttsCache.prefetch(firstSentence);
      }
      return;
    }
    
    await this.#playCurrentDefinition();
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
      this.#playGatePrompt('definitions');
      return;
    }
    
    this.#currentSentenceIndex = nextIndex;
    this.#emit('sentenceAdvance', {
      stage: 'definitions',
      index: this.#currentSentenceIndex,
      total: this.#vocabSentences.length
    });
    
    this.#emit('requestSnapshotSave', {
      trigger: 'teaching-definition',
      data: { stage: 'definitions', sentenceIndex: this.#currentSentenceIndex }
    });
    
    this.#playCurrentDefinition();
  }
  
  // Private: Examples stage
  async #startExamples() {
    // Set loading stage to block nextSentence/repeatSentence during intro and GPT fetch
    this.#stage = 'loading-examples';
    this.#currentSentenceIndex = 0;
    this.#isInSentenceMode = true;
    
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
    
    this.#awaitingFirstPlay = false;
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
      this.#playGatePrompt('examples');
      return;
    }
    
    this.#currentSentenceIndex = nextIndex;
    this.#emit('sentenceAdvance', {
      stage: 'examples',
      index: this.#currentSentenceIndex,
      total: this.#exampleSentences.length
    });
    
    this.#emit('requestSnapshotSave', {
      trigger: 'teaching-example',
      data: { stage: 'examples', sentenceIndex: this.#currentSentenceIndex }
    });
    
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
  }
  
  // Private: Ensure definitions are loaded (await pending promise if needed)
  async #ensureDefinitionsLoaded() {
    if (this.#vocabSentences.length > 0) return; // Already loaded
    
    if (this.#definitionsGptPromise) {
      console.log('[TeachingController] Awaiting pending definitions GPT promise');
      this.#emit('loading', { stage: 'definitions' });
      this.#vocabSentences = await this.#definitionsGptPromise;
      this.#definitionsGptPromise = null;
      console.log('[TeachingController] Definitions loaded:', this.#vocabSentences.length, 'sentences');
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
      this.#exampleSentences = await this.#examplesGptPromise;
      this.#examplesGptPromise = null;
      console.log('[TeachingController] Examples loaded:', this.#exampleSentences.length, 'sentences');
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
