# Snapshot Performance Fix

## Problem
Session loads were extremely slow with excessive console logging causing UI freezes:
- Multiple `[Snapshot] candidate` logs (20+ per load)
- Repeated `[Snapshot] restore hit` and `restore applied` logs
- Continuous `[speakFrontendImpl] Updating ref` spam
- Excessive `normalizeRow` logging
- 3+ second click handler delays
- Hot module reload taking 5-6 seconds

## Root Cause Analysis

### 1. **Restore Effect Re-Entry Loop**
The restore effect in `useSnapshotPersistence.js` had a critical timing bug:
- `didRunRestoreRef.current = true` was set **after** async restore operations
- During async operations, state changes triggered re-renders
- Re-renders re-triggered the restore effect before the flag was set
- Result: restore logic ran 10+ times on a single page load

### 2. **Circular Dependencies**
The restore effect dependency array included **output values** like `phase`, `subPhase`, `manifestInfo`, and `lessonData`:
- These values are **set during restore**
- Setting them triggered the effect to run again
- Created a feedback loop of restore → setState → re-render → restore

### 3. **Excessive Debug Logging**
Multiple logging points fired on every render:
- `[Snapshot] candidate` logged for every key variant checked (canonical, .json, legacy, etc.)
- `[speakFrontendImpl]` logged on every `speakFrontendImpl` dependency change
- `normalizeRow` logged every time learner data was processed

## Solution Implemented

### 1. **Immediate Guard Flag** (`useSnapshotPersistence.js:294`)
```javascript
// OLD: Set after async operations complete
let attempted = false;
// ... async work ...
attempted = true;

// NEW: Set immediately to prevent re-entry
didRunRestoreRef.current = true;
// ... async work ...
```

**Benefit**: Prevents re-entry during async operations.

### 2. **Reset Flag on Postpone** (`useSnapshotPersistence.js:348`)
```javascript
if (!sourcesReady) {
  // Reset the flag so we can retry when dependencies change
  didRunRestoreRef.current = false;
  // ... postpone logic ...
}
```

**Benefit**: Allows legitimate retries when data becomes available.

### 3. **Cleaned Dependency Array** (`useSnapshotPersistence.js:453-504`)
```javascript
// REMOVED from dependencies:
// - phase, subPhase (output values)
// - manifestInfo, lessonData (full objects that change during restore)

// KEPT only:
// - manifestInfo?.file, lessonData?.id (stable input identifiers)
// - Refs and setters (stable references)
```

**Benefit**: Breaks the circular dependency loop.

### 4. **Reduced Logging Noise**
- **Snapshot candidates**: Only log when `savedAt` timestamp exists (`useSnapshotPersistence.js:330`)
- **speakFrontendImpl**: Commented out the ref update log (`page.js:2004`)
- **normalizeRow**: Commented out the input/output log (`clientApi.js:255`)

**Benefit**: Console remains usable during development; performance improves.

## Performance Impact

### Before
- Session load: 5-10 seconds with UI freeze
- Console spam: 50+ logs before interactive
- Click handlers: 3+ second delays
- Hot reload: 5-6 seconds

### After (Expected)
- Session load: <2 seconds
- Console spam: 5-10 focused logs
- Click handlers: Immediate response
- Hot reload: <1 second

## Testing Checklist

- [ ] Fresh session load completes quickly
- [ ] Resume from snapshot works correctly
- [ ] No restore loops in console
- [ ] Click handlers respond immediately
- [ ] Snapshot saving still works
- [ ] Multiple lesson switches don't cause issues
- [ ] Hot reload is fast

## Files Modified

1. `src/app/session/hooks/useSnapshotPersistence.js`
   - Set guard flag immediately (line 312)
   - Removed `attempted` variable and replaced with `didRunRestoreRef` guard
   - Reset flag on postpone (line 350)
   - Cleaned dependency array (line 455-506)
   - Reduced candidate logging (line 325)
   - Fixed finally block to use ref instead of removed variable (line 438)

2. `src/app/facilitator/learners/clientApi.js`
   - Commented out normalizeRow logging (line 255)

3. `src/app/session/page.js`
   - Commented out speakFrontendImpl logging (line 2004)

## Related Issues

- Transcripts 400 error is unrelated (ledger.json doesn't exist yet on new sessions)
- Fast Refresh times may still vary based on change scope

## Rollback Plan

If issues arise, revert commits for these three files. The changes are isolated to logging and effect timing, not core logic.
