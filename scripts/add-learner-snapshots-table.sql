-- Create learner_snapshots table for cross-device snapshot persistence
-- Run this in Supabase SQL Editor
--
-- This table is used by /api/snapshots (GET/POST/DELETE) to persist lesson
-- progress snapshots per user + learner + lesson. Required for session
-- takeover (Device B restoring Device A's progress after a handover).

CREATE TABLE IF NOT EXISTS public.learner_snapshots (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id  text        NOT NULL,
  lesson_key  text        NOT NULL,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, learner_id, lesson_key)
);

CREATE INDEX IF NOT EXISTS idx_learner_snapshots_user    ON public.learner_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_snapshots_learner ON public.learner_snapshots(user_id, learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_snapshots_lesson  ON public.learner_snapshots(user_id, learner_id, lesson_key);

-- Enable RLS
ALTER TABLE public.learner_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "learner_snapshots_select_own" ON public.learner_snapshots;
DROP POLICY IF EXISTS "learner_snapshots_insert_own" ON public.learner_snapshots;
DROP POLICY IF EXISTS "learner_snapshots_update_own" ON public.learner_snapshots;
DROP POLICY IF EXISTS "learner_snapshots_delete_own" ON public.learner_snapshots;

CREATE POLICY "learner_snapshots_select_own" ON public.learner_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "learner_snapshots_insert_own" ON public.learner_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "learner_snapshots_update_own" ON public.learner_snapshots
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "learner_snapshots_delete_own" ON public.learner_snapshots
  FOR DELETE USING (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learner_snapshots TO authenticated;
