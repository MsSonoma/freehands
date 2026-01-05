# Snapshot Persistence System

## Core Architecture

**ATOMIC GATES, NOT POLLING**

Snapshots save at explicit checkpoints only. No autosave, no polling, no drift correction.

**Scope:** This document covers snapshot saves and restores for lesson state persistence. For session ownership and device conflict detection, see [session-takeover.md](session-takeover.md).

**Identity:** Snapshot identity is strictly `(learnerId, lessonKey)` where `lessonKey` is the canonical filename (no subject prefix, no `.json`). V2 now derives this with the same helper as V1 (`getSnapshotStorageKey` rules: URL param first, then manifest file, then lesson id; strip prefixes/extensions). Lesson == session; no extra sessionId dimension is used in the key, so golden key, timers, and snapshots all share the same canonical `lessonKey`.

## Complete Lesson Cleanup

When user clicks "Complete Lesson" button:

1. **Set prevention flag** - `window.__PREVENT_SNAPSHOT_SAVE__ = true` blocks any snapshot saves during cleanup
2. **Clear assessments** - `clearAssessments()` removes all 4 generated arrays (comprehension, exercise, worksheet, test) from localStorage and database
3. **Clear snapshots** - `clearSnapshot()` removes resume state from localStorage and database using all possible key variations
4. **Clear timer state** - Remove phase-based timer states from sessionStorage
5. **Clear golden key** - Remove active golden key for this lesson if used
6. **Save transcript** - Persist final transcript segment to Supabase Storage
7. **Navigate away** - Redirect to /learn/lessons

The prevention flag ensures no snapshot saves occur between clicking Complete Lesson and finishing cleanup. This prevents the lesson from showing "Continue" instead of "Start Lesson" on next visit.

### Snapshot Save Guard

`saveSnapshot()` checks `window.__PREVENT_SNAPSHOT_SAVE__` flag and returns `{success: false, blocked: true}` if set. This prevents race conditions where:
- User clicks Complete Lesson
- Snapshot auto-save triggers before clearSnapshot completes
- Snapshot persists with `phase: 'congrats'`
- Next visit shows "Continue" and loads to congrats screen

With guard in place, completion cleanup is atomic - either all persistence cleared or none.

## How It Works

### Save Strategy: Dual Write
1. **localStorage** - Synchronous, instant (<1ms)
   - Key: `atomic_snapshot:{learnerId}:{lessonKey}`
   - One snapshot per learner+lesson (setItem replaces, doesn't stack)
   - Same-browser restore is instant (no database lag)

2. **Database/Storage** - Async backup (cross-device)
  - Saved via `/api/snapshots` (server route)
  - Primary storage: `learner_snapshots` table keyed by `user_id + learner_id + lesson_key`
  - Fallback storage: Supabase Storage `learner-snapshots` bucket when DB table/columns are missing
  - Used when localStorage is empty (new device, cleared storage)

### Restore Strategy: localStorage First
1. Try localStorage (instant)
2. If not found, try database
3. If database found, write to localStorage for next time
4. Apply state exactly, no post-restore modifications

Initialization now fails loudly when identity is missing: SnapshotService construction is wrapped in try/catch, and `snapshotLoaded` is set in a `finally` so Begin gating does not hang. Missing `lessonKey`/`learnerId` surfaces as an error instead of silently starting over.

### V2 Resume Flow
On session load:
1. **SnapshotService.initialize()** loads existing snapshot during mount effect (async)
2. If snapshot found:
   - Sets `resumePhase` state to `snapshot.currentPhase`
  - Displays Resume and Start Over buttons in footer when `resumePhase` is not at beginning (not idle/discussion)
3. If no snapshot or snapshot at beginning:
   - Shows normal Begin button
4. Sets `snapshotLoaded` to true when load completes

**Begin gating:** The top-level Begin button is disabled until both `audioReady` and `snapshotLoaded` are true, preventing a refresh race where the user can start a fresh session before the snapshot finishes loading.

**Resume button:**
- Hides Resume/Restart buttons
- Calls `startSession()` which, when `resumePhase` is set, starts PhaseOrchestrator directly at that phase via `startSession({ startPhase: resumePhase })`
- This avoids starting Discussion first and then skipping, because Discussion/Teaching can still complete later and override the manual skip.
- Phase controller restores granular state from `snapshot.phaseData[phase]`
- Timer state restored via `timerServiceRef.current.restoreState(snapshot.timerState)`

**Start Over button:**
- Confirms with user (cannot be reversed)
- Calls `snapshotServiceRef.current.deleteSnapshot()` to clear localStorage and database
- Calls `timerServiceRef.current.reset()` to clear timer Maps and remove all `session_timer_state:{lessonKey}:*` keys
- Clears `resumePhase` state **and** `resumePhaseRef` to null (prevents stale closure values)
- Calls `startSession({ ignoreResume: true })` which forces a fresh start from discussion/teaching (no resume)

**Resume phase source of truth:** `startSession` reads `resumePhaseRef.current` so it always uses the latest loaded snapshot. Call sites that should never resume (Start Over, PlayTimeExpired overlay auto-start) pass `{ ignoreResume: true }` so they cannot jump to a saved phase accidentally.

### V2 Save Flow
On phase transition:
1. **PhaseOrchestrator** emits `phaseChange` with the new phase name.
2. **SessionPageV2** calls `savePhaseCompletion(phase)` immediately so `SnapshotService.#snapshot.currentPhase` is set before granular saves run.
3. Each phase controller emits `requestSnapshotSave` after user actions (answers, skips, teaching sentence advances), and **saveProgress()** writes under the active phase key. `saveProgress()` now accepts `phaseOverride` so seed saves can force the correct phase even if currentPhase has not advanced yet.
4. Q&A phases (comprehension, exercise, worksheet, test) call `saveProgress('<phase>-init')` on phase start with `{ questions, nextQuestionIndex, score, answers, timerMode: 'play', phaseOverride: '<phase>' }` to freeze deterministic question pools for resume.
5. The same Q&A phases emit `<phase>-answer` and `<phase>-skip` saves that include `questions`, `answers`, `nextQuestionIndex`, `score`, and `timerMode` (Test also includes `reviewIndex`). This keeps snapshots aligned to the next pending question.
6. Resume path: `start*Phase` reads `snapshot.phaseData.<phase>` and passes it as `resumeState` so controllers skip intros/Go, restore timer mode (play/work), reuse the exact question array, and drop the learner at `nextQuestionIndex` (Test also restores `reviewIndex`).

Without step 2, granular saves would use `idle` as currentPhase and store under the wrong phase. Without step 4, question pools would reshuffle on resume and lose intra-phase progress.

**Key files (V2):**
- [SessionPageV2.jsx](../src/app/session/v2/SessionPageV2.jsx) lines 548-603 (SnapshotService mount + load), 1432-1910 (phase start wiring for Q&A resume), 2467-2517 (resume check in startSession)
- [SnapshotService.jsx](../src/app/session/v2/SnapshotService.jsx) - localStorage-first restore; server sync via `/api/snapshots` (DB + storage fallback)
- [PhaseOrchestrator.jsx](../src/app/session/v2/PhaseOrchestrator.jsx) - skipToPhase method for resume

## Checkpoint Gates (Where Snapshots Save)

- **Discussion entry**: `begin-discussion` (no opening actions in V2).
- **Teaching**: `begin-teaching-definitions`, `vocab-sentence-1/N` (before each TTS), `begin-teaching-examples`, `example-sentence-1/N` (before each TTS).
- **Q&A seeding** (deterministic resume): `comprehension-init`, `exercise-init`, `worksheet-init`, `test-init` fire on phase start and persist question arrays + `nextQuestionIndex` + `score` + `answers` + `timerMode` (with `phaseOverride`).
- **Q&A granular**: `comprehension-active`, `exercise-answer`, `exercise-skip`, `worksheet-answer`, `worksheet-skip`, `test-answer`, `test-skip` after each submission/skip (payload includes questions, answers, next index, timerMode; Test also includes reviewIndex).
- **Navigation**: `skip-forward`, `skip-back` (timeline jumps).

## Related Brain Files

- **[timer-system.md](timer-system.md)** - Timer state (currentTimerMode, workPhaseCompletions, golden key) persisted in snapshots
- **[session-takeover.md](session-takeover.md)** - Takeover flow triggers snapshot restore with timer state

## Key Files

- `src/app/session/sessionSnapshotStore.js` - Save/restore with localStorage+database
- `src/app/session/hooks/useSnapshotPersistence.js` - scheduleSaveSnapshot wrapper
- `src/app/session/hooks/useTeachingFlow.js` - Teaching checkpoint saves
- `src/app/session/page.js` - Comprehension/phase checkpoint saves

## What Was Removed

### Atomic Redesign (2025-11-19)
Deleted ~200 lines of complexity:
- Signature-based autosave
- Reconciliation effects
- Resume drift correction
- 2-second post-restore guard
- Debounce/retry logic

### Version Gating
- `snapshotVersion=2` marker prevents old v1 snapshots from loading
- Old snapshots ignored, session starts fresh

## What NOT To Do

**DO NOT ADD:**
- Polling/intervals for snapshot saves
- Autosave on state change
- Reconciliation after restore
- Signature comparison
- Debouncing (save immediately at checkpoints)

**DO NOT USE:**
- Session takeover polling
- checkSessionStatus intervals
- SessionTakeoverDialog overlay
- Device detection for sync

## Why Gates Not Polling

Gates are explicit, predictable, and testable:
- Save happens exactly when we say
- No drift from timing issues
- No performance overhead
- No race conditions

Polling causes:
- Unpredictable save timing
- Performance overhead
- Race conditions with React state
- Complexity in determining "what changed"

## Device Switch Behavior

When user switches devices:
1. localStorage on new device is empty
2. getStoredSnapshot falls back to database
3. Database returns latest snapshot
4. Snapshot written to new device's localStorage
5. Subsequent saves/restores use localStorage (fast)

**Session conflicts** (same learner+lesson on two devices simultaneously): Handled by session-takeover system, see [session-takeover.md](session-takeover.md). Takeover dialog appears at first gate when conflict detected, requires PIN validation.
## V2 Assessment Print System

**Integration:** V2 SessionPageV2 uses V1's `useAssessmentDownloads` hook for worksheet/test PDF generation and persistence.

### Architecture

**Persistent Arrays:**
- `generatedWorksheet` and `generatedTest` state variables hold shuffled question arrays
- Arrays persist until user presses red "Refresh" button in HeaderBar dropdown
- Stored in `assessmentStore` (localStorage + Supabase Storage)
- Key format: `lesson_assessments:{learnerId}:{lessonKey}`

**Event-Driven Print:**
HeaderBar dropdown dispatches custom events:
- `'ms:print:worksheet'` → PDF of worksheet questions (student-facing)
- `'ms:print:test'` → PDF of test questions (student-facing)
- `'ms:print:combined'` → Facilitator Key (notes, vocab, worksheet+test Q&A)
- `'ms:print:refresh'` → Regenerates arrays, clears persistence, resets progress

V2 listens for these events in useEffect hook (matches V1 pattern):
```javascript
useEffect(() => {
  const onWs = () => { try { handleDownloadWorksheet(); } catch {} };
  const onTest = () => { try { handleDownloadTest(); } catch {} };
  const onCombined = () => { try { handleDownloadWorksheetTestCombined(); } catch {} };
  const onRefresh = () => { try { handleRefreshWorksheetAndTest(); } catch {} };
  
  window.addEventListener('ms:print:worksheet', onWs);
  window.addEventListener('ms:print:test', onTest);
  window.addEventListener('ms:print:combined', onCombined);
  window.addEventListener('ms:print:refresh', onRefresh);
  
  return () => {
    window.removeEventListener('ms:print:worksheet', onWs);
    // ... cleanup
  };
}, [handleDownloadWorksheet, handleDownloadTest, ...]);
```

### Key Files

- `src/app/session/v2/SessionPageV2.jsx` (lines 261-268, 325-398, 628-680)
  - Generated assessment state: `generatedWorksheet`, `generatedTest`, `downloadError`
  - Helper functions: `getAssessmentStorageKey`, `createPdfForItems`, `shareOrPreviewPdf`, `reserveWords`
  - Hook initialization with learner targets
  - Print event listeners
- `src/app/session/hooks/useAssessmentDownloads.js`
  - Handles PDF generation (jsPDF)
  - Manages assessment persistence (saveAssessments, clearAssessments)
  - Regenerates arrays on refresh
- `src/app/session/assessment/assessmentStore.js`
  - localStorage + Supabase dual-write for cross-device access
- `src/app/HeaderBar.js` (lines 614-685)
  - Hamburger dropdown buttons dispatch print events

**Implementation Notes:**
- `createPdfForItems` lives in SessionPageV2 as a `useCallback` (jsPDF). Keep it defined above `useAssessmentDownloads` initialization to avoid TDZ/build errors; it uses adaptive font sizing and multi-page fallback (V1 parity).

### Refresh Behavior

When user clicks red "Refresh" button:
1. PIN validation via `ensurePinAllowed('refresh')`
2. Clear persisted arrays: `clearAssessments(key, { learnerId })`
3. Reset state: `setGeneratedWorksheet(null)`, `setGeneratedTest(null)`
4. Clear worksheet/test progress indices
5. Regenerate: New shuffle from lesson data pools
6. Save to storage: `saveAssessments(key, { worksheet, test }, { learnerId })`

Arrays do NOT regenerate on page refresh - they restore from storage. Only explicit "Refresh" button regenerates.