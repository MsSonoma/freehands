-- Migration script: Rename "facilitator-lessons" to "generated-lessons"
-- This updates storage paths, policies, and any database references

-- =============================================================================
-- STEP 1: Update Storage Policies
-- =============================================================================

-- Drop existing policies for facilitator-lessons
DROP POLICY IF EXISTS "Users can upload to own facilitator-lessons folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own facilitator-lessons" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own facilitator-lessons" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own facilitator-lessons" ON storage.objects;

-- Drop and recreate policies for generated-lessons to ensure clean state
DROP POLICY IF EXISTS "Users can upload to own generated-lessons folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own generated-lessons" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own generated-lessons" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own generated-lessons" ON storage.objects;

-- Create new policies for generated-lessons
CREATE POLICY "Users can upload to own generated-lessons folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lessons' AND
  (storage.foldername(name))[1] = 'generated-lessons' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can read own generated-lessons"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lessons' AND
  (storage.foldername(name))[1] = 'generated-lessons' AND
  ((storage.foldername(name))[2] = auth.uid()::text OR auth.jwt()->>'role' = 'service_role')
);

CREATE POLICY "Users can update own generated-lessons"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lessons' AND
  (storage.foldername(name))[1] = 'generated-lessons' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete own generated-lessons"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lessons' AND
  (storage.foldername(name))[1] = 'generated-lessons' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- =============================================================================
-- STEP 2: Migrate Storage Files (rename paths in storage.objects)
-- =============================================================================

-- Update all file paths from facilitator-lessons/* to generated-lessons/*
UPDATE storage.objects
SET name = REPLACE(name, 'facilitator-lessons/', 'generated-lessons/')
WHERE bucket_id = 'lessons'
  AND name LIKE 'facilitator-lessons/%';

-- =============================================================================
-- STEP 3: Update any database columns that might reference the subject
-- =============================================================================

-- Update learners.approved_lessons if it contains facilitator/* paths
-- approved_lessons is a JSONB object like {"facilitator/lesson.json": true}
UPDATE learners
SET approved_lessons = (
  SELECT jsonb_object_agg(
    REPLACE(key, 'facilitator/', 'generated/'),
    value
  )
  FROM jsonb_each(approved_lessons)
)
WHERE approved_lessons::text LIKE '%facilitator/%';

-- Update lesson_calendar if it references facilitator lessons (skip if table doesn't exist)
-- UPDATE lesson_calendar
-- SET lesson_key = REPLACE(lesson_key, 'facilitator/', 'generated/')
-- WHERE lesson_key LIKE 'facilitator/%';

-- =============================================================================
-- STEP 4: Verification Queries (run these after migration)
-- =============================================================================

-- Count files in old path (should be 0)
SELECT COUNT(*) as old_path_count
FROM storage.objects
WHERE bucket_id = 'lessons'
  AND name LIKE 'facilitator-lessons/%';

-- Count files in new path (should match previous total)
SELECT COUNT(*) as new_path_count
FROM storage.objects
WHERE bucket_id = 'lessons'
  AND name LIKE 'generated-lessons/%';

-- Check for any remaining facilitator references in approved_lessons
SELECT id, name, approved_lessons
FROM learners
WHERE approved_lessons::text LIKE '%facilitator/%';

-- Check for any remaining facilitator references in lesson_calendar (skip if table doesn't exist)
-- SELECT *
-- FROM lesson_calendar
-- WHERE lesson_key LIKE 'facilitator/%';

-- =============================================================================
-- ROLLBACK (in case of issues - run these manually if needed)
-- =============================================================================

-- To rollback storage paths:
-- UPDATE storage.objects
-- SET name = REPLACE(name, 'generated-lessons/', 'facilitator-lessons/')
-- WHERE bucket_id = 'lessons'
--   AND name LIKE 'generated-lessons/%';

-- To rollback approved_lessons:
-- UPDATE learners
-- SET approved_lessons = (
--   SELECT jsonb_object_agg(
--     REPLACE(key, 'generated/', 'facilitator/'),
--     value
--   )
--   FROM jsonb_each(approved_lessons)
-- )
-- WHERE approved_lessons::text LIKE '%generated/%';

-- To rollback lesson_calendar (skip if table doesn't exist):
-- UPDATE lesson_calendar
-- SET lesson_key = REPLACE(lesson_key, 'generated/', 'facilitator/')
-- WHERE lesson_key LIKE 'generated/%';
