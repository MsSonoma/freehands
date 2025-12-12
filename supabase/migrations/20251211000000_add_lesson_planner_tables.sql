-- Add custom subjects table for facilitator-defined subjects
CREATE TABLE IF NOT EXISTS public.custom_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int DEFAULT 999,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(facilitator_id, name)
);

-- Add curriculum preferences table (learner-specific)
CREATE TABLE IF NOT EXISTS public.curriculum_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  
  -- Content filtering arrays
  banned_words text[] DEFAULT '{}',
  banned_topics text[] DEFAULT '{}',
  focus_topics text[] DEFAULT '{}',
  focus_keywords text[] DEFAULT '{}',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(facilitator_id, learner_id)
);

-- Add schedule templates table for weekly patterns
CREATE TABLE IF NOT EXISTS public.schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id uuid REFERENCES public.learners(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  description text,
  
  -- Pattern definition (JSONB)
  -- Format: { "monday": [{"subject": "math"}, {"subject": "science"}], "tuesday": [...], ... }
  pattern jsonb NOT NULL DEFAULT '{}',
  
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_subjects_facilitator 
  ON public.custom_subjects(facilitator_id);

CREATE INDEX IF NOT EXISTS idx_curriculum_preferences_facilitator_learner 
  ON public.curriculum_preferences(facilitator_id, learner_id);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_facilitator 
  ON public.schedule_templates(facilitator_id);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_learner 
  ON public.schedule_templates(learner_id);

-- Enable RLS
ALTER TABLE public.custom_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_subjects
CREATE POLICY "Facilitators can view their own custom subjects"
  ON public.custom_subjects FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own custom subjects"
  ON public.custom_subjects FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their own custom subjects"
  ON public.custom_subjects FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own custom subjects"
  ON public.custom_subjects FOR DELETE
  USING (auth.uid() = facilitator_id);

-- RLS Policies for curriculum_preferences
CREATE POLICY "Facilitators can view their own curriculum preferences"
  ON public.curriculum_preferences FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own curriculum preferences"
  ON public.curriculum_preferences FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their own curriculum preferences"
  ON public.curriculum_preferences FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own curriculum preferences"
  ON public.curriculum_preferences FOR DELETE
  USING (auth.uid() = facilitator_id);

-- RLS Policies for schedule_templates
CREATE POLICY "Facilitators can view their own schedule templates"
  ON public.schedule_templates FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own schedule templates"
  ON public.schedule_templates FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their own schedule templates"
  ON public.schedule_templates FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own schedule templates"
  ON public.schedule_templates FOR DELETE
  USING (auth.uid() = facilitator_id);
