-- One-time Day Off relocation. Moves instructional intent rather than regenerating it.
-- A single RPC transaction makes the no-school mark, Syllabus revision, pending
-- forecast carry-forward, and explicit schedule updates all-or-nothing.
alter table public.no_school_dates
  add column if not exists move_to_date date;

alter table public.lesson_schedule
  add column if not exists sort_order integer not null default 0;

alter table public.lesson_schedule
  add column if not exists day_off_move_source_date date,
  add column if not exists day_off_move_destination_date date;

create table if not exists public.syllabus_day_off_moves (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  source_date date not null,
  destination_date date not null,
  active_revision_before uuid references public.syllabus_revisions(id),
  active_revision_after uuid references public.syllabus_revisions(id),
  proposal_revision_before uuid references public.syllabus_revisions(id) on delete set null,
  proposal_revision_after uuid references public.syllabus_revisions(id) on delete set null,
  moved_active_count integer not null default 0,
  moved_proposal_count integer not null default 0,
  moved_schedule_count integer not null default 0,
  moved_slate_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint syllabus_day_off_moves_unique_source unique (facilitator_id, learner_id, source_date),
  constraint syllabus_day_off_moves_distinct_dates check (source_date <> destination_date)
);

-- Existing Slate assignment policy grants service_role SELECT/INSERT/DELETE only.
-- Relocation needs UPDATE to keep occurrence references and scheduled dates intact.
grant update on public.syllabus_slate_assignments to service_role;

alter table public.syllabus_day_off_moves enable row level security;
revoke all on public.syllabus_day_off_moves from public, anon, authenticated;
grant select, insert on public.syllabus_day_off_moves to service_role;

create or replace function public.move_syllabus_day_off(
  p_facilitator_id uuid,
  p_learner_id uuid,
  p_source_date date,
  p_destination_date date,
  p_reason text,
  p_local_today date,
  p_expected_active_revision_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_syllabus public.syllabi%rowtype;
  v_active public.syllabus_revisions%rowtype;
  v_pending public.syllabus_revisions%rowtype;
  v_prior public.syllabus_day_off_moves%rowtype;
  v_active_new uuid;
  v_pending_new uuid;
  v_move_id uuid := gen_random_uuid();
  v_next_number integer;
  v_base_order integer;
  v_active_count integer := 0;
  v_proposal_count integer := 0;
  v_schedule_count integer := 0;
  v_slate_count integer := 0;
begin
  if p_source_date is null or p_destination_date is null or p_local_today is null
    or p_source_date = p_destination_date
    or p_source_date < p_local_today or p_destination_date < p_local_today
    or abs(p_local_today - current_date) > 1 then
    raise exception using errcode = 'P0001', message = 'Day Off move requires distinct current or future dates.';
  end if;

  select * into v_syllabus from public.syllabi
  where facilitator_id = p_facilitator_id and learner_id = p_learner_id
  for update;
  if not found or v_syllabus.active_revision_id is null then
    raise exception using errcode = 'P0001', message = 'The learner needs an active Syllabus to move a Day Off.';
  end if;

  -- This receipt survives removal of the Day Off mark: a repeated request
  -- never performs a second move or sweeps in later additions.
  select * into v_prior from public.syllabus_day_off_moves
  where facilitator_id = p_facilitator_id and learner_id = p_learner_id
    and source_date = p_source_date
  for update;
  if found then
    if v_prior.destination_date is distinct from p_destination_date then
      raise exception using errcode = 'P0001', message = 'This Day Off was already moved once to a different date.';
    end if;
    insert into public.no_school_dates (facilitator_id, learner_id, date, reason, move_to_date)
    values (p_facilitator_id, p_learner_id, p_source_date, nullif(btrim(p_reason), ''), p_destination_date)
    on conflict (facilitator_id, learner_id, date) do update set
      reason = excluded.reason, move_to_date = excluded.move_to_date, updated_at = now();
    return jsonb_build_object('ok', true, 'reused', true, 'destination_date', p_destination_date,
      'moved_active_count', v_prior.moved_active_count,
      'moved_proposal_count', v_prior.moved_proposal_count,
      'moved_schedule_count', v_prior.moved_schedule_count,
      'moved_slate_count', v_prior.moved_slate_count);
  end if;

  if v_syllabus.active_revision_id is distinct from p_expected_active_revision_id then
    raise exception using errcode = '40001', message = 'The active Syllabus changed. Reload before moving lessons.';
  end if;
  if exists (select 1 from public.no_school_dates
      where facilitator_id = p_facilitator_id and learner_id = p_learner_id
        and date = p_destination_date) then
    raise exception using errcode = 'P0001', message = 'The destination is also marked as a Day Off.';
  end if;

  -- Never collapse two schedule occurrences with identical lesson keys.
  if exists (
    select 1 from public.lesson_schedule source_row
    join public.lesson_schedule dest_row on dest_row.learner_id = source_row.learner_id
      and dest_row.lesson_key = source_row.lesson_key
      and dest_row.scheduled_date = p_destination_date
    where source_row.learner_id = p_learner_id and source_row.scheduled_date = p_source_date
      and (source_row.facilitator_id = p_facilitator_id or source_row.facilitator_id is null)
  ) then
    raise exception using errcode = 'P0001',
      message = 'This lesson is already scheduled on the destination date. No entries were moved.';
  end if;

  if exists (
    select 1 from public.syllabus_slate_assignments source_row
    join public.syllabus_slate_assignments dest_row
      on dest_row.learner_id = source_row.learner_id
      and dest_row.facilitator_id = source_row.facilitator_id
      and dest_row.syllabus_occurrence_id = source_row.syllabus_occurrence_id
      and dest_row.run_purpose = source_row.run_purpose
      and dest_row.scheduled_date = p_destination_date
    where source_row.facilitator_id = p_facilitator_id and source_row.learner_id = p_learner_id
      and source_row.scheduled_date = p_source_date
  ) then
    raise exception using errcode = 'P0001',
      message = 'A matching Daily Review is already scheduled on the destination date.';
  end if;

  select * into v_active from public.syllabus_revisions
  where id = v_syllabus.active_revision_id and syllabus_id = v_syllabus.id;
  if not found then
    raise exception using errcode = 'P0001', message = 'The active Syllabus revision is unavailable.';
  end if;
  select * into v_pending from public.syllabus_revisions
  where syllabus_id = v_syllabus.id and base_revision_id = v_active.id
    and activated_at is null and proposal_kind = 'learning_forecast'
  order by revision_number desc limit 1 for update;

  select count(*) into v_active_count from public.syllabus_forecast_items
  where revision_id = v_active.id and planned_date = p_source_date;
  if v_pending.id is not null then
    select count(*) into v_proposal_count from public.syllabus_forecast_items
    where revision_id = v_pending.id and planned_date = p_source_date;
  end if;
  select count(*) into v_schedule_count from public.lesson_schedule
  where learner_id = p_learner_id and scheduled_date = p_source_date
    and (facilitator_id = p_facilitator_id or facilitator_id is null);
  select count(*) into v_slate_count from public.syllabus_slate_assignments
  where facilitator_id = p_facilitator_id and learner_id = p_learner_id
    and scheduled_date = p_source_date;

  if v_active_count + v_proposal_count + v_schedule_count + v_slate_count > 0 then
    select greatest(10000,
      coalesce((select max(sort_order) from public.syllabus_forecast_items
        where revision_id = v_active.id and planned_date = p_destination_date), 0),
      coalesce((select max(sort_order) from public.syllabus_forecast_items
        where revision_id = v_pending.id and planned_date = p_destination_date), 0),
      coalesce((select max(sort_order) from public.lesson_schedule
        where learner_id = p_learner_id and scheduled_date = p_destination_date), 0)
    ) into v_base_order;

    -- Activated forecast items cannot be updated. Append a new revision and
    -- preserve the lineage IDs, lesson keys, and original slot audit metadata.
    select coalesce(max(revision_number), 0) + 1 into v_next_number
    from public.syllabus_revisions where syllabus_id = v_syllabus.id;
    insert into public.syllabus_revisions (
      syllabus_id, revision_number, base_revision_id, effective_from, schema_version,
      goals, subjects, weekly_pattern, teaching_guidance, planning_policy,
      legacy_provenance, change_reason
    ) values (
      v_syllabus.id, v_next_number, v_active.id, p_local_today, v_active.schema_version,
      v_active.goals, v_active.subjects, v_active.weekly_pattern, v_active.teaching_guidance,
      v_active.planning_policy, v_active.legacy_provenance,
      'One-time Day Off relocation from ' || p_source_date || ' to ' || p_destination_date
    ) returning id into v_active_new;

    with indexed as (
      select item.*, row_number() over (partition by item.planned_date
        order by item.sort_order, item.id) as date_rank
      from public.syllabus_forecast_items item
      where item.revision_id = v_active.id and item.planned_date >= p_local_today
    )
    insert into public.syllabus_forecast_items (
      revision_id, lineage_id, planned_date, subject, title, description,
      lesson_key, item_type, origin, sort_order, metadata
    )
    select v_active_new, item.lineage_id,
      case when item.planned_date = p_source_date then p_destination_date else item.planned_date end,
      item.subject, item.title, item.description, item.lesson_key, item.item_type, item.origin,
      case when item.planned_date = p_source_date
        then v_base_order + item.date_rank::integer else item.sort_order end,
      case when item.planned_date = p_source_date then
        jsonb_set(coalesce(item.metadata, '{}'::jsonb), '{day_off_moves}',
          (case when jsonb_typeof(item.metadata->'day_off_moves') = 'array'
            then item.metadata->'day_off_moves' else '[]'::jsonb end)
            || jsonb_build_array(jsonb_build_object(
              'move_id', v_move_id, 'source_date', p_source_date,
              'source_sort_order', item.sort_order, 'destination_date', p_destination_date)), true)
        else item.metadata end
    from indexed item;

    perform public.commit_syllabus_revision_activation(v_syllabus.id, v_active_new, v_active.id);

    -- Review assignments reference exact Syllabus occurrence IDs. Rebase only
    -- live assignments onto their new immutable forecast row IDs; historical
    -- instructional attempts and completion evidence are never rewritten.
    update public.syllabus_slate_assignments assignment
      set syllabus_occurrence_id = 'syllabus:' || new_item.id::text
    from public.syllabus_forecast_items old_item
    join public.syllabus_forecast_items new_item
      on new_item.revision_id = v_active_new and new_item.lineage_id = old_item.lineage_id
    where old_item.revision_id = v_active.id
      and assignment.syllabus_occurrence_id = 'syllabus:' || old_item.id::text
      and assignment.facilitator_id = p_facilitator_id
      and assignment.learner_id = p_learner_id;

    -- An unadopted forecast stays unadopted. Rebase it onto the new active
    -- revision so the pending concepts do not vanish or become stale.
    if v_pending.id is not null then
      select coalesce(max(revision_number), 0) + 1 into v_next_number
      from public.syllabus_revisions where syllabus_id = v_syllabus.id;
      insert into public.syllabus_revisions (
        syllabus_id, revision_number, base_revision_id, effective_from, schema_version,
        goals, subjects, weekly_pattern, teaching_guidance, planning_policy,
        legacy_provenance, change_reason, proposal_kind, proposal_key
      ) values (
        v_syllabus.id, v_next_number, v_active_new, p_local_today,
        v_pending.schema_version, v_pending.goals, v_pending.subjects,
        v_pending.weekly_pattern, v_pending.teaching_guidance,
        v_pending.planning_policy, v_pending.legacy_provenance,
        'One-time Day Off move of pending instructional forecast',
        'learning_forecast', v_pending.proposal_key || ':day-off:' || v_move_id::text
      ) returning id into v_pending_new;

      with indexed as (
        select item.*, row_number() over (partition by item.planned_date
          order by item.sort_order, item.id) as date_rank
        from public.syllabus_forecast_items item
        where item.revision_id = v_pending.id and item.planned_date >= p_local_today
      )
      insert into public.syllabus_forecast_items (
        revision_id, lineage_id, planned_date, subject, title, description,
        lesson_key, item_type, origin, sort_order, metadata
      )
      select v_pending_new, item.lineage_id,
        case when item.planned_date = p_source_date then p_destination_date else item.planned_date end,
        item.subject, item.title, item.description, item.lesson_key, item.item_type, item.origin,
        case when item.planned_date = p_source_date then
          v_base_order + v_active_count + item.date_rank::integer else item.sort_order end,
        case when item.planned_date = p_source_date then
          jsonb_set(coalesce(item.metadata, '{}'::jsonb), '{day_off_moves}',
            (case when jsonb_typeof(item.metadata->'day_off_moves') = 'array'
              then item.metadata->'day_off_moves' else '[]'::jsonb end)
              || jsonb_build_array(jsonb_build_object(
                'move_id', v_move_id, 'source_date', p_source_date,
                'source_sort_order', item.sort_order, 'destination_date', p_destination_date)), true)
          else item.metadata end
      from indexed item;
    end if;

    -- Explicit schedules keep their row IDs and forecast lineage references.
    with moving as (
      select id, row_number() over (order by sort_order, created_at, id) as move_rank
      from public.lesson_schedule
      where learner_id = p_learner_id and scheduled_date = p_source_date
        and (facilitator_id = p_facilitator_id or facilitator_id is null)
    )
    update public.lesson_schedule schedule set
      scheduled_date = p_destination_date,
      sort_order = v_base_order + v_active_count + v_proposal_count + moving.move_rank::integer,
      day_off_move_source_date = p_source_date,
      day_off_move_destination_date = p_destination_date,
      -- Existing same-day source forecast/schedule pairs must remain paired.
      -- A moved schedule without a source lineage must not consume an unrelated
      -- same-key forecast that already exists on the destination date.
      forecast_lineage_id = coalesce(schedule.forecast_lineage_id, (
        select forecast.lineage_id
        from public.syllabus_forecast_items forecast
        where forecast.revision_id = v_active.id
          and forecast.planned_date = p_source_date
          and forecast.lesson_key = schedule.lesson_key
          and (select count(*) from public.syllabus_forecast_items sibling
            where sibling.revision_id = v_active.id
              and sibling.planned_date = p_source_date
              and sibling.lesson_key = schedule.lesson_key) = 1
      )),
      updated_at = now()
    from moving where schedule.id = moving.id;

    update public.syllabus_slate_assignments set scheduled_date = p_destination_date
    where facilitator_id = p_facilitator_id and learner_id = p_learner_id
      and scheduled_date = p_source_date;
  else
    v_active_new := v_active.id;
  end if;

  insert into public.no_school_dates (facilitator_id, learner_id, date, reason, move_to_date)
  values (p_facilitator_id, p_learner_id, p_source_date, nullif(btrim(p_reason), ''), p_destination_date)
  on conflict (facilitator_id, learner_id, date) do update set
    reason = excluded.reason, move_to_date = excluded.move_to_date, updated_at = now();

  insert into public.syllabus_day_off_moves (
    id, facilitator_id, learner_id, source_date, destination_date,
    active_revision_before, active_revision_after, proposal_revision_before, proposal_revision_after,
    moved_active_count, moved_proposal_count, moved_schedule_count, moved_slate_count
  ) values (
    v_move_id, p_facilitator_id, p_learner_id, p_source_date, p_destination_date,
    v_active.id, v_active_new, v_pending.id, v_pending_new,
    v_active_count, v_proposal_count, v_schedule_count, v_slate_count
  );
  return jsonb_build_object('ok', true, 'reused', false, 'destination_date', p_destination_date,
    'active_revision_id', v_active_new,
    'moved_active_count', v_active_count, 'moved_proposal_count', v_proposal_count,
    'moved_schedule_count', v_schedule_count, 'moved_slate_count', v_slate_count);
end;
$$;

revoke all on function public.move_syllabus_day_off(uuid, uuid, date, date, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.move_syllabus_day_off(uuid, uuid, date, date, text, date, uuid)
  to service_role;

comment on function public.move_syllabus_day_off(uuid, uuid, date, date, text, date, uuid) is
  'Atomic facilitator-authorized one-time Day Off move. Original forecast slot satisfaction survives through metadata.day_off_moves.';
