-- Add lesson_schedule table for calendar-based lesson scheduling
-- Run this in Supabase SQL Editor

-- Create lesson_schedule table
CREATE TABLE IF NOT EXISTS public.lesson_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  lesson_key text NOT NULL, -- Format: 'subject/lesson_file' e.g. 'math/Addition_Basics.json'
  scheduled_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent duplicate lesson on same date for same learner
  UNIQUE(learner_id, lesson_key, scheduled_date)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_lesson_schedule_facilitator ON public.lesson_schedule(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_lesson_schedule_learner ON public.lesson_schedule(learner_id);
CREATE INDEX IF NOT EXISTS idx_lesson_schedule_date ON public.lesson_schedule(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_lesson_schedule_learner_date ON public.lesson_schedule(learner_id, scheduled_date);

-- Enable RLS
ALTER TABLE public.lesson_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Facilitators can only manage their own learners' schedules
DROP POLICY IF EXISTS "lesson_schedule_select_own" ON public.lesson_schedule;
DROP POLICY IF EXISTS "lesson_schedule_insert_own" ON public.lesson_schedule;
DROP POLICY IF EXISTS "lesson_schedule_update_own" ON public.lesson_schedule;
DROP POLICY IF EXISTS "lesson_schedule_delete_own" ON public.lesson_schedule;

CREATE POLICY "lesson_schedule_select_own" ON public.lesson_schedule
  FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "lesson_schedule_insert_own" ON public.lesson_schedule
  FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "lesson_schedule_update_own" ON public.lesson_schedule
  FOR UPDATE
  USING (auth.uid() = facilitator_id)
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "lesson_schedule_delete_own" ON public.lesson_schedule
  FOR DELETE
  USING (auth.uid() = facilitator_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lesson_schedule TO authenticated;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_lesson_schedule_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_lesson_schedule_timestamp ON public.lesson_schedule;
CREATE TRIGGER update_lesson_schedule_timestamp
  BEFORE UPDATE ON public.lesson_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lesson_schedule_timestamp();

-- Verify table was created
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'lesson_schedule'
ORDER BY ordinal_position;
