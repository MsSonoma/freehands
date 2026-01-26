# Timer System Architecture

**Last updated**: 2026-01-23T01:13:24Z  
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

**Work timer startup for phases 2-5**: Work timers start immediately when the awaiting-go gate appears, whether in play mode or work mode:
- **Play mode flow**: Play timer starts when awaiting-go appears → user clicks Go → play timer transitions to work timer (already running)
- **Work mode flow (skipPlayPortion)**: Work timer starts when awaiting-go appears → user clicks Go → questions begin (timer already running)

This ensures timers tick down from the moment the Go button is visible, not when it's clicked.

**Work timer spans discussion + teaching**: The discussion work timer starts when the discussion phase begins and runs through the entire teaching phase. It is completed when teaching finishes, so the countdown must **not** be stopped at `discussionComplete`. Completing it early will freeze the visible timer as soon as the teaching controls appear.

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

**Play Timer Events:**
- `playTimerStart`: { phase, timestamp, timeLimit, formattedLimit }
- `playTimerTick`: { phase, elapsed, remaining, formatted, remainingFormatted }
- `playTimerExpired`: { phase, timestamp }

**PlayTimeExpiredOverlay:**
- Displays when `playTimerExpired` event fires
- 30-second countdown (green → amber at 5 seconds)
- "Time to Get Back to Work!" message
- "Go Now" button to skip countdown
- Plays `public/sfx/Alarm.mp3` once when the overlay opens (respects mute)
- Auto-advances to work mode when countdown reaches 0
- In V2, the parent handler first updates UI timer mode (play -> work) and then calls the phase controller `go()`, which performs the authoritative `timerService.transitionToWork(phase)` internally.

**V1 Implementation (page.js):**
- Parent-controlled via `showPlayTimeExpired` and `playExpiredPhase` state
- Rendered outside main container (position: fixed, inset: 0, zIndex: 10005)
- Props: `isOpen`, `phase`, `onComplete`, `onStartNow`
- Full-screen backdrop blur overlay
- Alarm SFX: overlay plays `/sfx/Alarm.mp3` once on open

**V2 Implementation (SessionPageV2.jsx):**
- Parent-controlled via `showPlayTimeExpired` and `playExpiredPhase` state
- Event listener for `playTimerExpired` in TimerService useEffect
- Rendered outside main container at end of component (position: fixed, inset: 0, zIndex: 10005)
- Props: `isOpen`, `phase`, `onComplete` (handlePlayExpiredComplete), `onStartNow` (handlePlayExpiredStartNow)
- Full-screen backdrop blur overlay matching V1 styling exactly
- Alarm SFX: overlay plays `/sfx/Alarm.mp3` once on open

**V2 Key Files:**
- `src/app/session/v2/PlayTimeExpiredOverlay.jsx` - Overlay component (V1 parity)
- `src/app/session/v2/SessionPageV2.jsx` - State, event listeners, handlers, render
- `src/app/session/utils/sfx.js` - Client-safe SFX playback (Howler wrapper)

**Persistence:**
- `serialize()` includes playTimers state (phase, elapsed, timeLimit, expired)
- `restore()` resumes play timers from snapshot (recalculates startTime from elapsed)
- `#saveToSessionStorage()` saves currentPlayPhase, playTimerElapsed, playTimerExpired
- `#loadFromSessionStorage()` restores play timer and resumes tick interval if not expired

### Timer State Persistence

**Authoritative source (V2):** `TimerService` state is the source of truth and is persisted/restored via SnapshotService (`snapshot.timerState`).

**Timer state must be saved continuously (V2):**
- Relying only on "one-off" snapshot saves (e.g., on Go, or on overlay actions) causes timers to reset to the full limit on refresh.
- Session V2 must persist `timerState` on a cadence while timers are running so refresh resumes from near-current elapsed time.
- Implementation: SessionPageV2 subscribes to TimerService events and snapshot-saves `timerState`:
  - On `playTimerStart`, `workPhaseTimerStart`, and `playTimerExpired` (immediate)
  - On `playTimerTick` and `workPhaseTimerTick` (throttled; currently ~10s)
  - On `visibilitychange` when the tab is hidden, and on `beforeunload`

**SessionStorage is a mirror (not authoritative):**
- Key pattern: `session_timer_state:{lessonKey}:{phase}:{mode}`
- Keys are written on each tick by TimerService.
- Keys must be cleared for the whole lesson on reset/start-over to avoid stale timers (especially discussion work timers) reappearing after restart.

**Authoritative edits (facilitator overlay):**
- TimerControlOverlay must not mutate `session_timer_state:*` directly because TimerService overwrites these keys every second.
- Authoritative add/subtract time must go through TimerService so phase transitions and the UI stay in sync.

**Authoritative API (V2):**
- `TimerService.setPhaseElapsedSeconds(phase, mode, elapsedSeconds)` updates the live engine timer (play or work), mirrors to sessionStorage, and emits a tick event immediately.
- SessionPageV2 is responsible for calling this when facilitator adjusts time via TimerControlOverlay.

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

The Games overlay displays the play timer badge, and it must show the same time as the in-session timer.

**Rule:** Only one `SessionTimer` instance should be mounted at a time for a given `{lessonKey, phase, mode}`.
- Mounting two `SessionTimer` components simultaneously can show brief 1-second drift because each instance runs its own `setInterval` tick.
- In Session V2, when the Games overlay is open, the on-video timer is not rendered; the Games overlay renders the timer instead.

### Overlay Stacking (V2)

Games and Visual Aids overlays must render above the timeline and timer overlays.
- Timeline must not use an extremely high `zIndex`.
- Full-screen overlays should use a higher `zIndex` than the on-video timer.

**PlayTimeExpiredOverlay must be above GamesOverlay:**
- `PlayTimeExpiredOverlay` is a full-screen, blocking overlay. It must have a higher `zIndex` than `GamesOverlay` so the 30-second countdown cannot appear behind a running game.

### PIN Gating (V2)

Timer controls that can change session pacing are PIN-gated:
- Opening the TimerControlOverlay is gated by `ensurePinAllowed('timer')`.
- Pause/resume toggles are gated by `ensurePinAllowed('timer')`.

Timeline jumps are also PIN-gated (see pin-protection.md action `timeline`).

### Play Time Expiration Flow

When play timer reaches 00:00:

1. **handlePlayTimeUp** fires:
   - Sets `showPlayTimeExpired = true`
   - Sets `playExpiredPhase` to current phase name
   - Closes games overlay if open (`setShowGames(false)`)
   - **Clears all opening action sequences** to prevent hangover at work transition:
     - Hides opening action buttons (`setShowOpeningActions(false)`)
     - Resets Ask state to 'inactive' (`setAskState('inactive')`)
     - Resets Riddle state to 'inactive' (`setRiddleState('inactive')`)
     - Resets Poem state to 'inactive' (`setPoemState('inactive')`)
     - Resets Story state to 'inactive' (`setStoryState('inactive')`)
     - Resets Fill-in-Fun state to 'inactive' (`setFillInFunState('inactive')`)
     - Clears story transcript and setup data
     - Clears fill-in-fun template and collected words

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

When the work timer expires or the phase is completed (including when Test hands off to facilitator review):
- `markWorkPhaseComplete` stamps the phase in `workPhaseCompletions` and clears that phase's timer entry in `currentTimerMode`
- Completing 3 on-time work phases earns a golden key (play timers ignored)
- Golden key adds bonus time to all future play timers
- `workTimeRemaining` records minutes left on each work timer when the phase ends (0 on timeout) and is surfaced in facilitator review for transparency; entering Test review now captures and freezes the remaining test work time so review/grading cannot keep an active timer running
- Golden key detection uses the live `workPhaseCompletionsRef` so a just-marked phase (e.g., Test on review entry) counts immediately without waiting for React state flush

### Golden Keys Enabled Flag (Per Learner)

Golden Key behavior is gated by a per-learner Supabase-backed flag:

- Column: `public.learners.golden_keys_enabled` (boolean, default true)

When `golden_keys_enabled` is `false`, Golden Keys are treated as fully disabled for that learner:

- No Golden Key bonus time is applied to play timers.
- Golden Key eligibility is not tracked and is not emitted.
- Golden Key awarding/persistence is skipped.
- Golden Key UI is hidden (Learn/Lessons counter/selector and the TimerControlOverlay Golden Key section).
- Facilitator Test review keeps showing the work timer remaining grid, but Golden Key-specific messaging is hidden.

### Golden Key Application (Per Lesson)

Golden Key usage is **per-lesson**, stored on the learner record:
- Field: `learners.active_golden_keys` (JSON map `{ [lessonKey]: true }`)
- When a facilitator applies a Golden Key for the current lesson, Session V2 must persist:
  - Set `active_golden_keys[lessonKey] = true`
  - Decrement `learners.golden_keys` inventory by 1

Once applied:
- The Golden Key bonus minutes are added to **all play timers** (phases 2-5) for that session.
- Suspending the Golden Key sets the play bonus to 0 (bonus is removed immediately from running timers).

**Immediate updates (no local fallback):**
- Pages subscribe to the Learner Settings Bus so facilitator-side toggles react immediately in already-open sessions/tabs.
- If `golden_keys_enabled` is missing (not a boolean), session code fails loudly so migrations/schema drift are caught early.

### Play Portion Enabled Flags (Per Learner)

Phases 2-5 (Comprehension, Exercise, Worksheet, Test) each have a per-learner flag that can disable the "play portion" of that phase.

Columns (boolean, default true):
- `public.learners.play_comprehension_enabled`
- `public.learners.play_exercise_enabled`
- `public.learners.play_worksheet_enabled`
- `public.learners.play_test_enabled`

Definition:
- "Play portion" means the intro + opening-actions gate + play timer.
- When a play portion flag is `false`, the phase should begin directly in work mode.

V2 behavior (implemented):
- When play portion is disabled for a phase, "Begin" behaves like "Go": it skips intro/opening actions, skips starting the play timer, and starts the work timer immediately.
- The session fails loudly if any `play_*_enabled` field is missing (not a boolean).
- Live updates use the Learner Settings Bus; if a flag is turned off while sitting at the Go gate (`awaiting-go`), the session transitions to work immediately.

V1 behavior:
- V1 is not updated by this feature unless explicitly requested.

### Timer Defaults

Defined in `src/app/session/utils/phaseTimerDefaults.js`:
- Discussion: 8 min play, 12 min work
- Comprehension: 8 min play, 12 min work
- Exercise: 8 min play, 12 min work
- Worksheet: 8 min play, 12 min work
- Test: 8 min play, 12 min work
- Golden key bonus: +5 min to all play timers

## What NOT To Do

❌ **Never describe Golden Keys as unlocking Poem/Story**
- A Golden Key adds bonus minutes to play timers (extra play time)
- Do not label it as unlocking specific activities (Poem/Story)

❌ **Never use local persistence fallback for `golden_keys_enabled`**
- Do not store a per-learner Golden Key enabled/disabled flag in localStorage.
- The source of truth is Supabase; the Learner Settings Bus is for immediate UI reaction only.

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

- **[snapshot-persistence.md](snapshot-persistence.md)** - Timer state saved in snapshots (sessionStorage + database)
- **[session-takeover.md](session-takeover.md)** - Timer state preserved across device takeover

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

**Implementation (V2):**
- SessionPageV2 maintains `timerPaused` state (boolean)
- When toggled, calls `timerService.pause()` or `timerService.resume()`
- TimerService tracks pause state and paused elapsed times:
  - `isPaused`: Boolean flag indicating if timers are currently paused
  - `pausedPlayElapsed`: Stored play timer elapsed seconds when paused
  - `pausedWorkElapsed`: Stored work timer elapsed seconds when paused

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

**2026-01-14**: Fixed timer phase transitions and countdown sharing: `playTimerExpired` now calls `handlePhaseTimerTimeUp` to trigger state changes (phases weren't advancing on expiry). Split timer display state into separate play/work variables (`playTimerDisplay*` vs `workTimerDisplay*`) to prevent countdowns from overwriting each other when both timers active.

**2026-01-14**: MAJOR refactor - SessionTimer now pure display component in V2. Receives elapsed/remaining from TimerService events via SessionPageV2 subscriptions. No internal timing logic. Single source of truth architecture eliminates duplicate timer tracking and pause race conditions.

**2026-01-14**: Fixed timer pause issue (second pass): Prevented TimerService from writing to sessionStorage when paused, and prevented SessionTimer from triggering onTimeUp when paused or when resuming from a paused state past expiration time.

**2026-01-14**: Fixed timer pause issue where pausing stopped cosmetic timer display but authoritative timer kept running and could trigger playTimerExpired/stage transitions. Added pause()/resume() methods to TimerService that stop/restart intervals and adjust startTime to preserve elapsed time. Tick methods now guard against running when paused.

**2025-12-28**: Entering Test review now calls `markWorkPhaseComplete('test')`, clears the test timer, and records remaining work time immediately. Grading/review can no longer show an active or timed-out test after all questions are answered.

**2025-12-28**: Golden key detection now reads `workPhaseCompletionsRef` to include phases marked complete in the same tick (no stale state), ensuring earned keys are awarded when the third on-time work phase finishes.

**2025-12-19**: Golden key eligibility now requires three on-time work timers. Facilitator test review shows remaining work time per phase based on work timers only; play timers are ignored.

**2025-12-18**: Restore no longer forces `playExpiredCountdownCompleted` to true. The countdown flag is restored from snapshot state and only set during restore when an expired play timer is detected. Live sessions resumed after a restore can still show the 30-second countdown on the next play timeout.

**2025-12-09**: FIX - Clear opening action sequences when play timer expires to prevent hangover at work transition. When play timer reaches 00:00 and countdown starts, any active opening action (ask, joke, riddle, poem, story, fill-in-fun, games) must be cleared immediately. Without this, if an opening action is running when the countdown starts, it can interfere with the automatic transition to work subphase (teaching or Q&A) after the 30-second countdown completes. Added comprehensive state clearing to `handlePlayTimeUp`: all opening action states reset to 'inactive', story and fill-in-fun data cleared, games overlay closed. This ensures a clean slate before work phase begins.

**2025-12-05**: CRITICAL FIX - Removed `setShowOpeningActions(false)` from `handlePlayExpiredComplete`. This was breaking all phase transitions because phase handlers already hide buttons as part of their normal flow. The premature state change created race conditions preventing Go button from working and timer from advancing phases. Each phase handler (handleGoComprehension, handleGoExercise, etc.) manages its own button visibility - timer handler should not interfere.

### Timer Persistence
- **src/app/session/hooks/useSnapshot.js**:
  - Timer state saved to sessionStorage
  - Restored on page load/refresh

## Recent Changes

**2025-12-28**: Entering Test review now calls `markWorkPhaseComplete('test')`, clears the test timer, and records remaining work time immediately. Grading/review can no longer show an active or timed-out test after all questions are answered.

**2025-12-05**: CRITICAL FIX - Removed `setShowOpeningActions(false)` from `handlePlayExpiredComplete`. This was breaking all phase transitions because phase handlers already hide buttons as part of their normal flow. The premature state change created race conditions preventing Go button from working and timer from advancing phases. Each phase handler (handleGoComprehension, handleGoExercise, etc.) manages its own button visibility - timer handler should not interfere.

**2025-12-03**: Fixed bug where 30-second countdown overlay persisted through lesson restart. Added `setShowPlayTimeExpired(false)` and `setPlayExpiredPhase(null)` to `handleRestartClick` in useResumeRestart.js so overlay is properly dismissed when user restarts the lesson.

**2025-12-03**: [REVERTED - see 2025-12-05] Fixed bug where play buttons (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games, Go) remained visible after play timer expired and 30-second countdown completed. Added `setShowOpeningActions(false)` to `handlePlayExpiredComplete` so buttons are hidden before auto-starting work phase. This ensures timer expiry bypasses Go button requirement as designed.

**2025-11-24**: Added Go button override - clicking Go during countdown immediately dismisses overlay and starts work timer without waiting for countdown to complete.

**2025-01-20**: Added first-interaction gate to prevent infinite play timer hack via refresh. Timer state now persists on first button click.
