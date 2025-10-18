-- Add facilitator PIN columns to profiles table
-- Run this in Supabase SQL Editor if the columns don't exist yet

-- Add updated_at column (required by the API)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN updated_at timestamptz DEFAULT now();
        RAISE NOTICE 'Added updated_at column';
    ELSE
        RAISE NOTICE 'updated_at column already exists';
    END IF;
END $$;

-- Add facilitator_pin_hash column (stores hashed PIN)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'facilitator_pin_hash'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN facilitator_pin_hash text;
        RAISE NOTICE 'Added facilitator_pin_hash column';
    ELSE
        RAISE NOTICE 'facilitator_pin_hash column already exists';
    END IF;
END $$;

-- Add facilitator_pin_prefs column (stores PIN gating preferences)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'facilitator_pin_prefs'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN facilitator_pin_prefs jsonb;
        RAISE NOTICE 'Added facilitator_pin_prefs column';
    ELSE
        RAISE NOTICE 'facilitator_pin_prefs column already exists';
    END IF;
END $$;

-- Verify columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name IN ('updated_at', 'facilitator_pin_hash', 'facilitator_pin_prefs')
ORDER BY column_name;
