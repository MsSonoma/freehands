/**
 * DiscussionPhase.jsx (V4 – Webb-style Socratic Discussion + Sentence-by-Sentence Playback)
 *
 * Flow:
 *  1. prefetch()         → (called immediately on init) fetches objectives + overview text +
 *                          all TTS audio in parallel; state: prefetching → ready
 *  2. start()            → called when user clicks Begin; begins sentence-by-sentence playback
 *  3. overview sentences → one at a time; Repeat/Next buttons; state: playing-overview
 *  4. vocab items        → one at a time; Repeat/Next buttons; state: playing-vocab
 *  5. greetingComplete   → state: chatting
 *  6. submitMessage(txt) → Socratic objectives-driven conversation
 *  7. discussionComplete → all objectives met
 *
 * Events emitted:
 *  greetingPlaying          { greetingText }       – first sentence about to play
 *  greetingComplete         {}                     – all sentences done, entering chat
 *  discussionStateChange    { state, completedObjectives, totalObjectives }
 *  discussionMessage        { role, text }         – every sentence + chat turn
 *  discussionSentenceChange { type, index, total, text, waitingForNext } – sentence nav
 *  discussionObjectiveComplete { completedCount, totalCount, newlyCompleted }
 *  discussionComplete       {}                     – all objectives met
 */

'use client';

import { fetchTTS } from './services';

const WEBB_OBJECTIVES_URL   = '/api/webb-objectives';
const SONOMA_DISCUSSION_URL = '/api/sonoma-discussion';

// Split a paragraph into individual sentences for one-at-a-time playback
function splitSentences(text) {
  if (!text?.trim()) return [];
  return text.trim()
    .split(/(?<=[.!?])\s+(?=[A-Z"'\u2018\u201C])/)
    .map(s => s.trim())
    .filter(Boolean);
}

export class DiscussionPhase {
  // Private state
  #audioEngine    = null;
  #eventBus       = null;
  #learnerName    = '';
  #lessonTitle    = '';
  #lessonData     = null;
  #grade          = '';

  // 'idle'|'prefetching'|'ready'|'playing-overview'|'playing-vocab'|'chatting'|'awaiting-response'|'complete'
  #state             = 'idle';
  #objectives        = [];
  #completedIndices  = [];
  #chatHistory       = [];   // { role: 'user'|'assistant', content: string }[]
  #audioEndListener  = null;
  #destroyed         = false;

  // Sentence-by-sentence playback
  #prefetchDone       = false;
  #playRequested      = false;
  #overviewSentences  = [];        // string[]
  #vocabItems         = [];        // { term, definition }[]
  #transitionText     = '';        // spoken after last vocab before chat opens
  #sentenceAudios     = new Map(); // key → base64 audio
  #currentSentenceKey = null;      // 'ov:N' | 'voc:N' | 'trans:0'
  #waitingForNext     = false;

  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#eventBus    = options.eventBus;
    this.#learnerName = options.learnerName || 'friend';
    this.#lessonTitle = options.lessonTitle || 'this topic';
    this.#lessonData  = options.lessonData  || null;
    this.#grade       = options.grade       || '';

    if (!this.#audioEngine) throw new Error('DiscussionPhase requires audioEngine');
    if (!this.#eventBus)    throw new Error('DiscussionPhase requires eventBus');
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  get state()               { return this.#state; }
  get completedObjectives() { return this.#completedIndices.length; }
  get totalObjectives()     { return this.#objectives.length; }
  get learnerName()         { return this.#learnerName; }
  get lessonTitle()         { return this.#lessonTitle; }

  // ── Public API ─────────────────────────────────────────────────────────────

  // prefetch() — call immediately on phase setup to begin background loading
  async prefetch() {
    if (this.#state !== 'idle') return;
    this.#state = 'prefetching';
    this.#emitStateChange();

    // Fetch objectives + overview text in parallel
    const [, overviewText] = await Promise.all([
      this.#fetchObjectives(),
      this.#fetchOverviewText(),
    ]);

    if (this.#destroyed) return;

    // Split overview into sentences; build vocab list
    this.#overviewSentences = splitSentences(overviewText);
    if (this.#overviewSentences.length === 0) {
      this.#overviewSentences = [overviewText || `Hi ${this.#learnerName}, let's explore ${this.#lessonTitle}!`];
    }
    this.#vocabItems = (this.#lessonData?.vocab || []).slice(0, 10);
    this.#transitionText = `Do you have any questions? What do you already know about ${this.#lessonTitle}?`;

    // Prefetch all TTS audio in parallel
    const allItems = [
      ...this.#overviewSentences.map((t, i) => ({ key: `ov:${i}`, text: t })),
      ...this.#vocabItems.map((v, i) => ({ key: `voc:${i}`, text: `${v.term}: ${v.definition}.` })),
      { key: 'trans:0', text: this.#transitionText },
    ];
    await Promise.all(allItems.map(async ({ key, text }) => {
      if (this.#destroyed) return;
      try {
        const audio = await fetchTTS(text);
        this.#sentenceAudios.set(key, audio);
      } catch {}
    }));

    if (this.#destroyed) return;
    this.#prefetchDone = true;
    this.#state = 'ready';
    this.#emitStateChange();
    if (this.#playRequested) this.#startPlaying();
  }

  // start() — called when user clicks Begin
  start() {
    if (this.#state === 'complete' || this.#state === 'chatting') return;
    this.#playRequested = true;
    if (this.#prefetchDone && !this.#destroyed) this.#startPlaying();
    // else: prefetch() will call #startPlaying() when done
  }

  // nextSentence() — advance past the current overview/vocab sentence
  nextSentence() {
    if (this.#state !== 'playing-overview' && this.#state !== 'playing-vocab') return;
    try { this.#audioEngine.stop(); } catch {}
    this.#removeAudioEndListener();
    const nextKey = this.#getNextKey(this.#currentSentenceKey);
    if (!nextKey) {
      this.#state = 'chatting';
      this.#emitStateChange();
      this.#eventBus.emit('greetingComplete', {});
      return;
    }
    this.#currentSentenceKey = nextKey;
    this.#state = (nextKey.startsWith('voc:') || nextKey === 'trans:0') ? 'playing-vocab' : 'playing-overview';
    this.#emitStateChange();
    this.#playSentence(nextKey);
  }

  // repeatCurrentSentence() — replay the currently displayed sentence
  repeatCurrentSentence() {
    if (!this.#currentSentenceKey) return;
    if (this.#state !== 'playing-overview' && this.#state !== 'playing-vocab') return;
    try { this.#audioEngine.stop(); } catch {}
    this.#removeAudioEndListener();
    this.#playSentence(this.#currentSentenceKey);
  }

  async submitMessage(userText) {
    if (this.#state !== 'chatting') return;
    const text = userText?.trim();
    if (!text) return;

    this.#state = 'awaiting-response';
    this.#emitStateChange();

    // Record user message
    this.#chatHistory.push({ role: 'user', content: text });
    this.#eventBus.emit('discussionMessage', { role: 'user', text });

    // Check objectives against recent conversation
    let newlyCompleted = [];
    if (this.#objectives.length > 0) {
      try {
        const res = await fetch(WEBB_OBJECTIVES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'check',
            objectives:       this.#objectives,
            completedIndices: this.#completedIndices,
            conversation:     this.#chatHistory.map(m => ({ role: m.role, content: m.content })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.newlyCompleted) && data.newlyCompleted.length) {
            newlyCompleted = data.newlyCompleted;
            this.#completedIndices = [...this.#completedIndices, ...newlyCompleted];
          }
        }
      } catch (err) {
        console.warn('[DiscussionPhase] Objective check failed:', err);
      }
    }

    if (this.#destroyed) return;

    if (newlyCompleted.length > 0) {
      this.#eventBus.emit('discussionObjectiveComplete', {
        completedCount: this.#completedIndices.length,
        totalCount:     this.#objectives.length,
        newlyCompleted,
      });
    }

    const allMet = this.#objectives.length > 0 &&
      this.#completedIndices.length >= this.#objectives.length;

    const remainingObjectives = this.#objectives.filter((_, i) =>
      !this.#completedIndices.includes(i)
    );

    // Get Ms. Sonoma's reply
    let replyText = '';
    try {
      const res = await fetch(SONOMA_DISCUSSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson:              this.#lessonData,
          learnerName:         this.#learnerName,
          messages:            this.#chatHistory.map(m => ({ role: m.role, content: m.content })),
          remainingObjectives,
          allObjectivesMet:    allMet,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        replyText = data.text || '';
      }
    } catch (err) {
      console.warn('[DiscussionPhase] Chat API error:', err);
    }

    if (this.#destroyed) return;

    // Fallback reply
    if (!replyText) {
      replyText = allMet
        ? `Excellent work, ${this.#learnerName}! You've mastered this lesson. Time for the Exercise!`
        : `Great thinking! Can you tell me more about what you've learned?`;
    }

    // Record and emit assistant reply
    this.#chatHistory.push({ role: 'assistant', content: replyText });
    this.#eventBus.emit('discussionMessage', { role: 'assistant', text: replyText });

    // Fetch and play reply TTS
    let replyAudio = null;
    try {
      replyAudio = await fetchTTS(replyText);
    } catch (err) {
      console.warn('[DiscussionPhase] TTS fetch failed for reply:', err);
    }

    if (this.#destroyed) return;

    this.#setupAudioEndListener(() => {
      if (this.#destroyed) return;
      if (allMet) {
        this.#state = 'complete';
        this.#emitStateChange();
        this.#eventBus.emit('discussionComplete', {});
      } else {
        this.#state = 'chatting';
        this.#emitStateChange();
      }
    });

    try {
      await this.#audioEngine.playAudio(replyAudio || '', [replyText]);
    } catch (err) {
      console.warn('[DiscussionPhase] Audio playback error for reply:', err);
      this.#removeAudioEndListener();
      if (!this.#destroyed) {
        if (allMet) {
          this.#state = 'complete';
          this.#emitStateChange();
          this.#eventBus.emit('discussionComplete', {});
        } else {
          this.#state = 'chatting';
          this.#emitStateChange();
        }
      }
    }
  }

  skip() {
    if (this.#state === 'complete') return;
    try { this.#audioEngine.stop(); } catch {}
    this.#removeAudioEndListener();
    this.#state = 'complete';
    this.#emitStateChange();
    this.#eventBus.emit('discussionComplete', {});
  }

  destroy() {
    this.#destroyed = true;
    this.#removeAudioEndListener();
    this.#state = 'idle';
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  #emitStateChange() {
    this.#eventBus.emit('discussionStateChange', {
      state:               this.#state,
      completedObjectives: this.#completedIndices.length,
      totalObjectives:     this.#objectives.length,
    });
  }

  async #fetchObjectives() {
    try {
      if (this.#lessonData) {
        const res = await fetch(WEBB_OBJECTIVES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate', lesson: this.#lessonData }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.objectives) && data.objectives.length) {
            this.#objectives = data.objectives;
          }
        }
      }
    } catch (err) {
      console.warn('[DiscussionPhase] Failed to generate objectives:', err);
    }
  }

  async #fetchOverviewText() {
    let overviewText = `Hi ${this.#learnerName}, let's explore ${this.#lessonTitle} together!`;
    try {
      const vocab = this.#lessonData?.vocab || [];
      const res = await fetch(SONOMA_DISCUSSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'overview',
          lesson:      this.#lessonData,
          vocab,
          learnerName: this.#learnerName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) overviewText = data.text;
      }
    } catch (err) {
      console.warn('[DiscussionPhase] Failed to fetch overview:', err);
    }
    return overviewText;
  }

  #startPlaying() {
    if (this.#destroyed || this.#overviewSentences.length === 0) return;
    this.#currentSentenceKey = 'ov:0';
    this.#state = 'playing-overview';
    this.#emitStateChange();
    this.#eventBus.emit('greetingPlaying', { greetingText: this.#overviewSentences[0] });
    this.#playSentence('ov:0');
  }

  #playSentence(key) {
    this.#waitingForNext = false;
    const { text } = this.#getSentenceForKey(key);
    this.#chatHistory.push({ role: 'assistant', content: text });
    this.#eventBus.emit('discussionMessage', { role: 'assistant', text });
    this.#emitSentenceChange(key);

    const audio = this.#sentenceAudios.get(key) || null;

    if (key === 'trans:0') {
      // Open the chat input immediately — don't wait for audio to finish.
      // The TTS plays in the background; if the user submits before it ends,
      // the reply audio will naturally take over.
      this.#state = 'chatting';
      this.#emitStateChange();
      this.#eventBus.emit('greetingComplete', {});
      this.#audioEngine.playAudio(audio || '', [text]).catch(() => {});
      return;
    }

    this.#setupAudioEndListener(() => {
      if (this.#destroyed) return;
      this.#waitingForNext = true;
      this.#emitSentenceChange(key);
    });
    this.#audioEngine.playAudio(audio || '', [text]).catch(() => {
      this.#removeAudioEndListener();
      if (!this.#destroyed) { this.#waitingForNext = true; this.#emitSentenceChange(key); }
    });
  }

  #getNextKey(key) {
    if (!key) return null;
    if (key === 'trans:0') return null;
    if (key.startsWith('ov:')) {
      const idx = parseInt(key.slice(3), 10);
      if (idx + 1 < this.#overviewSentences.length) return `ov:${idx + 1}`;
      if (this.#vocabItems.length > 0) return 'voc:0';
      return 'trans:0';
    } else {
      const idx = parseInt(key.slice(4), 10);
      if (idx + 1 < this.#vocabItems.length) return `voc:${idx + 1}`;
      return 'trans:0';
    }
  }

  #getSentenceForKey(key) {
    if (key === 'trans:0') {
      return { type: 'transition', index: 0, total: 1, text: this.#transitionText };
    }
    if (key.startsWith('ov:')) {
      const idx = parseInt(key.slice(3), 10);
      return { type: 'overview', index: idx, total: this.#overviewSentences.length, text: this.#overviewSentences[idx] || '' };
    } else {
      const idx = parseInt(key.slice(4), 10);
      const item = this.#vocabItems[idx] || {};
      return { type: 'vocab', index: idx, total: this.#vocabItems.length, text: `${item.term}: ${item.definition}.` };
    }
  }

  #emitSentenceChange(key) {
    const info = this.#getSentenceForKey(key);
    this.#eventBus.emit('discussionSentenceChange', { ...info, waitingForNext: this.#waitingForNext });
  }

  #setupAudioEndListener(callback) {
    this.#removeAudioEndListener();
    this.#audioEndListener = (data) => {
      if (data.completed || data.skipped) {
        this.#removeAudioEndListener(); // one-shot
        callback();
      }
    };
    this.#audioEngine.on('end', this.#audioEndListener);
  }

  #removeAudioEndListener() {
    if (this.#audioEndListener) {
      try { this.#audioEngine.off('end', this.#audioEndListener); } catch {}
      this.#audioEndListener = null;
    }
  }
}
