# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Search exact string: That's a great question! Keep thinking about it. Trace submitAskQuestion in OpeningActionsController.jsx and the /api/sonoma route. Identify when instructions can be empty causing 400, and how the client handles non-OK.
```

Filter terms used:
```text
/api/sonoma
OpeningActionsController.jsx
OpeningActionsController
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/sonoma OpeningActionsController.jsx OpeningActionsController

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (245e0cc95dbedc96d05b71036a9a6a95d29184b208148cad391ff77147dda68c)
- bm25: -19.5435 | entity_overlap_w: 13.50 | adjusted: -22.9185 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Ask feature breaks and says generic response. Trace submitAskQuestion -> /api/sonoma; why response is non-OK (400/500); fix contract so Ask returns reply.
```

Filter terms used:
```text
/api/sonoma
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/sonoma

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (c629389c992429a1e0cc7e0b4276ed479068b20dd9bcdfcc220219372b6ecf41)
- bm25: -5.8489 | entity_overlap_w: 6.00 | adjusted: -7.3489 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Ask feature breaks and says generic response. Trace V2 OpeningActionsController submitAskQuestion -> /api/sonoma route -> error handling; identify why it returns non-OK and triggers fallback. Also check V1 callMsSonoma /api/sonoma.
```

Filter terms used:
```text
/api/sonoma
OpeningActionsController
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/sonoma OpeningActionsController

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_restore_medal_emojis.md (5e467436a8fc850de89f10d14e4d764c87e3e493586289a6f6742212ebb0f9f0)
- bm25: -7.8413 | entity_overlap_w: 1.00 | adjusted: -8.0913 | relevance: 1.0000

### 2. sidekick_pack.md (40c36c74e462ca73870b17211e64df0adbb1fbbce7a0aa8d8c284fc2b6107141)
- bm25: -14.5616 | entity_overlap_w: 1.00 | adjusted: -14.8116 | relevance: 1.0000

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 3. sidekick_pack.md (452db46372100232f2ae2bd4872581ddc9c9c641b4745a57bc07d0905288fd10)
- bm25: -13.2573 | entity_overlap_w: 5.50 | adjusted: -14.6323 | relevance: 1.0000

### 2. sidekick_pack_restore_medal_emojis.md (b5356f7e8b1b72636df1d94e261c379426d65bc97353acd826aac0f99be8d422)
- bm25: -7.8413 | entity_overlap_w: 1.00 | adjusted: -8.0913 | relevance: 1.0000

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 3. sidekick_pack_restore_medal_emojis.md (351b89b1d26add69f904016b51303b1af4f7b8543f2291ee9365f736c68a09b1)
- bm25: -7.7575 | entity_overlap_w: 1.00 | adjusted: -8.0075 | relevance: 1.0000

### 2. sidekick_pack.md (43a6b0c545b54d56e09a12845e5dc96c0b65ef49d6853b8b1f1b23a05c5d2080)
- bm25: -6.1372 | entity_overlap_w: 4.50 | adjusted: -7.2622 | relevance: 1.0000

### 4. sidekick_pack.md (62cba6f499ec5721c393f64820dd3a72f3683faf7664c7fb191f106588f07f56)
- bm25: -6.8307 | entity_overlap_w: 4.50 | adjusted: -7.9557 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Ask Ms. Sonoma feature: UI label 'Ask', askState, and route '/api/sonoma' or '/api/ask'. Find where Ask request is sent, where failures are caught, and where a generic fallback answer string is returned.
```

Filter terms used:
```text
/api/ask
/api/sonoma
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/ask /api/sonoma

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/v2/SessionPageV2.jsx (efc0329e2f85d6b17d0b7ee7e155b5d6c77ac07573690feb4eed11d199c6cfbc)
- bm25: -9.0989 | relevance: 1.0000

if (!action) return null;

### 4. sidekick_pack_restore_medal_emojis.md (5e467436a8fc850de89f10d14e4d764c87e3e493586289a6f6742212ebb0f9f0)
- bm25: -14.3257 | entity_overlap_w: 1.00 | adjusted: -14.5757 | relevance: 1.0000

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 5. sidekick_pack_restore_medal_emojis.md (b5356f7e8b1b72636df1d94e261c379426d65bc97353acd826aac0f99be8d422)
- bm25: -14.3257 | entity_overlap_w: 1.00 | adjusted: -14.5757 | relevance: 1.0000

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 6. sidekick_pack_restore_medal_emojis.md (351b89b1d26add69f904016b51303b1af4f7b8543f2291ee9365f736c68a09b1)
- bm25: -14.1726 | entity_overlap_w: 1.00 | adjusted: -14.4226 | relevance: 1.0000

const openingController = new OpeningActionsController(
      eventBusRef.current,
      audioEngineRef.current,
      {
        phase: currentPhase,
        subject: lessonData.subject || 'math',
        learnerGrade: lessonData.grade || '',
        difficulty: lessonData.difficulty || 'moderate'
      }
    );

### 7. src/app/session/v2/SessionPageV2.jsx (b4571a43828d791b7d7ec7f305119d4beb102d5b0dcbd0fcdae772a9558fa324)
- bm25: -12.6802 | entity_overlap_w: 2.00 | adjusted: -13.1802 | relevance: 1.0000

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

### 8. src/app/session/v2/SessionPageV2.jsx (07ad42162efda0bdf14eaf0d58adc03d97e50b852d98d4c1c8c14c86f72fb7c7)
- bm25: -12.5343 | entity_overlap_w: 2.00 | adjusted: -13.0343 | relevance: 1.0000

// End tracked session (so Calendar history can detect this completion).
      try { stopSessionPolling?.(); } catch {}
      try {
        await endTrackedSession('completed', {
          source: 'session-v2',
          test_percentage: testGrade?.percentage ?? null,
        });
      } catch {}
      
      // Navigate to lessons page
      console.log('[SessionPageV2] Attempting navigation to lessons page');
      console.log('[SessionPageV2] router:', router);
      console.log('[SessionPageV2] router.push type:', typeof router?.push);
      try {
        if (router && typeof router.push === 'function') {
          console.log('[SessionPageV2] Using router.push');
          router.push('/learn/lessons');
        } else if (typeof window !== 'undefined') {
          console.log('[SessionPageV2] Using window.location.href');
          window.location.href = '/learn/lessons';
        }
      } catch (err) {
        console.error('[SessionPageV2] Navigation error:', err);
        if (typeof window !== 'undefined') {
          try { window.location.href = '/learn/lessons'; } catch {}
        }
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

const openingController = new OpeningActionsController(
      eventBusRef.current,
      audioEngineRef.current,
      {
        phase: currentPhase,
        subject: lessonData.subject || 'math',
        learnerGrade: lessonData.grade || '',
        difficulty: lessonData.difficulty || 'moderate'
      }
    );

### 9. sidekick_pack.md (40a0d8ea4de2800bcf02bf5a07222114145573603c687bb4f926650b6f9277b9)
- bm25: -12.3304 | entity_overlap_w: 2.50 | adjusted: -12.9554 | relevance: 1.0000

### 21. sidekick_pack_lessons_prefetch.md (acdde77a2d3b5ec1a0af546e25a2c87a2064ebc08b2186858c8afbfd447eb4c2)
- bm25: -5.0017 | relevance: 1.0000

When answering architecture questions or planning changes:
1. Build an evidence pack first:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere pack "<question>" --project freehands --profile MsSonoma --out pack.md`
2. Use the pack’s chunk IDs as evidence anchors (the IDs are the provenance tokens).

### 22. src/app/learn/lessons/page.js (d5beeb52789ee4491df2fa817b4e72a78686e5be0df840fd9c851365b185ecd6)
- bm25: -4.5604 | entity_overlap_w: 1.50 | adjusted: -4.9354 | relevance: 1.0000

useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } })
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

### 11. sidekick_pack_restore_medal_emojis.md (111a7a436303fda544c51432b8f742ed74566b8a33c1bcc166b2669609742d5c)
- bm25: -5.6248 | entity_overlap_w: 1.00 | adjusted: -5.8748 | relevance: 1.0000

const openingController = new OpeningActionsController(
      eventBusRef.current,
      audioEngineRef.current,
      {
        phase: currentPhase,
        subject: lessonData.subject || 'math',
        learnerGrade: lessonData.grade || '',
        difficulty: lessonData.difficulty || 'moderate'
      }
    );

### 2. src/app/session/v2/SessionPageV2.jsx (52f9de32315ef936bfe4cec88c67ac9dd7bc5afb09c7dce74279bab6de4cafb9)
- bm25: -7.6672 | entity_overlap_w: 1.50 | adjusted: -8.0422 | relevance: 1.0000

### 25. sidekick_pack.md (e4d87c91e5300a517f4c2de7c23178990466c61635e1bf955d2c53a524204c81)
- bm25: -4.4227 | relevance: 1.0000

### 10. sidekick_pack.md (b8e9a2c059bbf1542b9889c85d5723b75a67a79e56bdcc8e25001eccc2a09b65)
- bm25: -12.4204 | entity_overlap_w: 1.00 | adjusted: -12.6704 | relevance: 1.0000

// ------------------------------
  // Automatic Test Review Sequence
  // When the test target is reached and Ms. Sonoma has finished speaking, enter review.
  const enterTestReview = useCallback((options = {}) => {
    const disableSending = options?.disableSending;
    if (typeof subPhase === 'string' && subPhase.startsWith('review')) return;
    if (disableSending) {
      try { setCanSend(false); } catch {}
    }
    markWorkPhaseComplete('test');
    setCurrentTimerMode(prev => ({
      ...prev,
      test: null
    }));
    try { setSubPhase('review-start'); } catch {}
  }, [subPhase, markWorkPhaseComplete]);

### 30. src/app/session/page.js (0bcf0878b21326c1e51a3876323b5497c30f90797aa9f92573360880d9666a4b)
- bm25: -4.0596 | relevance: 1.0000

// ------------------------------
  // Automatic Test Review Sequence
  // When the test target is reached and Ms. Sonoma has finished speaking, enter review.
  const enterTestReview = useCallback((options = {}) => {
    const disableSending = options?.disableSending;
    if (typeof subPhase === 'string' && subPhase.startsWith('review')) return;
    if (disableSending) {
      try { setCanSend(false); } catch {}
    }
    markWorkPhaseComplete('test');
    setCurrentTimerMode(prev => ({
      ...prev,
      test: null
    }));
    try { setSubPhase('review-start'); } catch {}
  }, [subPhase, markWorkPhaseComplete]);

### 31. sidekick_pack.md (3e661cc5d3fa409417623474833b4cc3037b5edf02e5eda32f729b0d9a67b442)
- bm25: -4.0046 | relevance: 1.0000

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 11. sidekick_pack_restore_medal_emojis.md (111a7a436303fda544c51432b8f742ed74566b8a33c1bcc166b2669609742d5c)
- bm25: -10.9086 | entity_overlap_w: 1.00 | adjusted: -11.1586 | relevance: 1.0000

const openingController = new OpeningActionsController(
      eventBusRef.current,
      audioEngineRef.current,
      {
        phase: currentPhase,
        subject: lessonData.subject || 'math',
        learnerGrade: lessonData.grade || '',
        difficulty: lessonData.difficulty || 'moderate'
      }
    );

### 2. src/app/session/v2/SessionPageV2.jsx (52f9de32315ef936bfe4cec88c67ac9dd7bc5afb09c7dce74279bab6de4cafb9)
- bm25: -7.6672 | entity_overlap_w: 1.50 | adjusted: -8.0422 | relevance: 1.0000

const handleCancelTakeover = useCallback(() => {
    setShowTakeoverDialog(false);
    setConflictingSession(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/learn/lessons';
    }
  }, []);

### 3. src/app/learn/awards/page.js (4d8cce309e0f536106072dd471d5d29bbc535b069533182488b0980b7295cb15)
- bm25: -7.5123 | relevance: 1.0000

### 15. sidekick_pack.md (5520022241346e08d00cabde2f7310e6f40cb0b9857c7b6369925665dc906bbd)
- bm25: -4.5854 | entity_overlap_w: 3.00 | adjusted: -5.3354 | relevance: 1.0000

### 12. src/app/session/v2/SessionPageV2.jsx (3dee58ae6ebc8100a09fdea266cbb57f18d006016648f6bcb95a93442a6c9af6)
- bm25: -9.2590 | entity_overlap_w: 1.00 | adjusted: -9.5090 | relevance: 1.0000

// Opening actions helpers
  const speakSystemLine = useCallback(async (text) => {
    const spoken = String(text ?? '').trim();
    if (!spoken) return false;
    if (!audioEngineRef.current) return false;

// Prefer AudioEngine.speak when available (OpeningActionsController provides a shim)
    if (typeof audioEngineRef.current.speak === 'function') {
      try {
        await audioEngineRef.current.speak(spoken);
        return true;
      } catch (err) {
        console.warn('[SessionPageV2] speakSystemLine via speak() failed:', err);
      }
    }

try {
      const audioBase64 = await fetchTTS(spoken);
      await audioEngineRef.current.playAudio(audioBase64, [spoken]);
      return true;
    } catch (err) {
      console.warn('[SessionPageV2] speakSystemLine playback failed:', err);
      return false;
    }
  }, []);

const speakSystemLineHardened = useCallback(async (text) => {
    const spoken = String(text ?? '').trim();
    if (!spoken) return false;

// Try twice to handle race conditions right after a stop.
    const ok1 = await speakSystemLine(spoken);
    if (ok1) return true;

await new Promise((r) => setTimeout(r, 80));
    const ok2 = await speakSystemLine(spoken);
    if (!ok2) {
      console.warn('[SessionPageV2] speakSystemLineHardened failed to speak:', spoken);
    }
    return ok2;
  }, [speakSystemLine]);

### 13. sidekick_pack_restore_medal_emojis.md (4c32327dcf8b92c5ef6dac596e9677360c9dc6172a079021e0d2487234b9ca46)
- bm25: -8.8239 | entity_overlap_w: 1.00 | adjusted: -9.0739 | relevance: 1.0000

### 4. src/app/session/v2/SessionPageV2.jsx (2bc8e681bbd1556f75d0ce083dec1df5ac8c48a7151fbf63b711d25f84060648)
- bm25: -5.8071 | entity_overlap_w: 4.50 | adjusted: -6.9321 | relevance: 1.0000

// End tracked session (so Calendar history can detect this completion).
      try { stopSessionPolling?.(); } catch {}
      try {
        await endTrackedSession('completed', {
          source: 'session-v2',
          test_percentage: testGrade?.percentage ?? null,
        });
      } catch {}
      
      // Navigate to lessons page
      console.log('[SessionPageV2] Attempting navigation to lessons page');
      console.log('[SessionPageV2] router:', router);
      console.log('[SessionPageV2] router.push type:', typeof router?.push);
      try {
        if (router && typeof router.push === 'function') {
          console.log('[SessionPageV2] Using router.push');
          router.push('/learn/lessons');
        } else if (typeof window !== 'undefined') {
          console.log('[SessionPageV2] Using window.location.href');
          window.location.href = '/learn/lessons';
        }
      } catch (err) {
        console.error('[SessionPageV2] Navigation error:', err);
        if (typeof window !== 'undefined') {
          try { window.location.href = '/learn/lessons'; } catch {}
        }
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 14. sidekick_pack.md (5c686745c67a1646837884cc1b4317b4b28a6d4e6dc847995c0ac77550a1bec6)
- bm25: -5.6108 | entity_overlap_w: 1.50 | adjusted: -5.9858 | relevance: 1.0000

useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } })
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

### 15. sidekick_pack.md (1e1ff60ca560d2abade3f741d8b850b41daa18286b827a1aa5dd14539d882e2e)
- bm25: -5.9531 | relevance: 1.0000

### 5. src/app/session/v2/SessionPageV2.jsx (b4571a43828d791b7d7ec7f305119d4beb102d5b0dcbd0fcdae772a9558fa324)
- bm25: -6.6554 | entity_overlap_w: 2.00 | adjusted: -7.1554 | relevance: 1.0000

### 3. sidekick_pack.md (ef48e7eee1e778b15b1aa607230f47076d29062adafedeac61e4d6d5836582c0)
- bm25: -6.0654 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 16. sidekick_pack.md (0b4bcdb3fb1454d9cdb6c11859b73491bb19c8976e6ea3279400e040e0354501)
- bm25: -5.3232 | relevance: 1.0000

### 2. .github/copilot-instructions.md (e52caea170745fc1683b39903882c41423525bdca8f3020661944d316c296134)
- bm25: -8.4272 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

When answering architecture questions or planning changes:
1. Build an evidence pack first:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere pack "<question>" --project freehands --profile MsSonoma --out pack.md`
2. Use the pack’s chunk IDs as evidence anchors (the IDs are the provenance tokens).

### Asking Good Pack Questions (REQUIRED)

### 16. sidekick_pack.md (f8d40b36e8948dee34c7024515e2ab86a2acbea36b295f1a0cf564d9e4f58115)
- bm25: -5.7702 | relevance: 1.0000

### 4. sidekick_pack.md (79b1a308d54e6daf4a372e947ab275bed45a4cda80265ffaf28f1ae367638df3)
- bm25: -5.8586 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 5. sidekick_pack.md (928450156f1adeff1476ccd94d1efc56bb7355e8185a0b5c9243a9eb948fccc3)
- bm25: -5.8586 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 6. sidekick_pack.md (acba2cd28e06e2b96d0f512a6eb555b9a41010bb0a88c41ed2826dfc1e86603c)
- bm25: -5.5653 | relevance: 1.0000

### 17. sidekick_pack.md (75157e5d04790025ae60f7db246d3c49af51b9e63e372d59bdff7b6865c53f50)
- bm25: -5.7261 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 18. src/app/session/v2/SessionPageV2.jsx (762b3f4fff72e8f7116b8b26971018abd044c3e578205eefd2abb17c543695bd)
- bm25: -5.6399 | relevance: 1.0000

// If an opening action starts, collapse the Play-with-Sonoma menu
  useEffect(() => {
    if (openingActionActive) {
      setShowPlayWithSonomaMenu(false);
    }
  }, [openingActionActive]);

### 19. sidekick_pack.md (0625d1df046cd4b1b6583748db98881b8b7486fc9804c08b01f7159a6ae42bdb)
- bm25: -5.4394 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 20. sidekick_pack.md (649931696538a2adc4a6c317782db8b800fd631074634466cde091fa02f20d65)
- bm25: -5.4394 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 21. sidekick_pack.md (a35d3dceda24026347f6cec88a513c9c10e5449fa52fa3b0c76caa3a337ee845)
- bm25: -5.4394 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 22. src/app/session/page.js (78de9349e84daae9468d8a363f3e5898f0db5accdada63da46f61e57ebb275fc)
- bm25: -4.6867 | entity_overlap_w: 3.00 | adjusted: -5.4367 | relevance: 1.0000

// Always include innertext when provided so the backend can log/use it
  let { res, data } = await attempt({ instruction: userContent, innertext });

// Dev-only: sometimes the route compiles on first touch and returns 404 briefly.
      // If that happens, pre-warm the route, wait a beat, and retry (forcing full system registration).
      if (res && res.status === 404) {
        // Pre-warm the route (GET) to trigger compilation/registration in dev
        try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
        await new Promise(r => setTimeout(r, 900));
  ({ res, data } = await attempt({ instruction: userContent, innertext }));
        // If still 404, wait a bit longer and try one more time
        if (res && res.status === 404) {
          try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
          await new Promise(r => setTimeout(r, 1200));
          ({ res, data } = await attempt({ instruction: userContent, innertext }));
        }
      }

// Stateless call: server receives only the instruction text

if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }

### 23. .github/copilot-instructions.md (5881b38a2bf6f0706d17a2c60153172fdd6bb3f02d202b178ebc202c9e440520)
- bm25: -5.4337 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 24. sidekick_pack.md (8bc3db702f88d703d72957465ff1577b3d74346a2f00830c59b8e8925c79bb2f)
- bm25: -5.3120 | relevance: 1.0000

### 7. sidekick_pack.md (c9bd4659630a94543c03e97ae672b30c8ebcc8b71023b69947d31e8660b94265)
- bm25: -5.5653 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 8. .github/copilot-instructions.md (5881b38a2bf6f0706d17a2c60153172fdd6bb3f02d202b178ebc202c9e440520)
- bm25: -5.5595 | relevance: 1.0000

### 25. sidekick_pack.md (550c3e7a7c99228b182eaa586db27d393e9436e70baef619b72c14eca88cacca)
- bm25: -5.1597 | relevance: 1.0000

### 39. .github/copilot-instructions.md (5881b38a2bf6f0706d17a2c60153172fdd6bb3f02d202b178ebc202c9e440520)
- bm25: -12.6819 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 40. sidekick_pack_mentor_schema.md (7b9e34a5f9903cdaa3183773337bc2ab39af5dc019f6678858d9220d46e15e9b)
- bm25: -12.6688 | relevance: 1.0000

let events = []
    try {
      let eventsQueryBase = () => {
        let q = supabase
          .from('lesson_session_events')
          .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
          .eq('learner_id', learnerId)

### 26. sidekick_pack.md (d508392c8ece9e9f6ccdffc73a649d45f72ef164d21296949bff544b1541655f)
- bm25: -5.1546 | relevance: 1.0000

### 8. sidekick_pack.md (8012a83541b70abece362659818fad1353c952f08d764fe8ef9842ae2c0b9c2c)
- bm25: -5.8879 | relevance: 1.0000

### 11. sidekick_pack.md (d3a5f295e4d23b45fa358eb9f87883fd9c5fb90d1986ab6924ec2bf013b7cc02)
- bm25: -5.3911 | relevance: 1.0000

### 9. .github/copilot-instructions.md (5881b38a2bf6f0706d17a2c60153172fdd6bb3f02d202b178ebc202c9e440520)
- bm25: -5.8818 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 10. sidekick_pack.md (afc8763c488e753d7c07b37f89c1d9e11ffe28a79b3592bea4c9cd0b16a8bcd2)
- bm25: -5.5042 | entity_overlap_w: 1.50 | adjusted: -5.8792 | relevance: 1.0000

### 27. sidekick_pack_lessons_prefetch.md (44ce5c2663d9e1d524aded1bd7f88fcf4f33b05e9623c281df9df6b0c20e17f3)
- bm25: -5.1495 | relevance: 1.0000

### 39. .github/copilot-instructions.md (5881b38a2bf6f0706d17a2c60153172fdd6bb3f02d202b178ebc202c9e440520)
- bm25: -12.6819 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 40. sidekick_pack_mentor_schema.md (7b9e34a5f9903cdaa3183773337bc2ab39af5dc019f6678858d9220d46e15e9b)
- bm25: -12.6688 | relevance: 1.0000

let events = []
    try {
      let eventsQueryBase = () => {
        let q = supabase
          .from('lesson_session_events')
          .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
          .eq('learner_id', learnerId)

### 28. sidekick_pack.md (723050d479600e4930b59121b5c7133c8706ab1287f4970606359a9c249ae449)
- bm25: -4.3439 | entity_overlap_w: 3.00 | adjusted: -5.0939 | relevance: 1.0000

// Always include innertext when provided so the backend can log/use it
  let { res, data } = await attempt({ instruction: userContent, innertext });

// Dev-only: sometimes the route compiles on first touch and returns 404 briefly.
      // If that happens, pre-warm the route, wait a beat, and retry (forcing full system registration).
      if (res && res.status === 404) {
        // Pre-warm the route (GET) to trigger compilation/registration in dev
        try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
        await new Promise(r => setTimeout(r, 900));
  ({ res, data } = await attempt({ instruction: userContent, innertext }));
        // If still 404, wait a bit longer and try one more time
        if (res && res.status === 404) {
          try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
          await new Promise(r => setTimeout(r, 1200));
          ({ res, data } = await attempt({ instruction: userContent, innertext }));
        }
      }

// Stateless call: server receives only the instruction text

if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }

### 6. .github/copilot-instructions.md (5881b38a2bf6f0706d17a2c60153172fdd6bb3f02d202b178ebc202c9e440520)
- bm25: -6.7265 | relevance: 1.0000

### 14. sidekick_pack_lessons_prefetch.md (44ce5c2663d9e1d524aded1bd7f88fcf4f33b05e9623c281df9df6b0c20e17f3)
- bm25: -5.5742 | relevance: 1.0000

### 39. .github/copilot-instructions.md (5881b38a2bf6f0706d17a2c60153172fdd6bb3f02d202b178ebc202c9e440520)
- bm25: -12.6819 | relevance: 1.0000

### 29. sidekick_pack_lessons_prefetch.md (ad20abe9e3d1b949488a8586540eecc8eee24eb2e8302e04d7e4360a6f6e4d13)
- bm25: -5.0622 | relevance: 1.0000

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

lesson_schedule lesson_schedule_keys planned_lessons

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -4.5542 | entity_overlap_w: 1.00 | adjusted: -4.8042 | relevance: 1.0000

// Delete existing planned lessons ONLY for dates in the new plan
    // This allows multiple non-overlapping plans to coexist
    if (newPlanDates.length > 0) {
      await adminSupabase
        .from('planned_lessons')
        .delete()
        .eq('learner_id', learnerId)
        .eq('facilitator_id', user.id)
        .in('scheduled_date', newPlanDates)
    }

### 2. src/app/api/planned-lessons/route.js (db1a9cc005c7ceee5fb09554e6f8802d9c3c6b43eda28afc6d987b8be33f1c49)
- bm25: -4.3282 | entity_overlap_w: 1.00 | adjusted: -4.5782 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 4. .github/copilot-instructions.md (e52caea170745fc1683b39903882c41423525bdca8f3020661944d316c296134)
- bm25: -23.7089 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 30. sidekick_pack.md (80dc12ca4e4bdbf1a3640695b626dc3c54e6a59fed2024e06d59c8359cb99adb)
- bm25: -4.2900 | entity_overlap_w: 3.00 | adjusted: -5.0400 | relevance: 1.0000

### 9. src/app/session/page.js (78de9349e84daae9468d8a363f3e5898f0db5accdada63da46f61e57ebb275fc)
- bm25: -4.7676 | entity_overlap_w: 3.00 | adjusted: -5.5176 | relevance: 1.0000

// Always include innertext when provided so the backend can log/use it
  let { res, data } = await attempt({ instruction: userContent, innertext });

// Dev-only: sometimes the route compiles on first touch and returns 404 briefly.
      // If that happens, pre-warm the route, wait a beat, and retry (forcing full system registration).
      if (res && res.status === 404) {
        // Pre-warm the route (GET) to trigger compilation/registration in dev
        try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
        await new Promise(r => setTimeout(r, 900));
  ({ res, data } = await attempt({ instruction: userContent, innertext }));
        // If still 404, wait a bit longer and try one more time
        if (res && res.status === 404) {
          try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
          await new Promise(r => setTimeout(r, 1200));
          ({ res, data } = await attempt({ instruction: userContent, innertext }));
        }
      }

// Stateless call: server receives only the instruction text

if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }

### 10. sidekick_pack.md (5cb0587978f821619316693d47ac65fdf6ce56b2f15ebd6b019ec91ec4d63c38)
- bm25: -5.4406 | relevance: 1.0000

### 7. sidekick_pack.md (3db9d93cf97448826f5760a99fa44792b7c648ffd7e4215ecee227454f2dfd87)
- bm25: -5.8879 | relevance: 1.0000

### 31. sidekick_pack.md (fdf94e15c960e21a38fe2f0dce1b5c196777dff6eae5316839de9e47e23728d0)
- bm25: -5.0215 | relevance: 1.0000

# GitHub Copilot Instructions for Ms. Sonoma Project (freehands directory only)

### 32. sidekick_pack.md (1b61f4fe4862fc25d0497146c4303756a91b0d07e819c664fc6925e8749b04af)
- bm25: -4.2118 | entity_overlap_w: 3.00 | adjusted: -4.9618 | relevance: 1.0000

### 15. sidekick_pack.md (5520022241346e08d00cabde2f7310e6f40cb0b9857c7b6369925665dc906bbd)
- bm25: -4.5854 | entity_overlap_w: 3.00 | adjusted: -5.3354 | relevance: 1.0000

### 12. src/app/session/page.js (78de9349e84daae9468d8a363f3e5898f0db5accdada63da46f61e57ebb275fc)
- bm25: -5.0123 | entity_overlap_w: 3.00 | adjusted: -5.7623 | relevance: 1.0000

// Always include innertext when provided so the backend can log/use it
  let { res, data } = await attempt({ instruction: userContent, innertext });

// Dev-only: sometimes the route compiles on first touch and returns 404 briefly.
      // If that happens, pre-warm the route, wait a beat, and retry (forcing full system registration).
      if (res && res.status === 404) {
        // Pre-warm the route (GET) to trigger compilation/registration in dev
        try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
        await new Promise(r => setTimeout(r, 900));
  ({ res, data } = await attempt({ instruction: userContent, innertext }));
        // If still 404, wait a bit longer and try one more time
        if (res && res.status === 404) {
          try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
          await new Promise(r => setTimeout(r, 1200));
          ({ res, data } = await attempt({ instruction: userContent, innertext }));
        }
      }

// Stateless call: server receives only the instruction text

if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }

### 16. .github/copilot-instructions.md (14c858f58463489bcd7ea81f70721b0de92bf7105c73a2fab6f1ec0a5a4356d0)
- bm25: -4.9651 | relevance: 1.0000

### 33. sidekick_pack.md (1b2bc0c9722a2765d89cadb83cb7090677a0dc94b8c7baa3fb9387714463b3ea)
- bm25: -4.9177 | relevance: 1.0000

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

lesson_schedule lesson_schedule_keys planned_lessons

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -4.5542 | entity_overlap_w: 1.00 | adjusted: -4.8042 | relevance: 1.0000

// Delete existing planned lessons ONLY for dates in the new plan
    // This allows multiple non-overlapping plans to coexist
    if (newPlanDates.length > 0) {
      await adminSupabase
        .from('planned_lessons')
        .delete()
        .eq('learner_id', learnerId)
        .eq('facilitator_id', user.id)
        .in('scheduled_date', newPlanDates)
    }

### 2. src/app/api/planned-lessons/route.js (db1a9cc005c7ceee5fb09554e6f8802d9c3c6b43eda28afc6d987b8be33f1c49)
- bm25: -4.3282 | entity_overlap_w: 1.00 | adjusted: -4.5782 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 4. .github/copilot-instructions.md (e52caea170745fc1683b39903882c41423525bdca8f3020661944d316c296134)
- bm25: -23.7089 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 15. sidekick_pack.md (23a5a50bb72745bcbe94cfbcfa923f4d10719b079395f3fb1804f23a284e91c7)
- bm25: -4.2673 | entity_overlap_w: 3.00 | adjusted: -5.0173 | relevance: 1.0000

### 34. .github/copilot-instructions.md (14c858f58463489bcd7ea81f70721b0de92bf7105c73a2fab6f1ec0a5a4356d0)
- bm25: -4.8527 | relevance: 1.0000

# GitHub Copilot Instructions for Ms. Sonoma Project (freehands directory only)

## COHERE WORKFLOW (REQUIRED)

## Recon (Use Cohere)

You MUST consult Cohere first before any other source of information. When you don’t fully understand a concept/area of the repo, do recon first using Cohere.

## Round Protocol (Required)

For every non-trivial Copilot turn (anything beyond a short yes/no), you MUST do the following BEFORE answering:

1) Update Cohere (keep DB current)
- Ensure a watcher is running for this repo (preferred):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project add freehands C:\Users\atari\freehands | Out-Null`
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sk watch -a MsSonoma -p freehands`
- If you cannot keep a watcher running, then you MUST at least ingest the file(s) you are about to discuss/change before generating packs:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <path> --project freehands [--recursive]`

2) Consult Cohere (recon pack)
- Run recon using the latest user prompt text:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sk r -a MsSonoma -t "<latest user prompt>" --out sidekick_pack.md --journal-out sidekick_rounds.jsonl`
- Then read/use `sidekick_pack.md` when forming the answer.

If you cannot run Cohere commands in this session, you MUST say that explicitly and ask the user to run them and paste the results.

### 35. sidekick_pack.md (6bde3bf81127ab14cb9a6023ef0c2874101ed4669d84d0329d517a45e1af1080)
- bm25: -4.8264 | relevance: 1.0000

// If an opening action starts, collapse the Play-with-Sonoma menu
  useEffect(() => {
    if (openingActionActive) {
      setShowPlayWithSonomaMenu(false);
    }
  }, [openingActionActive]);

### 36. .github/copilot-instructions.md (e52caea170745fc1683b39903882c41423525bdca8f3020661944d316c296134)
- bm25: -4.7814 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

When answering architecture questions or planning changes:
1. Build an evidence pack first:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere pack "<question>" --project freehands --profile MsSonoma --out pack.md`
2. Use the pack’s chunk IDs as evidence anchors (the IDs are the provenance tokens).

### Asking Good Pack Questions (REQUIRED)

Do not ask abstract questions first. Anchor pack questions on one of:
- Exact error text / log line
- Route/path (e.g., `/session/discussion`, `/api/...`)
- File name / folder name
- Env var name
- UI label text
- Function/class identifier

Use these templates (copy/paste and fill in anchors):
- "Where is `<feature>` implemented end-to-end? List entrypoints, key files, and data flow."
- "Where is route `<route>` defined and what calls it? Include middleware and handlers."
- "Search for the exact string `<error or label>` and show the controlling code path."
- "What reads/writes `<data file or table>` and under what conditions?"
- "What configuration keys/env vars control `<system>` and where are they read?"
- "Given file `<path>`, what other modules depend on it (imports/calls) and why?"

If pack #1 doesn't contain the entrypoint you need:
1. Re-pack with a tighter anchor (prefer an exact string, route, or filename).
2. If still missing, ingest/sync the relevant subtree, then re-pack.

### 37. sidekick_pack.md (838a17f499a788f2284df1ea31c7b16b4602a43178995e54e17390741048b9a1)
- bm25: -4.7675 | relevance: 1.0000

## COHERE WORKFLOW (REQUIRED)

## Recon (Use Cohere)

You MUST consult Cohere first before any other source of information. When you don’t fully understand a concept/area of the repo, do recon first using Cohere.

## Round Protocol (Required)

For every non-trivial Copilot turn (anything beyond a short yes/no), you MUST do the following BEFORE answering:

1) Update Cohere (keep DB current)
- Ensure a watcher is running for this repo (preferred):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project add freehands C:\Users\atari\freehands | Out-Null`
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sk watch -a MsSonoma -p freehands`
- If you cannot keep a watcher running, then you MUST at least ingest the file(s) you are about to discuss/change before generating packs:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <path> --project freehands [--recursive]`

2) Consult Cohere (recon pack)
- Run recon using the latest user prompt text:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sk r -a MsSonoma -t "<latest user prompt>" --out sidekick_pack.md --journal-out sidekick_rounds.jsonl`
- Then read/use `sidekick_pack.md` when forming the answer.

If you cannot run Cohere commands in this session, you MUST say that explicitly and ask the user to run them and paste the results.

### 17. sidekick_pack.md (a0527fb49e3a59bb293de410b2bd24801a3fca3769d8ba1955ebb6088dce08f8)
- bm25: -4.9049 | relevance: 1.0000

# GitHub Copilot Instructions for Ms. Sonoma Project (freehands directory only)

## COHERE WORKFLOW (REQUIRED)

## Recon (Use Cohere)

### 38. sidekick_pack.md (f91d3b8cba980701aee71464ae69d5c9ce265b074e2548bc028baf359beb27ce)
- bm25: -4.7364 | relevance: 1.0000

### 18. .github/copilot-instructions.md (14c858f58463489bcd7ea81f70721b0de92bf7105c73a2fab6f1ec0a5a4356d0)
- bm25: -5.2529 | relevance: 1.0000

# GitHub Copilot Instructions for Ms. Sonoma Project (freehands directory only)

## COHERE WORKFLOW (REQUIRED)

## Recon (Use Cohere)

You MUST consult Cohere first before any other source of information. When you don’t fully understand a concept/area of the repo, do recon first using Cohere.

## Round Protocol (Required)

For every non-trivial Copilot turn (anything beyond a short yes/no), you MUST do the following BEFORE answering:

1) Update Cohere (keep DB current)
- Ensure a watcher is running for this repo (preferred):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project add freehands C:\Users\atari\freehands | Out-Null`
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sk watch -a MsSonoma -p freehands`
- If you cannot keep a watcher running, then you MUST at least ingest the file(s) you are about to discuss/change before generating packs:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <path> --project freehands [--recursive]`

2) Consult Cohere (recon pack)
- Run recon using the latest user prompt text:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sk r -a MsSonoma -t "<latest user prompt>" --out sidekick_pack.md --journal-out sidekick_rounds.jsonl`
- Then read/use `sidekick_pack.md` when forming the answer.

If you cannot run Cohere commands in this session, you MUST say that explicitly and ask the user to run them and paste the results.

### 19. sidekick_pack.md (e1ef0694955283f1d1bc66b51eb871672b603d72faf23366fc466904d1c04469)
- bm25: -5.1893 | relevance: 1.0000

### 39. sidekick_pack.md (02eaa4ed481f5325ed1674242315d237b021c180d12ea290012e62bf86664c3b)
- bm25: -4.3392 | entity_overlap_w: 1.50 | adjusted: -4.7142 | relevance: 1.0000

{
	"version": "2.0.0",
	"tasks": [
		{
			"label": "Start Next.js dev server",
			"type": "shell",
			"command": "npm",
			"args": [
				"run",
				"-s",
				"dev"
			],
			"isBackground": true,
			"group": {
				"kind": "build",
				"isDefault": true
			},
			"problemMatcher": []
		},
		{
			"label": "Build Next.js for sanity",
			"type": "shell",
			"command": "npm",
			"args": [
				"run",
				"-s",
				"build"
			],
			"group": "build",
			"problemMatcher": []
		},
		{
			"label": "Kill port 3001",
			"type": "shell",
			"command": "powershell",
			"args": [
				"-NoProfile",
				"-Command",
				"Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force } catch {} }"
			],
			"problemMatcher": []
		},
		{
			"label": "Restart dev on 3001",
			"type": "shell",
			"command": "powershell",
			"args": [
				"-NoProfile",
				"-Command",
				"Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force } catch {} }; npm run -s dev"
			],
			"isBackground": true,
			"problemMatcher": []
		},
		{
			"label": "Smoke: POST /api/sonoma",
			"type": "shell",
			"command": "powershell",
			"args": [
				"-NoProfile",
				"-ExecutionPolicy",
				"Bypass",
				"-File",
				"${workspaceFolder}\\scripts\\smoke-post-sonoma.ps1"
			],
			"problemMatcher": []
		},
		{
			"label": "Clean .next cache",
			"type": "shell",
			"command": "powershell",
			"args": [
				"-NoProfile",
				"-Command",
				"try { Remove-Item -Path .next -Recurse -Force -ErrorAction SilentlyContinue } catch {}; try { Remove-Item -Path .next-dev -Recurse -Force -ErrorAction SilentlyContinue } catch {}; try { Remove-Item -Path .turbo -Recurs

### 40. .vscode/tasks.json (7f0a4943c72a7afe52a5f1a79083df4f3163eec7ae4ee33693cf108694530eff)
- bm25: -4.3392 | entity_overlap_w: 1.50 | adjusted: -4.7142 | relevance: 1.0000

{
	"version": "2.0.0",
	"tasks": [
		{
			"label": "Start Next.js dev server",
			"type": "shell",
			"command": "npm",
			"args": [
				"run",
				"-s",
				"dev"
			],
			"isBackground": true,
			"group": {
				"kind": "build",
				"isDefault": true
			},
			"problemMatcher": []
		},
		{
			"label": "Build Next.js for sanity",
			"type": "shell",
			"command": "npm",
			"args": [
				"run",
				"-s",
				"build"
			],
			"group": "build",
			"problemMatcher": []
		},
		{
			"label": "Kill port 3001",
			"type": "shell",
			"command": "powershell",
			"args": [
				"-NoProfile",
				"-Command",
				"Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force } catch {} }"
			],
			"problemMatcher": []
		},
		{
			"label": "Restart dev on 3001",
			"type": "shell",
			"command": "powershell",
			"args": [
				"-NoProfile",
				"-Command",
				"Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force } catch {} }; npm run -s dev"
			],
			"isBackground": true,
			"problemMatcher": []
		},
		{
			"label": "Smoke: POST /api/sonoma",
			"type": "shell",
			"command": "powershell",
			"args": [
				"-NoProfile",
				"-ExecutionPolicy",
				"Bypass",
				"-File",
				"${workspaceFolder}\\scripts\\smoke-post-sonoma.ps1"
			],
			"problemMatcher": []
		},
		{
			"label": "Clean .next cache",
			"type": "shell",
			"command": "powershell",
			"args": [
				"-NoProfile",
				"-Command",
				"try { Remove-Item -Path .next -Recurse -Force -ErrorAction SilentlyContinue } catch {}; try { Remove-Item -Path .next-dev -Recurse -Force -ErrorAction SilentlyContinue } catch {}; try { Remove-Item -Path .turbo -Recurs
