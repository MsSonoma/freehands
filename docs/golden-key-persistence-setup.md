# Golden Key Persistence - Setup Guide

## Quick Start

### Step 1: Run Database Migration
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `scripts/add-active-golden-keys-column.sql`
5. Click **Run**
6. Verify success message: "Added active_golden_keys column"

### Step 2: Verify Installation
Check that the column was created:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'learners' 
  AND column_name = 'active_golden_keys';
```

Expected result:
- **column_name**: active_golden_keys
- **data_type**: jsonb
- **column_default**: '{}'::jsonb

### Step 3: Test the Feature
1. **Earn a golden key**
   - Complete any lesson within the time limit
   - Check that golden_keys count increments

2. **Use the golden key**
   - Go to Learn → Lessons
   - Toggle the golden key selector
   - Click "Start Lesson" on any approved lesson
   - Verify poem and story are unlocked

3. **Test persistence**
   - Refresh the page while in the lesson
   - Poem and story should still be available
   - Close browser and reopen
   - Navigate back to the same lesson
   - Features should still be unlocked

4. **Complete the lesson**
   - Finish all phases successfully
   - Check database: `active_golden_keys` should no longer contain this lesson

5. **Verify badges**
   - **Learn/Lessons**: Look for "🔑 Active" badge in top-right of lesson card
   - **Facilitator/Lessons**: Look for 🔑 emoji next to lesson title

## Troubleshooting

### Badge doesn't appear
- Check browser console for errors
- Verify `active_golden_keys` column exists in database
- Confirm learner has the key active in database:
  ```sql
  SELECT active_golden_keys FROM learners WHERE id = 'LEARNER_ID';
  ```

### Features not unlocked
- Check browser console logs for "[Golden Key]" messages
- Verify URL has `goldenKey=true` param (first time only)
- Check database shows lesson in `active_golden_keys`

### Key not persisting
- Ensure migration ran successfully
- Check for JavaScript errors in browser console
- Verify Supabase connection is working

### Key not clearing on completion
- Check completion handler logs in browser console
- Verify lesson completed successfully (all phases)
- Manually clear if needed:
  ```sql
  UPDATE learners 
  SET active_golden_keys = active_golden_keys - 'subject/lesson_file'
  WHERE id = 'LEARNER_ID';
  ```

## Database Queries

### Check active keys for a learner
```sql
SELECT id, name, active_golden_keys 
FROM learners 
WHERE id = 'LEARNER_ID';
```

### See all learners with active keys
```sql
SELECT id, name, active_golden_keys, golden_keys
FROM learners 
WHERE active_golden_keys != '{}'::jsonb;
```

### Clear all active keys (testing only)
```sql
UPDATE learners SET active_golden_keys = '{}'::jsonb;
```

### Add a test active key manually
```sql
UPDATE learners 
SET active_golden_keys = '{"math/4th_Addition_beginner.json": true}'::jsonb
WHERE id = 'LEARNER_ID';
```

## Development Tips

### Console Logging
Look for these console messages:
- `[Golden Key] Found active golden key for this lesson`
- `[Golden Key] Saving new golden key usage for lesson`
- `[Golden Key] Successfully saved golden key usage`
- `[Golden Key] Cleared active golden key for completed lesson`

### Check State
In browser DevTools console:
```javascript
// Check localStorage learner
localStorage.getItem('learner_id')
localStorage.getItem('learner_name')

// Check Supabase
const { getSupabaseClient } = await import('./src/app/lib/supabaseClient.js')
const supabase = getSupabaseClient()
const { data } = await supabase.from('learners').select('*').eq('id', 'LEARNER_ID').single()
console.log(data.active_golden_keys)
```

## Rollback (if needed)

To remove the feature:
```sql
ALTER TABLE public.learners DROP COLUMN IF EXISTS active_golden_keys;
```

Then revert the code changes.
