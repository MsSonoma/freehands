# Phase-Based Timer System Implementation Plan

## Overview
Comprehensive timer system that replaces the single session timer with 11 phase-specific timers (5 phases × 2 timer types + golden key bonus). Each phase has separate timing for "play" (games/exploration) and "work" (actual lesson tasks).

## ✅ Completed Components

### 1. Data Model (`phaseTimerDefaults.js`)
- **Location:** `src/app/session/utils/phaseTimerDefaults.js`
- **Purpose:** Defines default timer durations and utility functions
- **Defaults:**
  - Discussion: Play 5min, Work 15min
  - Comprehension: Play 5min, Work 10min
  - Exercise: Play 5min, Work 15min
  - Worksheet: Play 5min, Work 20min
  - Test: Play 5min, Work 15min
  - Golden Key Bonus: 5min
- **Functions:**
  - `getDefaultPhaseTimers()` - Returns all 11 default values
  - `loadPhaseTimersForLearner(learner)` - Loads from learner profile with fallbacks
  - `getPhaseTimerDuration(phaseTimers, phase, timerType)` - Gets specific timer value

### 2. PhaseTimersOverlay Component
- **Location:** `src/app/session/components/PhaseTimersOverlay.jsx`
- **Purpose:** Facilitator UI for configuring all 11 timer durations
- **Features:**
  - Compact dropdown layout with 5 phase sections
  - Each phase shows Play🎉 and Work✏️ dials side-by-side
  - 1-minute increment spinners (1-60 min range)
  - Interactive tooltips (hover + click to persist)
  - Golden Key bonus timer at bottom
  - Info panel explaining play vs work concept
  - Save/Cancel buttons

### 3. PlayTimeExpiredOverlay Component
- **Location:** `src/app/session/components/PlayTimeExpiredOverlay.jsx`
- **Purpose:** 30-second countdown when play timer expires
- **Features:**
  - Full-screen overlay with timer icon
  - "Time to Get Back to Work!" message
  - Reassurance: "You'll be able to play again after the next phase"
  - Large countdown display (changes color at 5 seconds)
  - Auto-advances to work phase when countdown completes

### 4. SessionTimer Component (Refactored)
- **Location:** `src/app/session/components/SessionTimer.jsx`
- **Purpose:** Phase-aware countdown timer with play/work modes
- **New Props:**
  - `phase` - Current phase name
  - `timerType` - 'play' or 'work'
  - `goldenKeyBonus` - Extra minutes for play timers
- **Features:**
  - **Play Mode:** Always green (expected to use full time)
  - **Work Mode:** Color-coded based on pace
    - Green: On track or slightly behind (< 5%)
    - Yellow: Behind schedule (5-15%)
    - Red: Significantly behind (> 15%) or timed out (00:00)
  - Displays appropriate emoji (🎉 play, ✏️ work)
  - Shows golden key bonus indicator (⚡) on play timers
  - Phase-specific sessionStorage keys: `session_timer_state:{lessonKey}:{phase}:{timerType}`
  - No hours display (max 60 minutes per timer)

## 🚧 Remaining Implementation Tasks

### 5. Session Page Integration
- **File:** `src/app/session/page.js`
- **Changes Needed:**
  1. Add state for tracking current timer mode (play/work)
  2. Load phase timer settings from learner profile on mount
  3. Track "Begin [Phase]" → "Go" transitions
  4. Start play timer when "Begin" pressed
  5. Switch to work timer when "Go" pressed
  6. Show PlayTimeExpiredOverlay when play timer reaches 0
  7. Handle work timer timeout (just show 00:00 in red, no overlay)
  8. Track work timer completion status per phase

### 6. Golden Key Earn Logic
- **File:** `src/app/session/page.js`
- **Logic:**
  1. Track whether each work phase completed before timeout
  2. Array: `workPhaseCompletions` = [discussion, comprehension, exercise, worksheet, test]
  3. Mark phase complete when "Begin [Next Phase]" pressed with time remaining
  4. At lesson end: count completions
  5. If >= 4 phases completed: award golden key
  6. Apply golden key bonus to all remaining play timers in session

### 7. Remove Game Repeatability Limits
- **Files:** `src/app/session/page.js`
- **Changes:**
  - Remove `jokeUsedThisGate` state and checks
  - Remove `riddleUsedThisGate` state and checks
  - Remove `poemUsedThisGate` state and checks
  - Remove `storyUsedThisGate` state and checks
  - Remove Fill-in-Fun one-use restriction
  - Timer becomes the only limiting factor during play time

### 8. Learner Profile Schema Updates
- **Database:** Supabase `learners` table
- **New Columns:**
  ```sql
  -- Add 11 new columns for phase timer settings
  discussion_play_min INTEGER DEFAULT 5,
  discussion_work_min INTEGER DEFAULT 15,
  comprehension_play_min INTEGER DEFAULT 5,
  comprehension_work_min INTEGER DEFAULT 10,
  exercise_play_min INTEGER DEFAULT 5,
  exercise_work_min INTEGER DEFAULT 15,
  worksheet_play_min INTEGER DEFAULT 5,
  worksheet_work_min INTEGER DEFAULT 20,
  test_play_min INTEGER DEFAULT 5,
  test_work_min INTEGER DEFAULT 15,
  golden_key_bonus_min INTEGER DEFAULT 5
  ```

### 9. Facilitator UI Updates
- **File:** `src/app/facilitator/learners/page.js` (or equivalent)
- **Changes:**
  1. Replace single "Timer" dial with "Timers" button
  2. On click: open PhaseTimersOverlay component
  3. Pass current learner's timer values as initialTimers prop
  4. On save: update all 11 timer fields in learner profile
  5. Update learner API to handle new fields

### 10. TimerControlOverlay Updates (Optional)
- **File:** `src/app/session/components/TimerControlOverlay.jsx`
- **Possible Changes:**
  - Update to show current phase and timer type
  - Allow switching between phases for debugging
  - Show play/work status
  - (Or keep simplified for facilitator mid-session adjustments)

## Timer Flow Per Phase

### Phase Lifecycle
```
1. Learner clicks "Begin [Phase]"
   ↓
2. Play timer starts (5 min default + golden key bonus if active)
   - Games available: Joke, Riddle, Poem, Story, Fill-in-Fun
   - All repeatable during play time
   - Green timer display
   ↓
3a. Play timer expires
   → Show PlayTimeExpiredOverlay (30s countdown)
   → Auto-advance to work mode
   
3b. Learner clicks "Go"
   → Stop play timer
   → Start work timer
   ↓
4. Work timer starts (varies by phase: 10-20 min)
   - Phase content displayed
   - Color: green → yellow → red based on progress pace
   ↓
5a. Work timer expires (reaches 00:00)
   → Display "00:00" in red
   → Mark as timed out (NOT counted toward golden key)
   → Can still complete phase
   
5b. Phase completed before timeout
   → Mark as completed on time
   → Count toward golden key (need 4/5 for award)
   ↓
6. Next phase begins (back to step 1)
```

## Golden Key System

### Earning Criteria
- Complete **at least 4 out of 5 work phases** before their timers hit 00:00
- Phases that count: Discussion, Comprehension, Exercise, Worksheet, Test

### Bonus Effect
- Adds configured bonus minutes (default 5) to **all play timers** for remainder of session
- Applied retroactively to current phase if in play mode
- Displayed as ⚡ indicator on timer
- Visual feedback in UI when earned

### Alternative: Facilitator Application
- Facilitator can manually apply golden key via timer controls (PIN-protected)
- Same effect as earning it

## Testing Checklist

### Phase Timer Functionality
- [ ] Play timer starts when "Begin [Phase]" clicked
- [ ] Play timer is always green
- [ ] Play timer shows golden key bonus (⚡) when active
- [ ] PlayTimeExpiredOverlay appears when play timer hits 0
- [ ] 30-second countdown auto-advances to work mode
- [ ] Work timer starts when "Go" clicked
- [ ] Work timer shows correct colors (green/yellow/red)
- [ ] Work timer shows 00:00 in red when expired
- [ ] Timer state persists across page refreshes
- [ ] Phase-specific storage keys work correctly

### Game Repeatability
- [ ] Joke button works multiple times during play
- [ ] Riddle button works multiple times during play
- [ ] Poem button works multiple times during play
- [ ] Story button works multiple times during play
- [ ] Fill-in-Fun works multiple times during play
- [ ] Games disabled when play timer expires

### Golden Key
- [ ] Work phase completion tracked correctly
- [ ] Golden key awarded when 4/5 phases completed on time
- [ ] Bonus time added to play timers when key earned
- [ ] Bonus time displayed correctly in UI
- [ ] Facilitator can manually apply golden key
- [ ] Golden key persists across sessions for lesson

### Facilitator UI
- [ ] "Timers" button opens PhaseTimersOverlay
- [ ] All 11 timer values load correctly
- [ ] Tooltips show/hide on hover and click
- [ ] Timer values save to learner profile
- [ ] Timer changes reflect in active sessions
- [ ] Default values applied for new learners

### Edge Cases
- [ ] Timer doesn't break with invalid learner data
- [ ] Timer handles very short durations (1 min)
- [ ] Timer handles maximum durations (60 min)
- [ ] Pause/resume works correctly mid-phase
- [ ] Switching between lessons clears old timer state
- [ ] Multiple browser tabs don't interfere

## File Reference

### New Files
1. `src/app/session/utils/phaseTimerDefaults.js` - Data model and defaults
2. `src/app/session/components/PhaseTimersOverlay.jsx` - Facilitator config UI
3. `src/app/session/components/PlayTimeExpiredOverlay.jsx` - Play timeout screen

### Modified Files (Completed)
1. `src/app/session/components/SessionTimer.jsx` - Refactored for phase/type awareness

### Files Still Need Modification
1. `src/app/session/page.js` - Main session logic integration
2. `src/app/facilitator/learners/page.js` - Replace timer dial with timers button
3. `src/app/lib/learners/clientApi.js` - Update API for new fields
4. Database migration SQL - Add 11 timer columns to learners table

## Summary

**Status:** Foundation complete (4 of 14 tasks)
- ✅ Data model defined
- ✅ PhaseTimersOverlay built
- ✅ PlayTimeExpiredOverlay built
- ✅ SessionTimer refactored

**Next Steps:**
1. Add learner schema fields (database migration)
2. Integrate timer system into session page
3. Implement golden key earn logic
4. Remove game repeatability limits
5. Update facilitator learners UI
6. Test end-to-end
7. Final changelog update and commit

**Benefits:**
- More granular time management per learning phase
- Natural separation of play (exploration) and work (tasks)
- Encourages timely completion through golden key incentive
- Games become freely repeatable (timer-limited instead of count-limited)
- Better pacing feedback with phase-specific color coding
