-- Fix mentor_sessions unique constraint to only apply when is_active = TRUE
-- The current constraint applies to ALL rows, including is_active = FALSE
-- This causes errors when trying to deactivate sessions

-- Drop the bad constraint
ALTER TABLE public.mentor_sessions 
  DROP CONSTRAINT IF EXISTS unique_active_session_per_facilitator;

-- Create a partial unique index that only applies when is_active = TRUE
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session_per_facilitator 
  ON public.mentor_sessions(facilitator_id, is_active) 
  WHERE is_active = TRUE;

-- Verify the fix
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.mentor_sessions'::regclass
  AND conname = 'unique_active_session_per_facilitator';

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'mentor_sessions'
  AND indexname = 'unique_active_session_per_facilitator';
