-- Add slate_settings JSONB column to learners table for Mr. Slate configurable drill parameters
-- Run this once in the Supabase SQL Editor before using the settings overlay.

ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS slate_settings JSONB;
