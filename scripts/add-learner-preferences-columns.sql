-- Add session_timer_minutes and humor_level columns to learners table
-- Run this in Supabase SQL Editor

-- Add session_timer_minutes column (tracks session length preference: 60-300 minutes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'learners'
        AND column_name = 'session_timer_minutes'
    ) THEN
        ALTER TABLE public.learners ADD COLUMN session_timer_minutes integer DEFAULT 60;
        RAISE NOTICE 'Added session_timer_minutes column';
    ELSE
        RAISE NOTICE 'session_timer_minutes column already exists';
    END IF;
END $$;

-- Add humor_level column (tracks humor preference: calm, funny, hilarious)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'learners'
        AND column_name = 'humor_level'
    ) THEN
        ALTER TABLE public.learners ADD COLUMN humor_level text DEFAULT 'calm';
        RAISE NOTICE 'Added humor_level column';
    ELSE
        RAISE NOTICE 'humor_level column already exists';
    END IF;
END $$;

-- Backfill null values with defaults
UPDATE public.learners 
SET session_timer_minutes = 60 
WHERE session_timer_minutes IS NULL;

UPDATE public.learners 
SET humor_level = 'calm' 
WHERE humor_level IS NULL;

-- Verify columns were added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'learners'
    AND column_name IN ('session_timer_minutes', 'humor_level')
ORDER BY column_name;
