# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Timers overlay PIN check pause redundant already authenticated
```

Filter terms used:
```text
PIN
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

PIN

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/pin-protection.md (3aa2a8e5f407ed24098e9d06429a29a96012af85911782bdf9d220a708346647)
- bm25: -6.1423 | entity_overlap_w: 14.30 | adjusted: -9.7173 | relevance: 1.0000

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

### 2. docs/brain/pin-protection.md (ebdd1e94caea25980934f22545b5a075ce528dea5b0b231341f83cf36273fe59)
- bm25: -5.8088 | entity_overlap_w: 10.40 | adjusted: -8.4088 | relevance: 1.0000

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

### 3. docs/brain/pin-protection.md (a572b2eaa4ac61bc5c6c926b97a5f45498691130f5af49873ea35f306e9ecc36)
- bm25: -5.7455 | entity_overlap_w: 10.40 | adjusted: -8.3455 | relevance: 1.0000

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

### 4. docs/brain/pin-protection.md (099075fb976b0dc884d23cec569d3b693ff409180962ef058793b7f53217859f)
- bm25: -5.6836 | entity_overlap_w: 10.40 | adjusted: -8.2836 | relevance: 1.0000

Session surfaces that mutate session state should gate with `ensurePinAllowed(action)` before performing the action.

**Session V2 (timeline + timer controls):**
- Timeline jumps call `ensurePinAllowed('timeline')` before switching phases.
- Timer controls call `ensurePinAllowed('timer')` before opening the timer control overlay and before pause/resume toggles.

**Games (example: Platform Jumper):**
- Facilitator-only game shortcuts (like skipping to a level) must call `ensurePinAllowed('skip')` before opening any level picker.

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

### 5. docs/brain/ingests/pack-mentor-intercepts.md (ede430caef237b7b0db5b0d3de9c65b88aa4cd3048b43318b8699396eb14daae)
- bm25: -5.7173 | entity_overlap_w: 9.10 | adjusted: -7.9923 | relevance: 1.0000

```
If user says during parameter collection:
- "stop"
- "no"
- "I don't want to generate"
- "give me advice instead"
- "I don't want you to generate the lesson"
Skip Confirmation When Intent Is Ambiguous
```
User: "I need a language arts lesson but I don't want one of the ones we have in 
       the library. It should have a Christmas theme, please make some recommendations."

WRONG: "Is this lesson for Emma's grade (4)?"
RIGHT: "Would you like me to generate a custom lesson?"
       (If they say no: "Let me search for Christmas-themed language arts lessons...")
```

### 33. docs/brain/pin-protection.md (3aa2a8e5f407ed24098e9d06429a29a96012af85911782bdf9d220a708346647)
- bm25: -12.0850 | relevance: 1.0000

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

### 6. src/app/facilitator/account/page.js (ba65d353ea7b5b7ee8155d70feecfcb97e64c738ede74d283ec9d72d92ded791)
- bm25: -5.4197 | entity_overlap_w: 6.50 | adjusted: -7.0447 | relevance: 1.0000

return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Facilitator PIN"
      maxWidth={550}
    >
      {loading ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={handleSave} style={{ display:'grid', gap: 16 }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Protect sensitive actions like skipping or downloading. This PIN is saved to your account.
          </p>
          
          {/* Hidden username for accessibility */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            defaultValue={email || ''}
            aria-hidden="true"
            tabIndex={-1}
            style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)', clipPath:'inset(50%)', whiteSpace:'nowrap', border:0, padding:0, margin:-1 }}
          />
          
          {hasPin && (
            <div>
              <label style={{ display:'block', marginBottom:8, fontWeight:600, color:'#374151' }}>Current PIN</label>
              <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password"
                value={currentPin} onChange={e=>setCurrentPin(e.target.value)}
                style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, width: '100%', fontSize: 14 }} />
            </div>
          )}
          
          <div>
            <label style={{ display:'block', marginBottom:8, fontWeight:600, color:'#374151' }}>{hasPin ? 'New PIN' : 'Set PIN'}</label>
            <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password"
              value={pin} onChange={e=>setPin(e.target.value)}
              placeholder="4–8 digits"
              style={{ padding:'8p

### 7. docs/brain/pin-protection.md (9d13ed0a83c6fafa15ecaac2fcd18ecc25090900b8af7f490f6909677b7b779f)
- bm25: -6.2279 | entity_overlap_w: 2.60 | adjusted: -6.8779 | relevance: 1.0000

PIN verification is server-only (no localStorage fallback):
- Server validates PIN against hashed value in `profiles.facilitator_pin_hash`
- Uses bcrypt for secure comparison
- API endpoint: `POST /api/facilitator/pin/verify`

### 8. docs/brain/ingests/pack-mentor-intercepts.md (356cf263e7cd125b6f2899eaf6780a3e6b0427dbef63b6e3757dc56b623a2733)
- bm25: -5.6907 | entity_overlap_w: 3.90 | adjusted: -6.6657 | relevance: 1.0000

**Already implemented** in `page.js` lines 286-314:
- Client calls `ensurePinAllowed(pinCode)` from `src/app/lib/pinAuth.js`
- Server validates PIN hash against learner's stored scrypt hash
- Only correct PIN allows session takeover
- Failed PIN shows error, user can retry

### 9. docs/brain/ingests/pack-mentor-intercepts.md (3e231008a05445b5759eef203b600a852bd9520ce71072cb95d474a484742b29)
- bm25: -5.1706 | entity_overlap_w: 5.20 | adjusted: -6.4706 | relevance: 1.0000

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

### 34. docs/brain/session-takeover.md (1f835d163bf68929a4e5f34cd5f4cffe3ef482a5e6b64ab8f8d4977332da7266)
- bm25: -12.0329 | relevance: 1.0000

**Result**: When play timer expires with page closed, restore automatically:
1. Sets countdown completed flag (blocks countdown)
2. Transitions timer to work mode
3. Triggers phase handler to start work phase
4. User lands directly in work phase entrance, can click Go to begin

**Key Files:**
- `src/app/session/page.js`: Flag setting in completion handlers, not in handlePlayTimeUp
- `src/app/session/hooks/useSnapshotPersistence.js`: Detect expired timer on restore, auto-transition
- `src/app/session/sessionSnapshotStore.js`: Persist flag in snapshot

### Database Schema

#### `lesson_sessions` Table Extensions

**New columns:**
```sql
ALTER TABLE lesson_sessions
  ADD COLUMN session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN device_name TEXT,
  ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX unique_active_lesson_session 
  ON lesson_sessions (learner_id, lesson_id) 
  WHERE ended_at IS NULL;
```

### 10. src/app/api/mentor-session/route.js (d7a1a870ca1f26628f085edc7e6fbc70a8b0a78548e2d9de8be14e9bf467a062)
- bm25: -4.9904 | entity_overlap_w: 5.20 | adjusted: -6.2904 | relevance: 1.0000

const targetId = targetSessionId || existingSession?.session_id
      if (!targetId) {
        return jsonWithDeviceCookie({ body: { error: 'No target session available to force end' }, status: 400, deviceCookieHeader })
      }

const { data: targetSessions, error: targetFetchError } = await supabase
        .from('mentor_sessions')
        .select('id, session_id')
        .eq('facilitator_id', user.id)
        .eq('session_id', targetId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

if (targetFetchError) {
        return jsonWithDeviceCookie({ body: { error: 'Database error' }, status: 500, deviceCookieHeader })
      }

const targetSession = targetSessions?.[0]
      if (!targetSession) {
        return jsonWithDeviceCookie({ body: { status: 'already_inactive' }, status: 200, deviceCookieHeader })
      }

const success = await deactivateSessionById(targetSession.id)
      if (!success) {
        return jsonWithDeviceCookie({ body: { error: 'Failed to end session' }, status: 500, deviceCookieHeader })
      }

return jsonWithDeviceCookie({
        body: { status: 'force_ended', clearedSessionId: targetSession.session_id },
        status: 200,
        deviceCookieHeader
      })
    }

// If taking over from another device, verify PIN
    // If device_id is missing (legacy rows), we conservatively require PIN for takeover.
    if (existingSession && existingSession.device_id !== deviceId && action === 'takeover') {
      // Verify PIN code
      if (!pinCode) {
        return jsonWithDeviceCookie({
          body: { error: 'PIN required to take over session', requiresPin: true },
          status: 403,
          deviceCookieHeader
        })
      }

### 11. src/app/api/mentor-session/route.js (dd18893516fb24aa77fa662c5e7be065e7de2c6f0f7e4e27bdfa5686a51df6e3)
- bm25: -5.8735 | entity_overlap_w: 1.30 | adjusted: -6.1985 | relevance: 1.0000

return true
}

function scryptHash(pin, salt) {
  return `s1$${salt}$${scryptSync(pin, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`
}

function verifyPinHash(pin, stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 's1') return false
  const [, salt] = parts
  const recomputed = scryptHash(pin, salt)
  try {
    return timingSafeEqual(Buffer.from(recomputed), Buffer.from(stored))
  } catch {
    return false
  }
}

async function requireMrMentorAccess(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, plan_tier')
    .eq('id', userId)
    .maybeSingle()

const effectiveTier = resolveEffectiveTier(profile?.subscription_tier, profile?.plan_tier)
  const ent = featuresForTier(effectiveTier)
  const allowed = ent?.mentorSessions === Infinity || (Number.isFinite(ent?.mentorSessions) && ent.mentorSessions > 0)
  return { allowed, tier: effectiveTier }
}

async function verifyPin(userId, pinCode) {
  // Try to get facilitator_pin_hash first (modern schema)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('facilitator_pin_hash')
    .eq('id', userId)
    .maybeSingle()

if (error) {
    throw error
  }

if (!profile) {
    return false
  }

if (profile.facilitator_pin_hash) {
    return verifyPinHash(pinCode, profile.facilitator_pin_hash)
  }

// No PIN set
  return false
}

export const maxDuration = 60

### 12. src/app/facilitator/account/page.js (9cd81d85e5c8612947bee6f1a9c67102b35c19f5d76832b04d9026dc2470405e)
- bm25: -5.8625 | entity_overlap_w: 1.30 | adjusted: -6.1875 | relevance: 1.0000

const pinChange = (pin && pin.length) || (pin2 && pin2.length)
      if (pinChange) {
        if (!/^\d{4,8}$/.test(pin)) throw new Error('Use a 4–8 digit PIN')
        if (pin !== pin2) throw new Error('PINs do not match')
        const res = await fetch('/api/facilitator/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pin, currentPin: hasPin ? currentPin : null, prefs })
        })
        const js = await res.json().catch(()=>({}))
        if (!res.ok || !js?.ok) {
          const errorMsg = js?.error || `Failed to save (${res.status})`
          throw new Error(errorMsg)
        }
        setHasPin(true)
        setPin(''); setPin2(''); setCurrentPin('')
        setPinPrefsLocal(prefs)
        setMsg('Saved')
      } else {
        try {
          const res = await fetch('/api/facilitator/pin', { method:'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ prefs }) })
          if (!res.ok) { const js = await res.json().catch(()=>({})); throw new Error(js?.error || 'Failed to save') }
        } catch (e2) {}
        setPinPrefsLocal(prefs)
        setMsg('Saved')
      }
    } catch (e3) {
      setMsg(e3?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

### 13. docs/brain/session-takeover.md (67d6f1cc34af6fd217783490d4f011c8cef30e9a03ac7f4e9f0c5692245348e3)
- bm25: -4.8801 | entity_overlap_w: 5.20 | adjusted: -6.1801 | relevance: 1.0000

## Timer Continuity Details

**Timer state components:**
- `currentTimerMode`: 'play' (Begin to Go) or 'work' (Go to next phase)
- `workPhaseCompletions`: object tracking which phases completed work timer
- `elapsedSeconds`: current countdown value
- `targetSeconds`: phase-specific target (from runtime config)
- `capturedAt`: ISO timestamp when snapshot saved

**Snapshot capture (every gate):**
```javascript
timerSnapshot: {
  phase: phase,
  mode: currentTimerModeRef.current || currentTimerMode,
  capturedAt: new Date().toISOString(),
  elapsedSeconds: getElapsedFromSessionStorage(phase, currentTimerMode),
  targetSeconds: getTargetForPhase(phase, currentTimerMode)
}
```

**Restore logic:**
```javascript
const { timerSnapshot } = restoredSnapshot;
if (timerSnapshot) {
  const drift = Math.floor((Date.now() - new Date(timerSnapshot.capturedAt)) / 1000);
  const adjustedElapsed = Math.min(
    timerSnapshot.elapsedSeconds + drift,
    timerSnapshot.targetSeconds
  );
  
  // Write to sessionStorage (source for timer component)
  sessionStorage.setItem(
    `timer_${timerSnapshot.phase}_${timerSnapshot.mode}`,
    JSON.stringify({
      elapsedSeconds: adjustedElapsed,
      startTimestamp: Date.now() - (adjustedElapsed * 1000)
    })
  );
  
  setCurrentTimerMode(timerSnapshot.mode);
}
```

**Result:** Timer continues within ±2 seconds of where old device left off (gate save latency + network round-trip).

## PIN Validation Security

**Already implemented** in `page.js` lines 286-314:
- Client calls `ensurePinAllowed(pinCode)` from `src/app/lib/pinAuth.js`
- Server validates PIN hash against learner's stored scrypt hash
- Only correct PIN allows session takeover
- Failed PIN shows error, user can retry

### 14. docs/brain/timer-system.md (42aa7c76a1e732a4ec83b46c76f7214efa5fa927819ed9a691f311cae452a2df)
- bm25: -4.8045 | entity_overlap_w: 5.20 | adjusted: -6.1045 | relevance: 1.0000

**Rule (single instance):** Only one `SessionTimer` instance should be mounted at a time for a given `{lessonKey, phase, mode}`.
- Mounting two `SessionTimer` components simultaneously can show brief 1-second drift when `SessionTimer` is in self-timing mode.
- In Session V2, when the Games overlay is open, the on-video timer is not rendered; the Games overlay renders the timer instead.

**Rule (click parity):** Clicking the timer badge in the Games overlay must behave the same as clicking the timer during the rest of the session: it opens `TimerControlOverlay` (PIN-gated).
- The timer badge must be a `SessionTimer` with `onTimerClick` wired to the same handler used by the main session timer.

### Overlay Stacking (V2)

Games and Visual Aids overlays must render above the timeline and timer overlays.
- Timeline must not use an extremely high `zIndex`.
- Full-screen overlays should use a higher `zIndex` than the on-video timer.

**TimerControlOverlay vs GamesOverlay:** If the facilitator opens `TimerControlOverlay` while the Games overlay is open, `TimerControlOverlay` must render above `GamesOverlay` so it is visible and usable.

**PlayTimeExpiredOverlay must be above GamesOverlay:**
- `PlayTimeExpiredOverlay` is a full-screen, blocking overlay. It must have a higher `zIndex` than `GamesOverlay` so the 30-second countdown cannot appear behind a running game.

### PIN Gating (V2)

Timer controls that can change session pacing are PIN-gated:
- Opening the TimerControlOverlay is gated by `ensurePinAllowed('timer')`.
- Pause/resume toggles are gated by `ensurePinAllowed('timer')`.

Timeline jumps are also PIN-gated (see pin-protection.md action `timeline`).

### Play Time Expiration Flow

When play timer reaches 00:00:

### 15. src/app/session/page.js (f7602cae35eee7bc49eaa6db8baf090677611eb2715bc6e5162329af5d9bb621)
- bm25: -5.3538 | entity_overlap_w: 2.60 | adjusted: -6.0038 | relevance: 1.0000

useEffect(() => {
    // Load runtime & learner targets once on mount
    reloadTargetsForCurrentLearner();
  }, [reloadTargetsForCurrentLearner]);

// Handle session takeover
  const handleSessionTakeover = useCallback(async (pinCode) => {
    if (!trackingLearnerId || !normalizedLessonKey || !browserSessionId) {
      throw new Error('Session not initialized');
    }

try {
      // Validate PIN via server API (don't use ensurePinAllowed - it shows another dialog)
      const mod = await import('@/app/lib/supabaseClient');
      const getSupabaseClient = mod.getSupabaseClient;
      const supabase = getSupabaseClient?.();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not logged in');
      }
      
      const res = await fetch('/api/facilitator/pin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pin: pinCode })
      });
      
      const result = await res.json();
      if (!res.ok || !result?.ok) {
        throw new Error('Invalid PIN');
      }

### 16. src/app/api/mentor-session/route.js (77202383ec70241edf62e293a8096138174a5710f6cec5cffa6eaf5f8c9011e0)
- bm25: -5.3116 | entity_overlap_w: 2.60 | adjusted: -5.9616 | relevance: 1.0000

try {
        const pinValid = await verifyPin(user.id, pinCode)
        if (!pinValid) {
          return jsonWithDeviceCookie({
            body: { error: 'Invalid PIN code', requiresPin: true },
            status: 403,
            deviceCookieHeader
          })
        }
      } catch (pinErr) {
        return jsonWithDeviceCookie({ body: { error: 'Failed to verify PIN' }, status: 500, deviceCookieHeader })
      }

### 17. docs/brain/mr-mentor-session-persistence.md (8a0b3c4381dd8c1aeb08c7e62253763457ae7c98ef1a6aa7711070f19c53afc9)
- bm25: -5.2966 | entity_overlap_w: 2.60 | adjusted: -5.9466 | relevance: 1.0000

**Takeover Confirmation:**
1. User on Device B enters PIN
2. Backend verifies PIN, deactivates old session, creates new session
3. Device A's realtime subscription triggers instantly (no 8-second delay)
4. Frontend shows takeover dialog

### 18. src/app/api/mentor-session/route.js (93a269f50eb1f2c905afc4bebf9f0efe5e96ff87b89909d43ec1d487123ac17f)
- bm25: -5.2668 | entity_overlap_w: 2.60 | adjusted: -5.9168 | relevance: 1.0000

try {
        const pinValid = await verifyPin(user.id, pinCode)
        if (!pinValid) {
          return jsonWithDeviceCookie({
            body: { error: 'Invalid PIN code', requiresPin: true },
            status: 403,
            deviceCookieHeader
          })
        }
      } catch (pinErr) {
        return jsonWithDeviceCookie({
          body: { error: 'Failed to verify PIN', details: pinErr.message },
          status: 500,
          deviceCookieHeader
        })
      }

### 19. src/app/learn/lessons/page.js (82c6cc891c4d9a7cb098915d0ef511fe1ae156ff77df4e93bf066854a7a5d44d)
- bm25: -5.1939 | entity_overlap_w: 2.60 | adjusted: -5.8439 | relevance: 1.0000

;(async () => {
      try {
        // Just check for active session without PIN requirement
        // The lessons page should be freely accessible
        const active = await getActiveLessonSession(learnerId)
        if (cancelled) return
        // No PIN gate here - let learners view lessons freely
        if (!cancelled) setSessionGateReady(true)
      } catch (err) {
        if (!cancelled) setSessionGateReady(true)
      }
    })()

### 20. docs/brain/facilitator-help-system.md (e7aac353101308d57f1fd60b5f3f803d31343881ecc59bd6858d0e1652ecc798)
- bm25: -5.0747 | entity_overlap_w: 2.60 | adjusted: -5.7247 | relevance: 1.0000

### Expansion Points
- Account settings pages (PIN setup, 2FA, preferences)
- Mr. Mentor page (natural language commands)
- Hotkeys configuration
- Learner transcript analysis

### Maintenance
- Review help content quarterly against beta feedback
- Update when workflows change (e.g., new planner features)
- Remove help for features that become self-evident after redesign
- Keep help content in sync with actual UI behavior (no drift)

---

## Related Brain Files

- **calendar-lesson-planning.md** - Automated planning backend logic (planner workflow backend)
- **timer-system.md** - Phase timer mechanics (what timers control in lessons)
- **pin-protection.md** - Facilitator section gating (why PIN checks appear)
- **beta-program.md** - Tutorial system (complementary to help system)

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (dce5a32bfc27a43bf530a2b77b02786553abb3323bf255b119b569fc490a2c19)
- bm25: -4.7491 | entity_overlap_w: 3.90 | adjusted: -5.7241 | relevance: 1.0000

// Periodic heartbeat to detect if session was taken over (backup to realtime)
  useEffect(() => {
    if (!accessToken || !hasAccess || sessionLoading) return

const checkSessionStatus = async () => {
      try {
        const res = await fetch(`/api/mentor-session?subjectKey=${encodeURIComponent(subjectKey)}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        
        if (!res.ok) return

const data = await res.json()
        
        console.log('[Heartbeat] Checking session status:', {
          mySessionId: sessionId,
          activeSessionId: data.session?.session_id,
          isOwner: data.isOwner,
          sessionStarted,
          hasSession: !!data.session
        })
        
        // Only show PIN if there's an active session AND we're not the owner
        // If there's no session at all, don't show PIN - user can start fresh
        if (data.session && !data.isOwner) {
          console.log('[Heartbeat] Not owner - showing PIN overlay')
          
          initializedSessionIdRef.current = null
          
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Show takeover dialog with the active session info
          setConflictingSession(data.session)
          setShowTakeoverDialog(true)
        }
      } catch (err) {
        console.error('[Heartbeat] Error:', err)
      }
    }

### 22. docs/brain/header-navigation.md (e68f7c5a1dab25ec0465f75a152c356c65209da788b72d81a8f8a94c365e61f5)
- bm25: -5.0474 | entity_overlap_w: 2.60 | adjusted: -5.6974 | relevance: 1.0000

When triggered from an active Session page, these links must route through the session-exit PIN gate (`goWithPin`) so leaving a session remains protected.

## What NOT To Do

- Do not navigate from `/session/*` to `/facilitator/*` without `goWithPin()`.
- Do not add billing as a top-level header link; billing lives under Account.
- Do not create multiple overlapping header overlays; keep menus mutually non-blocking.
- Do not rely on default `<button>` behavior in the header; always set `type="button"`.

## Key Files

- `src/app/HeaderBar.js` - Header layout, nav links, facilitator dropdown, session print menu
- `docs/brain/pin-protection.md` - PIN gating rules for session exits and facilitator routes

### 23. src/app/facilitator/account/page.js (6aed1abc117b23e8a42a6c17d6bcabeaff35bac0c1ce972cb85108b58886b86c)
- bm25: -5.2083 | entity_overlap_w: 1.30 | adjusted: -5.5333 | relevance: 1.0000

// PIN Overlay
function PinOverlay({ isOpen, onClose, email }) {
  const [hasPin, setHasPin] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [prefs, setPrefs] = useState(() => getPinPrefsLocal())
  const [loading, setLoading] = useState(true)

### 24. src/app/session/v2/SessionPageV2.jsx (f0f452675edb85355a5f1390651a4d38be611193f074ef5a6bdccd3d5ae449e2)
- bm25: -4.8449 | entity_overlap_w: 2.60 | adjusted: -5.4949 | relevance: 1.0000

// PIN gate: timeline jumps are facilitator-only
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timeline');
    } catch (e) {
      console.warn('[SessionPageV2] Timeline PIN gate error:', e);
    }
    if (!allowed) {
      timelineJumpInProgressRef.current = false;
      return;
    }
    
    console.log('[SessionPageV2] Timeline jump proceeding to:', targetPhase);
    
    // Stop any playing audio first
    stopAudioSafe({ force: true });
    
    // Reset opening actions state to prevent zombie UI
    setOpeningActionActive(false);
    setOpeningActionType(null);
    setOpeningActionState({});
    setOpeningActionInput('');
    setOpeningActionError('');
    setOpeningActionBusy(false);
    setShowPlayWithSonomaMenu(false);
    setShowGames(false);
    setShowFullscreenPlayTimer(false);

### 25. docs/brain/pin-protection.md (771d09bf70621a2a47da98e3ac52455b98299582fe3c7fc3744c6d3234d5db17)
- bm25: -5.1652 | entity_overlap_w: 1.30 | adjusted: -5.4902 | relevance: 1.0000

**Facilitator Pages** (all check PIN on mount):
- `src/app/facilitator/page.js` - Main facilitator hub
- `src/app/facilitator/learners/page.js` - Learner management
- `src/app/facilitator/lessons/page.js` - Lesson management
- `src/app/facilitator/generator/*/page.js` - Content generators
- `src/app/facilitator/account/*/page.js` - Account pages

### 26. sidekick_pack.md (823f4a32054ed567322f6c38220db8530887b63d7930a702a348ffe734c95072)
- bm25: -4.6559 | entity_overlap_w: 2.60 | adjusted: -5.3059 | relevance: 1.0000

### 22. sidekick_pack.md (f0e0466a6588f66493c88c0b00e750e7c20b3e5b9f4eedd4cfc00bcd3826f40a)
- bm25: -24.5808 | relevance: 1.0000

PIN verification is server-only (no localStorage fallback):
- Server validates PIN against hashed value in `profiles.facilitator_pin_hash`
- Uses bcrypt for secure comparison
- API endpoint: `POST /api/facilitator/pin/verify`

### 38. docs/brain/ingests/pack.planned-lessons-flow.md (c1630e20d42e7416e0786d4762a62020e29931c3609ba5301492ca0c6c410df5)
- bm25: -1.7211 | entity_overlap_w: 1.30 | adjusted: -2.0461 | relevance: 1.0000

## What NOT To Do

- Do not store lessons on the device (no localStorage/indexedDB/file downloads).
- Do not reuse Golden Keys to mean "unlock lessons"; Golden Keys are bonus play-time semantics.
- Do not match ownership using filename-only; subject collisions are possible.
- Do not allow path traversal in the download endpoint (`..`, `/`, `\\`).

## Key Files

- `src/app/facilitator/lessons/page.js`
- `src/app/api/facilitator/lessons/download/route.js`
- `src/app/api/facilitator/lessons/list/route.js`
- `src/app/api/lessons/[subject]/route.js`
- `src/app/api/lesson-file/route.js`

### 27. docs/brain/calendar-lesson-planning.md (4da551360e5a46cca2826bfe58a71289a036bb89df00313db4714021b4cc5eab)
- bm25: -14.3879 | relevance: 1.0000

**Usage:**
- `node scripts/check-completions-for-keys.mjs --learner Emma --from 2026-01-05 --to 2026-01-08`

### Scheduled Lessons Overlay: Built-in Lesson Editor

The Calendar day overlay includes an inline lesson editor for scheduled lessons.

This editor matches the regular lesson editor for Visual Aids (button + carousel + generation + persistence).

### 27. docs/brain/session-takeover.md (3f93c80afc3393066fb29eb5e8562c9fa07c364f0e666aac42099607b082384b)
- bm25: -4.9139 | entity_overlap_w: 1.30 | adjusted: -5.2389 | relevance: 1.0000

**No changes needed** - existing PIN flow reused for session takeover.

### 28. src/app/facilitator/account/page.js (effdfff11e825a9eadf541b68090219a19d4b2a78dda5b463ac44adad0ef5fb1)
- bm25: -4.5642 | entity_overlap_w: 2.60 | adjusted: -5.2142 | relevance: 1.0000

{/* Facilitator PIN */}
            <div
              onClick={() => setActiveOverlay('pin')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>📌</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginBottom: 2 }}>Facilitator PIN</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Protect sensitive actions</div>
              </div>
            </div>

{/* Connected Accounts */}
            <div
              onClick={() => setActiveOverlay('accounts')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>🔗</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginBottom: 2 }}>Connected Accounts</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Link Google and other services</div>
              </div>
            </div>

### 29. docs/brain/ingests/pack-mentor-intercepts.md (d5ec0788e6e2b4fbfaa482984112c82b9b297da545b06943e8edb3632c935164)
- bm25: -4.1902 | entity_overlap_w: 3.90 | adjusted: -5.1652 | relevance: 1.0000

### 10. docs/brain/mr-mentor-sessions.md (f2b7ab2dc155d2357594b47f2a3a65b057f762766ec8dbf9983ebc72fa37ef8e)
- bm25: -21.7710 | relevance: 1.0000

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Three-layer persistence for conversation state
- **[mr-mentor-memory.md](mr-mentor-memory.md)** - Conversation memory accessed during sessions

## Key Files

- `src/app/facilitator/generator/counselor/CounselorClient.jsx` - Session initialization, realtime/heartbeat conflict detection, takeover handling, conversation sync
- `src/components/SessionTakeoverDialog.jsx` - Takeover modal UI
- `src/app/api/mentor-session/route.js` - GET/POST/PATCH/DELETE endpoints, PIN validation, session enforcement

## Maintenance

**Manual cleanup** (if needed):
```sql
-- View all active sessions
SELECT * FROM mentor_sessions WHERE is_active = true;

-- Force-end specific session
UPDATE mentor_sessions 
SET is_active = false 
WHERE facilitator_id = 'uuid' AND is_active = true;
```

**Automatic cleanup:**
- API automatically deactivates stale sessions (no activity > 15 minutes) before creating new sessions
- No cron job needed

## What NOT To Do

**DON'T allow multiple active sessions** - Enforced by unique constraint + API validation. Multiple active sessions = split-brain state.

**DON'T skip PIN validation on takeover** - PIN required for `action: 'takeover'` and `action: 'force_end'`. Prevents unauthorized session hijacking.

**DON'T lose conversation history on takeover** - New session inherits full `conversation_history` from old session. Zero data loss.

**DON'T forget to stop polling on unmount** - Clear interval in cleanup effect. Memory leak otherwise.

### 30. docs/brain/ingests/pack.planned-lessons-flow.md (55294648e25051f8a5d5ef1152fb17c1f737ec2144ee257b22c174812502e2af)
- bm25: -4.1840 | entity_overlap_w: 3.90 | adjusted: -5.1590 | relevance: 1.0000

### 36. docs/brain/mr-mentor-sessions.md (f2b7ab2dc155d2357594b47f2a3a65b057f762766ec8dbf9983ebc72fa37ef8e)
- bm25: -12.6159 | relevance: 1.0000

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Three-layer persistence for conversation state
- **[mr-mentor-memory.md](mr-mentor-memory.md)** - Conversation memory accessed during sessions

## Key Files

- `src/app/facilitator/generator/counselor/CounselorClient.jsx` - Session initialization, realtime/heartbeat conflict detection, takeover handling, conversation sync
- `src/components/SessionTakeoverDialog.jsx` - Takeover modal UI
- `src/app/api/mentor-session/route.js` - GET/POST/PATCH/DELETE endpoints, PIN validation, session enforcement

## Maintenance

**Manual cleanup** (if needed):
```sql
-- View all active sessions
SELECT * FROM mentor_sessions WHERE is_active = true;

-- Force-end specific session
UPDATE mentor_sessions 
SET is_active = false 
WHERE facilitator_id = 'uuid' AND is_active = true;
```

**Automatic cleanup:**
- API automatically deactivates stale sessions (no activity > 15 minutes) before creating new sessions
- No cron job needed

## What NOT To Do

**DON'T allow multiple active sessions** - Enforced by unique constraint + API validation. Multiple active sessions = split-brain state.

**DON'T skip PIN validation on takeover** - PIN required for `action: 'takeover'` and `action: 'force_end'`. Prevents unauthorized session hijacking.

**DON'T lose conversation history on takeover** - New session inherits full `conversation_history` from old session. Zero data loss.

**DON'T forget to stop polling on unmount** - Clear interval in cleanup effect. Memory leak otherwise.

### 31. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (b30861338c07d988f2d66b61fe6040a9644c696ebac6e49160688207185b4517)
- bm25: -4.1840 | entity_overlap_w: 3.90 | adjusted: -5.1590 | relevance: 1.0000

### 22. docs/brain/mr-mentor-sessions.md (f2b7ab2dc155d2357594b47f2a3a65b057f762766ec8dbf9983ebc72fa37ef8e)
- bm25: -15.5683 | relevance: 1.0000

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Three-layer persistence for conversation state
- **[mr-mentor-memory.md](mr-mentor-memory.md)** - Conversation memory accessed during sessions

## Key Files

- `src/app/facilitator/generator/counselor/CounselorClient.jsx` - Session initialization, realtime/heartbeat conflict detection, takeover handling, conversation sync
- `src/components/SessionTakeoverDialog.jsx` - Takeover modal UI
- `src/app/api/mentor-session/route.js` - GET/POST/PATCH/DELETE endpoints, PIN validation, session enforcement

## Maintenance

**Manual cleanup** (if needed):
```sql
-- View all active sessions
SELECT * FROM mentor_sessions WHERE is_active = true;

-- Force-end specific session
UPDATE mentor_sessions 
SET is_active = false 
WHERE facilitator_id = 'uuid' AND is_active = true;
```

**Automatic cleanup:**
- API automatically deactivates stale sessions (no activity > 15 minutes) before creating new sessions
- No cron job needed

## What NOT To Do

**DON'T allow multiple active sessions** - Enforced by unique constraint + API validation. Multiple active sessions = split-brain state.

**DON'T skip PIN validation on takeover** - PIN required for `action: 'takeover'` and `action: 'force_end'`. Prevents unauthorized session hijacking.

**DON'T lose conversation history on takeover** - New session inherits full `conversation_history` from old session. Zero data loss.

**DON'T forget to stop polling on unmount** - Clear interval in cleanup effect. Memory leak otherwise.

### 32. docs/brain/pin-protection.md (68d0aa13898a78445bc9421b5bfd8dfc4afdcff0ffc2618661cd93a867bf6248)
- bm25: -5.1289 | relevance: 1.0000

### Session Integrations

### 33. docs/brain/mr-mentor-sessions.md (f2b7ab2dc155d2357594b47f2a3a65b057f762766ec8dbf9983ebc72fa37ef8e)
- bm25: -4.1531 | entity_overlap_w: 3.90 | adjusted: -5.1281 | relevance: 1.0000

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Three-layer persistence for conversation state
- **[mr-mentor-memory.md](mr-mentor-memory.md)** - Conversation memory accessed during sessions

## Key Files

- `src/app/facilitator/generator/counselor/CounselorClient.jsx` - Session initialization, realtime/heartbeat conflict detection, takeover handling, conversation sync
- `src/components/SessionTakeoverDialog.jsx` - Takeover modal UI
- `src/app/api/mentor-session/route.js` - GET/POST/PATCH/DELETE endpoints, PIN validation, session enforcement

## Maintenance

**Manual cleanup** (if needed):
```sql
-- View all active sessions
SELECT * FROM mentor_sessions WHERE is_active = true;

-- Force-end specific session
UPDATE mentor_sessions 
SET is_active = false 
WHERE facilitator_id = 'uuid' AND is_active = true;
```

**Automatic cleanup:**
- API automatically deactivates stale sessions (no activity > 15 minutes) before creating new sessions
- No cron job needed

## What NOT To Do

**DON'T allow multiple active sessions** - Enforced by unique constraint + API validation. Multiple active sessions = split-brain state.

**DON'T skip PIN validation on takeover** - PIN required for `action: 'takeover'` and `action: 'force_end'`. Prevents unauthorized session hijacking.

**DON'T lose conversation history on takeover** - New session inherits full `conversation_history` from old session. Zero data loss.

**DON'T forget to stop polling on unmount** - Clear interval in cleanup effect. Memory leak otherwise.

**DON'T allow takeover without showing warning** - Dialog must explain consequences (other device loses session). User should understand what's happening.

### 34. src/app/facilitator/generator/counselor/SessionTakeoverDialog.jsx (6016f2b53b03b966646f7435ad1c459b6be9534a695cc2a3892c6bdb1e85018f)
- bm25: -4.7977 | entity_overlap_w: 1.30 | adjusted: -5.1227 | relevance: 1.0000

<form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Enter your 4-digit PIN to continue:
          </label>
          
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pinCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '')
              setPinCode(val)
              setError('')
            }}
            placeholder="••••"
            disabled={loading}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-lpignore="true"
            data-form-type="other"
            data-1p-ignore="true"
            name="pin-code-single-use"
            id={`pin-${Math.random()}`}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 18,
              letterSpacing: '0.5em',
              textAlign: 'center',
              border: error ? '2px solid #ef4444' : '2px solid #d1d5db',
              borderRadius: 8,
              marginBottom: 12,
              outline: 'none',
              transition: 'border-color 0.2s',
              backgroundColor: loading ? '#f9fafb' : '#fff',
              WebkitTextSecurity: 'disc'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => {
              if (!error) e.target.style.borderColor = '#d1d5db'
            }}
          />

### 35. docs/brain/mr-mentor-sessions.md (694177aba3dfafe3c5962c85765d8bf7d1cdb181c40c89e76871879f3e347ac8)
- bm25: -4.0867 | entity_overlap_w: 3.90 | adjusted: -5.0617 | relevance: 1.0000

# Mr. Mentor Session Management

## How It Works

Mr. Mentor enforces **single-device access per facilitator** to prevent state conflicts and persists conversations across devices for seamless continuity. Only one device can have an active session at a time. Taking over a session from another device requires PIN validation.

**Flow:**
1. Facilitator opens Mr. Mentor on Device A → Session created, `sessionId` stored in sessionStorage
2. Facilitator opens Mr. Mentor on Device B → Detects existing active session on Device A
3. Device B shows `SessionTakeoverDialog` with device name, last activity time, PIN input
4. Facilitator enters 4-digit PIN → Validated via `POST /api/mentor-session` with `action: 'takeover'`
5. If valid: Device A session deactivated, Device B session activated with full conversation history
6. Device A's next poll (every 8 seconds) detects takeover → Shows alert, redirects to `/facilitator`
7. Facilitator continues conversation on Device B with zero data loss

**Purpose**: Prevents split-brain scenarios where two devices have conflicting conversation states. Enables cross-device workflows (start on desktop, continue on tablet) while maintaining conversation integrity.

## Database Schema

**`mentor_sessions` table:**
```sql
- id: UUID (primary key)
- facilitator_id: UUID (references auth.users)
- session_id: TEXT (browser-generated unique ID, stored in sessionStorage)
- device_name: TEXT (optional device identifier)
- conversation_history: JSONB (full conversation array)
- draft_summary: TEXT (summary draft)
- last_activity_at: TIMESTAMPTZ (updated on every interaction)
- created_at: TIMESTAMPTZ
- is_active: BOOLEAN (only one true per facilitator)

### 36. docs/brain/session-takeover.md (f547b8a84945c079f4753cfc178e83afd5ab0d6acc67018afbe877b3d81da9b9)
- bm25: -4.0749 | entity_overlap_w: 3.90 | adjusted: -5.0499 | relevance: 1.0000

## Why We Use Gates (and Sometimes Polling)

**Gates are the primary mechanism:**
- Conflict is detected exactly at meaningful checkpoints (Begin and snapshot saves).
- This aligns with persistence writes and avoids background chatter.

**Polling is secondary and optional:**
- Polling can improve UX by discovering a takeover/end even when the learner is idle.
- Keep it low-frequency and read-only, and only while a session is active.

## Device Switch Flow Example

**Scenario:** Learner starts lesson on iPad, switches to laptop mid-teaching

1. **iPad - Teaching vocab sentence 3**
   - User clicks Next
   - Gate: `scheduleSaveSnapshot('vocab-sentence-3')`
   - Snapshot saved with `session_id: "abc-123-ipad"`, timer at 45 seconds
   - Success

2. **Laptop - Opens same lesson**
   - Page loads, generates new `session_id: "xyz-789-laptop"`
   - User clicks Begin
   - Gate: `scheduleSaveSnapshot('begin-discussion')`
   - Database detects conflict (iPad session "abc-123-ipad" still active)
   - Returns conflict error with iPad session details

3. **Laptop - Takeover dialog shows**
   - "A session for this lesson is active on another device (iPad)"
   - "Last activity: 2 minutes ago"
   - "Enter 4-digit PIN to take over"
   - User enters PIN

4. **Laptop - PIN validated**
   - Clear localStorage (force database restore)
   - Deactivate iPad session "abc-123-ipad" (set ended_at)
   - Create new session "xyz-789-laptop"
   - Restore snapshot from database (vocab-sentence-3 checkpoint)
   - Extract timer state: 45 seconds + (now - capturedAt) = ~47 seconds
   - Set timer to 47 seconds, mode 'work'
   - Resume teaching at vocab sentence 3
   - Apply teaching flow snapshot (vocab index, stage, etc.)

### 37. src/app/session/v2/SessionPageV2.jsx (ad049a4dbb159a48b481d96c665a3257e0d0cad08e3eec63df75c8a7c18aed81)
- bm25: -4.6936 | entity_overlap_w: 1.30 | adjusted: -5.0186 | relevance: 1.0000

const res = await fetch('/api/facilitator/pin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ pin: pinCode })
    });

const result = await res.json().catch(() => null);
    if (!res.ok || !result?.ok) {
      throw new Error('Invalid PIN');
    }

if (conflictingSession?.id) {
      try {
        const { endLessonSession } = await import('@/app/lib/sessionTracking');
        await endLessonSession(conflictingSession.id, {
          reason: 'taken_over',
          metadata: {
            taken_over_by_session_id: browserSessionId,
            taken_over_at: new Date().toISOString(),
          },
          learnerId: trackingLearnerId,
          lessonId: trackingLessonId,
        });
      } catch {}
    }

try {
      const deviceName = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
      const takeoverStart = await startTrackedSession(browserSessionId, deviceName);
      if (takeoverStart?.conflict) {
        throw new Error('Lesson is still active on another device');
      }
      try { startSessionPolling?.(); } catch {}
    } catch (err) {
      throw err;
    }

// Clear local snapshot so reload pulls the latest remote snapshot.
    try {
      localStorage.removeItem(`atomic_snapshot:${trackingLearnerId}:${trackingLessonId}`);
    } catch {}

setShowTakeoverDialog(false);
    setConflictingSession(null);

if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [browserSessionId, conflictingSession, learnerProfile?.id, lessonKey, startTrackedSession, startSessionPolling]);

### 38. docs/brain/session-takeover.md (ca30ae3def190ad001f0315ab105c9a0786e60c8a03e19d920954fde732dc4ab)
- bm25: -4.3005 | entity_overlap_w: 2.60 | adjusted: -4.9505 | relevance: 1.0000

**When new device loads lesson page:**
1. Page generates `browserSessionId` (UUID stored in sessionStorage)
2. Once `trackingLearnerId`, `normalizedLessonKey`, and `browserSessionId` are available, page calls `startTrackedSession()`
3. Database detects conflict (different `session_id` already owns this learner+lesson)
4. `startTrackedSession()` returns `{conflict: true, existingSession: {...}}`
5. UI immediately shows `SessionTakeoverDialog`
6. **CRITICAL**: `sessionConflictChecked` remains FALSE when conflict detected, blocking snapshot restore
7. Snapshot restore logic waits for `sessionConflictChecked` flag before proceeding
8. User enters 4-digit PIN to validate ownership transfer
9. On PIN success:
   - Old session deactivated (`ended_at` set, event logged)
   - New session created with current `session_id`
   - Page reloads to restore snapshot from database (most recent for this learner+lesson)
   - localStorage updated with restored snapshot
   - Lesson resumes from checkpoint

### 39. src/app/facilitator/generator/counselor/SessionTakeoverDialog.jsx (9fc73230b81c439e0926e5ac87e0768bdd8d0e69ad971349b215356846683fff)
- bm25: -4.1209 | entity_overlap_w: 2.60 | adjusted: -4.7709 | relevance: 1.0000

// Session Takeover Dialog - requires PIN to take over Mr. Mentor session from another device
'use client'

import { useState } from 'react'

export default function SessionTakeoverDialog({ 
  existingSession, 
  onTakeover, 
  onCancel
}) {
  const [pinCode, setPinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (pinCode.length !== 4) {
      setError('PIN must be 4 digits')
      return
    }

setError('')
    setLoading(true)

try {
      await onTakeover(pinCode)
    } catch (err) {
      setError(err.message || 'Failed to take over session')
      setLoading(false)
    }
  }

const formatLastActivity = (isoString) => {
    if (!isoString) return 'Unknown'
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString()
  }

### 40. src/lib/faq/facilitator-pages.json (4b848d3bcb8fd074168f4bfd8805c4c4143f1f27948661b54e4fbba3e5eaf7e3)
- bm25: -4.4346 | entity_overlap_w: 1.30 | adjusted: -4.7596 | relevance: 1.0000

{
  "category": "Facilitator Pages",
  "features": [
    {
      "id": "facilitator-page-hub",
      "title": "Facilitator Hub (/facilitator)",
      "keywords": [
        "facilitator hub",
        "facilitator home",
        "facilitator dashboard page",
        "/facilitator",
        "account learners lessons calendar",
        "talk to mr mentor"
      ],
      "description": "The Facilitator Hub is the entry point to adult tools. It shows quick links to Account, Learners, Lessons, Calendar, and Mr. Mentor.",
      "howToUse": "Use the cards to open a section (Account/Learners/Lessons/Calendar). Use the Mr. Mentor button to open the facilitator chat experience.",
      "relatedFeatures": ["facilitator-dashboard", "mr-mentor", "pin-security"]
    },
    {
      "id": "facilitator-page-account",
      "title": "Account (/facilitator/account)",
      "keywords": [
        "facilitator account",
        "account page",
        "profile",
        "security",
        "2fa",
        "connected accounts",
        "timezone",
        "marketing emails",
        "policies",
        "danger zone",
        "/facilitator/account"
      ],
      "description": "The Account page is the central place to manage facilitator profile and security settings, connections, hotkeys, timezone, and billing links.",
      "howToUse": "Open a card to edit: Your Name; Email and Password; Two-Factor Auth; Facilitator PIN; Connected Accounts; Hotkeys; Timezone; Marketing Emails; Policies; Plan; Danger Zone. Notifications is also linked from here.",
      "relatedFeatures": ["pin-security", "subscription-tiers"]
    },
    {
      "id": "facilitator-page-account-settings-redirect",
      "title": "Account Settings (Redirect) (/facilitator/account/settings)",
      "keywords": [
        "account se
