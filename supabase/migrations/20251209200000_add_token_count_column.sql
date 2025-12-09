-- Add token_count column to mentor_sessions for conversation length tracking
-- Used to prevent conversations from getting too long and enforce turn limits

ALTER TABLE mentor_sessions
ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0;

-- Backfill existing rows
UPDATE mentor_sessions
SET token_count = 0
WHERE token_count IS NULL;

COMMENT ON COLUMN mentor_sessions.token_count IS 'Cumulative token count for conversation length tracking and turn limit enforcement';
