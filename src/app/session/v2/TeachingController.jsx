/**
 * TeachingController - Manages three-stage teaching flow
 * 
 * V2 Architecture: Calls GPT to generate concept intro, definitions, and examples text,
 * then splits into sentences for sentence-by-sentence navigation.
 * 
 * Flow:
 * 1. Call GPT to generate a 3-5 sentence concept introduction (the big idea)
 * 2. User navigates concept sentences; on completion transitions to definitions
 * 3. Extract vocab terms from lesson JSON
 * 4. Call GPT to generate kid-friendly definitions text
 * 5. Split GPT response into sentences, navigate, gate
 * 6. At definitions gate, transition to lecture
 * 7. Call GPT to generate lecture — deeper teaching using sample Q&A + teachingNotes as anchor
 * 8. Split into sentences, navigate, at end transition to examples
 * 9. Call GPT to generate examples text
 * 10. Split into sentences, navigate, gate, complete
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
import { splitIntoSentences as sharedSplitIntoSentences } from '../utils/textProcessing';

export class TeachingController {
  // Private state
  #audioEngine = null;
  #lessonData = null;
  #lessonMeta = null; // { subject, difficulty, lessonId, lessonTitle }
  
  #stage = 'idle'; // 'idle' | 'loading-concept' | 'concept' | 'loading-definitions' | 'definitions' | 'loading-lecture' | 'lecture' | 'loading-examples' | 'examples' | 'complete'
  #conceptSentences = [];
  #vocabSentences = [];
  #lectureSentences = [];
  #exampleSentences = [];
  #currentSentenceIndex = 0;
  #isInSentenceMode = true;
  #awaitingFirstPlay = false;
  
  #listeners = new Map();
  #audioEndListener = null;
  
  // Background prefetch promises - started early, awaited when needed
  #conceptGptPromise = null;
  #definitionsGptPromise = null;
  #lectureGptPromise = null;
  #examplesGptPromise = null;
  #definitionsGatePromptPromise = null;
  #examplesGatePromptPromise = null;

  // Rate-limit / spam guards
  #prefetchStarted = false;
  #conceptCompleted = false; // true only when concept sentences were actually spoken
  #conceptCooldownUntilMs = 0;
  #definitionsCooldownUntilMs = 0;
  #lectureCooldownUntilMs = 0;
  #examplesCooldownUntilMs = 0;
  #conceptRateLimited = false;
  #definitionsRateLimited = false;
  #lectureRateLimited = false;
  #examplesRateLimited = false;
  #conceptRetryPending = false;
  #definitionsRetryPending = false;
  #lectureRetryPending = false;
  #examplesRetryPending = false;

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

  #sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  #buildLocalDefinitionFallbackSentences() {
    try {
      const items = Array.isArray(this.#lessonData?.vocab) ? this.#lessonData.vocab : [];
      const cleaned = items
        .filter(v => v && typeof v.term === 'string' && v.term.trim() && typeof v.definition === 'string' && v.definition.trim())
        .map(v => ({ term: v.term.trim(), definition: v.definition.trim() }));
      if (!cleaned.length) return [];
      return cleaned.map(v => `${v.term} means ${v.definition}.`);
    } catch {
      return [];
    }
  }

  #buildLocalExamplesFallbackSentences() {
    // Build worked example sentences from lesson data.
    // Priority: word problems (scenario + answer = natural worked example),
    // then sample Q&A pairs, then a minimal placeholder.
    const lessonTitle = this.#lessonData?.title || 'this lesson';
    const wordProblems = Array.isArray(this.#lessonData?.wordProblems) ? this.#lessonData.wordProblems : [];
    const sampleItems = Array.isArray(this.#lessonData?.sample) ? this.#lessonData.sample : [];

    // Helper: turn a Q+A item into two spoken sentences
    const itemToSentences = (item) => {
      const q = item?.question?.trim();
      if (!q) return [];
      const answer = item?.expectedAny?.[0]?.trim() || '';
      const out = [q];
      if (answer) out.push(`The answer is ${answer}.`);
      return out;
    };

    // Strategy 1: use word problems — they are concrete scenario + answer pairs,
    // which map naturally to "watch me work through this" examples.
    if (wordProblems.length > 0) {
      const sentences = [`Let me walk you through some examples.`];
      wordProblems.slice(0, 3).forEach(item => {
        sentences.push(...itemToSentences(item));
      });
      if (sentences.length > 1) return sentences;
    }

    // Strategy 2: sample discussion questions — Ms. Sonoma narrates the answer.
    if (sampleItems.length > 0) {
      const sentences = [`Let me walk you through some examples for ${lessonTitle}.`];
      sampleItems.slice(0, 3).forEach(item => {
        sentences.push(...itemToSentences(item));
      });
      if (sentences.length > 1) return sentences;
    }

    // Last resort
    return [`Let me show you some examples for ${lessonTitle}.`];
  }

  async #maybeRetryRateLimited(stage) {
    const now = this.#getNowMs();

    if (stage === 'concept' && (this.#conceptRateLimited || this.#conceptRetryPending)) {
      if (now < this.#conceptCooldownUntilMs) {
        this.#currentSentenceIndex = 0;
        await this.#playCurrentConcept();
        return true;
      }

      // Cooldown passed: retry fetch.
      this.#conceptRateLimited = false;
      this.#conceptRetryPending = false;
      this.#conceptCooldownUntilMs = 0;
      this.#conceptSentences = [];
      this.#conceptGptPromise = null;

      this.#stage = 'loading-concept';
      this.#emit('loading', { stage: 'concept' });
      await this.#ensureConceptLoaded();

      this.#stage = 'concept';
      this.#currentSentenceIndex = 0;
      this.#emit('stageChange', { stage: 'concept', totalSentences: this.#conceptSentences.length });
      await this.#playCurrentConcept();
      return true;
    }

    if (stage === 'definitions' && (this.#definitionsRateLimited || this.#definitionsRetryPending)) {
      if (now < this.#definitionsCooldownUntilMs) {
        this.#currentSentenceIndex = 0;
        this.#awaitingFirstPlay = false;
        await this.#playCurrentDefinition();
        return true;
      }

      // Cooldown passed: retry fetch.
      this.#definitionsRateLimited = false;
      this.#definitionsRetryPending = false;
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

    if (stage === 'lecture' && (this.#lectureRateLimited || this.#lectureRetryPending)) {
      if (now < this.#lectureCooldownUntilMs) {
        this.#currentSentenceIndex = 0;
        await this.#playCurrentLecture();
        return true;
      }

      this.#lectureRateLimited = false;
      this.#lectureRetryPending = false;
      this.#lectureCooldownUntilMs = 0;
      this.#lectureSentences = [];
      this.#lectureGptPromise = null;

      this.#stage = 'loading-lecture';
      this.#emit('loading', { stage: 'lecture' });
      await this.#ensureLectureLoaded();

      this.#stage = 'lecture';
      this.#currentSentenceIndex = 0;
      this.#emit('stageChange', { stage: 'lecture', totalSentences: this.#lectureSentences.length });
      await this.#playCurrentLecture();
      return true;
    }

    if (stage === 'examples' && (this.#examplesRateLimited || this.#examplesRetryPending)) {
      if (now < this.#examplesCooldownUntilMs) {
        this.#currentSentenceIndex = 0;
        this.#awaitingFirstPlay = false;
        await this.#playCurrentExample();
        return true;
      }

      // Cooldown passed: retry fetch.
      this.#examplesRateLimited = false;
      this.#examplesRetryPending = false;
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

    // Prefetch promises should never produce unhandled rejections.
    // prefetchAll() is called synchronously in startSession before the orchestrator runs,
    // so #conceptGptPromise is guaranteed to be set before startTeachingPhase fires.

    // 0. Warm-up ping — wakes the Vercel function at no token cost
    fetch('/api/sonoma', { method: 'GET' }).catch(() => {});

    // 1. Concept - fire immediately; warm-up ping runs concurrently
    this.#conceptGptPromise = this.#fetchConceptFromGPT()
      .then(sentences => {
        sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
        return sentences;
      })
      .catch(err => {
        console.error('[TeachingController] Concept prefetch error:', err);
        return [];
      });

    // 2. Definitions - start 3s after concept begins
    this.#definitionsGptPromise = new Promise(resolve => setTimeout(resolve, 3000))
      .then(() => this.#fetchDefinitionsFromGPT())
      .then(sentences => {
        sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
        return sentences;
      })
      .catch(err => {
        console.error('[TeachingController] Definitions prefetch error:', err);
        return [];
      });

    // 3. Lecture - start after definitions resolves + 1s stagger
    this.#lectureGptPromise = this.#definitionsGptPromise
      .catch(() => [])
      .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
      .then(() => this.#fetchLectureFromGPT())
      .then(sentences => {
        sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
        return sentences;
      })
      .catch(err => {
        console.error('[TeachingController] Lecture prefetch error:', err);
        return [];
      });

    // 4. Examples - start after lecture resolves + 2s stagger
    this.#examplesGptPromise = this.#lectureGptPromise
      .catch(() => [])
      .then(() => new Promise(resolve => setTimeout(resolve, 2000)))
      .then(() => this.#fetchExamplesFromGPT())
      .then(sentences => {
        sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
        return sentences;
      })
      .catch(err => {
        console.error('[TeachingController] Examples prefetch error:', err);
        return [];
      });

    // Gate prompts are nice-to-have; fetch them after their parent content + 2s delay each.
    this.#definitionsGatePromptPromise = this.#definitionsGptPromise
      .catch(() => [])
      .then(() => new Promise(resolve => setTimeout(resolve, 2000)))
      .then(() => this.#fetchGatePromptFromGPT('definitions'))
      .then(text => {
        if (text) ttsCache.prefetch(text);
        return text;
      });

    this.#examplesGatePromptPromise = this.#examplesGptPromise
      .catch(() => [])
      .then(() => new Promise(resolve => setTimeout(resolve, 2000)))
      .then(() => this.#fetchGatePromptFromGPT('examples'))
      .then(text => {
        if (text) ttsCache.prefetch(text);
        return text;
      });

    // Prefetch transition TTS phrases
    ttsCache.prefetch("First let's go over some definitions.");
    ttsCache.prefetch("Now let me teach you more about this.");
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
      conceptCompleted: this.#conceptCompleted,
      conceptSentences: this.#conceptSentences,
      vocabSentences: this.#vocabSentences,
      lectureSentences: this.#lectureSentences,
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

    // Route resume states directly to the correct stage.
    if (resumeState?.stage === 'examples') {
      await this.#startExamples({ resumeState });
      return;
    }
    if (resumeState?.stage === 'lecture') {
      await this.#startLecture({ resumeState });
      return;
    }
    if (resumeState?.stage === 'definitions') {
      // Only skip concept if the explicit conceptCompleted flag is set.
      // Inferring from conceptSentences.length is unreliable: old snapshots may have
      // fallback/garbage sentences, and failed fetches leave an empty array.
      if (resumeState.conceptCompleted === true) {
        await this.#startDefinitions({ autoplayFirstSentence, resumeState });
        return;
      }
      // conceptCompleted not set — concept never properly ran; start fresh from concept.
    }
    if (resumeState?.stage === 'concept') {
      await this.#startConcept({ resumeState });
      return;
    }

    // Fresh start (or stale snapshot without conceptCompleted): begin with concept introduction.
    await this.#startConcept();
  }
  
  // Public API: Sentence navigation
  async nextSentence() {
    if (this.#stage === 'concept') {
      const handled = await this.#maybeRetryRateLimited('concept');
      if (handled) return;
    }
    if (this.#stage === 'definitions') {
      const handled = await this.#maybeRetryRateLimited('definitions');
      if (handled) return;
    }
    if (this.#stage === 'lecture') {
      const handled = await this.#maybeRetryRateLimited('lecture');
      if (handled) return;
    }
    if (this.#stage === 'examples') {
      const handled = await this.#maybeRetryRateLimited('examples');
      if (handled) return;
    }

    // If in loading stage, stop current audio, await content, then play first sentence
    if (this.#stage === 'loading-concept') {
      console.log('[TeachingController] nextSentence during loading-concept - awaiting content');
      this.#audioEngine.stop();
      await this.#ensureConceptLoaded();
      if (this.#conceptSentences.length > 0) {
        this.#stage = 'concept';
        this.#currentSentenceIndex = 0;
        this.#emit('stageChange', { stage: 'concept', totalSentences: this.#conceptSentences.length });
        this.#playCurrentConcept();
      }
      return;
    }
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
    if (this.#stage === 'loading-lecture') {
      console.log('[TeachingController] nextSentence during loading-lecture - awaiting content');
      this.#audioEngine.stop();
      await this.#ensureLectureLoaded();
      if (this.#lectureSentences.length > 0) {
        this.#stage = 'lecture';
        this.#currentSentenceIndex = 0;
        this.#emit('stageChange', { stage: 'lecture', totalSentences: this.#lectureSentences.length });
        this.#playCurrentLecture();
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
    if (this.#stage === 'concept') {
      this.#advanceConcept();
    } else if (this.#stage === 'definitions') {
      this.#advanceDefinition();
    } else if (this.#stage === 'lecture') {
      this.#advanceLecture();
    } else if (this.#stage === 'examples') {
      this.#advanceExample();
    }
  }
  
  async repeatSentence() {
    try {
      if (this.#stage === 'concept') {
        const handled = await this.#maybeRetryRateLimited('concept');
        if (handled) return;
      }
      if (this.#stage === 'definitions') {
        const handled = await this.#maybeRetryRateLimited('definitions');
        if (handled) return;
      }
      if (this.#stage === 'lecture') {
        const handled = await this.#maybeRetryRateLimited('lecture');
        if (handled) return;
      }
      if (this.#stage === 'examples') {
        const handled = await this.#maybeRetryRateLimited('examples');
        if (handled) return;
      }

      // If in loading stage, stop current audio, await content, then play first sentence
      if (this.#stage === 'loading-concept') {
        this.#audioEngine.stop();
        await this.#ensureConceptLoaded();
        if (this.#conceptSentences.length > 0) {
          this.#stage = 'concept';
          this.#currentSentenceIndex = 0;
          this.#emit('stageChange', { stage: 'concept', totalSentences: this.#conceptSentences.length });
          this.#playCurrentConcept();
        }
        return;
      }
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
      if (this.#stage === 'loading-lecture') {
        this.#audioEngine.stop();
        await this.#ensureLectureLoaded();
        if (this.#lectureSentences.length > 0) {
          this.#stage = 'lecture';
          this.#currentSentenceIndex = 0;
          this.#emit('stageChange', { stage: 'lecture', totalSentences: this.#lectureSentences.length });
          this.#playCurrentLecture();
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
      if (this.#stage === 'concept') {
        this.#playCurrentConcept();
      } else if (this.#stage === 'definitions') {
        this.#playCurrentDefinition();
      } else if (this.#stage === 'lecture') {
        this.#playCurrentLecture();
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
      if (this.#stage === 'concept' || this.#stage === 'loading-concept' ||
          this.#stage === 'definitions' || this.#stage === 'loading-definitions' ||
          this.#stage === 'lecture' || this.#stage === 'loading-lecture') {
        await this.#startExamples();
      }
    } catch (err) {
      console.error('[TeachingController] skipToExamples error:', err);
      this.#emit('error', { type: 'teaching', action: 'skipToExamples', error: String(err?.message || err) });
    }
  }
  
  restartStage() {
    if (this.#stage === 'concept') {
      if (this.#conceptRateLimited || this.#conceptRetryPending) {
        void this.#maybeRetryRateLimited('concept').catch(err => {
          console.error('[TeachingController] restartStage retry (concept) error:', err);
          this.#emit('error', { type: 'teaching', action: 'restartStage', stage: 'concept', error: String(err?.message || err) });
        });
        return;
      }
      this.#currentSentenceIndex = 0;
      this.#isInSentenceMode = true;
      this.#playCurrentConcept();
    } else if (this.#stage === 'definitions') {
      if (this.#definitionsRateLimited || this.#definitionsRetryPending) {
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
    } else if (this.#stage === 'lecture') {
      if (this.#lectureRateLimited || this.#lectureRetryPending) {
        void this.#maybeRetryRateLimited('lecture').catch(err => {
          console.error('[TeachingController] restartStage retry (lecture) error:', err);
          this.#emit('error', { type: 'teaching', action: 'restartStage', stage: 'lecture', error: String(err?.message || err) });
        });
        return;
      }
      this.#currentSentenceIndex = 0;
      this.#isInSentenceMode = true;
      this.#playCurrentLecture();
    } else if (this.#stage === 'examples') {
      if (this.#examplesRateLimited || this.#examplesRetryPending) {
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
    if (this.#stage === 'concept') {
      return this.#conceptSentences.length;
    } else if (this.#stage === 'definitions') {
      return this.#vocabSentences.length;
    } else if (this.#stage === 'lecture') {
      return this.#lectureSentences.length;
    } else if (this.#stage === 'examples') {
      return this.#exampleSentences.length;
    }
    return 0;
  }
  
  get isInSentenceMode() {
    return this.#isInSentenceMode;
  }
  
  get currentSentence() {
    if (this.#stage === 'concept') {
      return this.#conceptSentences[this.#currentSentenceIndex] || '';
    } else if (this.#stage === 'definitions') {
      return this.#vocabSentences[this.#currentSentenceIndex] || '';
    } else if (this.#stage === 'lecture') {
      return this.#lectureSentences[this.#currentSentenceIndex] || '';
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
    // Delegate to shared util so numbered-list merging and all fixes stay in one place
    return sharedSplitIntoSentences(text);
  }
  
  // Private: Call GPT for concept introduction
  async #fetchConceptFromGPT() {
    const now = this.#getNowMs();
    if (now < this.#conceptCooldownUntilMs) {
      this.#conceptRateLimited = true;
      this.#conceptRetryPending = false;
      const remainingMs = this.#conceptCooldownUntilMs - now;
      const msg = this.#buildRateLimitSentence(remainingMs);
      this.#emit('error', { type: 'gpt', stage: 'concept', status: 429, retryAfterMs: remainingMs });
      return [msg];
    }

    const lessonTitle = this.#lessonData?.title || 'this lesson';
    const grade = this.#lessonData?.grade || '';
    const blurb = (this.#lessonData?.blurb || '').trim();

    // Vocab terms + definitions are the most reliable context — present on every lesson.
    const vocabContext = (this.#lessonData?.vocab || [])
      .filter(v => v?.term && v?.definition)
      .map(v => `${v.term}: ${v.definition}`)
      .join('\n');

    // Anchor GPT on a sample of assessment questions so the concept explanation
    // targets what the learner will actually be assessed on.
    const allQuestions = [
      ...(this.#lessonData?.multiplechoice || []).slice(0, 2).map(q => q?.question || q?.Q || ''),
      ...(this.#lessonData?.truefalse || []).slice(0, 2).map(q => q?.question || q?.statement || ''),
      ...(this.#lessonData?.shortanswer || []).slice(0, 1).map(q => q?.question || ''),
    ].filter(Boolean);
    const questionContext = allQuestions.length > 0
      ? `Assessment questions the learner will answer (do not read aloud; use only to guide your explanation):\n${allQuestions.join('\n')}`
      : '';

    const instruction = [
      `Grade: ${grade}`,
      `Lesson topic (do not say the title aloud): "${lessonTitle}"`,
      '',
      blurb ? `Lesson context (for reference): ${blurb}` : '',
      // teachingNotes are internal educator instructions — intentionally excluded here
      //   to prevent the model from mirroring teacher-facing language to the student.
      vocabContext ? `Vocabulary in this lesson (do not define them yet — that comes next; use only to understand what the lesson covers):\n${vocabContext}` : '',
      '',
      questionContext,
      '',
      'Your task: Speak 3 to 5 short sentences that introduce the main idea of this lesson.',
      'Explain what this topic is and why it matters in everyday life.',
      'Do NOT define vocabulary words yet — that comes next.',
      'Do NOT give worked examples yet — that comes after.',
      'Do NOT greet or introduce yourself. Begin speaking immediately.',
      'Do NOT ask any questions.',
      'Do NOT use numbered lists, bullet points, or any list formatting.',
      'Write only flowing spoken sentences, one idea each.',
      '',
      'Kid-friendly: Use simple everyday words. Keep sentences short (about 6–12 words). One idea per sentence.',
      'Always respond with natural spoken text only. No emojis, decorative characters, or symbols.',
    ].filter(Boolean).join('\n');

    const attemptFetch = async () => {
      return fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          input: '',
          lessonTopic: lessonTitle,
          context: {
            phase: 'teaching',
            step: 'concept',
            lessonTitle,
          },
          skipAudio: true,
        }),
      });
    };

    const delays = [0, 500, 1200];
    for (let i = 0; i < delays.length; i += 1) {
      if (delays[i]) await this.#sleep(delays[i]);
      try {
        const response = await attemptFetch();
        if (!response.ok) {
          const status = response.status;
          if (status === 429) {
            const retryAfterMs = this.#getRetryAfterMs(response);
            this.#conceptCooldownUntilMs = this.#getNowMs() + retryAfterMs;
            this.#conceptRateLimited = true;
            this.#conceptRetryPending = false;
            this.#emit('error', { type: 'gpt', stage: 'concept', status, retryAfterMs });
            return [this.#buildRateLimitSentence(retryAfterMs)];
          }
          if (status >= 500 && i < delays.length - 1) continue;
          console.error(`[TeachingController] Concept request failed with status ${status}`);
          this.#conceptRateLimited = false;
          this.#conceptRetryPending = true;
          this.#emit('error', { type: 'gpt', stage: 'concept', status });
          break;
        }

        const data = await response.json().catch(() => null);
        const text = (data && (data.reply || data.text)) ? String(data.reply || data.text) : '';
        if (!text) {
          console.warn('[TeachingController] Empty GPT response for concept, retrying');
          continue;
        }

        const sentences = this.#splitIntoSentences(text);
        console.log('[TeachingController] GPT concept split into', sentences.length, 'sentences');
        this.#conceptRateLimited = false;
        this.#conceptRetryPending = false;
        return sentences;
      } catch (err) {
        if (i < delays.length - 1) continue;
        console.error('[TeachingController] GPT concept error:', err);
        this.#conceptRateLimited = false;
        this.#conceptRetryPending = true;
      }
    }

    // Concept stage has no meaningful local fallback — skip to definitions instead.
    this.#conceptRateLimited = false;
    this.#conceptRetryPending = false;
    return [];
  }

  // Private: Call GPT for definitions
  async #fetchDefinitionsFromGPT() {
    const now = this.#getNowMs();
    if (now < this.#definitionsCooldownUntilMs) {
      this.#definitionsRateLimited = true;
      this.#definitionsRetryPending = false;
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
    
    const attemptFetch = async () => {
      return fetch('/api/sonoma', {
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
    };

    // Transient hardening: first call after landing/refresh can fail.
    // Retry with backoff so the learner doesn't need to press Next twice.
    const delays = [0, 500, 1200];
    for (let i = 0; i < delays.length; i += 1) {
      if (delays[i]) await this.#sleep(delays[i]);
      try {
        const response = await attemptFetch();
        if (!response.ok) {
          const status = response.status;
          if (status === 429) {
            const retryAfterMs = this.#getRetryAfterMs(response);
            this.#definitionsCooldownUntilMs = this.#getNowMs() + retryAfterMs;
            this.#definitionsRateLimited = true;
            this.#definitionsRetryPending = false;
            this.#emit('error', { type: 'gpt', stage: 'definitions', status, retryAfterMs });
            return [this.#buildRateLimitSentence(retryAfterMs)];
          }

          // Retry on 5xx; on 4xx, don't spin.
          if (status >= 500 && i < delays.length - 1) {
            continue;
          }

          console.error(`[TeachingController] Definitions request failed with status ${status}`);
          this.#definitionsRateLimited = false;
          this.#definitionsRetryPending = true;
          this.#emit('error', { type: 'gpt', stage: 'definitions', status });
          break;
        }

        const data = await response.json().catch(() => null);
        const text = (data && (data.reply || data.text)) ? String(data.reply || data.text) : '';
        if (!text) {
          console.warn('[TeachingController] Empty GPT response for definitions');
          break;
        }

        const sentences = this.#splitIntoSentences(text);
        console.log('[TeachingController] GPT definitions split into', sentences.length, 'sentences');

        this.#definitionsRateLimited = false;
        this.#definitionsRetryPending = false;
        return sentences;
      } catch (err) {
        // Retry fetch/network errors.
        if (i < delays.length - 1) continue;
        console.error('[TeachingController] GPT definitions error:', err);
        this.#definitionsRateLimited = false;
        this.#definitionsRetryPending = true;
      }
    }

    // Last-resort fallback: use lesson JSON vocab definitions so teaching always proceeds.
    const local = this.#buildLocalDefinitionFallbackSentences();
    if (local.length) {
      this.#definitionsRateLimited = false;
      this.#definitionsRetryPending = false;
      return local;
    }

    return ['I had trouble loading the definitions.'];
  }
  
  // Private: Call GPT for examples
  async #fetchExamplesFromGPT() {
    const now = this.#getNowMs();
    if (now < this.#examplesCooldownUntilMs) {
      this.#examplesRateLimited = true;
      this.#examplesRetryPending = false;
      const remainingMs = this.#examplesCooldownUntilMs - now;
      const msg = this.#buildRateLimitSentence(remainingMs);
      this.#emit('error', { type: 'gpt', stage: 'examples', status: 429, retryAfterMs: remainingMs });
      return [msg];
    }

    const terms = this.#getVocabTerms();
    const lessonTitle = this.#lessonData?.title || 'this lesson';
    const grade = this.#lessonData?.grade || '';
    const teachingNotes = this.#lessonData?.teachingNotes || '';

    const fullLessonJson = (() => {
      try {
        // Trim large arrays to a representative sample (3 items each) so the instruction
        // stays within a reasonable size while still giving GPT enough assessment context.
        const d = this.#lessonData || {};
        const trimArrayField = (arr) => Array.isArray(arr) ? arr.slice(0, 3) : arr;
        const trimmed = {
          ...d,
          sample:          trimArrayField(d.sample),
          truefalse:       trimArrayField(d.truefalse),
          multiplechoice:  trimArrayField(d.multiplechoice),
          fillintheblank:  trimArrayField(d.fillintheblank),
          shortanswer:     trimArrayField(d.shortanswer),
          wordProblems:    trimArrayField(d.wordProblems),
        };
        return JSON.stringify(trimmed);
      } catch {
        return '';
      }
    })();
    
    const vocabContext = terms.length > 0 
      ? `Use these vocabulary words naturally in your examples: ${terms.join(', ')}.`
      : '';
    
    const instruction = [
      `Grade: ${grade}`,
      `Lesson (do not read aloud): "${lessonTitle}"`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the examples.',
      `Examples: Show 2-3 tiny worked examples appropriate for this lesson. If needed to cover all question content, you may show up to 5 tiny examples. ${vocabContext} You compute every step. Be concise, warm, and playful. Do not add definitions or broad explanations. Give only the examples.`,
      '',
      teachingNotes ? `Teaching notes: ${teachingNotes}` : '',
      '',
      'Full lesson JSON (internal; do not read aloud). This includes the questions used for assessment:',
      fullLessonJson ? fullLessonJson : '(missing lesson json)',
      '',
      'Assessment linkage (CRITICAL): The learner will be assessed using the questions in the lesson JSON (comprehension, exercise, worksheet, and test).',
      'Reverse-engineer those questions into your examples so the learner is prepared to answer every question.',
      'Internal self-check (do not output): mentally map every lesson question to at least one example. If any question is not covered, revise the examples until it is.',
      '',
      'CRITICAL ACCURACY: All examples must be correct. Verify accuracy before presenting.',
      '',
      'Kid-friendly: Use simple everyday words. Keep sentences short (about 6-12 words). One idea per sentence.',
      '',
      'Always respond with natural spoken text only. No emojis, decorative characters, or symbols.'
    ].filter(Boolean).join('\n');
    
    const attemptFetch = async () => {
      return fetch('/api/sonoma', {
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
    };

    const delays = [0, 700, 1500];
    for (let i = 0; i < delays.length; i += 1) {
      if (delays[i]) await this.#sleep(delays[i]);
      try {
        const response = await attemptFetch();
        if (!response.ok) {
          const status = response.status;
          if (status === 429) {
            const retryAfterMs = this.#getRetryAfterMs(response);
            this.#examplesCooldownUntilMs = this.#getNowMs() + retryAfterMs;
            this.#examplesRateLimited = true;
            this.#examplesRetryPending = false;
            this.#emit('error', { type: 'gpt', stage: 'examples', status, retryAfterMs });
            return [this.#buildRateLimitSentence(retryAfterMs)];
          }

          if (status >= 500 && i < delays.length - 1) {
            continue;
          }

          console.error(`[TeachingController] Examples request failed with status ${status}`);
          this.#examplesRateLimited = false;
          this.#examplesRetryPending = true;
          this.#emit('error', { type: 'gpt', stage: 'examples', status });
          break;
        }

        const data = await response.json().catch(() => null);
        const text = (data && (data.reply || data.text)) ? String(data.reply || data.text) : '';
        if (!text) {
          console.warn('[TeachingController] Empty GPT response for examples');
          break;
        }

        const sentences = this.#splitIntoSentences(text);
        console.log('[TeachingController] GPT examples split into', sentences.length, 'sentences');

        this.#examplesRateLimited = false;
        this.#examplesRetryPending = false;
        return sentences;
      } catch (err) {
        if (i < delays.length - 1) continue;
        console.error('[TeachingController] GPT examples error:', err);
        this.#examplesRateLimited = false;
        this.#examplesRetryPending = true;
      }
    }

    // Last-resort fallback: short local examples so the learner can continue.
    const local = this.#buildLocalExamplesFallbackSentences();
    if (local.length) {
      this.#examplesRateLimited = false;
      this.#examplesRetryPending = false;
      return local;
    }

    return ['I had trouble loading the examples.'];
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
  
  // Private: Concept introduction stage
  async #startConcept({ resumeState = null } = {}) {
    console.log('[TeachingController] #startConcept called');

    const resumeIntoConcept = resumeState?.stage === 'concept';
    if (resumeIntoConcept && Array.isArray(resumeState.conceptSentences) && resumeState.conceptSentences.length) {
      this.#conceptSentences = resumeState.conceptSentences;
    }

    this.#stage = 'loading-concept';
    this.#currentSentenceIndex = resumeIntoConcept ? Math.max(0, resumeState.sentenceIndex || 0) : 0;
    this.#isInSentenceMode = true;

    await this.#ensureConceptLoaded();

    if (this.#conceptSentences.length === 0) {
      console.warn('[TeachingController] No concept sentences generated, skipping to definitions');
      await this.#startDefinitions();
      return;
    }

    this.#stage = 'concept';
    this.#currentSentenceIndex = resumeIntoConcept
      ? Math.max(0, Math.min(resumeState.sentenceIndex || 0, this.#conceptSentences.length - 1))
      : 0;

    this.#emit('stageChange', { stage: 'concept', totalSentences: this.#conceptSentences.length });
    this.#emitSnapshot('begin-teaching-concept');

    await this.#playCurrentConcept();
  }

  async #playCurrentConcept() {
    const sentence = this.#conceptSentences[this.#currentSentenceIndex];
    if (!sentence) return;

    this.#setupAudioEndListener(() => {
      this.#emit('sentenceComplete', {
        stage: 'concept',
        index: this.#currentSentenceIndex,
        total: this.#conceptSentences.length,
      });
    });

    let audioBase64 = ttsCache.get(sentence);
    if (!audioBase64) {
      audioBase64 = await fetchTTS(sentence);
      if (audioBase64) ttsCache.set(sentence, audioBase64);
    }

    const nextIndex = this.#currentSentenceIndex + 1;
    if (nextIndex < this.#conceptSentences.length) {
      ttsCache.prefetch(this.#conceptSentences[nextIndex]);
    }

    await this.#audioEngine.playAudio(audioBase64 || '', [sentence]);
  }

  #advanceConcept() {
    const nextIndex = this.#currentSentenceIndex + 1;

    if (nextIndex >= this.#conceptSentences.length) {
      // Concept complete — mark it done so snapshots can gate the resume routing correctly
      this.#conceptCompleted = true;
      this.#startDefinitions();
      return;
    }

    this.#currentSentenceIndex = nextIndex;
    this.#emit('sentenceAdvance', {
      stage: 'concept',
      index: this.#currentSentenceIndex,
      total: this.#conceptSentences.length,
    });
    this.#emitSnapshot('teaching-concept');
    this.#playCurrentConcept();
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
      // At final gate - transition to lecture
      this.#startLecture();
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
  
  // Private: Lecture stage — GPT-driven teaching using vocab + sample Q&A as anchor
  async #fetchLectureFromGPT() {
    const now = this.#getNowMs();
    if (now < this.#lectureCooldownUntilMs) {
      this.#lectureRateLimited = true;
      this.#lectureRetryPending = false;
      const remainingMs = this.#lectureCooldownUntilMs - now;
      const msg = this.#buildRateLimitSentence(remainingMs);
      this.#emit('error', { type: 'gpt', stage: 'lecture', status: 429, retryAfterMs: remainingMs });
      return [msg];
    }

    const lessonTitle = this.#lessonData?.title || 'this lesson';
    const grade = this.#lessonData?.grade || '';
    const teachingNotes = this.#lessonData?.teachingNotes || '';

    const vocabContext = (this.#lessonData?.vocab || [])
      .filter(v => v?.term && v?.definition)
      .map(v => `${v.term}: ${v.definition}`)
      .join('\n');

    // Use sample Q&A pairs as the key-fact anchor so GPT teaches exactly
    // what the learner will be assessed on.
    const sampleItems = (this.#lessonData?.sample || []).slice(0, 6);
    const sampleContext = sampleItems.length > 0
      ? sampleItems.map(q => `Q: ${q.question}  A: ${q.expectedAny?.[0] || ''}`).join('\n')
      : '';

    const instruction = [
      `Grade: ${grade}`,
      `Lesson topic (do not say aloud): "${lessonTitle}"`,
      '',
      'The learner just heard all the vocabulary definitions.',
      'Your task: Speak 4 to 6 short sentences that teach the main ideas of this lesson.',
      'Explain how the concepts connect. Make it feel like a real lesson, not a list.',
      'Do NOT redefine any words — that was already done.',
      'Do NOT give worked examples yet — that comes next.',
      'Do NOT greet or introduce yourself. Begin speaking immediately.',
      'Do NOT ask any questions.',
      'Do NOT use numbered lists, bullet points, or any list formatting.',
      '',
      vocabContext ? `Vocabulary in this lesson (already defined; use naturally in your explanation):\n${vocabContext}` : '',
      '',
      sampleContext ? `Key facts this lesson must teach (use these to guide your explanation, do not read them aloud as Q&A):\n${sampleContext}` : '',
      '',
      teachingNotes ? `Teaching notes (internal; use to guide your tone and approach): ${teachingNotes}` : '',
      '',
      'Kid-friendly: Use simple everyday words. Keep sentences short (about 6–12 words). One idea per sentence.',
      'Always respond with natural spoken text only. No emojis, decorative characters, or symbols.',
    ].filter(Boolean).join('\n');

    const attemptFetch = async () => {
      return fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          input: '',
          lessonTopic: lessonTitle,
          context: { phase: 'teaching', step: 'lecture', lessonTitle },
          skipAudio: true,
        }),
      });
    };

    const delays = [0, 500, 1200];
    for (let i = 0; i < delays.length; i += 1) {
      if (delays[i]) await this.#sleep(delays[i]);
      try {
        const response = await attemptFetch();
        if (!response.ok) {
          const status = response.status;
          if (status === 429) {
            const retryAfterMs = this.#getRetryAfterMs(response);
            this.#lectureCooldownUntilMs = this.#getNowMs() + retryAfterMs;
            this.#lectureRateLimited = true;
            this.#lectureRetryPending = false;
            this.#emit('error', { type: 'gpt', stage: 'lecture', status, retryAfterMs });
            return [this.#buildRateLimitSentence(retryAfterMs)];
          }
          if (status >= 500 && i < delays.length - 1) continue;
          console.error(`[TeachingController] Lecture request failed with status ${status}`);
          this.#lectureRateLimited = false;
          this.#lectureRetryPending = true;
          this.#emit('error', { type: 'gpt', stage: 'lecture', status });
          break;
        }
        const data = await response.json().catch(() => null);
        const text = (data && (data.reply || data.text)) ? String(data.reply || data.text) : '';
        if (!text) {
          console.warn('[TeachingController] Empty GPT response for lecture, retrying');
          continue;
        }
        const sentences = this.#splitIntoSentences(text);
        console.log('[TeachingController] GPT lecture split into', sentences.length, 'sentences');
        this.#lectureRateLimited = false;
        this.#lectureRetryPending = false;
        return sentences;
      } catch (err) {
        if (i < delays.length - 1) continue;
        console.error('[TeachingController] GPT lecture error:', err);
        this.#lectureRateLimited = false;
        this.#lectureRetryPending = true;
      }
    }
    // No meaningful local fallback — skip to examples if lecture fails
    this.#lectureRateLimited = false;
    this.#lectureRetryPending = false;
    return [];
  }

  async #startLecture({ resumeState = null } = {}) {
    console.log('[TeachingController] #startLecture called');

    const resumeIntoLecture = resumeState?.stage === 'lecture';
    if (resumeIntoLecture && Array.isArray(resumeState.lectureSentences) && resumeState.lectureSentences.length) {
      this.#lectureSentences = resumeState.lectureSentences;
    }

    this.#stage = 'loading-lecture';
    this.#currentSentenceIndex = resumeIntoLecture ? Math.max(0, resumeState.sentenceIndex || 0) : 0;
    this.#isInSentenceMode = true;

    if (!resumeIntoLecture) {
      const introText = "Now let me teach you more about this.";
      let introAudio = ttsCache.get(introText);
      if (!introAudio) {
        introAudio = await fetchTTS(introText);
        if (introAudio) ttsCache.set(introText, introAudio);
      }
      await this.#audioEngine.playAudio(introAudio || '', [introText]);

      if (this.#stage !== 'loading-lecture') {
        console.log('[TeachingController] Stage changed during lecture intro (user skipped) - content already handled');
        return;
      }
    }

    await this.#ensureLectureLoaded();

    if (this.#lectureSentences.length === 0) {
      console.warn('[TeachingController] No lecture sentences generated, skipping to examples');
      await this.#startExamples();
      return;
    }

    this.#stage = 'lecture';
    this.#currentSentenceIndex = resumeIntoLecture
      ? Math.max(0, Math.min(resumeState.sentenceIndex || 0, this.#lectureSentences.length - 1))
      : 0;

    this.#emit('stageChange', { stage: 'lecture', totalSentences: this.#lectureSentences.length });
    this.#emitSnapshot('begin-teaching-lecture');
    await this.#playCurrentLecture();
  }

  async #playCurrentLecture() {
    const sentence = this.#lectureSentences[this.#currentSentenceIndex];
    if (!sentence) return;

    this.#setupAudioEndListener(() => {
      this.#emit('sentenceComplete', {
        stage: 'lecture',
        index: this.#currentSentenceIndex,
        total: this.#lectureSentences.length,
      });
    });

    let audioBase64 = ttsCache.get(sentence);
    if (!audioBase64) {
      audioBase64 = await fetchTTS(sentence);
      if (audioBase64) ttsCache.set(sentence, audioBase64);
    }

    const nextIndex = this.#currentSentenceIndex + 1;
    if (nextIndex < this.#lectureSentences.length) {
      ttsCache.prefetch(this.#lectureSentences[nextIndex]);
    }

    await this.#audioEngine.playAudio(audioBase64 || '', [sentence]);
  }

  #advanceLecture() {
    const nextIndex = this.#currentSentenceIndex + 1;

    if (nextIndex >= this.#lectureSentences.length) {
      // Lecture complete — move directly to examples
      this.#startExamples();
      return;
    }

    this.#currentSentenceIndex = nextIndex;
    this.#emit('sentenceAdvance', {
      stage: 'lecture',
      index: this.#currentSentenceIndex,
      total: this.#lectureSentences.length,
    });
    this.#emitSnapshot('teaching-lecture');
    this.#playCurrentLecture();
  }

  async #ensureLectureLoaded() {
    if (this.#lectureSentences.length > 0) return;

    if (this.#lectureGptPromise) {
      console.log('[TeachingController] Awaiting pending lecture GPT promise');
      this.#emit('loading', { stage: 'lecture' });
      try {
        this.#lectureSentences = await this.#lectureGptPromise;
        console.log('[TeachingController] Lecture loaded:', this.#lectureSentences.length, 'sentences');
      } finally {
        this.#lectureGptPromise = null;
      }
    } else {
      console.log('[TeachingController] No pending lecture promise, fetching now');
      this.#emit('loading', { stage: 'lecture' });
      this.#lectureSentences = await this.#fetchLectureFromGPT();
      console.log('[TeachingController] Lecture fetched:', this.#lectureSentences.length, 'sentences');
    }
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

    // 5. Prompt learner to use the question button
    const raiseHandText = 'Press the blue raised hand button to ask a question.';
    let raiseHandAudio = ttsCache.get(raiseHandText);
    if (!raiseHandAudio) {
      raiseHandAudio = await fetchTTS(raiseHandText);
      if (raiseHandAudio) ttsCache.set(raiseHandText, raiseHandAudio);
    }
    await this.#audioEngine.playAudio(raiseHandAudio || '', [raiseHandText]);
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
  
  // Private: Ensure concept is loaded (await pending promise if needed)
  async #ensureConceptLoaded() {
    if (this.#conceptSentences.length > 0) return;

    if (this.#conceptGptPromise) {
      console.log('[TeachingController] Awaiting pending concept GPT promise');
      this.#emit('loading', { stage: 'concept' });
      try {
        this.#conceptSentences = await this.#conceptGptPromise;
        console.log('[TeachingController] Concept loaded:', this.#conceptSentences.length, 'sentences');
      } finally {
        this.#conceptGptPromise = null;
      }
    } else {
      console.log('[TeachingController] No pending concept promise, fetching now');
      this.#emit('loading', { stage: 'concept' });
      this.#conceptSentences = await this.#fetchConceptFromGPT();
      console.log('[TeachingController] Concept fetched:', this.#conceptSentences.length, 'sentences');
    }
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
