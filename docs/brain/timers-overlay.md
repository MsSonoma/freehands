# Timers Overlay System

**Feature:** Two overlays give the parent/facilitator a-la-carte control over timer settings — one for all phases at once (profile settings), one for the currently running timer (live session adjustment).

**Related Brain Files:**
- **[feature-edge-map.md](feature-edge-map.md)** — Full dependency graph for all 9 session features
- **[timer-system.md](timer-system.md)** — Timer state machine, golden key, play/work modes
- **[snapshot-persistence.md](snapshot-persistence.md)** — Timer state persisted in snapshot at every gate
- **[pin-protection.md](pin-protection.md)** — PIN gate for facilitator overlays

---

## Two Overlays — Different Scopes

### 1. PhaseTimersOverlay (`src/app/session/components/PhaseTimersOverlay.jsx`)

**When:** Accessible from Facilitator Hub / Learner Settings  
**Scope:** ALL 11 timers at once (5 phases × play + work = 10, plus golden key bonus = 11)  
**Persistence:** Saves to learner profile (`learners` table columns)  
**Effect:** Next session (or if live-pushed via Learner Settings Bus, current session)

### 2. TimerControlOverlay (`src/app/session/components/TimerControlOverlay.jsx`)

**When:** Click on the timer badge during an active session  
**Scope:** CURRENT running timer only (the phase + mode currently visible)  
**Persistence:** Ephemeral — adjusts the running session's elapsed time via sessionStorage  
**Effect:** Immediate — takes effect within one timer tick

---

## Key Files

- `src/app/session/components/PhaseTimersOverlay.jsx` — Batch phase timer editor
- `src/app/session/components/TimerControlOverlay.jsx` — Live session timer adjuster
- `src/app/session/v2/SessionPageV2.jsx` — Wire-up for both overlays
- `src/app/session/v2/TimerService.jsx` — Receives adjustments via sessionStorage

---

## TimerControlOverlay State Propagation

```
Parent clicks timer badge
  → PIN gate (ensurePinAllowed)
  → TimerControlOverlay opens
  → Shows current remaining time (from remainingSeconds prop — live from TimerService events)

Adjustment click (+ or − minutes)
  → onUpdateTime(newElapsedSeconds) callback
  → SessionPageV2: sessionStorage['session_timer_state:{lessonKey}:{phase}:{mode}'] = { elapsed: newElapsed }
  → setTimerRefreshKey(k => k+1)   // Force SessionTimer re-mount
  → TimerService reads updated sessionStorage on next tick

Pause/Resume
  → onTogglePause()
  → TimerService.pause() or TimerService.resume()

Golden Key Apply
  → onApplyGoldenKey()
  → Decrement learner.golden_keys inventory
  → Set learner.active_golden_keys[lessonKey] = true
  → TimerService.setPlayTimerLimits() with bonus seconds added

Golden Key Suspend
  → onSuspendGoldenKey()
  → setGoldenKeyBonus(0), setIsGoldenKeySuspended(true)
  → TimerService.setPlayTimerLimits() without bonus

Golden Key Unsuspend
  → onUnsuspendGoldenKey()
  → Restore bonus from learner profile
  → TimerService.setPlayTimerLimits() with bonus restored
```

---

## PhaseTimersOverlay Save Flow

1. Parent edits timer values in the overlay
2. Clicks Save → `onSave(updatedTimers)` callback
3. `SessionPageV2` calls `patchLearner({ ...updatedTimers })`
4. Learner Settings Bus broadcasts the patch to running session
5. `SessionPageV2.patchLearner` handler updates `phaseTimers` state + `phaseTimersRef.current`
6. If session is active, `TimerService.setPlayTimerLimits()` / `setWorkTimerLimits()` called
7. Changes take effect on NEXT phase start (not retroactively on current phase)

---

## PIN Protection

Both overlays require PIN authorization:
- `ensurePinAllowed('timer')` gate in `SessionPageV2.jsx`
- PIN validation via `src/app/session/components/PinModal.jsx`
- See [pin-protection.md](pin-protection.md) for the full PIN gate architecture

---

## DO NOT BREAK

1. **remainingSeconds via prop, not polling**: `TimerControlOverlay` reads `remainingSeconds` from the prop (fed by TimerService events). Do NOT have it poll sessionStorage directly — this causes a 1-second display lag and potential reads before write.

2. **timerRefreshKey increment is mandatory**: After any `onUpdateTime()` call, `setTimerRefreshKey(k => k+1)` MUST be called. Without it, `SessionTimer` does not re-read the updated sessionStorage.

3. **Golden key bonus applies to play timers ONLY**: Work timer limits must not change when golden key is applied/suspended. `TimerService.setPlayTimerLimits()` must be called, not `setWorkTimerLimits()`.

4. **No direct TimerService mutation from overlay**: All time adjustments go through sessionStorage first. TimerService reads from sessionStorage on next tick. This is intentional — direct mutation can race with active ticks.

5. **PhaseTimersOverlay changes are profile-level**: They persist to `learners` table. If you make a profile-level change take effect immediately without the Learner Settings Bus, you create a divergence between the running session and the profile.

6. **Current phase timer is ephemeral**: Adjusting remaining time via `TimerControlOverlay` does NOT affect the snapshot's `timerState`. The next gate save will write the adjusted time to the snapshot.

---

## What Breaks Timers Overlay

- Removing `setTimerRefreshKey` after `onUpdateTime()` call (timer display doesn't update)
- Fetching timer state from sessionStorage inside `TimerControlOverlay` directly (race with TimerService writes)
- Applying golden key bonus to work timer limits instead of play timer limits
- Forgetting to call `TimerService.setPlayTimerLimits()` after golden key apply/suspend
