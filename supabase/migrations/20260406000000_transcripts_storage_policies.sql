-- Migration: Transcripts Storage bucket + RLS policies
-- Why: Sessions (Sonoma V2, Mrs. Webb, Mr. Slate) upload transcripts to
--      the 'transcripts' Supabase Storage bucket.  Without the INSERT policy,
--      every upload fails with 403 "new row violates row-level security policy",
--      leaving the bucket empty and the Learner Transcripts page blank.
--
-- Storage path format:
--   Sonoma  → transcripts/v1/{ownerId}/{learnerId}/{lessonId}/transcript.{ext}
--   Webb    → transcripts/v1/{ownerId}/{learnerId}/webb/{lessonId}/transcript.{ext}
--   Slate   → transcripts/v1/{ownerId}/{learnerId}/slate/{lessonId}/transcript.{ext}
--
-- {ownerId} = auth.users.id of the logged-in facilitator (same user who runs sessions).
--
-- Apply: paste into Supabase SQL Editor, or run via `supabase db push`.

-- 1) Ensure the bucket exists (private).
INSERT INTO storage.buckets (id, name, public)
VALUES ('transcripts', 'transcripts', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Helper function: extract ownerId from path segment 2 (after "v1/").
CREATE OR REPLACE FUNCTION public.transcripts_owner_id_from_path(path text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  part text;
BEGIN
  part := split_part(path, '/', 2);
  BEGIN
    RETURN part::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

-- 3) Drop + recreate policies (idempotent).
DROP POLICY IF EXISTS "transcripts upsert own subtree"    ON storage.objects;
DROP POLICY IF EXISTS "transcripts update own subtree"    ON storage.objects;
DROP POLICY IF EXISTS "transcripts read own subtree"      ON storage.objects;
DROP POLICY IF EXISTS "transcripts no delete via client"  ON storage.objects;

CREATE POLICY "transcripts upsert own subtree"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'transcripts'
  AND public.transcripts_owner_id_from_path(name) = auth.uid()
);

CREATE POLICY "transcripts update own subtree"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'transcripts'
  AND public.transcripts_owner_id_from_path(name) = auth.uid()
)
WITH CHECK (
  bucket_id = 'transcripts'
  AND public.transcripts_owner_id_from_path(name) = auth.uid()
);

CREATE POLICY "transcripts read own subtree"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'transcripts'
  AND public.transcripts_owner_id_from_path(name) = auth.uid()
);

CREATE POLICY "transcripts no delete via client"
ON storage.objects
FOR DELETE
TO authenticated
USING (false);
