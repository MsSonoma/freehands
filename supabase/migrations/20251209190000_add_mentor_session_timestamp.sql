-- Add last_local_update_at column to mentor_sessions for atomic gate
-- This timestamp tracks when the client last updated the conversation
-- Used to prevent stale database data from overwriting fresh local conversations

ALTER TABLE mentor_sessions
ADD COLUMN IF NOT EXISTS last_local_update_at TIMESTAMPTZ;

-- Set default to current timestamp for existing rows
UPDATE mentor_sessions
SET last_local_update_at = last_activity_at
WHERE last_local_update_at IS NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN mentor_sessions.last_local_update_at IS 'Client-side timestamp of last conversation update. Used by atomic gate to prevent stale overwrites during device takeover.';
