-- Ms. Sonoma Syllabus, phase 1: append-only facilitator-owned planning forecasts.

create table if not exists public.syllabi (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  active_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint syllabi_facilitator_learner_unique unique (facilitator_id, learner_id)
);

create table if not exists public.syllabus_revisions (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.syllabi(id) on delete cascade,
  revision_number integer not null,
  base_revision_id uuid references public.syllabus_revisions(id),
  effective_from date not null,
  schema_version integer not null default 1,
  goals jsonb not null,
  subjects jsonb not null,
  weekly_pattern jsonb not null,
  teaching_guidance jsonb not null,
  planning_policy jsonb not null,
  legacy_provenance jsonb not null,
  change_reason text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint syllabus_revisions_number_check check (revision_number > 0),
  constraint syllabus_revisions_schema_check check (schema_version > 0),
  constraint syllabus_revisions_goals_object check (jsonb_typeof(goals) = 'object'),
  constraint syllabus_revisions_subjects_array check (jsonb_typeof(subjects) = 'array'),
  constraint syllabus_revisions_weekly_pattern_object check (jsonb_typeof(weekly_pattern) = 'object'),
  constraint syllabus_revisions_teaching_guidance_object check (jsonb_typeof(teaching_guidance) = 'object'),
  constraint syllabus_revisions_planning_policy_object check (jsonb_typeof(planning_policy) = 'object'),
  constraint syllabus_revisions_legacy_provenance_object check (jsonb_typeof(legacy_provenance) = 'object'),
  constraint syllabus_revisions_number_unique unique (syllabus_id, revision_number)
);

alter table public.syllabi
  add constraint syllabi_active_revision_fk
  foreign key (active_revision_id) references public.syllabus_revisions(id);

create table if not exists public.syllabus_forecast_items (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.syllabus_revisions(id) on delete cascade,
  lineage_id uuid not null,
  planned_date date not null,
  subject text not null,
  title text not null,
  lesson_key text,
  item_type text not null,
  origin text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint syllabus_forecast_subject_check check (length(btrim(subject)) > 0),
  constraint syllabus_forecast_title_check check (length(btrim(title)) > 0),
  constraint syllabus_forecast_item_type_check check (item_type in ('lesson', 'review', 'check', 'unit')),
  constraint syllabus_forecast_origin_check check (origin in ('legacy_import', 'generated', 'facilitator', 'mastery_reforecast')),
  constraint syllabus_forecast_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_syllabi_learner_lookup
  on public.syllabi(facilitator_id, learner_id);
create index if not exists idx_syllabus_revisions_active_lookup
  on public.syllabus_revisions(syllabus_id, id);
create index if not exists idx_syllabus_forecast_revision_date
  on public.syllabus_forecast_items(revision_id, planned_date, sort_order, created_at);
create index if not exists idx_syllabus_forecast_lineage
  on public.syllabus_forecast_items(lineage_id);

create or replace function public.guard_syllabus_active_pointer()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.facilitator_id is distinct from old.facilitator_id
    or new.learner_id is distinct from old.learner_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Syllabus identity fields are immutable';
  end if;
  if tg_op = 'UPDATE'
    and new.active_revision_id is distinct from old.active_revision_id
    and current_setting('app.syllabus_activation_commit', true) is distinct from 'on'
  then
    raise exception 'Syllabus active revision may only change through the activation commit function';
  end if;
  if new.active_revision_id is not null and not exists (
    select 1 from public.syllabus_revisions r
    where r.id = new.active_revision_id and r.syllabus_id = new.id and r.activated_at is not null
  ) then
    raise exception 'Active revision must be an activated revision of this Syllabus';
  end if;
  return new;
end;
$$;

drop trigger if exists syllabi_guard_active_pointer on public.syllabi;
create trigger syllabi_guard_active_pointer
  before insert or update on public.syllabi
  for each row execute function public.guard_syllabus_active_pointer();

create or replace function public.guard_activated_syllabus_revision()
returns trigger language plpgsql as $$
begin
  if old.activated_at is not null then
    raise exception 'Activated syllabus revisions are immutable';
  end if;
  if tg_op = 'UPDATE'
    and old.activated_at is null
    and new.activated_at is not null
    and current_setting('app.syllabus_activation_commit', true) is distinct from 'on'
  then
    raise exception 'Syllabus revisions may only be activated by the commit function';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists syllabus_revisions_guard_activated on public.syllabus_revisions;
create trigger syllabus_revisions_guard_activated
  before update or delete on public.syllabus_revisions
  for each row execute function public.guard_activated_syllabus_revision();

create or replace function public.guard_syllabus_revision_lineage()
returns trigger language plpgsql as $$
begin
  if new.base_revision_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.syllabus_revisions base
    where base.id = new.base_revision_id
      and base.syllabus_id = new.syllabus_id
      and base.activated_at is not null
  ) then
    raise exception 'Base revision must be an activated revision of the same Syllabus';
  end if;

  return new;
end;
$$;

drop trigger if exists syllabus_revisions_guard_lineage on public.syllabus_revisions;
create trigger syllabus_revisions_guard_lineage
  before insert or update of syllabus_id, base_revision_id on public.syllabus_revisions
  for each row execute function public.guard_syllabus_revision_lineage();

create or replace function public.guard_activated_syllabus_forecast_item()
returns trigger language plpgsql as $$
declare
  old_revision_activated boolean := false;
  new_revision_activated boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select exists (
      select 1 from public.syllabus_revisions r
      where r.id = old.revision_id and r.activated_at is not null
    ) into old_revision_activated;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select exists (
      select 1 from public.syllabus_revisions r
      where r.id = new.revision_id and r.activated_at is not null
    ) into new_revision_activated;
  end if;

  if old_revision_activated or new_revision_activated then
    raise exception 'Forecast items of activated syllabus revisions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists syllabus_forecast_guard_activated on public.syllabus_forecast_items;
create trigger syllabus_forecast_guard_activated
  before insert or update or delete on public.syllabus_forecast_items
  for each row execute function public.guard_activated_syllabus_forecast_item();

-- Atomically commits a fully prepared inactive revision. The row lock and
-- expected-pointer comparison prevent sibling revisions from both activating.
-- SECURITY INVOKER plus restricted EXECUTE keeps authorization in the server.
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

alter table public.syllabi enable row level security;
alter table public.syllabus_revisions enable row level security;
alter table public.syllabus_forecast_items enable row level security;

create policy "syllabi_select_own" on public.syllabi for select
  using (auth.uid() = facilitator_id);
create policy "syllabi_insert_own" on public.syllabi for insert
  with check (
    auth.uid() = facilitator_id
    and exists (select 1 from public.learners l where l.id = learner_id and l.facilitator_id = auth.uid())
  );
create policy "syllabi_update_own" on public.syllabi for update
  using (auth.uid() = facilitator_id)
  with check (
    auth.uid() = facilitator_id
    and exists (select 1 from public.learners l where l.id = learner_id and l.facilitator_id = auth.uid())
  );

create policy "syllabus_revisions_select_own" on public.syllabus_revisions for select
  using (exists (select 1 from public.syllabi s where s.id = syllabus_id and s.facilitator_id = auth.uid()));
create policy "syllabus_revisions_insert_own" on public.syllabus_revisions for insert
  with check (exists (select 1 from public.syllabi s where s.id = syllabus_id and s.facilitator_id = auth.uid()));

create policy "syllabus_forecast_select_own" on public.syllabus_forecast_items for select
  using (exists (
    select 1 from public.syllabus_revisions r
    join public.syllabi s on s.id = r.syllabus_id
    where r.id = revision_id and s.facilitator_id = auth.uid()
  ));
create policy "syllabus_forecast_insert_own" on public.syllabus_forecast_items for insert
  with check (exists (
    select 1 from public.syllabus_revisions r
    join public.syllabi s on s.id = r.syllabus_id
    where r.id = revision_id and s.facilitator_id = auth.uid()
  ));

revoke all on table
  public.syllabi,
  public.syllabus_revisions,
  public.syllabus_forecast_items
  from anon, authenticated;
grant select on table
  public.syllabi,
  public.syllabus_revisions,
  public.syllabus_forecast_items
  to authenticated;

comment on table public.syllabi is 'Stable learner Syllabus identity and pointer to the current forecast revision.';
comment on table public.syllabus_revisions is 'Complete append-only Syllabus snapshots. activated_at marks revisions that must never change.';
comment on table public.syllabus_forecast_items is 'Dated forecast rows owned by one immutable Syllabus revision; lineage_id links reforecasts.';
