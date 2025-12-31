# Supabase Storage Setup for Lesson Generator

## Overview
The lesson generator and management system has been migrated from filesystem storage to Supabase Storage to work in serverless environments like Vercel.

## Required Supabase Storage Bucket

### Create the `lessons` Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the sidebar
3. Click **Create a new bucket**
4. Configure the bucket:
   - **Name**: `lessons`
   - **Public bucket**: Yes (so lessons can be accessed publicly)
   - **File size limit**: 5 MB (lessons are small JSON files)
   - **Allowed MIME types**: `application/json` (optional but recommended)

### Storage Structure

The bucket will use this folder structure:

```
lessons/
├── facilitator-lessons/
│   └── {user_id}/
│       ├── 3rd_Fractions_Intro_beginner.json
│       ├── 4th_Long_Division_Intro_beginner.json
│       └── ... (all generated lessons)
├── math/
│   ├── 3rd_Fractions_Intro_beginner.json (approved)
│   └── ...
├── language arts/
│   └── ...
├── science/
│   └── ...
└── social studies/
    └── ...
```

### Storage Policies (RLS)

Create these policies for the `lessons` bucket:

#### 1. Allow Premium Users to Upload/Update Their Own Lessons
```sql
-- Allow premium/lifetime users to upload to their facilitator folder
CREATE POLICY "Premium users can upload facilitator lessons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lessons' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = 'facilitator-lessons' AND
  (storage.foldername(name))[2] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND plan_tier IN ('premium', 'lifetime')
  )
);

-- Allow premium/lifetime users to update their own lessons
CREATE POLICY "Premium users can update facilitator lessons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'lessons' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = 'facilitator-lessons' AND
  (storage.foldername(name))[2] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND plan_tier IN ('premium', 'lifetime')
  )
);

-- Allow premium/lifetime users to delete their own lessons
CREATE POLICY "Premium users can delete facilitator lessons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lessons' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = 'facilitator-lessons' AND
  (storage.foldername(name))[2] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND plan_tier IN ('premium', 'lifetime')
  )
);
```

#### 2. Allow Premium Users to Approve Lessons (Move to Subject Folders)
```sql
-- Allow premium/lifetime users to upload approved lessons to subject folders
CREATE POLICY "Premium users can approve lessons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lessons' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] IN ('math', 'language arts', 'science', 'social studies') AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND plan_tier IN ('premium', 'lifetime')
  )
);

-- Allow updates to approved lessons
CREATE POLICY "Premium users can update approved lessons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'lessons' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] IN ('math', 'language arts', 'science', 'social studies') AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND plan_tier IN ('premium', 'lifetime')
  )
);
```

#### 3. Allow Public Read Access to Approved Lessons
```sql
-- Allow anyone to read approved lessons (in subject folders)
CREATE POLICY "Public read access to approved lessons"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lessons' AND
  (storage.foldername(name))[1] IN ('math', 'language arts', 'science', 'social studies')
);
```

#### 4. Service Role Access (for listing all facilitator lessons)
The API uses the service role key to list all facilitator lessons across users for admin purposes. No additional policy needed as service role bypasses RLS.

## Environment Variables

Ensure these are set in your Vercel project:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

## API Changes

### Updated Endpoints

1. **`POST /api/facilitator/lessons/generate`**
   - Generates lessons and stores in `facilitator-lessons/{user_id}/`
   - Returns lesson JSON and storage URL
   - Falls back to download if storage fails

2. **`GET /api/facilitator/lessons/list`**
   - Lists all facilitator lessons from Supabase Storage
   - Uses service role to access all user folders
   - Returns metadata including approval status

3. **`POST /api/facilitator/lessons/approve`**
   - Marks lesson as approved
   - Copies to subject-specific folder (`math/`, `science/`, etc.)
   - Updates original with approval flag

4. **`POST /api/facilitator/lessons/delete`**
   - Deletes lesson from `facilitator-lessons/{user_id}/`
   - Uses user's own credentials

5. **`POST /api/facilitator/lessons/request-changes`**
   - Updates existing lesson with AI-assisted changes
   - Marks as needing re-approval if previously approved
   - Stores updated version back to storage

## Testing

1. **Generate a lesson**: Use the Lesson Maker tool to create a new lesson
2. **Verify storage**: Check Supabase Storage dashboard for the file in `facilitator-lessons/{user_id}/`
3. **List lessons**: Visit the Generated Lessons page to see all lessons
4. **Approve lesson**: Click approve to move it to the subject folder
5. **Delete lesson**: Test deletion works correctly

## Migration Notes

- Existing lessons in `public/lessons/` should be manually uploaded to Supabase Storage if needed
- The system no longer writes to the filesystem in production
- Local development will also use Supabase Storage (ensure SUPABASE_SERVICE_ROLE_KEY is set locally)

## Benefits

✅ Works in serverless/read-only environments (Vercel, AWS Lambda, etc.)
✅ User-specific storage with proper permissions
✅ Scalable storage without filesystem limits
✅ Built-in CDN for approved lessons
✅ Easy backup and replication through Supabase
