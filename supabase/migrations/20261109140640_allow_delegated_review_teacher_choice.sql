-- Allow a facilitator to delegate selection of a Daily or Weekly Review presenter.
-- The review run still records a concrete teacher selected before launch.
alter table public.learning_review_teacher_preferences
  drop constraint if exists learning_review_teacher_preferences_teacher_check;

alter table public.learning_review_teacher_preferences
  add constraint learning_review_teacher_preferences_teacher_check
  check (instructional_teacher in ('sonoma', 'webb', 'slate', 'learner'));

comment on column public.learning_review_teacher_preferences.instructional_teacher is
  'Presenter preference for a future Daily or Weekly Review. learner delegates the concrete selection to the learner before launch; it does not grant instructional-teacher authority.';
