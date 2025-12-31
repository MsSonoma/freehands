# Goals Clipboard

## How It Works

Facilitators can set persistent goals and priorities for themselves or specific learners. These goals are automatically included in every Mr. Mentor conversation to provide context and guide discussions.

**Flow:**
1. Click 📋 button in top left of Mr. Mentor video (highlights yellow when goals are set)
2. Enter up to 600 characters of goals/priorities in overlay
3. Goals save automatically per learner (when learner selected) or for facilitator (when no learner)
4. On learner switch, goals auto-load from database
5. Every Mr. Mentor API call receives goals in system prompt under "PERSISTENT GOALS & PRIORITIES"
6. Mr. Mentor can reference goals, suggest using the feature, and guide based on stated objectives

**Purpose**: Provides long-term context that persists across all conversations, enabling Mr. Mentor to give data-informed, goal-aligned guidance without re-explaining objectives every session.

## Database Schema

**Learners table:**
```sql
ALTER TABLE learners 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_learners_goals_notes 
ON learners(id) WHERE goals_notes IS NOT NULL;
```

**Profiles table (facilitator goals when no learner selected):**
```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_goals_notes 
ON profiles(id) WHERE goals_notes IS NOT NULL;
```

## API Integration

**`/api/goals-notes` endpoints:**

**GET**: Load goals for current context
- Query param: `learner_id` (optional)
- If `learner_id` provided: returns `learners.goals_notes`
- If no `learner_id`: returns `profiles.goals_notes` for facilitator
- Returns: `{ success: true, goals_notes: "..." }`

**POST**: Save goals for current context
- Body: `{ learner_id?: string, goals_notes: string }`
- Saves to appropriate table (learners or profiles)
- Returns: `{ success: true }`

**`/api/counselor` integration:**
- Request body now includes `goals_notes` field
- System prompt includes: `"PERSISTENT GOALS & PRIORITIES:\n{goals_notes}"`
- Mr. Mentor sees goals in every conversation turn

## Key Files

- `src/app/counselor/CounselorClient.jsx` - Goals button, state management, auto-load on learner switch
- `src/components/GoalsClipboardOverlay.jsx` - Overlay UI component
- `src/app/api/goals-notes/route.js` - Load/save API endpoint
- `src/app/api/counselor/route.js` - Receives goals_notes, includes in system prompt

## What NOT To Do

**DON'T exceed 600 character limit** - UI enforces this but API should validate too. Longer text risks token bloat and poor UX.

**DON'T fail silently on load errors** - If goals fail to load, show user-friendly message. Missing goals can confuse facilitators who expect Mr. Mentor to remember context.

**DON'T forget to clear goals on learner switch** - When learner changes, immediately load new goals. Stale goals = wrong context.

**DON'T make goals optional in API calls** - Always send `goals_notes` field (empty string if none) so Mr. Mentor knows explicitly whether goals exist or not.
