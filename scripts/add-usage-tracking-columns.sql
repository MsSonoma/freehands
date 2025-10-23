-- Add usage tracking columns to profiles table
-- Run this in Supabase SQL Editor

-- Daily lesson usage tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_lessons_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_lesson_date DATE,
ADD COLUMN IF NOT EXISTS lesson_history JSONB DEFAULT '[]'::jsonb;

-- Lifetime lesson generation tracking (for basic/plus tiers)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS lifetime_generations_used INT DEFAULT 0;

-- Weekly generation tracking (for plus tier)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS weekly_generation_date DATE,
ADD COLUMN IF NOT EXISTS weekly_generations_used INT DEFAULT 0;

-- Mr. Mentor session tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mentor_sessions_used INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS mentor_addon_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mentor_current_session_tokens INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS mentor_session_started_at TIMESTAMPTZ;

-- Comments for documentation
COMMENT ON COLUMN public.profiles.daily_lessons_count IS 'Number of lessons started today';
COMMENT ON COLUMN public.profiles.last_lesson_date IS 'Date of last lesson (for daily reset)';
COMMENT ON COLUMN public.profiles.lesson_history IS 'Array of {date, count} for tracking';
COMMENT ON COLUMN public.profiles.lifetime_generations_used IS 'Total lifetime lesson generations (basic gets 5, plus gets 5)';
COMMENT ON COLUMN public.profiles.weekly_generation_date IS 'Date of last weekly generation reset';
COMMENT ON COLUMN public.profiles.weekly_generations_used IS 'Generations used this week';
COMMENT ON COLUMN public.profiles.mentor_sessions_used IS 'Mr. Mentor sessions used (premium gets 5 free)';
COMMENT ON COLUMN public.profiles.mentor_addon_active IS 'Whether user has Premium+ addon';
COMMENT ON COLUMN public.profiles.mentor_current_session_tokens IS 'Tokens used in current Mr. Mentor session';
COMMENT ON COLUMN public.profiles.mentor_session_started_at IS 'When current Mr. Mentor session started';

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_lesson_date ON public.profiles(last_lesson_date);
CREATE INDEX IF NOT EXISTS idx_profiles_weekly_generation_date ON public.profiles(weekly_generation_date);
