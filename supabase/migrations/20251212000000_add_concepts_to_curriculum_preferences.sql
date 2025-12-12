-- Add banned_concepts and focus_concepts columns to curriculum_preferences
ALTER TABLE public.curriculum_preferences 
  ADD COLUMN IF NOT EXISTS banned_concepts text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS focus_concepts text[] DEFAULT '{}';
