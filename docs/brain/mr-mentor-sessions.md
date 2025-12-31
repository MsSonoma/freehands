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

-- Unique constraint: Only one active session per facilitator
CREATE UNIQUE INDEX idx_mentor_sessions_active_facilitator 
ON mentor_sessions (facilitator_id) 
WHERE is_active = true;
```

## API Endpoints

**`GET /api/mentor-session?sessionId={id}`** - Check session status

Response:
```json
{
  "status": "active" | "taken" | "none",
  "session": {
    "session_id": "...",
    "device_name": "...",
    "conversation_history": [...],
    "draft_summary": "...",
    "last_activity_at": "..."
  },
  "isOwner": true | false
}
```

**`POST /api/mentor-session`** - Create/takeover/force-end session

Request:
```json
{
  "sessionId": "...",
  "deviceName": "My Desktop",
  "pinCode": "1234",
  "action": "resume" | "takeover" | "force_end",
  "targetSessionId": "..." // for force_end
}
```

- **`action: 'resume'`**: Create new session (fails if another session active)
- **`action: 'takeover'`**: Deactivate other session, create new one (requires valid PIN)
- **`action: 'force_end'`**: Release frozen session without taking over (requires valid PIN)
- Automatically clears stale sessions older than `MENTOR_SESSION_TIMEOUT_MINUTES` (default: 15 minutes)

Response:
```json
{
  "session": { ... },
  "status": "active" | "taken_over" | "force_ended"
}
```

**`PATCH /api/mentor-session`** - Update conversation/draft

Request:
```json
{
  "sessionId": "...",
  "conversationHistory": [...],
  "draftSummary": "..."
}
```

Auto-debounced on client (saves 1 second after last change).

**`DELETE /api/mentor-session?sessionId={id}`** - End session

Called when user clicks "New Conversation". Deactivates session, returns `{ success: true }`.

## Client Flow

**Initialization** (`src/app/counselor/CounselorClient.jsx`):
1. Generate unique `sessionId` (UUIDv4), store in sessionStorage
2. Wait for accessToken and tier validation
3. `GET /api/mentor-session?sessionId={id}`
4. If `status === 'taken'` → Show `SessionTakeoverDialog`
5. If `status === 'none'` or `isOwner === true` → `POST /api/mentor-session` to create/resume
6. Load `conversation_history` from database
7. Start polling (every 8 seconds) to detect takeovers

**Session Polling:**
- `setInterval` calls `GET /api/mentor-session?sessionId={id}` every 8 seconds
- If `status === 'taken'` or `!isOwner`:
  - Show alert: "Your Mr. Mentor session has been taken over by another device."
  - Redirect to `/facilitator`
  - Stop polling

**Conversation Persistence:**
- Every change to `conversationHistory` or `draftSummary` triggers debounced `PATCH` (1 second delay)
- On "New Conversation" click: `DELETE /api/mentor-session?sessionId={id}`

## Components

**`SessionTakeoverDialog.jsx`** - Modal for takeover flow

Props:
```jsx
{
  existingSession: {
    session_id: string,
    device_name: string,
    last_activity_at: string (ISO timestamp)
  },
  onTakeover: (pinCode: string) => Promise<void>,
  onForceEnd?: (pinCode: string) => Promise<void>,
  onCancel: () => void
}
```

Features:
- Displays device name and last activity timestamp
- 4-digit PIN input (numeric only)
- "Take Over Session" button (calls `onTakeover`)
- "Force End Session" button (calls `onForceEnd` to release frozen session)
- Warning about consequences
- Cancel button returns to facilitator page

## Key Files

- `src/app/counselor/CounselorClient.jsx` - Session initialization, polling, takeover handling, conversation sync
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
