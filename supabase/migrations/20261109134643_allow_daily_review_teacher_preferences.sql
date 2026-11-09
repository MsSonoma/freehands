-- Preserve facilitator teacher choice before a Daily Review becomes ready.
-- Once a review run starts, its recorded teacher remains authoritative.
alter table public.learning_review_teacher_preferences
  drop constraint if exists learning_review_teacher_preferences_type_check;

alter table public.learning_review_teacher_preferences
  add constraint learning_review_teacher_preferences_type_check
  check (review_type in ('daily_review', 'weekly_review'));

comment on column public.learning_review_teacher_preferences.instructional_teacher is
  'Presenter selected for a future Daily or Weekly Review. This does not grant instructional-teacher authority.';
