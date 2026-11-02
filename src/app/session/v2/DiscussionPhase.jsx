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
import { splitSonomaDiscussionReply } from './splitSonomaDiscussionReply.mjs';
import { buildInstructionalLessonView } from '@/app/lib/masteryEvidence/assessmentIsolation.js';

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
  #objectiveClues    = [];
  #completedIndices  = [];
  #unacknowledgedObjectiveIndices = new Set();
  #chatHistory       = [];   // { role: 'user'|'assistant', content: string }[]
  #audioEndListener  = null;
  #destroyed         = false;
  #submitGen         = 0;     // incremented on each submitMessage; used to abort stale async chains
  #pendingReply      = null; // learner turn and mastery context retained until reply
  #replyCheckpoint   = null; // feedback -> Next -> question, restored across refresh
  #resumeReplyCheckpoint = null; // checkpoint restored after prefetch

  // Sentence-by-sentence playback
  #prefetchDone       = false;
  #playRequested      = false;
  #overviewSentences  = [];        // string[]
  #vocabItems         = [];        // { term, definition }[]
  #wordsReminderText  = '';
  #transitionText     = '';        // spoken after last vocab before chat opens
  #sentenceAudios     = new Map(); // key → base64 audio
  #currentSentenceKey = null;      // 'ov:N' | 'voc:N' | 'trans:0'
  #waitingForNext     = false;
  #resumeSentenceKey  = null;      // set from options when restoring mid-sentence

  constructor(options = {}) {
    this.#audioEngine = options.audioEngine;
    this.#eventBus    = options.eventBus;
    this.#learnerName = options.learnerName || 'friend';
    this.#lessonTitle = options.lessonTitle || 'this topic';
    this.#lessonData  = buildInstructionalLessonView(options.lessonData) || null;
    this.#grade       = options.grade       || '';
    this.openingGreetingAlreadyPlayed = Boolean(options.openingGreetingAlreadyPlayed);

    if (!this.#audioEngine) throw new Error('DiscussionPhase requires audioEngine');
    if (!this.#eventBus)    throw new Error('DiscussionPhase requires eventBus');

    // Resume: pre-populate chat history and completed indices so #startPlaying() skips the overview
    const resumeHistory = Array.isArray(options.resumeHistory) ? options.resumeHistory : [];
    if (resumeHistory.length > 0) {
      this.#chatHistory = resumeHistory.map(l => ({
        role:    l.role === 'user' ? 'user' : 'assistant',
        content: String(l.content || l.text || ''),
        ...(l.kind ? { kind: l.kind } : {}),
        ...(l.featureId ? { featureId: l.featureId } : {}),
      }));
      this.#completedIndices = Array.isArray(options.resumeCompletedIndices)
        ? [...options.resumeCompletedIndices]
        : [];
    }
    const pendingAwards = Array.isArray(options.resumePendingObjectiveAnnouncements)
      ? options.resumePendingObjectiveAnnouncements : [];
    this.#unacknowledgedObjectiveIndices = new Set(pendingAwards.map(row => row?.index).filter(Number.isInteger));
    const savedReply = options.resumeReplyCheckpoint;
    if (savedReply && ['feedback', 'awaiting-next', 'question', 'question-complete'].includes(savedReply.stage) &&
        typeof savedReply.feedback === 'string' && typeof savedReply.question === 'string') {
      this.#resumeReplyCheckpoint = { stage: savedReply.stage, feedback: savedReply.feedback, question: savedReply.question };
    }
    // Sentence-level resume: replay at the exact sentence that was playing on refresh
    if (typeof options.resumeSentenceKey === 'string' && options.resumeSentenceKey) {
      this.#resumeSentenceKey = options.resumeSentenceKey;
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  get state()               { return this.#state; }
  get completedObjectives() { return this.#completedIndices.length; }
  get totalObjectives()     { return this.#objectives.length; }
  get learnerName()         { return this.#learnerName; }
  get lessonTitle()         { return this.#lessonTitle; }
  get replyCheckpoint()     { return this.#replyCheckpoint ? { ...this.#replyCheckpoint } : null; }
  get activeReplySegmentText() {
    const reply = this.#replyCheckpoint;
    if (!reply) return '';
    return ['feedback', 'awaiting-next'].includes(reply.stage) ? reply.feedback : reply.question;
  }
  // Returns the active sentence key ONLY while playing overview/vocab (null during chat or other states)
  get currentSentenceKey()  {
    return (this.#state === 'playing-overview' || this.#state === 'playing-vocab')
      ? this.#currentSentenceKey
      : null;
  }

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

    // Inject hand-raise instruction right before the last overview sentence
    // (the last sentence is always the vocab transition, e.g. "First, let's go over some important terms.")
    const handRaise = 'If you have any questions, you can raise your hand by pressing the blue circle-shaped hand button.';
    if (this.#overviewSentences.length >= 2) {
      this.#overviewSentences.splice(this.#overviewSentences.length - 1, 0, handRaise);
    } else {
      this.#overviewSentences.push(handRaise);
    }

    this.#vocabItems = (this.#lessonData?.vocab || []).slice(0, 10);
    this.#wordsReminderText = 'Remember, you can always review these terms and get help understanding them with the "words" button.';
    this.#transitionText = `Do you have any questions? What do you already know about ${this.#lessonTitle}?`;

    // Prefetch all TTS audio in parallel
    const allItems = [
      ...this.#overviewSentences.map((t, i) => ({ key: `ov:${i}`, text: t })),
      ...this.#vocabItems.map((v, i) => ({ key: `voc:${i}`, text: `${v.term}: ${v.definition}.` })),
      ...(this.#vocabItems.length ? [{ key: 'rem:0', text: this.#wordsReminderText }] : []),
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
    // Guard: if start() was already called synchronously from within the 'ready' event handler
    // (e.g. auto-start on resume), #state is no longer 'ready' here — skip the redundant call.
    if (this.#playRequested && this.#state === 'ready') this.#startPlaying();
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

  acknowledgeObjectiveAward(index) {
    if (!this.#unacknowledgedObjectiveIndices.has(index)) return;
    this.#unacknowledgedObjectiveIndices.delete(index);
    if (this.#state === 'awaiting-objective-ack' && this.#unacknowledgedObjectiveIndices.size === 0) {
      this.#finishDiscussion();
    }
  }

  #finishDiscussion() {
    if (this.#destroyed || this.#state === 'complete') return;
    if (this.#unacknowledgedObjectiveIndices.size > 0) {
      this.#state = 'awaiting-objective-ack';
      this.#emitStateChange();
      return;
    }
    this.#state = 'complete';
    this.#emitStateChange();
    this.#eventBus.emit('discussionComplete', {});
  }

  nextReplyPart() {
    if (this.#destroyed || this.#unacknowledgedObjectiveIndices.size > 0 || this.#state !== 'awaiting-next' || !this.#replyCheckpoint?.question) return;
    const text = this.#replyCheckpoint.question;
    // Persist the transition before the question enters the visible transcript.
    this.#setReplyStage('question');
    this.#chatHistory.push({ role: 'assistant', content: text });
    this.#eventBus.emit('discussionMessage', { role: 'assistant', text });
    void this.#playReplyPart(text, this.#submitGen, 'question');
  }

  pauseForHelp() {
    if (!['playing-reply-feedback', 'playing-reply-question'].includes(this.#state)) return;
    const feedback = this.#state === 'playing-reply-feedback';
    this.#removeAudioEndListener();
    try { this.#audioEngine.stop(); } catch {}
    this.#setReplyStage(feedback ? 'awaiting-next' : 'question-complete');
    this.#state = feedback ? 'awaiting-next' : 'chatting';
    this.#emitStateChange();
    if (!feedback) this.#emitLearnerTurnReady('discussion');
  }

  async submitMessage(userText) {
    // Allow sending while Ms. Sonoma is speaking — stops TTS and starts new turn
    if (this.#unacknowledgedObjectiveIndices.size > 0) return;
    if (this.#state === 'awaiting-response') {
      try { this.#audioEngine.stop(); } catch {}
    } else if (this.#state !== 'chatting') {
      return;
    }

    const text = userText?.trim();
    if (!text) return;

    this.#removeAudioEndListener();
    try { this.#audioEngine.stop(); } catch {}
    this.#eventBus.emit('learnerTurnEnded', { phase: 'discussion', turnKind: 'discussion', reason: 'response' });

    // Bump generation — any in-flight async chain from a previous call will bail out
    const gen = ++this.#submitGen;
    this.#pendingReply = null;
    this.#replyCheckpoint = null;
    this.#eventBus.emit('discussionReplyStage', null);

    this.#state = 'awaiting-response';
    this.#emitStateChange();

    // Record user message
    this.#chatHistory.push({ role: 'user', content: text });
    this.#eventBus.emit('discussionMessage', { role: 'user', text });

    // Check objectives against recent conversation
    let newlyCompleted = [];
    let objectiveStatus = null;
    const objectiveCheckStartedAt = Date.now();
    if (this.#objectives.length > 0) {
      try {
        const res = await fetch(WEBB_OBJECTIVES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'check',
            objectives:       this.#objectives,
            completedIndices: this.#completedIndices,
            conversation:     this.#instructionalChatHistory(),
            lesson:           this.#lessonData,
            quick:            true,
          }),
        });
        if (gen !== this.#submitGen || this.#destroyed) return;
        if (res.ok) {
          const data = await res.json();
          // A help interruption, skip, or replacement turn can occur while JSON parses.
          // Never apply points if we would then drop the corresponding award event.
          if (gen !== this.#submitGen || this.#destroyed) return;
          if (Array.isArray(data.newlyCompleted) && data.newlyCompleted.length) {
            newlyCompleted = [...new Set(data.newlyCompleted.filter(index =>
              Number.isInteger(index) && index >= 0 && index < this.#objectives.length && !this.#completedIndices.includes(index)))];
            newlyCompleted.forEach(index => this.#unacknowledgedObjectiveIndices.add(index));
            this.#completedIndices = [...new Set([...this.#completedIndices, ...newlyCompleted])];
          }
          const firstRemainingIndex = this.#objectives.findIndex((_, i) => !this.#completedIndices.includes(i));
          if (firstRemainingIndex >= 0) objectiveStatus = data.evaluationStatus?.[firstRemainingIndex] || null;
        }
      } catch (err) {
        console.warn('[DiscussionPhase] Objective check failed:', err);
      }
    }

    if (gen !== this.#submitGen || this.#destroyed) return;
    if (this.#objectives.length > 0) {
      // Diagnostic: only evaluation latency and award count, never the learner response.
      console.info('[DiscussionPhase] objective evaluation finished', {
        durationMs: Date.now() - objectiveCheckStartedAt,
        newAwards: newlyCompleted.length,
      });
    }

    if (newlyCompleted.length > 0) {
      this.#eventBus.emit('discussionObjectiveComplete', {
        completedCount:  this.#completedIndices.length,
        completedIndices: [...this.#completedIndices],
        totalCount:      this.#objectives.length,
        newlyCompleted,
        objectiveText:   this.#objectives[newlyCompleted[0]] ?? null,
        objectives: [...this.#objectives],
      });
      // Announce the award before exposing updated counts to the UI.
      this.#emitStateChange();
    }

    const allMet = this.#objectives.length > 0 &&
      this.#completedIndices.length >= this.#objectives.length;

    const remainingObjectives = this.#objectives.filter((_, i) =>
      !this.#completedIndices.includes(i)
    );

    // Store the learner's turn and evaluated mastery once. Retrying the model
    // must not append another user utterance or run mastery checks again.
    this.#pendingReply = {
      request: {
        lesson: this.#lessonData,
        learnerName: this.#learnerName,
        messages: this.#instructionalChatHistory(),
        remainingObjectives,
        allObjectivesMet: allMet,
        objectiveStatus,
      },
      allMet,
    };
    await this.#deliverPendingReply(gen);
  }

  async retryReply() {
    if (this.#destroyed || this.#state !== 'reply-unavailable' || !this.#pendingReply) return;
    const gen = ++this.#submitGen;
    this.#state = 'awaiting-response';
    this.#emitStateChange();
    await this.#deliverPendingReply(gen);
  }

  #setReplyStage(stage) {
    if (this.#replyCheckpoint) this.#replyCheckpoint = { ...this.#replyCheckpoint, stage };
    this.#eventBus.emit('discussionReplyStage', this.replyCheckpoint);
  }

  async #playReplyPart(text, gen, part) {
    if (this.#destroyed || gen !== this.#submitGen) return;
    const playingState = part === 'feedback' ? 'playing-reply-feedback' : 'playing-reply-question';
    this.#setReplyStage(part);
    this.#state = playingState;
    this.#emitStateChange();
    let audio = null;
    try { audio = await fetchTTS(text); } catch (error) {
      console.warn('[DiscussionPhase] Split reply TTS unavailable:', error);
    }
    if (this.#destroyed || gen !== this.#submitGen || this.#state !== playingState) return;
    let finished = false;
    const finish = () => {
      if (finished || this.#destroyed || gen !== this.#submitGen || this.#state !== playingState) return;
      finished = true;
      this.#removeAudioEndListener();
      const isFeedback = part === 'feedback';
      this.#setReplyStage(isFeedback ? 'awaiting-next' : 'question-complete');
      this.#state = isFeedback ? 'awaiting-next' : 'chatting';
      this.#emitStateChange();
      if (!isFeedback) this.#emitLearnerTurnReady('discussion');
    };
    this.#setupAudioEndListener(finish);
    try { await this.#audioEngine.playAudio(audio || '', [text]); }
    catch (error) {
      console.warn('[DiscussionPhase] Split reply playback unavailable:', error);
      finish();
    }
  }

  async #deliverPendingReply(gen) {
    const pending = this.#pendingReply;
    if (!pending) return;
    let replyText = '';
    try {
      const res = await fetch(SONOMA_DISCUSSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.request),
      });
      if (gen !== this.#submitGen || this.#destroyed) return;
      if (res.ok) {
        const data = await res.json();
        replyText = typeof data?.text === 'string' ? data.text.trim() : '';
      } else {
        console.warn('[DiscussionPhase] Chat request unavailable:', res.status);
      }
    } catch (err) {
      console.warn('[DiscussionPhase] Chat request failed:', err?.name || 'unknown');
    }
    if (gen !== this.#submitGen || this.#destroyed) return;

    if (!replyText) {
      // An empty reply or API failure cannot masquerade as spoken teaching.
      // Keep the learner's original response and make the same request retryable.
      this.#state = 'reply-unavailable';
      this.#emitStateChange();
      return;
    }

    this.#pendingReply = null;
    const parts = pending.allMet ? null : splitSonomaDiscussionReply(replyText);
    if (parts) {
      this.#replyCheckpoint = { stage: 'feedback', feedback: parts.feedback, question: parts.question };
      this.#chatHistory.push({ role: 'assistant', content: parts.feedback });
      this.#eventBus.emit('discussionMessage', { role: 'assistant', text: parts.feedback });
      await this.#playReplyPart(parts.feedback, gen, 'feedback');
      return;
    }
    this.#replyCheckpoint = null;
    this.#eventBus.emit('discussionReplyStage', null);
    this.#chatHistory.push({ role: 'assistant', content: replyText });
    this.#eventBus.emit('discussionMessage', { role: 'assistant', text: replyText });

    let replyAudio = null;
    try {
      replyAudio = await fetchTTS(replyText);
    } catch (err) {
      console.warn('[DiscussionPhase] TTS fetch failed for reply:', err);
    }
    if (gen !== this.#submitGen || this.#destroyed) return;

    this.#setupAudioEndListener(() => {
      if (gen !== this.#submitGen || this.#destroyed) return;
      if (pending.allMet) {
        this.#finishDiscussion();
      } else {
        this.#state = 'chatting';
        this.#emitStateChange();
        this.#emitLearnerTurnReady('discussion');
      }
    });

    try {
      await this.#audioEngine.playAudio(replyAudio || '', [replyText]);
    } catch (err) {
      console.warn('[DiscussionPhase] Audio playback error for reply:', err);
      this.#removeAudioEndListener();
      if (gen !== this.#submitGen || this.#destroyed) return;
      if (pending.allMet) {
        this.#finishDiscussion();
      } else {
        this.#state = 'chatting';
        this.#emitStateChange();
        this.#emitLearnerTurnReady('discussion');
      }
    }
  }

  recordSyntheticExchange(userText, assistantText, { kind = 'product_help', featureId = null } = {}) {
    if (this.#destroyed) return
    const user = String(userText || '').trim()
    const assistant = String(assistantText || '').trim()
    if (!user || !assistant) return

    // A product-help turn belongs to conversational continuity, not mastery evidence.
    ++this.#submitGen
    this.#pendingReply = null
    try { this.#audioEngine.stop() } catch {}
    this.#removeAudioEndListener()
    this.#chatHistory.push({ role: 'user', content: user, kind, featureId })
    this.#eventBus.emit('discussionMessage', { role: 'user', text: user, kind, featureId })
    this.#chatHistory.push({ role: 'assistant', content: assistant, kind, featureId })
    this.#eventBus.emit('discussionMessage', { role: 'assistant', text: assistant, kind, featureId })
    const finalAwardPending = this.#objectives.length > 0 &&
      this.#completedIndices.length >= this.#objectives.length && this.#unacknowledgedObjectiveIndices.size > 0;
    this.#state = finalAwardPending ? 'awaiting-objective-ack' :
      this.#replyCheckpoint?.stage === 'awaiting-next' ? 'awaiting-next' : 'chatting'
    this.#emitStateChange()
  }

  skip() {
    if (this.#state === 'complete') return;
    ++this.#submitGen;
    this.#pendingReply = null;
    this.#replyCheckpoint = null;
    this.#eventBus.emit('discussionReplyStage', null);
    try { this.#audioEngine.stop(); } catch {}
    this.#removeAudioEndListener();
    this.#eventBus.emit('learnerTurnEnded', { phase: 'discussion', turnKind: 'discussion', reason: 'skip' });
    this.#finishDiscussion();
  }

  destroy() {
    this.#destroyed = true;
    ++this.#submitGen;
    this.#pendingReply = null;
    this.#removeAudioEndListener();
    this.#state = 'idle';
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  #instructionalChatHistory() {
    return this.#chatHistory
      .filter(m => m.kind !== 'product_help' && m.kind !== 'attention_reminder')
      .map(m => ({ role: m.role, content: m.content }));
  }

  #emitLearnerTurnReady(turnKind = 'discussion') {
    if (this.#destroyed || this.#state !== 'chatting') return;
    this.#eventBus.emit('learnerTurnReady', {
      phase: 'discussion',
      turnKind,
      questionIndex: null,
      itemId: null,
    });
  }

  #emitStateChange() {
    this.#eventBus.emit('discussionStateChange', {
      state:               this.#state,
      completedObjectives: this.#completedIndices.length,
      totalObjectives:     this.#objectives.length,
      objectives:          [...this.#objectives],
      objectiveClues:      [...this.#objectiveClues],
      completedIndices:    [...this.#completedIndices],
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
            this.#objectiveClues = Array.isArray(data.clues) && data.clues.length === data.objectives.length
              ? data.clues
              : data.objectives.map((_, index) => `Goal ${index + 1}`);
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
    if (this.openingGreetingAlreadyPlayed) {
      // The baseline already greeted the learner. Keep the lesson overview, not a second hello.
      overviewText = overviewText.replace(/^(?:hi|hello|hey|good morning|good afternoon)\b[^.!?]*[.!?]\s*/i, '').trim();
      if (!overviewText) overviewText = `Let's explore ${this.#lessonTitle} together!`;
    }
    return overviewText;
  }

  #startPlaying() {
    if (this.#destroyed) return;

    // Sentence-level resume: replay audio for the sentence that was active on refresh.
    // The transcript is already restored from snapshot, so we skip re-adding to history.
    if (this.#resumeSentenceKey) {
      const key = this.#resumeSentenceKey;
      this.#resumeSentenceKey = null;
      this.#currentSentenceKey = key;
      this.#state = (key.startsWith('voc:') || key === 'rem:0') ? 'playing-vocab' : 'playing-overview';
      this.#emitStateChange();
      this.#eventBus.emit('greetingPlaying', { greetingText: '' });
      this.#playSentence(key, { addToHistory: false });
      return;
    }

    // Restore a paused feedback/Next/question turn without asking the model again.
    if (this.#resumeReplyCheckpoint) {
      const saved = this.#resumeReplyCheckpoint;
      this.#resumeReplyCheckpoint = null;
      this.#replyCheckpoint = saved;
      this.#eventBus.emit('discussionReplyStage', this.replyCheckpoint);
      if (saved.stage === 'awaiting-next' || saved.stage === 'question-complete') {
        this.#state = saved.stage === 'awaiting-next' ? 'awaiting-next' : 'chatting';
        this.#emitStateChange();
        if (saved.stage === 'question-complete') this.#emitLearnerTurnReady('discussion-resume');
      } else {
        void this.#playReplyPart(saved.stage === 'feedback' ? saved.feedback : saved.question, this.#submitGen, saved.stage);
      }
      return;
    }
    // Chat-level resume: conversation history pre-loaded — skip the overview and re-enter chatting directly
    if (this.#chatHistory.length > 0) {
      const unansweredTurn = this.#chatHistory[this.#chatHistory.length - 1]?.role === 'user';
      if (unansweredTurn) {
        // Browser refresh before the model reply must retain the user's last
        // utterance and offer a retry rather than prompting a duplicate answer.
        const allMet = this.#objectives.length > 0 &&
          this.#completedIndices.length >= this.#objectives.length;
        this.#pendingReply = {
          request: {
            lesson: this.#lessonData,
            learnerName: this.#learnerName,
            messages: this.#instructionalChatHistory(),
            remainingObjectives: this.#objectives.filter((_, i) => !this.#completedIndices.includes(i)),
            allObjectivesMet: allMet,
            objectiveStatus: null,
          },
          allMet,
        };
      }
      const waitingForFinalAward = !unansweredTurn && this.#objectives.length > 0 &&
        this.#completedIndices.length >= this.#objectives.length && this.#unacknowledgedObjectiveIndices.size > 0;
      this.#state = unansweredTurn ? 'reply-unavailable' : waitingForFinalAward ? 'awaiting-objective-ack' : 'chatting';
      this.#emitStateChange();
      // Emit greetingPlaying so SessionPageV2 starts/validates the work timer
      this.#eventBus.emit('greetingPlaying', { greetingText: '' });
      this.#eventBus.emit('greetingComplete', {});
      if (unansweredTurn) this.#emitStateChange();
      else this.#emitLearnerTurnReady('discussion-resume');
      return;
    }

    if (this.#overviewSentences.length === 0) return;
    this.#currentSentenceKey = 'ov:0';
    this.#state = 'playing-overview';
    this.#emitStateChange();
    this.#eventBus.emit('greetingPlaying', { greetingText: this.#overviewSentences[0] });
    this.#playSentence('ov:0');
  }

  #playSentence(key, { addToHistory = true } = {}) {
    this.#waitingForNext = false;
    const { text } = this.#getSentenceForKey(key);
    if (addToHistory) {
      this.#chatHistory.push({ role: 'assistant', content: text });
      this.#eventBus.emit('discussionMessage', { role: 'assistant', text });
    }
    this.#emitSentenceChange(key);

    const audio = this.#sentenceAudios.get(key) || null;

    if (key === 'trans:0') {
      // Keep the input available immediately, but response pacing begins only
      // after the transition speech actually yields the floor.
      this.#state = 'chatting';
      this.#emitStateChange();
      this.#eventBus.emit('greetingComplete', {});
      this.#setupAudioEndListener(() => {
        if (!this.#destroyed && this.#state === 'chatting') this.#emitLearnerTurnReady('discussion');
      });
      this.#audioEngine.playAudio(audio || '', [text]).catch(() => {
        this.#removeAudioEndListener();
        if (!this.#destroyed && this.#state === 'chatting') this.#emitLearnerTurnReady('discussion');
      });
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
    if (key === 'rem:0') return 'trans:0';
    if (key.startsWith('ov:')) {
      const idx = parseInt(key.slice(3), 10);
      if (idx + 1 < this.#overviewSentences.length) return `ov:${idx + 1}`;
      if (this.#vocabItems.length > 0) return 'voc:0';
      return 'trans:0';
    } else {
      const idx = parseInt(key.slice(4), 10);
      if (idx + 1 < this.#vocabItems.length) return `voc:${idx + 1}`;
      return 'rem:0';
    }
  }

  #getSentenceForKey(key) {
    if (key === 'rem:0') return { type: 'words-reminder', index: 0, total: 1, text: this.#wordsReminderText };
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
