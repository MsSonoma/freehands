-- Permit canonical completion to supersede only the exact historical poison
-- pattern created by the former learner-history GET stale cleanup.

create or replace function public.complete_lesson_session_transactional(
  p_session_id uuid,
  p_learner_id uuid,
  p_lesson_id text,
  p_syllabus_occurrence_id text,
  p_source text,
  p_instructional_teacher text,
  p_test_percentage numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.lesson_sessions%rowtype;
  v_existing_event public.lesson_session_events%rowtype;
  v_terminal_event public.lesson_session_events%rowtype;
  v_now timestamptz := clock_timestamp();
  v_started_at timestamptz;
  v_minutes_active integer;
  v_legacy_recovery boolean := false;
begin
  if p_session_id is null or p_learner_id is null then
    raise exception 'session and learner identities are required' using errcode = '22004';
  end if;
  if nullif(btrim(p_lesson_id), '') is null
     or nullif(btrim(p_syllabus_occurrence_id), '') is null then
    raise exception 'lesson and Syllabus occurrence identities are required' using errcode = '22023';
  end if;
  if p_instructional_teacher is null
     or p_instructional_teacher not in ('sonoma', 'webb')
     or p_source is null
     or (p_instructional_teacher = 'sonoma' and p_source <> 'session-v2')
     or (p_instructional_teacher = 'webb' and p_source <> 'webb') then
    return jsonb_build_object('ok', false, 'state', 'teacher_source_mismatch');
  end if;

  select * into v_session from public.lesson_sessions
    where id = p_session_id for update;
  if not found
     or v_session.learner_id <> p_learner_id
     or v_session.lesson_id <> p_lesson_id then
    return jsonb_build_object('ok', false, 'state', 'identity_mismatch');
  end if;
  if v_session.instructional_teacher is distinct from p_instructional_teacher then
    return jsonb_build_object('ok', false, 'state', 'teacher_mismatch');
  end if;

  select min(e.occurred_at) into v_started_at
    from public.lesson_session_events e
    where e.session_id = p_session_id
      and e.event_type = 'started'
      and e.metadata ->> 'syllabus_occurrence_id' = btrim(p_syllabus_occurrence_id)
      and e.metadata ->> 'instructional_teacher' = p_instructional_teacher;
  if v_started_at is null then
    return jsonb_build_object('ok', false, 'state', 'occurrence_mismatch');
  end if;

  select * into v_existing_event from public.lesson_session_events
    where session_id = p_session_id and event_type = 'completed'
    order by occurred_at asc, id asc limit 1;
  if found then
    if v_existing_event.metadata ->> 'instructional_teacher' is distinct from p_instructional_teacher
       or v_existing_event.metadata ->> 'source' is distinct from p_source then
      return jsonb_build_object('ok', false, 'state', 'teacher_mismatch');
    end if;
    return jsonb_build_object(
      'ok', true, 'state', 'already_completed', 'id', v_session.id,
      'eventId', v_existing_event.id, 'completedAt', v_existing_event.occurred_at,
      'instructionalTeacher', p_instructional_teacher
    );
  end if;

  if v_session.ended_at is not null then
    -- Fail closed unless the latest explicit terminal event is the exact event
    -- written by the retired GET cleanup and authoritative activity continued
    -- after the cleanup closed the row. The legacy evidence remains in place;
    -- the new completed event supersedes it through normal lifecycle ordering.
    select * into v_terminal_event
      from public.lesson_session_events
      where session_id = p_session_id
        and event_type in ('completed', 'incomplete', 'restarted', 'exited')
      order by occurred_at desc, id desc
      limit 1;

    v_legacy_recovery := found
      and v_terminal_event.event_type = 'incomplete'
      and v_terminal_event.metadata ->> 'reason' = 'auto-marked-stale'
      and case
        when pg_catalog.jsonb_typeof(v_terminal_event.metadata -> 'minutes_since_activity') = 'number'
          then (v_terminal_event.metadata ->> 'minutes_since_activity')::numeric >= 60
        else false
      end
      and v_terminal_event.occurred_at = v_session.ended_at
      and v_session.last_activity_at > v_session.ended_at;

    if not v_legacy_recovery then
      return jsonb_build_object('ok', false, 'state', 'already_ended');
    end if;
  end if;

  v_minutes_active := greatest(0, round(extract(epoch from
    (v_now - coalesce(v_session.started_at, v_started_at))) / 60.0)::integer);
  update public.lesson_sessions
    set ended_at = v_now, last_activity_at = v_now where id = p_session_id;
  insert into public.lesson_session_events
    (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
  values (
    p_session_id, p_learner_id, p_lesson_id, 'completed', v_now,
    jsonb_strip_nulls(jsonb_build_object(
      'syllabus_occurrence_id', btrim(p_syllabus_occurrence_id),
      'instructional_teacher', p_instructional_teacher,
      'source', p_source, 'test_percentage', p_test_percentage,
      'minutes_active', v_minutes_active,
      'supersedes_event_id', case when v_legacy_recovery then v_terminal_event.id else null end,
      'recovery_reason', case when v_legacy_recovery then 'legacy-auto-marked-stale-after-later-activity' else null end
    ))
  ) returning * into v_existing_event;

  return jsonb_build_object(
    'ok', true,
    'state', case when v_legacy_recovery then 'completed_legacy_recovery' else 'completed' end,
    'id', v_session.id, 'eventId', v_existing_event.id, 'completedAt', v_now,
    'instructionalTeacher', p_instructional_teacher
  );
end;
$$;

comment on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, text, numeric)
  is 'Atomically completes a protected instructional session, including a fail-closed compatibility path for the retired learner-history auto-stale defect.';

revoke all on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, text, numeric)
  to service_role;
