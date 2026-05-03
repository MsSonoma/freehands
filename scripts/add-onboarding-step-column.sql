-- Add onboarding_step column to profiles table.
-- Run this once in the Supabase SQL editor.
-- 0 = not started, 1-4 = in-progress steps, 5 = complete.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;
