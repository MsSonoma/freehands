-- Migration: Add phase timer fields to learners table
-- Date: 2025-11-15
-- Purpose: Support 11 phase-specific timers (5 phases × 2 timer types + golden key bonus)
--
-- Each phase (discussion, comprehension, exercise, worksheet, test) has:
--   - play timer: time from "Begin [Phase]" to "Go" button (for games/exploration)
--   - work timer: time from "Go" to next phase's "Begin" (for actual lesson work)
--
-- Plus one golden_key_bonus_min that adds to all play timers when earned/applied

-- Add phase timer columns to learners table
ALTER TABLE learners
ADD COLUMN IF NOT EXISTS discussion_play_min INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS discussion_work_min INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS comprehension_play_min INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS comprehension_work_min INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS exercise_play_min INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS exercise_work_min INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS worksheet_play_min INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS worksheet_work_min INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS test_play_min INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS test_work_min INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS golden_key_bonus_min INTEGER DEFAULT 5;

-- Add check constraints to ensure timer values are reasonable (1-60 minutes)
ALTER TABLE learners
ADD CONSTRAINT discussion_play_min_range CHECK (discussion_play_min >= 1 AND discussion_play_min <= 60),
ADD CONSTRAINT discussion_work_min_range CHECK (discussion_work_min >= 1 AND discussion_work_min <= 60),
ADD CONSTRAINT comprehension_play_min_range CHECK (comprehension_play_min >= 1 AND comprehension_play_min <= 60),
ADD CONSTRAINT comprehension_work_min_range CHECK (comprehension_work_min >= 1 AND comprehension_work_min <= 60),
ADD CONSTRAINT exercise_play_min_range CHECK (exercise_play_min >= 1 AND exercise_play_min <= 60),
ADD CONSTRAINT exercise_work_min_range CHECK (exercise_work_min >= 1 AND exercise_work_min <= 60),
ADD CONSTRAINT worksheet_play_min_range CHECK (worksheet_play_min >= 1 AND worksheet_play_min <= 60),
ADD CONSTRAINT worksheet_work_min_range CHECK (worksheet_work_min >= 1 AND worksheet_work_min <= 60),
ADD CONSTRAINT test_play_min_range CHECK (test_play_min >= 1 AND test_play_min <= 60),
ADD CONSTRAINT test_work_min_range CHECK (test_work_min >= 1 AND test_work_min <= 60),
ADD CONSTRAINT golden_key_bonus_min_range CHECK (golden_key_bonus_min >= 1 AND golden_key_bonus_min <= 60);

-- Add comment documenting the phase timer system
COMMENT ON COLUMN learners.discussion_play_min IS 'Play time in minutes for Discussion phase (Begin → Go button)';
COMMENT ON COLUMN learners.discussion_work_min IS 'Work time in minutes for Discussion phase (Go → next Begin)';
COMMENT ON COLUMN learners.comprehension_play_min IS 'Play time in minutes for Comprehension phase (Begin → Go button)';
COMMENT ON COLUMN learners.comprehension_work_min IS 'Work time in minutes for Comprehension phase (Go → next Begin)';
COMMENT ON COLUMN learners.exercise_play_min IS 'Play time in minutes for Exercise phase (Begin → Go button)';
COMMENT ON COLUMN learners.exercise_work_min IS 'Work time in minutes for Exercise phase (Go → next Begin)';
COMMENT ON COLUMN learners.worksheet_play_min IS 'Play time in minutes for Worksheet phase (Begin → Go button)';
COMMENT ON COLUMN learners.worksheet_work_min IS 'Work time in minutes for Worksheet phase (Go → next Begin)';
COMMENT ON COLUMN learners.test_play_min IS 'Play time in minutes for Test phase (Begin → Go button)';
COMMENT ON COLUMN learners.test_work_min IS 'Work time in minutes for Test phase (Go → next Begin)';
COMMENT ON COLUMN learners.golden_key_bonus_min IS 'Bonus minutes added to all play timers when golden key is earned/applied';

-- Rollback script (if needed)
-- ALTER TABLE learners
-- DROP COLUMN IF EXISTS discussion_play_min,
-- DROP COLUMN IF EXISTS discussion_work_min,
-- DROP COLUMN IF EXISTS comprehension_play_min,
-- DROP COLUMN IF EXISTS comprehension_work_min,
-- DROP COLUMN IF EXISTS exercise_play_min,
-- DROP COLUMN IF EXISTS exercise_work_min,
-- DROP COLUMN IF EXISTS worksheet_play_min,
-- DROP COLUMN IF EXISTS worksheet_work_min,
-- DROP COLUMN IF EXISTS test_play_min,
-- DROP COLUMN IF EXISTS test_work_min,
-- DROP COLUMN IF EXISTS golden_key_bonus_min;
