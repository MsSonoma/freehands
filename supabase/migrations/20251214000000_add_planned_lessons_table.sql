-- Add planned_lessons table to persist generated lesson plans
CREATE TABLE IF NOT EXISTS public.planned_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  
  -- Lesson outline data (JSONB)
  -- Format: { "id": "...", "title": "...", "subject": "...", "grade": "...", "difficulty": "...", "description": "...", etc }
  lesson_data jsonb NOT NULL,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One facilitator can have multiple planned lessons for same learner/date (different subjects)
  -- But prevent exact duplicates
  UNIQUE(facilitator_id, learner_id, scheduled_date, lesson_data)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_planned_lessons_facilitator_learner 
  ON public.planned_lessons(facilitator_id, learner_id);

CREATE INDEX IF NOT EXISTS idx_planned_lessons_date 
  ON public.planned_lessons(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_planned_lessons_facilitator_learner_date 
  ON public.planned_lessons(facilitator_id, learner_id, scheduled_date);

-- Enable RLS
ALTER TABLE public.planned_lessons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for planned_lessons
CREATE POLICY "Facilitators can view their own planned lessons"
  ON public.planned_lessons FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own planned lessons"
  ON public.planned_lessons FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their own planned lessons"
  ON public.planned_lessons FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own planned lessons"
  ON public.planned_lessons FOR DELETE
  USING (auth.uid() = facilitator_id);
