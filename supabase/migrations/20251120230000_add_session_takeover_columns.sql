-- Add session ownership columns to lesson_sessions for gate-based takeover
-- Part of session-takeover.md architecture implementation

-- Add new columns
ALTER TABLE lesson_sessions
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill session_id for existing rows (generate random UUIDs)
UPDATE lesson_sessions
SET session_id = gen_random_uuid()
WHERE session_id IS NULL;

-- Now make session_id NOT NULL
ALTER TABLE lesson_sessions
  ALTER COLUMN session_id SET NOT NULL,
  ALTER COLUMN session_id SET DEFAULT gen_random_uuid();

-- Create unique index to enforce single active session per learner+lesson
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_lesson_session 
  ON lesson_sessions (learner_id, lesson_id) 
  WHERE ended_at IS NULL;

-- Trigger to auto-deactivate old sessions when new one starts
CREATE OR REPLACE FUNCTION deactivate_old_lesson_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting a new active session, close any existing active session for same learner+lesson
  IF NEW.ended_at IS NULL THEN
    UPDATE lesson_sessions
    SET ended_at = NOW()
    WHERE learner_id = NEW.learner_id
      AND lesson_id = NEW.lesson_id
      AND ended_at IS NULL
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_deactivate_old_lesson_sessions ON lesson_sessions;
CREATE TRIGGER auto_deactivate_old_lesson_sessions
  BEFORE INSERT ON lesson_sessions
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_old_lesson_sessions();

-- Add index for conflict detection queries
CREATE INDEX IF NOT EXISTS idx_lesson_sessions_active_lookup
  ON lesson_sessions (learner_id, lesson_id, session_id)
  WHERE ended_at IS NULL;
