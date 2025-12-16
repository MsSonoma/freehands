-- Add auto_advance_phases column to learners table
-- When false, automatically advance through phase transitions (skip Begin buttons after initial start)
-- Default true maintains current behavior (show Begin buttons)

ALTER TABLE learners
ADD COLUMN IF NOT EXISTS auto_advance_phases BOOLEAN DEFAULT true;

COMMENT ON COLUMN learners.auto_advance_phases IS 'When false, auto-click Begin buttons at phase transitions (prevents stalling). Initial lesson Begin always shows.';
