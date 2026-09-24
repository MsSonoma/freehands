-- Curriculum Guidance foundation.
-- Adds facilitator-authored curriculum periods/contracts, CASE-shaped framework storage,
-- rebuildable learner curriculum state, forecast decision audit, and lesson target identity.

create table if not exists public.curriculum_frameworks (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid references auth.users(id) on delete cascade,
  source_kind text not null default 'facilitator',
  name text not null,
  external_identifier text,
  version_label text,
  jurisdiction text,
  source_uri text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint curriculum_frameworks_source_kind_check check (source_kind in ('system', 'imported', 'facilitator')),
  constraint curriculum_frameworks_name_check check (length(btrim(name)) > 0),
  constraint curriculum_frameworks_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists curriculum_frameworks_global_external_unique
  on public.curriculum_frameworks(external_identifier)
  where facilitator_id is null and external_identifier is not null;

create unique index if not exists curriculum_frameworks_facilitator_external_unique
  on public.curriculum_frameworks(facilitator_id, external_identifier)
  where facilitator_id is not null and external_identifier is not null;

create table if not exists public.curriculum_framework_items (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.curriculum_frameworks(id) on delete cascade,
  external_id text,
  code text,
  subject text not null,
  grade_band text,
  statement text not null,
  planning_group_key text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint curriculum_framework_items_subject_check check (length(btrim(subject)) > 0),
  constraint curriculum_framework_items_statement_check check (length(btrim(statement)) > 0),
  constraint curriculum_framework_items_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists curriculum_framework_items_external_unique
  on public.curriculum_framework_items(framework_id, external_id)
  where external_id is not null;

create index if not exists idx_curriculum_framework_items_lookup
  on public.curriculum_framework_items(framework_id, subject, grade_band, sort_order);

create table if not exists public.curriculum_framework_associations (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.curriculum_frameworks(id) on delete cascade,
  source_item_id uuid not null references public.curriculum_framework_items(id) on delete cascade,
  target_item_id uuid not null references public.curriculum_framework_items(id) on delete cascade,
  relationship text not null,
  provenance_kind text not null default 'source',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint curriculum_framework_association_relationship_check
    check (relationship in ('parent_of', 'prerequisite_of', 'related_to')),
  constraint curriculum_framework_association_provenance_check
    check (provenance_kind in ('source', 'facilitator', 'inferred')),
  constraint curriculum_framework_association_distinct_check check (source_item_id <> target_item_id),
  constraint curriculum_framework_association_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint curriculum_framework_association_unique unique (framework_id, source_item_id, target_item_id, relationship)
);

create table if not exists public.curriculum_periods (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  label text not null,
  period_type text not null default 'custom',
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft',
  review_window_days integer not null default 14,
  active_contract_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_periods_label_check check (length(btrim(label)) > 0),
  constraint curriculum_periods_type_check check (period_type in ('semester', 'quarter', 'school_year', 'custom')),
  constraint curriculum_periods_dates_check check (ends_on >= starts_on),
  constraint curriculum_periods_status_check check (status in ('draft', 'active', 'closed')),
  constraint curriculum_periods_review_window_check check (review_window_days between 0 and 90)
);

create index if not exists idx_curriculum_periods_learner_dates
  on public.curriculum_periods(facilitator_id, learner_id, starts_on, ends_on);

create table if not exists public.curriculum_contract_versions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.curriculum_periods(id) on delete cascade,
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  revision_number integer not null,
  base_version_id uuid references public.curriculum_contract_versions(id),
  schema_version integer not null default 1,
  period_label text not null,
  period_type text not null,
  period_start date not null,
  period_end date not null,
  change_reason text,
  migration_provenance jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint curriculum_contract_revision_positive check (revision_number > 0),
  constraint curriculum_contract_schema_positive check (schema_version > 0),
  constraint curriculum_contract_period_label_check check (length(btrim(period_label)) > 0),
  constraint curriculum_contract_period_type_check check (period_type in ('semester', 'quarter', 'school_year', 'custom')),
  constraint curriculum_contract_period_dates_check check (period_end >= period_start),
  constraint curriculum_contract_provenance_object check (jsonb_typeof(migration_provenance) = 'object'),
  constraint curriculum_contract_revision_unique unique (period_id, revision_number)
);

alter table public.curriculum_periods
  add constraint curriculum_periods_active_contract_fk
  foreign key (active_contract_version_id) references public.curriculum_contract_versions(id);

create table if not exists public.curriculum_contract_items (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.curriculum_contract_versions(id) on delete cascade,
  requirement_key text not null,
  framework_item_id uuid references public.curriculum_framework_items(id) on delete set null,
  subject text not null,
  statement text not null,
  must_learn boolean not null default true,
  attention text not null default 'normal',
  target_date date,
  planning_group_key text not null,
  source_kind text not null default 'facilitator',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint curriculum_contract_items_key_check check (length(btrim(requirement_key)) > 0),
  constraint curriculum_contract_items_subject_check check (length(btrim(subject)) > 0),
  constraint curriculum_contract_items_statement_check check (length(btrim(statement)) > 0),
  constraint curriculum_contract_items_attention_check check (attention in ('more', 'normal', 'minimum')),
  constraint curriculum_contract_items_group_check check (length(btrim(planning_group_key)) > 0),
  constraint curriculum_contract_items_source_check check (source_kind in ('framework', 'facilitator', 'migrated')),
  constraint curriculum_contract_items_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint curriculum_contract_items_unique unique (contract_version_id, requirement_key)
);

create index if not exists idx_curriculum_contract_items_subject
  on public.curriculum_contract_items(contract_version_id, subject, sort_order);

create table if not exists public.curriculum_contract_goals (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.curriculum_contract_versions(id) on delete cascade,
  goal_key text not null,
  title text not null,
  subject text,
  priority text not null default 'normal',
  linked_requirement_keys jsonb not null default '[]'::jsonb,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint curriculum_contract_goals_key_check check (length(btrim(goal_key)) > 0),
  constraint curriculum_contract_goals_title_check check (length(btrim(title)) > 0),
  constraint curriculum_contract_goals_priority_check check (priority in ('high', 'normal', 'low')),
  constraint curriculum_contract_goals_linked_array check (jsonb_typeof(linked_requirement_keys) = 'array'),
  constraint curriculum_contract_goals_unique unique (contract_version_id, goal_key)
);

create table if not exists public.learner_curriculum_state (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  period_id uuid not null references public.curriculum_periods(id) on delete cascade,
  requirement_key text not null,
  curriculum_contract_item_id uuid references public.curriculum_contract_items(id) on delete set null,
  subject text not null,
  planning_group_key text not null,
  coverage_state text not null default 'not_started',
  mastery_state text not null default 'not_measured',
  retention_state text not null default 'not_measured',
  last_evidence_at timestamptz,
  last_instruction_at timestamptz,
  consecutive_exposures integer not null default 0,
  return_after date,
  projection jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint learner_curriculum_state_coverage_check
    check (coverage_state in ('not_started', 'introduced', 'developing', 'covered')),
  constraint learner_curriculum_state_mastery_check
    check (mastery_state in ('not_measured', 'unresolved', 'developing', 'demonstrated')),
  constraint learner_curriculum_state_retention_check
    check (retention_state in ('not_measured', 'needs_review', 'retained')),
  constraint learner_curriculum_state_exposure_check check (consecutive_exposures between 0 and 3),
  constraint learner_curriculum_state_projection_object check (jsonb_typeof(projection) = 'object'),
  constraint learner_curriculum_state_unique unique (period_id, requirement_key)
);

create table if not exists public.curriculum_planning_decisions (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  syllabus_id uuid references public.syllabi(id) on delete set null,
  syllabus_revision_id uuid references public.syllabus_revisions(id) on delete set null,
  forecast_lineage_id uuid not null,
  period_id uuid references public.curriculum_periods(id) on delete set null,
  contract_version_id uuid references public.curriculum_contract_versions(id) on delete set null,
  requirement_key text,
  planning_group_key text,
  decision_kind text not null,
  decision_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint curriculum_planning_decisions_kind_check
    check (decision_kind in ('new_required', 'continue', 'recovery', 'return', 'retention', 'goal', 'enrichment', 'carry')),
  constraint curriculum_planning_decisions_snapshot_object check (jsonb_typeof(decision_snapshot) = 'object'),
  constraint curriculum_planning_decisions_lineage_unique unique (forecast_lineage_id)
);

create index if not exists idx_curriculum_planning_decisions_learner
  on public.curriculum_planning_decisions(facilitator_id, learner_id, created_at desc);

create table if not exists public.lesson_curriculum_targets (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  period_id uuid references public.curriculum_periods(id) on delete set null,
  contract_version_id uuid references public.curriculum_contract_versions(id) on delete set null,
  requirement_key text not null,
  planning_group_key text,
  target_role text not null default 'primary',
  created_at timestamptz not null default now(),
  constraint lesson_curriculum_targets_lesson_check check (length(btrim(lesson_key)) > 0),
  constraint lesson_curriculum_targets_requirement_check check (length(btrim(requirement_key)) > 0),
  constraint lesson_curriculum_targets_role_check check (target_role in ('primary', 'supporting')),
  constraint lesson_curriculum_targets_unique unique (facilitator_id, learner_id, lesson_key, requirement_key)
);

create index if not exists idx_lesson_curriculum_targets_lookup
  on public.lesson_curriculum_targets(facilitator_id, learner_id, lesson_key);

alter table public.syllabus_revisions
  add column if not exists curriculum_contract_version_id uuid references public.curriculum_contract_versions(id);

create index if not exists idx_syllabus_revisions_curriculum_contract
  on public.syllabus_revisions(curriculum_contract_version_id)
  where curriculum_contract_version_id is not null;

create or replace function public.guard_curriculum_period_active_pointer()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
    and new.active_contract_version_id is distinct from old.active_contract_version_id
    and current_setting('app.curriculum_contract_commit', true) is distinct from 'on'
  then
    raise exception 'Curriculum period active contract may only change through the contract commit function';
  end if;
  if new.active_contract_version_id is not null and not exists (
    select 1 from public.curriculum_contract_versions v
    where v.id = new.active_contract_version_id
      and v.period_id = new.id
      and v.activated_at is not null
  ) then
    raise exception 'Active curriculum contract must be an activated version of this period';
  end if;
  return new;
end;
$$;

create trigger curriculum_periods_guard_active_pointer
  before insert or update on public.curriculum_periods
  for each row execute function public.guard_curriculum_period_active_pointer();

create or replace function public.guard_activated_curriculum_contract()
returns trigger language plpgsql as $$
begin
  if old.activated_at is not null then
    raise exception 'Activated curriculum contract versions are immutable';
  end if;
  if tg_op = 'UPDATE'
    and old.activated_at is null
    and new.activated_at is not null
    and current_setting('app.curriculum_contract_commit', true) is distinct from 'on'
  then
    raise exception 'Curriculum contract versions may only be activated by the contract commit function';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger curriculum_contract_versions_guard_activated
  before update or delete on public.curriculum_contract_versions
  for each row execute function public.guard_activated_curriculum_contract();

create or replace function public.guard_activated_curriculum_contract_child()
returns trigger language plpgsql as $$
declare
  version_id uuid;
begin
  version_id := case when tg_op = 'DELETE' then old.contract_version_id else new.contract_version_id end;
  if exists (
    select 1 from public.curriculum_contract_versions v
    where v.id = version_id and v.activated_at is not null
  ) then
    raise exception 'Items and goals of an activated curriculum contract are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger curriculum_contract_items_guard_activated
  before insert or update or delete on public.curriculum_contract_items
  for each row execute function public.guard_activated_curriculum_contract_child();

create trigger curriculum_contract_goals_guard_activated
  before insert or update or delete on public.curriculum_contract_goals
  for each row execute function public.guard_activated_curriculum_contract_child();

create or replace function public.sync_syllabus_curriculum_contract()
returns trigger language plpgsql as $$
declare
  policy_version text;
begin
  policy_version := nullif(btrim(new.planning_policy->>'curriculum_contract_version_id'), '');
  if new.curriculum_contract_version_id is null and policy_version is not null then
    begin
      new.curriculum_contract_version_id := policy_version::uuid;
    exception when invalid_text_representation then
      raise exception 'planning_policy.curriculum_contract_version_id must be a UUID';
    end;
  elsif new.curriculum_contract_version_id is not null and policy_version is not null
    and new.curriculum_contract_version_id::text <> policy_version
  then
    raise exception 'Syllabus curriculum contract pointer does not match planning_policy';
  end if;
  return new;
end;
$$;

create trigger syllabus_revisions_sync_curriculum_contract
  before insert or update of planning_policy, curriculum_contract_version_id on public.syllabus_revisions
  for each row execute function public.sync_syllabus_curriculum_contract();

create or replace function public.commit_curriculum_contract_snapshot(
  p_period_id uuid,
  p_facilitator_id uuid,
  p_learner_id uuid,
  p_expected_active_version_id uuid,
  p_label text,
  p_period_type text,
  p_starts_on date,
  p_ends_on date,
  p_change_reason text,
  p_migration_provenance jsonb,
  p_items jsonb,
  p_goals jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  period_row public.curriculum_periods%rowtype;
  version_row public.curriculum_contract_versions%rowtype;
  next_revision integer;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_goals, '[]'::jsonb)) <> 'array'
  then
    raise exception 'Curriculum contract items and goals must be arrays';
  end if;
  if p_ends_on < p_starts_on then raise exception 'Curriculum period end must not precede its start'; end if;
  if p_period_type not in ('semester', 'quarter', 'school_year', 'custom') then
    raise exception 'Unsupported curriculum period type';
  end if;

  select * into period_row
  from public.curriculum_periods
  where id = p_period_id
    and facilitator_id = p_facilitator_id
    and learner_id = p_learner_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Curriculum period not found';
  end if;
  if period_row.active_contract_version_id is distinct from p_expected_active_version_id then
    raise exception using errcode = '40001', message = 'Curriculum contract changed';
  end if;

  -- Serialize contract activation for this learner and prevent two overlapping
  -- planning periods from becoming authoritative at the same time.
  perform 1
  from public.curriculum_periods
  where facilitator_id = p_facilitator_id
    and learner_id = p_learner_id
  order by id
  for update;

  if exists (
    select 1
    from public.curriculum_periods other_period
    where other_period.facilitator_id = p_facilitator_id
      and other_period.learner_id = p_learner_id
      and other_period.id <> p_period_id
      and other_period.status = 'active'
      and daterange(other_period.starts_on, other_period.ends_on, '[]')
        && daterange(p_starts_on, p_ends_on, '[]')
  ) then
    raise exception using errcode = '23P01', message = 'Curriculum planning periods cannot overlap';
  end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.curriculum_contract_versions where period_id = p_period_id;

  insert into public.curriculum_contract_versions (
    period_id, facilitator_id, learner_id, revision_number, base_version_id,
    schema_version, period_label, period_type, period_start, period_end,
    change_reason, migration_provenance
  ) values (
    p_period_id, p_facilitator_id, p_learner_id, next_revision, p_expected_active_version_id,
    1, btrim(p_label), p_period_type, p_starts_on, p_ends_on,
    nullif(btrim(coalesce(p_change_reason, '')), ''),
    coalesce(p_migration_provenance, '{}'::jsonb)
  ) returning * into version_row;

  insert into public.curriculum_contract_items (
    contract_version_id, requirement_key, framework_item_id, subject, statement,
    must_learn, attention, target_date, planning_group_key, source_kind, sort_order, metadata
  )
  select
    version_row.id,
    btrim(item.requirement_key),
    item.framework_item_id,
    btrim(item.subject),
    btrim(item.statement),
    coalesce(item.must_learn, true),
    coalesce(nullif(btrim(item.attention), ''), 'normal'),
    item.target_date,
    coalesce(nullif(btrim(item.planning_group_key), ''), btrim(item.requirement_key)),
    coalesce(nullif(btrim(item.source_kind), ''), 'facilitator'),
    coalesce(item.sort_order, 0),
    coalesce(item.metadata, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    requirement_key text,
    framework_item_id uuid,
    subject text,
    statement text,
    must_learn boolean,
    attention text,
    target_date date,
    planning_group_key text,
    source_kind text,
    sort_order integer,
    metadata jsonb
  );

  insert into public.curriculum_contract_goals (
    contract_version_id, goal_key, title, subject, priority,
    linked_requirement_keys, notes, sort_order
  )
  select
    version_row.id,
    btrim(goal.goal_key),
    btrim(goal.title),
    nullif(btrim(coalesce(goal.subject, '')), ''),
    coalesce(nullif(btrim(goal.priority), ''), 'normal'),
    coalesce(goal.linked_requirement_keys, '[]'::jsonb),
    nullif(btrim(coalesce(goal.notes, '')), ''),
    coalesce(goal.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_goals, '[]'::jsonb)) as goal(
    goal_key text,
    title text,
    subject text,
    priority text,
    linked_requirement_keys jsonb,
    notes text,
    sort_order integer
  );

  perform set_config('app.curriculum_contract_commit', 'on', true);

  update public.curriculum_contract_versions
  set activated_at = now()
  where id = version_row.id
  returning * into version_row;

  update public.curriculum_periods
  set label = btrim(p_label),
      period_type = p_period_type,
      starts_on = p_starts_on,
      ends_on = p_ends_on,
      status = 'active',
      active_contract_version_id = version_row.id,
      updated_at = now()
  where id = p_period_id;

  return jsonb_build_object('period_id', p_period_id, 'version', to_jsonb(version_row));
end;
$$;

revoke all on function public.commit_curriculum_contract_snapshot(
  uuid, uuid, uuid, uuid, text, text, date, date, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_curriculum_contract_snapshot(
  uuid, uuid, uuid, uuid, text, text, date, date, text, jsonb, jsonb, jsonb
) to service_role;

create or replace function public.capture_curriculum_forecast_metadata()
returns trigger language plpgsql as $$
declare
  guidance jsonb;
  syllabus_row record;
  primary_key text;
  group_key text;
  supporting jsonb;
  support_key text;
begin
  guidance := new.metadata->'learning_forecast'->'curriculum_guidance';
  if jsonb_typeof(guidance) is distinct from 'object' then return new; end if;

  select s.id as syllabus_id, s.facilitator_id, s.learner_id
  into syllabus_row
  from public.syllabus_revisions r
  join public.syllabi s on s.id = r.syllabus_id
  where r.id = new.revision_id;

  if not found then return new; end if;

  primary_key := nullif(btrim(guidance->>'requirement_key'), '');
  group_key := nullif(btrim(guidance->>'planning_group_key'), '');

  insert into public.curriculum_planning_decisions (
    facilitator_id, learner_id, syllabus_id, syllabus_revision_id,
    forecast_lineage_id, period_id, contract_version_id, requirement_key,
    planning_group_key, decision_kind, decision_snapshot
  ) values (
    syllabus_row.facilitator_id,
    syllabus_row.learner_id,
    syllabus_row.syllabus_id,
    new.revision_id,
    new.lineage_id,
    nullif(guidance->>'period_id', '')::uuid,
    nullif(guidance->>'contract_version_id', '')::uuid,
    primary_key,
    group_key,
    coalesce(nullif(btrim(guidance->>'decision_kind'), ''), 'new_required'),
    guidance
  )
  on conflict (forecast_lineage_id) do nothing;

  if new.lesson_key is null or primary_key is null then return new; end if;

  insert into public.lesson_curriculum_targets (
    facilitator_id, learner_id, lesson_key, period_id, contract_version_id,
    requirement_key, planning_group_key, target_role
  ) values (
    syllabus_row.facilitator_id,
    syllabus_row.learner_id,
    new.lesson_key,
    nullif(guidance->>'period_id', '')::uuid,
    nullif(guidance->>'contract_version_id', '')::uuid,
    primary_key,
    group_key,
    'primary'
  )
  on conflict (facilitator_id, learner_id, lesson_key, requirement_key) do nothing;

  supporting := coalesce(guidance->'supporting_requirement_keys', '[]'::jsonb);
  if jsonb_typeof(supporting) = 'array' then
    for support_key in select jsonb_array_elements_text(supporting)
    loop
      if btrim(support_key) <> '' then
        insert into public.lesson_curriculum_targets (
          facilitator_id, learner_id, lesson_key, period_id, contract_version_id,
          requirement_key, planning_group_key, target_role
        ) values (
          syllabus_row.facilitator_id,
          syllabus_row.learner_id,
          new.lesson_key,
          nullif(guidance->>'period_id', '')::uuid,
          nullif(guidance->>'contract_version_id', '')::uuid,
          btrim(support_key),
          group_key,
          'supporting'
        )
        on conflict (facilitator_id, learner_id, lesson_key, requirement_key) do nothing;
      end if;
    end loop;
  end if;

  return new;
exception when invalid_text_representation then
  raise exception 'Forecast curriculum guidance contains an invalid UUID';
end;
$$;

create trigger syllabus_forecast_capture_curriculum_metadata
  after insert on public.syllabus_forecast_items
  for each row execute function public.capture_curriculum_forecast_metadata();

alter table public.curriculum_frameworks enable row level security;
alter table public.curriculum_framework_items enable row level security;
alter table public.curriculum_framework_associations enable row level security;
alter table public.curriculum_periods enable row level security;
alter table public.curriculum_contract_versions enable row level security;
alter table public.curriculum_contract_items enable row level security;
alter table public.curriculum_contract_goals enable row level security;
alter table public.learner_curriculum_state enable row level security;
alter table public.curriculum_planning_decisions enable row level security;
alter table public.lesson_curriculum_targets enable row level security;

create policy curriculum_frameworks_select on public.curriculum_frameworks for select
  using (facilitator_id is null or facilitator_id = auth.uid());

create policy curriculum_framework_items_select on public.curriculum_framework_items for select
  using (exists (
    select 1 from public.curriculum_frameworks f
    where f.id = framework_id and (f.facilitator_id is null or f.facilitator_id = auth.uid())
  ));

create policy curriculum_framework_associations_select on public.curriculum_framework_associations for select
  using (exists (
    select 1 from public.curriculum_frameworks f
    where f.id = framework_id and (f.facilitator_id is null or f.facilitator_id = auth.uid())
  ));

create policy curriculum_periods_select_own on public.curriculum_periods for select
  using (facilitator_id = auth.uid());

create policy curriculum_contract_versions_select_own on public.curriculum_contract_versions for select
  using (facilitator_id = auth.uid());

create policy curriculum_contract_items_select_own on public.curriculum_contract_items for select
  using (exists (
    select 1 from public.curriculum_contract_versions v
    where v.id = contract_version_id and v.facilitator_id = auth.uid()
  ));

create policy curriculum_contract_goals_select_own on public.curriculum_contract_goals for select
  using (exists (
    select 1 from public.curriculum_contract_versions v
    where v.id = contract_version_id and v.facilitator_id = auth.uid()
  ));

create policy learner_curriculum_state_select_own on public.learner_curriculum_state for select
  using (facilitator_id = auth.uid());

create policy curriculum_planning_decisions_select_own on public.curriculum_planning_decisions for select
  using (facilitator_id = auth.uid());

create policy lesson_curriculum_targets_select_own on public.lesson_curriculum_targets for select
  using (facilitator_id = auth.uid());

revoke all on table
  public.curriculum_frameworks,
  public.curriculum_framework_items,
  public.curriculum_framework_associations,
  public.curriculum_periods,
  public.curriculum_contract_versions,
  public.curriculum_contract_items,
  public.curriculum_contract_goals,
  public.learner_curriculum_state,
  public.curriculum_planning_decisions,
  public.lesson_curriculum_targets
from anon, authenticated;

grant select on table
  public.curriculum_frameworks,
  public.curriculum_framework_items,
  public.curriculum_framework_associations,
  public.curriculum_periods,
  public.curriculum_contract_versions,
  public.curriculum_contract_items,
  public.curriculum_contract_goals,
  public.learner_curriculum_state,
  public.curriculum_planning_decisions,
  public.lesson_curriculum_targets
to authenticated;

grant all on table
  public.curriculum_frameworks,
  public.curriculum_framework_items,
  public.curriculum_framework_associations,
  public.curriculum_periods,
  public.curriculum_contract_versions,
  public.curriculum_contract_items,
  public.curriculum_contract_goals,
  public.learner_curriculum_state,
  public.curriculum_planning_decisions,
  public.lesson_curriculum_targets
to service_role;

comment on table public.curriculum_periods is 'Facilitator-defined planning periods such as semesters, quarters, school years, or custom date ranges.';
comment on table public.curriculum_contract_versions is 'Append-only facilitator-authored curriculum contract versions. Activated versions are immutable.';
comment on table public.learner_curriculum_state is 'Rebuildable projection of learner progress against the active curriculum contract; evidence remains source truth.';
comment on table public.curriculum_planning_decisions is 'Structured, inspectable forecast decision record. This stores policy inputs/results, never private model chain-of-thought.';
comment on table public.lesson_curriculum_targets is 'Durable mapping from canonical lesson identity to curriculum requirement identity.';
