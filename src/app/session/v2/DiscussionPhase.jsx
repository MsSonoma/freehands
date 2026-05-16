/**
 * DiscussionPhase.jsx (V3 – Webb-style Socratic Discussion)
 *
 * Discussion phase that replaces the old greeting-only + Teaching + Comprehension sequence.
 * Ms. Sonoma gives a brief overview with vocab, then conducts a Socratic objectives-driven
 * conversation until all learning goals are demonstrated, then advances to Exercise.
 *
 * Flow:
 *  1. start()            → fetch objectives → fetch overview text → play overview TTS
 *  2. overview TTS ends  → state: 'chatting' → emit greetingComplete (compat)
 *  3. submitMessage(txt) → check objectives → call /api/sonoma-discussion
 *                        → play reply TTS → if all met: emit discussionComplete
 *                        → else: state: 'chatting' (ready for next message)
 *  4. skip()             → stop audio → emit discussionComplete immediately
 *
 * Events emitted:
 *  greetingPlaying          { greetingText }                  – overview TTS starting (compat)
 *  greetingComplete         {}                                – entering chat state (compat)
 *  discussionStateChange    { state, completedObjectives, totalObjectives }
 *  discussionMessage        { role: 'user'|'assistant', text }
 *  discussionObjectiveComplete { completedCount, totalCount, newlyCompleted }
 *  discussionComplete       {}                                – all objectives met
 */

'use client';

import { fetchTTS } from './services';

const WEBB_OBJECTIVES_URL   = '/api/webb-objectives';
const SONOMA_DISCUSSION_URL = '/api/sonoma-discussion';

export class DiscussionPhase {
  // Private state
  #audioEngine    = null;
  #eventBus       = null;
  #learnerName    = '';
  #lessonTitle    = '';
  #lessonData     = null;
  #grade          = '';

  // 'idle' | 'loading-objectives' | 'playing-overview' | 'chatting' | 'awaiting-response' | 'complete'
  #state             = 'idle';
  #objectives        = [];
  #completedIndices  = [];
  #chatHistory       = [];   // { role: 'user'|'assistant', content: string }[]
  #audioEndListener  = null;
  #destroyed         = false;

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

  async start() {
    if (this.#state !== 'idle') return;
    this.#state = 'loading-objectives';
    this.#emitStateChange();

    // Step 1: Generate objectives from the lesson question bank
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

    if (this.#destroyed) return;

    // Step 2: Generate overview text via Ms. Sonoma API (with local fallback)
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

    if (this.#destroyed) return;

    // Step 3: Play overview TTS
    this.#state = 'playing-overview';
    this.#emitStateChange();

    this.#eventBus.emit('greetingPlaying', { greetingText: overviewText });

    // Add overview to chat history as the first assistant message
    this.#chatHistory.push({ role: 'assistant', content: overviewText });
    this.#eventBus.emit('discussionMessage', { role: 'assistant', text: overviewText });

    let overviewAudio = null;
    try {
      overviewAudio = await fetchTTS(overviewText);
    } catch (err) {
      console.warn('[DiscussionPhase] TTS fetch failed for overview:', err);
    }

    if (this.#destroyed) return;

    // On audio end → play vocab definitions, then enter chatting state
    this.#setupAudioEndListener(() => {
      if (this.#destroyed) return;
      this.#playVocabThenBeginChat();
    });

    try {
      await this.#audioEngine.playAudio(overviewAudio || '', [overviewText]);
    } catch (err) {
      console.warn('[DiscussionPhase] Audio playback error for overview:', err);
      // Recover: still play vocab then begin chat
      this.#removeAudioEndListener();
      if (!this.#destroyed) this.#playVocabThenBeginChat();
    }
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

  // After the overview TTS ends: speak each vocab term then open chat
  async #playVocabThenBeginChat() {
    const vocab = (this.#lessonData?.vocab || []).slice(0, 10);

    if (vocab.length > 0) {
      for (const { term, definition } of vocab) {
        if (this.#destroyed || this.#state === 'complete') break;
        const line = `${term}: ${definition}.`;
        this.#chatHistory.push({ role: 'assistant', content: line });
        this.#eventBus.emit('discussionMessage', { role: 'assistant', text: line });
        let audio = null;
        try { audio = await fetchTTS(line); } catch {}
        if (this.#destroyed || this.#state === 'complete') break;
        await this.#playAndWait(audio, [line]);
      }
    }

    if (this.#destroyed || this.#state === 'complete') return;
    this.#state = 'chatting';
    this.#emitStateChange();
    this.#eventBus.emit('greetingComplete', {});
  }

  // Play a TTS clip and wait for the audio engine's 'end' event before resolving
  #playAndWait(audio, sentences) {
    return new Promise((resolve) => {
      const handler = (data) => {
        if (data.completed || data.skipped) {
          this.#audioEngine.off('end', handler);
          resolve();
        }
      };
      this.#audioEngine.on('end', handler);
      this.#audioEngine.playAudio(audio || '', sentences).catch(() => {
        this.#audioEngine.off('end', handler);
        resolve();
      });
    });
  }

  #setupAudioEndListener(callback) {
    this.#removeAudioEndListener();
    this.#audioEndListener = (data) => {
      if (data.completed || data.skipped) {
        this.#removeAudioEndListener(); // one-shot: remove before callback to prevent re-entrancy
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
