-- Migration: Fix mutable search_path security warnings on all functions
-- Purpose: Set explicit search_path to prevent search path injection attacks
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- 1. Fix transcripts_owner_id_from_path
CREATE OR REPLACE FUNCTION public.transcripts_owner_id_from_path(path text)
RETURNS uuid 
LANGUAGE sql 
STABLE
SET search_path = public
AS $$
  SELECT nullif(split_part(path, '/', 2), '')::uuid;
$$;

-- 2. Fix update_visual_aids_updated_at
CREATE OR REPLACE FUNCTION public.update_visual_aids_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Fix sync_learners_targets
CREATE OR REPLACE FUNCTION public.sync_learners_targets()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c int;
  e int;
  w int;
  t int;
BEGIN
  -- Parse values from JSONB targets if provided
  IF NEW.targets IS NOT NULL THEN
    BEGIN c := (NEW.targets->>'comprehension')::int; EXCEPTION WHEN OTHERS THEN c := NULL; END;
    BEGIN e := (NEW.targets->>'exercise')::int;      EXCEPTION WHEN OTHERS THEN e := NULL; END;
    BEGIN w := (NEW.targets->>'worksheet')::int;     EXCEPTION WHEN OTHERS THEN w := NULL; END;
    BEGIN t := (NEW.targets->>'test')::int;          EXCEPTION WHEN OTHERS THEN t := NULL; END;
  END IF;

  -- Prefer explicit numeric columns if already provided; else use parsed JSON values
  IF NEW.comprehension IS NULL AND c IS NOT NULL THEN NEW.comprehension := c; END IF;
  IF NEW.exercise      IS NULL AND e IS NOT NULL THEN NEW.exercise      := e; END IF;
  IF NEW.worksheet     IS NULL AND w IS NOT NULL THEN NEW.worksheet     := w; END IF;
  IF NEW.test          IS NULL AND t IS NOT NULL THEN NEW.test          := t; END IF;

  -- Ensure targets JSON mirrors final numeric values
  NEW.targets := jsonb_strip_nulls(jsonb_build_object(
    'comprehension', NEW.comprehension,
    'exercise',      NEW.exercise,
    'worksheet',     NEW.worksheet,
    'test',          NEW.test
  ));

  RETURN NEW;
END;
$$;

-- 4. Fix deactivate_old_mentor_sessions
CREATE OR REPLACE FUNCTION public.deactivate_old_mentor_sessions()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deactivate all other sessions for this facilitator
  UPDATE public.mentor_sessions
  SET is_active = FALSE
  WHERE facilitator_id = NEW.facilitator_id
    AND id != NEW.id
    AND is_active = TRUE;
  
  RETURN NEW;
END;
$$;

-- 5. Fix set_learners_owner_id
CREATE OR REPLACE FUNCTION public.set_learners_owner_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='learners' AND column_name='facilitator_id'
  ) THEN
    IF NEW.facilitator_id IS NULL THEN
      NEW.facilitator_id := auth.uid();
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='learners' AND column_name='owner_id'
  ) THEN
    IF NEW.owner_id IS NULL THEN
      NEW.owner_id := auth.uid();
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='learners' AND column_name='user_id'
  ) THEN
    IF NEW.user_id IS NULL THEN
      NEW.user_id := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Fix update_lesson_schedule_timestamp
CREATE OR REPLACE FUNCTION public.update_lesson_schedule_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 7. Fix deactivate_old_lesson_sessions
CREATE OR REPLACE FUNCTION public.deactivate_old_lesson_sessions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- When inserting a new active session, close any existing active session for same learner+lesson
  IF NEW.ended_at IS NULL THEN
    UPDATE lesson_sessions
    SET ended_at = NOW()
    WHERE learner_id = NEW.learner_id
      AND lesson_id = NEW.lesson_id
      AND ended_at IS NULL
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 8. Fix archive_conversation_update
CREATE OR REPLACE FUNCTION public.archive_conversation_update()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a conversation update is deleted, archive it for permanent storage
  INSERT INTO conversation_history_archive (
    facilitator_id,
    learner_id,
    summary,
    conversation_turns,
    turn_count,
    archived_at
  ) VALUES (
    OLD.facilitator_id,
    OLD.learner_id,
    OLD.summary,
    OLD.recent_turns,
    OLD.turn_count,
    NOW()
  );
  
  RETURN OLD;
END;
$$;

-- 9. Fix maybe_archive_long_conversation
CREATE OR REPLACE FUNCTION public.maybe_archive_long_conversation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If conversation exceeds 50 turns, archive and reset
  IF NEW.turn_count >= 50 THEN
    INSERT INTO conversation_history_archive (
      facilitator_id,
      learner_id,
      summary,
      conversation_turns,
      turn_count,
      archived_at
    ) VALUES (
      OLD.facilitator_id,
      OLD.learner_id,
      OLD.summary,
      OLD.recent_turns,
      OLD.turn_count,
      NOW()
    );
    
    -- Reset the conversation
    NEW.recent_turns := '[]'::jsonb;
    NEW.turn_count := 0;
    NEW.summary := 'Previous conversation archived at ' || NOW()::text;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add comment documenting the security fix
COMMENT ON FUNCTION public.transcripts_owner_id_from_path IS 'Extracts owner ID from storage path. search_path set to prevent injection attacks.';
COMMENT ON FUNCTION public.update_visual_aids_updated_at IS 'Updates visual_aids.updated_at timestamp. search_path set to prevent injection attacks.';
COMMENT ON FUNCTION public.sync_learners_targets IS 'Syncs JSONB targets with flat numeric columns. search_path set to prevent injection attacks.';
COMMENT ON FUNCTION public.deactivate_old_mentor_sessions IS 'Deactivates old mentor sessions on new insert. SECURITY DEFINER with search_path to prevent injection attacks.';
COMMENT ON FUNCTION public.set_learners_owner_id IS 'Sets learner owner ID to auth.uid() if not provided. search_path includes auth schema.';
COMMENT ON FUNCTION public.update_lesson_schedule_timestamp IS 'Updates lesson_schedule.updated_at timestamp. search_path set to prevent injection attacks.';
COMMENT ON FUNCTION public.deactivate_old_lesson_sessions IS 'Closes old lesson sessions on new insert. search_path set to prevent injection attacks.';
COMMENT ON FUNCTION public.archive_conversation_update IS 'Archives conversation on delete. SECURITY DEFINER with search_path to prevent injection attacks.';
COMMENT ON FUNCTION public.maybe_archive_long_conversation IS 'Archives and resets conversations exceeding 50 turns. SECURITY DEFINER with search_path to prevent injection attacks.';
