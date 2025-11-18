# Timer System Documentation

## Overview
The session timer system underwent a major transition from a single-timer zombie system to a proper phase-based timer system. This document serves as a reference for future developers to prevent accidentally reverting to the old system.

## New Timer System (CORRECT - Use This)

### Format
```
session_timer_state:${lessonKey}:${phase}:${timerType}
```

**Example:** `session_timer_state:lesson123:comprehension:work`

### Components
- **lessonKey**: Unique lesson identifier
- **phase**: One of `discussion`, `comprehension`, `exercise`, `worksheet`, `test`
- **timerType**: Either `play` or `work`

### Implementation
- **Component**: `SessionTimer.jsx` - Handles all phase-based timer logic
- **State**: `currentTimerMode` - Maps phases to current timer type (play/work)
- **State**: `workPhaseCompletions` - Tracks which work phases completed without timing out

### Golden Key Logic (CORRECT)
Golden key is earned when **4 out of 5 work phases are completed before their work timers expire**.

- Tracked in `workPhaseCompletions` state
- Checked via `checkGoldenKeyEarn()` function
- Completion marked via `markWorkPhaseComplete(phaseName)` calls

## Old Timer System (ZOMBIE - Do Not Use)

### Format (OBSOLETE)
```
session_timer_state:${lessonKey}
```

This single-timer format was the zombie system causing persistence conflicts.

### Why It Was Wrong
1. **No Phase Granularity**: Could not track individual phase completion
2. **Golden Key Bug**: Tried to use total session time instead of 4/5 work phase completion
3. **Persistence Conflicts**: New system couldn't restore state properly with old format interfering

## Fixes Applied

### 1. Duplicate Greeting TTS ✅
- **Issue**: Recovery timeouts caused duplicate audio playback
- **Fix**: Removed 1200ms recovery setTimeout calls in startDiscussionStep()
- **Location**: `src/app/session/page.js` lines ~2970 and ~3015

### 2. Video Timing Issue ✅  
- **Issue**: Video started playing during loading screen instead of with TTS
- **Fix**: Changed video unlock to seek to frame 0 or brief play+pause, not full playback
- **Location**: `src/app/session/page.js` CRITICAL Chrome video unlock section

### 3. Timer Control Zombie ✅
- **Issue**: Timer controls read/wrote old timer format
- **Fix**: Updated `handleUpdateTime` and `TimerControlOverlay` to use new phase-based format
- **Location**: `src/app/session/page.js` handleUpdateTime function and overlay

### 4. Golden Key Zombie ✅
- **Issue**: Golden key logic used old session timer instead of 4/5 work phase completion
- **Fix**: Replaced old timer logic with `checkGoldenKeyEarn()` call in `onCompleteLesson`
- **Location**: `src/app/session/page.js` lesson completion logic

### 5. Discussion Completion Tracking ✅
- **Issue**: Discussion work phase never marked complete when transitioning to comprehension
- **Fix**: Added `markWorkPhaseComplete('discussion')` calls in phase transition logic
- **Location**: `src/app/session/page.js` skip logic and useEffect

### 6. Cleanup Functions ✅
- **Issue**: Old cleanup functions only cleared old timer format
- **Fix**: Updated to clear both old (transitional) and new timer formats
- **Location**: Begin screen cleanup, lesson completion cleanup

## Work Phase Completion Tracking

### Current Implementation
Each phase should call `markWorkPhaseComplete(phaseName)` when work is completed:

- **Discussion**: ✅ Called during phase transition to comprehension
- **Comprehension**: ✅ Called in comprehension completion logic  
- **Exercise**: ✅ Called in exercise completion logic
- **Worksheet**: ✅ Called in worksheet completion logic
- **Test**: ✅ Called in test completion logic

### Golden Key Calculation
```javascript
const checkGoldenKeyEarn = useCallback(() => {
  const completedCount = Object.values(workPhaseCompletions).filter(Boolean).length;
  if (completedCount >= 4 && !goldenKeyEarned) {
    setGoldenKeyEarned(true);
    return true;
  }
  return false;
}, [workPhaseCompletions, goldenKeyEarned]);
```

## Safe Transition Code

The following old format references are SAFE and should be kept during transition:

```javascript
// Clean up old timer format (transitional)
const storageKey = lessonKey ? `session_timer_state:${lessonKey}` : 'session_timer_state';
sessionStorage.removeItem(storageKey);

// Clean up new phase-based timer states  
const phases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
const timerTypes = ['play', 'work'];
phases.forEach(phase => {
  timerTypes.forEach(timerType => {
    const newStorageKey = `session_timer_state:${lessonKey}:${phase}:${timerType}`;
    sessionStorage.removeItem(newStorageKey);
  });
});
```

## Snapshot Persistence Status ✅

The snapshot persistence system (`useSnapshotPersistence.js`) is clean and correctly uses:
- `currentTimerMode` - New phase-based timer modes
- `workPhaseCompletions` - New work phase completion tracking

No old timer system references found in snapshot code.

## For Future AI Assistants

**🚨 CRITICAL WARNINGS:**

1. **Never use `session_timer_state:${lessonKey}` format** - This is the zombie system
2. **Always use `session_timer_state:${lessonKey}:${phase}:${timerType}` format** - This is correct
3. **Golden key is 4/5 work phases, NOT total time** - Use `checkGoldenKeyEarn()`, not session time
4. **Don't break SessionTimer component** - It handles the new system correctly
5. **Don't remove transitional cleanup code** - It safely cleans both old and new formats

## Testing the Fixes

To verify the timer system is working:

1. **Discussion Phase**: Complete discussion, verify `workPhaseCompletions.discussion = true`
2. **Phase Transitions**: Check that timer state persists across phase changes
3. **Golden Key**: Complete 4 work phases, verify golden key is earned  
4. **Resume/Restart**: Verify timer state is properly restored from snapshots
5. **No Duplicates**: Verify greeting plays only once, video starts with TTS

## Code Locations Reference

- **Main Timer Logic**: `src/app/session/components/SessionTimer.jsx`
- **Timer State Management**: `src/app/session/page.js` (currentTimerMode, workPhaseCompletions)
- **Golden Key Logic**: `src/app/session/page.js` (checkGoldenKeyEarn function)
- **Phase Transitions**: `src/app/session/page.js` (markWorkPhaseComplete calls)
- **Snapshot Persistence**: `src/app/session/hooks/useSnapshotPersistence.js`

---

**Status**: All major timer zombies eliminated ✅  
**Date**: November 18, 2025  
**Commit History**: 
- `eb46f67` - Golden Key zombie kill
- `be35a97` - Discussion completion tracking fix
- `c17270f` - Timer control and cleanup zombie fixes