# Mr. Mentor Conversation Memory - Quick Reference

## Setup (5 minutes)

### 1. Run Database Migration
```bash
# In Supabase SQL Editor:
# Paste contents of scripts/setup-conversation-memory.sql
# Click "Run"
```

### 2. Verify Environment Variables
```bash
# Required in .env.local:
OPENAI_API_KEY=sk-...           # For summarization
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3. Test the System
```bash
# Start dev server
npm run dev

# In another terminal:
node scripts/test-conversation-memory.mjs
```

---

## How It Works

### Automatic Flow (No Code Changes Needed)

1. **User opens Mr. Mentor** → System loads previous conversation memory (if exists)
2. **User sends message** → Mr. Mentor responds with full context
3. **After response** → Summary auto-generated and saved (background, non-blocking)
4. **Repeat** → Each exchange updates the summary incrementally

### Memory Storage

- **General discussions** (no learner selected) → Saved to facilitator-level memory
- **Learner-specific** (learner selected) → Saved to learner-specific memory
- **Both contexts** maintained independently

---

## User Features

### As Facilitator

**Automatic continuity:**
```
Day 1: "I need help with Emma's math"
Day 2: "Let's continue with Emma's math"
→ Mr. Mentor remembers Day 1 context
```

**Search past conversations:**
```
"What did we discuss about science experiments?"
→ Mr. Mentor searches and summarizes findings
```

**Switch contexts:**
```
Select "Emma" → Emma-specific memory
Select "None" → General memory
Select "Max" → Max-specific memory
```

---

## Function Calling Tools

Mr. Mentor can use these automatically:

### `get_conversation_memory`
Retrieve past conversation summary.

**Usage**: Automatic at session start, or when facilitator mentions "last time", "before", etc.

**Example**:
```javascript
// Mr. Mentor calls:
get_conversation_memory({ learner_id: null })

// Returns:
{
  summary: "Facilitator discussed 5th grade math curriculum...",
  turn_count: 15,
  recent_context: [...]
}
```

### `search_conversation_history`
Search with keywords (fuzzy matching).

**Usage**: When facilitator asks "what did we discuss about X?"

**Example**:
```javascript
// Mr. Mentor calls:
search_conversation_history({ 
  search: "reading struggles",
  include_archive: true 
})

// Returns:
{
  count: 2,
  results: [
    { summary: "...", date: "...", learner_context: "Emma" },
    { summary: "...", date: "...", learner_context: "General" }
  ]
}
```

---

## API Quick Reference

### Create/Update Memory
```bash
POST /api/conversation-memory
Authorization: Bearer <token>
Content-Type: application/json

{
  "learner_id": "uuid-or-null",
  "conversation_turns": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "force_regenerate": false
}
```

**Response:**
```json
{
  "success": true,
  "conversation_update": {
    "id": "...",
    "summary": "...",
    "turn_count": 3
  }
}
```

### Retrieve Memory
```bash
GET /api/conversation-memory?learner_id=<uuid>
Authorization: Bearer <token>
```

### Search
```bash
GET /api/conversation-memory?search=math&include_archive=true
Authorization: Bearer <token>
```

### Delete (Archives First)
```bash
DELETE /api/conversation-memory?learner_id=<uuid>
Authorization: Bearer <token>
```

---

## Database Tables

### `conversation_updates` (Active)
- One record per facilitator+learner combo
- Updates incrementally with each exchange
- Auto-archives after 50 turns

### `conversation_history_archive` (Permanent)
- Never deleted
- Archives created on delete or after 50 turns
- Full-text search enabled

---

## Key Behaviors

### Auto-Summarization
- Uses GPT-4o-mini (fast, cheap)
- Incremental updates (builds on previous summary)
- 200-400 words
- Captures: topics, insights, action items, tone

### Auto-Archival
- Triggers:
  - Manual delete
  - Turn count > 50
- Always preserves history
- Searchable forever

### Context Injection
- First message in session → Loads memory
- Appended to system prompt
- Mr. Mentor sees:
  - Summary of past discussions
  - Turn count
  - Last update date

---

## Common Scenarios

### Scenario 1: New Facilitator
- No memory exists
- First conversation creates summary
- Second conversation loads and updates

### Scenario 2: Long Conversation
- After 50 turns, auto-archives
- Reset to turn 1
- Old summary preserved in archive

### Scenario 3: Multiple Learners
- Emma conversations → `learner_id = emma_uuid`
- Max conversations → `learner_id = max_uuid`
- General → `learner_id = NULL`
- All independent, searchable

### Scenario 4: Search Across Time
- "What did we discuss about math?"
- Searches current + archive
- Finds all relevant conversations
- Returns sorted by date

---

## Troubleshooting

### Memory not loading?
```bash
# Check database:
SELECT * FROM conversation_updates WHERE facilitator_id = '<uuid>';

# Check logs:
# Look for: "[Conversation Memory] Loaded conversation memory"
```

### Summaries not saving?
```bash
# Check OpenAI key:
echo $OPENAI_API_KEY

# Check client console:
# Look for: "Conversation memory updated"

# Check network tab:
# POST /api/conversation-memory should succeed
```

### Search returns nothing?
```bash
# Try with archive:
GET /api/conversation-memory?search=<term>&include_archive=true

# Check if any memories exist:
SELECT COUNT(*) FROM conversation_updates;
SELECT COUNT(*) FROM conversation_history_archive;
```

---

## Performance

- **Summary generation**: 2-3 seconds (async, non-blocking)
- **Memory retrieval**: <100ms (indexed)
- **Search**: <200ms (full-text indexed)
- **Archive queries**: <300ms (date indexed)

---

## Security

- RLS enabled on both tables
- Facilitators see only their own data
- Token auth required for all operations
- Learner IDs validated against facilitator's learners

---

## Files Created/Modified

**New files:**
- `scripts/add-conversation-memory-tables.sql` - Full schema
- `scripts/setup-conversation-memory.sql` - Quick setup
- `scripts/test-conversation-memory.mjs` - Test suite
- `src/app/api/conversation-memory/route.js` - API
- `docs/mr-mentor-conversation-memory.md` - Full docs
- `docs/mr-mentor-conversation-memory-quick.md` - This file

**Modified files:**
- `src/app/api/counselor/route.js` - Added function calling + auto-load
- `src/app/facilitator/tools/counselor/CounselorClient.jsx` - Auto-update

---

## Next Steps

1. ✅ Run database migration
2. ✅ Test with `test-conversation-memory.mjs`
3. ✅ Use Mr. Mentor normally
4. ✅ Verify memory persists across sessions
5. ✅ Try searching past conversations

---

**Questions?** See full docs: `docs/mr-mentor-conversation-memory.md`
