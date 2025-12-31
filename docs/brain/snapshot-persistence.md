# Snapshot Persistence System

## Core Architecture

**ATOMIC GATES, NOT POLLING**

Snapshots save at explicit checkpoints only. No autosave, no polling, no drift correction.

**Scope:** This document covers snapshot saves and restores for lesson state persistence. For session ownership and device conflict detection, see [session-takeover.md](session-takeover.md).

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

2. **Database/Storage** - Async backup
   - Cross-device access
   - Falls back when localStorage cleared
   - 10-20 second replication lag on read replicas

### Restore Strategy: localStorage First
1. Try localStorage (instant)
2. If not found, try database
3. If database found, write to localStorage for next time
4. Apply state exactly, no post-restore modifications

## Checkpoint Gates (Where Snapshots Save)

### Opening Phase
- **V1**: `first-interaction` - When user clicks any button except Begin (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games, or Go). Prevents infinite play timer hack via refresh.
- **V2**: No first-interaction gate needed. Discussion phase has no opening actions or play timer - "Begin" button advances to teaching immediately. Play timer exploit eliminated by architectural simplification.

### Teaching Flow
- `begin-teaching-definitions`
- `vocab-sentence-1` (before TTS)
- `vocab-sentence-N` (before each subsequent TTS)
- `begin-teaching-examples`
- `example-sentence-1` (before TTS)
- `example-sentence-N` (before each subsequent TTS)

### Comprehension Flow
- `comprehension-active` (after each answer, wrapped in setTimeout for React state flush)

### Other Phases
- `begin-discussion`
- `begin-worksheet`
- `begin-exercise`
- `begin-test`
- `skip-forward` (navigation)
- `skip-back` (navigation)

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
