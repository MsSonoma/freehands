-- Migration: Portfolios Storage bucket + RLS policies
-- Why: Generated portfolios must be viewable by reviewers not logged in.
--      We store portfolio HTML + copied artifacts (e.g., scans) in a public-read bucket.
--
-- Bucket: portfolios (public read)
-- Object path format: <auth.uid()>/<learnerId>/<portfolioId>/...

-- 1) Ensure the bucket exists and is public-read.
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolios', 'portfolios', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2) Storage object policies.
DROP POLICY IF EXISTS "Anyone can read portfolios" ON storage.objects;
DROP POLICY IF EXISTS "Facilitators can upload portfolios" ON storage.objects;
DROP POLICY IF EXISTS "Facilitators can update their portfolios" ON storage.objects;
DROP POLICY IF EXISTS "Facilitators can delete their portfolios" ON storage.objects;

-- Public read (bucket is public, and policy enables SELECT under RLS)
CREATE POLICY "Anyone can read portfolios"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'portfolios'
);

-- Authenticated users can insert only into their own top-level folder.
CREATE POLICY "Facilitators can upload portfolios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portfolios'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update only within their own top-level folder.
CREATE POLICY "Facilitators can update their portfolios"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portfolios'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'portfolios'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete only within their own top-level folder.
CREATE POLICY "Facilitators can delete their portfolios"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'portfolios'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);
