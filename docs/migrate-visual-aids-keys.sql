-- Migration: Normalize existing visual_aids lesson_key values
-- Strips folder prefixes (generated/, facilitator/, math/, etc.) from lesson_key column
-- Run this once in Supabase SQL Editor to fix existing data

UPDATE visual_aids
SET lesson_key = regexp_replace(lesson_key, '^(generated|facilitator|math|science|language-arts|social-studies|demo)/', '')
WHERE lesson_key ~ '^(generated|facilitator|math|science|language-arts|social-studies|demo)/';

-- Verify the update
SELECT id, facilitator_id, lesson_key, created_at 
FROM visual_aids 
ORDER BY created_at DESC;
