# Mr. Mentor Session Management

## Overview

Mr. Mentor now enforces **single-device access per facilitator** and persists conversations across devices. This prevents conflicts, ensures consistent state, and allows facilitators to seamlessly switch devices while maintaining their conversation history.

## Key Features

1. **Single Active Session**: Only one device can have an active Mr. Mentor session at a time per facilitator account
2. **Session Takeover with PIN**: Taking over a session from another device requires entering your 4-digit PIN
3. **Conversation Persistence**: All conversation history is stored in the database and syncs automatically
4. **Automatic Handoff**: When a session is taken over, the old device is immediately notified and redirected
5. **Cross-Device Continuity**: Start a conversation on your desktop, continue it on your tablet

## Architecture

### Database Schema

**Table**: `mentor_sessions`

```sql
- id: UUID (primary key)
- facilitator_id: UUID (references auth.users)
- session_id: TEXT (browser-generated unique ID)
- device_name: TEXT (optional device identifier)
- conversation_history: JSONB (full conversation array)
- draft_summary: TEXT (summary draft)
- last_activity_at: TIMESTAMPTZ (updated on every interaction)
- created_at: TIMESTAMPTZ
- is_active: BOOLEAN (only one true per facilitator)
```

**Constraint**: Only one active session per facilitator enforced by unique constraint and trigger.

### API Endpoints

**`GET /api/mentor-session?sessionId={id}`**
- Check session status for the current facilitator
- Returns: `{ status: 'active' | 'taken' | 'none', session: {...}, isOwner: boolean }`

**`POST /api/mentor-session`**
- Create new session or take over existing session
- Body: `{ sessionId, deviceName, pinCode?, action: 'resume' | 'takeover' }`
- If another session exists and action is 'takeover', requires valid PIN
- Returns: `{ session: {...}, status: 'active' | 'taken_over' }`

**`PATCH /api/mentor-session`**
- Update conversation history and draft summary
- Body: `{ sessionId, conversationHistory, draftSummary }`
- Auto-debounced on client (saves 1 second after last change)
- Returns: `{ success: true }`

**`DELETE /api/mentor-session?sessionId={id}`**
- End/deactivate current session
- Called when user clicks "New Conversation"
- Returns: `{ success: true }`

## Client Flow

### Initialization Sequence

1. **Mount**: Generate unique `sessionId` (stored in sessionStorage)
2. **Check Auth**: Wait for accessToken and tier validation
3. **Check Existing Session**: GET `/api/mentor-session?sessionId={id}`
   - If `status === 'taken'`: Show takeover dialog
   - If `status === 'none'` or `isOwner === true`: Create/resume session
4. **Load Conversation**: Pull conversation_history from database
5. **Start Polling**: Check every 8 seconds if session is still active

### Session Takeover Flow

1. User opens Mr. Mentor on Device B while Device A has active session
2. Device B detects conflict and shows `SessionTakeoverDialog`
3. Dialog displays:
   - Device name of active session
   - Last activity timestamp
   - Warning about ending the other session
   - 4-digit PIN input
4. User enters PIN
5. Device B validates PIN via `POST /api/mentor-session` with `action: 'takeover'`
6. If valid:
   - Old session deactivated
   - New session created with full conversation history
   - Device B continues with conversation
   - Device A's next poll detects takeover and redirects to `/facilitator`

### Conversation Persistence

- **Save**: Every change to `conversationHistory` or `draftSummary` triggers debounced PATCH (1 second delay)
- **Load**: On session initialization, conversation loaded from database
- **Delete**: When "New Conversation" clicked, session is deleted via DELETE endpoint

### Session Polling

- Runs every 8 seconds via `setInterval`
- Checks if current `sessionId` is still the active owner
- If `status === 'taken'` or `!isOwner`:
  - Shows alert: "Your Mr. Mentor session has been taken over by another device."
  - Redirects to `/facilitator`
  - Stops polling

## Components

### `SessionTakeoverDialog.jsx`

Modal dialog for session takeover:
- Displays existing session info
- 4-digit PIN input (numeric only)
- Warning about consequences
- Calls `onTakeover(pinCode)` callback
- Calls `onCancel()` to return to facilitator page

Props:
```jsx
{
  existingSession: {
    device_name: string,
    last_activity_at: string (ISO timestamp)
  },
  onTakeover: (pinCode: string) => Promise<void>,
  onCancel: () => void
}
```

### `CounselorClient.jsx` Changes

**New State**:
- `sessionId`: Unique browser tab ID
- `sessionLoading`: True during initialization
- `showTakeoverDialog`: Controls takeover modal
- `conflictingSession`: Session data for takeover dialog
- `sessionPollInterval`: Interval ref for polling

**New Effects**:
- Session ID generation on mount
- Session initialization after auth
- Database conversation sync (replaces localStorage)
- Session polling for takeovers
- Cleanup on unmount

**New Functions**:
- `startSessionPolling()`: Begins interval checking
- `handleSessionTakeover(pinCode)`: Executes takeover with PIN validation
- `clearConversationAfterSave()`: Now deletes session in database

## Migration Instructions

1. **Run SQL Migration**:
   ```bash
   # Open Supabase SQL Editor and run:
   scripts/setup-mentor-sessions.sql
   ```

2. **Verify Tables Created**:
   - Check `mentor_sessions` table exists
   - Verify RLS policies are enabled
   - Confirm trigger is active

3. **Deploy Code**:
   ```bash
   git pull
   npm run build
   vercel --prod
   ```

4. **Test Flow**:
   - Open Mr. Mentor on Device A
   - Start a conversation
   - Open Mr. Mentor on Device B (different browser/tab)
   - Verify PIN dialog appears
   - Enter PIN and verify session moves
   - Check Device A redirects automatically
   - Verify conversation persists on Device B

## Security Notes

- PIN validation uses same `profiles.pin_code` field as other features
- RLS policies ensure users can only access their own sessions
- Session IDs are browser-generated UUIDs (unpredictable)
- Database trigger enforces single active session constraint
- All API calls require valid Bearer token

## Troubleshooting

**Session won't initialize**:
- Check browser console for errors
- Verify `sessionId` is being generated
- Confirm `accessToken` is present
- Check Supabase logs for API errors

**Takeover dialog won't accept PIN**:
- Verify PIN is exactly 4 digits
- Check user has `pin_code` set in profiles table
- Confirm API returns 403 with `requiresPin: true`

**Old device not redirecting**:
- Check polling is running (8-second interval)
- Verify session status API returns correct data
- Look for network errors in console

**Conversation not persisting**:
- Check PATCH calls are firing (debounced 1 second)
- Verify `conversation_history` column is JSONB
- Confirm RLS policies allow updates

## Future Enhancements

- WebSocket for instant takeover notifications (remove polling)
- Session expiration (auto-deactivate after 24 hours of inactivity)
- Session history view (see past devices/timestamps)
- Optional "trust this device" to skip PIN on known devices
- Multi-session mode for Enterprise tier (e.g., co-teaching scenarios)
