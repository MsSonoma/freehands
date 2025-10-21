# Golden Key Persistence Implementation

## Overview
Implemented a persistent golden key system that tracks key usage per lesson in Supabase. Golden keys now stay active on a lesson until completion, surviving page refreshes and session restarts.

## Database Changes

### New Column: `active_golden_keys`
Added to the `learners` table in Supabase:
- **Type**: JSONB
- **Default**: `{}`
- **Format**: `{ "subject/lesson_file": true, ... }`
- **Purpose**: Tracks which lessons currently have an active golden key

### SQL Migration
Run the script: `scripts/add-active-golden-keys-column.sql`

```sql
ALTER TABLE public.learners ADD COLUMN active_golden_keys jsonb DEFAULT '{}'::jsonb;
UPDATE public.learners SET active_golden_keys = '{}'::jsonb WHERE active_golden_keys IS NULL;
```

## Implementation Details

### 1. Session Page (`src/app/session/page.js`)

#### Golden Key State
- Changed from reading URL param directly to state variable
- Checks both URL param and persisted active keys on load
- State: `const [hasGoldenKey, setHasGoldenKey] = useState(goldenKeyFromUrl)`

#### Load-Time Check (Lines ~226-275)
When a session loads:
1. Fetches the learner data including `active_golden_keys`
2. Checks if the current lesson has an active key: `activeKeys[lessonKey]`
3. If URL param has `goldenKey=true` AND no active key exists, saves the new key usage
4. Sets `hasGoldenKey` state accordingly

#### Key Persistence on Use
When a golden key is used (from URL):
- Adds the lesson to `active_golden_keys` in database
- Does NOT decrement `golden_keys` count (already done in learn/lessons page)
- Saves: `{ ...activeKeys, [lessonKey]: true }`

#### Key Removal on Completion (Lines ~5610-5645)
When a lesson is completed successfully:
- Removes the lesson from `active_golden_keys`
- Preserves the `golden_keys` count
- Saves: `delete activeKeys[lessonKey]`

### 2. Learn/Lessons Page (`src/app/learn/lessons/page.js`)

#### State Management
- Added: `const [activeGoldenKeys, setActiveGoldenKeys] = useState({})`
- Fetches `active_golden_keys` alongside `approved_lessons`

#### Visual Badge
- Displays a golden key badge (🔑 Active) on lessons with active keys
- Badge styling:
  ```javascript
  {
    fontSize: 16,
    background: '#fef3c7',
    color: '#92400e',
    padding: '2px 6px',
    borderRadius: 6,
    fontWeight: 600
  }
  ```

#### Badge Location
- Positioned in the top-right of lesson cards
- Shows next to subject badge
- Includes tooltip: "Golden Key Active"

### 3. Facilitator/Lessons Page (`src/app/facilitator/lessons/page.js`)

#### State Management
- Added: `const [activeGoldenKeys, setActiveGoldenKeys] = useState({})`
- Fetches `active_golden_keys` when loading learner data

#### Visual Badge
- Shows 🔑 badge next to lesson title
- Compact badge style (just emoji)
- Tooltip: "Golden Key Active on this lesson"
- Appears for both facilitator and standard lessons

### 4. Client API (`src/app/facilitator/learners/clientApi.js`)

#### Updated Functions

**normalizeRow()**
- Returns `active_golden_keys: row.active_golden_keys || {}`
- Ensures field is always present in learner objects

**toFlatTargets()**
- Passes through `active_golden_keys` without modification
- Preserves JSONB structure

**createLocal() / updateLocal()**
- Handles `active_golden_keys` in localStorage fallback
- Initializes to empty object if not provided

**updateLearner() / createLearner()**
- Includes `active_golden_keys` in Supabase payloads
- Preserves the field during all update operations

## User Experience

### Golden Key Lifecycle

1. **Earn Key**: Complete a lesson within time limit → `golden_keys` count increments
2. **Select Key**: On learn/lessons page, toggle golden key and select a lesson
3. **Use Key**: Key is consumed from count and saved to `active_golden_keys[lesson]`
4. **Persist**: Key remains active on that lesson until completion
5. **Access Features**: Poem and story unlocked every time lesson is opened
6. **Complete**: Lesson completion removes key from `active_golden_keys`
7. **Re-attempt**: If learner wants to do the lesson again later, they need a new key

### Visual Indicators

**Learn/Lessons Page**
- Large badge in top-right corner: "🔑 Active"
- Yellow/amber color scheme (#fef3c7 background)
- Visible at a glance

**Facilitator/Lessons Page**
- Compact 🔑 emoji badge
- Next to lesson title
- Shows facilitators which lessons have active keys

## Testing Checklist

### Database Setup
- [ ] Run `scripts/add-active-golden-keys-column.sql` in Supabase SQL Editor
- [ ] Verify column exists: Check `learners` table schema
- [ ] Confirm default value: All existing rows have `{}`

### Golden Key Usage
- [ ] Earn a golden key by completing lesson within time
- [ ] See golden_keys count increment
- [ ] Select golden key on learn/lessons page
- [ ] Start a lesson
- [ ] Verify poem and story are unlocked
- [ ] Refresh page → features still unlocked
- [ ] Complete the lesson → key removed from database

### Persistence
- [ ] Use golden key on a lesson
- [ ] Close browser completely
- [ ] Reopen and navigate to that lesson
- [ ] Verify features are still unlocked
- [ ] Check Supabase: `active_golden_keys` should show the lesson

### Visual Badges
- [ ] Badge appears on lesson with active key (learn/lessons)
- [ ] Badge appears on lesson with active key (facilitator/lessons)
- [ ] Badge disappears after lesson completion
- [ ] Badge reappears if golden key is used again on same lesson

### Edge Cases
- [ ] Multiple lessons with active keys → all show badges
- [ ] Complete one lesson → only that badge disappears
- [ ] No golden keys available → cannot select key
- [ ] Demo learner → gracefully handles no database

## Files Modified

1. `scripts/add-active-golden-keys-column.sql` - NEW migration script
2. `src/app/session/page.js` - Golden key persistence logic
3. `src/app/learn/lessons/page.js` - Badge display (learner view)
4. `src/app/facilitator/lessons/page.js` - Badge display (facilitator view)
5. `src/app/facilitator/learners/clientApi.js` - Database field handling

## Benefits

✅ **Persistent**: Keys survive page refreshes and browser restarts
✅ **Per-Lesson**: Each lesson independently tracks its golden key status
✅ **Visible**: Clear badges show which lessons have active keys
✅ **Clean Lifecycle**: Keys are automatically removed on completion
✅ **Reusable**: Same lesson can use a new key after completion
✅ **Backward Compatible**: Works with existing golden_keys counter system
