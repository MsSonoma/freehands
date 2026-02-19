# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Ms. Sonoma resume snapshot during work timer subphase shows play timer 0:00; should resume work timer countdown. Fix restore logic to keep work timer mode.
```

Filter terms used:
```text
Ms
Sonoma
resume
snapshot
during
work
timer
subphase
shows
play
timer
00
should
resume
work
timer
countdown
Fix
restore
logic
to
keep
work
timer
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Ms Sonoma resume snapshot during work timer subphase shows play timer 00 should resume work timer countdown Fix restore logic to keep work timer

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (98da689875b01c20d6f046c5f6bab34a0aa7d5020eb603fec2454ebcf334f4ab)
- bm25: -76.1010 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Ms. Sonoma session: when resuming from snapshot during work timer subphase, progress restores correctly but the UI resumes the play timer at 0:00; it should resume the work timer countdown. Find snapshot restore code, timer mode selection (play vs work), and fix.
```

Filter terms used:
```text
Ms
Sonoma
session
when
resuming
from
snapshot
during
work
timer
subphase
progress
restores
correctly
but
the
UI
resumes
the
play
timer
at
00
it
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Ms Sonoma session when resuming from snapshot during work timer subphase progress restores correctly but the UI resumes the play timer at 00 it

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/session-takeover.md (8eaa1cd051d3b4acc893704b43238e49e42228f5a984ae66dc5bff2b3081b7a3)
- bm25: -37.8172 | relevance: 1.0000

**Why snapshot, not sessionStorage?**
- sessionStorage is device-local, not cross-device
- Snapshot already saves at every gate (no extra writes)
- Restoring from snapshot ensures timer continuity after takeover
- sessionStorage still used as fast cache between gates on same device

### Play Timer Expiration: Countdown Once

### 2. docs/brain/session-takeover.md (8eaa1cd051d3b4acc893704b43238e49e42228f5a984ae66dc5bff2b3081b7a3)
- bm25: -56.0382 | relevance: 1.0000

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

### 3. sidekick_pack.md (3fe30892a2a2ca4064bcfb72ecd140acf6e85cf7b8d43df6fabc12eb9eaeae57)
- bm25: -55.7535 | relevance: 1.0000

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

### 2. docs/brain/timer-system.md (31fbc062724d64b66b29543e253c240d268ae1bac63e16ef5601b969c597e0c1)
- bm25: -35.4281 | relevance: 1.0000

### 4. docs/brain/session-takeover.md (419bb18dc91f9ce3fc03b51ba4e4f46cfc91dca87668b0814d0fac003533bbcb)
- bm25: -52.0523 | relevance: 1.0000

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

### 5. sidekick_pack.md (66c3bf2eb605550f6ac428e7863fe7e315070c7064e27c073a4e5b6a094e180d)
- bm25: -51.3812 | relevance: 1.0000

### 10. docs/brain/session-takeover.md (419bb18dc91f9ce3fc03b51ba4e4f46cfc91dca87668b0814d0fac003533bbcb)
- bm25: -30.0235 | relevance: 1.0000

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

### 6. sidekick_pack.md (72f0b310323bf81af5c4ce8e3d9d2518a955947ce0cbcb51d3ae7d71bbfa445a)
- bm25: -48.4461 | relevance: 1.0000

**Work timer spans discussion + teaching**: The discussion work timer starts when the discussion greeting begins playing and runs through the entire teaching phase. It is completed when teaching finishes, so the countdown must **not** be stopped at `greetingComplete` or `discussionComplete`. Completing it early will freeze the visible timer as soon as the teaching controls appear.

**Timer Modes:**
1. **Play Timer** (green) - Expected to use full time; learner can interact with Ask, Riddle, Poem, Story, Fill-in-Fun opening actions
2. **Work Timer** (amber/red) - Learner should complete phase; input focused on lesson questions

**V2** Timer mode tracked only for phases 2-5:
```javascript
{
  comprehension: 'play' | 'work',
  exercise: 'play' | 'work',
  worksheet: 'play' | 'work',
  test: 'play' | 'work'
}
```

### Phase 2 Implementation (V2)

**TimerService Extensions:**
- `playTimers` Map: phase → `{ startTime, elapsed, timeLimit, expired }`
- `playTimerInterval`: 1-second tick interval for active play timers
- `currentPlayPhase`: Currently active play phase (only one at a time)
- `mode`: Current timer mode ('play' | 'work')

### 13. docs/brain/timer-system.md (b528b741fad7d3d86f62d013e0cc846e2e18e614028489363ed3671475b5ee8b)
- bm25: -28.9297 | relevance: 1.0000

**Pause behavior:**
- Stops all tick intervals (play and work)
- Stores current elapsed time for active timers
- Tick methods guard against running when paused
- **Critical:** Prevents `playTimerExpired` event from firing during pause
- Timer UI shows pause icon but displays frozen elapsed time

**Resume behavior:**
- Adjusts `startTime` to account for paused duration
- Restarts tick intervals
- Timers continue from where they left off
- No time is lost or gained during pause

### 7. docs/brain/timer-system.md (b528b741fad7d3d86f62d013e0cc846e2e18e614028489363ed3671475b5ee8b)
- bm25: -47.1421 | relevance: 1.0000

**Pause behavior:**
- Stops all tick intervals (play and work)
- Stores current elapsed time for active timers
- Tick methods guard against running when paused
- **Critical:** Prevents `playTimerExpired` event from firing during pause
- Timer UI shows pause icon but displays frozen elapsed time

**Resume behavior:**
- Adjusts `startTime` to account for paused duration
- Restarts tick intervals
- Timers continue from where they left off
- No time is lost or gained during pause

**Event-Driven Display (V2):**
- `SessionPageV2` maintains separate display state for play and work timers:
  - `playTimerDisplayElapsed` / `playTimerDisplayRemaining`
  - `workTimerDisplayElapsed` / `workTimerDisplayRemaining`
- Event subscriptions update display state:
  - `playTimerTick` / `workPhaseTimerTick` - continuous updates while running
  - `playTimerStart` / `workPhaseTimerStart` - initialize display when timer starts
- `SessionTimer` receives `elapsedSeconds`/`remainingSeconds` as props based on current timer mode
- This prevents play and work timers from sharing/overwriting countdown values

**Phase Transitions:**
- `playTimerExpired` event handler calls `handlePhaseTimerTimeUp()` to trigger state changes
- Without this call, timer expiry would show overlay but not advance phases or update timer modes
- Phase state machine depends on `handlePhaseTimerTimeUp` for 'play' → 'work' transitions

**Key files:**
- `src/app/session/v2/TimerService.jsx` - `pause()`, `resume()`, pause guards in tick methods
- `src/app/session/v2/SessionPageV2.jsx` - `handleTimerPauseToggle`, `timerPaused` state, event subscriptions, separate play/work display state

## Recent Changes

### 8. docs/brain/timer-system.md (1b526c919780716e4b7fea7e45b580988afdd9dd9b8794ec5da9b3185775f50f)
- bm25: -47.1348 | relevance: 1.0000

**2025-12-09**: FIX - Clear opening action sequences when play timer expires to prevent hangover at work transition. When play timer reaches 00:00 and countdown starts, any active opening action (ask, joke, riddle, poem, story, fill-in-fun, games) must be cleared immediately. Without this, if an opening action is running when the countdown starts, it can interfere with the automatic transition to work subphase (teaching or Q&A) after the 30-second countdown completes. Added comprehensive state clearing to `handlePlayTimeUp`: all opening action states reset to 'inactive', story and fill-in-fun data cleared, games overlay closed. This ensures a clean slate before work phase begins.

**2025-12-05**: CRITICAL FIX - Removed `setShowOpeningActions(false)` from `handlePlayExpiredComplete`. This was breaking all phase transitions because phase handlers already hide buttons as part of their normal flow. The premature state change created race conditions preventing Go button from working and timer from advancing phases. Each phase handler (handleGoComprehension, handleGoExercise, etc.) manages its own button visibility - timer handler should not interfere.

### Timer Persistence
- **src/app/session/hooks/useSnapshot.js**:
  - Timer state saved to sessionStorage
  - Restored on page load/refresh

## Recent Changes

**2025-12-28**: Entering Test review now calls `markWorkPhaseComplete('test')`, clears the test timer, and records remaining work time immediately. Grading/review can no longer show an active or timed-out test after all questions are answered.

### 9. sidekick_pack.md (006e8aaf8fab9ff4eaf916d6384fe2fa7697a8c0dbf76156e69a907b762ddc6b)
- bm25: -46.9195 | relevance: 1.0000

**2025-12-09**: FIX - Clear opening action sequences when play timer expires to prevent hangover at work transition. When play timer reaches 00:00 and countdown starts, any active opening action (ask, joke, riddle, poem, story, fill-in-fun, games) must be cleared immediately. Without this, if an opening action is running when the countdown starts, it can interfere with the automatic transition to work subphase (teaching or Q&A) after the 30-second countdown completes. Added comprehensive state clearing to `handlePlayTimeUp`: all opening action states reset to 'inactive', story and fill-in-fun data cleared, games overlay closed. This ensures a clean slate before work phase begins.

### 10. docs/brain/timer-system.md (75eb75b205360de0660d27d8b243209381277ef9ef5df63d1e5253f267fa4a8d)
- bm25: -46.5358 | relevance: 1.0000

## Key Files

### Core Timer Logic
- **src/app/session/page.js**:
  - `currentTimerMode` state (line ~398)
  - `startPhasePlayTimer()` (line ~780)
  - `transitionToWorkTimer()` (line ~788)
  - `handlePlayTimeUp()` (line ~803)
  - `handlePlayExpiredComplete()` (line ~810)
  - `handleWorkTimeUp()` (line ~835)
  - `markWorkPhaseComplete()` (line ~843)
  - `workPhaseCompletions` state (line ~491)

### Timer Component

#### Pace Coloring (Work Timers)

`SessionTimer` colors **work** timers by comparing lesson progress ($0$-$100$) vs time elapsed ($0$-$100$):

- `timeProgress = (elapsedSeconds / totalSeconds) * 100`
- `progressDiff = lessonProgress - timeProgress`
- Work timers:
  - Yellow when `progressDiff < -5`
  - Red when `progressDiff < -15` or at `00:00`

**Critical wiring rule (V2 parity):** V2 must pass a real `lessonProgress` value into every `SessionTimer` render (especially the in-video overlay timer). If omitted, `SessionTimer` defaults `lessonProgress = 0`, which causes timers to turn yellow/red almost immediately as soon as timeProgress exceeds 5%/15%.

**V2 implementation detail:** V2 computes `lessonProgress` using the same phase-weight mapping as V1 and derives within-phase progress from snapshot `phaseData[phase].nextQuestionIndex` vs total questions.
- **src/app/session/components/PlayTimeExpiredOverlay.jsx**:
  - 30-second countdown overlay
  - Auto-fires `onComplete` callback when countdown finishes

### Timer Defaults
- **src/app/session/utils/phaseTimerDefaults.js**:
  - Default minutes per phase per mode
  - Golden key bonus time constant

### Phase Handlers

### Timer Pause/Resume

**Feature:** Facilitators can pause/resume timers via PIN-gated controls in the timer overlay.

### 11. sidekick_pack.md (3f0f82f2b57721c6b4ee30f8139a2925235abf1723d288f872e60ba6d165aa8d)
- bm25: -45.9861 | relevance: 1.0000

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

### 12. src/app/session/page.js (2cf08f5a7761f406520e67575a6732a7569e3c2a45f72bac41eda4f4163c94d3)
- bm25: -45.8585 | relevance: 1.0000

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

### 13. docs/brain/timer-system.md (b7aa6681ad045e85a58422ec46641d948683a8b9be9eb4e041d2b6d83bd36742)
- bm25: -43.7910 | relevance: 1.0000

2. **PlayTimeExpiredOverlay** displays:
   - Shows "Time to Get Back to Work!" message
   - 30-second countdown (green, turns amber at 5 seconds)
   - Displays phase name user will return to
   - Auto-advances when countdown reaches 0

3. **handlePlayExpiredComplete** fires when countdown completes:
   - Hides overlay (`showPlayTimeExpired = false`)
   - Transitions to work timer for expired phase
   - Automatically starts the work phase:
     - Discussion/Teaching: calls `startSession()` (orchestrator start)
     - Comprehension/Exercise/Worksheet/Test: calls the phase controller `go()` (`comprehensionPhaseRef.current.go()`, etc.)
   - Each phase handler hides play buttons as part of its normal flow
   - Clears `playExpiredPhase`
  - When discussion/teaching needs to auto-start, `startSession({ ignoreResume: true })` is used so a stale snapshot resumePhase cannot skip ahead during an active lesson.

### Go Button Override

If user clicks Go button during the 30-second countdown:
- Overlay is immediately dismissed
- Work timer starts without waiting for countdown
- All phase start handlers check and clear overlay state

### Work Time Completion Tracking

### 14. sidekick_pack.md (573e7a5f98d31d29331cb20a978474dceb5cbe1d72d69affb84d37656eef90f7)
- bm25: -43.7318 | relevance: 1.0000

## Key Files

### 9. docs/brain/timer-system.md (75eb75b205360de0660d27d8b243209381277ef9ef5df63d1e5253f267fa4a8d)
- bm25: -30.1082 | relevance: 1.0000

## Key Files

### Core Timer Logic
- **src/app/session/page.js**:
  - `currentTimerMode` state (line ~398)
  - `startPhasePlayTimer()` (line ~780)
  - `transitionToWorkTimer()` (line ~788)
  - `handlePlayTimeUp()` (line ~803)
  - `handlePlayExpiredComplete()` (line ~810)
  - `handleWorkTimeUp()` (line ~835)
  - `markWorkPhaseComplete()` (line ~843)
  - `workPhaseCompletions` state (line ~491)

### Timer Component

#### Pace Coloring (Work Timers)

`SessionTimer` colors **work** timers by comparing lesson progress ($0$-$100$) vs time elapsed ($0$-$100$):

- `timeProgress = (elapsedSeconds / totalSeconds) * 100`
- `progressDiff = lessonProgress - timeProgress`
- Work timers:
  - Yellow when `progressDiff < -5`
  - Red when `progressDiff < -15` or at `00:00`

**Critical wiring rule (V2 parity):** V2 must pass a real `lessonProgress` value into every `SessionTimer` render (especially the in-video overlay timer). If omitted, `SessionTimer` defaults `lessonProgress = 0`, which causes timers to turn yellow/red almost immediately as soon as timeProgress exceeds 5%/15%.

**V2 implementation detail:** V2 computes `lessonProgress` using the same phase-weight mapping as V1 and derives within-phase progress from snapshot `phaseData[phase].nextQuestionIndex` vs total questions.
- **src/app/session/components/PlayTimeExpiredOverlay.jsx**:
  - 30-second countdown overlay
  - Auto-fires `onComplete` callback when countdown finishes

### Timer Defaults
- **src/app/session/utils/phaseTimerDefaults.js**:
  - Default minutes per phase per mode
  - Golden key bonus time constant

### Phase Handlers

### Timer Pause/Resume

### 15. sidekick_pack.md (2c06eb311823ac2f8b8a01f3561df513201d15773bf5ddb5b4355ca7199676c6)
- bm25: -43.4099 | relevance: 1.0000

2. **PlayTimeExpiredOverlay** displays:
   - Shows "Time to Get Back to Work!" message
   - 30-second countdown (green, turns amber at 5 seconds)
   - Displays phase name user will return to
   - Auto-advances when countdown reaches 0

3. **handlePlayExpiredComplete** fires when countdown completes:
   - Hides overlay (`showPlayTimeExpired = false`)
   - Transitions to work timer for expired phase
   - Automatically starts the work phase:
     - Discussion/Teaching: calls `startSession()` (orchestrator start)
     - Comprehension/Exercise/Worksheet/Test: calls the phase controller `go()` (`comprehensionPhaseRef.current.go()`, etc.)
   - Each phase handler hides play buttons as part of its normal flow
   - Clears `playExpiredPhase`
  - When discussion/teaching needs to auto-start, `startSession({ ignoreResume: true })` is used so a stale snapshot resumePhase cannot skip ahead during an active lesson.

### Go Button Override

If user clicks Go button during the 30-second countdown:
- Overlay is immediately dismissed
- Work timer starts without waiting for countdown
- All phase start handlers check and clear overlay state

### Work Time Completion Tracking

### 19. docs/brain/timer-system.md (42aa7c76a1e732a4ec83b46c76f7214efa5fa927819ed9a691f311cae452a2df)
- bm25: -26.7530 | relevance: 1.0000

**Rule (single instance):** Only one `SessionTimer` instance should be mounted at a time for a given `{lessonKey, phase, mode}`.
- Mounting two `SessionTimer` components simultaneously can show brief 1-second drift when `SessionTimer` is in self-timing mode.
- In Session V2, when the Games overlay is open, the on-video timer is not rendered; the Games overlay renders the timer instead.

### 16. sidekick_pack.md (36e41298626e151568cf8e4bc8053aaa373fa99633554eddcaaf06ef3a731d82)
- bm25: -42.1917 | relevance: 1.0000

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

### 17. docs/brain/session-takeover.md (15220505a1b46edd3a4491aa177082deecf628df049e021e34cfda9447fbf112)
- bm25: -42.0688 | relevance: 1.0000

**Why this sequencing matters:**
- OLD BUG (pre 2026-01-14): `sessionConflictChecked` set true in finally block → Snapshot restored WHILE takeover dialog showing → Creates duplicate session/transcript splits
- NEW FIX (2026-01-14): `sessionConflictChecked` stays false on conflict → Takeover resolved first (via reload) → Snapshot restored cleanly ONCE

**Settlement order enforcement:**
- NO conflict: `sessionConflictChecked = true` immediately, snapshot restore proceeds
- CONFLICT detected: `sessionConflictChecked` stays false, snapshot restore blocked
- Takeover resolved: page reloads, fresh conflict check passes, snapshot restores once
- Error during check: `sessionConflictChecked = true` (fail-safe to allow snapshot restore)

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

### 18. src/app/session/v2/TimerService.jsx (c366ffd95c213031782db363c3a2ba3af35515665534c9d34e73a8e41492b13b)
- bm25: -42.0130 | relevance: 1.0000

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

### 19. sidekick_pack.md (f450fe051291004e002dd760a02abbc5b0718dcd37dd58ff2f42035324c06484)
- bm25: -41.9302 | relevance: 1.0000

❌ **Never allow refresh to reset play timer**
- First interaction gate persists timer state
- `recordFirstInteraction()` wrapper ensures snapshot save on first button click

❌ **Never modify timer state without clearing sessionStorage**
- When transitioning play → work, clear play timer key from sessionStorage
- Prevents stale timer state on refresh

❌ **Never show countdown overlay without phase context**
- `playExpiredPhase` must be set so correct work handler fires
- Overlay should display which phase learner will return to

## Related Brain Files

### 15. src/app/session/v2/TimerService.jsx (c366ffd95c213031782db363c3a2ba3af35515665534c9d34e73a8e41492b13b)
- bm25: -27.3372 | relevance: 1.0000

### 20. sidekick_pack.md (7b4b9aabd6a7a8230eceae61b25ce1299b927d0790923771310e60d0162821f1)
- bm25: -40.9827 | relevance: 1.0000

### 23. docs/brain/v2-architecture.md (7bae77a72d2662755ee6567d868690beefe0323bcc435870d09473c3d88fec22)
- bm25: -25.9929 | relevance: 1.0000

**Implementation:**
- Discussion phase: greeting TTS + single "Begin" button → advances to teaching
- No opening action buttons in discussion phase
- No play timer in discussion phase (instant transition)
- Play/work timer modes still apply to Teaching, Repeat, Transition, Comprehension, Closing phases
- Lesson title in discussion/closing flows comes from `lessonData.title` with `lessonId` fallback; never reference undeclared locals when wiring DiscussionPhase
- The discussion work timer **spans both discussion and teaching**. It starts on discussion entry and must be completed when teaching finishes (not on `discussionComplete`), or the visible timer will freeze as soon as the definitions CTA appears.
- Opening action buttons (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games) appear during play time in phases 2-5

### 24. docs/brain/timer-system.md (e8b4630a80a6b748beb9f24a91d99b483a671997f18b6fa863773ada69c26a7d)
- bm25: -25.5229 | relevance: 1.0000

**2025-12-18**: Restore no longer forces `playExpiredCountdownCompleted` to true. The countdown flag is restored from snapshot state and only set during restore when an expired play timer is detected. Live sessions resumed after a restore can still show the 30-second countdown on the next play timeout.

### 25. docs/brain/timer-system.md (1f66fc9b2014880a4f602ba3a64aeb3037bbda3f80bafc5c833fb3aeea069133)
- bm25: -25.0504 | relevance: 1.0000

### Play Portion Enabled Flags (Per Learner)

Phases 2-5 (Comprehension, Exercise, Worksheet, Test) each have a per-learner flag that can disable the "play portion" of that phase.

### 21. docs/brain/session-takeover.md (67d6f1cc34af6fd217783490d4f011c8cef30e9a03ac7f4e9f0c5692245348e3)
- bm25: -40.9501 | relevance: 1.0000

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

### 22. docs/brain/timer-system.md (afad3d67c6731ffd234f48a50bd80e7569f7b92cd4cc8bdd5bcbaad5ac994b38)
- bm25: -40.2407 | relevance: 1.0000

This ensures timers tick down from the moment the relevant gate is visible (Begin for play; Go for work), not when it's clicked.

**Work timer spans discussion + teaching**: The discussion work timer starts when the discussion greeting begins playing and runs through the entire teaching phase. It is completed when teaching finishes, so the countdown must **not** be stopped at `greetingComplete` or `discussionComplete`. Completing it early will freeze the visible timer as soon as the teaching controls appear.

**Timer Modes:**
1. **Play Timer** (green) - Expected to use full time; learner can interact with Ask, Riddle, Poem, Story, Fill-in-Fun opening actions
2. **Work Timer** (amber/red) - Learner should complete phase; input focused on lesson questions

**V2** Timer mode tracked only for phases 2-5:
```javascript
{
  comprehension: 'play' | 'work',
  exercise: 'play' | 'work',
  worksheet: 'play' | 'work',
  test: 'play' | 'work'
}
```

### Phase 2 Implementation (V2)

**TimerService Extensions:**
- `playTimers` Map: phase → `{ startTime, elapsed, timeLimit, expired }`
- `playTimerInterval`: 1-second tick interval for active play timers
- `currentPlayPhase`: Currently active play phase (only one at a time)
- `mode`: Current timer mode ('play' | 'work')

### 23. sidekick_pack.md (e06d4291f97ea403f4d1ffcd5402bfa365eb001584a444fdf45ab58ebfd91ee2)
- bm25: -40.1068 | relevance: 1.0000

'use client';

### 16. docs/brain/session-takeover.md (15220505a1b46edd3a4491aa177082deecf628df049e021e34cfda9447fbf112)
- bm25: -26.9789 | relevance: 1.0000

**Why this sequencing matters:**
- OLD BUG (pre 2026-01-14): `sessionConflictChecked` set true in finally block → Snapshot restored WHILE takeover dialog showing → Creates duplicate session/transcript splits
- NEW FIX (2026-01-14): `sessionConflictChecked` stays false on conflict → Takeover resolved first (via reload) → Snapshot restored cleanly ONCE

**Settlement order enforcement:**
- NO conflict: `sessionConflictChecked = true` immediately, snapshot restore proceeds
- CONFLICT detected: `sessionConflictChecked` stays false, snapshot restore blocked
- Takeover resolved: page reloads, fresh conflict check passes, snapshot restores once
- Error during check: `sessionConflictChecked = true` (fail-safe to allow snapshot restore)

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

### 17. docs/brain/games-overlay.md (3d69f6755dd3a8792771418e6e2fe533bcaad2786166bfa293915f77a4ff8f9d)
- bm25: -26.9626 | relevance: 1.0000

### 24. docs/brain/ingests/pack-mentor-intercepts.md (08191c1e946bc63bc45a43254cb2accc0e9eef97fc1d5a13ecd50fc3089f0a45)
- bm25: -40.0862 | relevance: 1.0000

### 25. docs/brain/session-takeover.md (67d6f1cc34af6fd217783490d4f011c8cef30e9a03ac7f4e9f0c5692245348e3)
- bm25: -13.0742 | relevance: 1.0000

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

### 25. docs/brain/timer-system.md (93b5f5f1e95bf4a72b420f92660d6ca4559847ff7ab32409c591f92360c08643)
- bm25: -39.9948 | relevance: 1.0000

❌ **Never use local persistence fallback for `play_*_enabled`**
- Do not store per-learner play portion flags in localStorage.
- Source of truth is Supabase; the bus is for immediate UI reaction only.

❌ **Never add a Discussion play toggle**
- Discussion has no play timer in V2, and this feature only targets phases 2-5.

❌ **Never award or apply Golden Key bonus when disabled**
- If `golden_keys_enabled` is false, do not apply bonus minutes and do not write golden key awards.

❌ **Never hide play buttons manually in timer expiry handler**
- Phase handlers (handleGoComprehension, etc.) already call `setShowOpeningActions(false)`
- Setting it in handlePlayExpiredComplete creates race conditions and breaks phase transitions
- Let each phase handler manage its own button visibility

❌ **Never allow play buttons to remain visible after timer expiry**
- Timer expiry must automatically advance to work phase
- Play buttons will be hidden by the phase handler that starts the work

❌ **Never require Go button click after timer expiry**
- Timer expiry should bypass Go button confirmation
- `handlePlayExpiredComplete` must auto-start the work phase

❌ **Never allow refresh to reset play timer**
- First interaction gate persists timer state
- `recordFirstInteraction()` wrapper ensures snapshot save on first button click

❌ **Never modify timer state without clearing sessionStorage**
- When transitioning play → work, clear play timer key from sessionStorage
- Prevents stale timer state on refresh

❌ **Never show countdown overlay without phase context**
- `playExpiredPhase` must be set so correct work handler fires
- Overlay should display which phase learner will return to

## Related Brain Files

### 26. docs/brain/timer-system.md (b90b83953b55369af6b1840a6cccf28923940068aa3948b4bb4042752c4610dc)
- bm25: -39.7697 | relevance: 1.0000

# Timer System Architecture

**Last updated**: 2026-02-04T01:00:00Z  
**Status**: Canonical

## How It Works

### Play vs Work Timers

**V1**: Each phase (discussion, comprehension, exercise, worksheet, test) has two timer modes.

**V2**: Discussion has **no play timer**. Phases 2-5 (Comprehension, Exercise, Worksheet, Test) use play → work mode. A **discussion work timer** still exists and spans discussion + teaching.

**Rationale**: Removing play timer from discussion phase eliminates infinite play timer exploit (learner could refresh during discussion to reset play timer indefinitely without starting teaching).

**Discussion work timer startup**: The work timer for discussion is started when the greeting begins playing (greetingPlaying event). This is an exception - all other work timers start when the awaiting-go gate appears.

**Timeline jump timer startup**: When facilitator uses timeline to jump to a phase, the appropriate timer starts immediately:
- Discussion: Work timer starts immediately (exception to normal greetingPlaying rule)
- Other phases: Play timer starts immediately (not when Begin clicked)

Timeline jumps explicitly stop any existing timers for the target phase before starting new ones, ensuring a clean reset.

**Timer restart prevention**: Removed in favor of explicit stop/start pattern on timeline jumps. Timers can now be legitimately restarted when needed.

### 27. src/app/session/hooks/useSnapshotPersistence.js (4698b3071633f16c3763fdf8ca347c1b304fae9a54d2632505f7143c44bfb80b)
- bm25: -39.5214 | relevance: 1.0000

// Check if play timer expired while page was closed.
              // Skip countdown by setting flag and transition to work mode.
              if (desiredMode === 'play' && Number.isFinite(target) && adjustedElapsed >= target) {
                if (typeof setPlayExpiredCountdownCompleted === 'function') {
                  setPlayExpiredCountdownCompleted(true);
                }
                setCurrentTimerMode((prev) => ({
                  ...(prev || {}),
                  [timerPhaseName]: 'work',
                }));
                try {
                  sessionStorage.removeItem(storageKey);
                } catch {}
                if (typeof setNeedsPlayExpiredTransition === 'function') {
                  setNeedsPlayExpiredTransition(timerPhaseName);
                }
              }
            }
          }
        } catch {}
        
        // Defer clearing loading until the resume reconciliation effect completes
        try { setTtsLoadingCount(0); } catch {}
        // DO NOT set isSpeaking=false here - let audio.onended handle it after caption replay
        try {
          // Minimal canSend heuristics on restore: enable only when in awaiting-begin or review or teaching stage prompts
          const enable = (
            (snap.phase === 'discussion' && snap.subPhase === 'awaiting-learner') ||
            (snap.phase === 'comprehension' && snap.subPhase === 'comprehension-start') ||
            (snap.phase === 'exercise' && snap.subPhase === 'exercise-awaiting-begin') ||
            (snap.phase === 'worksheet' && snap.subPhase === 'worksheet-awaiting-begin') ||
            (snap.phase === 'test' && (snap.subPhase === 'test-awaiting-begin' || snap.subPhase === 'review-start')) ||
            (snap.phase === 'teaching' && snap.subPhase === 'tea

### 28. docs/brain/timer-system.md (31fbc062724d64b66b29543e253c240d268ae1bac63e16ef5601b969c597e0c1)
- bm25: -39.4918 | relevance: 1.0000

**Refresh/resume rule (critical):**
- If a phase is in **play** (`timerMode === 'play'`), the phase controller must resume at the **Go gate** (`state = 'awaiting-go'`) and must **not** auto-play/auto-start Q&A.
- If `timerMode` is missing in resumeState (older snapshots), infer it:
  - Treat as **work** only when there is evidence of work progress (answers exist, nextQuestionIndex > 0, score > 0, or reviewIndex set for Test).
  - Otherwise treat as **play**.
- On resume, do **not** call `timerService.startPlayTimer(...)` or `timerService.transitionToWork(...)` unless the resume request explicitly sets `skipPlayPortion`. TimerService is already restored from `snapshot.timerState` and should not be reset by phase controllers.

**Phase files implementing this rule (V2):**
- `src/app/session/v2/ComprehensionPhase.jsx`
- `src/app/session/v2/ExercisePhase.jsx`
- `src/app/session/v2/WorksheetPhase.jsx`
- `src/app/session/v2/TestPhase.jsx`

**Important (V2 lifecycle):** The TimerService instance must remain stable for the duration of a session and must not be recreated on every phase transition. Recreating it will lose timer Maps and can leave stale sessionStorage keys behind.

**iOS/Safari timer recovery (critical):**

iOS Safari can suspend or delay JavaScript intervals during backgrounding, BFCache restores, or focus changes. To prevent the on-video timer display from appearing frozen after returning to the tab:

- `SessionPageV2` calls `timerService.resync(...)` on `visibilitychange` (when becoming visible), `focus`, and `pageshow`.
- `TimerService.resync()` is best-effort: it re-arms missing intervals (when not paused) and emits an immediate catch-up tick so the UI updates to the correct remaining time.

### Games Overlay Timer Parity (V2)

### 29. docs/brain/timer-system.md (b82eb51a9bfc3c10ee8b8764c1d011316f357461e9443439a54a6b4c37d5a477)
- bm25: -38.7270 | relevance: 1.0000

**Play Timer Methods:**
- `startPlayTimer(phase, timeLimit)`: Starts play timer for phase (phases 2-5 only)
  - Validates phase (discussion rejected)
  - Initializes timer state
  - Emits `playTimerStart` event
  - Starts tick interval if not running
- `stopPlayTimer(phase)`: Stops play timer for phase
  - Removes timer from Map
  - Clears interval if no active timers
  - Saves to sessionStorage
- `transitionToWork(phase)`: Transitions from play to work mode
  - Stops play timer
  - Sets mode to 'work'
  - Starts work phase timer
- `pause()`: Pauses all running timers
  - Stores current elapsed time for play/work timers
  - Clears tick intervals to stop time progression
  - Sets `isPaused` flag to true
- `resume()`: Resumes paused timers
  - Adjusts startTime to account for paused duration
  - Restarts tick intervals
  - Sets `isPaused` flag to false
- `#tickPlayTimers()`: Private tick method (1-second interval)
  - Guards against running when paused (`isPaused` check)
  - Updates elapsed time
  - Emits `playTimerTick` event
  - Checks for expiration (remaining === 0)
  - Emits `playTimerExpired` event when time up
  - Auto-stops timer on expiration

### 30. sidekick_pack.md (98f7f4c4bd58e59212de7dde4986cdaa69cc583b77150cde2a3c1649ddf0b2b4)
- bm25: -38.5432 | relevance: 1.0000

**Play Timer Methods:**
- `startPlayTimer(phase, timeLimit)`: Starts play timer for phase (phases 2-5 only)
  - Validates phase (discussion rejected)
  - Initializes timer state
  - Emits `playTimerStart` event
  - Starts tick interval if not running
- `stopPlayTimer(phase)`: Stops play timer for phase
  - Removes timer from Map
  - Clears interval if no active timers
  - Saves to sessionStorage
- `transitionToWork(phase)`: Transitions from play to work mode
  - Stops play timer
  - Sets mode to 'work'
  - Starts work phase timer
- `pause()`: Pauses all running timers
  - Stores current elapsed time for play/work timers
  - Clears tick intervals to stop time progression
  - Sets `isPaused` flag to true
- `resume()`: Resumes paused timers
  - Adjusts startTime to account for paused duration
  - Restarts tick intervals
  - Sets `isPaused` flag to false
- `#tickPlayTimers()`: Private tick method (1-second interval)
  - Guards against running when paused (`isPaused` check)
  - Updates elapsed time
  - Emits `playTimerTick` event
  - Checks for expiration (remaining === 0)
  - Emits `playTimerExpired` event when time up
  - Auto-stops timer on expiration

### 31. sidekick_pack.md (55314b4920a48e80c0edb7a84a980e90a398fbff66fc9af1806a4896d4997e1e)
- bm25: -38.5206 | relevance: 1.0000

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

### 32. src/app/session/v2/SessionPageV2.jsx (ea63b5bf1596b91dc29b49f0d4b2e7dedae00f81fdeb3a6555b667c9cf8b435a)
- bm25: -38.4025 | relevance: 1.0000

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

### 33. docs/brain/timer-system.md (b404039d9962462ff4e3c0434db375ab6763da6d88ccc7462dacc762647febfb)
- bm25: -38.2727 | relevance: 1.0000

**2026-01-14**: MAJOR refactor - SessionTimer now pure display component in V2. Receives elapsed/remaining from TimerService events via SessionPageV2 subscriptions. No internal timing logic. Single source of truth architecture eliminates duplicate timer tracking and pause race conditions.

**2026-01-14**: Fixed timer pause issue (second pass): Prevented TimerService from writing to sessionStorage when paused, and prevented SessionTimer from triggering onTimeUp when paused or when resuming from a paused state past expiration time.

**2026-01-14**: Fixed timer pause issue where pausing stopped cosmetic timer display but authoritative timer kept running and could trigger playTimerExpired/stage transitions. Added pause()/resume() methods to TimerService that stop/restart intervals and adjust startTime to preserve elapsed time. Tick methods now guard against running when paused.

**2025-12-28**: Entering Test review now calls `markWorkPhaseComplete('test')`, clears the test timer, and records remaining work time immediately. Grading/review can no longer show an active or timed-out test after all questions are answered.

**2025-12-28**: Golden key detection now reads `workPhaseCompletionsRef` to include phases marked complete in the same tick (no stale state), ensuring earned keys are awarded when the third on-time work phase finishes.

**2025-12-19**: Golden key eligibility now requires three on-time work timers. Facilitator test review shows remaining work time per phase based on work timers only; play timers are ignored.

### 34. docs/brain/timer-system.md (db14fa9e319bed0b6ca69f83c9f47c71c1ce32cffdf83994904af06f42b372c5)
- bm25: -38.1261 | relevance: 1.0000

**2025-12-03**: Fixed bug where 30-second countdown overlay persisted through lesson restart. Added `setShowPlayTimeExpired(false)` and `setPlayExpiredPhase(null)` to `handleRestartClick` in useResumeRestart.js so overlay is properly dismissed when user restarts the lesson.

**2025-12-03**: [REVERTED - see 2025-12-05] Fixed bug where play buttons (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games, Go) remained visible after play timer expired and 30-second countdown completed. Added `setShowOpeningActions(false)` to `handlePlayExpiredComplete` so buttons are hidden before auto-starting work phase. This ensures timer expiry bypasses Go button requirement as designed.

**2025-11-24**: Added Go button override - clicking Go during countdown immediately dismisses overlay and starts work timer without waiting for countdown to complete.

**2025-01-20**: Added first-interaction gate to prevent infinite play timer hack via refresh. Timer state now persists on first button click.

### 35. docs/brain/timer-system.md (e8b4630a80a6b748beb9f24a91d99b483a671997f18b6fa863773ada69c26a7d)
- bm25: -38.0007 | relevance: 1.0000

**2025-12-18**: Restore no longer forces `playExpiredCountdownCompleted` to true. The countdown flag is restored from snapshot state and only set during restore when an expired play timer is detected. Live sessions resumed after a restore can still show the 30-second countdown on the next play timeout.

### 36. sidekick_pack.md (cd4283a0780ae6c647045069035f85710f44adc6566d88722dcaad02081e01d0)
- bm25: -37.4797 | relevance: 1.0000

### 40. docs/brain/timer-system.md (db14fa9e319bed0b6ca69f83c9f47c71c1ce32cffdf83994904af06f42b372c5)
- bm25: -21.4668 | relevance: 1.0000

**2025-12-03**: Fixed bug where 30-second countdown overlay persisted through lesson restart. Added `setShowPlayTimeExpired(false)` and `setPlayExpiredPhase(null)` to `handleRestartClick` in useResumeRestart.js so overlay is properly dismissed when user restarts the lesson.

**2025-12-03**: [REVERTED - see 2025-12-05] Fixed bug where play buttons (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games, Go) remained visible after play timer expired and 30-second countdown completed. Added `setShowOpeningActions(false)` to `handlePlayExpiredComplete` so buttons are hidden before auto-starting work phase. This ensures timer expiry bypasses Go button requirement as designed.

**2025-11-24**: Added Go button override - clicking Go during countdown immediately dismisses overlay and starts work timer without waiting for countdown to complete.

**2025-01-20**: Added first-interaction gate to prevent infinite play timer hack via refresh. Timer state now persists on first button click.

### 37. docs/brain/timer-system.md (f0d739f4de2823c82ffcac0ab265588ace3248c8ad13eae9a05c51d8d7ee13a7)
- bm25: -36.7223 | relevance: 1.0000

**Implementation (V2):**
- SessionPageV2 maintains `timerPaused` state (boolean)
- When toggled, calls `timerService.pause()` or `timerService.resume()`
- TimerService tracks pause state and paused elapsed times:
  - `isPaused`: Boolean flag indicating if timers are currently paused
  - `pausedPlayElapsed`: Stored play timer elapsed seconds when paused
  - `pausedWorkElapsed`: Stored work timer elapsed seconds when paused

### 38. sidekick_pack.md (963c56585d3c9b5453c11bdf320ad52749ec36187c4c259d06414a407c65927d)
- bm25: -36.6186 | relevance: 1.0000

## How It Works

### Play vs Work Timers

**V1**: Each phase (discussion, comprehension, exercise, worksheet, test) has two timer modes.

**V2**: Discussion has **no play timer**. Phases 2-5 (Comprehension, Exercise, Worksheet, Test) use play → work mode. A **discussion work timer** still exists and spans discussion + teaching.

**Rationale**: Removing play timer from discussion phase eliminates infinite play timer exploit (learner could refresh during discussion to reset play timer indefinitely without starting teaching).

**Discussion work timer startup**: The work timer for discussion is started when the greeting begins playing (greetingPlaying event). This is an exception - all other work timers start when the awaiting-go gate appears.

**Timeline jump timer startup**: When facilitator uses timeline to jump to a phase, the appropriate timer starts immediately:
- Discussion: Work timer starts immediately (exception to normal greetingPlaying rule)
- Other phases: Play timer starts immediately (not when Begin clicked)

Timeline jumps explicitly stop any existing timers for the target phase before starting new ones, ensuring a clean reset.

**Timer restart prevention**: Removed in favor of explicit stop/start pattern on timeline jumps. Timers can now be legitimately restarted when needed.

### 7. docs/brain/timer-system.md (1b526c919780716e4b7fea7e45b580988afdd9dd9b8794ec5da9b3185775f50f)
- bm25: -31.0158 | relevance: 1.0000

### 39. src/app/session/v2/TimerService.jsx (2138714f2799a4ec7f9a38d215801a4d155f4495dd79411cb99a813197b9d07d)
- bm25: -36.2965 | relevance: 1.0000

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

### 40. src/app/session/v2/TimerService.jsx (99e4956be1412065a8a0ad88b662ddcbb1fcfd25f4ad5660be28a29c525d30e5)
- bm25: -36.0156 | relevance: 1.0000

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
