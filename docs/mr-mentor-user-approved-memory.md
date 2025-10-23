# Mr. Mentor Conversation Memory - User-Approved Summaries

## Overview
Implemented a user-approval system for Mr. Mentor conversation memory. Conversations are no longer automatically saved - instead, users review and approve summaries before they're committed to memory.

## Key Features

### 1. ClipboardOverlay Component
- Clipboard-styled UI overlay
- Editable textarea (500 character limit for space-efficient summaries)
- Three action buttons:
  - **Save to Memory**: Commits approved summary to `conversation_updates`
  - **Export Whole Conversation**: Downloads full conversation as .txt file
  - **Delete Conversation**: Discards without saving

### 2. Draft Summary System
- Live-updating summaries stored in `conversation_drafts` table
- Updated incrementally after each Mr. Mentor response
- Persists across page refresh and devices via Supabase
- Only committed to permanent memory when user clicks "Save to Memory"

### 3. New Conversation Flow
- "New Conversation" button appears in caption area (top-left) when conversation exists
- Clicking triggers:
  1. Mr. Mentor speaks instructions explaining the clipboard
  2. ClipboardOverlay appears with current draft summary
  3. User can edit, save, delete, or export
  4. Conversation cleared only after user action

### 4. UI Changes
- Removed hamburger menu from Mr. Mentor page (HeaderBar)
- Functionality moved to "New Conversation" button
- Cleaner, more intuitive UX

## Database Migration Required

Run this SQL script in Supabase to add the `conversation_drafts` table:

```bash
# In Supabase SQL Editor:
scripts/add-conversation-drafts-table.sql
```

## API Endpoints

### `/api/conversation-drafts`
- **GET**: Retrieve current draft for facilitator/learner pair
- **POST**: Update or create draft summary (incremental updates)
- **DELETE**: Remove draft (user chose to delete conversation)

### `/api/conversation-memory` (updated)
- Now accepts `summary_override` parameter
- When provided, uses user-edited summary instead of generating new one

## Implementation Details

### Character Limit
- Draft summaries limited to 500 characters
- Balance between comprehensive and space-saving
- Counter shows remaining characters
- Turns red at 90% capacity

### Cross-Device Sync
- Drafts stored in Supabase (not just localStorage)
- User can start conversation on desktop, approve on mobile
- Requires authentication to access drafts

### Conversation Export Format
Plain text file with timestamp:
```
Mr. Mentor Conversation - 2025-10-23

You:
[user message]

Mr. Mentor:
[assistant response]

...
```

## Next Steps

1. Test cross-device sync functionality
2. Consider adding conversation history browser (view past saved conversations)
3. Add search functionality for saved conversation summaries
4. Implement conversation tagging/categorization

## Files Changed
- `src/app/facilitator/tools/counselor/ClipboardOverlay.jsx` (new)
- `src/app/facilitator/tools/counselor/CounselorClient.jsx` (updated)
- `src/app/api/conversation-drafts/route.js` (new)
- `src/app/api/conversation-memory/route.js` (updated)
- `src/app/HeaderBar.js` (updated - removed Mr. Mentor menu)
- `scripts/add-conversation-drafts-table.sql` (new)
