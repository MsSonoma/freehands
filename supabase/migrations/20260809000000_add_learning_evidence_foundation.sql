-- Stage 1 Mastery Evidence foundation.
-- Additive only: does not modify lessons, snapshots, transcripts, scores, medals,
-- assessment decks, or existing lesson_session_events.

create table if not exists public.learning_evidence_sessions (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,

  session_id text not null,
  browser_session_id text,

  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,

  lesson_key text not null,
  lesson_id text,
  lesson_source text,

  lesson_version text,
  lesson_version_id uuid,
  lesson_content_hash text,

  teaching_protocol_version text,
  teaching_protocol_hash text,

  provider text,
  model text,
  app_build_id text,

  evidence_status text not null default 'partial',

  started_at timestamptz not null default now(),
  ended_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint learning_evidence_sessions_status_check
    check (evidence_status in ('complete', 'partial', 'unavailable')),
  constraint learning_evidence_sessions_schema_check
    check (schema_version = 'mastery-evidence-v1'),
  constraint learning_evidence_sessions_unique_session
    unique (facilitator_id, session_id, schema_version)
);

create table if not exists public.learning_evidence_events (
  event_id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  event_type text not null,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  idempotency_key text not null,

  evidence_session_id uuid not null references public.learning_evidence_sessions(id) on delete cascade,
  session_id text not null,
  browser_session_id text,

  learner_id uuid not null references public.learners(id) on delete cascade,
  facilitator_id uuid not null references auth.users(id) on delete cascade,

  lesson_key text not null,
  lesson_id text,

  phase text,

  concept_id text,
  item_id text,
  item_purpose text,
  item_exposure_id text,

  assistance_level text,
  attempt_number integer,
  is_first_response boolean,

  result jsonb,
  payload jsonb,
  provenance jsonb,

  constraint learning_evidence_events_schema_check
    check (schema_version = 'mastery-evidence-v1'),
  constraint learning_evidence_events_type_check
    check (event_type in ('session_started', 'phase_transition', 'session_ended')),
  constraint learning_evidence_events_idempotency_unique
    unique (idempotency_key)
);

create index if not exists idx_learning_evidence_sessions_facilitator_learner
  on public.learning_evidence_sessions(facilitator_id, learner_id, started_at desc);

create index if not exists idx_learning_evidence_sessions_lesson
  on public.learning_evidence_sessions(learner_id, lesson_key, started_at desc);

create index if not exists idx_learning_evidence_events_session
  on public.learning_evidence_events(evidence_session_id, occurred_at asc, created_at asc);

create index if not exists idx_learning_evidence_events_learner_lesson
  on public.learning_evidence_events(learner_id, lesson_key, occurred_at desc);

alter table public.learning_evidence_sessions enable row level security;
alter table public.learning_evidence_events enable row level security;

drop policy if exists "learning_evidence_sessions_select_own" on public.learning_evidence_sessions;
create policy "learning_evidence_sessions_select_own"
  on public.learning_evidence_sessions for select
  using (auth.uid() = facilitator_id);

drop policy if exists "learning_evidence_events_select_own" on public.learning_evidence_events;
create policy "learning_evidence_events_select_own"
  on public.learning_evidence_events for select
  using (auth.uid() = facilitator_id);

-- Application writes go through /api/evidence with authenticated ownership checks.
-- No direct authenticated insert/update/delete policies are added here.

grant select on table public.learning_evidence_sessions to authenticated;
grant select on table public.learning_evidence_events to authenticated;

comment on table public.learning_evidence_sessions is
  'Versioned session-level identity, provenance, and integrity status for Ms. Sonoma mastery evidence.';

comment on table public.learning_evidence_events is
  'Append-only Stage 1 mastery evidence events. Application corrections should be represented by future events, not mutation.';
