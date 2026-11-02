-- Separate learner checkpoints by the exact facilitator restart occurrence.
-- Existing lesson-scoped snapshots remain untouched for historical recovery.
create table if not exists public.learner_restart_snapshots (
  user_id uuid not null references auth.users(id),
  learner_id uuid not null references public.learners(id),
  lesson_key text not null,
  occurrence_id text not null check (occurrence_id ~ '^restart:[0-9a-f-]{36}$'),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, learner_id, lesson_key, occurrence_id)
);
create index if not exists learner_restart_snapshots_recent_idx
  on public.learner_restart_snapshots(learner_id, updated_at desc);
alter table public.learner_restart_snapshots enable row level security;
revoke all on public.learner_restart_snapshots from public, anon, authenticated;
grant select, insert, update, delete on public.learner_restart_snapshots to service_role;
