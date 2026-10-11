-- Durable Mr. Slate Liftoff instructional process records.
-- These preserve responsibility-transfer evidence for facilitator review.
-- They do not, by themselves, assert mastery or retention.

create table public.slate_liftoff_records (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  syllabus_occurrence_id text not null,
  execution_session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  lesson_title text,
  subject text,
  protocol_version text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  independent_test_percentage numeric,
  component_state jsonb not null default '[]'::jsonb,
  responsibility_trace jsonb not null default '[]'::jsonb,
  integration_confirmed boolean not null default false,
  variation_confirmed boolean not null default false,
  procedure_released boolean not null default false,
  source text not null default 'slate_liftoff_v1',
  created_at timestamptz not null default timezone('utc', now()),
  constraint slate_liftoff_records_lesson_key_check check (length(btrim(lesson_key)) > 0),
  constraint slate_liftoff_records_occurrence_check check (length(btrim(syllabus_occurrence_id)) > 0),
  constraint slate_liftoff_records_protocol_check check (length(btrim(protocol_version)) > 0),
  constraint slate_liftoff_records_time_check check (completed_at >= started_at),
  constraint slate_liftoff_records_percentage_check check (
    independent_test_percentage is null
    or (independent_test_percentage >= 0 and independent_test_percentage <= 100)
  ),
  constraint slate_liftoff_records_component_state_array_check check (jsonb_typeof(component_state) = 'array'),
  constraint slate_liftoff_records_trace_array_check check (jsonb_typeof(responsibility_trace) = 'array'),
  constraint slate_liftoff_records_source_check check (source = 'slate_liftoff_v1'),
  constraint slate_liftoff_records_execution_unique unique (execution_session_id)
);

create index slate_liftoff_records_learner_completed_idx
  on public.slate_liftoff_records(facilitator_id, learner_id, completed_at desc, id);

create index slate_liftoff_records_learner_idx
  on public.slate_liftoff_records(learner_id);

alter table public.slate_liftoff_records enable row level security;

revoke all on table public.slate_liftoff_records from public, anon, authenticated;
grant select, insert on table public.slate_liftoff_records to service_role;

comment on table public.slate_liftoff_records is
  'Durable Mr. Slate Liftoff responsibility-transfer process evidence. Records observed instructional state and trace; does not independently assert mastery or retention.';

comment on column public.slate_liftoff_records.component_state is
  'Final per-component responsibility/evidence state at Liftoff release and independent assessment completion.';

comment on column public.slate_liftoff_records.responsibility_trace is
  'Ordered Liftoff diagnostic/action trace. Process evidence only; not a mastery claim.';
