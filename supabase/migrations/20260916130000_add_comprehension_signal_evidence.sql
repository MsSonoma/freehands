-- Add first-class learner-expressed comprehension evidence without changing the evidence table shape.
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
      'comprehension_signal',
      'repeat_used',
      'visual_aid_used',
      'question_set_refreshed',
      'timeline_jump',
      'mastery_check_result',
      'recovery_started',
      'recovery_completed',
      'retention_check_result'
    ));

comment on column public.learning_evidence_events.event_type is
  'Evidence event kind. comprehension_signal stores learner-expressed understanding separately from assistance and mastery qualification.';
