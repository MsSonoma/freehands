-- Durable Mr. Slate completion facts. These are supplemental activity records,
-- not instructional lesson completions and not mastery claims.

create table public.slate_session_completions (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  syllabus_occurrence_id text,
  run_purpose text not null default 'practice',
  lesson_title text,
  subject text,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  source text not null default 'slate_session_v1',
  source_identity text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint slate_session_completions_lesson_key_check check (length(btrim(lesson_key)) > 0),
  constraint slate_session_completions_run_purpose_check check (run_purpose in (
    'practice',
    'independent_mastery',
    'recovery',
    'daily_followup',
    'weekly_review',
    'retention'
  )),
  constraint slate_session_completions_time_check check (completed_at >= started_at),
  constraint slate_session_completions_source_check check (source in ('slate_session_v1', 'verified_transcript_backfill_v1')),
  constraint slate_session_completions_source_unique unique (facilitator_id, learner_id, source_identity)
);

create index slate_session_completions_learner_completed_idx
  on public.slate_session_completions(facilitator_id, learner_id, completed_at, id);

alter table public.slate_session_completions enable row level security;

revoke all on table public.slate_session_completions from public, anon, authenticated;
grant select, insert on table public.slate_session_completions to service_role;

comment on table public.slate_session_completions is
  'Durable completion facts for Mr. Slate supplemental sessions. They do not grant instructional completion or mastery.';