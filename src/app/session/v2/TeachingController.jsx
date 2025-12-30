/**
 * TeachingController - Manages two-stage teaching flow
 * 
 * Consumes AudioEngine for playback via events (no direct state coupling).
 * Owns teaching stage machine: idle → definitions → examples → complete
 * 
 * Architecture:
 * - Loads lesson vocab and examples
 * - Breaks into sentences
 * - Sentence-by-sentence navigation with gate controls
 * - Fetches TTS audio for each sentence
 * - Emits events: stageChange, sentenceAdvance, teachingComplete
 * - Zero knowledge of phase transitions or snapshot persistence
 * 
 * Usage:
 *   const controller = new TeachingController({ audioEngine, lessonData });
 *   controller.on('teachingComplete', () => transitionToComprehension());
 *   controller.on('stageChange', (stage) => updateUI(stage));
 *   await controller.startTeaching();
 */

import { fetchTTS } from './services';

export class TeachingController {
  // Private state
  #audioEngine = null;
  #lessonData = null;
  
  #stage = 'idle'; // 'idle' | 'definitions' | 'examples' | 'complete'
  #vocabSentences = [];
  #exampleSentences = [];
  #currentSentenceIndex = 0;
  #isInSentenceMode = true; // Sentence nav vs final gate
  
  #listeners = new Map();
  #audioEndListener = null;
  
  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#lessonData = options.lessonData;
    
    if (!this.#audioEngine) {
      throw new Error('TeachingController requires audioEngine');
    }
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
  async startTeaching() {
    if (!this.#lessonData) {
      throw new Error('No lesson data provided');
    }
    
    // Extract vocab and examples from lesson
    this.#extractContent();
    
    if (this.#vocabSentences.length === 0) {
      console.warn('[TeachingController] No vocab found, skipping to examples');
      await this.#startExamples();
      return;
    }
    
    // Start definitions stage
    await this.#startDefinitions();
  }
  
  // Public API: Sentence navigation
  nextSentence() {
    if (this.#stage === 'definitions') {
      this.#advanceDefinition();
    } else if (this.#stage === 'examples') {
      this.#advanceExample();
    }
  }
  
  repeatSentence() {
    if (this.#stage === 'definitions') {
      this.#playCurrentDefinition();
    } else if (this.#stage === 'examples') {
      this.#playCurrentExample();
    }
  }
  
  skipToExamples() {
    if (this.#stage === 'definitions') {
      this.#startExamples();
    }
  }
  
  restartStage() {
    if (this.#stage === 'definitions') {
      this.#currentSentenceIndex = 0;
      this.#isInSentenceMode = true;
      this.#playCurrentDefinition();
    } else if (this.#stage === 'examples') {
      this.#currentSentenceIndex = 0;
      this.#isInSentenceMode = true;
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
  
  // Private: Content extraction
  #extractContent() {
    const vocab = this.#lessonData?.vocab || [];
    const examples = this.#lessonData?.examples || this.#lessonData?.example || [];
    
    // Extract definitions
    if (Array.isArray(vocab)) {
      const definitions = vocab
        .map(v => {
          if (typeof v === 'string') return v;
          if (v?.term && v?.definition) {
            return `${v.term}: ${v.definition}`;
          }
          return null;
        })
        .filter(Boolean);
      
      this.#vocabSentences = this.#splitIntoSentences(definitions.join(' '));
    }
    
    // Extract examples
    if (Array.isArray(examples)) {
      const exampleText = examples
        .map(e => {
          if (typeof e === 'string') return e;
          if (e?.text) return e.text;
          if (e?.example) return e.example;
          return null;
        })
        .filter(Boolean)
        .join(' ');
      
      this.#exampleSentences = this.#splitIntoSentences(exampleText);
    } else if (typeof examples === 'string') {
      this.#exampleSentences = this.#splitIntoSentences(examples);
    }
  }
  
  #splitIntoSentences(text) {
    if (!text) return [];
    
    // Split on sentence boundaries
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    return sentences;
  }
  
  // Private: Definitions stage
  async #startDefinitions() {
    this.#stage = 'definitions';
    this.#currentSentenceIndex = 0;
    this.#isInSentenceMode = true;
    
    this.#emit('stageChange', {
      stage: 'definitions',
      totalSentences: this.#vocabSentences.length
    });
    
    await this.#playCurrentDefinition();
  }
  
  async #playCurrentDefinition() {
    const sentence = this.#vocabSentences[this.#currentSentenceIndex];
    if (!sentence) return;
    
    // Listen for audio end to enable gate controls
    this.#setupAudioEndListener(() => {
      this.#emit('sentenceComplete', {
        stage: 'definitions',
        index: this.#currentSentenceIndex,
        total: this.#vocabSentences.length
      });
    });
    
    // Fetch TTS audio
    const audioBase64 = await fetchTTS(sentence);
    
    // Play through AudioEngine (falls back to synthetic if TTS fails)
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
      this.#emit('finalGateReached', {
        stage: 'definitions'
      });
      return;
    }
    
    this.#currentSentenceIndex = nextIndex;
    this.#emit('sentenceAdvance', {
      stage: 'definitions',
      index: this.#currentSentenceIndex,
      total: this.#vocabSentences.length
    });
    
    this.#playCurrentDefinition();
  }
  
  // Private: Examples stage
  async #startExamples() {
    if (this.#exampleSentences.length === 0) {
      // No examples - teaching complete
      this.#completeTeaching();
      return;
    }
    
    this.#stage = 'examples';
    this.#currentSentenceIndex = 0;
    this.#isInSentenceMode = true;
    
    this.#emit('stageChange', {
      stage: 'examples',
      totalSentences: this.#exampleSentences.length
    });
    
    await this.#playCurrentExample();
  }
  
  async #playCurrentExample() {
    const sentence = this.#exampleSentences[this.#currentSentenceIndex];
    if (!sentence) return;
    
    // Listen for audio end
    this.#setupAudioEndListener(() => {
      this.#emit('sentenceComplete', {
        stage: 'examples',
        index: this.#currentSentenceIndex,
        total: this.#exampleSentences.length
      });
    });
    
    // Fetch TTS audio
    const audioBase64 = await fetchTTS(sentence);
    
    // Play through AudioEngine (falls back to synthetic if TTS fails)
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
      this.#emit('finalGateReached', {
        stage: 'examples'
      });
      return;
    }
    
    this.#currentSentenceIndex = nextIndex;
    this.#emit('sentenceAdvance', {
      stage: 'examples',
      index: this.#currentSentenceIndex,
      total: this.#exampleSentences.length
    });
    
    this.#playCurrentExample();
  }
  
  // Private: Completion
  #completeTeaching() {
    this.#stage = 'complete';
    
    // Remove audio listener
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#emit('teachingComplete', {
      vocabCount: this.#vocabSentences.length,
      exampleCount: this.#exampleSentences.length
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
