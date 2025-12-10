-- Add timezone column to profiles table if it doesn't exist
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    -- Check if timezone column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'timezone'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN timezone text;
        RAISE NOTICE 'Added timezone column';
    ELSE
        RAISE NOTICE 'timezone column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'timezone';
