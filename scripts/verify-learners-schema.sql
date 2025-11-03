-- Verify learners table schema
-- Run this in Supabase SQL Editor to check what columns exist

SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'learners'
ORDER BY ordinal_position;
