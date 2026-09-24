-- Pin search_path for Curriculum Guidance trigger functions.
-- This prevents role-level search_path changes from affecting object resolution.

alter function public.guard_curriculum_period_active_pointer()
  set search_path = public, pg_temp;

alter function public.guard_activated_curriculum_contract()
  set search_path = public, pg_temp;

alter function public.guard_activated_curriculum_contract_child()
  set search_path = public, pg_temp;

alter function public.sync_syllabus_curriculum_contract()
  set search_path = public, pg_temp;

alter function public.capture_curriculum_forecast_metadata()
  set search_path = public, pg_temp;
