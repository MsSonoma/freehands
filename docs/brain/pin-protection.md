# PIN Protection System

## Overview

PIN protection gates access to facilitator features and controls session exits. The system prevents learners from accessing facilitator tools, downloads, or modifying session state without adult supervision.

## How It Works

### Core Components

**pinGate.js** (`src/app/lib/pinGate.js`)
- Central PIN validation utility
- Manages facilitator section tracking
- Provides `ensurePinAllowed(action)` function for gating actions
- Stores PIN preferences in localStorage and server

**FacilitatorSectionTracker.jsx** (`src/components/FacilitatorSectionTracker.jsx`)
- Tracks when user enters/leaves facilitator section
- Clears facilitator section flag when navigating away from `/facilitator/*`
- Mounted in root layout to track all navigation

**HeaderBar.js** (`src/app/HeaderBar.js`)
- Implements navigation PIN checks
- Sets facilitator section flag when navigating from session to facilitator
- Prevents double PIN prompts

### PIN Actions

Each action type maps to a preference key that controls whether PIN is required:

| Action | Preference Key | When Triggered | Sets Facilitator Flag? |
|--------|---------------|----------------|----------------------|
| `facilitator-page` | `facilitatorPage` | Entering any `/facilitator/*` page | YES |
| `session-exit` | `activeSession` | Leaving active lesson session | NO (but sets flag if destination is facilitator) |
| `download` | `downloads` | Worksheet/test downloads | NO |
| `facilitator-key` | `facilitatorKey` | Combined answer key | NO |
| `skip` / `timeline` | `skipTimeline` | Timeline jumps, skip buttons | NO |
| `change-learner` | `changeLearner` | Switching learners | NO |
| `refresh` | `refresh` | Re-generate worksheet/test | NO |
| `timer` | `timer` | Pause/resume timer | NO |

### Session Integrations

Session surfaces that mutate session state should gate with `ensurePinAllowed(action)` before performing the action.

**Session V2 (timeline + timer controls):**
- Timeline jumps call `ensurePinAllowed('timeline')` before switching phases.
- Timer controls call `ensurePinAllowed('timer')` before opening the timer control overlay and before pause/resume toggles.

### Facilitator Section Flag

**Purpose**: Prevent double PIN prompts when navigating between facilitator pages

**How it works**:
1. Flag is stored in `sessionStorage` (cleared when browser tab closes)
2. When `ensurePinAllowed('facilitator-page')` succeeds, it sets the flag
3. Subsequent `facilitator-page` checks skip PIN if flag is already set
4. Flag is cleared when user navigates away from `/facilitator/*` routes

### Navigation Flow (Session → Facilitator)

**Before Fix (Double PIN Prompt)**:
1. User clicks Facilitator link from session page
2. HeaderBar calls `ensurePinAllowed('session-exit')` → prompts for PIN
3. Navigation to `/facilitator` happens
4. Facilitator page calls `ensurePinAllowed('facilitator-page')` → prompts for PIN AGAIN (flag not set)

**After Fix (Single PIN Prompt)**:
1. User clicks Facilitator link from session page
2. HeaderBar calls `ensurePinAllowed('session-exit')` → prompts for PIN
3. HeaderBar detects destination is facilitator route → calls `setInFacilitatorSection(true)`
4. Navigation to `/facilitator` happens
5. Facilitator page calls `ensurePinAllowed('facilitator-page')` → SKIPS PIN (flag already set)

### Server Verification

PIN verification is server-only (no localStorage fallback):
- Server validates PIN against hashed value in `profiles.facilitator_pin_hash`
- Uses bcrypt for secure comparison
- API endpoint: `POST /api/facilitator/pin/verify`

### Preferences

PIN preferences are stored in:
- Server: `profiles.pin_prefs` (JSON column)
- Client: `localStorage.facilitator_pin_prefs` (cached copy)

Default preferences (when PIN exists but prefs not set):
```javascript
{
  downloads: true,
  facilitatorKey: true,
  skipTimeline: true,
  changeLearner: true,
  refresh: true,
  timer: true,
  facilitatorPage: true,
  activeSession: true
}
```

## What NOT To Do

**❌ DON'T** set facilitator section flag for non-facilitator actions
- Only `facilitator-page` action and session-exit-to-facilitator navigation should set the flag
- Setting it for other actions would allow bypassing PIN on facilitator pages

**❌ DON'T** store PIN in localStorage
- PIN verification is server-only for security
- Never cache PIN validation results beyond sessionStorage flag

**❌ DON'T** create multiple PIN prompts simultaneously
- `ensurePinAllowed` uses global lock (`activePinPrompt`) to prevent concurrent prompts
- If another prompt is active, wait for its result

**❌ DON'T** forget to clear facilitator section flag when leaving facilitator routes
- FacilitatorSectionTracker handles this automatically
- Manual flag clearing should match its logic

**❌ DON'T** use `ensurePinAllowed` for non-gated features
- Only call it when you genuinely need to gate an action
- Unnecessary calls degrade user experience

## Key Files

**Core Logic**:
- `src/app/lib/pinGate.js` - PIN validation, section tracking, preferences
- `src/app/api/facilitator/pin/route.js` - Get PIN state, preferences
- `src/app/api/facilitator/pin/verify/route.js` - Server PIN verification

**Navigation Integration**:
- `src/app/HeaderBar.js` - Navigation PIN checks, facilitator flag setting
- `src/components/FacilitatorSectionTracker.jsx` - Section flag lifecycle

**Facilitator Pages** (all check PIN on mount):
- `src/app/facilitator/page.js` - Main facilitator hub
- `src/app/facilitator/learners/page.js` - Learner management
- `src/app/facilitator/lessons/page.js` - Lesson management
- `src/app/facilitator/generator/*/page.js` - Content generators
- `src/app/facilitator/account/*/page.js` - Account pages

## Recent Changes

**2025-12-03**: Fixed double PIN prompt when exiting session to facilitator pages
- Modified `HeaderBar.goWithPin` to set facilitator section flag after successful session-exit PIN when destination is facilitator route
- Prevents facilitator page from prompting again since flag is already set
- Files: `src/app/HeaderBar.js` (imported setInFacilitatorSection, added flag set logic in goWithPin)

## Design Decisions

**Why sessionStorage for flag instead of localStorage?**
- Flag should expire when browser tab closes (session-based)
- Prevents stale "logged in" state across browser restarts
- User must re-validate PIN in new browser sessions

**Why global lock for PIN prompts?**
- Prevents race conditions when multiple components check PIN simultaneously
- Ensures single PIN prompt even if multiple checks triggered during navigation

**Why server-only verification?**
- Security: can't bypass by tampulating localStorage
- Centralized: PIN hash stored only in database
- Audit trail: all PIN verifications logged server-side

**Why separate flag for facilitator section vs individual actions?**
- Facilitator pages form a logical "section" where re-prompting is annoying
- Other actions (downloads, timeline) are one-off and don't imply continued access
- Section flag balances security (prompt when entering) with UX (don't re-prompt)
