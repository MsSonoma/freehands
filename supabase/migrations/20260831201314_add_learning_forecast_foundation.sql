-- Canonical one-week instructional forecasts and lineage-safe materialization receipts.

alter table public.syllabus_forecast_items
  add column if not exists description text;

alter table public.syllabus_forecast_items
  drop constraint if exists syllabus_forecast_description_check;
alter table public.syllabus_forecast_items
  add constraint syllabus_forecast_description_check
  check (description is null or (length(btrim(description)) > 0 and length(description) <= 2000));

alter table public.syllabus_forecast_items
  drop constraint if exists syllabus_forecast_origin_check;
alter table public.syllabus_forecast_items
  add constraint syllabus_forecast_origin_check
  check (origin in ('legacy_import', 'generated', 'facilitator', 'mastery_reforecast', 'learning_forecast'));

alter table public.syllabus_revisions
  drop constraint if exists syllabus_revisions_proposal_kind_check;
alter table public.syllabus_revisions
  add constraint syllabus_revisions_proposal_kind_check
  check (
    (proposal_kind is null and proposal_key is null)
    or (
      proposal_kind in ('mastery_reforecast', 'learning_forecast')
      and length(btrim(proposal_key)) > 0
    )
  );

create unique index if not exists syllabus_revisions_one_proposal_per_kind_per_base
  on public.syllabus_revisions(syllabus_id, base_revision_id, proposal_kind)
  where activated_at is null and proposal_kind is not null;

create table if not exists public.syllabus_forecast_materializations (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.syllabi(id) on delete cascade,
  lineage_id uuid not null,
  generation_input_hash text not null,
  lesson_key text,
  status text not null default 'generating',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint syllabus_forecast_materialization_unique unique (syllabus_id, lineage_id),
  constraint syllabus_forecast_materialization_hash_check check (length(btrim(generation_input_hash)) > 0),
  constraint syllabus_forecast_materialization_lesson_key_check check (lesson_key is null or length(btrim(lesson_key)) > 0),
  constraint syllabus_forecast_materialization_status_check check (status in ('generating', 'generated', 'binding_failed', 'bound', 'generation_failed'))
);

alter table public.syllabus_forecast_materializations enable row level security;
revoke all on table public.syllabus_forecast_materializations from public, anon, authenticated, service_role;
grant select, insert, update on table public.syllabus_forecast_materializations to service_role;

comment on column public.syllabus_forecast_items.description is 'First-class concise instructional intent description; null for legacy rows.';
comment on table public.syllabus_forecast_materializations is 'Server-only idempotency and repair receipt for binding a generated artifact to one Syllabus lineage.';

create or replace function public.replace_syllabus_proposal(
  p_syllabus_id uuid,
  p_expected_active_revision_id uuid,
  p_proposal_kind text,
  p_effective_from date,
  p_schema_version integer,
  p_goals jsonb,
  p_subjects jsonb,
  p_weekly_pattern jsonb,
  p_teaching_guidance jsonb,
  p_planning_policy jsonb,
  p_legacy_provenance jsonb,
  p_change_reason text,
  p_proposal_key text,
  p_forecast_items jsonb,
  p_replace_existing boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_syllabus public.syllabi%rowtype;
  existing_proposal public.syllabus_revisions%rowtype;
  proposed_revision public.syllabus_revisions%rowtype;
  next_revision_number integer;
  insert_attempt integer := 0;
begin
  if p_proposal_kind not in ('mastery_reforecast', 'learning_forecast') then
    raise exception 'Unsupported Syllabus proposal kind';
  end if;
  if p_proposal_key is null or length(btrim(p_proposal_key)) = 0 then
    raise exception 'Syllabus proposal key is required';
  end if;
  if jsonb_typeof(p_forecast_items) is distinct from 'array' then
    raise exception 'Syllabus proposal forecast_items must be an array';
  end if;

  select * into current_syllabus
  from public.syllabi
  where id = p_syllabus_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Syllabus not found'; end if;
  if current_syllabus.active_revision_id is distinct from p_expected_active_revision_id then
    raise exception using errcode = '40001', message = 'Syllabus active revision changed';
  end if;
  if p_proposal_kind = 'mastery_reforecast' and p_effective_from is distinct from current_date then
    raise exception 'Mastery reforecast proposals must become effective today';
  end if;
  -- Learning forecasts use the facilitator-local date resolved by the server.
  if p_proposal_kind = 'learning_forecast'
    and (p_effective_from is null or abs(p_effective_from - current_date) > 1) then
    raise exception 'Instructional forecast effective date is outside the current local-date boundary';
  end if;

  select * into existing_proposal
  from public.syllabus_revisions
  where syllabus_id = p_syllabus_id
    and base_revision_id = p_expected_active_revision_id
    and activated_at is null
    and proposal_kind = p_proposal_kind
  for update;

  if found and existing_proposal.proposal_key = p_proposal_key and existing_proposal.effective_from = p_effective_from then
    return jsonb_build_object('revision', to_jsonb(existing_proposal), 'reused', true);
  end if;
  if found and not p_replace_existing then
    raise exception using errcode = '40001', message = 'A newer Syllabus proposal already exists';
  end if;
  if found then
    delete from public.syllabus_revisions where id = existing_proposal.id and activated_at is null and proposal_kind = p_proposal_kind;
  end if;

  loop
    insert_attempt := insert_attempt + 1;
    select coalesce(max(revision_number), 0) + 1 into next_revision_number
    from public.syllabus_revisions where syllabus_id = p_syllabus_id;
    begin
      insert into public.syllabus_revisions (
        syllabus_id, revision_number, base_revision_id, effective_from, schema_version,
        goals, subjects, weekly_pattern, teaching_guidance, planning_policy,
        legacy_provenance, change_reason, proposal_kind, proposal_key
      ) values (
        p_syllabus_id, next_revision_number, p_expected_active_revision_id, p_effective_from, p_schema_version,
        p_goals, p_subjects, p_weekly_pattern, p_teaching_guidance, p_planning_policy,
        p_legacy_provenance, p_change_reason, p_proposal_kind, p_proposal_key
      ) returning * into proposed_revision;
      exit;
    exception when unique_violation then
      if insert_attempt >= 3 then raise; end if;
    end;
  end loop;

  insert into public.syllabus_forecast_items (
    revision_id, lineage_id, planned_date, subject, title, description,
    lesson_key, item_type, origin, sort_order, metadata
  )
  select proposed_revision.id, item.lineage_id, item.planned_date, item.subject, item.title,
    nullif(btrim(item.description), ''), item.lesson_key, item.item_type, item.origin,
    item.sort_order, coalesce(item.metadata, '{}'::jsonb)
  from jsonb_to_recordset(p_forecast_items) as item(
    lineage_id uuid, planned_date date, subject text, title text, description text,
    lesson_key text, item_type text, origin text, sort_order integer, metadata jsonb
  );

  return jsonb_build_object('revision', to_jsonb(proposed_revision), 'reused', false);
end;
$$;

revoke all on function public.replace_syllabus_proposal(
  uuid, uuid, text, date, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.replace_syllabus_proposal(
  uuid, uuid, text, date, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb, boolean
) to service_role;

create or replace function public.replace_syllabus_mastery_proposal(
  p_syllabus_id uuid, p_expected_active_revision_id uuid, p_effective_from date,
  p_schema_version integer, p_goals jsonb, p_subjects jsonb, p_weekly_pattern jsonb,
  p_teaching_guidance jsonb, p_planning_policy jsonb, p_legacy_provenance jsonb,
  p_change_reason text, p_proposal_key text, p_forecast_items jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select public.replace_syllabus_proposal(
    p_syllabus_id, p_expected_active_revision_id, 'mastery_reforecast', p_effective_from,
    p_schema_version, p_goals, p_subjects, p_weekly_pattern, p_teaching_guidance,
    p_planning_policy, p_legacy_provenance, p_change_reason, p_proposal_key, p_forecast_items
  );
$$;

revoke all on function public.replace_syllabus_mastery_proposal(
  uuid, uuid, date, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.replace_syllabus_mastery_proposal(
  uuid, uuid, date, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb
) to service_role;

create or replace function public.claim_syllabus_forecast_materialization(
  p_syllabus_id uuid,
  p_lineage_id uuid,
  p_generation_input_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  receipt public.syllabus_forecast_materializations%rowtype;
begin
  perform 1 from public.syllabi where id = p_syllabus_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Syllabus not found'; end if;

  select * into receipt from public.syllabus_forecast_materializations
  where syllabus_id = p_syllabus_id and lineage_id = p_lineage_id for update;

  if not found then
    insert into public.syllabus_forecast_materializations (syllabus_id, lineage_id, generation_input_hash, status)
    values (p_syllabus_id, p_lineage_id, p_generation_input_hash, 'generating')
    returning * into receipt;
    return jsonb_build_object('receipt', to_jsonb(receipt), 'claimed', true);
  end if;

  if receipt.lesson_key is not null then
    return jsonb_build_object('receipt', to_jsonb(receipt), 'claimed', false);
  end if;
  if receipt.status = 'generating' then
    return jsonb_build_object('receipt', to_jsonb(receipt), 'claimed', false);
  end if;

  update public.syllabus_forecast_materializations
  set generation_input_hash = p_generation_input_hash, status = 'generating', last_error = null, updated_at = now()
  where id = receipt.id returning * into receipt;
  return jsonb_build_object('receipt', to_jsonb(receipt), 'claimed', true);
end;
$$;

revoke all on function public.claim_syllabus_forecast_materialization(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_syllabus_forecast_materialization(uuid, uuid, text)
  to service_role;

create or replace function public.commit_syllabus_revision_activation(
  p_syllabus_id uuid,
  p_revision_id uuid,
  p_expected_active_revision_id uuid
)
returns public.syllabus_revisions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_syllabus public.syllabi%rowtype;
  proposed_revision public.syllabus_revisions%rowtype;
begin
  select * into current_syllabus from public.syllabi where id = p_syllabus_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Syllabus not found'; end if;
  if current_syllabus.active_revision_id is distinct from p_expected_active_revision_id then
    raise exception using errcode = '40001', message = 'Syllabus active revision changed';
  end if;
  select * into proposed_revision from public.syllabus_revisions
  where id = p_revision_id and syllabus_id = p_syllabus_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Proposed Syllabus revision not found'; end if;
  if proposed_revision.activated_at is not null then raise exception 'Proposed Syllabus revision is already activated'; end if;
  if proposed_revision.base_revision_id is distinct from p_expected_active_revision_id then
    raise exception using errcode = '40001', message = 'Proposed revision is not based on the current active revision';
  end if;
  -- The server supplies facilitator-local today. Keep the database guard
  -- bounded to the only possible UTC/local calendar difference.
  if proposed_revision.effective_from is null or abs(proposed_revision.effective_from - current_date) > 1 then
    raise exception 'Phase 1 Syllabus revision is outside the current local-date boundary';
  end if;
  if proposed_revision.proposal_kind is not null and proposed_revision.id is distinct from (
    select canonical.id from public.syllabus_revisions canonical
    where canonical.syllabus_id = p_syllabus_id
      and canonical.base_revision_id = p_expected_active_revision_id
      and canonical.activated_at is null
      and canonical.proposal_kind = proposed_revision.proposal_kind
    order by canonical.revision_number desc, canonical.id desc limit 1
  ) then
    raise exception using errcode = '40001', message = 'Syllabus proposal is superseded or non-canonical';
  end if;
  perform set_config('app.syllabus_activation_commit', 'on', true);
  update public.syllabus_revisions set activated_at = now() where id = p_revision_id returning * into proposed_revision;
  update public.syllabi set active_revision_id = p_revision_id, updated_at = now() where id = p_syllabus_id;
  return proposed_revision;
end;
$$;

revoke all on function public.commit_syllabus_revision_activation(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.commit_syllabus_revision_activation(uuid, uuid, uuid)
  to service_role;
