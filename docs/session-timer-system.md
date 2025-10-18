# Session Timer System

## Overview
The session timer system allows facilitators to set time limits (1-5 hours) for learners to complete lessons. Learners who complete lessons within the time limit earn a **Golden Key** that unlocks the Poem and Story features in their next lesson.

## Features

### 1. Timer Configuration (Facilitator)
- **Location**: `/facilitator/learners` page
- **Control**: Dial component showing 1h, 2h, 3h, 4h, 5h options
- **Storage**: Saved per-learner in Supabase `learners.session_timer_minutes` field
- **Default**: 60 minutes (1 hour)

### 2. Session Timer Display
- **Location**: Session page, above the timeline
- **Format**: `H:MM:SS` (hours:minutes:seconds)
- **Visibility**: Hidden during initial "Begin" screen, appears once lesson starts
- **Persistence**: Timer state saved in `sessionStorage` to survive page refreshes
- **Duration Loading**: 
  - Loads from learner's `session_timer_minutes` setting on page load
  - Reloads when "Begin" button clicked to get latest setting
  - Listens for storage changes to pick up updates from facilitator page
  - Component remounts when duration changes (via key prop)
- **Reset Behavior**: Timer automatically resets when:
  - "Begin" button is clicked to start a lesson
  - "Restart" button is clicked to restart from beginning
  - Lesson is completed (timer state cleared)

### 3. Color-Coded Progress Indicator
The timer changes color based on lesson progress vs time elapsed:

| Color | Meaning | Formula |
|-------|---------|---------|
| 🟢 Green | On pace or ahead | Progress ≥ Time elapsed (within 5% tolerance) |
| 🟡 Yellow | Falling behind | Progress 5-15% behind time |
| 🔴 Red | Significantly behind | Progress >15% behind time |

### 4. Pause/Resume Controls
- **Button**: Pause ⏸️ / Resume ▶️ icon button next to timer
- **Protection**: **Always** requires facilitator PIN validation (every time)
- **PIN Type**: Uses `ensurePinAllowed('timer')` gate
- **PIN Preference**: Controlled by `timer` preference in facilitator PIN settings (defaults to `true`)
- **Session Unlock Bypass**: Timer actions do **not** use session unlock - PIN is required every time
- **State**: Paused time excluded from total elapsed time

### 5. Golden Key Reward System
- **Award Condition**: Lesson completed with time remaining on timer
- **Storage**: `localStorage` key: `golden_keys_{learnerId}`
- **Format**: Array of completed lesson IDs
- **Notification**: Alert message when key is earned
- **Persistence**: Persists across sessions

### 6. Poem/Story Unlock Mechanism
- **Check**: Both Poem and Story buttons check for golden keys before activating
- **Message**: "You need a golden key to unlock the [poem/story]. Complete a lesson within the time limit to earn one!"
- **Location**: `src/app/session/hooks/useDiscussionHandlers.js`
- **Keys Consumed**: Keys persist (not consumed), allowing unlimited access once earned

## Technical Architecture

### Files Modified

#### Database Schema
- **File**: `docs/learners-schema.sql`
- **Change**: Added `session_timer_minutes INT` column

#### Learner Management
- **File**: `src/app/facilitator/learners/clientApi.js`
- **Changes**:
  - `normalizeRow()`: Added `session_timer_minutes` field
  - `createLearner()`: Accepts `session_timer_minutes` in payload
  - `updateLearner()`: Updates `session_timer_minutes` field

- **File**: `src/app/facilitator/learners/page.js`
- **Changes**:
  - Added `TimerDial` component
  - Added timer state to `LearnerRow`
  - Saves timer setting in learner update

#### Session Timer Component
- **File**: `src/app/session/components/SessionTimer.jsx`
- **Exports**: `SessionTimer` component
- **Props**:
  - `totalMinutes`: Total allocated time (60-300)
  - `lessonProgress`: Current lesson completion percentage (0-100)
  - `isPaused`: Timer paused state
  - `onTimeUp`: Callback when timer expires
  - `onPauseToggle`: Callback for pause/resume button

#### Session Page Integration
- **File**: `src/app/session/page.js`
- **State Added**:
  - `timerPaused`: Boolean for pause state
  - `sessionTimerMinutes`: Duration loaded from learner settings
  - `goldenKeyEarned`: Boolean for current session
- **Functions Added**:
  - `calculateLessonProgress()`: Maps phase/progress to percentage
  - `handleTimerPauseToggle()`: PIN-protected pause/resume (requires 'timer' permission)
  - `handleTimeUp()`: Alert when time expires
- **Modified**:
  - `beginSession()`: Reloads timer duration, clears timer state on lesson start
  - `onCompleteLesson()`: Checks timer state, awards golden key, clears timer
- **Loading Logic**:
  - Initial load: `useEffect` loads timer setting on mount
  - Storage listener: `useEffect` watches for facilitator_learners/learner_id changes
  - Begin refresh: `beginSession()` reloads setting before starting
  - Component key: Timer remounts when duration changes via `key={timer-${sessionTimerMinutes}}`

#### Resume/Restart Integration
- **File**: `src/app/session/hooks/useResumeRestart.js`
- **Modified**:
  - `handleRestartClick()`: Clears timer state and resets pause state
  - Accepts `setTimerPaused` as parameter to reset pause state

#### Discussion Handlers
- **File**: `src/app/session/hooks/useDiscussionHandlers.js`
- **Modified Functions**:
  - `handlePoemStart()`: Checks for golden key before activating
  - `handleStoryStart()`: Checks for golden key before activating

#### PIN Gate
- **File**: `src/app/lib/pinGate.js`
- **Added**:
  - `timer` preference in `DEFAULT_PREFS` (defaults to `true`)
  - `'timer'` case in `mapActionToPrefKey()` function
  - Special handling in `ensurePinAllowed()` to always require fresh PIN for timer actions
- **Behavior**: 
  - When a facilitator PIN is set and the `timer` preference is enabled, pause/resume requires PIN entry
  - Timer actions **always** prompt for PIN (never use session unlock bypass)
  - This prevents learners from pausing/resuming once they've seen the facilitator enter the PIN for other actions

## Progress Calculation Algorithm

```javascript
const phaseWeights = {
  'discussion': 10,    // 10% complete
  'teaching': 30,      // 30% complete
  'comprehension': 50, // 50% complete
  'exercise': 70,      // 70% complete
  'worksheet': 85,     // 85% complete
  'test': 95           // 95% complete
};

// Within each phase, interpolate based on items completed
if (phase === 'comprehension') {
  progress = 30 + (currentCompIndex / COMPREHENSION_TARGET) * 20;
}
// Similar for exercise, worksheet, test phases
```

## Storage Keys

### sessionStorage
- `session_timer_state`: Timer state object
  ```json
  {
    "elapsedSeconds": 450,
    "startTime": 1697558400000,
    "pausedAt": null
  }
  ```

### localStorage
- `golden_keys_{learnerId}`: Array of lesson IDs
  ```json
  ["4th_math_multiplying_with_zeros", "5th_language_arts_advanced_grammar"]
  ```

## Testing Checklist

- [ ] Timer counts down correctly
- [ ] Colors change: green → yellow → red as learner falls behind
- [ ] Facilitator PIN required to pause/resume
- [ ] Paused time not counted toward elapsed
- [ ] Timer survives page refresh (sessionStorage)
- [ ] **Timer resets when Begin button clicked**
- [ ] **Timer resets when Restart button clicked**
- [ ] **Timer paused state resets on restart**
- [ ] Golden key awarded when completed on time
- [ ] Alert shows when golden key earned
- [ ] Poem button checks for golden key
- [ ] Story button checks for golden key
- [ ] Friendly message shown if no key available
- [ ] Multiple learners have independent timer settings
- [ ] Timer hidden during initial "Begin" screen
- [ ] Timer appears correctly above timeline

## Future Enhancements

1. **Database Migration**: Add Supabase migration for `session_timer_minutes` column
2. **Analytics**: Track completion rates and time-to-completion metrics
3. **Leaderboard**: Show fastest completion times per lesson
4. **Key Collection UI**: Display earned golden keys visually
5. **Timer Presets**: Quick-select common durations (30min, 1h, 2h)
6. **Sound Alert**: Optional audio notification when time expires
7. **Configurable Thresholds**: Allow customization of color change percentages
