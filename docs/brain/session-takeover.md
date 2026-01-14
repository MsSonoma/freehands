# Session Takeover System (Gate-Based)

## Core Architecture

**EARLY CONFLICT DETECTION, NO POLLING**

Session ownership enforced at page load before snapshot restore. No polling, no intervals, no performance overhead.

## How It Works

### Session Ownership Model

Each learner+lesson combination can have **exactly one active session** at any time. Session ownership is tracked in `lesson_sessions` table with device identification and activity timestamps.

When Device B attempts to access the same lesson that Device A is using, conflict is detected immediately at page load before any snapshot restore, triggering takeover dialog with PIN validation.

### Conflict Detection Strategy: Check Before Snapshot Restore

**CRITICAL FIX (2025-12-15)**: Conflict check now runs BEFORE snapshot restore to prevent double-snapshot handling.

**When new device loads lesson page:**
1. Page generates `browserSessionId` (UUID stored in sessionStorage)
2. Once `trackingLearnerId`, `normalizedLessonKey`, and `browserSessionId` are available, page calls `startTrackedSession()`
3. Database detects conflict (different `session_id` already owns this learner+lesson)
4. `startTrackedSession()` returns `{conflict: true, existingSession: {...}}`
5. UI immediately shows `SessionTakeoverDialog` **BEFORE snapshot restore runs**
6. Snapshot restore logic waits for `sessionConflictChecked` flag before proceeding, and the flag flips **only after** the ownership check returns (success or conflict) so restore cannot run while the takeover dialog is pending
7. User enters 4-digit PIN to validate ownership transfer
8. On PIN success:
   - Old session deactivated (`ended_at` set, event logged)
   - New session created with current `session_id`
   - Page reloads to restore snapshot from database (most recent for this learner+lesson)
   - localStorage updated with restored snapshot
   - Lesson resumes from checkpoint

**Why this sequencing matters:**
- OLD BUG: Snapshot restored → User sees lesson content → Conflict detected → Dialog appears → PIN entered → Reload → Snapshot restored AGAIN
- NEW FIX: Conflict detected → Dialog appears → PIN entered → Reload → Snapshot restored ONCE

**Old device behavior:**
- No active notification (no polling)
- Next gate attempt (user clicks Next, answers question, etc.) detects session ended
- Shows takeover notification: "This lesson was continued on another device"
- Redirects to learner dashboard

### Timer State: Snapshot-Based Persistence

**Source of truth**: Snapshot database (cross-device)  
**Mechanism**: Timer state captured at every checkpoint gate

Timer state in snapshot payload:
```javascript
{
  currentTimerMode: 'play' | 'work',
  workPhaseCompletions: { discussion: true, teaching: false, ... },
  timerSnapshot: {
    phase: 'teaching',
    mode: 'work',
    capturedAt: '2025-11-20T22:15:30.123Z',
    elapsedSeconds: 45,
    targetSeconds: 300
  }
}
```

**On restore (device switch):**
1. Load snapshot from database
2. Extract `timerSnapshot.elapsedSeconds` and `timerSnapshot.capturedAt`
3. Calculate drift: `now - capturedAt` in seconds
4. Set timer initial state: `elapsedSeconds + drift` (capped at `targetSeconds`)
5. Timer continues from where it left off on old device (±gate latency)

**Why snapshot, not sessionStorage?**
- sessionStorage is device-local, not cross-device
- Snapshot already saves at every gate (no extra writes)
- Restoring from snapshot ensures timer continuity after takeover
- sessionStorage still used as fast cache between gates on same device

### Play Timer Expiration: Countdown Once

**CRITICAL FIX (2025-12-16, adjusted 2025-12-18)**: 30-second countdown plays on live timer expiration, but is suppressed when restore detects an already-expired play timer. Restores no longer force the countdown-completed flag to true for all sessions—live sessions resumed after a restore can still show the countdown on the next play timeout.

**Problem**: Timer ticks down even when page is closed (intended). Countdown should only show if timer expires while page is actively loaded and user is present. It must be skipped when returning after the play timer already expired while away.

**Solution**: Restore `playExpiredCountdownCompleted` from the snapshot value, and set it to true only when restore detects an expired play timer. Countdown plays for live sessions (even after a normal resume) but is suppressed for "expired while away" restores.

**Flow:**
1. **Timer expires while page actively loaded**:
   - `handlePlayTimeUp()` called → show countdown overlay
   - User watches countdown or clicks "Start Now"
   - `handlePlayExpiredComplete()` or `handlePlayExpiredStartNow()` called
   - Set `playExpiredCountdownCompleted = true` and transition to work timer

2. **Timer expires while page closed**:
   - Timer ticks in sessionStorage, reaches target
   - No `handlePlayTimeUp()` fires (page not loaded)
   - User returns, snapshot restore runs
  - Restore sets flag (because expiration detected), transitions to work mode
   - Countdown never shows

3. **Live session after resume/refresh**:
  - Snapshot restore runs, rehydrates flag from snapshot (defaults to false)
  - Countdown remains available for a future live play timeout

## Related Brain Files

- **[snapshot-persistence.md](snapshot-persistence.md)** - Takeover triggers snapshot restore flow
- **[timer-system.md](timer-system.md)** - Timer state preserved during takeover (golden key progress)

**Implementation:**

1. **handlePlayTimeUp** (page.js ~870-900):
   - Check flag: `if (playExpiredCountdownCompleted) return;`
   - Show countdown overlay: `setShowPlayTimeExpired(true)`
   - Clear opening action states
   - Flag prevents countdown if set during restore or previous completion

2. **handlePlayExpiredComplete** (page.js ~907-930):
   - `setPlayExpiredCountdownCompleted(true)` - countdown was seen
   - Transition to work timer
   - Call phase handler

3. **handlePlayExpiredStartNow** (page.js ~935-960):
   - `setPlayExpiredCountdownCompleted(true)` - countdown was seen
   - Transition to work timer
   - Call phase handler

4. **Snapshot restore** (useSnapshotPersistence.js ~500):
```javascript
// Restore flag from snapshot; do not force-enable on every restore
setPlayExpiredCountdownCompleted(!!snap.playExpiredCountdownCompleted);
```

5. **Timer expiration detection** (useSnapshotPersistence.js ~620):
```javascript
// If play timer expired during restore, transition to work mode and trigger phase handler
if (timerModeValue === 'play' && adjustedElapsed >= target) {
  setPlayExpiredCountdownCompleted(true);
  setCurrentTimerMode({ [timerPhaseName]: 'work' });
  sessionStorage.removeItem(playTimerKey);
  setNeedsPlayExpiredTransition(timerPhaseName); // Trigger phase handler after restore
}
```

6. **Work phase transition effect** (page.js ~1082):
```javascript
useEffect(() => {
  if (!needsPlayExpiredTransition) return;
  // Call appropriate phase handler (handleStartLesson, handleGoComprehension, etc.)
  // based on phase name, then clear flag
}, [needsPlayExpiredTransition, phase]);
```

**Result**: When play timer expires with page closed, restore automatically:
1. Sets countdown completed flag (blocks countdown)
2. Transitions timer to work mode
3. Triggers phase handler to start work phase
4. User lands directly in work phase entrance, can click Go to begin

**Key Files:**
- `src/app/session/page.js`: Flag setting in completion handlers, not in handlePlayTimeUp
- `src/app/session/hooks/useSnapshotPersistence.js`: Detect expired timer on restore, auto-transition
- `src/app/session/sessionSnapshotStore.js`: Persist flag in snapshot

### Database Schema

#### `lesson_sessions` Table Extensions

**New columns:**
```sql
ALTER TABLE lesson_sessions
  ADD COLUMN session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN device_name TEXT,
  ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX unique_active_lesson_session 
  ON lesson_sessions (learner_id, lesson_id) 
  WHERE ended_at IS NULL;
```

**Trigger: Auto-deactivate old sessions (data integrity)**
```sql
CREATE OR REPLACE FUNCTION deactivate_old_lesson_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting a new active session, close any existing active session for same learner+lesson
  IF NEW.ended_at IS NULL THEN
    UPDATE lesson_sessions
    SET ended_at = NOW()
    WHERE learner_id = NEW.learner_id
      AND lesson_id = NEW.lesson_id
      AND ended_at IS NULL
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_deactivate_old_lesson_sessions
  BEFORE INSERT ON lesson_sessions
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_old_lesson_sessions();
```

**Purpose**: Database enforces single-session constraint even if application logic fails. Ensures no orphaned active sessions.

### Checkpoint Gates (Where Conflicts Detected)

Same gates as snapshot persistence - every time `scheduleSaveSnapshot` is called:

#### Teaching Flow
- `begin-teaching-definitions`
- `vocab-sentence-1` through `vocab-sentence-N`
- `begin-teaching-examples`
- `example-sentence-1` through `example-sentence-N`

#### Comprehension Flow
- `comprehension-active` (after each answer)

#### Other Phases
- `begin-discussion`
- `begin-worksheet`
- `begin-exercise`
- `begin-test`
- `skip-forward`
- `skip-back`

### Session ID Generation and Storage

**Browser-side session ID:**
```javascript
// Generated once per browser tab, persists in sessionStorage
let browserSessionId = sessionStorage.getItem('lesson_session_id');
if (!browserSessionId) {
  browserSessionId = crypto.randomUUID();
  sessionStorage.setItem('lesson_session_id', browserSessionId);
}
```

**Included in every snapshot save:**
```javascript
const payload = {
  learner_id: learnerId,
  lesson_key: lessonKey,
  session_id: browserSessionId,
  device_name: navigator.userAgent, // or user-friendly device name
  last_activity_at: new Date().toISOString(),
  snapshot: { /* state */ }
};
```

**Database checks on save:**
1. Look for active session with this `learner_id` + `lesson_id`
2. If exists and `session_id` matches: update successful (same device)
3. If exists and `session_id` differs: return conflict error with existing session details
4. If none exists: create new session

## Key Files

- `src/app/lib/sessionTracking.js` - Session lifecycle (start/end/events), NO polling logic
- `src/app/session/sessionSnapshotStore.js` - Snapshot save with conflict detection, takeover trigger
- `src/app/session/hooks/useSnapshotPersistence.js` - Snapshot payload with timer state, restore logic
- `src/app/session/page.js` - PIN validation, takeover handler, session_id initialization
- `src/app/session/components/SessionTakeoverDialog.jsx` - Takeover UI (already exists)

**V2 key files:**
- `src/app/session/v2/SessionPageV2.jsx` - Starts tracked session at Begin (conflict check), surfaces takeover dialog
- `src/app/hooks/useSessionTracking.js` - Starts session + optional takeover polling helper

## Current Architecture

### Conflict Detection (Gate)
- A conflict check happens at Begin (session start) via `startLessonSession()`.
- Snapshot saves also perform conflict detection (same `learner_id` + `lesson_id` single-owner rule).

### Optional Polling (Low Frequency)
- The app may also run a low-frequency polling loop (8 seconds) to detect when another device has ended the session.
- Polling is read-only (status checks) and is used only while a session is active.

### What Remains (Beta Analytics)
- `startLessonSession()` - Creates session row, logs start event
- `endLessonSession()` - Closes session row, logs completion/exit event
- `logRepeatEvent()` - Tracks repeat button clicks per sentence
- `addFacilitatorNote()` - Timestamped facilitator notes
- `addTranscriptLine()` - Timestamped transcript lines
- Session duration and event tracking for Beta program reporting

**Retry-safety rules:**
- `startLessonSession()` must be idempotent for the same `(learner_id, lesson_id, session_id)` so retries do not create duplicate active sessions.
- Client-side session start must always clear "loading" state even if Supabase hangs or errors (timeouts + `finally`).

## What NOT To Do

**DO NOT ADD:**
- Polling intervals for session status checks
- WebSocket connections for real-time notifications to old device
- Periodic "heartbeat" updates to last_activity_at
- Client-side session expiry logic (handled by database trigger on new session)

**DO NOT USE:**
- Separate timer persistence API calls
- Timer state in localStorage independent of snapshots
- Race condition checks between timer updates and snapshot saves

## Why We Use Gates (and Sometimes Polling)

**Gates are the primary mechanism:**
- Conflict is detected exactly at meaningful checkpoints (Begin and snapshot saves).
- This aligns with persistence writes and avoids background chatter.

**Polling is secondary and optional:**
- Polling can improve UX by discovering a takeover/end even when the learner is idle.
- Keep it low-frequency and read-only, and only while a session is active.

## Device Switch Flow Example

**Scenario:** Learner starts lesson on iPad, switches to laptop mid-teaching

1. **iPad - Teaching vocab sentence 3**
   - User clicks Next
   - Gate: `scheduleSaveSnapshot('vocab-sentence-3')`
   - Snapshot saved with `session_id: "abc-123-ipad"`, timer at 45 seconds
   - Success

2. **Laptop - Opens same lesson**
   - Page loads, generates new `session_id: "xyz-789-laptop"`
   - User clicks Begin
   - Gate: `scheduleSaveSnapshot('begin-discussion')`
   - Database detects conflict (iPad session "abc-123-ipad" still active)
   - Returns conflict error with iPad session details

3. **Laptop - Takeover dialog shows**
   - "A session for this lesson is active on another device (iPad)"
   - "Last activity: 2 minutes ago"
   - "Enter 4-digit PIN to take over"
   - User enters PIN

4. **Laptop - PIN validated**
   - Clear localStorage (force database restore)
   - Deactivate iPad session "abc-123-ipad" (set ended_at)
   - Create new session "xyz-789-laptop"
   - Restore snapshot from database (vocab-sentence-3 checkpoint)
   - Extract timer state: 45 seconds + (now - capturedAt) = ~47 seconds
   - Set timer to 47 seconds, mode 'work'
   - Resume teaching at vocab sentence 3
   - Apply teaching flow snapshot (vocab index, stage, etc.)

5. **iPad - Next gate attempt**
   - User clicks Next (or any action triggering gate)
   - Gate: `scheduleSaveSnapshot('vocab-sentence-4')`
   - Database returns "session ended" error
   - Show notification: "Lesson continued on laptop"
   - Redirect to learner dashboard (or show Resume option for laptop)

## Timer Continuity Details

**Timer state components:**
- `currentTimerMode`: 'play' (Begin to Go) or 'work' (Go to next phase)
- `workPhaseCompletions`: object tracking which phases completed work timer
- `elapsedSeconds`: current countdown value
- `targetSeconds`: phase-specific target (from runtime config)
- `capturedAt`: ISO timestamp when snapshot saved

**Snapshot capture (every gate):**
```javascript
timerSnapshot: {
  phase: phase,
  mode: currentTimerModeRef.current || currentTimerMode,
  capturedAt: new Date().toISOString(),
  elapsedSeconds: getElapsedFromSessionStorage(phase, currentTimerMode),
  targetSeconds: getTargetForPhase(phase, currentTimerMode)
}
```

**Restore logic:**
```javascript
const { timerSnapshot } = restoredSnapshot;
if (timerSnapshot) {
  const drift = Math.floor((Date.now() - new Date(timerSnapshot.capturedAt)) / 1000);
  const adjustedElapsed = Math.min(
    timerSnapshot.elapsedSeconds + drift,
    timerSnapshot.targetSeconds
  );
  
  // Write to sessionStorage (source for timer component)
  sessionStorage.setItem(
    `timer_${timerSnapshot.phase}_${timerSnapshot.mode}`,
    JSON.stringify({
      elapsedSeconds: adjustedElapsed,
      startTimestamp: Date.now() - (adjustedElapsed * 1000)
    })
  );
  
  setCurrentTimerMode(timerSnapshot.mode);
}
```

**Result:** Timer continues within ±2 seconds of where old device left off (gate save latency + network round-trip).

## PIN Validation Security

**Already implemented** in `page.js` lines 286-314:
- Client calls `ensurePinAllowed(pinCode)` from `src/app/lib/pinAuth.js`
- Server validates PIN hash against learner's stored scrypt hash
- Only correct PIN allows session takeover
- Failed PIN shows error, user can retry

**No changes needed** - existing PIN flow reused for session takeover.

## Migration from Polling (Cleanup Tasks)

1. **Delete polling methods** from `useSessionTracking` hook:
   - Remove `startPolling` function
   - Remove `stopPolling` function
   - Remove `pollIntervalRef`
   - Keep session lifecycle methods (start/end/log events)

2. **Remove polling call sites**:
   - Delete commented line 4213 in `page.js`
   - Remove `startSessionPolling` destructuring from hook

3. **Update `checkSessionStatus`** in `sessionTracking.js`:
   - Simplify to single query (no longer called in loop)
   - Used only for takeover dialog data fetch
   - Returns session details for conflict UI

4. **Preserve Beta analytics**:
   - Keep `lesson_sessions` table structure
   - Keep `lesson_session_events` logging
   - Keep `repeat_events`, `facilitator_notes`, `lesson_transcripts`
   - All analytics continue working with gate-based ownership

## Acceptance Criteria

- ✅ Same learner+lesson on two devices: second device shows takeover dialog immediately at first gate
- ✅ PIN validation required to take over session
- ✅ Old device detects takeover at next gate (no polling), shows notification, redirects
- ✅ Timer state persists through takeover within ±2 seconds
- ✅ Snapshot restore applies exact teaching flow state (vocab index, stage, ticker, etc.)
- ✅ No polling intervals, no performance overhead
- ✅ Database trigger enforces single active session (data integrity)
- ✅ Session analytics (duration, events, transcripts) continue working
- ✅ localStorage cleared on takeover forces database restore (correct cross-device behavior)

## Future Enhancements (Out of Scope)

- Real-time notification to old device via WebSocket (avoid polling, but adds complexity)
- "Force takeover" admin override (skip PIN for lost devices)
- Session history UI showing recent device switches per lesson
- Auto-lock session after N minutes idle (prevent stale takeovers)
