# Mr. Mentor Conversation Memory

## How It Works

Mr. Mentor maintains persistent "clipboard knowledge" of facilitator and learner conversations. Every conversation exchange is automatically summarized using GPT-4o-mini, creating incremental context that persists across sessions. Facilitators can search past conversations and Mr. Mentor automatically loads previous memory on first message.

**Flow:**
1. Facilitator sends message to Mr. Mentor
2. After assistant response, client calls `POST /api/conversation-memory` with full conversation turns
3. Backend checks if existing summary exists for facilitator+learner combination
4. If exists: Creates **incremental update** (adds new context to existing summary)
5. If new: Generates fresh summary from all turns
6. Summary saved to `conversation_updates` table (200-400 words, last 10 turns)
7. If conversation exceeds 50 turns: Auto-archive to `conversation_history_archive` table
8. Next session: First message automatically loads previous summary into Mr. Mentor's context
9. Facilitator can search conversations with keywords using fuzzy full-text search

**Purpose**: Provides continuity across days/weeks without re-explaining context. Mr. Mentor remembers previous discussions, learner challenges, and facilitator preferences indefinitely.

## Database Schema

**`conversation_updates` table (Active Memory):**
```sql
- id: UUID primary key
- facilitator_id: UUID (auth.users)
- learner_id: UUID (learners, nullable)
- summary: TEXT (200-400 word summary)
- recent_turns: JSONB (last 10 turns for immediate context)
- turn_count: INTEGER (total turns in this conversation)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- UNIQUE: (facilitator_id, learner_id)
```
**One active record per facilitator+learner** combination. Overwritten with each update.

**`conversation_history_archive` table (Permanent Archive):**
```sql
- id: UUID primary key
- facilitator_id: UUID
- learner_id: UUID (nullable)
- summary: TEXT
- conversation_turns: JSONB (full turns at archive time)
- turn_count: INTEGER
- archived_at: TIMESTAMPTZ
- search_vector: tsvector (generated for full-text search)
```
**Never deleted.** Archives created when conversation deleted or exceeds 50 turns.

## API Endpoints

**`POST /api/conversation-memory`** - Update or create memory

Request:
```json
{
  "learner_id": "uuid-or-null",
  "conversation_turns": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "force_regenerate": false
}
```

Response:
```json
{
  "success": true,
  "conversation_update": {
    "id": "...",
    "summary": "...",
    "turn_count": 15,
    "updated_at": "..."
  }
}
```

**`GET /api/conversation-memory`** - Retrieve memory

Query params:
- `learner_id` (optional): Get learner-specific memory
- `search` (optional): Search with keywords
- `include_archive` (optional): Include archived conversations

Examples:
```
GET /api/conversation-memory
→ Returns general facilitator memory

GET /api/conversation-memory?learner_id=abc123
→ Returns memory for specific learner

GET /api/conversation-memory?search=math%20curriculum&include_archive=true
→ Searches current + archived memories for "math curriculum"
```

Response (single memory):
```json
{
  "success": true,
  "conversation_update": {
    "summary": "...",
    "turn_count": 15,
    "recent_turns": [...],
    "updated_at": "..."
  }
}
```

Response (search results):
```json
{
  "success": true,
  "count": 3,
  "results": [
    { "summary": "...", "turn_count": 20, "learner_name": "Emma", "relevance": 0.95 },
    { "summary": "...", "turn_count": 8, "learner_name": null, "relevance": 0.82 }
  ]
}
```

## Function Calling Tools

**`get_conversation_memory` tool** (available to Mr. Mentor):
- Loads summary for current facilitator+learner context
- Returns summary + recent turns
- Used automatically on first message of new session

**`search_conversation_history` tool** (available to Mr. Mentor):
- Searches past conversations with keywords
- Parameters: `keywords` (string), `include_current_learner_only` (boolean)
- Returns ranked results from current + archived memories
- Example: User asks "What did we discuss about Emma last week?" → Mr. Mentor calls `search_conversation_history("Emma")`

## Client Integration

`src/app/counselor/CounselorClient.jsx`:
- After each assistant response, calls `POST /api/conversation-memory` with conversation history
- Debounced (1 second) to avoid excessive API calls during rapid exchanges
- On learner switch, loads new memory via `GET /api/conversation-memory?learner_id={id}`
- Search UI (planned) will call `GET /api/conversation-memory?search={keywords}`

## Related Brain Files

- **[mr-mentor-sessions.md](mr-mentor-sessions.md)** - Memory system integrates with session management
- **[mr-mentor-conversation-flows.md](mr-mentor-conversation-flows.md)** - Function calling tools retrieve memory context

## Key Files

- `src/app/api/conversation-memory/route.js` - GET/POST endpoints, summarization logic, archival
- `src/app/counselor/CounselorClient.jsx` - Client-side memory updates, loading
- `src/app/api/counselor/route.js` - Function calling tools, automatic memory loading

## What NOT To Do

**DON'T regenerate summaries from scratch** - Use incremental updates. Regenerating loses nuance and wastes tokens. Only use `force_regenerate: true` for debugging.

**DON'T lose archived data** - Never delete from `conversation_history_archive`. It's permanent record for search/compliance.

**DON'T skip auto-archival** - Conversations over 50 turns must archive before continuing. Prevents summary bloat.

**DON'T forget learner context** - When learner selected, always pass `learner_id` to APIs. Mixing facilitator-level and learner-level memory causes confusion.

**DON'T expose raw conversation turns to Mr. Mentor** - Only send summary + last 10 recent turns. Full history stays in database for search/audit.
