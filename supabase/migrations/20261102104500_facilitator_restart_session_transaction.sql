-- Server-only transactional release of an instructional attempt for an educator-authorized restart.
-- This is not completion. The previous session and its evidence stay intact.
create or replace function public.release_lesson_sessions_for_facilitator_restart(
  p_learner_id uuid,
  p_lesson_id text
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  previous_session public.lesson_sessions%rowtype;
  released integer := 0;
  finished_at timestamptz := clock_timestamp();
begin
  if p_learner_id is null or nullif(btrim(p_lesson_id), '') is null then
    raise exception 'Learner and lesson are required' using errcode = '22023';
  end if;

  -- Match the lock ordering used by start_lesson_session_transactional.
  perform 1 from public.learners where id = p_learner_id for update;
  if not found then
    raise exception 'Learner not found' using errcode = '23503';
  end if;

  for previous_session in
    update public.lesson_sessions
       set ended_at = finished_at,
           ended_reason = 'released'
     where learner_id = p_learner_id
       and lesson_id = p_lesson_id
       and ended_at is null
     returning *
  loop
    insert into public.lesson_session_events
      (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
    values
      (previous_session.id, p_learner_id, p_lesson_id, 'restarted', finished_at,
       jsonb_build_object('reason', 'facilitator_restart',
                          'prior_browser_session_id', previous_session.session_id));
    released := released + 1;
  end loop;

  return released;
end;
$$;

revoke all on function public.release_lesson_sessions_for_facilitator_restart(uuid, text)
  from public, anon, authenticated;
grant execute on function public.release_lesson_sessions_for_facilitator_restart(uuid, text)
  to service_role;
