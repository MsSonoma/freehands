-- Daily Follow-Ups and Weekly Reviews.
-- Additive only: existing Stage 1-8 evidence, lesson sessions, scores,
-- snapshots, transcripts, and retention-v1 rows keep their original meaning.

alter table public.learners
  add column if not exists daily_followups_enabled boolean not null default false,
  add column if not exists weekly_reviews_enabled boolean not null default false,
  add column if not exists weekly_review_day text not null default 'friday';

alter table public.learners
  drop constraint if exists learners_weekly_review_day_check;

alter table public.learners
  add constraint learners_weekly_review_day_check
    check (weekly_review_day in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    ));

create table if not exists public.learning_review_runs (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,

  review_type text not null,
  protocol_version text not null,
  cycle_key text not null,
  status text not null default 'active',

  timezone text not null default 'UTC',
  activation_at timestamptz,
  window_start timestamptz,
  window_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint learning_review_runs_type_check
    check (review_type in ('daily_followup', 'weekly_review')),
  constraint learning_review_runs_protocol_check
    check (protocol_version in ('daily-followup-v1', 'weekly-review-v1')),
  constraint learning_review_runs_type_protocol_check
    check (
      (review_type = 'daily_followup' and protocol_version = 'daily-followup-v1')
      or (review_type = 'weekly_review' and protocol_version = 'weekly-review-v1')
    ),
  constraint learning_review_runs_status_check
    check (status in ('active', 'completed', 'unavailable')),
  constraint learning_review_runs_unique_cycle
    unique (learner_id, review_type, cycle_key)
);

create table if not exists public.learning_review_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.learning_review_runs(id) on delete cascade,
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,

  ordinal integer not null,
  lesson_key text not null,
  lesson_id text,
  lesson_version_id uuid,
  anchor_mastery_check_id text not null,
  anchor_occurred_at timestamptz not null,
  concept_id text,

  stable_item_id text not null,
  item_content_hash text not null,
  item_identity_version text not null,
  item_exposure_id text not null,
  item_payload jsonb not null,

  created_at timestamptz not null default now(),

  constraint learning_review_items_ordinal_check check (ordinal >= 0),
  constraint learning_review_items_unique_ordinal unique (run_id, ordinal),
  constraint learning_review_items_unique_identity unique (run_id, stable_item_id, item_content_hash),
  constraint learning_review_items_unique_exposure unique (item_exposure_id)
);

create table if not exists public.learning_review_events (
  event_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.learning_review_runs(id) on delete cascade,
  review_item_id uuid not null references public.learning_review_items(id) on delete cascade,
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,

  event_type text not null,
  idempotency_key text not null unique,
  occurred_at timestamptz not null default now(),
  response_text text,
  assistance_level text,
  is_first_response boolean,
  result jsonb,

  qualification_status text,
  qualification_reason text,
  review_outcome text,
  delay_seconds integer,
  prior_daily_retrieval_observed boolean,
  intervening_instruction_observed boolean,
  intervening_review_observed boolean,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint learning_review_events_type_check
    check (event_type in (
      'item_presented',
      'learner_response',
      'answer_evaluated',
      'hint_given',
      'answer_revealed',
      'repeat_used',
      'review_item_result'
    )),
  constraint learning_review_events_delay_check
    check (delay_seconds is null or delay_seconds >= 0),
  constraint learning_review_events_qualification_check
    check (qualification_status is null or qualification_status in ('eligible', 'assisted', 'unavailable')),
  constraint learning_review_events_outcome_check
    check (review_outcome is null or review_outcome in (
      'retained',
      'needs_review',
      'assisted_review',
      'unavailable',
      'demonstrated',
      'assisted_demonstration'
    ))
);

create unique index if not exists idx_learning_review_events_single_item_fact
  on public.learning_review_events(review_item_id, event_type)
  where event_type in (
    'item_presented',
    'learner_response',
    'answer_evaluated',
    'review_item_result'
  );

create index if not exists idx_learning_review_runs_current
  on public.learning_review_runs(learner_id, review_type, status, activation_at desc);

create index if not exists idx_learning_review_runs_history
  on public.learning_review_runs(facilitator_id, learner_id, started_at desc);

create index if not exists idx_learning_review_items_anchor
  on public.learning_review_items(learner_id, anchor_mastery_check_id);

create index if not exists idx_learning_review_items_identity
  on public.learning_review_items(learner_id, stable_item_id, item_content_hash);

create index if not exists idx_learning_review_events_run
  on public.learning_review_events(run_id, occurred_at asc, created_at asc);

alter table public.learning_review_runs enable row level security;
alter table public.learning_review_items enable row level security;
alter table public.learning_review_events enable row level security;

drop policy if exists "learning_review_runs_select_own" on public.learning_review_runs;
create policy "learning_review_runs_select_own"
  on public.learning_review_runs for select
  using (auth.uid() = facilitator_id);

drop policy if exists "learning_review_items_select_own" on public.learning_review_items;
create policy "learning_review_items_select_own"
  on public.learning_review_items for select
  using (auth.uid() = facilitator_id);

drop policy if exists "learning_review_events_select_own" on public.learning_review_events;
create policy "learning_review_events_select_own"
  on public.learning_review_events for select
  using (auth.uid() = facilitator_id);

grant select on table public.learning_review_runs to authenticated;
grant select on table public.learning_review_items to authenticated;
grant select on table public.learning_review_events to authenticated;

comment on column public.learners.daily_followups_enabled is
  'Facilitator-controlled learner setting. False by default for backward compatibility.';

comment on column public.learners.weekly_reviews_enabled is
  'Facilitator-controlled learner setting. False by default for backward compatibility.';

comment on column public.learners.weekly_review_day is
  'Facilitator-selected weekly review activation weekday in the facilitator profile timezone.';

comment on table public.learning_review_runs is
  'Stable Daily Follow-Up and Weekly Review groupings. These are not lesson assignments or curriculum objects.';

comment on table public.learning_review_items is
  'Durably selected, role-separated review items and their Stage 6 anchors. Item payloads are served only through authorized APIs.';

comment on table public.learning_review_events is
  'Append-only review interaction and result facts. First responses are protected by partial unique indexes.';
