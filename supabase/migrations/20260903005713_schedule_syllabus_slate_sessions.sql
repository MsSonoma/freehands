-- Give facilitator-scheduled Mr. Slate supplemental sessions their own date and
-- canonical Slate run purpose. Existing rows remain valid and use the
-- instructional occurrence date as a read-model fallback until rescheduled.

alter table public.syllabus_slate_assignments
  add column scheduled_date date,
  add column run_purpose text not null default 'practice';

alter table public.syllabus_slate_assignments
  drop constraint syllabus_slate_assignments_occurrence_unique;

alter table public.syllabus_slate_assignments
  add constraint syllabus_slate_assignments_run_purpose_check
  check (run_purpose in (
    'practice',
    'independent_mastery',
    'recovery',
    'daily_followup',
    'weekly_review',
    'retention'
  ));

create index syllabus_slate_assignments_scheduled_date_idx
  on public.syllabus_slate_assignments(facilitator_id, learner_id, scheduled_date, id);

create unique index syllabus_slate_assignments_scheduled_session_unique
  on public.syllabus_slate_assignments(
    facilitator_id,
    learner_id,
    syllabus_occurrence_id,
    scheduled_date,
    run_purpose
  )
  where scheduled_date is not null;

comment on column public.syllabus_slate_assignments.scheduled_date is
  'Authoritative date for a separately scheduled supplemental Mr. Slate session. Null only supports assignments created before this column existed.';

comment on column public.syllabus_slate_assignments.run_purpose is
  'Canonical Mr. Slate run purpose; this never grants instructional-teacher or instructional-completion authority.';

comment on table public.syllabus_slate_assignments is
  'Facilitator-scheduled, occurrence-bound Mr. Slate supplemental sessions. These do not grant instructional-teacher authority or complete an instructional lesson.';
