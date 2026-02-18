# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Where does SessionPageV2 handle restart/restart-from-resume, and does it call TimerService.reset() or otherwise clear timerState/workPhaseResults?
```

Filter terms used:
```text
TimerService.reset
SessionPageV2
TimerService
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

TimerService.reset SessionPageV2 TimerService

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (2125ec80e822259d4bfef07205d1884da84129c9b399a7f643693f080bae9197)
- bm25: -15.7035 | entity_overlap_w: 6.00 | adjusted: -17.2035 | relevance: 1.0000

// PIN gate: timeline jumps are facilitator-only
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timeline');
    } catch (e) {
      console.warn('[SessionPageV2] Timeline PIN gate error:', e);
    }
    if (!allowed) {
      timelineJumpInProgressRef.current = false;
      return;
    }
    
    console.log('[SessionPageV2] Timeline jump proceeding to:', targetPhase);
    
    // Stop any playing audio first
    stopAudioSafe({ force: true });
    
    // Reset opening actions state to prevent zombie UI
    setOpeningActionActive(false);
    setOpeningActionType(null);
    setOpeningActionState({});
    setOpeningActionInput('');
    setOpeningActionError('');
    setOpeningActionBusy(false);
    setShowPlayWithSonomaMenu(false);
    setShowGames(false);
    setShowFullscreenPlayTimer(false);

### 7. src/app/session/v2/SessionPageV2.jsx (b97cd740f6c7c99c06b14c225b7e2f5740459943a832450262784f42f8ed89b2)
- bm25: -7.1805 | relevance: 1.0000

### 23. sidekick_pack.md (2168af49fc874c26c8923fe18c01acab19e0f9a7bc8d95336ba2c47386ee062a)
- bm25: -5.9274 | entity_overlap_w: 1.00 | adjusted: -6.1774 | relevance: 1.0000

### 18. src/app/session/v2/TimerService.jsx (a2d7e76cb211127d6407ec85e28abf4078ebc4470e2462f8084afc06651e070b)
- bm25: -5.4024 | relevance: 1.0000

### 24. src/app/session/v2/TimerService.jsx (16208a27764d4b1276874b5a9ea4b75d305609b19be6adc032ed5205aac08ce5)
- bm25: -6.1715 | relevance: 1.0000

this.#removeTimerOverlayKey(phase, 'work');

### 25. src/app/session/v2/SessionPageV2.jsx (88fe0015b32a8bc8371a6dda9aec70e55687fc9656f465d7fc93a864d040fd16)
- bm25: -6.1680 | relevance: 1.0000

### 2. src/app/session/v2/TimerService.jsx (8a0a047ca96c0a7bd623f5ae75ff99b71bcc3928b95a1f7cf7d1b7013986acb8)
- bm25: -13.4758 | relevance: 1.0000

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

this.workPhaseResults.clear();

this.onTimeCompletions = 0;
    this.goldenKeyAwarded = false;
    this.mode = 'play';
    
    this.isPaused = false;
    this.pausedPlayElapsed = null;
    this.pausedWorkElapsed = null;

### 3. sidekick_pack.md (5a3d3e0c845314c08f34e366fb3f52fdc04f4978668dd7d89f0826b62f69c151)
- bm25: -12.3339 | entity_overlap_w: 4.00 | adjusted: -13.3339 | relevance: 1.0000

### 28. src/app/session/v2/TimerService.jsx (50c86fe95bbe058e184d6066028a47bb16cc366c5597e74956565455e458af49)
- bm25: -5.9274 | relevance: 1.0000

const validPhases = ['comprehension', 'exercise', 'worksheet', 'test'];
      if (!validPhases.includes(phase)) return;

### 29. src/app/session/v2/TimerService.jsx (9c98c5270cb757bf7f2f0409e031c8524ebf47d71737482c0b33133e4a59f387)
- bm25: -5.9274 | relevance: 1.0000

const timer = {
        startTime,
        elapsed: asNumber,
        timeLimit,
        completed: false,
        onTime: asNumber <= timeLimit
      };

### 30. src/app/session/v2/TimerService.jsx (6e47a360484dbfce63e9b04c56c1b502a733a0369653f678f7f6162e6b60329c)
- bm25: -5.8612 | relevance: 1.0000

#clearAllTimerOverlayKeysForLesson() {
    if (typeof window === 'undefined') return;
    const prefix = this.#timerOverlayKeyPrefix();
    if (!prefix) return;

### 31. src/app/session/v2/TimerService.jsx (bf017c256fc06870bbde627ee9aa37b55c6db8bd27fb4b246887cb3b6a1e379d)
- bm25: -5.4918 | entity_overlap_w: 1.00 | adjusted: -5.7418 | relevance: 1.0000

### 4. src/app/session/v2/TimerService.jsx (acaa43b46c9a31add888fd04939ae9b9fb4d12b3c5f56d8935151446d6325c20)
- bm25: -11.7503 | entity_overlap_w: 4.00 | adjusted: -12.7503 | relevance: 1.0000

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

### 5. src/app/session/v2/SessionPageV2.jsx (817ac2974ad1c2e813ca40f00ffb2ed5049dca7551758bd16280356f0c49dfca)
- bm25: -12.1878 | relevance: 1.0000

const onTimeCount = (() => {
    try {
      if (!timerService?.getWorkPhaseTime) {
        return Object.values(workPhaseCompletions || {}).filter(Boolean).length;
      }
      return workPhases.reduce((acc, phaseKey) => {
        const t = getPhaseTime(phaseKey);
        return acc + (t?.completed && t.onTime ? 1 : 0);
      }, 0);
    } catch {
      return Object.values(workPhaseCompletions || {}).filter(Boolean).length;
    }
  })();

### 6. src/app/session/v2/TimerService.jsx (a8bc5ccda2768699ae9282d9616a4aa9f536b5091ec3a65c6887e11c83883e5d)
- bm25: -12.1224 | relevance: 1.0000

// Sticky completion records for Golden Key + end-of-test reporting.
    // Once a phase has been completed on time, it retains credit until explicit reset.
    // Map: phase -> { completed, onTime, elapsed, timeLimit, remaining, finishedAt }
    this.workPhaseResults = new Map();
    
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

### 7. sidekick_pack.md (db3f80c5f51f924b7c0cbc65fd0f8300a1311275abc4bf4f5b59917f3cd6a335)
- bm25: -11.0886 | entity_overlap_w: 4.00 | adjusted: -12.0886 | relevance: 1.0000

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

### 8. src/app/session/v2/SessionPageV2.jsx (b3c9e3cac82f9ab3de84ee4873b0949f9769dd099daebb93abf12c9f43d65571)
- bm25: -11.3304 | entity_overlap_w: 2.00 | adjusted: -11.8304 | relevance: 1.0000

const timer = new TimerService(eventBus, {
      lessonKey,
      playTimerLimits,
      workPhaseTimeLimits,
      goldenKeysEnabled: goldenKeysEnabledRef.current
    });

timerServiceRef.current = timer;

// Apply any snapshot-restored timer state once timer exists
    if (pendingTimerStateRef.current) {
      try {
        const pending = pendingTimerStateRef.current;
        applyRestoredTimerStateToUi(pending, 'pending-timerstate');
        timer.restoreState(pending);
        timer.resync?.('pending-restore');
        hydrateWorkTimerSummaryFromTimerService('pending-restore');
      } catch {}
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
  }, [lessonKey, phaseTimers, applyRestoredTimerStateToUi]);

// Update play timer limits when bonus/enabled state changes (do not recreate TimerService).
  useEffect(() => {
    if (!timerServiceRef.current || !phaseTimers) return;

const playBonusSec = goldenKeysEnabledRef.current
      ? Math.max(0, Number(goldenKeyBonusRef.current || 0)) * 60
      : 0;
    const m2s = (m) => Math.max(0, Number(m || 0)) * 60;

### 9. src/app/session/v2/TimerService.jsx (16208a27764d4b1276874b5a9ea4b75d305609b19be6adc032ed5205aac08ce5)
- bm25: -11.4471 | relevance: 1.0000

this.#removeTimerOverlayKey(phase, 'work');

### 10. src/app/session/v2/SessionPageV2.jsx (b493dd38d78155aefa759fa6ee29dee61f6c548fa2e0120f98a7508b5086922d)
- bm25: -10.6941 | entity_overlap_w: 2.00 | adjusted: -11.1941 | relevance: 1.0000

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

### 11. sidekick_pack.md (2debe79c08906a7c10cc55b55018e78a784e4077dadbbb6eec0ea763acbd629f)
- bm25: -10.4148 | entity_overlap_w: 3.00 | adjusted: -11.1648 | relevance: 1.0000

if (subPhase && subPhase !== 'greeting') return true

if (typeof snapshot.currentCompIndex === 'number' && snapshot.currentCompIndex > 0) return true
  if (typeof snapshot.currentExIndex === 'number' && snapshot.currentExIndex > 0) return true
  if (typeof snapshot.currentWorksheetIndex === 'number' && snapshot.currentWorksheetIndex > 0) return true
  if (typeof snapshot.testActiveIndex === 'number' && snapshot.testActiveIndex > 0) return true
  if (snapshot.currentCompProblem) return true
  if (snapshot.currentExerciseProblem) return true

if (Array.isArray(snapshot.testUserAnswers) && snapshot.testUserAnswers.some(v => v != null && String(v).trim().length > 0)) return true
  if (Array.isArray(snapshot.storyTranscript) && snapshot.storyTranscript.length > 0) return true

return false
}

function LessonsPageInner(){
  const router = useRouter()

### 34. src/app/session/v2/TimerService.jsx (9917cbb68d40a7265930863b430bb508a9c1f0b3f4a2b78894a94e2ce38d9deb)
- bm25: -5.6711 | relevance: 1.0000

const timer = this.workPhaseTimers.get(phase);
    if (!timer) return null;

const remaining = Math.max(0, timer.timeLimit - timer.elapsed);

### 35. src/app/session/v2/SessionPageV2.jsx (d5ef179774ea3dbc18175f74a8fcb95f56b0791dac6a41e4c69f062996d6c1cf)
- bm25: -5.1168 | entity_overlap_w: 2.00 | adjusted: -5.6168 | relevance: 1.0000

const timer = new TimerService(eventBus, {
      lessonKey,
      playTimerLimits,
      workPhaseTimeLimits,
      goldenKeysEnabled: goldenKeysEnabledRef.current
    });

timerServiceRef.current = timer;

### 12. src/app/session/v2/SessionPageV2.jsx (e2298da1b4c9813bf5ec151a81b9b5eaf71e87a15c014382dd911333d2dc9659)
- bm25: -9.5791 | entity_overlap_w: 6.00 | adjusted: -11.0791 | relevance: 1.0000

if (askExitSpeechLockRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked while Ask exit reminder is speaking');
      return;
    }
    
    // Debounce: Block rapid successive clicks
    if (timelineJumpInProgressRef.current) {
      console.warn('[SessionPageV2] Timeline jump BLOCKED - jump already in progress for:', targetPhase);
      return;
    }
    
    // Set jump in progress flag IMMEDIATELY (before any async operations)
    timelineJumpInProgressRef.current = true;
    console.log('[SessionPageV2] Flag NOW set to true, value:', timelineJumpInProgressRef.current, 'for:', targetPhase);
    
    // Only allow jumping to valid phases
    const validPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
    if (!validPhases.includes(targetPhase)) {
      console.warn('[SessionPageV2] Invalid timeline jump target:', targetPhase);
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need orchestrator
    if (!orchestratorRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no orchestrator');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need audio engine
    if (!audioEngineRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no audio engine');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }

### 13. sidekick_pack.md (6fbbec22ad86ee343818f9e06e45079c9ed78ce5cd9be20f5bfe1766c9399bbb)
- bm25: -9.7903 | entity_overlap_w: 5.00 | adjusted: -11.0403 | relevance: 1.0000

### 19. src/app/session/v2/SessionPageV2.jsx (c771fdbd89ebe42c0a5b28258f25e1661778dd8eec1b633b78d4f6bda1038719)
- bm25: -6.1859 | entity_overlap_w: 1.00 | adjusted: -6.4359 | relevance: 1.0000

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

### 14. sidekick_pack.md (8b23046b8e828f4eac9f9224c1b0406b3539955d592fdd7fa1137a31435f5827)
- bm25: -9.2799 | entity_overlap_w: 7.00 | adjusted: -11.0299 | relevance: 1.0000

### 27. sidekick_pack.md (5fb852380d76291149d9a2bdad5665eae6f15ab47bb221e178c453fa7c12c46c)
- bm25: -5.9818 | relevance: 1.0000

### 8. src/app/session/v2/SessionPageV2.jsx (88fe0015b32a8bc8371a6dda9aec70e55687fc9656f465d7fc93a864d040fd16)
- bm25: -6.9242 | relevance: 1.0000

if (askExitSpeechLockRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked while Ask exit reminder is speaking');
      return;
    }
    
    // Debounce: Block rapid successive clicks
    if (timelineJumpInProgressRef.current) {
      console.warn('[SessionPageV2] Timeline jump BLOCKED - jump already in progress for:', targetPhase);
      return;
    }
    
    // Set jump in progress flag IMMEDIATELY (before any async operations)
    timelineJumpInProgressRef.current = true;
    console.log('[SessionPageV2] Flag NOW set to true, value:', timelineJumpInProgressRef.current, 'for:', targetPhase);
    
    // Only allow jumping to valid phases
    const validPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
    if (!validPhases.includes(targetPhase)) {
      console.warn('[SessionPageV2] Invalid timeline jump target:', targetPhase);
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need orchestrator
    if (!orchestratorRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no orchestrator');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need audio engine
    if (!audioEngineRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no audio engine');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }

### 15. sidekick_pack.md (076e2e81b419ce7ed23da68abaf9c21b037831760720378812c032cc29ffd5b9)
- bm25: -9.5161 | entity_overlap_w: 6.00 | adjusted: -11.0161 | relevance: 1.0000

if (askExitSpeechLockRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked while Ask exit reminder is speaking');
      return;
    }
    
    // Debounce: Block rapid successive clicks
    if (timelineJumpInProgressRef.current) {
      console.warn('[SessionPageV2] Timeline jump BLOCKED - jump already in progress for:', targetPhase);
      return;
    }
    
    // Set jump in progress flag IMMEDIATELY (before any async operations)
    timelineJumpInProgressRef.current = true;
    console.log('[SessionPageV2] Flag NOW set to true, value:', timelineJumpInProgressRef.current, 'for:', targetPhase);
    
    // Only allow jumping to valid phases
    const validPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
    if (!validPhases.includes(targetPhase)) {
      console.warn('[SessionPageV2] Invalid timeline jump target:', targetPhase);
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need orchestrator
    if (!orchestratorRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no orchestrator');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need audio engine
    if (!audioEngineRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no audio engine');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }

### 16. src/app/session/v2/TimerService.jsx (50c86fe95bbe058e184d6066028a47bb16cc366c5597e74956565455e458af49)
- bm25: -10.9952 | relevance: 1.0000

const validPhases = ['comprehension', 'exercise', 'worksheet', 'test'];
      if (!validPhases.includes(phase)) return;

### 17. src/app/session/v2/TimerService.jsx (9c98c5270cb757bf7f2f0409e031c8524ebf47d71737482c0b33133e4a59f387)
- bm25: -10.9952 | relevance: 1.0000

const timer = {
        startTime,
        elapsed: asNumber,
        timeLimit,
        completed: false,
        onTime: asNumber <= timeLimit
      };

### 18. src/app/session/v2/TimerService.jsx (6e47a360484dbfce63e9b04c56c1b502a733a0369653f678f7f6162e6b60329c)
- bm25: -10.8725 | relevance: 1.0000

#clearAllTimerOverlayKeysForLesson() {
    if (typeof window === 'undefined') return;
    const prefix = this.#timerOverlayKeyPrefix();
    if (!prefix) return;

### 19. src/app/session/v2/SessionPageV2.jsx (4ea6d8a5823264ee61423b7119aaef85c047803f86c088cdef135d1b40d9cebc)
- bm25: -9.5771 | entity_overlap_w: 5.00 | adjusted: -10.8271 | relevance: 1.0000

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

### 20. src/app/session/v2/SessionPageV2.jsx (024944439b180c29691dd528e1c88ba6c801156ba8df8298bf547d6a6e78b49f)
- bm25: -9.8910 | entity_overlap_w: 3.00 | adjusted: -10.6410 | relevance: 1.0000

if (snapshot.timerState) {
            // Keep UI timer mode aligned with the restored timer engine state.
            applyRestoredTimerStateToUi(snapshot.timerState, 'snapshot-load');
            if (timerServiceRef.current) {
              try {
                timerServiceRef.current.restoreState(snapshot.timerState);
                timerServiceRef.current.resync?.('snapshot-restore');
                hydrateWorkTimerSummaryFromTimerService('snapshot-restore');
              } catch {}
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
  }, [lessonData, learnerProfile, browserSessionId, lessonKey, resetTranscriptState, applyRestoredTimerStateToUi]);
  
  // Initialize TimerService
  useEffect(() => {
    if (!eventBusRef.current || !lessonKey || !phaseTimers) return;

const eventBus = eventBusRef.current;

### 21. src/app/session/v2/TimerService.jsx (9917cbb68d40a7265930863b430bb508a9c1f0b3f4a2b78894a94e2ce38d9deb)
- bm25: -10.5205 | relevance: 1.0000

const timer = this.workPhaseTimers.get(phase);
    if (!timer) return null;

const remaining = Math.max(0, timer.timeLimit - timer.elapsed);

### 22. src/app/session/v2/TimerService.jsx (bf017c256fc06870bbde627ee9aa37b55c6db8bd27fb4b246887cb3b6a1e379d)
- bm25: -10.1903 | entity_overlap_w: 1.00 | adjusted: -10.4403 | relevance: 1.0000

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

### 23. sidekick_pack.md (2e770511dde5c8f3b1ce0ccf2725d10b51727ee6965ceca6117e57caa58fa2c9)
- bm25: -10.1375 | entity_overlap_w: 1.00 | adjusted: -10.3875 | relevance: 1.0000

if (forceFresh) {
      timelineJumpForceFreshPhaseRef.current = null;
    }
    return true;
  };

### 6. src/app/session/v2/TimerService.jsx (acaa43b46c9a31add888fd04939ae9b9fb4d12b3c5f56d8935151446d6325c20)
- bm25: -6.3331 | entity_overlap_w: 4.00 | adjusted: -7.3331 | relevance: 1.0000

### 24. src/app/session/v2/TimerService.jsx (0206152c1c7b524e70e26134e7acf24c985931f28c9547f5df05df5ce2ccca48)
- bm25: -10.2441 | relevance: 1.0000

// Do not delete completed timers/results; completion credit must persist.
    if (!timer.completed) {
      this.workPhaseTimers.delete(phase);
    }
    if (this.currentWorkPhase === phase) {
      this.currentWorkPhase = null;
    }
  }

### 25. src/app/session/v2/TimerService.jsx (99e4956be1412065a8a0ad88b662ddcbb1fcfd25f4ad5660be28a29c525d30e5)
- bm25: -10.1716 | relevance: 1.0000

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

### 26. sidekick_pack.md (4a8bb706c4d26c4030ba65d6206b5fcfe1a9c4e16e52f0cd410ed59b9a7528ca)
- bm25: -9.3736 | entity_overlap_w: 3.00 | adjusted: -10.1236 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Golden Key: per-phase on-time credit must be sticky across refresh/resume/timeline jumps; end-of-test report should hydrate from TimerService restored state; 3/5 phases (discussion, comprehension, exercise, worksheet, test)
```

Filter terms used:
```text
/resume/timeline
TimerService
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/resume/timeline TimerService

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (8a62d0b86e6aea78e2b5fbd9d71be53460d65ae364f332c3e3add7667f367a37)
- bm25: -10.7321 | entity_overlap_w: 4.50 | adjusted: -11.8571 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Golden Key completion tracking breaks after refresh/resume/timeline jumps. Need per-phase work-timer completion credit (onTime) to be sticky: once a phase is completed on time, keep credit regardless of later navigation, restart, timer pauses, facilitator time changes. Report at end of test should only show incomplete when phase truly not completed.
```

Filter terms used:
```text
/resume/timeline
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/resume/timeline

## Forced Context

(none)

## Ranked Evidence

### 27. sidekick_pack.md (4c756d0246c87201f7c73d67ec5d9757efb48786ac8078e3bfcff511a0021798)
- bm25: -9.4493 | entity_overlap_w: 2.00 | adjusted: -9.9493 | relevance: 1.0000

### 2. sidekick_pack.md (38d60350d5ac24351b7e799d9dfcf539b9be2999447aba30e8d789d62056883d)
- bm25: -8.8762 | entity_overlap_w: 1.00 | adjusted: -9.1262 | relevance: 1.0000

const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general', 'generated']

function normalizeApprovedLessonKeys(map = {}) {
  const normalized = {}
  let changed = false
  Object.entries(map || {}).forEach(([key, value]) => {
    if (typeof key === 'string' && key.startsWith('Facilitator Lessons/')) {
      const suffix = key.slice('Facilitator Lessons/'.length)
      normalized[`general/${suffix}`] = value
      changed = true
    } else if (key) {
      normalized[key] = value
    }
  })
  return { normalized, changed }
}

function snapshotHasMeaningfulProgress(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false

const phase = snapshot.phase || 'discussion'
  const subPhase = snapshot.subPhase || 'greeting'
  const resume = snapshot.resume || null

### 29. src/app/session/v2/TimerService.jsx (ec57a83cf0e04550a623e4d9e105aabc4abc2b970c06655cbb9940b2ba5e6cf6)
- bm25: -4.4231 | relevance: 1.0000

### 3. src/app/session/v2/TimerService.jsx (2138714f2799a4ec7f9a38d215801a4d155f4495dd79411cb99a813197b9d07d)
- bm25: -7.7893 | relevance: 1.0000

### 28. src/app/session/v2/SessionPageV2.jsx (503a0c7043977bac664a3b5186a99b618813487e8e4a677a79117b5dc3a4a07f)
- bm25: -9.7449 | relevance: 1.0000

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

const getPhaseTime = (phaseKey) => {
    try {
      return timerService?.getWorkPhaseTime?.(phaseKey) || null;
    } catch {
      return null;
    }
  };

### 29. sidekick_pack.md (527ec600fa5816b55afa53bf70c1c586b310b7d1c7e5462a1796bcfff7dc9a96)
- bm25: -9.0543 | entity_overlap_w: 2.00 | adjusted: -9.5543 | relevance: 1.0000

### 7. src/app/session/v2/TimerService.jsx (d73babe9a6b142fd32dc452825b90d6019ffaf89d1d0625f93adb58cacdbfbc0)
- bm25: -6.9318 | relevance: 1.0000

// Restore sticky completion results first.
    try {
      this.workPhaseResults.clear();
      const rows = Array.isArray(data.workPhaseResults) ? data.workPhaseResults : [];
      for (const row of rows) {
        const phase = row?.phase;
        if (!phase) continue;
        this.workPhaseResults.set(phase, {
          completed: row?.completed === true,
          onTime: row?.onTime === true,
          elapsed: Number(row?.elapsed) || 0,
          timeLimit: Number(row?.timeLimit) || 0,
          remaining: Number(row?.remaining) || 0,
          finishedAt: Number(row?.finishedAt) || null
        });
      }
    } catch {}
    
    // Restore play timers
    if (data.playTimers) {
      this.playTimers.clear();
      
      data.playTimers.forEach(timer => {
        this.playTimers.set(timer.phase, {
          startTime: Date.now() - (timer.elapsed * 1000), // Resume from elapsed
          elapsed: timer.elapsed,
          timeLimit: timer.timeLimit,
          expired: timer.expired
        });
        
        if (!timer.expired) {
          this.currentPlayPhase = timer.phase;
          if (!this.playTimerInterval) {
            this.playTimerInterval = setInterval(this.#tickPlayTimers.bind(this), 1000);
          }
        }
      });

### 8. src/app/session/v2/TimerService.jsx (99e4956be1412065a8a0ad88b662ddcbb1fcfd25f4ad5660be28a29c525d30e5)
- bm25: -6.8095 | relevance: 1.0000

### 30. src/app/session/v2/TimerService.jsx (fadd0031a629b6e2bc8180312947ff4517d9d188b582880d35b92b4a87ebfa5b)
- bm25: -8.9095 | entity_overlap_w: 1.00 | adjusted: -9.1595 | relevance: 1.0000

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

### 31. src/app/session/v2/TimerService.jsx (ddc4e55265936d9dbe720cbc3b0ebb92d247e4507a3b0639ba613b8ab0e01bad)
- bm25: -8.8090 | relevance: 1.0000

// If a play timer is already running, update its limit so bonus changes
    // (e.g., Golden Key) apply immediately to the active countdown.
    try {
      for (const [phase, nextLimit] of Object.entries(limits)) {
        const timer = this.playTimers.get(phase);
        if (!timer) continue;
        const parsed = Number(nextLimit);
        if (!Number.isFinite(parsed) || parsed <= 0) continue;
        timer.timeLimit = parsed;

### 32. sidekick_pack.md (bda1681c2bf9b31eb19e0de79b851786d88cd8a81d84a1b850545866820a48cf)
- bm25: -7.7005 | entity_overlap_w: 4.00 | adjusted: -8.7005 | relevance: 1.0000

### 17. src/app/session/v2/SessionPageV2.jsx (216a4f7c3f291b2134a6bbc8bb87947264d2a1bb81d08e69efdfb1cc5eff1d16)
- bm25: -6.5493 | relevance: 1.0000

// PIN gate: timeline jumps are facilitator-only
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timeline');
    } catch (e) {
      console.warn('[SessionPageV2] Timeline PIN gate error:', e);
    }
    if (!allowed) {
      timelineJumpInProgressRef.current = false;
      return;
    }
    
    console.log('[SessionPageV2] Timeline jump proceeding to:', targetPhase);
    
    // Stop any playing audio first
    stopAudioSafe({ force: true });
    
    // Reset opening actions state to prevent zombie UI
    setOpeningActionActive(false);
    setOpeningActionType(null);
    setOpeningActionState({});
    setOpeningActionInput('');
    setOpeningActionError('');
    setOpeningActionBusy(false);
    setShowPlayWithSonomaMenu(false);
    setShowGames(false);
    setShowFullscreenPlayTimer(false);

### 18. src/app/session/v2/SessionPageV2.jsx (3674c9e66775e69ac803a45cffcc968ea484787adf57f6d4a7cee0abd6517c1b)
- bm25: -6.4942 | relevance: 1.0000

### 33. src/app/session/v2/TimerService.jsx (6aa82d2e35207384d50fe8167b08484c2832b6359a72e1f116c48f838181fccf)
- bm25: -8.5765 | relevance: 1.0000

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

### 34. src/app/session/v2/SessionPageV2.jsx (6901b2515231f2d99a20bcde46d49e7c0e9b5be2b3bd802881ae99d1f766e5e8)
- bm25: -8.0757 | entity_overlap_w: 2.00 | adjusted: -8.5757 | relevance: 1.0000

// PIN gate: timeline jumps are facilitator-only
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timeline');
    } catch (e) {
      console.warn('[SessionPageV2] Timeline PIN gate error:', e);
    }
    if (!allowed) {
      timelineJumpInProgressRef.current = false;
      return;
    }
    
    console.log('[SessionPageV2] Timeline jump proceeding to:', targetPhase);
    
    // Stop any playing audio first
    stopAudioSafe({ force: true });
    
    // Reset opening actions state to prevent zombie UI
    setOpeningActionActive(false);
    setOpeningActionType(null);
    setOpeningActionState({});
    setOpeningActionInput('');
    setOpeningActionError('');
    setOpeningActionBusy(false);
    setShowPlayWithSonomaMenu(false);
    setShowGames(false);
    setShowFullscreenPlayTimer(false);

### 35. src/app/session/v2/TimerService.jsx (c366ffd95c213031782db363c3a2ba3af35515665534c9d34e73a8e41492b13b)
- bm25: -8.2847 | entity_overlap_w: 1.00 | adjusted: -8.5347 | relevance: 1.0000

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

### 36. src/app/session/v2/SessionPageV2.jsx (414493db530c7c207ea573d6381d6d0d332b04efffd785fb1451b61c0bb91536)
- bm25: -8.4732 | relevance: 1.0000

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
      persistAssessments(generatedWorksheet, generatedTest, generatedComprehension, questions);
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
        if (data.timerMode === 'play' || data.timerMode === 'work') {
          const prevMode = currentTimerModeRef.current?.exercise ?? null;
          if (prevMode !== data.timerMode) {
            setCurrentTimerMode((prev) => ({ ...prev, exercise: data.timerMode }));
            setTimerRefreshKey((k) => k + 1);
          }
        }

### 37. src/app/session/v2/SessionPageV2.jsx (e3459e38441acf56cdb5073987f2197a332c23ca97a16990fd29d9f8985ed995)
- bm25: -8.0897 | entity_overlap_w: 1.00 | adjusted: -8.3397 | relevance: 1.0000

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
  const currentTimerModeRef = useRef({
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
  const [workTimerDisplayRemaining, setWorkTime

### 38. src/app/session/v2/SessionPageV2.jsx (b320cc73b9de32c02f2ed764bc67d0ff721f297b2f9eecad46a4a76448c869bd)
- bm25: -8.3045 | relevance: 1.0000

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
        if (data.timerMode === 'play' || data.timerMode === 'work') {
          const prevMode = currentTimerModeRef.current?.worksheet ?? null;
          if (prevMode !== data.timerMode) {
            setCurrentTimerMode((prev) => ({ ...prev, worksheet: data.timerMode }));
            setTimerRefreshKey((k) => k + 1);
          }
        }
      }
    });
    
    // Subscribe to question events
    phase.on('questionStart', (data) => {
      addEvent(`ðŸ“ Worksheet ${data.questionIndex + 1}/${data.totalQuestions}`);

### 39. src/app/session/v2/SessionPageV2.jsx (d128641d1834b8bb45206abcbbdae7fd035e6ed9a09759daa0b2a339b057b575)
- bm25: -8.3045 | relevance: 1.0000

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
      persistAssessments(generatedWorksheet, generatedTest, questions, generatedExercise);
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
        if (data.timerMode === 'play' || data.timerMode === 'work') {
          const prevMode = currentTimerModeRef.current?.comprehension ?? null;
          if (prevMode !== data.timerMode) {
            setCurrentTimerMode((prev) => ({ ...prev, comprehension: data.timerMode }));
            setTimerRefr

### 40. sidekick_pack.md (61149be66caff7a6cb2aa7897dd961b1c01896dfefed3b76a7792a8ff26b642d)
- bm25: -7.8196 | entity_overlap_w: 1.00 | adjusted: -8.0696 | relevance: 1.0000

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
  }, [lessonKey, phaseTimers, applyRestoredTimerStateToUi]);

// Update play timer limits when bonus/enabled state changes (do not recreate TimerService).
  useEffect(() => {
    if (!timerServiceRef.current || !phaseTimers) return;

const playBonusSec = goldenKeysEnabledRef.current
      ? Math.max(0, Number(goldenKeyBonusRef.current || 0)) * 60
      : 0;
    const m2s = (m) => Math.max(0, Number(m || 0)) * 60;

### 36. sidekick_pack.md (249d14a61d0c4086fe9efad0dea5881bdba2339821c508c2b888543c2f6cd3e9)
- bm25: -5.5816 | relevance: 1.0000
