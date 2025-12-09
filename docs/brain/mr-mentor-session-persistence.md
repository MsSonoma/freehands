# Mr. Mentor Session Persistence

**Last Updated:** 2025-12-09  
**Status:** Canonical  
**Systems:** Session ownership, conversation persistence, device takeover, draft summaries, turn limits

---

## How It Works

### Three-Layer Persistence Architecture

Mr. Mentor uses a three-layer persistence model with clear ownership and atomic gates:

#### **Layer 1: Active Session Transcript** (`mentor_sessions` table)
- **Purpose:** Single source of truth for the currently active conversation
- **Scope:** One active session per facilitator (enforced by `is_active` flag)
- **Storage:** Full `conversation_history` JSONB array + metadata
- **Lifecycle:** Created on page load → Updated on every exchange → Deleted on "New Conversation"
- **Realtime:** Supabase subscription monitors `is_active` changes for instant conflict detection

**Schema:**
```sql
CREATE TABLE mentor_sessions (
  id UUID PRIMARY KEY,
  facilitator_id UUID REFERENCES auth.users(id),
  session_id UUID NOT NULL,  -- Client-generated unique identifier
  device_name TEXT,           -- "Platform - Browser"
  conversation_history JSONB, -- [{role, content}, ...]
  token_count INTEGER,        
  is_active BOOLEAN,          -- Only ONE active per facilitator
  last_activity_at TIMESTAMPTZ,
  last_local_update_at TIMESTAMPTZ, -- NEW: Client-side timestamp for stale detection
  created_at TIMESTAMPTZ
)
```

**Atomic Gate:** Never load `conversation_history` from database unless:
1. Takeover is confirmed AND
2. Database `last_activity_at` > local `last_local_update_at`

---

#### **Layer 2: Working Draft Summary** (`conversation_drafts` table)
- **Purpose:** Auto-generated synopsis updated incrementally during conversation
- **Scope:** One draft per facilitator-learner pair
- **Storage:** `draft_summary` TEXT + last 2 turns for context
- **Lifecycle:** Created on first exchange → Updated after each exchange → Deleted on save/delete
- **Update Frequency:** After EVERY assistant response (async, non-blocking)

**Schema:**
```sql
CREATE TABLE conversation_drafts (
  id UUID PRIMARY KEY,
  facilitator_id UUID,
  learner_id UUID,           -- NULL for general conversations
  draft_summary TEXT,        -- GPT-4o-mini generated summary
  recent_turns JSONB,        -- Last 2 turns for incremental update
  turn_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (facilitator_id, learner_id)
)
```

---

#### **Layer 3: Permanent Memory** (`conversation_updates` table)
- **Purpose:** User-approved summaries that persist across all sessions
- **Scope:** Auto-loaded into Mr. Mentor's system prompt at start of EVERY conversation
- **Storage:** User-edited or GPT-generated summary + last 10 turns
- **Lifecycle:** Created when user clicks "Save" → Never deleted (archived instead)

**Schema:**
```sql
CREATE TABLE conversation_updates (
  id UUID PRIMARY KEY,
  facilitator_id UUID,
  learner_id UUID,
  summary TEXT,              -- Approved summary
  recent_turns JSONB,        -- Last 10 turns for context
  turn_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (facilitator_id, learner_id)
)
```

---

### Device Takeover Flow

**Realtime Detection (Instant):**
```javascript
// Subscribe to is_active changes on mentor_sessions
const channel = supabase
  .channel('mentor-session-changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'mentor_sessions',
    filter: `session_id=eq.${sessionId}`
  }, (payload) => {
    if (!payload.new.is_active && payload.new.session_id === currentSessionId) {
      // THIS session was taken over - show dialog immediately
      showTakeoverDialog(payload.new)
    }
  })
  .subscribe()
```

**Takeover Confirmation:**
1. User on Device B enters PIN
2. Backend verifies PIN, deactivates old session, creates new session
3. Device A's realtime subscription triggers instantly (no 8-second delay)
4. Frontend shows takeover dialog

**Atomic Gate - Prevent Stale Overwrites:**
```javascript
// BEFORE loading conversation from database
const dbTimestamp = new Date(session.last_activity_at).getTime()
const localTimestamp = lastLocalUpdateTimestamp.current

if (dbTimestamp <= localTimestamp) {
  // Database is stale - keep local conversation
  console.warn('Ignoring stale database conversation')
  return
}

// Database is newer - safe to load
setConversationHistory(session.conversation_history)
```

---

### Turn Limit Enforcement

**Warning at 30 turns:**
- Show toast: "Your conversation is getting long. Consider starting a new conversation soon for better performance."
- User can dismiss and continue

**Force Overlay at 50 turns:**
- Automatically show ClipboardOverlay
- Disable "Cancel" button - user MUST choose Save, Export, or Delete
- Add explanation: "This conversation has reached its limit. Please save or delete to continue."

**Implementation:**
```javascript
useEffect(() => {
  const turnCount = conversationHistory.length
  
  if (turnCount === 30) {
    // Show warning toast (dismissible)
    showToast('Consider starting a new conversation soon for better performance')
  }
  
  if (turnCount >= 50) {
    // Force overlay (non-dismissible)
    setShowClipboard(true)
    setClipboardForced(true) // Disables Cancel button
  }
}, [conversationHistory.length])
```

---

### Zombie Cleanup Rules

**When to Delete `mentor_sessions` Row:**
1. User clicks "Delete" in ClipboardOverlay → Delete row immediately
2. User clicks "Save" in ClipboardOverlay → Delete row after successful save to `conversation_updates`
3. Device takeover → Old session set `is_active=false` (NOT deleted - kept for 24h for recovery)
4. Session idle for 15 minutes → Set `is_active=false` (NOT deleted)
5. Background cron job → Delete `is_active=false` rows older than 24 hours

**When to Delete `conversation_drafts` Row:**
1. User clicks "Delete" → Delete immediately
2. User clicks "Save" → Delete after successful save to `conversation_updates`

**Atomic Delete (New Conversation):**
```javascript
// Delete BOTH tables atomically
await Promise.all([
  fetch(`/api/mentor-session?sessionId=${sessionId}`, { method: 'DELETE' }),
  fetch(`/api/conversation-drafts?learner_id=${learnerId}`, { method: 'DELETE' })
])
```

---

## What NOT To Do

❌ **Never load conversation_history during polling** - Only during confirmed takeover  
❌ **Never overwrite local conversation without timestamp check** - Use atomic gate  
❌ **Never store draft_summary in mentor_sessions** - Single source in conversation_drafts  
❌ **Never delete is_active=false sessions immediately** - Keep 24h for recovery  
❌ **Never allow >50 turns without forcing overlay** - Degrades AI performance  
❌ **Never skip confirmation on "Delete"** - Use native `confirm()` dialog  

---

## Key Files

- `src/app/facilitator/generator/counselor/CounselorClient.jsx` - Main Mr. Mentor UI (2831 lines)
- `src/app/facilitator/generator/counselor/ClipboardOverlay.jsx` - Conversation summary overlay
- `src/app/api/mentor-session/route.js` - Session CRUD API (GET/POST/PATCH/DELETE)
- `src/app/api/conversation-drafts/route.js` - Draft summary API
- `src/app/api/conversation-memory/route.js` - Permanent memory API
