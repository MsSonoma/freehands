-- Fix storage policies for generated-lessons to work with service role signed URLs

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own generated-lessons" ON storage.objects;

-- Create new SELECT policy that allows:
-- 1. Users to read their own files
-- 2. Service role to create signed URLs for any file
CREATE POLICY "Users can read own generated-lessons"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lessons' AND
  (storage.foldername(name))[1] = 'generated-lessons' AND
  (
    -- Regular users can only see their own folder
    ((storage.foldername(name))[2] = auth.uid()::text AND auth.role() = 'authenticated')
    OR
    -- Service role can access any file (for signed URLs)
    auth.role() = 'service_role'
  )
);

-- Verification: Check the policy exists
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname = 'Users can read own generated-lessons';
