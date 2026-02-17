-- Adds server-backed device identity and per-subject conversation threads for Mr. Mentor.
--
-- Rationale:
-- - Ownership/takeover is enforced by mentor_sessions (single active row per facilitator).
-- - Conversations must be separate per subject (facilitator vs each learner), and persist across devices.
-- - Device identity must NOT rely on localStorage; the API uses an HttpOnly cookie and stores device_id on mentor_sessions.

-- 1) Add device_id to mentor_sessions (used for ownership checks)
ALTER TABLE public.mentor_sessions
  ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_mentor_sessions_device_id
  ON public.mentor_sessions(device_id);

COMMENT ON COLUMN public.mentor_sessions.device_id IS 'Stable device identifier (from HttpOnly cookie) for ownership checks.';

-- 2) Create mentor_conversation_threads table (one row per facilitator + subject_key)
CREATE TABLE IF NOT EXISTS public.mentor_conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_key TEXT NOT NULL,
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_summary TEXT,
  token_count INT,
  last_local_update_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_mentor_conversation_thread UNIQUE (facilitator_id, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_mentor_conversation_threads_facilitator
  ON public.mentor_conversation_threads(facilitator_id);

CREATE INDEX IF NOT EXISTS idx_mentor_conversation_threads_subject
  ON public.mentor_conversation_threads(subject_key);

-- 3) RLS policies (match mentor_sessions: facilitator-only access)
ALTER TABLE public.mentor_conversation_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own mentor conversation threads" ON public.mentor_conversation_threads;
CREATE POLICY "Users can manage their own mentor conversation threads"
  ON public.mentor_conversation_threads
  FOR ALL
  USING (auth.uid() = facilitator_id)
  WITH CHECK (auth.uid() = facilitator_id);

GRANT ALL ON public.mentor_conversation_threads TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE public.mentor_conversation_threads IS 'Per-subject Mr. Mentor conversations (facilitator + each learner), independent of device ownership.';
COMMENT ON COLUMN public.mentor_conversation_threads.subject_key IS 'Conversation scope key, e.g. facilitator or learner:<uuid>.';

-- 4) Optional: backfill existing single conversation into facilitator thread (best-effort)
-- Inserts a facilitator thread for facilitators that have any mentor_sessions row.
INSERT INTO public.mentor_conversation_threads (facilitator_id, subject_key, conversation_history, draft_summary, token_count, last_local_update_at, last_activity_at)
SELECT
  ms.facilitator_id,
  'facilitator' AS subject_key,
  COALESCE(ms.conversation_history, '[]'::jsonb) AS conversation_history,
  ms.draft_summary,
  ms.token_count,
  ms.last_local_update_at,
  COALESCE(ms.last_activity_at, NOW()) AS last_activity_at
FROM public.mentor_sessions ms
WHERE ms.facilitator_id IS NOT NULL
ON CONFLICT (facilitator_id, subject_key) DO NOTHING;
