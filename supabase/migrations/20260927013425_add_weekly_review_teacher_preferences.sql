-- Persist presenter choice for a Weekly Review before the review run exists.
-- This is planning metadata only. Once a learning_review_run starts, its metadata remains authoritative.

create table if not exists public.learning_review_teacher_preferences (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  review_type text not null,
  cycle_key text not null,
  instructional_teacher text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint learning_review_teacher_preferences_type_check
    check (review_type = 'weekly_review'),
  constraint learning_review_teacher_preferences_cycle_key_check
    check (length(btrim(cycle_key)) > 0),
  constraint learning_review_teacher_preferences_teacher_check
    check (instructional_teacher in ('sonoma', 'webb', 'slate')),
  constraint learning_review_teacher_preferences_cycle_unique
    unique (facilitator_id, learner_id, review_type, cycle_key)
);

create index if not exists learning_review_teacher_preferences_learner_idx
  on public.learning_review_teacher_preferences(facilitator_id, learner_id, review_type, cycle_key);

alter table public.learning_review_teacher_preferences enable row level security;

revoke all on table public.learning_review_teacher_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.learning_review_teacher_preferences to service_role;

comment on table public.learning_review_teacher_preferences is
  'Facilitator-owned presenter planning for a review cycle before a learning_review_run exists. Run metadata becomes authoritative after start.';

comment on column public.learning_review_teacher_preferences.instructional_teacher is
  'Presenter selected for the future Weekly Review. This does not grant instructional-teacher authority.';
