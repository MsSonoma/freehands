# Goals Clipboard Implementation

## Database Setup Required

Run this SQL in Supabase SQL Editor:

```sql
-- Add goals_notes column to learners table
ALTER TABLE learners 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

-- Add goals_notes column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_learners_goals_notes 
ON learners(id) WHERE goals_notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_goals_notes 
ON profiles(id) WHERE goals_notes IS NOT NULL;
```

## Implementation Complete

### Features Added:
1. **📋 Goals Button** - Top left of Mr. Mentor video
   - Highlights yellow when goals are set
   - Opens persistent goals clipboard overlay

2. **Goals Clipboard Overlay**
   - 600 character limit
   - Saves per learner or for facilitator (when no learner selected)
   - Persists across all conversations
   - Auto-loads when learner selection changes

3. **API Integration**
   - Goals notes sent with every Mr. Mentor API call
   - Included in system prompt as "PERSISTENT GOALS & PRIORITIES"
   - Mr. Mentor can reference and guide based on stated goals

4. **Mr. Mentor Awareness**
   - System prompt updated to explain goals clipboard
   - Can suggest using it when appropriate
   - Uses goals to guide conversations

### Files Modified:
- `CounselorClient.jsx` - Added goals clipboard button, state, loading logic
- `GoalsClipboardOverlay.jsx` - New overlay component
- `/api/goals-notes/route.js` - New API endpoint for loading/saving
- `/api/counselor/route.js` - Updated to receive and use goals_notes
- `add-goals-notes-column.sql` - SQL schema for manual execution

### Usage:
1. Click 📋 button in top left of Mr. Mentor video
2. Set persistent goals (up to 600 chars)
3. Goals are automatically loaded when switching learners
4. Mr. Mentor sees goals with every message
5. Button turns yellow when goals are set
