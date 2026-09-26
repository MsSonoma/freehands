-- Presentation-teacher identity for supplemental Daily Review sessions.
-- This changes presentation only; the underlying Slate review/evidence engine remains authoritative.

alter table public.syllabus_slate_assignments
  add column review_teacher text not null default 'slate';

alter table public.syllabus_slate_assignments
  add constraint syllabus_slate_assignments_review_teacher_check
  check (review_teacher in ('sonoma', 'webb', 'slate'));

comment on column public.syllabus_slate_assignments.review_teacher is
  'Presenter selected for this Daily Review. slate is the default. This does not grant instructional-teacher authority.';

alter table public.slate_session_completions
  add column review_teacher text not null default 'slate';

alter table public.slate_session_completions
  add constraint slate_session_completions_review_teacher_check
  check (review_teacher in ('sonoma', 'webb', 'slate'));

comment on column public.slate_session_completions.review_teacher is
  'Presenter used for the completed Daily Review. This is presentation metadata, not instructional-teacher authority.';
