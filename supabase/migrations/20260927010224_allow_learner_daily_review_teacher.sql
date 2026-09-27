-- Allow a facilitator to defer a scheduled Daily Review presenter choice to the learner.
-- The deferred value is valid only on the assignment. Completed reviews still store the actual presenter.

alter table public.syllabus_slate_assignments
  drop constraint if exists syllabus_slate_assignments_review_teacher_check;

alter table public.syllabus_slate_assignments
  add constraint syllabus_slate_assignments_review_teacher_check
  check (review_teacher in ('sonoma', 'webb', 'slate', 'learner'));

comment on column public.syllabus_slate_assignments.review_teacher is
  'Presenter selection for this Daily Review. learner means the learner chooses Sonoma, Webb, or Slate before launch. This does not grant instructional-teacher authority.';
