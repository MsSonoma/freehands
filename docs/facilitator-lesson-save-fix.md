# Facilitator Lesson Save Fix - Quick Guide

## Problem
Clicking "Save" in the facilitator lesson editor doesn't persist changes.

## Root Cause
**Supabase Storage RLS policies only allow `'premium'` tier but not `'lifetime'` tier.**

The application code checks for both tiers, but the database policies only allow premium users to update storage.

## Solution

### Step 1: Run SQL Fix
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Run this script: `scripts/fix-storage-policies-lifetime.sql`

### Step 2: Verify the Fix
1. Open browser DevTools Console (F12)
2. Navigate to Facilitator → Tools → Generated Lessons
3. Edit any lesson and make a change
4. Click "Save Changes"
5. Check console logs:
   - Should see `[UPDATE_LESSON] Upload result: { error: null }`
   - Should NOT see "Policy violation" error

### Step 3: Confirm Persistence
1. Close the editor (it should close automatically on success)
2. Click "Edit" on the same lesson again
3. Verify your changes are still there

## What Changed
All 5 storage policies on the `lessons` bucket now include lifetime users:

```sql
-- Before
AND plan_tier = 'premium'

-- After  
AND plan_tier IN ('premium', 'lifetime')
```

## If Still Not Working
Check the enhanced debug logs in the browser console:
- `[LessonEditor]` - Shows data being collected
- `[SAVE_LESSON]` - Shows API request details
- `[UPDATE_LESSON]` - Shows storage upload result

Common remaining issues:
1. User not authenticated (check `Has token: true` in logs)
2. User tier not premium/lifetime (check profiles table)
3. Trying to edit another user's lesson (check userId matches)

## Files Modified
- `scripts/fix-storage-policies-lifetime.sql` - SQL fix script
- `docs/supabase-storage-setup.md` - Updated policy documentation
- `src/app/api/facilitator/lessons/update/route.js` - Enhanced logging
- `src/app/facilitator/tools/generated/page.js` - Enhanced logging
- `src/components/LessonEditor.jsx` - Enhanced logging
