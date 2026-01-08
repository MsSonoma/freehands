-- Adds a per-learner switch to disable Golden Key UI/logic.

alter table public.learners
  add column if not exists golden_keys_enabled boolean not null default true;

comment on column public.learners.golden_keys_enabled is
  'Per-learner feature flag. When false, Golden Key UI/logic is hidden/disabled but stored keys remain.';
