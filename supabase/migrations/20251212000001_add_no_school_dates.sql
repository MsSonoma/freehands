-- Add no_school_dates table for blocking dates
CREATE TABLE IF NOT EXISTS public.no_school_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(facilitator_id, learner_id, date)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_no_school_dates_facilitator_learner_date
  ON public.no_school_dates(facilitator_id, learner_id, date);

-- Enable RLS
ALTER TABLE public.no_school_dates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own no-school dates"
  ON public.no_school_dates FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Users can create their own no-school dates"
  ON public.no_school_dates FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Users can update their own no-school dates"
  ON public.no_school_dates FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Users can delete their own no-school dates"
  ON public.no_school_dates FOR DELETE
  USING (auth.uid() = facilitator_id);
