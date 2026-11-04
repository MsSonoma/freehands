-- Independent, per-learner work timer modes for Ms. Sonoma and Mrs. Webb.
-- Safe defaults preserve existing teacher timer styles.
alter table public.learners
  add column if not exists sonoma_work_timer_style text not null default 'countdown'
    check (sonoma_work_timer_style in ('countdown', 'countup')),
  add column if not exists sonoma_stall_allowance integer not null default 2
    check (sonoma_stall_allowance between 0 and 99),
  add column if not exists sonoma_response_reminder_interval_min integer not null default 2
    check (sonoma_response_reminder_interval_min between 1 and 30),
  add column if not exists webb_work_timer_style text not null default 'countup'
    check (webb_work_timer_style in ('countdown', 'countup')),
  add column if not exists webb_stall_allowance integer not null default 2
    check (webb_stall_allowance between 0 and 99),
  add column if not exists webb_research_work_min integer not null default 30
    check (webb_research_work_min between 1 and 240),
  add column if not exists webb_writing_work_min integer not null default 45
    check (webb_writing_work_min between 1 and 240);

-- Existing telemetry remains evidence of a response stall, not mastery failure.
-- Facilitator corrections are recorded as separately identifiable audit events.
alter table public.webb_pacing_events
  drop constraint if exists webb_pacing_events_type_check;
alter table public.webb_pacing_events
  add constraint webb_pacing_events_type_check check (event_type in (
    'response_turn_started', 'response_reminder', 'response_received',
    'facilitator_escalated', 'facilitator_stall_corrected',
    'play_break_started', 'play_break_completed'
  ));

-- Keep Ms. Sonoma's observed escalation corrections in the existing event audit table.
alter table public.sonoma_response_pacing_events
  drop constraint if exists sonoma_response_pacing_type_check;
alter table public.sonoma_response_pacing_events
  add constraint sonoma_response_pacing_type_check check (event_type in (
    'response_turn_started', 'response_reminder', 'response_received',
    'facilitator_escalated', 'facilitator_stall_corrected'
  ));
