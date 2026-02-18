# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Bug: Refreshing during work portion resumes play timer at 0:00; should resume work timer. Trace V2 timer restore path, SnapshotService, TimerService.restoreState, currentTimerMode initialization, sessionStorage timer keys session_timer_state:*; identify overwrite.
```

Filter terms used:
```text
TimerService.restoreState
session_timer_state
SnapshotService
TimerService
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

TimerService.restoreState session_timer_state SnapshotService TimerService

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (1acbfb95b03f45d82fb055d262841ca9e8d970d8894c71e130acec69c2a30df9)
- bm25: -18.1245 | entity_overlap_w: 4.00 | adjusted: -19.1245 | relevance: 1.0000

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { getLearner, updateLearner } from '@/app/facilitator/learners/clientApi';
import { subscribeLearnerSettingsPatches } from '@/app/lib/learnerSettingsBus';
import { loadPhaseTimersForLearner } from '../utils/phaseTimerDefaults';
import SessionTimer from '../components/SessionTimer';
import { AudioEngine } from './AudioEngine';
import { TeachingController } from './TeachingController';
import { ComprehensionPhase } from './ComprehensionPhase';
import { ExercisePhase } from './ExercisePhase';
import { WorksheetPhase } from './WorksheetPhase';
import { TestPhase } from './TestPhase';
import { ClosingPhase } from './ClosingPhase';
import { DiscussionPhase } from './DiscussionPhase';
import { PhaseOrchestrator } from './PhaseOrchestrator';
import { SnapshotService } from './SnapshotService';
import { TimerService } from './TimerService';
import { KeyboardService } from './KeyboardService';
import { OpeningActionsController } from './OpeningActionsController';
import PlayTimeExpiredOverlay from './PlayTimeExpiredOverlay';
import FullscreenPlayTimerOverlay from './FullscreenPlayTimerOverlay';
import TimerControlOverlay from '../components/TimerControlOverlay';
import GamesOverlay from '../components/games/GamesOverlay';
import EventBus from './EventBus';
import { loadLesson, fetchTTS } from './services';
import { formatMcOptions, isMultipleChoice, isTrueFalse, formatQuestionForSpeech, ensureQuestionMark } from '../utils/questionFormatting';
import { getSnapshotStorageKey } from '../utils

### 2. src/app/session/v2/SessionPageV2.jsx (b4571a43828d791b7d7ec7f305119d4beb102d5b0dcbd0fcdae772a9558fa324)
- bm25: -18.0000 | entity_overlap_w: 4.00 | adjusted: -19.0000 | relevance: 1.0000

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { getLearner, updateLearner } from '@/app/facilitator/learners/clientApi';
import { subscribeLearnerSettingsPatches } from '@/app/lib/learnerSettingsBus';
import { loadPhaseTimersForLearner } from '../utils/phaseTimerDefaults';
import SessionTimer from '../components/SessionTimer';
import { AudioEngine } from './AudioEngine';
import { TeachingController } from './TeachingController';
import { ComprehensionPhase } from './ComprehensionPhase';
import { ExercisePhase } from './ExercisePhase';
import { WorksheetPhase } from './WorksheetPhase';
import { TestPhase } from './TestPhase';
import { ClosingPhase } from './ClosingPhase';
import { DiscussionPhase } from './DiscussionPhase';
import { PhaseOrchestrator } from './PhaseOrchestrator';
import { SnapshotService } from './SnapshotService';
import { TimerService } from './TimerService';
import { KeyboardService } from './KeyboardService';
import { OpeningActionsController } from './OpeningActionsController';
import PlayTimeExpiredOverlay from './PlayTimeExpiredOverlay';
import FullscreenPlayTimerOverlay from './FullscreenPlayTimerOverlay';
import TimerControlOverlay from '../components/TimerControlOverlay';
import GamesOverlay from '../components/games/GamesOverlay';
import EventBus from './EventBus';
import { loadLesson, fetchTTS } from './services';
import { formatMcOptions, isMultipleChoice, isTrueFalse, formatQuestionForSpeech, ensureQuestionMark } from '../utils/questionFormatting';
import { getSnapshotStorageKey } from '../utils

### 3. src/app/session/v2/TimerService.jsx (08ebf227d7a302865d2cf4c2db9b5cbdea54ab05b1d4c0b392bfc17aa9d843b8)
- bm25: -17.2750 | entity_overlap_w: 2.00 | adjusted: -17.7750 | relevance: 1.0000

#timerOverlayKeyPrefix() {
    if (!this.lessonKey) return null;
    return `session_timer_state:${this.lessonKey}:`;
  }

#removeTimerOverlayKey(phase, mode) {
    if (typeof window === 'undefined') return;
    if (!this.lessonKey || !phase || !mode) return;
    const key = `session_timer_state:${this.lessonKey}:${phase}:${mode}`;
    try { sessionStorage.removeItem(key); } catch {}
  }

#removeTimerOverlayKeysForPhase(phase) {
    this.#removeTimerOverlayKey(phase, 'play');
    this.#removeTimerOverlayKey(phase, 'work');
  }

#clearAllTimerOverlayKeysForLesson() {
    if (typeof window === 'undefined') return;
    const prefix = this.#timerOverlayKeyPrefix();
    if (!prefix) return;

### 4. src/app/session/v2/SessionPageV2.jsx (7509c74f103b8009803fa80c5e520a1927ec9bb6f4967b176918800709b4946b)
- bm25: -17.1155 | entity_overlap_w: 2.00 | adjusted: -17.6155 | relevance: 1.0000

const timer = new TimerService(eventBus, {
      lessonKey,
      playTimerLimits,
      workPhaseTimeLimits,
      goldenKeysEnabled: goldenKeysEnabledRef.current
    });

timerServiceRef.current = timer;

// Apply any snapshot-restored timer state once timer exists
    if (pendingTimerStateRef.current) {
      try { timer.restoreState(pendingTimerStateRef.current); } catch {}
      pendingTimerStateRef.current = null;
    }

return () => {
      try { unsubWorkTick?.(); } catch {}
      try { unsubWorkComplete?.(); } catch {}
      try { unsubGoldenKey?.(); } catch {}
      try { unsubPlayExpired?.(); } catch {}
      try { unsubPlayTick?.(); } catch {}
      try { unsubWorkTick2?.(); } catch {}
      try { unsubPlayStart?.(); } catch {}
      try { unsubWorkStart?.(); } catch {}
      timer.destroy();
      timerServiceRef.current = null;
    };
  }, [lessonKey, phaseTimers]);

// Update play timer limits when bonus/enabled state changes (do not recreate TimerService).
  useEffect(() => {
    if (!timerServiceRef.current || !phaseTimers) return;

const playBonusSec = goldenKeysEnabledRef.current
      ? Math.max(0, Number(goldenKeyBonusRef.current || 0)) * 60
      : 0;
    const m2s = (m) => Math.max(0, Number(m || 0)) * 60;

### 5. src/app/session/v2/TimerService.jsx (33da9448db6921a56abe4f886efd649d4a1628fbc40aaab6a94b431355a9efa9)
- bm25: -17.2624 | entity_overlap_w: 1.00 | adjusted: -17.5124 | relevance: 1.0000

// Keep the overlay/sessionStorage totalMinutes aligned.
        if (this.lessonKey) {
          const storageKey = `session_timer_state:${this.lessonKey}:${phase}:play`;
          try {
            sessionStorage.setItem(storageKey, JSON.stringify({
              elapsedSeconds: timer.elapsed,
              startTime: timer.startTime,
              totalMinutes: Math.ceil(timer.timeLimit / 60),
              pausedAt: null
            }));
          } catch {}
        }
      }
    } catch {}
  }

### 6. src/app/session/v2/TimerService.jsx (5e33b92ca4198dfabfeeb87611e8ec41d32fdb0d050cfda4c6055d1343d6aea7)
- bm25: -17.2624 | entity_overlap_w: 1.00 | adjusted: -17.5124 | relevance: 1.0000

// Mirror to sessionStorage for SessionTimer/overlay display.
      if (this.lessonKey) {
        const storageKey = `session_timer_state:${this.lessonKey}:${phase}:play`;
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({
            elapsedSeconds: timer.elapsed,
            startTime: timer.startTime,
            totalMinutes: Math.ceil(timer.timeLimit / 60),
            pausedAt: null
          }));
        } catch {}
      }

### 7. src/app/session/v2/TimerService.jsx (c317ca8081f1a40e57179ce3dcae6a4fdf308aac26f0d73251ca2acf93fcd019)
- bm25: -13.4481 | entity_overlap_w: 4.00 | adjusted: -14.4481 | relevance: 1.0000

try {
      const toRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(prefix)) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) {
        try { sessionStorage.removeItem(k); } catch {}
      }
    } catch {}
  }
  
  /**
   * Start session timer
   */
  startSessionTimer() {
    console.log('[TimerService] startSessionTimer called');
    if (this.sessionInterval) {
      console.warn('[TimerService] Session timer already running');
      return;
    }
    
    this.sessionStartTime = Date.now();
    this.sessionElapsed = 0;
    
    console.log('[TimerService] Emitting sessionTimerStart');
    this.eventBus.emit('sessionTimerStart', {
      timestamp: this.sessionStartTime
    });
    
    // Tick every second
    this.sessionInterval = setInterval(this.#tickSessionTimer.bind(this), 1000);
    console.log('[TimerService] Timer interval started');
  }
  
  /**
   * Stop session timer
   */
  stopSessionTimer() {
    if (!this.sessionInterval) {
      return;
    }
    
    clearInterval(this.sessionInterval);
    this.sessionInterval = null;
    
    const elapsed = this.sessionElapsed;
    const formatted = this.#formatTime(elapsed);
    
    this.eventBus.emit('sessionTimerStop', {
      elapsed,
      formatted
    });
  }
  
  /**
   * Starts the play timer for a phase (phases 2-5 only).
   * Play timers allow exploration/opening actions with a time limit.
   * When expired, transitions to work mode via PlayTimeExpiredOverlay.
   * 
   * @param {string} phase - Phase name ('comprehension', 'exercise', 'worksheet', 'test')
   * @param {number} [timeLimit] - Optional time limit override (seconds)
   */
  startPlayTimer(phase, timeLimit = null) {

### 8. src/app/session/v2/TimerService.jsx (ec57a83cf0e04550a623e4d9e105aabc4abc2b970c06655cbb9940b2ba5e6cf6)
- bm25: -13.2210 | relevance: 1.0000

// Per-learner feature gate: when disabled, golden key eligibility is not tracked/emitted.
    this.goldenKeysEnabled = options.goldenKeysEnabled !== false;
    
    // Pause state
    this.isPaused = false;
    this.pausedPlayElapsed = null; // Stores elapsed time when play timer paused
    this.pausedWorkElapsed = null; // Stores elapsed time when work timer paused
    
    // SessionStorage cache for refresh recovery (not used - use explicit restoreState instead)
    this.lessonKey = options.lessonKey || null;
    this.phase = options.phase || null;
    this.mode = 'play'; // play or work
    
    // Don't auto-restore from sessionStorage - only restore explicitly via restoreState()
    // this prevents stale timer data from previous lessons leaking into new sessions
    
    // Bind public methods
    this.startSessionTimer = this.startSessionTimer.bind(this);
    this.stopSessionTimer = this.stopSessionTimer.bind(this);
    this.startPlayTimer = this.startPlayTimer.bind(this);
    this.stopPlayTimer = this.stopPlayTimer.bind(this);
    this.transitionToWork = this.transitionToWork.bind(this);
    this.startWorkPhaseTimer = this.startWorkPhaseTimer.bind(this);
    this.completeWorkPhaseTimer = this.completeWorkPhaseTimer.bind(this);
    this.stopWorkPhaseTimer = this.stopWorkPhaseTimer.bind(this);
    this.reset = this.reset.bind(this);
    this.setGoldenKeysEnabled = this.setGoldenKeysEnabled.bind(this);
    this.setPlayTimerLimits = this.setPlayTimerLimits.bind(this);
    this.pause = this.pause.bind(this);
    this.resume = this.resume.bind(this);
    this.resync = this.resync.bind(this);
    // Private methods are automatically bound
  }

### 9. src/app/session/v2/SessionPageV2.jsx (25e9c10b76fc1d12c063fe1dff92befa769bab57bed8423c9a79d1d88321d0dc)
- bm25: -12.7319 | entity_overlap_w: 1.00 | adjusted: -12.9819 | relevance: 1.0000

if (snapshot.timerState) {
            if (timerServiceRef.current) {
              try { timerServiceRef.current.restoreState(snapshot.timerState); } catch {}
            } else {
              pendingTimerStateRef.current = snapshot.timerState;
            }
          }
        } else {
          resetTranscriptState();
          addEvent('💾 No snapshot found - Starting fresh');
        }
      }).catch(err => {
        if (cancelled) return;
        console.error('[SessionPageV2] Snapshot init error:', err);
        setError('Unable to load saved progress for this lesson.');
      }).finally(() => {
        if (!cancelled) {
          setSnapshotLoaded(true);
        }
      });
    } catch (err) {
      console.error('[SessionPageV2] Snapshot service construction failed:', err);
      setError('Unable to initialize persistence for this lesson.');
      setSnapshotLoaded(true);
    }

return () => {
      cancelled = true;
      snapshotServiceRef.current = null;
    };
  }, [lessonData, learnerProfile, browserSessionId, lessonKey, resetTranscriptState]);
  
  // Initialize TimerService
  useEffect(() => {
    if (!eventBusRef.current || !lessonKey || !phaseTimers) return;

const eventBus = eventBusRef.current;

// Convert minutes -> seconds; golden key bonus applies to play timers only (and only when Golden Keys are enabled).
    const playBonusSec = goldenKeysEnabledRef.current
      ? Math.max(0, Number(goldenKeyBonusRef.current || 0)) * 60
      : 0;
    const m2s = (m) => Math.max(0, Number(m || 0)) * 60;

### 10. src/app/session/v2/TimerService.jsx (5bff737b19ddcafa1fcac2d20cb0da1e95cf1c5f918fd1170e0f387b07c24021)
- bm25: -11.4796 | entity_overlap_w: 1.00 | adjusted: -11.7296 | relevance: 1.0000

const remaining = Math.max(0, timer.timeLimit - timer.elapsed);
      this.eventBus.emit('playTimerTick', {
        phase,
        elapsed: timer.elapsed,
        remaining,
        formatted: this.#formatTime(timer.elapsed),
        remainingFormatted: this.#formatTime(remaining)
      });
      return;
    }

if (mode === 'work') {
      const validPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
      if (!validPhases.includes(phase)) return;

const existing = this.workPhaseTimers.get(phase);
      const timeLimit = existing?.timeLimit ?? this.workPhaseTimeLimits?.[phase] ?? 600;

const timer = {
        startTime,
        elapsed: asNumber,
        timeLimit,
        completed: false,
        onTime: asNumber <= timeLimit
      };

this.workPhaseTimers.set(phase, timer);
      this.currentWorkPhase = phase;
      this.mode = 'work';

// Only start interval if not paused
      if (!this.isPaused && !this.workPhaseInterval) {
        this.workPhaseInterval = setInterval(this.#tickWorkPhaseTimers.bind(this), 1000);
      }
      
      // If paused, update the paused elapsed time
      if (this.isPaused) {
        this.pausedWorkElapsed = asNumber;
      }

if (this.lessonKey) {
        const storageKey = `session_timer_state:${this.lessonKey}:${phase}:work`;
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({
            elapsedSeconds: timer.elapsed,
            startTime: timer.startTime,
            totalMinutes: Math.ceil(timer.timeLimit / 60),
            pausedAt: null
          }));
        } catch {}
      }

### 11. src/app/session/v2/TimerService.jsx (4cf9313019f135c3a75b47bad95de212b857a0ad12f88fc0239f42a52332e9c2)
- bm25: -11.4831 | relevance: 1.0000

// Prefer explicit currentWorkPhase if provided.
      const explicitWork = data.currentWorkPhase;
      const candidateWork = (explicitWork && this.workPhaseTimers.has(explicitWork)) ? explicitWork : inferredActiveWorkPhase;
      if (this.mode === 'work' && candidateWork) {
        const t = this.workPhaseTimers.get(candidateWork);
        if (t && !t.completed) {
          t.startTime = Date.now() - ((Number(t.elapsed) || 0) * 1000);
          this.currentWorkPhase = candidateWork;
          if (!this.isPaused && !this.workPhaseInterval) {
            this.workPhaseInterval = setInterval(this.#tickWorkPhaseTimers.bind(this), 1000);
          }
        }
      }
    }
  }
  
  /**
   * Restore state from snapshot (alias for restore)
   * @param {Object} data - Serialized state
   */
  restoreState(data) {
    this.restore(data);
  }
  
  /**
   * Tick session timer
   * @private
   */
  #tickSessionTimer() {
    if (!this.sessionStartTime) return;
    
    const now = Date.now();
    this.sessionElapsed = Math.floor((now - this.sessionStartTime) / 1000);
    
    this.eventBus.emit('sessionTimerTick', {
      elapsed: this.sessionElapsed,
      formatted: this.#formatTime(this.sessionElapsed)
    });
  }
  
  /**
   * Tick play timers
   * @private
   */
  #tickPlayTimers() {
    if (this.isPaused) return;
    if (!this.currentPlayPhase) return;
    
    const timer = this.playTimers.get(this.currentPlayPhase);
    if (!timer || timer.expired) return;
    
    const now = Date.now();
    timer.elapsed = Math.floor((now - timer.startTime) / 1000);
    const remaining = Math.max(0, timer.timeLimit - timer.elapsed);
    
    // Write to sessionStorage for TimerControlOverlay compatibility (skip when paused)
    if (!this.isPaused && this.lessonKey && this.currentPlayPhas

### 12. src/app/session/v2/TimerService.jsx (573f7049f395c2d9ada63681aec8d1c2d25e5f58a4e19049d938d2728bec80b2)
- bm25: -11.1946 | relevance: 1.0000

const remaining = Math.max(0, timer.timeLimit - timer.elapsed);
      this.eventBus.emit('workPhaseTimerTick', {
        phase,
        elapsed: timer.elapsed,
        remaining,
        timeLimit: timer.timeLimit,
        onTime: timer.onTime,
        formatted: this.#formatTime(timer.elapsed),
        remainingFormatted: this.#formatTime(remaining)
      });
    }
  }

### 13. src/app/session/v2/TimerService.jsx (24f23d460a79fa93d3ef523fde272d97dcb1754020e6a22c5ba07d49add970bf)
- bm25: -10.3400 | entity_overlap_w: 1.00 | adjusted: -10.5900 | relevance: 1.0000

export class TimerService {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    
    // Session timer
    this.sessionStartTime = null;
    this.sessionElapsed = 0; // seconds
    this.sessionInterval = null;
    
    // Play timers (phases 2-5: comprehension, exercise, worksheet, test)
    this.playTimers = new Map(); // phase -> { startTime, elapsed, timeLimit, expired }
    this.playTimerInterval = null;
    this.currentPlayPhase = null;
    
    // Play timer time limits (seconds) - default 3 minutes per phase
    this.playTimerLimits = options.playTimerLimits || {
      comprehension: 180, // 3 minutes
      exercise: 180,      // 3 minutes  
      worksheet: 180,     // 3 minutes
      test: 180           // 3 minutes
    };
    
    // Work phase timers
    this.workPhaseTimers = new Map(); // phase -> { startTime, elapsed, timeLimit, completed }
    this.workPhaseInterval = null;
    this.currentWorkPhase = null;
    
    // Work phase time limits (seconds) - all phases have work timers
    this.workPhaseTimeLimits = options.workPhaseTimeLimits || {
      discussion: 300,    // 5 minutes
      comprehension: 180, // 3 minutes
      exercise: 180,      // 3 minutes
      worksheet: 300,     // 5 minutes
      test: 600           // 10 minutes
    };
    
    // Golden key tracking (only counts comprehension, exercise, worksheet, test)
    this.onTimeCompletions = 0;
    this.goldenKeyAwarded = false;

### 14. src/app/session/v2/TimerService.jsx (d66ce18026cb7dc6c0b5c052d71c86a7e1616f2b34c0c0ece99430bd12337c2e)
- bm25: -10.3161 | entity_overlap_w: 1.00 | adjusted: -10.5661 | relevance: 1.0000

if (this.currentPlayPhase) {
          const t = this.playTimers.get(this.currentPlayPhase);
          if (t && !t.expired && !this.playTimerInterval) {
            this.playTimerInterval = setInterval(this.#tickPlayTimers.bind(this), 1000);
          }
        }

if (this.currentWorkPhase) {
          const t = this.workPhaseTimers.get(this.currentWorkPhase);
          if (t && !t.completed && !this.workPhaseInterval) {
            this.workPhaseInterval = setInterval(this.#tickWorkPhaseTimers.bind(this), 1000);
          }
        }
      }

// Emit a catch-up tick immediately.
      this.#tickSessionTimer();
      this.#tickPlayTimers();
      this.#tickWorkPhaseTimers();
    } catch (err) {
      console.warn('[TimerService] resync failed:', reason, err);
    }
  }

setGoldenKeysEnabled(enabled) {
    this.goldenKeysEnabled = enabled !== false;
  }

setPlayTimerLimits(limits) {
    if (!limits || typeof limits !== 'object') return;
    this.playTimerLimits = { ...this.playTimerLimits, ...limits };

// If a play timer is already running, update its limit so bonus changes
    // (e.g., Golden Key) apply immediately to the active countdown.
    try {
      for (const [phase, nextLimit] of Object.entries(limits)) {
        const timer = this.playTimers.get(phase);
        if (!timer) continue;
        const parsed = Number(nextLimit);
        if (!Number.isFinite(parsed) || parsed <= 0) continue;
        timer.timeLimit = parsed;

### 15. src/app/session/v2/TimerService.jsx (7a0df748471f99a2c90557a539afb09427db838e53933a396d389e12b7a8d309)
- bm25: -9.8599 | relevance: 1.0000

/**
   * Best-effort recovery hook for browsers that may suspend JS timers (notably iOS Safari).
   *
   * This does NOT change timer semantics; it simply ensures intervals are armed and emits
   * an immediate tick so UI can catch up after visibility/focus changes.
   */
  resync(reason = 'manual') {
    try {
      if (!this.isPaused) {
        if (this.sessionStartTime && !this.sessionInterval) {
          this.sessionInterval = setInterval(this.#tickSessionTimer.bind(this), 1000);
        }

### 16. src/app/session/v2/TimerService.jsx (969f7a14cf9f3699f5b53bc29667946197fe2d0b7b8e41098b39fc1bade48638)
- bm25: -9.4836 | entity_overlap_w: 1.00 | adjusted: -9.7336 | relevance: 1.0000

/**
 * TimerService.jsx
 * Manages session, play, and work phase timers
 * 
 * Timers:
 * - Session timer: Tracks total session duration from start to complete
 * - Play timers: Green timer for exploration/opening actions (phases 2-5: Comprehension, Exercise, Worksheet, Test)
 * - Work phase timers: Amber/red timer for focused work (for golden key)
 * 
 * Timer Modes:
 * - Phase 1 (Discussion): No play timer, no opening actions (eliminates play timer exploit)
 * - Phases 2-5 (Comprehension, Exercise, Worksheet, Test): Play timer → opening actions → work timer
 * 
 * Golden Key Requirements:
 * - Need 3 work phases completed within time limit
 * - Work phases: exercise, worksheet, test
 * - Time limits defined per grade/subject
 * 
 * Events emitted:
 * - sessionTimerStart: { timestamp } - Session timer started
 * - sessionTimerTick: { elapsed, formatted } - Every second while running
 * - sessionTimerStop: { elapsed, formatted } - Session timer stopped
 * - playTimerStart: { phase, timestamp, timeLimit } - Play timer started
 * - playTimerTick: { phase, elapsed, remaining, formatted } - Every second during play time
 * - playTimerExpired: { phase } - Play timer reached 0:00
 * - workPhaseTimerStart: { phase, timestamp } - Work phase timer started
 * - workPhaseTimerTick: { phase, elapsed, remaining, onTime } - Every second during work time
 * - workPhaseTimerComplete: { phase, elapsed, onTime } - Work phase completed
 * - workPhaseTimerStop: { phase, elapsed } - Work phase stopped
 * - goldenKeyEligible: { completedPhases } - 3 on-time work phases achieved
 */

'use client';

### 17. src/app/session/page.js (3da2ad087a8caa48fccd3f6eaf8fd61c2bd1e1ee23974b58d73c3537f1dd37cc)
- bm25: -8.4191 | entity_overlap_w: 3.00 | adjusted: -9.1691 | relevance: 1.0000

// Clear timer state for completed lesson
      try {
        // Clean up old timer format (transitional)
        const storageKey = lessonKey ? `session_timer_state:${lessonKey}` : 'session_timer_state';
        sessionStorage.removeItem(storageKey);
        
        // Clean up new phase-based timer states
        const phases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
        const timerTypes = ['play', 'work'];
        phases.forEach(phase => {
          timerTypes.forEach(timerType => {
            const newStorageKey = `session_timer_state:${lessonKey}:${phase}:${timerType}`;
            sessionStorage.removeItem(newStorageKey);
          });
        });
      } catch {}

### 18. src/app/session/v2/TimerService.jsx (e96859bf0fb88311bec25cde6b209f1abcba5383fb2bb8e43df4df3e935acaff)
- bm25: -9.0967 | relevance: 1.0000

// Prefer explicit currentPlayPhase if provided.
      if (data.currentPlayPhase && this.playTimers.has(data.currentPlayPhase)) {
        this.currentPlayPhase = data.currentPlayPhase;
      }
    }
    
    // Restore work phase timers
    if (data.workPhaseTimers) {
      this.workPhaseTimers.clear();
      
      let inferredActiveWorkPhase = null;
      data.workPhaseTimers.forEach(timer => {
        this.workPhaseTimers.set(timer.phase, {
          startTime: null,
          elapsed: timer.elapsed,
          timeLimit: timer.timeLimit,
          completed: !!timer.completed,
          onTime: typeof timer.onTime === 'boolean' ? timer.onTime : (timer.elapsed <= timer.timeLimit)
        });
        // Heuristic: the most recently inserted incomplete timer is likely the active one.
        if (!timer.completed) {
          inferredActiveWorkPhase = timer.phase;
        }
      });

### 19. src/app/session/v2/TimerService.jsx (8b6b5b40a6468f4aa6ad5e9dddfa8efe7447e7cc736a8e77292215692a341335)
- bm25: -8.8796 | relevance: 1.0000

/**
   * Reset all timers and clear per-phase sessionStorage mirrors.
   * Use for "Start Over" and lesson restarts without a full page refresh.
   */
  reset() {
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }
    if (this.playTimerInterval) {
      clearInterval(this.playTimerInterval);
      this.playTimerInterval = null;
    }
    if (this.workPhaseInterval) {
      clearInterval(this.workPhaseInterval);
      this.workPhaseInterval = null;
    }

this.sessionStartTime = null;
    this.sessionElapsed = 0;

this.playTimers.clear();
    this.currentPlayPhase = null;

this.workPhaseTimers.clear();
    this.currentWorkPhase = null;

this.onTimeCompletions = 0;
    this.goldenKeyAwarded = false;
    this.mode = 'play';
    
    this.isPaused = false;
    this.pausedPlayElapsed = null;
    this.pausedWorkElapsed = null;

### 20. src/app/session/v2/SessionPageV2.jsx (d7cdcdb017fed338f4fa2c7679c9f493400d2a56528209b2b701a376672c949c)
- bm25: -7.9793 | entity_overlap_w: 2.00 | adjusted: -8.4793 | relevance: 1.0000

loadStored();
    return () => { cancelled = true; };
  }, [lessonKey, learnerProfile]);
  
  // Initialize shared EventBus (must be first)
  useEffect(() => {
    eventBusRef.current = new EventBus();
    
    return () => {
      if (eventBusRef.current) {
        eventBusRef.current.clear();
        eventBusRef.current = null;
      }
    };
  }, []);
  
  // Initialize SnapshotService after lesson loads
  useEffect(() => {
    if (!lessonData || !learnerProfile || !browserSessionId || !lessonKey) return;

let cancelled = false;
    setSnapshotLoaded(false);

const sessionId = browserSessionId;
    const learnerId = learnerProfile.id;

const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

try {
      const service = new SnapshotService({
        sessionId,
        learnerId,
        lessonKey,
        supabaseClient: supabase
      });

snapshotServiceRef.current = service;

service.initialize().then(snapshot => {
        if (cancelled) return;
        if (snapshot) {
          const normalizedResumePhase = deriveResumePhaseFromSnapshot(snapshot);
          const resumePhaseName = normalizedResumePhase || snapshot.currentPhase || null;

if (normalizedResumePhase && snapshot.currentPhase && normalizedResumePhase !== snapshot.currentPhase) {
            addEvent(`Loaded snapshot - resume normalized to ${normalizedResumePhase} (was ${snapshot.currentPhase})`);
          } else {
            addEvent(`💾 Loaded snapshot - Resume from: ${resumePhaseName || 'idle'}`);
          }

setResumePhase(resumePhaseName);
          resumePhaseRef.current = resumePhaseName;

const isBeginningPhase = !resumePhaseName || resumePhaseName === 'idle' || resumePhaseName === 'discussion';

### 21. src/app/session/v2/SessionPageV2.jsx (0122d324a321082c0eb02d8689712c57c483b654e2f099cb64addba2b8ef6bd4)
- bm25: -7.7675 | relevance: 1.0000

// Persist question order immediately so mid-phase resume has deterministic pools.
    if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('comprehension-init', {
        phaseOverride: 'comprehension',
        questions,
        nextQuestionIndex: forceFresh ? 0 : (savedComp?.nextQuestionIndex || 0),
        score: forceFresh ? 0 : (savedComp?.score || 0),
        answers: forceFresh ? [] : (savedComp?.answers || []),
        timerMode: forceFresh ? 'play' : (savedComp?.timerMode || 'play')
      });
    }
    if (!savedCompQuestions && !storedCompQuestions) {
      setGeneratedComprehension(questions);
      persistAssessments(generatedWorksheet || [], generatedTest || [], questions, generatedExercise || []);
    }
    
    const phase = new ComprehensionPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: (!forceFresh && savedComp) ? {
        questions,
        nextQuestionIndex: savedComp.nextQuestionIndex ?? savedComp.questionIndex ?? 0,
        score: savedComp.score || 0,
        answers: savedComp.answers || [],
        timerMode: savedComp.timerMode || 'work'
      } : null
    });
    
    comprehensionPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setComprehensionState(data.state);
      if (data.timerMode) {
        setComprehensionTimerMode(data.timerMode);
      }
      if (data.state === 'awaiting-answer') {
        addEvent('â“ Waiting for answer...');
      }
    });

### 22. src/app/session/v2/SessionPageV2.jsx (b730b1906065629b54a04b4dfd05e1327e4764d53a084a3b3b34c59b8d657826)
- bm25: -7.4813 | entity_overlap_w: 1.00 | adjusted: -7.7313 | relevance: 1.0000

// Session tracking (lesson_sessions + lesson_session_events)
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  const [conflictingSession, setConflictingSession] = useState(null);
  const {
    startSession: startTrackedSession,
    endSession: endTrackedSession,
    startPolling: startSessionPolling,
    stopPolling: stopSessionPolling,
  } = useSessionTracking(
    learnerProfile?.id || null,
    goldenKeyLessonKey || null,
    false,
    (session) => {
      setConflictingSession(session);
      setShowTakeoverDialog(true);
    }
  );
  
  // Phase timer state (loaded from learner profile)
  const [phaseTimers, setPhaseTimers] = useState(null);
  const [currentTimerMode, setCurrentTimerMode] = useState({
    discussion: null,
    comprehension: null,
    exercise: null,
    worksheet: null,
    test: null
  });
  const [timerRefreshKey, setTimerRefreshKey] = useState(0);
  const [goldenKeyBonus, setGoldenKeyBonus] = useState(0);
  const [hasGoldenKey, setHasGoldenKey] = useState(false);
  const [isGoldenKeySuspended, setIsGoldenKeySuspended] = useState(false);
  const goldenKeyBonusRef = useRef(0);
  const hasGoldenKeyRef = useRef(false);
  const goldenKeyLessonKeyRef = useRef('');
  const [timerPaused, setTimerPaused] = useState(false);
  
  // Timer display state (fed by TimerService events) - separate for play and work
  const [playTimerDisplayElapsed, setPlayTimerDisplayElapsed] = useState(0);
  const [playTimerDisplayRemaining, setPlayTimerDisplayRemaining] = useState(0);
  const [workTimerDisplayElapsed, setWorkTimerDisplayElapsed] = useState(0);
  const [workTimerDisplayRemaining, setWorkTimerDisplayRemaining] = useState(0);

### 23. src/app/session/v2/SessionPageV2.jsx (cfa10dfd3d233c3f359645820bac6fecf1064c1fef5de0d17ea8ffbaba7238d1)
- bm25: -7.6087 | relevance: 1.0000

if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('exercise-init', {
        phaseOverride: 'exercise',
        questions,
        nextQuestionIndex: forceFresh ? 0 : (savedExercise?.nextQuestionIndex ?? savedExercise?.questionIndex ?? 0),
        score: forceFresh ? 0 : (savedExercise?.score || 0),
        answers: forceFresh ? [] : (savedExercise?.answers || []),
        timerMode: forceFresh ? 'play' : (savedExercise?.timerMode || 'play')
      });
    }
    if (!savedExerciseQuestions && !storedExerciseQuestions) {
      setGeneratedExercise(questions);
      persistAssessments(generatedWorksheet || [], generatedTest || [], generatedComprehension || [], questions);
    }
    
    const phase = new ExercisePhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: (!forceFresh && savedExercise) ? {
        questions,
        nextQuestionIndex: savedExercise.nextQuestionIndex ?? savedExercise.questionIndex ?? 0,
        score: savedExercise.score || 0,
        answers: savedExercise.answers || [],
        timerMode: savedExercise.timerMode || 'work'
      } : null
    });
    
    exercisePhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setExerciseState(data.state);
      if (data.timerMode) {
        setExerciseTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to question events
    phase.on('questionStart', (data) => {
      addEvent(`ðŸ“ Question ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentExerciseQuestion(data.question);
      setExerciseTotalQuestions(data.totalQuestions);
    });
    
    phase.on('questionReady',

### 24. src/app/session/v2/SessionPageV2.jsx (768d77566c8cb27fc1dbbadee041c7bbce6057d280bc293b5c9071fe3889dcf2)
- bm25: -7.4563 | relevance: 1.0000

if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('worksheet-init', {
        phaseOverride: 'worksheet',
        questions,
        nextQuestionIndex: forceFresh ? 0 : (savedWorksheet?.nextQuestionIndex ?? savedWorksheet?.questionIndex ?? 0),
        score: forceFresh ? 0 : (savedWorksheet?.score || 0),
        answers: forceFresh ? [] : (savedWorksheet?.answers || []),
        timerMode: forceFresh ? 'play' : (savedWorksheet?.timerMode || 'play')
      });
    }
    
    const phase = new WorksheetPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: (!forceFresh && savedWorksheet) ? {
        questions,
        nextQuestionIndex: savedWorksheet.nextQuestionIndex ?? savedWorksheet.questionIndex ?? 0,
        score: savedWorksheet.score || 0,
        answers: savedWorksheet.answers || [],
        timerMode: savedWorksheet.timerMode || 'work'
      } : null
    });
    
    worksheetPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setWorksheetState(data.state);
      if (data.timerMode) {
        setWorksheetTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to question events
    phase.on('questionStart', (data) => {
      addEvent(`ðŸ“ Worksheet ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentWorksheetQuestion(data.question);
      setWorksheetTotalQuestions(data.totalQuestions);
      setLastWorksheetFeedback(null);
    });
    
    phase.on('questionReady', (data) => {
      setWorksheetState('awaiting-answer');
      addEvent('â“ Fill in the blank...');
    });
    
    phase.on('answerSubmitted', (data) => {

### 25. src/app/session/v2/TimerService.jsx (513f5ed5db5b319f6fa117acf63ff78870e686502ea6ef611cac5998ef7f2ca1)
- bm25: -7.3580 | relevance: 1.0000

// Clear TimerControlOverlay sessionStorage mirror for this phase.
    this.#removeTimerOverlayKey(phase, 'work');
    
    // Track on-time completions for golden key (comprehension, exercise, worksheet, test count)
    const goldenKeyPhases = ['comprehension', 'exercise', 'worksheet', 'test'];
    if (this.goldenKeysEnabled && onTime && goldenKeyPhases.includes(phase)) {
      this.onTimeCompletions++;
      
      // Check golden key eligibility (3 on-time work phases from comp/exercise/worksheet/test)
      if (this.onTimeCompletions >= 3 && !this.goldenKeyAwarded) {
        this.goldenKeyAwarded = true;
        this.eventBus.emit('goldenKeyEligible', {
          eligible: true,
          completedPhases: Array.from(this.workPhaseTimers.keys())
            .filter(p => goldenKeyPhases.includes(p) && this.workPhaseTimers.get(p).onTime)
        });
      }
    }
    
    this.currentWorkPhase = null;
  }
  
  /**
   * Stop work phase timer without completing
   * @param {string} phase - Phase name
   */
  stopWorkPhaseTimer(phase) {
    const timer = this.workPhaseTimers.get(phase);
    
    if (!timer) {
      return;
    }
    
    const elapsed = timer.elapsed;
    
    this.eventBus.emit('workPhaseTimerStop', {
      phase,
      elapsed,
      formatted: this.#formatTime(elapsed)
    });

this.#removeTimerOverlayKey(phase, 'work');
    this.workPhaseTimers.delete(phase);
    if (this.currentWorkPhase === phase) {
      this.currentWorkPhase = null;
    }
  }

### 26. src/app/session/v2/SessionPageV2.jsx (c0e8f2522b1585717ae102a7aeb411bf1a36901b89e80696dc6dc479c5bd5a15)
- bm25: -7.0557 | entity_overlap_w: 1.00 | adjusted: -7.3057 | relevance: 1.0000

// If games opens, close fullscreen timer to avoid overlay stacking
  useEffect(() => {
    if (showGames && showFullscreenPlayTimer) {
      setShowFullscreenPlayTimer(false);
    }
  }, [showGames, showFullscreenPlayTimer]);

// Handle timer click (for facilitator controls)
  const handleTimerClick = useCallback(async () => {
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timer');
    } catch (e) {
      console.warn('[SessionPageV2] Timer PIN gate error:', e);
    }
    if (!allowed) return;

console.log('[SessionPageV2] Timer clicked - showing timer control overlay');
    setShowTimerControl(true);
  }, []);
  
  // Handle timer pause toggle
  const handleTimerPauseToggle = useCallback(async () => {
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timer');
    } catch (e) {
      console.warn('[SessionPageV2] Timer PIN gate error:', e);
    }
    if (!allowed) return;

setTimerPaused(prev => {
      const nextPaused = !prev;
      
      // Control the authoritative timer in TimerService
      const timerSvc = timerServiceRef.current;
      if (timerSvc) {
        if (nextPaused) {
          timerSvc.pause();
        } else {
          timerSvc.resume();
        }
      }
      
      return nextPaused;
    });
  }, []);

const persistTimerStateNow = useCallback((trigger) => {
    try {
      const svc = snapshotServiceRef.current;
      const timerSvc = timerServiceRef.current;
      if (!svc || !timerSvc) return;
      svc.saveProgress(trigger || 'timer-overlay', {
        timerState: timerSvc.getState()
      });
    } catch (err) {
      console.warn('[SessionPageV2] Timer snapshot persist failed:', err);
    }
  }, []);

### 27. src/app/session/page.js (3b449fb02287fcb5809de66130c398dc62e3d78abf5d75df31988e976b9f2794)
- bm25: -6.7932 | entity_overlap_w: 2.00 | adjusted: -7.2932 | relevance: 1.0000

// Compute remaining minutes for a work timer from sessionStorage
  const getWorkTimerRemainingMinutes = useCallback((phaseName) => {
    if (!phaseName) return null;
    try {
      const storageKey = lessonKey 
        ? `session_timer_state:${lessonKey}:${phaseName}:work`
        : `session_timer_state:${phaseName}:work`;
      const timerState = sessionStorage.getItem(storageKey);
      if (!timerState) return null;
      const state = JSON.parse(timerState);
      const elapsedSeconds = Number(state.elapsedSeconds || 0);
      const key = `${String(phaseName).toLowerCase()}_work_min`;
      const totalMinutesFromTimers = (phaseTimers && typeof phaseTimers[key] === 'number') ? phaseTimers[key] : null;
      const totalMinutes = (typeof totalMinutesFromTimers === 'number' && totalMinutesFromTimers > 0)
        ? totalMinutesFromTimers
        : getCurrentPhaseTimerDuration(phaseName, 'work');
      const totalSeconds = Math.max(0, totalMinutes * 60);
      const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
      return remainingSeconds / 60;
    } catch {
      return null;
    }
  }, [lessonKey, phaseTimers, getCurrentPhaseTimerDuration]);

### 28. src/app/session/v2/SessionPageV2.jsx (0102390a91adc9d0c71bbe8548c79151ff202cb8d36f5747d329e1938eb5dbda)
- bm25: -7.0114 | relevance: 1.0000

const phase = new TestPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: savedTest ? {
        questions,
        nextQuestionIndex: restoreNextIndex,
        score: savedTest.score || 0,
        answers: restoreAnswers,
        timerMode: savedTest.timerMode || 'work',
        reviewIndex: restoreReviewIndex
      } : null
    });
    
    testPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setTestState(data.state);
      if (data.timerMode) {
        setTestTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to test events
    phase.on('questionStart', (data) => {
      addEvent(`ðŸ“ Test Question ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentTestQuestion(data.question);
      setTestTotalQuestions(data.totalQuestions);
      setTestAnswer('');
    });
    
    phase.on('questionReady', (data) => {
      setTestState('awaiting-answer');
      addEvent('â“ Answer the test question...');
    });
    
    phase.on('answerSubmitted', (data) => {
      const result = data.isCorrect ? 'âœ… Correct!' : 'âŒ Incorrect';
      addEvent(`${result} (Score: ${data.score}/${data.totalQuestions})`);
      setTestScore(data.score);
      setTestAnswer('');
    });
    
    phase.on('questionSkipped', (data) => {
      addEvent(`â­ï¸ Skipped (Score: ${data.score}/${data.totalQuestions})`);
      setTestAnswer('');
    });
    
    phase.on('testQuestionsComplete', (data) => {
      console.log('[SessionPageV2] testQuestionsComplete event received:', data);
      addEvent(`ðŸ“Š Test questions done! Score: ${data.score}/${data.totalQuestions} (${data.percenta

### 29. src/app/session/v2/TimerService.jsx (b6d0a5a4c8b2c8f9192600f2761b1deff6c14caf996af1773fbe1fc52c564c9f)
- bm25: -6.9460 | relevance: 1.0000

this.#clearAllTimerOverlayKeysForLesson();
  }
  
  /**
   * Get session elapsed time
   * @returns {{ elapsed: number, formatted: string }}
   */
  getSessionTime() {
    return {
      elapsed: this.sessionElapsed,
      formatted: this.#formatTime(this.sessionElapsed)
    };
  }
  
  /**
   * Get work phase timer
   * @param {string} phase - Phase name
   * @returns {{ elapsed: number, timeLimit: number, remaining: number, formatted: string, onTime: boolean } | null}
   */
  getWorkPhaseTime(phase) {
    const timer = this.workPhaseTimers.get(phase);
    
    if (!timer) {
      return null;
    }
    
    const remaining = Math.max(0, timer.timeLimit - timer.elapsed);
    
    return {
      elapsed: timer.elapsed,
      timeLimit: timer.timeLimit,
      remaining,
      formatted: this.#formatTime(timer.elapsed),
      remainingFormatted: this.#formatTime(remaining),
      onTime: timer.elapsed <= timer.timeLimit,
      completed: timer.completed
    };
  }
  
  /**
   * Get golden key status
   * @returns {{ eligible: boolean, onTimeCompletions: number, required: number }}
   */
  getGoldenKeyStatus() {
    return {
      eligible: this.goldenKeysEnabled ? this.goldenKeyAwarded : false,
      onTimeCompletions: this.onTimeCompletions,
      required: 3
    };
  }
  
  /**
   * Serialize state for snapshot persistence
   * @returns {Object}
   */
  serialize() {
    return {
      sessionElapsed: this.sessionElapsed,
      currentPlayPhase: this.currentPlayPhase || null,
      currentWorkPhase: this.currentWorkPhase || null,
      playTimers: Array.from(this.playTimers.entries()).map(([phase, timer]) => ({
        phase,
        elapsed: timer.elapsed,
        timeLimit: timer.timeLimit,
        expired: timer.expired
      })),
      workPhaseTimers: Array.from(th

### 30. src/app/session/v2/TimerService.jsx (86ae160f1ce7bb4906342454e7b130ab32f451e44561c4264c31ff8b742cf788)
- bm25: -6.9244 | relevance: 1.0000

/**
   * Authoritatively set a phase timer's elapsed seconds.
   *
   * This is used by the facilitator TimerControlOverlay. The timer engine,
   * not the overlay UI, is the source of truth for transitions.
   *
   * Note: elapsedSeconds may be negative to represent "time added".
   */
  setPhaseElapsedSeconds(phase, mode, elapsedSeconds) {
    const asNumber = Number(elapsedSeconds);
    if (!Number.isFinite(asNumber)) return;
    if (!phase || typeof phase !== 'string') return;

const now = Date.now();
    const startTime = now - (asNumber * 1000);

if (mode === 'play') {
      // Discussion has no play timer.
      if (phase === 'discussion') return;

const validPhases = ['comprehension', 'exercise', 'worksheet', 'test'];
      if (!validPhases.includes(phase)) return;

const existing = this.playTimers.get(phase);
      const timeLimit = existing?.timeLimit ?? this.playTimerLimits?.[phase];
      if (!timeLimit) return;

const timer = {
        startTime,
        elapsed: asNumber,
        timeLimit,
        expired: false
      };

this.playTimers.set(phase, timer);
      this.currentPlayPhase = phase;
      this.mode = 'play';

// Only start interval if not paused
      if (!this.isPaused && !this.playTimerInterval) {
        this.playTimerInterval = setInterval(this.#tickPlayTimers.bind(this), 1000);
      }
      
      // If paused, update the paused elapsed time
      if (this.isPaused) {
        this.pausedPlayElapsed = asNumber;
      }

### 31. src/app/session/v2/TimerService.jsx (a2d7e76cb211127d6407ec85e28abf4078ebc4470e2462f8084afc06651e070b)
- bm25: -6.6363 | relevance: 1.0000

/**
   * Pause all running timers
   */
  pause() {
    if (this.isPaused) return;
    
    this.isPaused = true;
    
    // Pause play timer if running
    if (this.currentPlayPhase) {
      const timer = this.playTimers.get(this.currentPlayPhase);
      if (timer && !timer.expired) {
        const now = Date.now();
        timer.elapsed = Math.floor((now - timer.startTime) / 1000);
        this.pausedPlayElapsed = timer.elapsed;
        
        // Stop the interval
        if (this.playTimerInterval) {
          clearInterval(this.playTimerInterval);
          this.playTimerInterval = null;
        }
      }
    }
    
    // Pause work timer if running
    if (this.currentWorkPhase) {
      const timer = this.workPhaseTimers.get(this.currentWorkPhase);
      if (timer && !timer.completed) {
        const now = Date.now();
        timer.elapsed = Math.floor((now - timer.startTime) / 1000);
        this.pausedWorkElapsed = timer.elapsed;
        
        // Stop the interval
        if (this.workPhaseInterval) {
          clearInterval(this.workPhaseInterval);
          this.workPhaseInterval = null;
        }
      }
    }
  }
  
  /**
   * Resume all paused timers
   */
  resume() {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    
    // Resume play timer if it was paused
    if (this.currentPlayPhase && this.pausedPlayElapsed !== null) {
      const timer = this.playTimers.get(this.currentPlayPhase);
      if (timer && !timer.expired) {
        // Adjust startTime to account for paused duration
        timer.startTime = Date.now() - (this.pausedPlayElapsed * 1000);
        timer.elapsed = this.pausedPlayElapsed;
        this.pausedPlayElapsed = null;
        
        // Restart the interval
        if (!this.playTimerInterval) {
          this.

### 32. src/app/session/v2/SessionPageV2.jsx (aa89093162239c4a4d4f2b97fb9e7c42320c6d22311dbc8a20c8762e08ce816f)
- bm25: -5.8524 | entity_overlap_w: 2.00 | adjusted: -6.3524 | relevance: 1.0000

const handleUnsuspendGoldenKey = useCallback(() => {
    if (goldenKeysEnabledRef.current === false) return;
    if (!hasGoldenKey) return;
    setIsGoldenKeySuspended(false);
    if (phaseTimers) {
      setGoldenKeyBonus(phaseTimers.golden_key_bonus_min || 5);
    }
    setTimerRefreshKey(k => k + 1);
    persistTimerStateNow('golden-key-unsuspended');
  }, [hasGoldenKey, phaseTimers, persistTimerStateNow]);
  
  // Start play timer for a phase (called when phase begins)
  const startPhasePlayTimer = useCallback((phaseName) => {
    if (!phaseName) return;
    setCurrentTimerMode(prev => ({
      ...prev,
      [phaseName]: 'play'
    }));
    setTimerRefreshKey(prev => prev + 1);
    addEvent(`ðŸŽ‰ Play timer started for ${phaseName}`);
  }, []);
  
  // Transition from play to work timer (called when "Go" is clicked)
  const transitionToWorkTimer = useCallback((phaseName) => {
    if (!phaseName) return;
    
    // Clear the play timer storage so work timer starts fresh
    try {
      const playTimerKeys = [
        lessonKey ? `session_timer_state:${lessonKey}:${phaseName}:play` : null,
        `session_timer_state:${phaseName}:play`,
      ].filter(Boolean);
      playTimerKeys.forEach((k) => {
        try { sessionStorage.removeItem(k); } catch {}
      });
    } catch {}
    
    setCurrentTimerMode(prev => ({
      ...prev,
      [phaseName]: 'work'
    }));
    setTimerRefreshKey(prev => prev + 1);
    addEvent(`âœï¸ Work timer started for ${phaseName}`);
  }, [lessonKey]);
  
  // Handle PlayTimeExpiredOverlay countdown completion (auto-advance to work mode) - V1 parity
  const handlePlayExpiredComplete = useCallback(async () => {
    console.log('[SessionPageV2] PlayTimeExpired countdown complete, transitioning to work');
    setShowPlayTimeExpired(false

### 33. src/app/session/hooks/useResumeRestart.js (42368b98c6e83360ef9a8d85563376bf82ff5ddca07ce6d5f187dab11447924d)
- bm25: -5.8268 | entity_overlap_w: 2.00 | adjusted: -6.3268 | relevance: 1.0000

const buildKeys = (type) => {
      const keys = [];
      // Prefer lesson-scoped keys when available, but also probe the unscoped
      // variant for robustness (older sessions / early-boot timers).
      if (lessonKey) {
        keys.push(`session_timer_state:${lessonKey}:${phaseName}:${type}`);
      }
      keys.push(`session_timer_state:${phaseName}:${type}`);
      return keys;
    };

const readBestState = (type) => {
      const keys = buildKeys(type);
      const candidates = [];
      for (const key of keys) {
        try {
          const raw = sessionStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          candidates.push({ key, parsed });
        } catch {
          // ignore
        }
      }
      if (!candidates.length) return null;
      if (candidates.length === 1) return candidates[0].parsed;

// If both lesson-scoped + unscoped exist, pick the most recently-started.
      candidates.sort((a, b) => {
        const as = Number(a.parsed?.startTime) || 0;
        const bs = Number(b.parsed?.startTime) || 0;
        return bs - as;
      });
      return candidates[0].parsed;
    };

const workState = readBestState('work');
    const playState = readBestState('play');

if (workState && !playState) return 'work';
    if (!workState && playState) return 'play';
    if (workState && playState) {
      const workStart = Number(workState.startTime) || 0;
      const playStart = Number(playState.startTime) || 0;
      return workStart >= playStart ? 'work' : 'play';
    }

return null;
  }, [lessonKey]);

### 34. src/app/session/page.js (2cf08f5a7761f406520e67575a6732a7569e3c2a45f72bac41eda4f4163c94d3)
- bm25: -5.7265 | entity_overlap_w: 2.00 | adjusted: -6.2265 | relevance: 1.0000

// Phase-based timer helpers
  
  // Start play timer for a phase (called when "Begin [Phase]" button is clicked)
  const startPhasePlayTimer = useCallback((phaseName) => {
    setCurrentTimerMode(prev => ({
      ...prev,
      [phaseName]: 'play'
    }));
  }, []); // setCurrentTimerMode is stable useCallback, not needed in deps
  
  // Transition from play to work timer (called when "Go" button is clicked during play mode)
  const transitionToWorkTimer = useCallback((phaseName) => {
    // Clear the play timer storage so work timer starts fresh
    const playTimerKeys = [
      lessonKey ? `session_timer_state:${lessonKey}:${phaseName}:play` : null,
      `session_timer_state:${phaseName}:play`,
    ].filter(Boolean);
    try {
      playTimerKeys.forEach((k) => {
        try { sessionStorage.removeItem(k); } catch {}
      });
    } catch {}
    
    setCurrentTimerMode(prev => ({
      ...prev,
      [phaseName]: 'work'
    }));
  }, [lessonKey]); // setCurrentTimerMode is stable useCallback, not needed in deps
  
  // Handle play timer expiration (show 30-second countdown overlay)
  const handlePlayTimeUp = useCallback((phaseName) => {
    // Skip if countdown was already completed (flag set during restore or previous completion)
    if (playExpiredCountdownCompleted) return;
    
    setShowPlayTimeExpired(true);
    setPlayExpiredPhase(phaseName);
    // Close games overlay if it's open
    setShowGames(false);
    
    // Clear all opening action sequences to prevent hangover at transition to work subphase
    setShowOpeningActions(false);
    setAskState('inactive');
    setRiddleState('inactive');
    setPoemState('inactive');
    setStoryState('inactive');
    setFillInFunState('inactive');
    
    // Clear story-specific states
    setStoryTranscript([]);

### 35. src/app/session/v2/SessionPageV2.jsx (9aecfe928f26ee8143d05d4bcc6188457e14f41fbf78cb0852f72e2f96839d95)
- bm25: -6.1433 | relevance: 1.0000

// Test Review UI Component (matches V1)
function TestReviewUI({ testGrade, generatedTest, timerService, workPhaseCompletions, workTimeRemaining, goldenKeysEnabled, onOverrideAnswer, onCompleteReview }) {
  const { score, totalQuestions, percentage, grade: letterGrade, answers } = testGrade;
  
  const tierForPercent = (pct) => {
    if (pct >= 90) return 'gold';
    if (pct >= 80) return 'silver';
    if (pct >= 70) return 'bronze';
    return null;
  };
  
  const emojiForTier = (tier) => {
    if (tier === 'gold') return '🥇';
    if (tier === 'silver') return '🥈';
    if (tier === 'bronze') return '🥉';
    return '';
  };
  
  const tier = tierForPercent(percentage);
  const medal = emojiForTier(tier);
  
  const card = { 
    background: '#ffffff', 
    border: '1px solid #e5e7eb', 
    borderRadius: 12, 
    padding: 16, 
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
  };
  
  const badge = (ok) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    background: ok ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
    color: ok ? '#065f46' : '#7f1d1d',
    border: `1px solid ${ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`
  });
  
  const btn = {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  };
  
  const workPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
  
  const formatRemainingLabel = (phaseKey) => {
    const minutesLeft = workTimeRemaining?.[phaseKey] ?? null;
    if (minutesLeft == null) return '—';
    const totalSeconds = Math.round(Math.max(0, minutesLeft * 60));
    const

### 36. src/app/session/page.js (9b09f2a1772d11abcc4ead3f89548a7d498171dfba1cb148992ccdc0f175686f)
- bm25: -5.8779 | entity_overlap_w: 1.00 | adjusted: -6.1279 | relevance: 1.0000

// Session takeover detection (hoisted earlier)

// Clear timer state only after initial loading completes and the Begin screen is actually visible
  useEffect(() => {
    if (loading) return;
    if (!showBegin || !lessonKey) return;
    try {
      const phases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
      const timerTypes = ['play', 'work'];
      phases.forEach(phase => {
        timerTypes.forEach(timerType => {
          const storageKey = `session_timer_state:${lessonKey}:${phase}:${timerType}`;
          sessionStorage.removeItem(storageKey);
        });
      });
    } catch {}
  }, [showBegin, lessonKey, loading]);

### 37. src/app/session/hooks/useResumeRestart.js (a18056117e8fc973d4c371848a9190ece03ef5bb9b1b314e2fbc0585e04fc905)
- bm25: -5.5591 | entity_overlap_w: 2.00 | adjusted: -6.0591 | relevance: 1.0000

const handleRestartClick = useCallback(async () => {
    // Confirm irreversible action before proceeding
    try {
      const ans = typeof window !== 'undefined' ? window.prompt("Restart will clear saved progress and cannot be reversed. Type 'ok' to confirm.") : null;
      if (!ans || String(ans).trim().toLowerCase() !== 'ok') { return; }
    } catch {}
    
    // Immediately hide the Resume/Restart buttons and show loading spinner
    try { setOfferResume(false); } catch {}
    try { setLoading(true); } catch {}
    
    // Reset timer state for restart
    try {
      if (typeof window !== 'undefined') {
        const storageKey = lessonKey ? `session_timer_state:${lessonKey}` : 'session_timer_state';
        sessionStorage.removeItem(storageKey);
      }
      if (setTimerPaused) {
        setTimerPaused(false);
      }
    } catch (e) {
      // Timer reset failed - continue
    }
    
    // Stop all activity and cut the current transcript segment so nothing is lost
    try { abortAllActivity(); } catch {}
    try {
      const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
      const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
      const startIdx = Math.max(0, Number(transcriptSegmentStartIndexRef.current) || 0);
      const all = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : [];
      const slice = all.slice(startIdx).filter((ln) => ln && typeof ln.text === 'string' && ln.text.trim().length > 0).map((ln) => ({ role: ln.role || 'assistant', text: ln.text }));
      if (learnerId && learnerId !== 'demo' && slice.length > 0) {
        await appendTranscr

### 38. src/app/session/v2/SessionPageV2.jsx (71db2dc587290bfb731e3175ad69b9498370a6bccdf32b454be79aaf1381928b)
- bm25: -4.1152 | entity_overlap_w: 1.00 | adjusted: -4.3652 | relevance: 1.0000

// Timeline jumps should enter the destination phase fresh (Begin -> Opening Actions -> Go)
    // even if snapshot phaseData exists. Mark the target so phase init ignores resumeState.
    timelineJumpForceFreshPhaseRef.current = targetPhase;
    
    // Destroy any existing phase controllers to avoid conflicts
    if (discussionPhaseRef.current) {
      try { discussionPhaseRef.current.destroy(); } catch {}
      discussionPhaseRef.current = null;
    }
    if (comprehensionPhaseRef.current) {
      try { comprehensionPhaseRef.current.destroy(); } catch {}
      comprehensionPhaseRef.current = null;
    }
    if (exercisePhaseRef.current) {
      try { exercisePhaseRef.current.destroy(); } catch {}
      exercisePhaseRef.current = null;
    }
    if (worksheetPhaseRef.current) {
      try { worksheetPhaseRef.current.destroy(); } catch {}
      worksheetPhaseRef.current = null;
    }
    if (testPhaseRef.current) {
      try { testPhaseRef.current.destroy(); } catch {}
      testPhaseRef.current = null;
    }
    if (closingPhaseRef.current) {
      try { closingPhaseRef.current.destroy(); } catch {}
      closingPhaseRef.current = null;
    }
    
    // Reset phase-specific states
    setDiscussionState('idle');
    setComprehensionState('idle');
    setExerciseState('idle');
    setWorksheetState('idle');
    setTestState('idle');
    
    // Hide PlayTimeExpiredOverlay if showing
    setShowPlayTimeExpired(false);
    setPlayExpiredPhase(null);
    
    // Clear timer storage for the target phase (fresh start)
    try {
      // Clear play timer storage
      if (lessonKey) {
        sessionStorage.removeItem(`session_timer_state:${lessonKey}:${targetPhase}:play`);
      }
      // Clear work timer storage
      if (lessonKey) {
        sessionStorage.removeItem(`se

### 39. src/app/session/page.js (31d804800c63e3c246516064729f97f82ee537de74dc97d12ff738904dac43f1)
- bm25: -4.1152 | relevance: 1.0000

// Session Timer state
  const [timerPaused, setTimerPaused] = useState(false);
  const [sessionTimerMinutes, setSessionTimerMinutes] = useState(60); // Default 1 hour
  
  // Phase-based timer system (11 timers: 5 phases × 2 types + 1 golden key bonus)
  const [phaseTimers, setPhaseTimers] = useState(null); // Loaded from learner profile
  const [currentTimerMode, setCurrentTimerModeState] = useState({}); // { discussion: 'play'|'work', comprehension: 'play'|'work', ... }
  const currentTimerModeRef = useRef(currentTimerMode);
  const setCurrentTimerMode = useCallback((updater) => {
    setCurrentTimerModeState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : (updater || {});
      currentTimerModeRef.current = next;
      return next;
    });
  }, []);
  const [workPhaseCompletions, setWorkPhaseCompletionsState] = useState({
    discussion: false,
    comprehension: false,
    exercise: false,
    worksheet: false,
    test: false
  }); // Tracks which work phases completed without timing out (for golden key earning)
  const workPhaseCompletionsRef = useRef(workPhaseCompletions);
  const setWorkPhaseCompletions = useCallback((updater) => {
    setWorkPhaseCompletionsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : (updater || {
        discussion: false,
        comprehension: false,
        exercise: false,
        worksheet: false,
        test: false,
      });
      workPhaseCompletionsRef.current = next;
      return next;
    });
  }, []);
  const [workTimeRemaining, setWorkTimeRemainingState] = useState({
    discussion: null,
    comprehension: null,
    exercise: null,
    worksheet: null,
    test: null,
  }); // Minutes remaining when each work timer stopped (null when never started)
  const work
