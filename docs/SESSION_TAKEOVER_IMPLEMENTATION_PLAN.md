# Session Takeover Implementation Plan

**Status:** Ready for implementation  
**Architecture:** Gate-based conflict detection (no polling)  
**Brain File:** `docs/brain/session-takeover.md` (canonical reference)

---

## Executive Summary

Implement session ownership tracking for learner lessons using the same gate-based architecture as snapshot persistence. Conflicts detected at atomic checkpoints when `scheduleSaveSnapshot` is called. No polling = no performance overhead. Timer state persists through takeover via snapshot payload.

**Estimated effort:** 2-3 days (schema + gate logic + cleanup + testing)

---

## Implementation Checklist

### Phase 1: Database Schema (1-2 hours)

- [ ] **Extend `lesson_sessions` table**
  ```sql
  ALTER TABLE lesson_sessions
    ADD COLUMN session_id UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN device_name TEXT,
    ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();
  
  CREATE UNIQUE INDEX unique_active_lesson_session 
    ON lesson_sessions (learner_id, lesson_id) 
    WHERE ended_at IS NULL;
  ```

- [ ] **Create trigger for single-session enforcement**
  ```sql
  CREATE OR REPLACE FUNCTION deactivate_old_lesson_sessions()
  RETURNS TRIGGER AS $$
  BEGIN
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

- [ ] **Test trigger**: Insert two sessions with same learner_id + lesson_id, verify only newest is active

### Phase 2: Session ID Generation (1 hour)

- [ ] **Add browser session ID to `page.js`** (top of component, before hooks)
  ```javascript
  // Generate or retrieve browser session ID (persists across refreshes in this tab)
  const [browserSessionId] = useState(() => {
    let sid = sessionStorage.getItem('lesson_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('lesson_session_id', sid);
    }
    return sid;
  });
  ```

- [ ] **Pass `browserSessionId` to snapshot persistence hook**
- [ ] **Test**: Verify same ID persists across refreshes, different ID in new tab

### Phase 3: Conflict Detection in Snapshot Save (4-6 hours)

- [ ] **Modify `saveSnapshot` in `sessionSnapshotStore.js`**
  - Include `session_id`, `device_name`, `last_activity_at` in payload
  - Add conflict detection query before save:
    ```javascript
    // Check for existing active session
    const { data: existing } = await supabase
      .from('lesson_sessions')
      .select('id, session_id, device_name, last_activity_at')
      .eq('learner_id', learnerId)
      .eq('lesson_id', lessonKey)
      .is('ended_at', null)
      .maybeSingle();
    
    if (existing && existing.session_id !== browserSessionId) {
      // Conflict! Return error with existing session details
      return {
        success: false,
        conflict: true,
        existingSession: existing
      };
    }
    ```
  - On conflict, return structured error instead of throwing

- [ ] **Update `scheduleSaveSnapshot` in `useSnapshotPersistence.js`**
  - Check for `conflict: true` in save result
  - Trigger callback: `onSessionConflict(existingSession)`

- [ ] **Wire conflict callback in `page.js`**
  ```javascript
  const handleSessionConflict = useCallback((existingSession) => {
    setConflictingSession(existingSession);
    setShowTakeoverDialog(true);
  }, []);
  
  // Pass to useSnapshotPersistence
  useSnapshotPersistence({
    // ... existing params
    browserSessionId,
    onSessionConflict: handleSessionConflict
  });
  ```

- [ ] **Test**: Open lesson in two tabs, verify second tab shows dialog at first gate

### Phase 4: Timer State in Snapshots (2-3 hours)

- [ ] **Add timer snapshot to payload in `useSnapshotPersistence.js`**
  ```javascript
  const timerSnapshot = {
    phase: phase,
    mode: currentTimerModeRef.current || currentTimerMode,
    capturedAt: new Date().toISOString(),
    elapsedSeconds: getElapsedFromSessionStorage(phase, currentTimerMode),
    targetSeconds: getTargetForPhase(phase, currentTimerMode)
  };
  
  const payload = {
    // ... existing snapshot fields
    timerSnapshot
  };
  ```

- [ ] **Implement `getElapsedFromSessionStorage` helper**
  - Read from sessionStorage key pattern: `timer_{phase}_{mode}`
  - Extract `elapsedSeconds` from stored state
  - Return 0 if not found

- [ ] **Add timer restore logic**
  ```javascript
  if (restoredSnapshot.timerSnapshot) {
    const { timerSnapshot } = restoredSnapshot;
    const drift = Math.floor((Date.now() - new Date(timerSnapshot.capturedAt)) / 1000);
    const adjustedElapsed = Math.min(
      timerSnapshot.elapsedSeconds + drift,
      timerSnapshot.targetSeconds
    );
    
    // Write to sessionStorage
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

- [ ] **Test**: Start timer, switch device, verify timer continues from correct point (±2 sec)

### Phase 5: Takeover Flow (2-3 hours)

- [ ] **Verify `handleSessionTakeover` in `page.js` lines 286-314**
  - Already validates PIN via `ensurePinAllowed(pinCode)`
  - Already clears localStorage to force database restore
  - Add: Deactivate old session in database
  - Add: Create new session with current `browserSessionId`
  - Add: Reload page to trigger fresh restore from database

- [ ] **Update `handleCancelTakeover`**
  - Redirect to learner dashboard (user chose not to take over)

- [ ] **Test full takeover flow**:
  1. Device A: Start lesson, reach vocab sentence 3, timer at 45 seconds
  2. Device B: Open same lesson, click Begin
  3. Verify: Takeover dialog shows with Device A info
  4. Enter valid PIN
  5. Verify: Device B resumes at vocab sentence 3, timer ~47 seconds
  6. Device A: Click Next
  7. Verify: Device A shows "Lesson continued on another device", redirects

### Phase 6: Old Device Notification (1-2 hours)

- [ ] **Add session-ended detection to conflict check**
  - When save returns "session ended" (different error from conflict)
  - Show notification overlay: "This lesson was continued on another device"
  - Provide button: "Back to Dashboard"

- [ ] **Modify conflict detection to distinguish**:
  - `conflict: true` = another device has active session (show takeover dialog)
  - `sessionEnded: true` = this device's session was taken over (show notification)

- [ ] **Test**: Device A gets notification after Device B takes over

### Phase 7: Polling Cleanup (1 hour)

- [ ] **Delete from `useSessionTracking.js`**:
  - `startPolling` method
  - `stopPolling` method
  - `pollIntervalRef` ref
  - Polling interval logic (lines ~100-150)

- [ ] **Keep in `useSessionTracking.js`**:
  - `startSession` (creates session row)
  - `endSession` (closes session row)
  - `logRepeat`, `addNote`, `addTranscript` (Beta analytics)

- [ ] **Delete from `page.js`**:
  - Line 4213 commented `startSessionPolling()` call
  - `startSessionPolling` destructuring from `useSessionTracking`

- [ ] **Simplify `checkSessionStatus` in `sessionTracking.js`**:
  - Remove "active" boolean logic (no longer polled)
  - Return session details only (for takeover dialog)

- [ ] **Test**: Verify no polling intervals in browser DevTools Performance tab

### Phase 8: Integration Testing (2-4 hours)

- [ ] **Test: Basic takeover**
  - Same learner+lesson, two devices
  - Second device shows dialog immediately
  - PIN required
  - First device detects takeover at next gate

- [ ] **Test: Timer continuity**
  - Start timer, let run for 30 seconds
  - Switch device, verify timer resumes within ±2 seconds

- [ ] **Test: Teaching flow state**
  - Mid-vocab (sentence 5 of 10)
  - Switch device, verify resumes at sentence 5
  - Click Next, verify sentence 6 plays

- [ ] **Test: Comprehension state**
  - Answer 3 questions correctly
  - Switch device, verify ticker shows 3/10
  - Next question is #4, not #1

- [ ] **Test: Database trigger**
  - Insert two sessions manually (SQL)
  - Verify only newest has `ended_at = null`

- [ ] **Test: PIN validation**
  - Wrong PIN: error shown, can retry
  - Correct PIN: takeover succeeds
  - No PIN bypass (security check)

- [ ] **Test: Beta analytics unaffected**
  - Session events still logged
  - Transcript lines saved with timestamps
  - Facilitator notes saved
  - Repeat events tracked

---

## Files Modified

### New Files
- `docs/brain/session-takeover.md` (canonical architecture doc)

### Schema Changes
- `lesson_sessions` table: add columns, index, trigger

### Code Changes
- `src/app/session/sessionSnapshotStore.js` - conflict detection in saveSnapshot
- `src/app/session/hooks/useSnapshotPersistence.js` - timer state, conflict callback
- `src/app/session/page.js` - session ID generation, conflict handler
- `src/app/hooks/useSessionTracking.js` - delete polling methods
- `src/app/lib/sessionTracking.js` - simplify checkSessionStatus

### Unchanged (Reused)
- `src/app/session/components/SessionTakeoverDialog.jsx` - existing UI
- `src/app/lib/pinAuth.js` - existing PIN validation
- `src/app/lib/supabaseClient.js` - existing database client

---

## Rollback Plan

If issues discovered after deployment:

1. **Disable conflict detection**:
   - Comment out conflict check in `saveSnapshot`
   - Sessions still created, but no takeover enforcement
   - Multiple devices can run simultaneously (data loss risk)

2. **Revert database changes**:
   ```sql
   DROP TRIGGER auto_deactivate_old_lesson_sessions ON lesson_sessions;
   DROP FUNCTION deactivate_old_lesson_sessions();
   DROP INDEX unique_active_lesson_session;
   ALTER TABLE lesson_sessions
     DROP COLUMN session_id,
     DROP COLUMN device_name,
     DROP COLUMN last_activity_at;
   ```

3. **Restore polling** (not recommended):
   - Re-enable line 4213 in page.js
   - Restore polling methods in useSessionTracking
   - Performance issues return

---

## Success Metrics

- ✅ Zero polling intervals (verify in DevTools)
- ✅ Takeover dialog appears < 500ms after conflict detected
- ✅ Timer continuity within ±2 seconds across devices
- ✅ Teaching flow state exact after takeover (same sentence, same ticker)
- ✅ PIN validation 100% enforced (no bypasses)
- ✅ Old device redirects within 3 seconds of next gate
- ✅ Session analytics data complete (no gaps from takeover)

---

## Questions for Implementation

1. **Device name display**: Use `navigator.userAgent` (technical) or prompt user for friendly name like "Mom's iPad"?
   - **Recommendation**: Extract browser + OS from userAgent (e.g., "Chrome on Windows") for now, add friendly names later

2. **Takeover notification UI**: Modal blocking entire screen vs subtle banner?
   - **Recommendation**: Modal (existing `SessionTakeoverDialog`) - user must acknowledge before proceeding

3. **Grace period**: Allow N seconds for old device to detect takeover before hard redirect?
   - **Recommendation**: No grace period - immediate redirect at next gate (fail-fast)

4. **Multiple takeovers**: User switches back and forth between devices rapidly?
   - **Handled**: Each takeover creates new session, most recent wins per trigger

5. **Timer drift tolerance**: Should we show warning if drift > 5 seconds?
   - **Recommendation**: No warning - drift capped at target, timer expires naturally if exceeded

---

## Next Steps

1. Review this plan with team
2. Create database migration script
3. Implement Phase 1 (schema) in dev environment
4. Begin Phase 2-3 (conflict detection) in feature branch
5. QA testing in Phase 8 before production deploy

---

**Brain File Reference**: `docs/brain/session-takeover.md`  
**Related**: `docs/brain/snapshot-persistence.md` (snapshot save architecture)  
**Updated**: 2025-11-20T23:00:00Z
