-- Add approved_lessons column to learners table
-- This stores which lessons are approved for each learner as a JSONB object
-- Format: { "subject/lesson_file": true, "math/lesson_name": true, ... }

ALTER TABLE public.learners 
ADD COLUMN IF NOT EXISTS approved_lessons JSONB;

-- Optional: Set default empty object for existing rows
UPDATE public.learners 
SET approved_lessons = '{}'::jsonb 
WHERE approved_lessons IS NULL;
