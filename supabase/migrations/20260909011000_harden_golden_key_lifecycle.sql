-- Make Golden Key application and completion atomic and idempotent.
-- Inventory is durable learner state. Per-lesson application survives resume until
-- the exact protected instructional execution completes.

create table if not exists public.golden_key_session_finalizations (
  execution_session_id uuid primary key references public.lesson_sessions(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  consumed_applied_key boolean not null default false,
  awarded_earned_key boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.golden_key_session_finalizations enable row level security;
revoke all on table public.golden_key_session_finalizations from public, anon, authenticated;
grant select, insert on table public.golden_key_session_finalizations to service_role;

comment on table public.golden_key_session_finalizations is
  'Idempotency ledger for Golden Key inventory changes committed after an exact protected instructional execution completes.';

create or replace function public.apply_golden_key_to_lesson(
  p_learner_id uuid,
  p_lesson_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_learner public.learners%rowtype;
  v_lesson_key text := btrim(coalesce(p_lesson_key, ''));
  v_active jsonb;
  v_remaining integer;
begin
  if p_learner_id is null or v_lesson_key = '' then
    raise exception 'learner and lesson key are required' using errcode = '22023';
  end if;

  select * into v_learner
    from public.learners
    where id = p_learner_id
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'state', 'learner_missing');
  end if;

  v_active := coalesce(v_learner.active_golden_keys, '{}'::jsonb);
  if coalesce(v_learner.golden_keys_enabled, true) is false then
    return jsonb_build_object(
      'ok', false, 'state', 'disabled',
      'goldenKeys', coalesce(v_learner.golden_keys, 0),
      'activeGoldenKeys', v_active
    );
  end if;

  if coalesce((v_active ->> v_lesson_key)::boolean, false) then
    return jsonb_build_object(
      'ok', true, 'state', 'already_applied',
      'goldenKeys', coalesce(v_learner.golden_keys, 0),
      'activeGoldenKeys', v_active,
      'goldenKeyBonusMin', v_learner.golden_key_bonus_min
    );
  end if;

  if coalesce(v_learner.golden_keys, 0) <= 0 then
    return jsonb_build_object(
      'ok', false, 'state', 'no_keys',
      'goldenKeys', 0,
      'activeGoldenKeys', v_active
    );
  end if;

  v_active := jsonb_set(v_active, array[v_lesson_key], 'true'::jsonb, true);
  v_remaining := v_learner.golden_keys - 1;

  update public.learners
    set golden_keys = v_remaining,
        active_golden_keys = v_active
    where id = p_learner_id;

  return jsonb_build_object(
    'ok', true, 'state', 'applied',
    'goldenKeys', v_remaining,
    'activeGoldenKeys', v_active,
    'goldenKeyBonusMin', v_learner.golden_key_bonus_min
  );
end;
$$;

revoke all on function public.apply_golden_key_to_lesson(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_golden_key_to_lesson(uuid, text) to service_role;

comment on function public.apply_golden_key_to_lesson(uuid, text) is
  'Atomically applies at most one inventory Golden Key to one lesson key. Repeated application is idempotent and never double-decrements inventory.';

create or replace function public.finalize_golden_key_for_session(
  p_execution_session_id uuid,
  p_learner_id uuid,
  p_browser_session_id uuid,
  p_lesson_key text,
  p_award_earned_key boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.lesson_sessions%rowtype;
  v_existing public.golden_key_session_finalizations%rowtype;
  v_learner public.learners%rowtype;
  v_lesson_key text := btrim(coalesce(p_lesson_key, ''));
  v_active jsonb;
  v_consumed boolean := false;
  v_awarded boolean := false;
  v_keys integer;
begin
  if p_execution_session_id is null or p_learner_id is null or p_browser_session_id is null or v_lesson_key = '' then
    raise exception 'execution, learner, browser, and lesson identities are required' using errcode = '22023';
  end if;

  select * into v_session
    from public.lesson_sessions
    where id = p_execution_session_id
    for update;
  if not found
     or v_session.learner_id <> p_learner_id
     or v_session.session_id <> p_browser_session_id then
    return jsonb_build_object('ok', false, 'state', 'ownership_mismatch');
  end if;
  if v_session.ended_at is null or v_session.ended_reason is distinct from 'completed' then
    return jsonb_build_object('ok', false, 'state', 'session_not_completed', 'endedReason', v_session.ended_reason);
  end if;

  select * into v_existing
    from public.golden_key_session_finalizations
    where execution_session_id = p_execution_session_id;
  if found then
    return jsonb_build_object(
      'ok', true, 'state', 'already_finalized',
      'consumedAppliedKey', v_existing.consumed_applied_key,
      'awardedEarnedKey', v_existing.awarded_earned_key
    );
  end if;

  select * into v_learner
    from public.learners
    where id = p_learner_id
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'state', 'learner_missing');
  end if;

  v_active := coalesce(v_learner.active_golden_keys, '{}'::jsonb);
  v_keys := coalesce(v_learner.golden_keys, 0);

  if coalesce((v_active ->> v_lesson_key)::boolean, false) then
    v_active := v_active - v_lesson_key;
    v_consumed := true;
  end if;

  -- The feature flag controls future use/earning. If it is disabled at the exact
  -- moment of completion, do not manufacture a new key. A previously applied key
  -- is still cleared so it cannot remain stuck on a completed lesson.
  if coalesce(p_award_earned_key, false) and coalesce(v_learner.golden_keys_enabled, true) then
    v_keys := v_keys + 1;
    v_awarded := true;
  end if;

  update public.learners
    set golden_keys = v_keys,
        active_golden_keys = v_active
    where id = p_learner_id;

  insert into public.golden_key_session_finalizations (
    execution_session_id,
    learner_id,
    lesson_key,
    consumed_applied_key,
    awarded_earned_key
  ) values (
    p_execution_session_id,
    p_learner_id,
    v_lesson_key,
    v_consumed,
    v_awarded
  );

  return jsonb_build_object(
    'ok', true, 'state', 'finalized',
    'consumedAppliedKey', v_consumed,
    'awardedEarnedKey', v_awarded,
    'goldenKeys', v_keys,
    'activeGoldenKeys', v_active
  );
end;
$$;

revoke all on function public.finalize_golden_key_for_session(uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.finalize_golden_key_for_session(uuid, uuid, uuid, text, boolean) to service_role;

comment on function public.finalize_golden_key_for_session(uuid, uuid, uuid, text, boolean) is
  'Idempotently clears a consumed lesson Golden Key and awards at most one earned key after the exact protected instructional execution has completed.';