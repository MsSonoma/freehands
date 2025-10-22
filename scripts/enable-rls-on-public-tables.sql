-- Enable Row Level Security on public tables flagged by Supabase linter
-- Run this in Supabase SQL Editor

-- 1. Enable RLS on curriculum_tracks table
DO $$ 
BEGIN
    -- Check if table exists before enabling RLS
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'curriculum_tracks'
    ) THEN
        ALTER TABLE public.curriculum_tracks ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if any
        DROP POLICY IF EXISTS "curriculum_tracks_select_all" ON public.curriculum_tracks;
        DROP POLICY IF EXISTS "curriculum_tracks_insert_auth" ON public.curriculum_tracks;
        DROP POLICY IF EXISTS "curriculum_tracks_update_auth" ON public.curriculum_tracks;
        DROP POLICY IF EXISTS "curriculum_tracks_delete_auth" ON public.curriculum_tracks;
        
        -- Allow authenticated users to read all curriculum tracks
        CREATE POLICY "curriculum_tracks_select_all" ON public.curriculum_tracks
            FOR SELECT
            USING (true);
        
        -- Only authenticated users can insert/update/delete
        CREATE POLICY "curriculum_tracks_insert_auth" ON public.curriculum_tracks
            FOR INSERT
            WITH CHECK (auth.role() = 'authenticated');
        
        CREATE POLICY "curriculum_tracks_update_auth" ON public.curriculum_tracks
            FOR UPDATE
            USING (auth.role() = 'authenticated')
            WITH CHECK (auth.role() = 'authenticated');
        
        CREATE POLICY "curriculum_tracks_delete_auth" ON public.curriculum_tracks
            FOR DELETE
            USING (auth.role() = 'authenticated');
        
        RAISE NOTICE 'RLS enabled on curriculum_tracks';
    ELSE
        RAISE NOTICE 'Table curriculum_tracks does not exist - skipping';
    END IF;
END $$;

-- 2. Enable RLS on lessons table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'lessons'
    ) THEN
        ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "lessons_select_all" ON public.lessons;
        DROP POLICY IF EXISTS "lessons_insert_auth" ON public.lessons;
        DROP POLICY IF EXISTS "lessons_update_auth" ON public.lessons;
        DROP POLICY IF EXISTS "lessons_delete_auth" ON public.lessons;
        
        -- Allow authenticated users to read all lessons
        CREATE POLICY "lessons_select_all" ON public.lessons
            FOR SELECT
            USING (true);
        
        -- Only authenticated users can insert/update/delete
        CREATE POLICY "lessons_insert_auth" ON public.lessons
            FOR INSERT
            WITH CHECK (auth.role() = 'authenticated');
        
        CREATE POLICY "lessons_update_auth" ON public.lessons
            FOR UPDATE
            USING (auth.role() = 'authenticated')
            WITH CHECK (auth.role() = 'authenticated');
        
        CREATE POLICY "lessons_delete_auth" ON public.lessons
            FOR DELETE
            USING (auth.role() = 'authenticated');
        
        RAISE NOTICE 'RLS enabled on lessons';
    ELSE
        RAISE NOTICE 'Table lessons does not exist - skipping';
    END IF;
END $$;

-- 3. Enable RLS on progress table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'progress'
    ) THEN
        ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "progress_select_own" ON public.progress;
        DROP POLICY IF EXISTS "progress_insert_own" ON public.progress;
        DROP POLICY IF EXISTS "progress_update_own" ON public.progress;
        DROP POLICY IF EXISTS "progress_delete_own" ON public.progress;
        
        -- For progress, assume there's a user_id column for ownership
        -- Adjust the column name if different (e.g., learner_id, owner_id, etc.)
        
        -- Check if user_id column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'progress' 
            AND column_name = 'user_id'
        ) THEN
            -- User can only see/modify their own progress
            CREATE POLICY "progress_select_own" ON public.progress
                FOR SELECT
                USING (auth.uid() = user_id);
            
            CREATE POLICY "progress_insert_own" ON public.progress
                FOR INSERT
                WITH CHECK (auth.uid() = user_id);
            
            CREATE POLICY "progress_update_own" ON public.progress
                FOR UPDATE
                USING (auth.uid() = user_id)
                WITH CHECK (auth.uid() = user_id);
            
            CREATE POLICY "progress_delete_own" ON public.progress
                FOR DELETE
                USING (auth.uid() = user_id);
            
            RAISE NOTICE 'RLS enabled on progress with user_id ownership';
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'progress' 
            AND column_name = 'learner_id'
        ) THEN
            -- Alternative: learner-based ownership via learners table
            CREATE POLICY "progress_select_own" ON public.progress
                FOR SELECT
                USING (
                    EXISTS (
                        SELECT 1 FROM public.learners 
                        WHERE learners.id = progress.learner_id 
                        AND learners.facilitator_id = auth.uid()
                    )
                );
            
            CREATE POLICY "progress_insert_own" ON public.progress
                FOR INSERT
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM public.learners 
                        WHERE learners.id = progress.learner_id 
                        AND learners.facilitator_id = auth.uid()
                    )
                );
            
            CREATE POLICY "progress_update_own" ON public.progress
                FOR UPDATE
                USING (
                    EXISTS (
                        SELECT 1 FROM public.learners 
                        WHERE learners.id = progress.learner_id 
                        AND learners.facilitator_id = auth.uid()
                    )
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM public.learners 
                        WHERE learners.id = progress.learner_id 
                        AND learners.facilitator_id = auth.uid()
                    )
                );
            
            CREATE POLICY "progress_delete_own" ON public.progress
                FOR DELETE
                USING (
                    EXISTS (
                        SELECT 1 FROM public.learners 
                        WHERE learners.id = progress.learner_id 
                        AND learners.facilitator_id = auth.uid()
                    )
                );
            
            RAISE NOTICE 'RLS enabled on progress with learner_id ownership';
        ELSE
            -- No ownership column found - use permissive authenticated policy
            CREATE POLICY "progress_select_own" ON public.progress
                FOR SELECT
                USING (auth.role() = 'authenticated');
            
            CREATE POLICY "progress_insert_own" ON public.progress
                FOR INSERT
                WITH CHECK (auth.role() = 'authenticated');
            
            CREATE POLICY "progress_update_own" ON public.progress
                FOR UPDATE
                USING (auth.role() = 'authenticated')
                WITH CHECK (auth.role() = 'authenticated');
            
            CREATE POLICY "progress_delete_own" ON public.progress
                FOR DELETE
                USING (auth.role() = 'authenticated');
            
            RAISE NOTICE 'RLS enabled on progress with authenticated-only access';
        END IF;
    ELSE
        RAISE NOTICE 'Table progress does not exist - skipping';
    END IF;
END $$;

-- Verify RLS is enabled on all three tables
DO $$
DECLARE
    table_rec RECORD;
BEGIN
    RAISE NOTICE '--- RLS Status Check ---';
    FOR table_rec IN 
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('curriculum_tracks', 'lessons', 'progress')
    LOOP
        IF table_rec.rowsecurity THEN
            RAISE NOTICE 'Table %.% has RLS ENABLED', 'public', table_rec.tablename;
        ELSE
            RAISE NOTICE 'Table %.% has RLS DISABLED', 'public', table_rec.tablename;
        END IF;
    END LOOP;
END $$;
