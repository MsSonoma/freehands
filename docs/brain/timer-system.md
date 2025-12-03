# Timer System Architecture

**Last updated**: 2025-12-03T00:00:00Z  
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
   - Closes games overlay if open

2. **PlayTimeExpiredOverlay** displays:
   - Shows "Time to Get Back to Work!" message
   - 30-second countdown (green, turns amber at 5 seconds)
   - Displays phase name user will return to
   - Auto-advances when countdown reaches 0

3. **handlePlayExpiredComplete** fires when countdown completes:
   - Hides overlay (`showPlayTimeExpired = false`)
   - Transitions to work timer for expired phase
   - **CRITICAL**: Sets `showOpeningActions = false` to hide play buttons
   - Automatically calls phase-specific start handler:
     - `handleStartLesson` for discussion/teaching
     - `handleGoComprehension` for comprehension
     - `handleGoExercise` for exercise
     - `handleGoWorksheet` for worksheet
     - `handleGoTest` for test
   - Clears `playExpiredPhase`

### Go Button Override

If user clicks Go button during the 30-second countdown:
- Overlay is immediately dismissed
- Work timer starts without waiting for countdown
- All phase start handlers check and clear overlay state

### Work Time Completion Tracking

When work timer expires or user completes phase:
- `workPhaseCompletions` object tracks completion per phase (true/false)
- Completing 4 out of 5 work phases earns golden key
- Golden key adds bonus time to all future play timers

### Timer Defaults

Defined in `src/app/session/utils/phaseTimerDefaults.js`:
- Discussion: 8 min play, 12 min work
- Comprehension: 8 min play, 12 min work
- Exercise: 8 min play, 12 min work
- Worksheet: 8 min play, 12 min work
- Test: 8 min play, 12 min work
- Golden key bonus: +5 min to all play timers

## What NOT To Do

❌ **Never allow play buttons to remain visible after timer expiry**
- Must set `showOpeningActions = false` when transitioning from play to work after timer expiry
- User should not be able to access Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games after play time expires

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
- **src/app/session/hooks/usePhaseHandlers.js**:
  - All phase start handlers clear overlay state
  - Transition from play to work when Go is clicked

### Timer Persistence
- **src/app/session/hooks/useSnapshot.js**:
  - Timer state saved to sessionStorage
  - Restored on page load/refresh

## Recent Changes

**2025-12-03**: Fixed bug where 30-second countdown overlay persisted through lesson restart. Added `setShowPlayTimeExpired(false)` and `setPlayExpiredPhase(null)` to `handleRestartClick` in useResumeRestart.js so overlay is properly dismissed when user restarts the lesson.

**2025-12-03**: Fixed bug where play buttons (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games, Go) remained visible after play timer expired and 30-second countdown completed. Added `setShowOpeningActions(false)` to `handlePlayExpiredComplete` so buttons are hidden before auto-starting work phase. This ensures timer expiry bypasses Go button requirement as designed.

**2025-11-24**: Added Go button override - clicking Go during countdown immediately dismisses overlay and starts work timer without waiting for countdown to complete.

**2025-01-20**: Added first-interaction gate to prevent infinite play timer hack via refresh. Timer state now persists on first button click.
