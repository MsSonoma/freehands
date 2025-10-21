# Facilitator Lesson Save Debug Guide

## Issue
When editing a facilitator-generated lesson and clicking Save, the changes don't persist to Supabase storage.

## ROOT CAUSE IDENTIFIED ✓

**The Supabase Storage RLS policies only allow `plan_tier = 'premium'` but the code checks for both `'premium'` AND `'lifetime'`.**

This means:
- Premium users ✓ Can save (policy allows)
- Lifetime users ✗ Cannot save (policy blocks with "Policy violation")

### Fix Required
Run the SQL script to update the storage policies:
```bash
# Open Supabase SQL Editor and run:
scripts/fix-storage-policies-lifetime.sql
```

The policies need to be changed from:
```sql
plan_tier = 'premium'
```

To:
```sql
plan_tier IN ('premium', 'lifetime')
```

This affects 5 policies:
1. Upload facilitator lessons
2. Update facilitator lessons  
3. Delete facilitator lessons
4. Approve lessons (copy to subject folders)
5. Update approved lessons

---

## Code Flow (for reference)
1. **LessonEditor Component** (`src/components/LessonEditor.jsx`)
   - User edits lesson in form
   - Clicks "Save Changes" button
   - `handleSave()` validates and cleans the lesson data
   - Calls `onSave(cleanedLesson)` prop

2. **Generated Lessons Page** (`src/app/facilitator/tools/generated/page.js`)
   - `handleSaveLesson(updatedLesson)` receives the cleaned lesson
   - Fetches auth token from Supabase
   - Makes PUT request to `/api/facilitator/lessons/update`
   - Payload includes: `{ file, userId, lesson }`

3. **Update API Route** (`src/app/api/facilitator/lessons/update/route.js`)
   - Authenticates user from Bearer token
   - Checks premium status (must be premium or lifetime)
   - Verifies ownership (userId must match authenticated user)
   - Uploads JSON to Supabase Storage at `facilitator-lessons/{userId}/{file}`
   - Uses `upsert: true` to overwrite existing file

## Enhanced Logging Added

### Frontend (LessonEditor)
```javascript
console.log('[LessonEditor] handleSave called')
console.log('[LessonEditor] Current lesson state:', ...)
console.log('[LessonEditor] Cleaned lesson data:', ...)
console.log('[LessonEditor] Calling onSave with cleaned lesson')
```

### Frontend (Generated Page)
```javascript
console.log('[SAVE_LESSON] Editing lesson context:', { file, userId })
console.log('[SAVE_LESSON] Updated lesson data:', ...)
console.log('[SAVE_LESSON] Has token:', !!token)
console.log('[SAVE_LESSON] Sending payload to /api/facilitator/lessons/update')
console.log('[SAVE_LESSON] Response:', { status, ok, body })
```

### Backend (API Route)
```javascript
console.log('[UPDATE_LESSON] Storage path:', storagePath)
console.log('[UPDATE_LESSON] Lesson content preview:', ...)
console.log('[UPDATE_LESSON] Using storage client:', admin ? 'admin' : 'user')
console.log('[UPDATE_LESSON] Upload result:', { data, error })
```

## Testing Steps

1. Open browser DevTools Console (F12)
2. Navigate to Facilitator → Tools → Generated Lessons
3. Click "Edit" on any lesson
4. Make a small change (e.g., edit the title)
5. Click "Save Changes"
6. Observe console output for the three log groups above

## What to Look For

### Success Case
- All logs appear in order
- `[UPDATE_LESSON] Upload result:` shows `error: null`
- Response status is 200
- Editor closes and list refreshes
- Re-opening the lesson shows your changes

### Failure Cases

#### Authentication Issue
- Log shows "Has token: false"
- API returns 401 Unauthorized
- **Fix**: Check Supabase session state

#### Permission Issue
- API returns 403 Forbidden
- Log shows tier is not premium/lifetime
- **Fix**: Verify user's plan_tier in profiles table

#### Storage Upload Error
- `[UPDATE_LESSON] Upload result:` shows an error object
- Common errors:
  - `"Policy violation"` - Storage policy doesn't allow updates
  - `"Object not found"` - File doesn't exist and can't be created
- **Fix**: Check Supabase Storage policies for `lessons` bucket

#### Ownership Mismatch
- `targetUserId !== user.id`
- API returns 403 "Cannot edit another facilitator's lesson"
- **Fix**: Verify the userId passed matches the authenticated user

## Storage Policy Check

The storage path is: `facilitator-lessons/{userId}/{filename}.json`

Required policies on `lessons` bucket:
- **UPDATE** policy allowing authenticated users to update files in their own folder
- **INSERT** policy allowing authenticated users to create files in their own folder (for upsert)

Example policy (RLS):
```sql
-- Allow users to update their own facilitator lessons
CREATE POLICY "Users can update own facilitator lessons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'lessons' 
  AND (storage.foldername(name))[1] = 'facilitator-lessons'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'lessons'
  AND (storage.foldername(name))[1] = 'facilitator-lessons'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to insert (upsert) their own facilitator lessons
CREATE POLICY "Users can insert own facilitator lessons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lessons'
  AND (storage.foldername(name))[1] = 'facilitator-lessons'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
```

## Next Steps
1. Test with the enhanced logging
2. Share console output if issue persists
3. Check Supabase Storage policies if upload fails
4. Verify user authentication and plan tier
