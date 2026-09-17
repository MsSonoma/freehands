-- Ms. Sonoma learner-turn response pacing telemetry.
-- These events are observational session telemetry, not mastery or assessment evidence.

create table if not exists public.sonoma_response_pacing_events (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid,
  session_id uuid,
  lesson_key text,
  turn_id uuid,
  phase text,
  turn_kind text,
  question_index integer,
  event_type text not null,
  event_key text not null,
  elapsed_seconds integer,
  reminder_stage integer,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint sonoma_response_pacing_elapsed_nonnegative check (elapsed_seconds is null or elapsed_seconds >= 0),
  constraint sonoma_response_pacing_stage_range check (reminder_stage is null or reminder_stage between 0 and 5),
  constraint sonoma_response_pacing_question_nonnegative check (question_index is null or question_index >= 0),
  constraint sonoma_response_pacing_type_check check (event_type in (
    'response_turn_started',
    'response_reminder',
    'response_received',
    'facilitator_escalated'
  )),
  constraint sonoma_response_pacing_facilitator_event_unique unique (facilitator_id, event_key)
);

create index if not exists sonoma_response_pacing_learner_time_idx
  on public.sonoma_response_pacing_events (learner_id, occurred_at desc);

create index if not exists sonoma_response_pacing_session_idx
  on public.sonoma_response_pacing_events (session_id, occurred_at);

alter table public.sonoma_response_pacing_events enable row level security;

drop policy if exists "Facilitators can read own Sonoma pacing events" on public.sonoma_response_pacing_events;
create policy "Facilitators can read own Sonoma pacing events"
  on public.sonoma_response_pacing_events for select
  using (auth.uid() = facilitator_id);

comment on table public.sonoma_response_pacing_events is
  'Ms. Sonoma learner-turn response pacing telemetry. This table is observational and is not mastery, assessment, or retention evidence.';