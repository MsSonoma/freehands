-- Make protected instructional completion atomic and server-authoritative.
-- The service-role route performs facilitator authentication and learner ownership
-- checks. This function only validates and commits the already-authorized session.

create or replace function public.guard_server_lesson_session_end()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.ended_at is distinct from old.ended_at
     and current_user not in ('service_role', 'postgres') then
    raise exception 'Lesson sessions may only end through a protected server lifecycle';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_server_lesson_session_end on public.lesson_sessions;
create trigger guard_server_lesson_session_end
  before update on public.lesson_sessions
  for each row
  execute function public.guard_server_lesson_session_end();

revoke all on function public.guard_server_lesson_session_end()
  from public, anon, authenticated;

create or replace function public.complete_lesson_session_transactional(
  p_session_id uuid,
  p_learner_id uuid,
  p_lesson_id text,
  p_syllabus_occurrence_id text,
  p_source text,
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
  v_now timestamptz := clock_timestamp();
  v_started_at timestamptz;
  v_minutes_active integer;
begin
  if p_session_id is null or p_learner_id is null then
    raise exception 'session and learner identities are required' using errcode = '22004';
  end if;
  if nullif(btrim(p_lesson_id), '') is null
     or nullif(btrim(p_syllabus_occurrence_id), '') is null then
    raise exception 'lesson and Syllabus occurrence identities are required' using errcode = '22023';
  end if;

  select *
    into v_session
    from public.lesson_sessions
    where id = p_session_id
    for update;

  if not found
     or v_session.learner_id <> p_learner_id
     or v_session.lesson_id <> p_lesson_id then
    return jsonb_build_object('ok', false, 'state', 'identity_mismatch');
  end if;

  -- The exact occurrence was bound to the session by the protected start RPC.
  -- Completion cannot spend authorization for a different occurrence.
  select min(e.occurred_at)
    into v_started_at
    from public.lesson_session_events e
    where e.session_id = p_session_id
      and e.event_type = 'started'
      and e.metadata ->> 'syllabus_occurrence_id' = btrim(p_syllabus_occurrence_id);

  if v_started_at is null then
    return jsonb_build_object('ok', false, 'state', 'occurrence_mismatch');
  end if;

  select *
    into v_existing_event
    from public.lesson_session_events
    where session_id = p_session_id
      and event_type = 'completed'
    order by occurred_at asc, id asc
    limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'state', 'already_completed',
      'id', v_session.id,
      'eventId', v_existing_event.id,
      'completedAt', v_existing_event.occurred_at
    );
  end if;

  if v_session.ended_at is not null then
    return jsonb_build_object('ok', false, 'state', 'already_ended');
  end if;

  v_minutes_active := greatest(0, round(extract(epoch from (v_now - coalesce(v_session.started_at, v_started_at))) / 60.0)::integer);

  update public.lesson_sessions
    set ended_at = v_now,
        last_activity_at = v_now
    where id = p_session_id;

  insert into public.lesson_session_events (
    session_id, learner_id, lesson_id, event_type, occurred_at, metadata
  ) values (
    p_session_id,
    p_learner_id,
    p_lesson_id,
    'completed',
    v_now,
    jsonb_strip_nulls(jsonb_build_object(
      'syllabus_occurrence_id', btrim(p_syllabus_occurrence_id),
      'source', nullif(btrim(p_source), ''),
      'test_percentage', p_test_percentage,
      'minutes_active', v_minutes_active
    ))
  )
  returning * into v_existing_event;

  return jsonb_build_object(
    'ok', true,
    'state', 'completed',
    'id', v_session.id,
    'eventId', v_existing_event.id,
    'completedAt', v_now
  );
end;
$$;

comment on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, numeric)
  is 'Atomically completes a protected instructional session already authorized and started for an exact Syllabus occurrence.';

revoke all on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, numeric)
  to service_role;

-- Lifecycle events are canonical educational history. Browser clients retain
-- ownership-filtered reads, while server routes own started/completed writes.
revoke insert on table public.lesson_session_events from authenticated;
