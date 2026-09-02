-- Stage 6: independent mastery and recovery evidence.
-- Additive only: preserves existing RLS, rows, scores, medals, transcripts, and
-- prior Stage 1-5 evidence semantics.

alter table public.learning_evidence_sessions
  add column if not exists mastery_protocol_version text;

alter table public.learning_evidence_events
  add column if not exists mastery_protocol_version text,
  add column if not exists mastery_cycle_id text,
  add column if not exists mastery_check_id text,
  add column if not exists mastery_check_role text,
  add column if not exists independence_status text,
  add column if not exists independence_reason text,
  add column if not exists mastery_outcome text;

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
      'recovery_completed'
    ));

create index if not exists idx_learning_evidence_events_mastery_check
  on public.learning_evidence_events (mastery_check_id, mastery_outcome)
  where mastery_check_id is not null;

create index if not exists idx_learning_evidence_events_mastery_cycle
  on public.learning_evidence_events (mastery_cycle_id, occurred_at asc)
  where mastery_cycle_id is not null;

create index if not exists idx_learning_evidence_events_mastery_outcome
  on public.learning_evidence_events (mastery_outcome, learner_id, lesson_key)
  where mastery_outcome is not null;

comment on column public.learning_evidence_sessions.mastery_protocol_version is
  'Stage 6 independent mastery protocol version used for held-out post-instruction evidence classification.';

comment on column public.learning_evidence_events.mastery_protocol_version is
  'Stage 6 independent mastery protocol version for mastery/recovery result events.';

comment on column public.learning_evidence_events.mastery_cycle_id is
  'Stage 6 grouping id for an initial held-out check, recovery, and any fresh verification check.';

comment on column public.learning_evidence_events.mastery_check_id is
  'Stage 6 stable id for a single held-out item exposure used as a mastery check.';

comment on column public.learning_evidence_events.mastery_check_role is
  'Stage 6 check role: initial or recovery_verification.';

comment on column public.learning_evidence_events.independence_status is
  'Stage 6 independence classification, separated from answer correctness.';

comment on column public.learning_evidence_events.independence_reason is
  'Stage 6 machine-readable reason explaining why the exposure did or did not qualify as independent.';

comment on column public.learning_evidence_events.mastery_outcome is
  'Stage 6 result such as independent_success, needs_recovery, independent_success_after_recovery, assisted_success, or unavailable.';
