-- Stage 4: additive assessment-isolation evidence metadata.
-- Does not change RLS, existing event semantics, or learner-facing behavior.

alter table public.learning_evidence_sessions
  add column if not exists assessment_isolation_version text,
  add column if not exists assessment_isolation_status text,
  add column if not exists reserved_assessment_count integer;

alter table public.learning_evidence_events
  add column if not exists assessment_role text,
  add column if not exists pre_assessment_exposed boolean;

create index if not exists idx_learning_evidence_sessions_assessment_isolation
  on public.learning_evidence_sessions (assessment_isolation_status, lesson_version_id)
  where assessment_isolation_status is not null;

create index if not exists idx_learning_evidence_events_assessment_role
  on public.learning_evidence_events (assessment_role, pre_assessment_exposed)
  where assessment_role is not null;

comment on column public.learning_evidence_sessions.assessment_isolation_version is
  'Stage 4 assessment isolation model version used to classify this learning evidence session.';

comment on column public.learning_evidence_sessions.assessment_isolation_status is
  'Stage 4 isolation status: isolated, not_isolated, or unavailable.';

comment on column public.learning_evidence_sessions.reserved_assessment_count is
  'Number of source-backed reserved assessment items available for the session isolation analysis.';

comment on column public.learning_evidence_events.assessment_role is
  'Stage 4 item role at exposure time: instructional or assessment_reserved.';

comment on column public.learning_evidence_events.pre_assessment_exposed is
  'For reserved assessment item presentation, true when the same stable/content item identity had already been presented in this evidence client session.';
