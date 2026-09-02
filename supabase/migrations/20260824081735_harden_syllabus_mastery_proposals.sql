alter table public.syllabus_revisions
  add column if not exists proposal_kind text,
  add column if not exists proposal_key text;

with ranked_mastery_proposals as (
  select
    id,
    row_number() over (
      partition by syllabus_id, base_revision_id
      order by revision_number desc, created_at desc, id desc
    ) as proposal_rank
  from public.syllabus_revisions
  where activated_at is null
    and change_reason like 'Mastery evidence proposal:%'
)
delete from public.syllabus_revisions revision
using ranked_mastery_proposals ranked
where revision.id = ranked.id
  and ranked.proposal_rank > 1;

update public.syllabus_revisions revision
set proposal_kind = 'mastery_reforecast',
    proposal_key = coalesce(
      (
        select item.metadata->'mastery_reforecast'->>'proposal_key'
        from public.syllabus_forecast_items item
        where item.revision_id = revision.id
          and item.metadata->'mastery_reforecast'->>'proposal_key' is not null
        order by item.created_at, item.id
        limit 1
      ),
      revision.id::text
    )
where revision.activated_at is null
  and revision.change_reason like 'Mastery evidence proposal:%';

alter table public.syllabus_revisions
  add constraint syllabus_revisions_proposal_kind_check
  check (
    (proposal_kind is null and proposal_key is null)
    or (
      proposal_kind = 'mastery_reforecast'
      and length(btrim(proposal_key)) > 0
    )
  );

create unique index syllabus_revisions_one_mastery_proposal_per_base
  on public.syllabus_revisions(syllabus_id, base_revision_id)
  where activated_at is null and proposal_kind = 'mastery_reforecast';

create or replace function public.replace_syllabus_mastery_proposal(
  p_syllabus_id uuid,
  p_expected_active_revision_id uuid,
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
  p_forecast_items jsonb
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
  select * into current_syllabus
  from public.syllabi
  where id = p_syllabus_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Syllabus not found';
  end if;

  if current_syllabus.active_revision_id is distinct from p_expected_active_revision_id then
    raise exception using errcode = '40001', message = 'Syllabus active revision changed';
  end if;

  if p_effective_from is distinct from current_date then
    raise exception 'Mastery reforecast proposals must become effective today';
  end if;

  if p_proposal_key is null or length(btrim(p_proposal_key)) = 0 then
    raise exception 'Mastery reforecast proposal key is required';
  end if;

  if jsonb_typeof(p_forecast_items) is distinct from 'array' then
    raise exception 'Mastery reforecast forecast_items must be an array';
  end if;

  select * into existing_proposal
  from public.syllabus_revisions
  where syllabus_id = p_syllabus_id
    and base_revision_id = p_expected_active_revision_id
    and activated_at is null
    and proposal_kind = 'mastery_reforecast'
  for update;

  if found
    and existing_proposal.proposal_key = p_proposal_key
    and existing_proposal.effective_from = p_effective_from
  then
    return jsonb_build_object('revision', to_jsonb(existing_proposal), 'reused', true);
  end if;

  if found then
    delete from public.syllabus_revisions
    where id = existing_proposal.id
      and activated_at is null
      and proposal_kind = 'mastery_reforecast';
  end if;

  loop
    insert_attempt := insert_attempt + 1;
    select coalesce(max(revision_number), 0) + 1
      into next_revision_number
    from public.syllabus_revisions
    where syllabus_id = p_syllabus_id;

    begin
      insert into public.syllabus_revisions (
        syllabus_id,
        revision_number,
        base_revision_id,
        effective_from,
        schema_version,
        goals,
        subjects,
        weekly_pattern,
        teaching_guidance,
        planning_policy,
        legacy_provenance,
        change_reason,
        proposal_kind,
        proposal_key
      ) values (
        p_syllabus_id,
        next_revision_number,
        p_expected_active_revision_id,
        p_effective_from,
        p_schema_version,
        p_goals,
        p_subjects,
        p_weekly_pattern,
        p_teaching_guidance,
        p_planning_policy,
        p_legacy_provenance,
        p_change_reason,
        'mastery_reforecast',
        p_proposal_key
      )
      returning * into proposed_revision;
      exit;
    exception when unique_violation then
      if insert_attempt >= 3 then
        raise;
      end if;
    end;
  end loop;

  insert into public.syllabus_forecast_items (
    revision_id,
    lineage_id,
    planned_date,
    subject,
    title,
    lesson_key,
    item_type,
    origin,
    sort_order,
    metadata
  )
  select
    proposed_revision.id,
    item.lineage_id,
    item.planned_date,
    item.subject,
    item.title,
    item.lesson_key,
    item.item_type,
    item.origin,
    item.sort_order,
    coalesce(item.metadata, '{}'::jsonb)
  from jsonb_to_recordset(p_forecast_items) as item(
    lineage_id uuid,
    planned_date date,
    subject text,
    title text,
    lesson_key text,
    item_type text,
    origin text,
    sort_order integer,
    metadata jsonb
  );

  return jsonb_build_object('revision', to_jsonb(proposed_revision), 'reused', false);
end;
$$;

revoke all on function public.replace_syllabus_mastery_proposal(
  uuid, uuid, date, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.replace_syllabus_mastery_proposal(
  uuid, uuid, date, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb
) to service_role;

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
  select * into current_syllabus
  from public.syllabi
  where id = p_syllabus_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Syllabus not found';
  end if;

  if current_syllabus.active_revision_id is distinct from p_expected_active_revision_id then
    raise exception using errcode = '40001', message = 'Syllabus active revision changed';
  end if;

  select * into proposed_revision
  from public.syllabus_revisions
  where id = p_revision_id
    and syllabus_id = p_syllabus_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Proposed Syllabus revision not found';
  end if;

  if proposed_revision.activated_at is not null then
    raise exception 'Proposed Syllabus revision is already activated';
  end if;

  if proposed_revision.base_revision_id is distinct from p_expected_active_revision_id then
    raise exception using errcode = '40001', message = 'Proposed revision is not based on the current active revision';
  end if;

  if proposed_revision.effective_from is distinct from current_date then
    raise exception 'Phase 1 Syllabus revisions must become effective today';
  end if;

  if proposed_revision.change_reason like 'Mastery evidence proposal:%'
    and proposed_revision.proposal_kind is distinct from 'mastery_reforecast'
  then
    raise exception using errcode = '40001', message = 'Mastery reforecast proposal is superseded or non-canonical';
  end if;

  if proposed_revision.proposal_kind = 'mastery_reforecast'
    and proposed_revision.id is distinct from (
      select canonical.id
      from public.syllabus_revisions canonical
      where canonical.syllabus_id = p_syllabus_id
        and canonical.base_revision_id = p_expected_active_revision_id
        and canonical.activated_at is null
        and canonical.proposal_kind = 'mastery_reforecast'
      order by canonical.revision_number desc, canonical.id desc
      limit 1
    )
  then
    raise exception using errcode = '40001', message = 'Mastery reforecast proposal is superseded or non-canonical';
  end if;

  perform set_config('app.syllabus_activation_commit', 'on', true);

  update public.syllabus_revisions
  set activated_at = now()
  where id = p_revision_id
  returning * into proposed_revision;

  update public.syllabi
  set active_revision_id = p_revision_id,
      updated_at = now()
  where id = p_syllabus_id;

  return proposed_revision;
end;
$$;

revoke all on function public.commit_syllabus_revision_activation(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.commit_syllabus_revision_activation(uuid, uuid, uuid)
  to service_role;
