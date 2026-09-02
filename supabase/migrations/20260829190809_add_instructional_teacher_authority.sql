-- Bind facilitator-owned instructional teacher intent to protected execution.
-- Existing lesson associations default to Sonoma. Historical session rows remain
-- nullable unless a protected start records the actual instructor.

alter table public.syllabus_lesson_associations
  add column instructional_teacher text not null default 'sonoma';

alter table public.syllabus_lesson_associations
  add constraint syllabus_lesson_associations_instructional_teacher_check
  check (instructional_teacher in ('sonoma', 'webb'));

alter table public.lesson_sessions
  add column instructional_teacher text;

alter table public.lesson_sessions
  add constraint lesson_sessions_instructional_teacher_check
  check (instructional_teacher is null or instructional_teacher in ('sonoma', 'webb'));

create or replace function public.guard_lesson_session_instructional_teacher()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.instructional_teacher is distinct from old.instructional_teacher then
    raise exception 'The instructional teacher recorded at session start is immutable';
  end if;
  return new;
end;
$$;

create trigger guard_lesson_session_instructional_teacher
  before update of instructional_teacher on public.lesson_sessions
  for each row execute function public.guard_lesson_session_instructional_teacher();

revoke all on function public.guard_lesson_session_instructional_teacher()
  from public, anon, authenticated;

create function public.start_lesson_session_transactional(
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

  perform 1 from public.lesson_sessions
    where learner_id = p_learner_id and ended_at is null for update;

  select * into v_requested_active
    from public.lesson_sessions
    where learner_id = p_learner_id
      and lesson_id = p_lesson_id
      and ended_at is null
    limit 1;
  v_requested_found := found;

  if v_requested_found
     and v_requested_active.instructional_teacher is not null
     and v_requested_active.instructional_teacher is distinct from p_instructional_teacher then
    return jsonb_build_object(
      'state', 'teacher_mismatch', 'id', null, 'conflict', false,
      'takeover', false, 'instructionalTeacher', v_requested_active.instructional_teacher
    );
  end if;

  if v_requested_found
     and v_requested_active.instructional_teacher = p_instructional_teacher
     and v_requested_active.session_id = p_browser_session_id then
    for v_replaced in
      update public.lesson_sessions set ended_at = v_now
        where learner_id = p_learner_id and ended_at is null
          and id <> v_requested_active.id returning *
    loop
      v_replaced_session_ids := array_append(v_replaced_session_ids, v_replaced.id);
      insert into public.lesson_session_events
        (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
      values
        (v_replaced.id, p_learner_id, v_replaced.lesson_id, 'restarted', v_now,
         jsonb_build_object('resumed_with_lesson_id', p_lesson_id));
    end loop;

    update public.lesson_sessions
      set last_activity_at = v_now,
          device_name = coalesce(nullif(btrim(p_device_name), ''), device_name)
      where id = v_requested_active.id returning * into v_requested_active;

    return jsonb_build_object(
      'state', 'reused', 'id', v_requested_active.id, 'conflict', false,
      'takeover', false, 'instructionalTeacher', v_requested_active.instructional_teacher,
      'replacedSessionIds', to_jsonb(v_replaced_session_ids),
      'existingSession', jsonb_build_object(
        'id', v_requested_active.id, 'session_id', v_requested_active.session_id,
        'device_name', v_requested_active.device_name,
        'last_activity_at', v_requested_active.last_activity_at,
        'started_at', v_requested_active.started_at,
        'lesson_id', v_requested_active.lesson_id,
        'instructional_teacher', v_requested_active.instructional_teacher
      )
    );
  end if;

  if v_requested_found then
    if not coalesce(p_allow_takeover, false) then
      return jsonb_build_object(
        'state', 'conflict', 'id', null, 'conflict', true, 'takeover', false,
        'staleConflict', false,
        'existingSession', jsonb_build_object(
          'id', v_requested_active.id, 'session_id', v_requested_active.session_id,
          'device_name', v_requested_active.device_name,
          'last_activity_at', v_requested_active.last_activity_at,
          'started_at', v_requested_active.started_at,
          'lesson_id', v_requested_active.lesson_id,
          'instructional_teacher', v_requested_active.instructional_teacher
        )
      );
    end if;
    if p_expected_conflicting_session_id is null
       or p_expected_conflicting_session_id <> v_requested_active.id then
      return jsonb_build_object(
        'state', 'conflict', 'id', null, 'conflict', true, 'takeover', false,
        'staleConflict', true,
        'existingSession', jsonb_build_object(
          'id', v_requested_active.id, 'session_id', v_requested_active.session_id,
          'device_name', v_requested_active.device_name,
          'last_activity_at', v_requested_active.last_activity_at,
          'started_at', v_requested_active.started_at,
          'lesson_id', v_requested_active.lesson_id,
          'instructional_teacher', v_requested_active.instructional_teacher
        )
      );
    end if;
    v_takeover := true;
  elsif coalesce(p_allow_takeover, false)
        and p_expected_conflicting_session_id is not null then
    return jsonb_build_object(
      'state', 'conflict', 'id', null, 'conflict', true, 'takeover', false,
      'staleConflict', true, 'existingSession', null
    );
  end if;

  for v_replaced in
    update public.lesson_sessions set ended_at = v_now
      where learner_id = p_learner_id and ended_at is null returning *
  loop
    v_replaced_session_ids := array_append(v_replaced_session_ids, v_replaced.id);
    insert into public.lesson_session_events
      (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
    values
      (v_replaced.id, p_learner_id, v_replaced.lesson_id, 'restarted', v_now,
       jsonb_build_object('resumed_with_lesson_id', p_lesson_id));
  end loop;

  perform pg_catalog.set_config('app.transactional_lesson_session_start', 'on', true);

  insert into public.lesson_sessions (
    learner_id, lesson_id, session_id, device_name, instructional_teacher,
    started_at, last_activity_at
  ) values (
    p_learner_id, p_lesson_id, p_browser_session_id,
    nullif(btrim(p_device_name), ''), p_instructional_teacher, v_now, v_now
  ) returning * into v_created;

  insert into public.lesson_session_events
    (session_id, learner_id, lesson_id, event_type, occurred_at, metadata)
  values (
    v_created.id, p_learner_id, p_lesson_id, 'started', v_now,
    jsonb_build_object(
      'syllabus_occurrence_id', btrim(p_syllabus_occurrence_id),
      'instructional_teacher', p_instructional_teacher
    )
  );

  return jsonb_build_object(
    'state', case when v_takeover then 'taken_over' else 'started' end,
    'id', v_created.id, 'conflict', false, 'takeover', v_takeover,
    'instructionalTeacher', v_created.instructional_teacher,
    'replacedSessionId', case when v_takeover then v_requested_active.id else null end,
    'replacedSessionIds', to_jsonb(v_replaced_session_ids), 'existingSession', null
  );
end;
$$;

revoke all on function public.start_lesson_session_transactional(uuid, text, uuid, text, boolean, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.start_lesson_session_transactional(uuid, text, uuid, text, boolean, uuid, text, text)
  to service_role;

create function public.complete_lesson_session_transactional(
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
    return jsonb_build_object('ok', false, 'state', 'already_ended');
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
      'minutes_active', v_minutes_active
    ))
  ) returning * into v_existing_event;

  return jsonb_build_object(
    'ok', true, 'state', 'completed', 'id', v_session.id,
    'eventId', v_existing_event.id, 'completedAt', v_now,
    'instructionalTeacher', p_instructional_teacher
  );
end;
$$;

revoke all on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_lesson_session_transactional(uuid, uuid, text, text, text, text, numeric)
  to service_role;

comment on column public.syllabus_lesson_associations.instructional_teacher is
  'Facilitator-owned current instructional assignment. Slate is intentionally excluded.';
comment on column public.lesson_sessions.instructional_teacher is
  'Immutable actual instructor recorded by teacher-bound protected starts. Null is retained for legacy sessions created without teacher authority.';
