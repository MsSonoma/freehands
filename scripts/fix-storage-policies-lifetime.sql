-- Fix Supabase Storage Policies to Support Lifetime Tier
-- 
-- PROBLEM: The storage policies only allow 'premium' tier, but the code checks for both 'premium' AND 'lifetime'.
-- This causes lesson save failures for lifetime users because the RLS policy blocks the storage upload.
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- ========================================
-- DROP OLD POLICIES
-- ========================================

-- Drop facilitator lesson policies
DROP POLICY IF EXISTS "Premium users can upload facilitator lessons" ON storage.objects;
DROP POLICY IF EXISTS "Premium users can update facilitator lessons" ON storage.objects;
DROP POLICY IF EXISTS "Premium users can delete facilitator lessons" ON storage.objects;

-- Drop approved lesson policies
DROP POLICY IF EXISTS "Premium users can approve lessons" ON storage.objects;
DROP POLICY IF EXISTS "Premium users can update approved lessons" ON storage.objects;

-- ========================================
-- CREATE UPDATED POLICIES
-- ========================================

-- 1. Allow premium/lifetime users to upload to their facilitator folder
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

-- 2. Allow premium/lifetime users to update their own lessons
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
)
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

-- 3. Allow premium/lifetime users to delete their own lessons
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

-- 4. Allow premium/lifetime users to upload approved lessons to subject folders
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

-- 5. Allow premium/lifetime users to update approved lessons
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
)
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

-- ========================================
-- VERIFY POLICIES
-- ========================================

-- List all policies on storage.objects for the lessons bucket
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%lesson%'
ORDER BY policyname;
