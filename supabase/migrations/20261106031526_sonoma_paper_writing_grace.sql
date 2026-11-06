-- Configurable, per-learner handwriting grace period before Worksheet/Test reminders.
-- Two minutes is the default; zero disables only the grace period, not the Next gate.
alter table public.learners
  add column if not exists sonoma_paper_writing_min integer not null default 2
    check (sonoma_paper_writing_min between 0 and 30);
