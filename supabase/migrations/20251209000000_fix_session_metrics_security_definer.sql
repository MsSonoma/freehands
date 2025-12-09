-- Migration: Remove SECURITY DEFINER from session_metrics view
-- Purpose: Fix security issue where view bypasses RLS and runs with owner privileges
-- Impact: View will now enforce RLS from underlying tables (lesson_sessions)
--         Only facilitators can see sessions for their own learners

-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.session_metrics CASCADE;

CREATE VIEW public.session_metrics 
WITH (security_invoker = true)
AS
SELECT
  s.id as session_id,
  s.learner_id,
  s.lesson_id,
  s.started_at,
  s.ended_at,
  EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60 as duration_minutes,
  COUNT(DISTINCT r.id) as total_repeats,
  COUNT(DISTINCT fn.id) as total_notes,
  ps.id IS NOT NULL as survey_completed
FROM public.lesson_sessions s
LEFT JOIN public.repeat_events r ON r.session_id = s.id
LEFT JOIN public.facilitator_notes fn ON fn.session_id = s.id
LEFT JOIN public.post_lesson_surveys ps ON ps.session_id = s.id
GROUP BY s.id, s.learner_id, s.lesson_id, s.started_at, s.ended_at, ps.id;

-- Set ownership and grant access
ALTER VIEW public.session_metrics OWNER TO postgres;
GRANT SELECT ON public.session_metrics TO authenticated;

-- Add comment explaining security model
COMMENT ON VIEW public.session_metrics IS 'Session metrics aggregate view with security_invoker=true. Runs with querying user privileges, inheriting RLS from lesson_sessions table.';
