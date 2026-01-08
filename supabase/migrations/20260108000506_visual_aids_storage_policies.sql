-- Migration: Visual Aids Storage bucket + RLS policies
-- Why: /api/visual-aids/save uploads to Supabase Storage bucket `visual-aids`.
--      If policies are missing, uploads fail with: "new row violates row-level security policy" (403).
--
-- Bucket: visual-aids
-- Object path format (server uploads): <auth.uid()>/<sanitized_lesson_key>/<image_id>.png
--
-- Apply via Supabase migrations or run in Supabase SQL editor.

-- 1) Ensure the bucket exists and is public-read.
INSERT INTO storage.buckets (id, name, public)
VALUES ('visual-aids', 'visual-aids', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2) Storage object policies.
-- NOTE: policy names must be stable for DROP IF EXISTS to work.

DROP POLICY IF EXISTS "Anyone can read visual aids" ON storage.objects;
DROP POLICY IF EXISTS "Facilitators can upload visual aids" ON storage.objects;
DROP POLICY IF EXISTS "Facilitators can update their visual aids" ON storage.objects;
DROP POLICY IF EXISTS "Facilitators can delete their visual aids" ON storage.objects;

-- Public read (bucket is public, and policy enables SELECT under RLS)
CREATE POLICY "Anyone can read visual aids"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'visual-aids'
);

-- Authenticated users can insert only into their own top-level folder.
CREATE POLICY "Facilitators can upload visual aids"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'visual-aids'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update only within their own top-level folder.
CREATE POLICY "Facilitators can update their visual aids"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'visual-aids'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'visual-aids'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete only within their own top-level folder.
CREATE POLICY "Facilitators can delete their visual aids"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'visual-aids'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);
