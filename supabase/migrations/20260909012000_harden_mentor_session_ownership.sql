-- Separate Mr. Mentor's durable conversation thread from its temporary execution lock.
-- Ownership is per-tab session_id, not merely the long-lived device cookie.

alter table public.mentor_sessions
  add column if not exists ended_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.mentor_sessions'::regclass
      and conname = 'mentor_sessions_ended_reason_check'
  ) then
    alter table public.mentor_sessions
      add constraint mentor_sessions_ended_reason_check
      check (ended_reason is null or ended_reason in ('taken_over', 'expired', 'released', 'force_ended'));
  end if;
end;
$$;

-- Historical setup used a full UNIQUE(facilitator_id,is_active), which prevents
-- more than one inactive history row. Replace it with the intended active-only lock.
alter table public.mentor_sessions
  drop constraint if exists unique_active_session_per_facilitator;
create unique index if not exists unique_active_session_per_facilitator
  on public.mentor_sessions(facilitator_id)
  where is_active = true;

comment on column public.mentor_sessions.ended_reason is
  'Why the temporary Mentor execution lock ended. Conversation history lives independently in mentor_conversation_threads.';

create or replace function public.acquire_mentor_session_transactional(
  p_facilitator_id uuid,
  p_session_id text,
  p_device_id text,
  p_device_name text,
  p_allow_takeover boolean,
  p_expected_conflicting_session_id uuid,
  p_timeout_minutes integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_active public.mentor_sessions%rowtype;
  v_created public.mentor_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_timeout integer := greatest(1, least(coalesce(p_timeout_minutes, 15), 120));
  v_cutoff timestamptz;
begin
  if p_facilitator_id is null or nullif(btrim(p_session_id), '') is null or nullif(btrim(p_device_id), '') is null then
    raise exception 'facilitator, session, and device identities are required' using errcode = '22023';
  end if;
  v_cutoff := v_now - make_interval(mins => v_timeout);

  -- Serialize the current owner before deciding reuse/conflict/takeover.
  perform 1 from public.mentor_sessions
    where facilitator_id = p_facilitator_id and is_active = true
    for update;

  -- Expire only the temporary lock. The durable conversation thread is untouched.
  update public.mentor_sessions
    set is_active = false,
        ended_reason = 'expired'
    where facilitator_id = p_facilitator_id
      and is_active = true
      and coalesce(last_activity_at, created_at) < v_cutoff;

  select * into v_active
    from public.mentor_sessions
    where facilitator_id = p_facilitator_id
      and is_active = true
    order by created_at desc, id desc
    limit 1;

  if found and v_active.session_id = p_session_id and v_active.device_id = p_device_id then
    update public.mentor_sessions
      set last_activity_at = v_now,
          device_name = coalesce(nullif(btrim(p_device_name), ''), device_name)
      where id = v_active.id
      returning * into v_active;
    return jsonb_build_object('ok', true, 'state', 'reused', 'session', to_jsonb(v_active));
  end if;

  if found then
    if not coalesce(p_allow_takeover, false) then
      return jsonb_build_object(
        'ok', false, 'state', 'conflict',
        'existingSession', jsonb_build_object(
          'id', v_active.id,
          'session_id', v_active.session_id,
          'device_id', v_active.device_id,
          'device_name', v_active.device_name,
          'last_activity_at', v_active.last_activity_at,
          'created_at', v_active.created_at
        )
      );
    end if;
    if p_expected_conflicting_session_id is null or p_expected_conflicting_session_id <> v_active.id then
      return jsonb_build_object(
        'ok', false, 'state', 'stale_conflict',
        'existingSession', jsonb_build_object(
          'id', v_active.id,
          'session_id', v_active.session_id,
          'device_id', v_active.device_id,
          'device_name', v_active.device_name,
          'last_activity_at', v_active.last_activity_at,
          'created_at', v_active.created_at
        )
      );
    end if;

    update public.mentor_sessions
      set is_active = false,
          ended_reason = 'taken_over'
      where id = v_active.id;
  elsif coalesce(p_allow_takeover, false) and p_expected_conflicting_session_id is not null then
    return jsonb_build_object('ok', false, 'state', 'stale_conflict', 'existingSession', null);
  end if;

  insert into public.mentor_sessions (
    facilitator_id, session_id, device_id, device_name, is_active,
    last_activity_at, created_at, ended_reason
  ) values (
    p_facilitator_id, btrim(p_session_id), btrim(p_device_id),
    coalesce(nullif(btrim(p_device_name), ''), 'Unknown device'), true,
    v_now, v_now, null
  ) returning * into v_created;

  return jsonb_build_object(
    'ok', true,
    'state', case when p_expected_conflicting_session_id is not null then 'taken_over' else 'created' end,
    'session', to_jsonb(v_created)
  );
end;
$$;

revoke all on function public.acquire_mentor_session_transactional(uuid, text, text, text, boolean, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.acquire_mentor_session_transactional(uuid, text, text, text, boolean, uuid, integer)
  to service_role;

create or replace function public.heartbeat_mentor_session(
  p_facilitator_id uuid,
  p_session_id text,
  p_device_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.mentor_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_session
    from public.mentor_sessions
    where facilitator_id = p_facilitator_id
      and session_id = p_session_id
    order by created_at desc, id desc
    limit 1
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'active', false, 'state', 'missing');
  end if;
  if v_session.device_id is distinct from p_device_id then
    return jsonb_build_object('ok', false, 'active', false, 'state', 'ownership_mismatch', 'endedReason', v_session.ended_reason);
  end if;
  if not v_session.is_active then
    return jsonb_build_object(
      'ok', true, 'active', false, 'state', 'ended',
      'endedReason', coalesce(v_session.ended_reason, 'ended'),
      'session', to_jsonb(v_session)
    );
  end if;

  update public.mentor_sessions
    set last_activity_at = v_now
    where id = v_session.id
    returning * into v_session;
  return jsonb_build_object('ok', true, 'active', true, 'state', 'active', 'session', to_jsonb(v_session));
end;
$$;

revoke all on function public.heartbeat_mentor_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.heartbeat_mentor_session(uuid, text, text) to service_role;
-- Fence durable thread writes behind the exact active Mentor execution owner.
create or replace function public.write_mentor_thread_owned_transactional(
  p_facilitator_id uuid,
  p_session_id text,
  p_device_id text,
  p_subject_key text,
  p_conversation_history jsonb,
  p_draft_summary text,
  p_token_count integer,
  p_last_local_update_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.mentor_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_facilitator_id is null
    or nullif(btrim(p_session_id), '') is null
    or nullif(btrim(p_device_id), '') is null
    or nullif(btrim(p_subject_key), '') is null then
    raise exception 'facilitator, session, device, and subject identities are required' using errcode = '22023';
  end if;

  select * into v_session
    from public.mentor_sessions
    where facilitator_id = p_facilitator_id
      and session_id = p_session_id
    order by created_at desc, id desc
    limit 1
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'missing');
  end if;
  if v_session.device_id is distinct from p_device_id then
    return jsonb_build_object('ok', false, 'state', 'ownership_mismatch', 'endedReason', v_session.ended_reason);
  end if;
  if not v_session.is_active then
    return jsonb_build_object('ok', false, 'state', 'ended', 'endedReason', coalesce(v_session.ended_reason, 'ended'));
  end if;

  update public.mentor_sessions
    set last_activity_at = v_now
    where id = v_session.id;

  insert into public.mentor_conversation_threads (
    facilitator_id,
    subject_key,
    conversation_history,
    draft_summary,
    token_count,
    last_local_update_at,
    last_activity_at
  ) values (
    p_facilitator_id,
    btrim(p_subject_key),
    coalesce(p_conversation_history, '[]'::jsonb),
    coalesce(p_draft_summary, ''),
    coalesce(p_token_count, 0),
    p_last_local_update_at,
    v_now
  )
  on conflict (facilitator_id, subject_key)
  do update set
    conversation_history = excluded.conversation_history,
    draft_summary = excluded.draft_summary,
    token_count = excluded.token_count,
    last_local_update_at = excluded.last_local_update_at,
    last_activity_at = excluded.last_activity_at;

  return jsonb_build_object('ok', true, 'state', 'written', 'last_activity_at', v_now);
end;
$$;

revoke all on function public.write_mentor_thread_owned_transactional(uuid, text, text, text, jsonb, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.write_mentor_thread_owned_transactional(uuid, text, text, text, jsonb, text, integer, timestamptz)
  to service_role;

create or replace function public.clear_mentor_thread_owned_transactional(
  p_facilitator_id uuid,
  p_session_id text,
  p_device_id text,
  p_subject_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.mentor_sessions%rowtype;
  v_deleted integer := 0;
begin
  select * into v_session
    from public.mentor_sessions
    where facilitator_id = p_facilitator_id
      and session_id = p_session_id
    order by created_at desc, id desc
    limit 1
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'missing');
  end if;
  if v_session.device_id is distinct from p_device_id then
    return jsonb_build_object('ok', false, 'state', 'ownership_mismatch', 'endedReason', v_session.ended_reason);
  end if;
  if not v_session.is_active then
    return jsonb_build_object('ok', false, 'state', 'ended', 'endedReason', coalesce(v_session.ended_reason, 'ended'));
  end if;

  delete from public.mentor_conversation_threads
    where facilitator_id = p_facilitator_id
      and subject_key = btrim(p_subject_key);
  get diagnostics v_deleted = row_count;

  update public.mentor_sessions
    set last_activity_at = clock_timestamp()
    where id = v_session.id;

  return jsonb_build_object('ok', true, 'state', 'cleared', 'deletedCount', v_deleted);
end;
$$;

revoke all on function public.clear_mentor_thread_owned_transactional(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.clear_mentor_thread_owned_transactional(uuid, text, text, text)
  to service_role;

create or replace function public.release_mentor_session_owned_transactional(
  p_facilitator_id uuid,
  p_session_id text,
  p_device_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.mentor_sessions%rowtype;
begin
  select * into v_session
    from public.mentor_sessions
    where facilitator_id = p_facilitator_id
      and session_id = p_session_id
    order by created_at desc, id desc
    limit 1
    for update;

  if not found then
    return jsonb_build_object('ok', true, 'state', 'missing');
  end if;
  if v_session.device_id is distinct from p_device_id then
    return jsonb_build_object('ok', false, 'state', 'ownership_mismatch', 'endedReason', v_session.ended_reason);
  end if;
  if not v_session.is_active then
    return jsonb_build_object('ok', true, 'state', 'already_ended', 'endedReason', coalesce(v_session.ended_reason, 'ended'));
  end if;

  update public.mentor_sessions
    set is_active = false,
        ended_reason = 'released',
        last_activity_at = clock_timestamp()
    where id = v_session.id;

  return jsonb_build_object('ok', true, 'state', 'released');
end;
$$;

revoke all on function public.release_mentor_session_owned_transactional(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.release_mentor_session_owned_transactional(uuid, text, text)
  to service_role;
