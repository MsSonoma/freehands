# Timer System Architecture

**Last updated**: 2025-12-19T04:20:00Z  
**Status**: Canonical

## How It Works

### Play vs Work Timers

Each phase (discussion, comprehension, exercise, worksheet, test) has two timer modes:

1. **Play Timer** (green) - Expected to use full time; learner can interact with Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games
2. **Work Timer** (amber/red) - Learner should complete phase; input focused on lesson questions

Timer mode is tracked per-phase in `currentTimerMode` state object:
```javascript
{
  discussion: 'play' | 'work',
  comprehension: 'play' | 'work',
  exercise: 'play' | 'work',
  worksheet: 'play' | 'work',
  test: 'play' | 'work'
}
```

### Timer State Persistence

Timer state persists to sessionStorage to prevent refresh exploits:
- Key pattern: `session_timer_state:{lessonKey}:{phase}:{mode}`
- Cleared when transitioning from play to work mode
- First interaction gate saves snapshot to lock timer state

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
   - Automatically calls phase-specific start handler:
     - `handleStartLesson` for discussion/teaching
     - `handleGoComprehension` for comprehension
     - `handleGoExercise` for exercise
     - `handleGoWorksheet` for worksheet
     - `handleGoTest` for test
   - Each phase handler hides play buttons as part of its normal flow
   - Clears `playExpiredPhase`

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

### Timer Defaults

Defined in `src/app/session/utils/phaseTimerDefaults.js`:
- Discussion: 8 min play, 12 min work
- Comprehension: 8 min play, 12 min work
- Exercise: 8 min play, 12 min work
- Worksheet: 8 min play, 12 min work
- Test: 8 min play, 12 min work
- Golden key bonus: +5 min to all play timers

## What NOT To Do

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
- **src/app/session/components/PlayTimeExpiredOverlay.jsx**:
  - 30-second countdown overlay
  - Auto-fires `onComplete` callback when countdown finishes

### Timer Defaults
- **src/app/session/utils/phaseTimerDefaults.js**:
  - Default minutes per phase per mode
  - Golden key bonus time constant

### Phase Handlers
## Recent Changes

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
