-- Mrs. Webb response pacing and milestone play timers.
-- Pacing evidence is deliberately separate from learning/mastery evidence.

alter table public.learners
  add column if not exists webb_response_pacing_enabled boolean not null default true,
  add column if not exists webb_response_reminder_interval_min integer not null default 2 check (webb_response_reminder_interval_min between 1 and 30),
  add column if not exists webb_play_times_enabled boolean not null default true,
  add column if not exists webb_play_time_min integer not null default 5 check (webb_play_time_min between 1 and 60),
  add column if not exists webb_play_research_midpoint_enabled boolean not null default true,
  add column if not exists webb_play_transition_enabled boolean not null default true,
  add column if not exists webb_play_writing_midpoint_enabled boolean not null default true;

alter table public.facilitator_notifications
  add column if not exists dedupe_key text;

create unique index if not exists facilitator_notifications_dedupe_key_uidx
  on public.facilitator_notifications (facilitator_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.webb_pacing_events (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid,
  session_id text,
  lesson_key text,
  turn_id text,
  event_type text not null,
  event_key text not null,
  elapsed_seconds integer,
  reminder_stage integer,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint webb_pacing_events_elapsed_nonnegative check (elapsed_seconds is null or elapsed_seconds >= 0),
  constraint webb_pacing_events_stage_range check (reminder_stage is null or reminder_stage between 0 and 5),
  constraint webb_pacing_events_type_check check (event_type in (
    'response_turn_started',
    'response_reminder',
    'response_received',
    'facilitator_escalated',
    'play_break_started',
    'play_break_completed'
  )),
  constraint webb_pacing_events_facilitator_event_unique unique (facilitator_id, event_key)
);

create index if not exists webb_pacing_events_learner_time_idx
  on public.webb_pacing_events (learner_id, occurred_at desc);

create index if not exists webb_pacing_events_session_idx
  on public.webb_pacing_events (session_id, occurred_at);

alter table public.webb_pacing_events enable row level security;

drop policy if exists "Facilitators can read own Webb pacing events" on public.webb_pacing_events;
create policy "Facilitators can read own Webb pacing events"
  on public.webb_pacing_events for select
  using (auth.uid() = facilitator_id);

drop policy if exists "Facilitators can insert own Webb pacing events" on public.webb_pacing_events;
create policy "Facilitators can insert own Webb pacing events"
  on public.webb_pacing_events for insert
  with check (auth.uid() = facilitator_id);

comment on table public.webb_pacing_events is
  'Mrs. Webb response-pacing and play-break telemetry. This table is not mastery, assessment, or retention evidence.';