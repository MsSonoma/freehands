-- Harden instructional execution ownership without changing durable lesson progress.
-- A lesson_sessions row is a temporary execution lease. Snapshots/evidence remain durable.

alter table public.lesson_sessions
  add column if not exists ended_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lesson_sessions'::regclass
      and conname = 'lesson_sessions_ended_reason_check'
  ) then
    alter table public.lesson_sessions
      add constraint lesson_sessions_ended_reason_check
      check (ended_reason is null or ended_reason in ('completed', 'moved', 'taken_over', 'expired', 'released'));
  end if;
end;
$$;

comment on column public.lesson_sessions.ended_reason is
  'Why execution ownership ended. Durable learner progress is stored separately and is not deleted when ownership ends.';

create index if not exists idx_lesson_sessions_active_learner_owner
  on public.lesson_sessions (learner_id, session_id, last_activity_at)
  where ended_at is null;

create or replace function public.start_lesson_session_transactional(
  p_learner_id uuid,
  p_lesson_id text,
  p_browser_session_id uuid,
  p_device_name text,
  p_allow_takeover boolean,
  p_expected_conflicting_session_id uuid,
  p_syllabus_occurrence_id text,
  p_instructional_teacher text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requested_active public.lesson_sessions%rowtype;
  v_foreign_active public.lesson_sessions%rowtype;
  v_conflicting_active public.lesson_sessions%rowtype;
  v_replaced public.lesson_sessions%rowtype;
  v_created public.lesson_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_lease_cutoff timestamptz := v_now - interval '5 minutes';
  v_learner_exists boolean;
  v_requested_found boolean := false;
  v_foreign_found boolean := false;
  v_conflict_found boolean := false;
  v_takeover boolean := false;
  v_end_reason text;
  v_replaced_session_ids uuid[] := array[]::uuid[];
  v_expired_session_ids uuid[] := array[]::uuid[];
begin
  if p_browser_session_id is null then
    raise exception 'browser session identity is required' using errcode = '22004';
  end if;
  if nullif(btrim(p_lesson_id), '') is null
     or nullif(btrim(p_syllabus_occurrence_id), '') is null then
    raise exception 'lesson and Syllabus occurrence identities are required' using errcode = '22023';
  end if;
  if p_instructional_teacher is null
     or p_instructional_teacher not in ('sonoma', 'webb') then
    raise exception 'instructional teacher must be sonoma or webb' using errcode = '22023';
  end if;

  select true into v_learner_exists
    from public.learners where id = p_learner_id for update;
  if not coalesce(v_learner_exists, false) then
    raise exception 'learner does not exist' using errcode = '23503';
  end if;

  -- Serialize every active execution for this learner before making an ownership decision.
  perform 1 from public.lesson_sessions
    where learner_id = p_learner_id and ended_at is null for update;

  -- A foreign browser that has been silent for five minutes relinquishes only the
  -- execution lease. Its durable snapshot/evidence remains available for resume.
  for v_replaced in
    update public.lesson_sessions
      set ended_at = v_now,
          ended_reason = 'expired'
      where learner_id = p_learner_id
        and ended_at is null
        and session_id <> p_browser_session_id
        and coalesce(last_activity_at, started_at) < v_lease_cutoff
      returning *
  loop
    v_expired_session_ids := array_append(v_expired_session_ids, v_replaced.id);
    insert into public.lesson_session_events
      (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
    values
      (v_replaced.id, p_learner_id, v_replaced.lesson_id, 'incomplete', v_now,
       jsonb_build_object(
         'reason', 'execution-lease-expired',
         'resumed_with_lesson_id', p_lesson_id,
         'replacement_browser_session_id', p_browser_session_id
       ));
  end loop;

  select * into v_requested_active
    from public.lesson_sessions
    where learner_id = p_learner_id
      and lesson_id = p_lesson_id
      and ended_at is null
    order by started_at desc, id desc
    limit 1;
  v_requested_found := found;

  -- Teacher authority is immutable for an active requested lesson.
  if v_requested_found
     and v_requested_active.instructional_teacher is not null
     and v_requested_active.instructional_teacher is distinct from p_instructional_teacher then
    return jsonb_build_object(
      'state', 'teacher_mismatch', 'id', null, 'conflict', false,
      'takeover', false, 'instructionalTeacher', v_requested_active.instructional_teacher
    );
  end if;

  -- Any live execution owned by another browser is a learner-level conflict,
  -- even when that browser is working on a different lesson.
  select * into v_foreign_active
    from public.lesson_sessions
    where learner_id = p_learner_id
      and ended_at is null
      and session_id <> p_browser_session_id
    order by last_activity_at desc nulls last, started_at desc, id desc
    limit 1;
  v_foreign_found := found;

  -- Preserve the historical fail-closed behavior for a legacy NULL-teacher row:
  -- it may not be silently upgraded even when it belongs to this browser.
  if v_requested_found
     and v_requested_active.session_id = p_browser_session_id
     and v_requested_active.instructional_teacher is null then
    v_conflicting_active := v_requested_active;
    v_conflict_found := true;
  elsif v_foreign_found then
    v_conflicting_active := v_foreign_active;
    v_conflict_found := true;
  end if;

  if v_conflict_found then
    if not coalesce(p_allow_takeover, false) then
      return jsonb_build_object(
        'state', 'conflict', 'id', null, 'conflict', true, 'takeover', false,
        'staleConflict', false,
        'existingSession', jsonb_build_object(
          'id', v_conflicting_active.id,
          'session_id', v_conflicting_active.session_id,
          'device_name', v_conflicting_active.device_name,
          'last_activity_at', v_conflicting_active.last_activity_at,
          'started_at', v_conflicting_active.started_at,
          'lesson_id', v_conflicting_active.lesson_id,
          'instructional_teacher', v_conflicting_active.instructional_teacher
        )
      );
    end if;
    if p_expected_conflicting_session_id is null
       or p_expected_conflicting_session_id <> v_conflicting_active.id then
      return jsonb_build_object(
        'state', 'conflict', 'id', null, 'conflict', true, 'takeover', false,
        'staleConflict', true,
        'existingSession', jsonb_build_object(
          'id', v_conflicting_active.id,
          'session_id', v_conflicting_active.session_id,
          'device_name', v_conflicting_active.device_name,
          'last_activity_at', v_conflicting_active.last_activity_at,
          'started_at', v_conflicting_active.started_at,
          'lesson_id', v_conflicting_active.lesson_id,
          'instructional_teacher', v_conflicting_active.instructional_teacher
        )
      );
    end if;
    v_takeover := true;
  elsif coalesce(p_allow_takeover, false)
        and p_expected_conflicting_session_id is not null then
    -- Never spend a PIN approval against a conflict that disappeared or changed.
    return jsonb_build_object(
      'state', 'conflict', 'id', null, 'conflict', true, 'takeover', false,
      'staleConflict', true, 'existingSession', null
    );
  end if;

  -- Same browser + same lesson + same teacher is a reconnect, not a new execution.
  if not v_takeover
     and v_requested_found
     and v_requested_active.instructional_teacher = p_instructional_teacher
     and v_requested_active.session_id = p_browser_session_id then
    for v_replaced in
      update public.lesson_sessions
        set ended_at = v_now,
            ended_reason = 'moved'
        where learner_id = p_learner_id
          and ended_at is null
          and session_id = p_browser_session_id
          and id <> v_requested_active.id
        returning *
    loop
      v_replaced_session_ids := array_append(v_replaced_session_ids, v_replaced.id);
      insert into public.lesson_session_events
        (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
      values
        (v_replaced.id, p_learner_id, v_replaced.lesson_id, 'restarted', v_now,
         jsonb_build_object(
           'reason', 'same-browser-lesson-move',
           'resumed_with_lesson_id', p_lesson_id,
           'replacement_browser_session_id', p_browser_session_id
         ));
    end loop;

    update public.lesson_sessions
      set last_activity_at = v_now,
          device_name = coalesce(nullif(btrim(p_device_name), ''), device_name)
      where id = v_requested_active.id
      returning * into v_requested_active;

    return jsonb_build_object(
      'state', 'reused', 'id', v_requested_active.id, 'conflict', false,
      'takeover', false, 'instructionalTeacher', v_requested_active.instructional_teacher,
      'expiredSessionIds', to_jsonb(v_expired_session_ids),
      'replacedSessionIds', to_jsonb(v_replaced_session_ids),
      'existingSession', jsonb_build_object(
        'id', v_requested_active.id,
        'session_id', v_requested_active.session_id,
        'device_name', v_requested_active.device_name,
        'last_activity_at', v_requested_active.last_activity_at,
        'started_at', v_requested_active.started_at,
        'lesson_id', v_requested_active.lesson_id,
        'instructional_teacher', v_requested_active.instructional_teacher
      )
    );
  end if;

  -- Starting a new execution now has one of two meanings:
  --   same browser: ordinary lesson move
  --   foreign browser after exact PIN authorization: explicit takeover
  for v_replaced in
    update public.lesson_sessions
      set ended_at = v_now,
          ended_reason = case
            when v_takeover and session_id <> p_browser_session_id then 'taken_over'
            else 'moved'
          end
      where learner_id = p_learner_id
        and ended_at is null
      returning *
  loop
    v_replaced_session_ids := array_append(v_replaced_session_ids, v_replaced.id);
    v_end_reason := case
      when v_takeover and v_replaced.session_id <> p_browser_session_id then 'taken_over'
      else 'moved'
    end;
    insert into public.lesson_session_events
      (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
    values
      (v_replaced.id, p_learner_id, v_replaced.lesson_id, 'restarted', v_now,
       jsonb_build_object(
         'reason', v_end_reason,
         'resumed_with_lesson_id', p_lesson_id,
         'replacement_browser_session_id', p_browser_session_id
       ));
  end loop;

  perform pg_catalog.set_config('app.transactional_lesson_session_start', 'on', true);

  insert into public.lesson_sessions (
    learner_id, lesson_id, session_id, device_name, instructional_teacher,
    started_at, last_activity_at, ended_reason
  ) values (
    p_learner_id, p_lesson_id, p_browser_session_id,
    nullif(btrim(p_device_name), ''), p_instructional_teacher, v_now, v_now, null
  ) returning * into v_created;

  insert into public.lesson_session_events
    (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
  values (
    v_created.id, p_learner_id, p_lesson_id, 'started', v_now,
    jsonb_build_object(
      'syllabus_occurrence_id', btrim(p_syllabus_occurrence_id),
      'instructional_teacher', p_instructional_teacher,
      'ownership_state', case when v_takeover then 'taken_over' else 'acquired' end
    )
  );

  return jsonb_build_object(
    'state', case when v_takeover then 'taken_over' else 'started' end,
    'id', v_created.id, 'conflict', false, 'takeover', v_takeover,
    'instructionalTeacher', v_created.instructional_teacher,
    'replacedSessionId', case when v_takeover then v_conflicting_active.id else null end,
    'expiredSessionIds', to_jsonb(v_expired_session_ids),
    'replacedSessionIds', to_jsonb(v_replaced_session_ids),
    'existingSession', null
  );
end;
$$;

comment on function public.start_lesson_session_transactional(uuid, text, uuid, text, boolean, uuid, text, text)
  is 'Atomically acquires instructional execution ownership. Same-browser lesson moves do not require takeover; live foreign ownership does.';

revoke all on function public.start_lesson_session_transactional(uuid, text, uuid, text, boolean, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.start_lesson_session_transactional(uuid, text, uuid, text, boolean, uuid, text, text)
  to service_role;

create or replace function public.heartbeat_lesson_session(
  p_session_id uuid,
  p_learner_id uuid,
  p_browser_session_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.lesson_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_session_id is null or p_learner_id is null or p_browser_session_id is null then
    raise exception 'session, learner, and browser identities are required' using errcode = '22004';
  end if;

  select * into v_session
    from public.lesson_sessions
    where id = p_session_id
    for update;

  if not found or v_session.learner_id <> p_learner_id then
    return jsonb_build_object('ok', false, 'active', false, 'state', 'identity_mismatch');
  end if;
  if v_session.session_id <> p_browser_session_id then
    return jsonb_build_object(
      'ok', false, 'active', false, 'state', 'ownership_mismatch',
      'endedReason', coalesce(v_session.ended_reason, 'ownership_mismatch')
    );
  end if;
  if v_session.ended_at is not null then
    return jsonb_build_object(
      'ok', true, 'active', false, 'state', 'ended',
      'endedReason', coalesce(v_session.ended_reason, 'ended'),
      'session', jsonb_build_object(
        'id', v_session.id,
        'session_id', v_session.session_id,
        'learner_id', v_session.learner_id,
        'lesson_id', v_session.lesson_id,
        'device_name', v_session.device_name,
        'ended_at', v_session.ended_at,
        'ended_reason', v_session.ended_reason
      )
    );
  end if;

  update public.lesson_sessions
    set last_activity_at = v_now
    where id = p_session_id
    returning * into v_session;

  return jsonb_build_object(
    'ok', true, 'active', true, 'state', 'active',
    'endedReason', null,
    'session', jsonb_build_object(
      'id', v_session.id,
      'session_id', v_session.session_id,
      'learner_id', v_session.learner_id,
      'lesson_id', v_session.lesson_id,
      'device_name', v_session.device_name,
      'last_activity_at', v_session.last_activity_at,
      'ended_at', v_session.ended_at,
      'ended_reason', v_session.ended_reason
    )
  );
end;
$$;

comment on function public.heartbeat_lesson_session(uuid, uuid, uuid)
  is 'Renews an exact instructional execution lease and reports its terminal lifecycle reason without changing durable lesson progress.';

revoke all on function public.heartbeat_lesson_session(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.heartbeat_lesson_session(uuid, uuid, uuid)
  to service_role;

-- Keep the historical narrow legacy-completion recovery, while making all new
-- canonical completion transitions explicit for Realtime/polling consumers.
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
    select * into v_terminal_event
      from public.lesson_session_events
      where session_id = p_session_id
        and event_type in ('completed', 'incomplete', 'restarted', 'exited')
      order by occurred_at desc, id desc
      limit 1;

    v_legacy_recovery := found
      and v_session.ended_reason is null
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
      return jsonb_build_object('ok', false, 'state', 'already_ended', 'endedReason', v_session.ended_reason);
    end if;
  end if;

  v_minutes_active := greatest(0, round(extract(epoch from
    (v_now - coalesce(v_session.started_at, v_started_at))) / 60.0)::integer);
  update public.lesson_sessions
    set ended_at = v_now,
        ended_reason = 'completed',
        last_activity_at = v_now
    where id = p_session_id;
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
  is 'Atomically completes a protected instructional session and records ended_reason=completed, including the narrow legacy auto-stale recovery path.';

revoke all on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, text, numeric)
  to service_role;