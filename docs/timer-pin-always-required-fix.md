# Timer Pause PIN Always Required - Fix

## Issue
The timer pause/resume button was not requiring a PIN, even when a facilitator PIN was set. This created a security gap where learners could pause/resume the timer without permission.

## Root Causes

### 1. Missing Timer Action Registration
The 'timer' action wasn't registered in the PIN gate system:
- `DEFAULT_PREFS` didn't include a `timer` preference
- `mapActionToPrefKey()` didn't have a case for 'timer'
- Result: PIN gate couldn't determine whether to require PIN for timer actions

### 2. Session Unlock Bypass
Even after adding the timer action, the "session unlock" feature would allow subsequent actions to bypass PIN entry:
- Once a facilitator entered PIN for any action (e.g., download), the session was marked as "unlocked"
- All subsequent PIN-gated actions would bypass the prompt until the session ended
- This meant learners could pause/resume the timer after seeing the facilitator enter PIN once

## Solution Implemented

### Phase 1: Register Timer Action
Added timer as a recognized PIN-gated action:

**File**: `src/app/lib/pinGate.js`

```javascript
// Added to DEFAULT_PREFS
const DEFAULT_PREFS = {
	downloads: true,
	facilitatorKey: true,
	skipTimeline: true,
	changeLearner: true,
    refresh: true,
    timer: true,  // NEW
};

// Added to mapActionToPrefKey()
function mapActionToPrefKey(action) {
	switch (action) {
		case 'download': return 'downloads';
		case 'facilitator':
		case 'facilitator-key': return 'facilitatorKey';
		case 'skip':
		case 'timeline': return 'skipTimeline';
		case 'change-learner': return 'changeLearner';
        case 'refresh': return 'refresh';
        case 'timer': return 'timer';  // NEW
		default: return null;
	}
}
```

### Phase 2: Always Require Fresh PIN for Timer
Modified `ensurePinAllowed()` to bypass the session unlock check for timer actions:

```javascript
export async function ensurePinAllowed(action = 'action') {
	if (typeof window === 'undefined') return true;
	try {
		const { hasPin, prefs } = await fetchServerPrefsAndHasPin();
		const prefKey = mapActionToPrefKey(action);
		const shouldGate = Boolean(hasPin && (prefKey ? (prefs?.[prefKey] ?? DEFAULT_PREFS[prefKey]) : true));
		if (!shouldGate) return true;
		
		// Timer action always requires fresh PIN entry (no session unlock bypass)
		const requiresFreshPin = (action === 'timer');
		if (!requiresFreshPin && unlockedThisSession()) return true;  // MODIFIED

		const input = await promptForPinMasked({ title: 'Facilitator PIN', message: 'Enter PIN to continue' });
		if (input == null || input === '') return false;

		const serverOk = await verifyPinServer(input);
		let ok = (serverOk === true);
		if (serverOk === null) {
			try { ok = (localStorage.getItem(PIN_KEY) || '') === input; } catch { ok = true; }
		}
		if (!ok) {
			try { alert('Incorrect PIN.'); } catch {}
			return false;
		}
		
		// Timer actions don't unlock the session - they always require PIN
		if (!requiresFreshPin) {  // MODIFIED
			setUnlockedSession(true);
		}
		return true;
	} catch {
		return true;
	}
}
```

## Behavior After Fix

### Timer Pause/Resume
- **Always prompts for PIN** when pause/resume button is clicked
- Does **not** use the session unlock bypass
- Prevents learners from controlling timer after seeing facilitator enter PIN for other actions

### Other PIN-Gated Actions
- Continue to use session unlock as before
- Downloads, skips, etc. only require PIN once per session
- This is appropriate since these are facilitator-initiated actions

## Security Rationale

The timer is different from other PIN-gated actions:
1. **Always visible**: The pause button is always on screen during lessons
2. **Learner temptation**: Learners have strong incentive to pause when running low on time
3. **Golden key impact**: Pausing defeats the purpose of the time-based golden key reward system
4. **Repeated use**: Learner might try to pause multiple times if they remember the PIN

By requiring PIN **every time**, we ensure:
- Facilitators maintain full control over timer
- Learners can't exploit session unlock to pause without permission
- The golden key reward system maintains integrity

## Testing

- [x] Timer pause button prompts for PIN
- [x] Entering correct PIN allows pause/resume
- [x] Entering incorrect PIN shows error and denies action
- [x] Timer pause always requires PIN even after other actions unlock session
- [x] Other actions still use session unlock (downloads, skips, etc.)
- [x] PIN requirement can be disabled via facilitator preferences if desired

## Files Modified

1. **src/app/lib/pinGate.js**
   - Added `timer: true` to DEFAULT_PREFS
   - Added timer case to mapActionToPrefKey()
   - Added fresh PIN requirement for timer actions
   
2. **docs/session-timer-system.md**
   - Updated to document always-required PIN behavior
   - Explained session unlock bypass exception for timer
