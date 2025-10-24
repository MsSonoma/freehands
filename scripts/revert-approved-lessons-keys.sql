-- Revert approved_lessons keys from generated/ back to facilitator/
UPDATE learners
SET approved_lessons = (
  SELECT jsonb_object_agg(
    REPLACE(key, 'generated/', 'facilitator/'),
    value
  )
  FROM jsonb_each(approved_lessons)
)
WHERE approved_lessons::text LIKE '%generated/%';

-- Verify
SELECT id, name, approved_lessons
FROM learners
WHERE approved_lessons::text LIKE '%facilitator/%'
LIMIT 5;
