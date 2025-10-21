-- Add active_golden_keys column to learners table
-- Run this in Supabase SQL Editor

-- Add active_golden_keys column (tracks which lessons have active golden keys)
-- Format: { "subject/lesson_file": true, ... }
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'learners' 
        AND column_name = 'active_golden_keys'
    ) THEN
        ALTER TABLE public.learners ADD COLUMN active_golden_keys jsonb DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added active_golden_keys column';
    ELSE
        RAISE NOTICE 'active_golden_keys column already exists';
    END IF;
END $$;

-- Update existing rows to have empty object if NULL
UPDATE public.learners 
SET active_golden_keys = '{}'::jsonb 
WHERE active_golden_keys IS NULL;

-- Verify column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'learners' 
    AND column_name = 'active_golden_keys';
