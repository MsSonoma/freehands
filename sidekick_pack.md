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

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 2. sidekick_pack_restore_medal_emojis.md (b5356f7e8b1b72636df1d94e261c379426d65bc97353acd826aac0f99be8d422)
- bm25: -7.8413 | entity_overlap_w: 1.00 | adjusted: -8.0913 | relevance: 1.0000

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 3. sidekick_pack_restore_medal_emojis.md (351b89b1d26add69f904016b51303b1af4f7b8543f2291ee9365f736c68a09b1)
- bm25: -7.7575 | entity_overlap_w: 1.00 | adjusted: -8.0075 | relevance: 1.0000

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

if (action === 'ask') {
              const phaseAlias = normalizePhaseAlias(currentPhase);
              const hasActiveQuestion = (
                (phaseAlias === 'comprehension' && !!currentComprehensionQuestion) ||
                (phaseAlias === 'exercise' && !!currentExerciseQuestion) ||
                (phaseAlias === 'worksheet' && !!currentWorksheetQuestion)
              );

### 5. src/app/session/v2/SessionPageV2.jsx (b4571a43828d791b7d7ec7f305119d4beb102d5b0dcbd0fcdae772a9558fa324)
- bm25: -6.6554 | entity_overlap_w: 2.00 | adjusted: -7.1554 | relevance: 1.0000

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

### 6. src/app/session/v2/SessionPageV2.jsx (07ad42162efda0bdf14eaf0d58adc03d97e50b852d98d4c1c8c14c86f72fb7c7)
- bm25: -6.5800 | entity_overlap_w: 2.00 | adjusted: -7.0800 | relevance: 1.0000

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

### 7. sidekick_pack.md (3db9d93cf97448826f5760a99fa44792b7c648ffd7e4215ecee227454f2dfd87)
- bm25: -5.8879 | relevance: 1.0000

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

### 8. sidekick_pack.md (8012a83541b70abece362659818fad1353c952f08d764fe8ef9842ae2c0b9c2c)
- bm25: -5.8879 | relevance: 1.0000

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

Treat Cohere as a local CLI + local DB (under `%USERPROFILE%\.coherence_apps\ms_sonoma\` for this workspace), not a networked service.
- If the user asks whether Cohere is "online", interpret it as: "can we run the local `py -m cohere ...` commands here?"
- Do not claim any network connectivity to external services.

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

### 13. sidekick_pack.md (92af34da0fc35394ace70c7fc1cf41334a0b0b123a906363a3e2fc9d20e25a18)
- bm25: -4.9018 | entity_overlap_w: 3.00 | adjusted: -5.6518 | relevance: 1.0000

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

### 15. sidekick_pack_lessons_prefetch.md (ad20abe9e3d1b949488a8586540eecc8eee24eb2e8302e04d7e4360a6f6e4d13)
- bm25: -5.4229 | relevance: 1.0000

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

### 17. sidekick_pack.md (7936ee6e6bfaff5c1908910ce65222c1388b4421c04db68e466d160cac1cfaff)
- bm25: -5.3220 | relevance: 1.0000

### 7. sidekick_pack_lessons_prefetch.md (ad20abe9e3d1b949488a8586540eecc8eee24eb2e8302e04d7e4360a6f6e4d13)
- bm25: -6.6545 | relevance: 1.0000

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

### 3. .github/copilot-instructions.md (14c858f58463489bcd7ea81f70721b0de92bf7105c73a2fab6f1ec0a5a4356d0)
- bm25: -8.4174 | relevance: 1.0000

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

### 20. .github/copilot-instructions.md (e52caea170745fc1683b39903882c41423525bdca8f3020661944d316c296134)
- bm25: -5.1440 | relevance: 1.0000

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

### 21. src/app/session/v2/SessionPageV2.jsx (762b3f4fff72e8f7116b8b26971018abd044c3e578205eefd2abb17c543695bd)
- bm25: -5.1387 | relevance: 1.0000

// If an opening action starts, collapse the Play-with-Sonoma menu
  useEffect(() => {
    if (openingActionActive) {
      setShowPlayWithSonomaMenu(false);
    }
  }, [openingActionActive]);

### 22. sidekick_pack.md (0a6e8c84351805e045504a02f9fcd5b27580f778ad4c25a4d66d920124e2d7ed)
- bm25: -4.6564 | entity_overlap_w: 1.50 | adjusted: -5.0314 | relevance: 1.0000

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

### 23. .vscode/tasks.json (7f0a4943c72a7afe52a5f1a79083df4f3163eec7ae4ee33693cf108694530eff)
- bm25: -4.6564 | entity_overlap_w: 1.50 | adjusted: -5.0314 | relevance: 1.0000

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

### 24. src/app/session/v2/SessionPageV2.jsx (3dee58ae6ebc8100a09fdea266cbb57f18d006016648f6bcb95a93442a6c9af6)
- bm25: -4.7744 | entity_overlap_w: 1.00 | adjusted: -5.0244 | relevance: 1.0000

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

### 25. sidekick_pack_restore_medal_emojis.md (4c32327dcf8b92c5ef6dac596e9677360c9dc6172a079021e0d2487234b9ca46)
- bm25: -4.5501 | entity_overlap_w: 1.00 | adjusted: -4.8001 | relevance: 1.0000

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

### 26. .github/copilot-instructions.md (6222a75becd01f34b6617370f90eb3104c3e8baa04ace7c4f70dd386ab814478)
- bm25: -4.3748 | relevance: 1.0000

Treat Cohere as a local CLI + local DB (under `%USERPROFILE%\.coherence_apps\ms_sonoma\` for this workspace), not a networked service.
- If the user asks whether Cohere is "online", interpret it as: "can we run the local `py -m cohere ...` commands here?"
- Do not claim any network connectivity to external services.

### 27. sidekick_pack_lessons_prefetch.md (acdde77a2d3b5ec1a0af546e25a2c87a2064ebc08b2186858c8afbfd447eb4c2)
- bm25: -4.3748 | relevance: 1.0000

When answering architecture questions or planning changes:
1. Build an evidence pack first:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere pack "<question>" --project freehands --profile MsSonoma --out pack.md`
2. Use the pack’s chunk IDs as evidence anchors (the IDs are the provenance tokens).

### 28. src/app/session/page.js (0bcf0878b21326c1e51a3876323b5497c30f90797aa9f92573360880d9666a4b)
- bm25: -4.2950 | relevance: 1.0000

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

### 29. sidekick_pack.md (3efc33e9291c6dca75db1abfd84cdcc4048781f8348f31436219fa45a4a5cd3e)
- bm25: -4.2178 | relevance: 1.0000

// Mark guard as sent for this phase only after a successful reply
  setPhaseGuardSent((prev) => (prev[phaseKey] ? prev : { ...prev, [phaseKey]: true }));
  // Expose the sanitized reply text so callers (e.g., riddle judge/hint) can use it directly
  return { success: true, data, text: replyText };
    } catch (err) {
      // Some runtimes surface aborts with name 'AbortError', others pass through the reason (e.g., 'skip')
      const isAbort = err?.name === 'AbortError' || err === 'skip' || err?.message === 'skip' || err?.cause === 'skip';
      if (isAbort) {
        setLoading(false);
        return { success: false, aborted: true };
      }
      setTranscript("Ms. Sonoma is unavailable.");
      setError("We could not reach Ms. Sonoma.");
      // Keep previous caption on screen to avoid a blank stall
      return { success: false, error: err };
    } finally {
      // Loading already cleared earlier once reply text was prepared
      // For fastReturn flows, do NOT tear down audio here; let the audio lifecycle manage isSpeaking/video.
      if (!opts.fastReturn) {
        try { setIsSpeaking(false); } catch {}
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch {}
          audioRef.current = null;
        }
      }
      // Clear controller
      if (sonomaAbortRef.current) sonomaAbortRef.current = null;
    }
  };

### 30. src/app/session/page.js (70927510c154bcbcaeabd2938e68a02853cdd647a3ee06529c7c7499acdf2ff5)
- bm25: -4.1990 | relevance: 1.0000

// Mark guard as sent for this phase only after a successful reply
  setPhaseGuardSent((prev) => (prev[phaseKey] ? prev : { ...prev, [phaseKey]: true }));
  // Expose the sanitized reply text so callers (e.g., riddle judge/hint) can use it directly
  return { success: true, data, text: replyText };
    } catch (err) {
      // Some runtimes surface aborts with name 'AbortError', others pass through the reason (e.g., 'skip')
      const isAbort = err?.name === 'AbortError' || err === 'skip' || err?.message === 'skip' || err?.cause === 'skip';
      if (isAbort) {
        setLoading(false);
        return { success: false, aborted: true };
      }
      setTranscript("Ms. Sonoma is unavailable.");
      setError("We could not reach Ms. Sonoma.");
      // Keep previous caption on screen to avoid a blank stall
      return { success: false, error: err };
    } finally {
      // Loading already cleared earlier once reply text was prepared
      // For fastReturn flows, do NOT tear down audio here; let the audio lifecycle manage isSpeaking/video.
      if (!opts.fastReturn) {
        try { setIsSpeaking(false); } catch {}
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch {}
          audioRef.current = null;
        }
      }
      // Clear controller
      if (sonomaAbortRef.current) sonomaAbortRef.current = null;
    }
  };

### 31. sidekick_pack.md (1b776805293bcd08702e5e1fdb90d35a52f7ab1070aecf5e9126937dce4ffd45)
- bm25: -4.0678 | relevance: 1.0000

### 34. src/app/session/v2/SessionPageV2.jsx (2de59be96aa49dc5ad4c1caf8c83a59d39f4996a9987150ee618644bfc888b8f)
- bm25: -4.3350 | relevance: 1.0000

<button
                      onClick={() => setShowPlayWithSonomaMenu(true)}
                      style={{
                        padding: '8px 16px',
                        fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                        background: '#111827',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 800
                      }}
                    >
                      Play with Ms. Sonoma
                    </button>

<button
                      onClick={() => {
                        if (!planEnt?.games) {
                          showFeatureGateNotice('Games are disabled on Trial. Upgrade to Standard or Pro to use them.');
                          return;
                        }
                        setShowGames(true);
                      }}
                      style={{
                        padding: '8px 16px',
                        fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                        background: planEnt?.games ? '#0ea5e9' : '#6b7280',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Games
                    </button>

### 35. src/app/api/counselor/route.js (f720a6009787bc62743e7f63e0b51742f9c90a8657a55a12ad32b58bf8b8eee4)
- bm25: -4.1937 | relevance: 1.0000

### 32. src/app/learn/lessons/page.js (d5beeb52789ee4491df2fa817b4e72a78686e5be0df840fd9c851365b185ecd6)
- bm25: -3.6775 | entity_overlap_w: 1.50 | adjusted: -4.0525 | relevance: 1.0000

useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } })
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

useEffect(() => {
    try {
      const id = localStorage.getItem('learner_id')
      const n = localStorage.getItem('learner_name')
      if (n) setLearnerName(n)
      if (id) setLearnerId(id)
    } catch {}
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data } = await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()
            if (data?.plan_tier) setPlanTier(data.plan_tier)
          }
        }
      } catch {}
      try {
        const dateKey = new Date().toISOString().slice(0,10)
        const key = `lesson_unique:${dateKey}`
        const raw = localStorage.getItem(key)
        if (raw) {
          const set = new Set(JSON.parse(raw))
          setTodaysCount(set.size)
        } else {
          setTodaysCount(0)
        }
      } catch {}
    })()
  }, [])

useEffect(() => {
    let cancelled = false

if (!learnerId || learnerId === 'demo') {
      setSessionGateReady(true)
      return () => { cancelled = true }
    }

setSessionGateReady(false)

### 33. sidekick_pack.md (8c41fd77adf06b3317885c02ea3865c7b889e8138f681128c71a738d6f5b2cfb)
- bm25: -3.9359 | relevance: 1.0000

return (
                <div style={{ padding: '0 12px' }}>
                  <div style={{ ...cardStyle, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <input
                          type="text"
                          value={openingActionInput}
                          onChange={(e) => setOpeningActionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (openingActionBusy) return;
                              handleOpeningAskSubmit();
                            }
                          }}
                          placeholder="Ask Ms. Sonoma..."
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: '0.9rem' }}
                          autoFocus
                          disabled={openingActionBusy}
                        />
                      </div>

### 34. src/app/session/v2/SessionPageV2.jsx (2de59be96aa49dc5ad4c1caf8c83a59d39f4996a9987150ee618644bfc888b8f)
- bm25: -3.7932 | relevance: 1.0000

<button
                      onClick={() => setShowPlayWithSonomaMenu(true)}
                      style={{
                        padding: '8px 16px',
                        fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                        background: '#111827',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 800
                      }}
                    >
                      Play with Ms. Sonoma
                    </button>

<button
                      onClick={() => {
                        if (!planEnt?.games) {
                          showFeatureGateNotice('Games are disabled on Trial. Upgrade to Standard or Pro to use them.');
                          return;
                        }
                        setShowGames(true);
                      }}
                      style={{
                        padding: '8px 16px',
                        fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                        background: planEnt?.games ? '#0ea5e9' : '#6b7280',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Games
                    </button>

### 35. sidekick_pack.md (2105a3762ad9d08c8b941e06d9eaf096b91e8261ed62bb1ea70397e13398585a)
- bm25: -3.2959 | entity_overlap_w: 1.50 | adjusted: -3.6709 | relevance: 1.0000

const callMsSonoma = async (instructions, innertext, session, opts = {}) => {
    // If we're in the exercise awaiting-begin lock window, avoid issuing a new call that might
    // change subPhase out from under the Begin overlay due to late replies.
    try {
      if (exerciseAwaitingLockRef.current && session && session.phase === 'exercise') {
        return { success: false, skippedDueToAwaitingLock: true };
      }
      if (comprehensionAwaitingLockRef.current && session && session.phase === 'comprehension') {
        return { success: false, skippedDueToAwaitingLock: true };
      }
    } catch {}
    // Keep existing caption text on screen until new text is ready
    clearCaptionTimers();
    setLoading(true);
    try {
  const rawPhaseKey = (session?.phase || 'unknown').toString().toLowerCase();
  // Bucket 'teaching' and 'comprehension' with 'discussion' so we have exactly four server sessions.
  const phaseKey = (rawPhaseKey === 'teaching' || rawPhaseKey === 'comprehension') ? 'discussion' : rawPhaseKey;
      // Send only the provided instructions (no system message)
      const userContent = `${instructions}`;
      // Create AbortController so we can cancel on skip
      const ctrl = new AbortController();
      sonomaAbortRef.current = ctrl;
      // Prefer cached systemId; fall back to sending full system once
      const attempt = async (payload) => {
        const res = await fetch("/api/sonoma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

### 36. src/app/session/page.js (7d1fabfa510c016954552dc575e2d55822aeba6b66f816f24e76ce346c4cab26)
- bm25: -3.2764 | entity_overlap_w: 1.50 | adjusted: -3.6514 | relevance: 1.0000

const callMsSonoma = async (instructions, innertext, session, opts = {}) => {
    // If we're in the exercise awaiting-begin lock window, avoid issuing a new call that might
    // change subPhase out from under the Begin overlay due to late replies.
    try {
      if (exerciseAwaitingLockRef.current && session && session.phase === 'exercise') {
        return { success: false, skippedDueToAwaitingLock: true };
      }
      if (comprehensionAwaitingLockRef.current && session && session.phase === 'comprehension') {
        return { success: false, skippedDueToAwaitingLock: true };
      }
    } catch {}
    // Keep existing caption text on screen until new text is ready
    clearCaptionTimers();
    setLoading(true);
    try {
  const rawPhaseKey = (session?.phase || 'unknown').toString().toLowerCase();
  // Bucket 'teaching' and 'comprehension' with 'discussion' so we have exactly four server sessions.
  const phaseKey = (rawPhaseKey === 'teaching' || rawPhaseKey === 'comprehension') ? 'discussion' : rawPhaseKey;
      // Send only the provided instructions (no system message)
      const userContent = `${instructions}`;
      // Create AbortController so we can cancel on skip
      const ctrl = new AbortController();
      sonomaAbortRef.current = ctrl;
      // Prefer cached systemId; fall back to sending full system once
      const attempt = async (payload) => {
        const res = await fetch("/api/sonoma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

### 37. sidekick_pack.md (fd827a019c83e0dd37e571d556b930549bddae9be34b1f960743c8bcfbb4a426)
- bm25: -3.5913 | relevance: 1.0000

### 14. src/app/session/v2/SessionPageV2.jsx (762b3f4fff72e8f7116b8b26971018abd044c3e578205eefd2abb17c543695bd)
- bm25: -5.8783 | relevance: 1.0000

// If an opening action starts, collapse the Play-with-Sonoma menu
  useEffect(() => {
    if (openingActionActive) {
      setShowPlayWithSonomaMenu(false);
    }
  }, [openingActionActive]);

### 15. sidekick_pack.md (708a7b41fd633ffb8361ef3b6b56d27ef818fdd5ff7f0ee32cd3b981e9aed75f)
- bm25: -5.7984 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Ask feature breaks and shows a generic response. Find Ask UI handler, API route it calls, and where generic fallback text is produced. Identify why real answer fails and propose minimal fix.
```

Filter terms used:
```text
API
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

API

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_completions_mismatch.md (4d70ffb6cf5bf342adef7c9b1b576c15f6b660105427e60170e67a2b73029e01)
- bm25: -1.1167 | entity_overlap_w: 7.80 | adjusted: -3.0667 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
V2 completed lessons mismatch: Calendar vs Completed Lessons page vs Awards (medals). Find where lesson completion is recorded in V2 (session/teaching flow), where each screen pulls data (lesson history API, medals API, lesson schedule API), and identify why completions are missing (Emma).
```

Filter terms used:
```text
API
```
# Context Pack

### 38. src/app/session/v2/SessionPageV2.jsx (efc0329e2f85d6b17d0b7ee7e155b5d6c77ac07573690feb4eed11d199c6cfbc)
- bm25: -3.5636 | relevance: 1.0000

if (!action) return null;

if (action === 'ask') {
              const phaseAlias = normalizePhaseAlias(currentPhase);
              const hasActiveQuestion = (
                (phaseAlias === 'comprehension' && !!currentComprehensionQuestion) ||
                (phaseAlias === 'exercise' && !!currentExerciseQuestion) ||
                (phaseAlias === 'worksheet' && !!currentWorksheetQuestion)
              );

return (
                <div style={{ padding: '0 12px' }}>
                  <div style={{ ...cardStyle, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <input
                          type="text"
                          value={openingActionInput}
                          onChange={(e) => setOpeningActionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (openingActionBusy) return;
                              handleOpeningAskSubmit();
                            }
                          }}
                          placeholder="Ask Ms. Sonoma..."
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: '0.9rem' }}
                          autoFocus
                          disabled={openingActionBusy}
                        />
                      </div>

### 39. sidekick_pack.md (0563885a5bff03f18bcb53e17679d271203933dda1521de9ad81e52d6c9c728e)
- bm25: -3.4716 | relevance: 1.0000

// Repeat speech: replay the last TTS audio without updating captions
  const handleRepeatSpeech = useCallback(async () => {
    // Check if we have audio to replay
    if (!lastAudioBase64Ref.current) {
      return;
    }
    
    // Hide repeat button while playing
    setShowRepeatButton(false);
    
    // Set speaking state
    setIsSpeaking(true);
    
    try {
      // Replay audio without updating captions (pass empty array for sentences)
      await playAudioFromBase64(lastAudioBase64Ref.current, [], 0);
    } catch (err) {
      setIsSpeaking(false);
      // Show repeat button again since replay failed
      if (lastAudioBase64Ref.current) {
        setShowRepeatButton(true);
      }
    }
  }, [playAudioFromBase64]);

// Show visual aids carousel
  const handleShowVisualAids = useCallback(() => {
    setShowVisualAidsCarousel(true);
  }, []);

// Explain visual aid via Ms. Sonoma
  const handleExplainVisualAid = useCallback(async (visualAid) => {
    if (!visualAid || !visualAid.description) {
      return;
    }

// Read the pre-generated description (created during image generation)
    await speakFrontendImpl(visualAid.description, {});
  }, []);

### 40. src/app/session/page.js (5ebfc03af0ee8e5b408f25599d22b5cc33578df677f5614a757547f3ec5f5c1d)
- bm25: -3.4462 | relevance: 1.0000

// Repeat speech: replay the last TTS audio without updating captions
  const handleRepeatSpeech = useCallback(async () => {
    // Check if we have audio to replay
    if (!lastAudioBase64Ref.current) {
      return;
    }
    
    // Hide repeat button while playing
    setShowRepeatButton(false);
    
    // Set speaking state
    setIsSpeaking(true);
    
    try {
      // Replay audio without updating captions (pass empty array for sentences)
      await playAudioFromBase64(lastAudioBase64Ref.current, [], 0);
    } catch (err) {
      setIsSpeaking(false);
      // Show repeat button again since replay failed
      if (lastAudioBase64Ref.current) {
        setShowRepeatButton(true);
      }
    }
  }, [playAudioFromBase64]);

// Show visual aids carousel
  const handleShowVisualAids = useCallback(() => {
    setShowVisualAidsCarousel(true);
  }, []);

// Explain visual aid via Ms. Sonoma
  const handleExplainVisualAid = useCallback(async (visualAid) => {
    if (!visualAid || !visualAid.description) {
      return;
    }

// Read the pre-generated description (created during image generation)
    await speakFrontendImpl(visualAid.description, {});
  }, []);
