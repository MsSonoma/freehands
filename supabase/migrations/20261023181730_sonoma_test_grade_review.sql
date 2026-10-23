-- Allow PIN-verified facilitator grading revisions to be recorded as their
-- own append-only evidence events. Existing answer_evaluated events remain intact.
-- Applies only when this repository migration is explicitly deployed.
begin;

alter table public.learning_evidence_events
  drop constraint learning_evidence_events_type_check;

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
    'comprehension_signal',
    'repeat_used',
    'visual_aid_used',
    'question_set_refreshed',
    'timeline_jump',
    'mastery_check_result',
    'recovery_started',
    'recovery_completed',
    'retention_check_result',
    'test_grade_reviewed'
  ));

commit;
