-- Stage 2 Mastery Evidence instrumentation vocabulary.
-- Additive only: preserves Stage 1 evidence sessions/events and does not
-- change lesson behavior, snapshots, transcripts, scores, medals, or prompts.

alter table public.learning_evidence_events
  add column if not exists event_sequence integer;

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
      'timeline_jump'
    ));

create index if not exists idx_learning_evidence_events_session_sequence
  on public.learning_evidence_events(evidence_session_id, event_sequence asc)
  where event_sequence is not null;

comment on column public.learning_evidence_events.event_sequence is
  'Client-assigned monotonic order for attempted evidence events within a browser writer instance; nullable for pre-Stage 2 rows.';

comment on table public.learning_evidence_events is
  'Append-only mastery evidence events. Stage 2 records current learner/item interactions without changing learning behavior.';
