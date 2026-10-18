-- Facilitator-controlled Syllabus removal, including started/completed attempts.
-- Keep-evidence removes the Syllabus occurrence only; delete-evidence also
-- removes canonical session evidence and exact linked instructional sessions.
create table if not exists public.syllabus_lesson_removals (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  occurrence_id text not null,
  source_occurrence_id text,
  forecast_lineage_id text,
  evidence_disposition text not null check (evidence_disposition in ('keep', 'delete')),
  execution_session_ids uuid[] not null default '{}'::uuid[],
  removed_at timestamptz not null default now(),
  removed_by uuid not null references auth.users(id),
  constraint syllabus_lesson_removals_exact_unique
    unique (facilitator_id, learner_id, lesson_key, occurrence_id),
  constraint syllabus_lesson_removals_actor_check check (removed_by = facilitator_id),
  constraint syllabus_lesson_removals_key_check check (length(btrim(lesson_key)) > 0),
  constraint syllabus_lesson_removals_occurrence_check check (length(btrim(occurrence_id)) > 0)
);

create index if not exists syllabus_lesson_removals_learner_idx
  on public.syllabus_lesson_removals (facilitator_id, learner_id);

alter table public.syllabus_lesson_removals enable row level security;
revoke all on public.syllabus_lesson_removals from public, anon, authenticated;
grant select, insert on public.syllabus_lesson_removals to service_role;

-- Historical facilitator attestations are immutable except for this explicit,
-- PIN-verified, service-only removal transaction. The trigger remains unchanged
-- for normal writers and all other update/delete attempts.
create or replace function public.reject_syllabus_legacy_activity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE'
    and current_setting('ms_sonoma.authorized_lesson_removal', true) = 'yes' then
    return old;
  end if;
  raise exception 'Historical Syllabus activity records are append-only';
end;
$$;
revoke all on function public.reject_syllabus_legacy_activity_mutation() from public, anon, authenticated;

create or replace function public.record_facilitator_lesson_removal(
  p_facilitator_id uuid,
  p_learner_id uuid,
  p_lesson_key text,
  p_occurrence_id text,
  p_source_occurrence_id text,
  p_forecast_lineage_id text,
  p_evidence_disposition text,
  p_execution_session_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_session_identifiers text[] := '{}'::text[];
  v_requested_count integer := coalesce(array_length(p_execution_session_ids, 1), 0);
  v_matching_count integer;
  v_review_run_ids uuid[] := '{}'::uuid[];
  v_existing public.syllabus_lesson_removals%rowtype;
begin
  if p_evidence_disposition not in ('keep', 'delete')
    or nullif(btrim(p_lesson_key), '') is null
    or nullif(btrim(p_occurrence_id), '') is null
    or p_execution_session_ids is null then
    raise exception 'Invalid lesson removal request';
  end if;
  if not exists (
    select 1 from public.learners
    where id = p_learner_id
      and (facilitator_id = p_facilitator_id or owner_id = p_facilitator_id or user_id = p_facilitator_id)
  ) then
    raise exception 'Learner not found or unauthorized';
  end if;
  select * into v_existing from public.syllabus_lesson_removals
    where facilitator_id = p_facilitator_id and learner_id = p_learner_id
      and lesson_key = p_lesson_key and occurrence_id = p_occurrence_id
    for update;
  if found then
    if v_existing.evidence_disposition != p_evidence_disposition then
      raise exception 'The removal choice was already recorded for this occurrence';
    end if;
    return jsonb_build_object('removed', true, 'already_removed', true, 'evidence_disposition', p_evidence_disposition);
  end if;

  select count(*) into v_matching_count from public.lesson_sessions
    where id = any(p_execution_session_ids)
      and learner_id = p_learner_id;
  if v_matching_count != v_requested_count then
    raise exception 'One or more linked sessions could not be verified';
  end if;
  select coalesce(array_agg(session_identity), '{}'::text[]) into v_session_identifiers from (
    select id::text as session_identity from public.lesson_sessions where id = any(p_execution_session_ids)
    union
    select selected.session_id::text as session_identity from public.lesson_sessions selected
      where selected.id = any(p_execution_session_ids)
        and selected.session_id is not null
        and not exists (
          select 1 from public.lesson_sessions sibling
          where sibling.learner_id = p_learner_id
            and sibling.id <> selected.id
            and sibling.session_id = selected.session_id
        )
  ) identifiers;

  insert into public.syllabus_lesson_removals (
    facilitator_id, learner_id, lesson_key, occurrence_id, source_occurrence_id,
    forecast_lineage_id, evidence_disposition, execution_session_ids, removed_by
  ) values (
    p_facilitator_id, p_learner_id, p_lesson_key, p_occurrence_id, p_source_occurrence_id,
    p_forecast_lineage_id, p_evidence_disposition, p_execution_session_ids, p_facilitator_id
  );

  if p_evidence_disposition = 'keep' then
    -- A removed active lesson must not continue owning the learner's execution
    -- lease. Preserve its events and evidence, but record that it was released
    -- rather than mistakenly promoting an interrupted attempt to completion.
    with released as (
      update public.lesson_sessions
        set ended_at = now(), ended_reason = 'released', last_activity_at = now()
        where id = any(p_execution_session_ids)
          and learner_id = p_learner_id
          and ended_at is null
        returning id, learner_id, lesson_id, ended_at
    )
    insert into public.lesson_session_events (
      session_id, learner_id, lesson_id, event_type, occurred_at, metadata
    ) select id, learner_id, lesson_id, 'exited', ended_at,
      jsonb_build_object('reason', 'facilitator_removed_lesson')
    from released;
  end if;

  if p_evidence_disposition = 'delete' then
    -- Review items anchored to a deleted mastery check cannot continue to
    -- report mastery or retention. Other review items and runs are retained.
    select coalesce(array_agg(distinct reviews.run_id), '{}'::uuid[])
      into v_review_run_ids
    from public.learning_review_items reviews
    where reviews.facilitator_id = p_facilitator_id
      and reviews.learner_id = p_learner_id
      and reviews.anchor_mastery_check_id in (
        select events.mastery_check_id
        from public.learning_evidence_events events
        join public.learning_evidence_sessions evidence
          on evidence.id = events.evidence_session_id
        where evidence.facilitator_id = p_facilitator_id
          and evidence.learner_id = p_learner_id
          and (
            evidence.session_id = any(v_session_identifiers)
            or (evidence.lesson_key = p_lesson_key and evidence.session_id like 'slate:%' and evidence.syllabus_occurrence_id = p_occurrence_id)
          )
          and events.mastery_check_id is not null
      );
    delete from public.learning_review_items reviews
      where reviews.facilitator_id = p_facilitator_id
        and reviews.learner_id = p_learner_id
        and reviews.anchor_mastery_check_id in (
          select events.mastery_check_id
          from public.learning_evidence_events events
          join public.learning_evidence_sessions evidence
            on evidence.id = events.evidence_session_id
          where evidence.facilitator_id = p_facilitator_id
            and evidence.learner_id = p_learner_id
            and (
              evidence.session_id = any(v_session_identifiers)
              or (evidence.lesson_key = p_lesson_key and evidence.session_id like 'slate:%' and evidence.syllabus_occurrence_id = p_occurrence_id)
            )
            and events.mastery_check_id is not null
        );
    delete from public.learning_review_runs runs
      where runs.id = any(v_review_run_ids)
        and runs.facilitator_id = p_facilitator_id and runs.learner_id = p_learner_id
        and not exists (
          select 1 from public.learning_review_items items where items.run_id = runs.id
        );
    -- These events cascade when their parent evidence session is deleted.
    delete from public.learning_evidence_sessions evidence
      where evidence.facilitator_id = p_facilitator_id and evidence.learner_id = p_learner_id
        and (
          evidence.session_id = any(v_session_identifiers)
          or (evidence.lesson_key = p_lesson_key and evidence.session_id like 'slate:%' and evidence.syllabus_occurrence_id = p_occurrence_id)
        );

    if v_requested_count > 0 then
      delete from public.lesson_session_events
        where session_id::text = any(v_session_identifiers)
          and learner_id = p_learner_id;
      -- Legacy analytics tables, where present, use the same exact session ID.
      if to_regclass('public.lesson_transcripts') is not null then
        execute 'delete from public.lesson_transcripts where session_id::text = any($1)' using v_session_identifiers;
      end if;
      if to_regclass('public.repeat_events') is not null then
        execute 'delete from public.repeat_events where session_id::text = any($1)' using v_session_identifiers;
      end if;
      if to_regclass('public.facilitator_notes') is not null then
        execute 'delete from public.facilitator_notes where session_id::text = any($1)' using v_session_identifiers;
      end if;
      if to_regclass('public.session_metrics') is not null then
        execute 'delete from public.session_metrics where session_id::text = any($1)' using v_session_identifiers;
      end if;
      -- Mrs. Webb compositions, Mr. Slate Liftoff, and lease/handoff children
      -- reference lesson_sessions with ON DELETE CASCADE.
      delete from public.lesson_sessions
        where id = any(p_execution_session_ids)
          and learner_id = p_learner_id;
    end if;

    -- A selected historical attestation is removed without changing other history.
    if p_occurrence_id like 'historical:%' then
      perform set_config('ms_sonoma.authorized_lesson_removal', 'yes', true);
      delete from public.syllabus_legacy_activity_records
        where id::text = substring(p_occurrence_id from 12)
          and facilitator_id = p_facilitator_id and learner_id = p_learner_id
          and lesson_key = p_lesson_key;
      perform set_config('ms_sonoma.authorized_lesson_removal', '', true);
    end if;

    -- Slate's separately recorded review evidence is only removed when directly
    -- attributed to the selected parent occurrence; never by lesson key alone.
    delete from public.slate_session_completions
      where facilitator_id = p_facilitator_id and learner_id = p_learner_id
        and lesson_key = p_lesson_key and syllabus_occurrence_id = p_occurrence_id;
  end if;

  return jsonb_build_object('removed', true, 'already_removed', false, 'evidence_disposition', p_evidence_disposition);
end;
$$;

revoke all on function public.record_facilitator_lesson_removal(
  uuid, uuid, text, text, text, text, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.record_facilitator_lesson_removal(
  uuid, uuid, text, text, text, text, text, uuid[]
) to service_role;

comment on table public.syllabus_lesson_removals is
  'PIN-authorized facilitator decision to omit one exact lesson occurrence from the Syllabus, independent of retaining mastery evidence.';
