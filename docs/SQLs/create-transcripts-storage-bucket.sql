-- Create transcripts storage bucket and RLS policies
-- Run this once in the Supabase SQL Editor (idempotent — safe to re-run).
--
-- Storage path format: v1/{ownerId}/{learnerId}/{lessonId}/...
--   Sonoma  → v1/{ownerId}/{learnerId}/{lessonId}/
--   Webb    → v1/{ownerId}/{learnerId}/webb/{lessonId}/
--   Slate   → v1/{ownerId}/{learnerId}/slate/{lessonId}/
--
-- {ownerId} = auth.users.id of the logged-in facilitator.

-- ── 1) Bucket ──────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('transcripts', 'transcripts', false)
ON CONFLICT (id) DO NOTHING;

-- ── 2) Helper: extract ownerId (position 2 in "v1/{ownerId}/…") ────────────

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

-- ── 3) Policies ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "transcripts upsert own subtree"    ON storage.objects;
DROP POLICY IF EXISTS "transcripts update own subtree"    ON storage.objects;
DROP POLICY IF EXISTS "transcripts read own subtree"      ON storage.objects;
DROP POLICY IF EXISTS "transcripts no delete via client"  ON storage.objects;

-- INSERT: authenticated user may write only into their own ownerId sub-tree.
CREATE POLICY "transcripts upsert own subtree"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'transcripts'
  AND public.transcripts_owner_id_from_path(name) = auth.uid()
);

-- UPDATE: same restriction for upsert (the upsert: true flag triggers UPDATE).
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

-- SELECT: authenticated user may read only their own sub-tree.
-- Note: the API route uses the service-role key (bypasses RLS) when
-- SUPABASE_SERVICE_ROLE_KEY is set in Vercel — this policy covers the
-- fallback case where the service-role key is absent.
CREATE POLICY "transcripts read own subtree"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'transcripts'
  AND public.transcripts_owner_id_from_path(name) = auth.uid()
);

-- DELETE: block client-side deletes (cleanup script uses service-role key).
CREATE POLICY "transcripts no delete via client"
ON storage.objects
FOR DELETE
TO authenticated
USING (false);
