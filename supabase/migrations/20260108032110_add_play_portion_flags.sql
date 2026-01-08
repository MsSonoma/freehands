-- Per-learner play-portion toggles for phases 2-5 (Comprehension/Exercise/Worksheet/Test)
-- When false, Begin should skip play-time (opening actions + play timer) and enter work immediately.

ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS play_comprehension_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS play_exercise_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS play_worksheet_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS play_test_enabled boolean NOT NULL DEFAULT true;
