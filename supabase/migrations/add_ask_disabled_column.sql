-- Add ask_disabled column to learners table
-- This allows facilitators to disable the Ask feature per learner

ALTER TABLE learners 
ADD COLUMN IF NOT EXISTS ask_disabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN learners.ask_disabled IS 'When true, the Ask feature button is disabled for this learner in all sessions';
