-- Migration: Add play timer mode columns to learners table
-- play_timers_enabled: master on/off for all play portions (default true)
-- play_dependent_on_work: when on, play portion of next phase is skipped if previous work timer expired (default false)

ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS play_timers_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS play_dependent_on_work BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.learners.play_timers_enabled IS
  'Master toggle: when false all play portions (phases 2-5) are disabled regardless of individual flags.';

COMMENT ON COLUMN public.learners.play_dependent_on_work IS
  'When true, the play portion of a phase is only available if the previous phase work timer did not expire before completion.';
