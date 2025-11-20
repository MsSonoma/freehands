# Snapshot Persistence System

## Core Architecture

**ATOMIC GATES, NOT POLLING**

Snapshots save at explicit checkpoints only. No autosave, no polling, no drift correction.

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

No overlay, no polling, no "takeover" - just fallback to database when localStorage empty.
