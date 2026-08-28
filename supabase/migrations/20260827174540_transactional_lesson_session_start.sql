-- Serialize protected lesson-session starts and make device takeover atomic.
-- Authorization remains in the service-role server route; this function receives
-- only the resulting takeover decision and never accepts a Facilitator PIN.

drop trigger if exists auto_deactivate_old_lesson_sessions on public.lesson_sessions;
drop function if exists public.deactivate_old_lesson_sessions();

create or replace function public.guard_transactional_lesson_session_start()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.ended_at is null
     and current_setting('app.transactional_lesson_session_start', true) is distinct from 'on' then
    raise exception 'Active lesson sessions may only start through the transactional start function';
  end if;

  return new;
end;
$$;

create trigger guard_transactional_lesson_session_start
  before insert on public.lesson_sessions
  for each row
  execute function public.guard_transactional_lesson_session_start();

revoke all on function public.guard_transactional_lesson_session_start()
  from public, anon, authenticated;

create or replace function public.start_lesson_session_transactional(
  p_learner_id uuid,
  p_lesson_id text,
  p_browser_session_id uuid,
  p_device_name text,
  p_allow_takeover boolean,
  p_expected_conflicting_session_id uuid,
  p_syllabus_occurrence_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requested_active public.lesson_sessions%rowtype;
  v_replaced public.lesson_sessions%rowtype;
  v_created public.lesson_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_learner_exists boolean;
  v_requested_found boolean := false;
  v_takeover boolean := false;
  v_replaced_session_ids uuid[] := array[]::uuid[];
begin
  if p_browser_session_id is null then
    raise exception 'browser session identity is required' using errcode = '22004';
  end if;

  if nullif(btrim(p_lesson_id), '') is null then
    raise exception 'lesson identity is required' using errcode = '22023';
  end if;

  -- The learner row is the serialization point for every protected start for
  -- this learner, including starts for different lessons.
  select true
    into v_learner_exists
    from public.learners
    where id = p_learner_id
    for update;

  if not coalesce(v_learner_exists, false) then
    raise exception 'learner does not exist' using errcode = '23503';
  end if;

  -- Lock every active lesson session for the learner. Historical runtime
  -- semantics allow only one active lesson workflow per learner, even though
  -- the retained partial unique index is scoped to learner+lesson.
  perform 1
    from public.lesson_sessions
    where learner_id = p_learner_id
      and ended_at is null
    for update;

  select *
    into v_requested_active
    from public.lesson_sessions
    where learner_id = p_learner_id
      and lesson_id = p_lesson_id
      and ended_at is null
    limit 1;

  v_requested_found := found;

  if v_requested_found and v_requested_active.session_id = p_browser_session_id then
    for v_replaced in
      update public.lesson_sessions
        set ended_at = v_now
        where learner_id = p_learner_id
          and ended_at is null
          and id <> v_requested_active.id
        returning *
    loop
      v_replaced_session_ids := array_append(v_replaced_session_ids, v_replaced.id);
      insert into public.lesson_session_events (
        session_id, learner_id, lesson_id, event_type, occurred_at, metadata
      ) values (
        v_replaced.id,
        p_learner_id,
        v_replaced.lesson_id,
        'restarted',
        v_now,
        jsonb_build_object('resumed_with_lesson_id', p_lesson_id)
      );
    end loop;

    update public.lesson_sessions
      set last_activity_at = v_now,
          device_name = coalesce(nullif(btrim(p_device_name), ''), device_name)
      where id = v_requested_active.id
      returning * into v_requested_active;

    return jsonb_build_object(
      'state', 'reused',
      'id', v_requested_active.id,
      'conflict', false,
      'takeover', false,
      'replacedSessionIds', to_jsonb(v_replaced_session_ids),
      'existingSession', jsonb_build_object(
        'id', v_requested_active.id,
        'session_id', v_requested_active.session_id,
        'device_name', v_requested_active.device_name,
        'last_activity_at', v_requested_active.last_activity_at,
        'started_at', v_requested_active.started_at,
        'lesson_id', v_requested_active.lesson_id
      )
    );
  end if;

  if v_requested_found then
    if not coalesce(p_allow_takeover, false) then
      return jsonb_build_object(
        'state', 'conflict',
        'id', null,
        'conflict', true,
        'takeover', false,
        'staleConflict', false,
        'existingSession', jsonb_build_object(
          'id', v_requested_active.id,
          'session_id', v_requested_active.session_id,
          'device_name', v_requested_active.device_name,
          'last_activity_at', v_requested_active.last_activity_at,
          'started_at', v_requested_active.started_at,
          'lesson_id', v_requested_active.lesson_id
        )
      );
    end if;

    if p_expected_conflicting_session_id is null
       or p_expected_conflicting_session_id <> v_requested_active.id then
      return jsonb_build_object(
        'state', 'conflict',
        'id', null,
        'conflict', true,
        'takeover', false,
        'staleConflict', true,
        'existingSession', jsonb_build_object(
          'id', v_requested_active.id,
          'session_id', v_requested_active.session_id,
          'device_name', v_requested_active.device_name,
          'last_activity_at', v_requested_active.last_activity_at,
          'started_at', v_requested_active.started_at,
          'lesson_id', v_requested_active.lesson_id
        )
      );
    end if;
    v_takeover := true;
  elsif coalesce(p_allow_takeover, false)
        and p_expected_conflicting_session_id is not null then
    -- A previously observed conflict disappeared. Do not spend stale takeover
    -- approval on an unobserved state transition.
    return jsonb_build_object(
      'state', 'conflict',
      'id', null,
      'conflict', true,
      'takeover', false,
      'staleConflict', true,
      'existingSession', null
    );
  end if;

  -- Moving to another lesson is the same legitimate learner workflow, not a
  -- cross-device takeover of the requested lesson. End every prior active row
  -- atomically so insertion failure restores all of them.
  for v_replaced in
    update public.lesson_sessions
      set ended_at = v_now
      where learner_id = p_learner_id
        and ended_at is null
      returning *
  loop
    v_replaced_session_ids := array_append(v_replaced_session_ids, v_replaced.id);
    insert into public.lesson_session_events (
      session_id, learner_id, lesson_id, event_type, occurred_at, metadata
    ) values (
      v_replaced.id,
      p_learner_id,
      v_replaced.lesson_id,
      'restarted',
      v_now,
      jsonb_build_object('resumed_with_lesson_id', p_lesson_id)
    );
  end loop;

  perform pg_catalog.set_config('app.transactional_lesson_session_start', 'on', true);

  insert into public.lesson_sessions (
    learner_id, lesson_id, session_id, device_name, started_at, last_activity_at
  ) values (
    p_learner_id,
    p_lesson_id,
    p_browser_session_id,
    nullif(btrim(p_device_name), ''),
    v_now,
    v_now
  )
  returning * into v_created;

  insert into public.lesson_session_events (
    session_id, learner_id, lesson_id, event_type, occurred_at, metadata
  ) values (
    v_created.id,
    p_learner_id,
    p_lesson_id,
    'started',
    v_now,
    jsonb_strip_nulls(jsonb_build_object(
      'syllabus_occurrence_id', nullif(btrim(p_syllabus_occurrence_id), '')
    ))
  );

  return jsonb_build_object(
    'state', case when v_takeover then 'taken_over' else 'started' end,
    'id', v_created.id,
    'conflict', false,
    'takeover', v_takeover,
    'replacedSessionId', case when v_takeover then v_requested_active.id else null end,
    'replacedSessionIds', to_jsonb(v_replaced_session_ids),
    'existingSession', null
  );
end;
$$;

comment on function public.start_lesson_session_transactional(uuid, text, uuid, text, boolean, uuid, text)
  is 'Atomically starts, reuses, or explicitly takes over a protected lesson session. Authorization is performed by the service-role server route.';

revoke all on function public.start_lesson_session_transactional(uuid, text, uuid, text, boolean, uuid, text)
  from public, anon, authenticated;
grant execute on function public.start_lesson_session_transactional(uuid, text, uuid, text, boolean, uuid, text)
  to service_role;

-- Protected starts now flow through the server-only RPC. Authenticated clients
-- retain SELECT/UPDATE for lifecycle reads and explicit session completion.
revoke insert on table public.lesson_sessions from authenticated;
