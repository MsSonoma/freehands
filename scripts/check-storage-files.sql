-- Check what files actually exist in storage

-- Files in the OLD path (facilitator-lessons)
SELECT 
  name,
  created_at,
  updated_at
FROM storage.objects
WHERE bucket_id = 'lessons'
  AND name LIKE 'facilitator-lessons/%'
ORDER BY name;

-- Files in the NEW path (generated-lessons)
SELECT 
  name,
  created_at,
  updated_at
FROM storage.objects
WHERE bucket_id = 'lessons'
  AND name LIKE 'generated-lessons/%'
ORDER BY name;

-- Count by path
SELECT 
  CASE 
    WHEN name LIKE 'facilitator-lessons/%' THEN 'facilitator-lessons'
    WHEN name LIKE 'generated-lessons/%' THEN 'generated-lessons'
    ELSE 'other'
  END as path_type,
  COUNT(*) as file_count
FROM storage.objects
WHERE bucket_id = 'lessons'
  AND (name LIKE 'facilitator-lessons/%' OR name LIKE 'generated-lessons/%')
GROUP BY path_type;
