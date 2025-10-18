-- Add golden_keys column to learners table
-- Run this in Supabase SQL Editor

-- Add golden_keys column (tracks number of golden keys earned)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'learners' 
        AND column_name = 'golden_keys'
    ) THEN
        ALTER TABLE public.learners ADD COLUMN golden_keys integer DEFAULT 0 NOT NULL;
        RAISE NOTICE 'Added golden_keys column';
    ELSE
        RAISE NOTICE 'golden_keys column already exists';
    END IF;
END $$;

-- Verify column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'learners' 
    AND column_name = 'golden_keys';
