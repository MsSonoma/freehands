-- Stage 7: delayed retention evidence.
-- Additive only: preserves existing RLS, rows, scores, medals, transcripts,
-- and prior Stage 1-6 evidence semantics.

alter table public.learning_evidence_sessions
  add column if not exists retention_protocol_version text;

alter table public.learning_evidence_events
  add column if not exists retention_protocol_version text,
  add column if not exists retention_check_id text,
  add column if not exists retention_anchor_mastery_check_id text,
  add column if not exists retention_delay_seconds integer,
  add column if not exists retention_qualification_status text,
  add column if not exists retention_qualification_reason text,
  add column if not exists retention_outcome text;

alter table public.learning_evidence_events
  drop constraint if exists learning_evidence_events_type_check;

alter table public.learning_evidence_events
  add constraint learning_evidence_events_type_check
    check (event_type in (
      'session_started',
      'phase_transition',
      'session_ended',
      'item_presented',
      'learner_response',
      'answer_evaluated',
      'hint_given',
      'retry_requested',
      'answer_revealed',
      'ask_used',
      'repeat_used',
      'visual_aid_used',
      'question_set_refreshed',
      'timeline_jump',
      'mastery_check_result',
      'recovery_started',
      'recovery_completed',
      'retention_check_result'
    ));

create index if not exists idx_learning_evidence_events_retention_anchor
  on public.learning_evidence_events (retention_anchor_mastery_check_id, learner_id)
  where retention_anchor_mastery_check_id is not null;

create index if not exists idx_learning_evidence_events_retention_check
  on public.learning_evidence_events (retention_check_id, retention_outcome)
  where retention_check_id is not null;

create index if not exists idx_learning_evidence_events_retention_history
  on public.learning_evidence_events (learner_id, lesson_key, event_type, occurred_at desc)
  where event_type in ('mastery_check_result', 'retention_check_result', 'item_presented');

comment on column public.learning_evidence_sessions.retention_protocol_version is
  'Stage 7 retention protocol version used for delayed retention evidence opportunities.';

comment on column public.learning_evidence_events.retention_protocol_version is
  'Stage 7 retention protocol version for delayed retention result events.';

comment on column public.learning_evidence_events.retention_check_id is
  'Stage 7 stable id for a delayed retention item exposure.';

comment on column public.learning_evidence_events.retention_anchor_mastery_check_id is
  'Stage 7 explicit reference to the prior Stage 6 independent-success mastery_check_id anchoring this retention check.';

comment on column public.learning_evidence_events.retention_delay_seconds is
  'Exact elapsed seconds between the Stage 6 anchor event timestamp and the Stage 7 retention check presentation.';

comment on column public.learning_evidence_events.retention_qualification_status is
  'Stage 7 qualification status, separated from answer correctness.';

comment on column public.learning_evidence_events.retention_qualification_reason is
  'Stage 7 machine-readable reason explaining why the delayed exposure did or did not qualify as clean retention evidence.';

comment on column public.learning_evidence_events.retention_outcome is
  'Stage 7 outcome such as retained, needs_review, assisted_review, or unavailable.';
