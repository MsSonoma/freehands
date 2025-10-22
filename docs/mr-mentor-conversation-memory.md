# Mr. Mentor Conversation Memory System

## Overview

Mr. Mentor now maintains a persistent **conversation memory** system that creates a "clipboard knowledge" of facilitator and learner conversations. This system automatically updates with each back-and-forth, providing continuity across sessions and enabling powerful search capabilities.

## Key Features

### 1. **Automatic Summarization**
- Every conversation exchange is automatically summarized using GPT-4o-mini
- Summaries are **incremental** - they build on previous summaries rather than regenerating from scratch
- Keeps context concise (200-400 words) while preserving important details

### 2. **Dual-Context Storage**
- **Facilitator-level memory**: General discussions (when no learner is selected)
- **Learner-specific memory**: Conversations about a specific learner
- Both contexts maintained independently for precision

### 3. **Persistent History**
- All conversation updates saved **forever** in archive table
- Active conversations auto-archive after 50 turns (keeps system responsive)
- Never lose context even after years

### 4. **Fuzzy Search**
- Search past conversations with keywords
- PostgreSQL full-text search with ranking
- Searches both current and archived conversations
- Finds relevant discussions even with approximate terms

### 5. **Automatic Context Loading**
- First message in any session automatically loads previous memory
- Mr. Mentor sees summary of past discussions
- Provides seamless continuity across days/weeks

## Technical Architecture

### Database Tables

#### `conversation_updates` (Active Memory)
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

**Purpose**: Stores the current conversation summary. Only one active record per facilitator+learner combination.

#### `conversation_history_archive` (Permanent Archive)
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

**Purpose**: Permanent storage. Never deleted. Archives created:
- When conversation deleted
- When conversation exceeds 50 turns (auto-archival)

### API Endpoints

#### `POST /api/conversation-memory`
**Update or create conversation memory**

Request body:
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

**Behavior**:
- Generates summary using OpenAI GPT-4o-mini
- If existing summary exists, does **incremental update** (adds new context)
- If `force_regenerate: true`, creates fresh summary from all turns
- Updates `turn_count` and `updated_at`

#### `GET /api/conversation-memory`
**Retrieve conversation memory**

Query parameters:
- `learner_id` (optional): Get learner-specific memory
- `search` (optional): Search with keywords
- `include_archive` (optional): Include archived conversations

Examples:
```
GET /api/conversation-memory
→ Returns general facilitator memory

GET /api/conversation-memory?learner_id=abc123
→ Returns memory for specific learner

GET /api/conversation-memory?search=math%20curriculum
→ Searches for "math curriculum" in all memories

GET /api/conversation-memory?search=Emma&include_archive=true
→ Searches current + archived memories
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
    {
      "summary": "...",
      "turn_count": 20,
      "date": "...",
      "learner_context": "Learner-specific",
      "archived": false
    }
  ]
}
```

#### `DELETE /api/conversation-memory`
**Clear conversation memory (auto-archives)**

Query parameters:
- `learner_id` (optional): Clear specific learner memory

**Important**: Deleting triggers automatic archival before removal, so history is never lost.

### Mr. Mentor Function Calling

#### New Tools

**1. `get_conversation_memory`**

Retrieve memory from previous sessions.

Parameters:
- `learner_id` (optional): Get learner-specific memory

Returns:
```json
{
  "success": true,
  "has_memory": true,
  "summary": "...",
  "turn_count": 15,
  "last_updated": "...",
  "recent_context": [...]
}
```

**When to use**: 
- Mr. Mentor automatically calls this at session start
- Can also call explicitly when facilitator references past discussions

**2. `search_conversation_history`**

Search past conversations with fuzzy matching.

Parameters:
- `search` (required): Keywords to search
- `include_archive` (optional): Include archived conversations

Returns:
```json
{
  "success": true,
  "count": 2,
  "results": [
    {
      "summary": "...",
      "date": "...",
      "learner_context": "..."
    }
  ]
}
```

**When to use**:
- Facilitator asks "what did we discuss about X?"
- Facilitator wants to review past advice or plans

### Client Integration

The `CounselorClient.jsx` automatically updates conversation memory after each message exchange:

```javascript
// After receiving mentor response
const finalHistory = [...updatedHistory, { role: 'assistant', content: mentorReply }]

// Update memory in background (non-blocking)
updateConversationMemory(finalHistory, token).catch(err => {
  console.warn('Failed to update memory:', err)
})
```

**Key points**:
- Runs asynchronously - doesn't block UI
- Sends only last 2 turns (incremental update)
- Silent failure - never interrupts user experience
- Respects learner selection (saves to appropriate context)

## Conversation Flow

### Session Start (First Message)

1. User sends first message
2. API detects `conversationHistory.length === 0`
3. API fetches conversation memory from database
4. Memory appended to system prompt:
   ```
   === CONVERSATION MEMORY ===
   Previous Summary (15 turns):
   [Summary text...]
   Last Update: 12/20/2024
   === END CONVERSATION MEMORY ===
   ```
5. Mr. Mentor has full context from previous sessions

### Each Exchange

1. User sends message
2. Mr. Mentor responds
3. Client updates conversation history
4. Client calls `POST /api/conversation-memory` with last 2 turns
5. API generates/updates summary using OpenAI
6. Summary saved to database
7. Process repeats

### Search Request

**Facilitator**: "What did we discuss about Emma's reading struggles?"

**Mr. Mentor**:
1. Calls `search_conversation_history` tool
2. Function searches database with fuzzy matching
3. Returns relevant conversation summaries
4. Mr. Mentor summarizes findings in natural language

## Summarization Strategy

### Incremental Updates

When existing summary exists:
```
Prompt: "You are updating a conversation summary.
Here is the existing summary:
[Previous summary...]

And here are the new conversation turns:
User: ...
Mr. Mentor: ...

Update the summary to include the new information."
```

**Benefits**:
- Faster (shorter prompt)
- Maintains continuity
- Avoids redundancy
- Preserves important earlier context

### Full Regeneration

When `force_regenerate: true` or no existing summary:
```
Prompt: "Create a concise summary (200-400 words) that captures:
- Main topics discussed
- Key insights or advice
- Action items
- Emotional tone
- Learner-specific context"
```

**When to use**:
- First conversation
- Manual reset requested
- Corruption detected

## Search Implementation

### PostgreSQL Full-Text Search

```sql
CREATE INDEX idx_conversation_updates_summary_search 
  ON conversation_updates 
  USING gin(to_tsvector('english', summary));
```

**Query**:
```sql
SELECT * FROM conversation_updates
WHERE facilitator_id = $1
  AND to_tsvector('english', summary) @@ websearch_to_tsquery('english', $2)
ORDER BY updated_at DESC
LIMIT 20;
```

**Features**:
- Stemming (e.g., "reading" matches "read", "reads")
- Stop word removal
- Ranking by relevance
- Fast even with thousands of records

### Fuzzy Fallback

If no full-text results:
```sql
SELECT * FROM conversation_updates
WHERE facilitator_id = $1
  AND summary ILIKE '%' || $2 || '%'
ORDER BY updated_at DESC
LIMIT 20;
```

## Auto-Archival

### Trigger: Long Conversations

After 50 turns, conversation auto-archives:

```sql
CREATE TRIGGER trigger_archive_long_conversation
  BEFORE UPDATE ON conversation_updates
  FOR EACH ROW
  EXECUTE FUNCTION maybe_archive_long_conversation();
```

**Behavior**:
1. Check if `turn_count > 50`
2. If yes:
   - Copy current state to `conversation_history_archive`
   - Reset `turn_count` to 1
   - Clear `recent_turns`
3. Continue with new summary

**Why 50 turns?**
- Keeps active table small
- Prevents prompt bloat
- Maintains responsiveness
- Archives preserve full history

### Trigger: Deletion

Before deleting conversation:

```sql
CREATE TRIGGER trigger_archive_conversation_before_delete
  BEFORE DELETE ON conversation_updates
  FOR EACH ROW
  EXECUTE FUNCTION archive_conversation_update();
```

**Behavior**:
- Always archive before delete
- Ensures history never lost
- Facilitator can safely clear memory

## Security & Privacy

### Row-Level Security (RLS)

```sql
-- Facilitators can only access their own data
CREATE POLICY "Facilitators can view their own conversation updates"
  ON conversation_updates FOR SELECT
  USING (auth.uid() = facilitator_id);
```

**Applied to**:
- `conversation_updates` (SELECT, INSERT, UPDATE, DELETE)
- `conversation_history_archive` (SELECT, INSERT)

### Token Authentication

All API requests require valid Supabase auth token:
```javascript
const { user } = await supabase.auth.getUser()
if (!user) return { error: 'Unauthorized' }
```

## Usage Examples

### Example 1: Continuity Across Days

**Day 1 (Morning)**:
- **Facilitator**: "I'm struggling with Emma's math curriculum. She's in 4th grade."
- **Mr. Mentor**: [Discusses strategies, pacing, resources]

*Memory saved: "Facilitator discussed challenges with Emma's 4th grade math curriculum. Concerns about pacing and finding appropriate resources."*

**Day 1 (Evening)**:
- **Facilitator**: "I tried those math games you suggested."
- **Mr. Mentor**: [Memory loaded] "Great! How did Emma respond to the games we discussed this morning?"

**Day 3**:
- **Facilitator**: "Back to Emma's math situation."
- **Mr. Mentor**: [Memory loaded] "Let's continue working on Emma's math curriculum. Last time we talked about games and pacing adjustments. What's been happening since then?"

### Example 2: Learner-Specific Memory

**Scenario A (Emma selected)**:
- Discussion about Emma's reading progress
- Memory saved with `learner_id = emma_uuid`

**Scenario B (No learner selected)**:
- General discussion about curriculum planning
- Memory saved with `learner_id = NULL`

**Scenario C (Switch to Max)**:
- Select Max from dropdown
- Separate memory context loaded for Max
- Emma's memory preserved independently

### Example 3: Searching Past Conversations

**Facilitator**: "What did we discuss about science experiments?"

**Mr. Mentor**:
1. Calls `search_conversation_history({search: "science experiments"})`
2. Finds 2 conversations:
   - One from 3 weeks ago about volcano projects
   - One from last week about pH testing
3. Responds: "I found two conversations where we discussed science experiments. Three weeks ago, we talked about volcano projects for Emma's 4th grade class. Last week, we explored pH testing as a chemistry introduction. Would you like me to elaborate on either of these?"

## Performance Considerations

### Summary Generation Time

- **Average**: 2-3 seconds (GPT-4o-mini)
- **Non-blocking**: Runs after response sent to user
- **Failure handling**: Silent - doesn't interrupt UX

### Database Queries

- **Active table**: Fast (UNIQUE constraint, small size)
- **Full-text search**: Fast (GIN index)
- **Archive queries**: Indexed by facilitator + date

### Prompt Size Management

- Summaries capped at 400 words
- Only last 3 turns included in immediate context
- Auto-archival prevents unbounded growth

## Future Enhancements

### Potential Features

1. **Manual Tagging**: Let facilitators tag conversations (e.g., "curriculum planning", "Emma's reading")
2. **Export to PDF**: Generate formatted report of conversation history
3. **Trend Analysis**: Identify recurring themes or concerns
4. **Action Item Tracking**: Extract and track todo items from conversations
5. **Reminder System**: "It's been 2 weeks since we discussed Emma's math - want to follow up?"
6. **Multi-Learner Summaries**: "Give me an overview of discussions about all my learners"

### Optimization Ideas

1. **Batch Summarization**: Generate summaries in batches during off-peak hours
2. **Compression**: Compress old summaries after 6 months
3. **Smart Archival**: Archive based on topic change detection, not just turn count
4. **Embeddings**: Use vector similarity for semantic search instead of keyword matching

## Troubleshooting

### Memory Not Loading

**Symptom**: Mr. Mentor doesn't remember past conversations

**Check**:
1. Is this the first message in the session? (Memory only loads on first turn)
2. Is authentication working? (Need valid token)
3. Check database: `SELECT * FROM conversation_updates WHERE facilitator_id = '...'`
4. Check logs: Look for "[Conversation Memory] Loaded conversation memory"

**Fix**:
- Clear browser cache and refresh
- Verify token with: `supabase.auth.getSession()`

### Summaries Not Updating

**Symptom**: Memory not saving after conversations

**Check**:
1. Client console: Look for "Conversation memory updated"
2. Network tab: Check POST to `/api/conversation-memory`
3. API logs: Look for errors in summarization
4. OpenAI key: Verify `OPENAI_API_KEY` env var set

**Fix**:
- Restart Next.js server
- Verify Supabase RLS policies

### Search Returns No Results

**Symptom**: Search finds nothing despite relevant conversations

**Check**:
1. Try `include_archive: true` (might be archived)
2. Check spelling/keywords
3. Try simpler search terms
4. Verify search index: `\d conversation_updates` in psql

**Fix**:
- Use broader keywords
- Include archive in search
- Manually regenerate search vectors if corrupted

### Database Migration Fails

**Symptom**: SQL script errors when creating tables

**Common issues**:
- Tables already exist (drop first)
- RLS conflicts (disable before recreating)
- Trigger name conflicts (drop old triggers)

**Fix**:
```sql
-- Drop existing
DROP TRIGGER IF EXISTS trigger_archive_long_conversation ON conversation_updates;
DROP TABLE IF EXISTS conversation_updates CASCADE;
DROP TABLE IF EXISTS conversation_history_archive CASCADE;

-- Then run migration script
```

## Related Documentation

- `/docs/mr-mentor.md` - Core Mr. Mentor documentation
- `/docs/mr-mentor-function-calling.md` - Function calling reference
- `scripts/add-conversation-memory-tables.sql` - Database schema
- `src/app/api/conversation-memory/route.js` - API implementation
- `src/app/api/counselor/route.js` - Mr. Mentor integration

---

**Version**: 1.0  
**Date**: October 22, 2025  
**Status**: Initial Implementation
