-- Stage 5: additive baseline evidence metadata.
-- Preserves existing RLS and all prior evidence rows.

alter table public.learning_evidence_sessions
  add column if not exists baseline_protocol_version text,
  add column if not exists baseline_status text,
  add column if not exists baseline_item_count integer,
  add column if not exists baseline_unavailable_reason text;

alter table public.learning_evidence_events
  add column if not exists evidence_purpose text;

create index if not exists idx_learning_evidence_sessions_baseline_status
  on public.learning_evidence_sessions (baseline_status, lesson_version_id)
  where baseline_status is not null;

create index if not exists idx_learning_evidence_events_evidence_purpose
  on public.learning_evidence_events (evidence_purpose, learner_id, occurred_at desc)
  where evidence_purpose is not null;

create index if not exists idx_learning_evidence_events_prior_item_exposure
  on public.learning_evidence_events (learner_id, stable_item_id, item_content_hash, occurred_at desc)
  where event_type = 'item_presented';

comment on column public.learning_evidence_sessions.baseline_protocol_version is
  'Stage 5 baseline protocol version used for pre-instruction evidence collection.';

comment on column public.learning_evidence_sessions.baseline_status is
  'Stage 5 baseline status: complete, partial, or unavailable.';

comment on column public.learning_evidence_sessions.baseline_item_count is
  'Number of intended baseline items in the Stage 5 baseline protocol for this session.';

comment on column public.learning_evidence_sessions.baseline_unavailable_reason is
  'Narrow machine-readable reason when trustworthy baseline evidence is unavailable or partial.';

comment on column public.learning_evidence_events.evidence_purpose is
  'Stage 5 purpose dimension for evidence events; currently baseline for pre-instruction baseline item chains.';
