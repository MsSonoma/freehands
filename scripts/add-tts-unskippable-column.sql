-- Add tts_unskippable column to learners table
-- When true: the TTS skip button is hidden in the session video overlay and the
-- Next Sentence button is disabled while Ms. Sonoma is speaking.
-- Default false so existing learners are unaffected.
ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS tts_unskippable boolean NOT NULL DEFAULT false;
