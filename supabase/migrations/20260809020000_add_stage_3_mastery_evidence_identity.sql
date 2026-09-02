-- Stage 3: stable lesson/protocol/item identity substrate for mastery evidence.
-- Additive only: existing Stage 1/2 session and event writes remain valid.

alter table public.learning_evidence_sessions
  add column if not exists identity_schema_version text,
  add column if not exists stable_lesson_key text,
  add column if not exists lesson_identity_version text;

alter table public.learning_evidence_events
  add column if not exists stable_item_id text,
  add column if not exists item_content_hash text,
  add column if not exists item_identity_version text;

create index if not exists idx_learning_evidence_sessions_lesson_version_identity
  on public.learning_evidence_sessions (stable_lesson_key, lesson_version_id)
  where lesson_version_id is not null;

create index if not exists idx_learning_evidence_events_stable_item_identity
  on public.learning_evidence_events (stable_item_id, item_content_hash)
  where stable_item_id is not null;

comment on column public.learning_evidence_sessions.identity_schema_version is
  'Stage 3 evidence identity schema version. Nullable for pre-Stage-3 rows and backward-compatible writers.';

comment on column public.learning_evidence_sessions.stable_lesson_key is
  'Stage 3 canonical stable lesson identity. Existing lesson_key remains available for backward-compatible source references.';

comment on column public.learning_evidence_sessions.lesson_identity_version is
  'Deterministic lesson identity algorithm version. Nullable for pre-Stage-3 rows and backward-compatible writers.';

comment on column public.learning_evidence_events.stable_item_id is
  'Stage 3 stable item identity, preserved across repeated exposures of the same source/content item.';

comment on column public.learning_evidence_events.item_content_hash is
  'Stage 3 deterministic hash of canonical item content, excluding runtime exposure and learner-response state.';

comment on column public.learning_evidence_events.item_identity_version is
  'Deterministic item identity algorithm version. Nullable for pre-Stage-3 rows and backward-compatible writers.';
