-- Drop unused tables that are flagged by Supabase RLS linter
-- ⚠️ WARNING: This will permanently delete these tables and all their data
-- Only run this if you're certain these tables are not being used

-- BEFORE running this script:
-- 1. Check if these tables have any data: SELECT count(*) FROM public.curriculum_tracks;
-- 2. Check if any code references these tables in your application
-- 3. Make a backup of your database

-- Uncomment the lines below ONLY if you're certain you want to drop these tables:

DROP TABLE IF EXISTS public.curriculum_tracks CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.progress CASCADE;

-- To verify tables are dropped, run:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('curriculum_tracks', 'lessons', 'progress');
