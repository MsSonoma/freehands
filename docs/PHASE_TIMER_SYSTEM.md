# Phase Timer System - Implementation Documentation

**Status**: ✅ Complete - Ready for Testing  
**Date**: 2025-11-15  
**Version**: 1.0.0

## Overview

The Phase Timer System replaces the single session timer with **11 independent timers** across 5 lesson phases, enabling precise time management for both exploratory play and focused work.

### Key Features

- **Dual-mode timers per phase**: Play time (Begin → Go) and Work time (Go → next Begin)
- **11 configurable timers**: 5 phases × 2 modes + golden key bonus
- **Color-coded feedback**: Play always green 🎉, Work uses green/yellow/red ✏️ based on progress
- **Game repeatability**: Joke, Riddle, Poem, Story, Fill-in-Fun unlimited during play time
- **Golden key bonus**: Earned by completing 4/5 work phases without timeout, adds bonus play minutes
- **Facilitator control**: Configure all timer values via ⏱️ Setup button on learner profiles
- **Persistence**: Phase-specific sessionStorage with configuration validation

---

## Architecture

### Data Model

**Database Schema** (PostgreSQL/Supabase):
```sql
-- learners table (11 new columns)
discussion_play_min   INTEGER CHECK (discussion_play_min BETWEEN 1 AND 60) DEFAULT 5
discussion_work_min   INTEGER CHECK (discussion_work_min BETWEEN 1 AND 60) DEFAULT 15
comprehension_play_min INTEGER CHECK (comprehension_play_min BETWEEN 1 AND 60) DEFAULT 3
comprehension_work_min INTEGER CHECK (comprehension_work_min BETWEEN 1 AND 60) DEFAULT 10
exercise_play_min     INTEGER CHECK (exercise_play_min BETWEEN 1 AND 60) DEFAULT 3
exercise_work_min     INTEGER CHECK (exercise_work_min BETWEEN 1 AND 60) DEFAULT 10
worksheet_play_min    INTEGER CHECK (worksheet_play_min BETWEEN 1 AND 60) DEFAULT 3
worksheet_work_min    INTEGER CHECK (worksheet_work_min BETWEEN 1 AND 60) DEFAULT 10
test_play_min         INTEGER CHECK (test_play_min BETWEEN 1 AND 60) DEFAULT 3
test_work_min         INTEGER CHECK (test_work_min BETWEEN 1 AND 60) DEFAULT 10
golden_key_bonus_min  INTEGER CHECK (golden_key_bonus_min BETWEEN 1 AND 60) DEFAULT 5
```

**Data Structure** (`phaseTimerDefaults.js`):
```javascript
{
  discussion_play_min: 5,
  discussion_work_min: 15,
  comprehension_play_min: 3,
  comprehension_work_min: 10,
  exercise_play_min: 3,
  exercise_work_min: 10,
  worksheet_play_min: 3,
  worksheet_work_min: 10,
  test_play_min: 3,
  test_work_min: 10,
  golden_key_bonus_min: 5
}
```

### Component Architecture

```
PhaseTimersOverlay.jsx          // Facilitator configuration UI (11 dials)
  └─ 11 × NumberDial            // Individual timer controls (1-60 min)

SessionTimer.jsx                 // Phase-aware countdown timer
  ├─ Play mode (always green)
  └─ Work mode (green/yellow/red)

PlayTimeExpiredOverlay.jsx       // 30-second auto-advance warning

session/page.js                  // Main integration point
  ├─ State: phaseTimers, currentTimerMode, workPhaseCompletions
  ├─ Helpers: startPhasePlayTimer(), transitionToWorkTimer(), etc.
  └─ Rendering: Conditional timer display per phase
```

---

## State Management

### Primary State Variables

**In `session/page.js`**:
```javascript
const [phaseTimers, setPhaseTimers] = useState(null);
// Flat object: { discussion_play_min: 5, discussion_work_min: 15, ... }

const [currentTimerMode, setCurrentTimerMode] = useState({});
// Tracks mode per phase: { discussion: 'play', comprehension: 'work', ... }

const [workPhaseCompletions, setWorkPhaseCompletions] = useState({
  discussion: false,
  comprehension: false,
  exercise: false,
  worksheet: false,
  test: false
});
// Tracks successful phase completions for golden key earning

const [goldenKeyEarned, setGoldenKeyEarned] = useState(false);
const [goldenKeyBonus, setGoldenKeyBonus] = useState(0);
// Golden key state and bonus minutes
```

### SessionStorage Keys

**Format**: `session_timer_state:{lessonKey}:{phase}:{timerType}`

**Examples**:
- `session_timer_state:4th-multiplying-with-zeros:discussion:play`
- `session_timer_state:4th-multiplying-with-zeros:discussion:work`
- `session_timer_state:4th-multiplying-with-zeros:comprehension:play`

**Stored Data**:
```javascript
{
  elapsedSeconds: 120,
  startTime: 1700000000000,
  pausedAt: null,
  totalMinutes: 5  // For configuration validation
}
```

---

## Timer Flow

### Phase Lifecycle

```
BEGIN (Discussion) 
  │
  ↓ Click "Begin Discussion"
PLAY MODE (discussion_play_min)
  │ • Green timer 🎉
  │ • Games available: Joke, Riddle, Poem, Story, Fill-in-Fun
  │ • Unlimited repeats during play time
  │
  ↓ Click "Go" OR play time expires
WORK MODE (discussion_work_min)
  │ • Green/yellow/red timer ✏️ (based on lesson progress)
  │ • Actual lesson content delivery
  │ • Games disabled
  │
  ↓ Complete work OR work time expires
NEXT PHASE (Comprehension)
  │
  └─ Repeat for Comprehension, Exercise, Worksheet, Test
```

### Timer Mode Transitions

**Play → Work**:
```javascript
// Triggered by "Go" button or play timer expiration
const transitionToWorkTimer = useCallback((phase) => {
  setCurrentTimerMode(prev => ({ ...prev, [phase]: 'work' }));
  // Clear play timer storage
  sessionStorage.removeItem(`session_timer_state:${lessonKey}:${phase}:play`);
}, [lessonKey]);
```

**Phase Advance**:
```javascript
// Mark work completion when advancing successfully
const markWorkPhaseComplete = useCallback((phase, completed) => {
  setWorkPhaseCompletions(prev => ({ ...prev, [phase]: completed }));
}, []);

// Called at 6 transition points:
// - comprehension → exercise (2 paths)
// - exercise → worksheet
// - worksheet → test
// - test → congrats
// - discussion → comprehension
```

### Work Timeout Handling

```javascript
// When work timer expires
const handleWorkTimeUp = useCallback((phase) => {
  markWorkPhaseComplete(phase, false);  // Mark as incomplete
  // Timer displays 00:00 in red
  // Phase NOT advanced automatically
}, [markWorkPhaseComplete]);
```

---

## Golden Key System

### Earning Logic

**Criteria**: Complete **4 out of 5** work phases without timeout

**Implementation** (`finalizeReview` in session/page.js):
```javascript
const checkGoldenKeyEarn = () => {
  const completedCount = Object.values(workPhaseCompletions)
    .filter(Boolean).length;
  
  if (completedCount >= 4 && !goldenKeyEarned) {
    setGoldenKeyEarned(true);
    // Award golden key (saved to database)
  }
};
```

### Bonus Application

**Loading** (`loadPhaseTimersForLearner`):
```javascript
// Bonus loads from learner profile
const bonus = learner.golden_key_bonus_min || 5;
setGoldenKeyBonus(bonus);
```

**Usage** (SessionTimer):
```javascript
// Added to play timers only
const effectiveTotalMinutes = timerType === 'play' 
  ? totalMinutes + (goldenKeyBonus || 0)
  : totalMinutes;
```

**Display** (SessionTimer):
```javascript
{timerType === 'play' && goldenKeyBonus > 0 && (
  <div className="text-xs text-yellow-400 mt-1">
    ⚡ +{goldenKeyBonus} min bonus
  </div>
)}
```

---

## Facilitator Interface

### Configuration UI

**Location**: `src/app/facilitator/learners/page.js`

**Access**: Click ⏱️ **Setup** button on learner profile

**Features**:
- 11 NumberDial controls (1-60 min range)
- Save persists all values to database
- Values load on mount from learner profile
- Inline validation (1-60 range enforced)

**Code**:
```javascript
<button
  onClick={() => {
    setEditingTimers(learner);
    setShowPhaseTimersOverlay(true);
  }}
  className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg hover:opacity-80"
  title="Setup Phase Timers"
>
  ⏱️ Setup
</button>
```

---

## Integration Points

### Session Page Integration

**Timer Rendering** (session/page.js:7504):
```javascript
{phaseTimers && !showBegin && getCurrentPhaseName() && currentTimerMode[getCurrentPhaseName()] && (
  <SessionTimer
    key={`phase-timer-${getCurrentPhaseName()}-${currentTimerMode[getCurrentPhaseName()]}`}
    totalMinutes={getCurrentPhaseTimerDuration()}
    lessonProgress={calculateOverallProgress()}
    isPaused={isPaused}
    onTimeUp={handlePhaseTimerTimeUp}
    onPauseToggle={togglePause}
    lessonKey={lessonKey}
    phase={getCurrentPhaseName()}
    timerType={currentTimerMode[getCurrentPhaseName()]}
    goldenKeyBonus={goldenKeyBonus}
    onTimerClick={handleTimerClick}
    className="ml-4"
  />
)}
```

**Begin Button Wiring** (all 5 phases):
```javascript
// Discussion Begin
const handleBeginDiscussion = () => {
  startPhasePlayTimer('discussion');
  setShowBegin(false);
  // ... phase setup
};

// Similar for Comprehension, Exercise, Worksheet, Test
```

**Go Button Wiring** (all 5 phases):
```javascript
// Discussion Go
const handleGoDiscussion = () => {
  transitionToWorkTimer('discussion');
  // ... advance to next phase
};

// Similar for Comprehension, Exercise, Worksheet, Test
```

### Game Repeatability Changes

**Removed State Variables**:
- `jokeUsedThisGate` ❌
- `riddleUsedThisGate` ❌
- `poemUsedThisGate` ❌
- `storyUsedThisGate` ❌
- `fillInFunUsedThisGate` ❌

**Impact**: Games now freely repeatable during play time (timer-limited instead of gate-limited)

---

## Validation & Error Handling

### Configuration Validation

**On Timer Load** (SessionTimer.jsx):
```javascript
// Validate stored data matches current configuration
if (state.totalMinutes === effectiveTotalMinutes) {
  // Restore state
} else {
  // Configuration changed - reset timer
  setElapsedSeconds(0);
  setStartTime(Date.now());
  setPausedAt(null);
}
```

### Cleanup on Session Start

**Storage Cleanup** (`beginSession` in session/page.js):
```javascript
// Clear all 10 phase-specific timer keys
['discussion', 'comprehension', 'exercise', 'worksheet', 'test'].forEach(phase => {
  sessionStorage.removeItem(`session_timer_state:${lessonKey}:${phase}:play`);
  sessionStorage.removeItem(`session_timer_state:${lessonKey}:${phase}:work`);
});
```

---

## Testing Checklist

### ✅ Unit Tests

- [ ] **Play timer starts**: Click Begin Discussion → 5:00 green timer 🎉 displays
- [ ] **Work timer transitions**: Click Go → 15:00 green timer ✏️ displays
- [ ] **Timer persistence**: Refresh page → timer resumes from correct position
- [ ] **Configuration validation**: Change timer values → stored timer resets
- [ ] **Play timeout**: Wait for play timer → 30s countdown → auto-advance to work
- [ ] **Work timeout**: Wait for work timer → 00:00 red display → phase not marked complete
- [ ] **Golden key bonus**: Display ⚡ indicator when bonus > 0
- [ ] **Golden key earning**: Complete 4/5 work phases → key awarded

### ✅ Integration Tests

- [ ] **All 5 phases**: Begin→Play, Go→Work for Discussion, Comprehension, Exercise, Worksheet, Test
- [ ] **Game repeatability**: Click Joke/Riddle/Poem/Story multiple times during play time
- [ ] **Timer color progression**: Work timer changes from green → yellow → red as lesson progresses
- [ ] **Facilitator UI**: ⏱️ Setup button opens overlay, saves persist to database, values load on mount
- [ ] **Storage isolation**: Start different lessons → timers don't interfere
- [ ] **Mode transitions**: No flicker or disappearance during play→work transition

### ✅ Edge Cases

- [ ] **Rapid phase changes**: Advance quickly through phases → timers track correctly
- [ ] **Page refresh during countdown**: Timer resumes with accurate remaining time
- [ ] **Configuration mid-session**: Change timer values → active timer resets
- [ ] **Golden key edge case**: Earn key during session → bonus applies immediately
- [ ] **Work timeout recovery**: Timeout on one phase → can still complete next phases

---

## Files Modified

### New Components
- `src/app/session/components/PhaseTimersOverlay.jsx` (11-dial config UI)
- `src/app/session/components/PlayTimeExpiredOverlay.jsx` (30s countdown)

### Modified Components
- `src/app/session/components/SessionTimer.jsx` (phase-aware, play/work modes, validation)
- `src/app/session/page.js` (state management, timer integration, flow wiring)
- `src/app/facilitator/learners/page.js` (⏱️ Setup button, PhaseTimersOverlay)

### New Utilities
- `src/app/session/utils/phaseTimerDefaults.js` (data model, loader function)

### Database
- `docs/migrations/add-phase-timers-to-learners.sql` ✅ **EXECUTED**

### Hooks Modified
- `src/app/session/hooks/usePhaseHandlers.js` (Go button transitions)
- `src/app/session/hooks/useTeachingFlow.js` (work completion tracking)
- `src/app/session/hooks/useSnapshotPersistence.js` (removed game gate state)

---

## Breaking Changes

### Removed Features
1. **Single session timer**: Replaced with 11 phase-specific timers
2. **Game usage gates**: `jokeUsedThisGate`, `riddleUsedThisGate`, `poemUsedThisGate`, `storyUsedThisGate`, `fillInFunUsedThisGate` removed
3. **Old sessionStorage key**: `session_timer_state:{lessonKey}` → phase-specific keys

### Migration Notes
- **Existing sessions**: Old timer state will be ignored (harmless)
- **Learner profiles**: Default timer values applied if columns NULL
- **Facilitator UI**: Single "Timer" dial replaced with "⏱️ Setup" button

---

## Performance Considerations

### Optimizations
- **Lazy loading**: Timer values load only when needed (session start)
- **Memoized callbacks**: All timer helpers use `useCallback` to prevent re-renders
- **Component keys**: Timer remounts on mode change for clean state
- **Storage validation**: Prevents stale data from corrupted cache

### Resource Usage
- **SessionStorage**: 10 keys per lesson (5 phases × 2 modes)
- **Database**: 11 integer columns per learner
- **Re-renders**: Timer isolated to VideoPanel subtree

---

## Future Enhancements

### Potential Features
1. **Timer analytics**: Track average play/work time per phase
2. **Adaptive timers**: Auto-adjust based on learner performance
3. **Custom presets**: Save timer templates (e.g., "Fast Learner", "Detailed Explorer")
4. **Visual progress**: Circular progress bar instead of digital countdown
5. **Audio alerts**: Gentle chime at 1 min remaining
6. **Pause history**: Log all pause/resume events for facilitator review

### Architecture Extensions
- **Phase groups**: Link timers across related phases
- **Dynamic golden key**: Variable bonus based on completion speed
- **Timer inheritance**: Child learners inherit parent template

---

## Support & Troubleshooting

### Common Issues

**Timer shows 00:00 immediately**:
- **Cause**: Invalid stored state or configuration mismatch
- **Fix**: Timer auto-resets on validation failure; check console for errors

**Timer disappears during play→work transition**:
- **Cause**: Component remounting with null startTime (FIXED in v1.0.0)
- **Fix**: `startTime` now initializes to `Date.now()` immediately

**Golden key bonus not applying**:
- **Cause**: Property name mismatch or bonus not loaded
- **Fix**: Verify `golden_key_bonus_min` column exists, check SessionTimer props

**Facilitator UI doesn't save**:
- **Cause**: Database constraint violation (values outside 1-60 range)
- **Fix**: Validate all inputs before save, check network errors

### Debug Tools

**Check timer state**:
```javascript
// In browser console
JSON.parse(sessionStorage.getItem('session_timer_state:4th-multiplying-with-zeros:discussion:play'))
```

**Verify phase timers loaded**:
```javascript
// In session page (add temporary console.log)
console.log('Phase timers:', phaseTimers);
console.log('Current mode:', currentTimerMode);
```

---

## Changelog

### v1.0.0 (2025-11-15) - Initial Release
- ✅ 11 phase-specific timers implemented
- ✅ Play/work mode dual system
- ✅ Golden key bonus system
- ✅ Facilitator configuration UI
- ✅ Game repeatability (gates removed)
- ✅ Database migration executed
- ✅ SessionStorage persistence with validation
- ✅ Work completion tracking
- ✅ Timer initialization bug fix (startTime)
- ✅ Data structure alignment (flat keys)
- ✅ Zero compilation errors

---

## Credits

**Implementation**: GitHub Copilot (Brain-Builder mode)  
**Specification**: User requirements + iterative refinement  
**Testing**: Pending comprehensive end-to-end validation

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-11-15T20:32:58Z  
**Status**: Ready for Testing ✅
