-- Same-day Daily Reviews.
-- Additive only: historical Daily Follow-Up and Weekly Review rows keep their original meaning.

alter table public.learning_review_runs
  drop constraint if exists learning_review_runs_type_check,
  drop constraint if exists learning_review_runs_protocol_check,
  drop constraint if exists learning_review_runs_type_protocol_check;

alter table public.learning_review_runs
  add constraint learning_review_runs_type_check
    check (review_type in ('daily_followup', 'daily_review', 'weekly_review')),
  add constraint learning_review_runs_protocol_check
    check (protocol_version in ('daily-followup-v1', 'daily-review-v1', 'weekly-review-v1')),
  add constraint learning_review_runs_type_protocol_check
    check (
      (review_type = 'daily_followup' and protocol_version = 'daily-followup-v1')
      or (review_type = 'daily_review' and protocol_version = 'daily-review-v1')
      or (review_type = 'weekly_review' and protocol_version = 'weekly-review-v1')
    );

comment on table public.learning_review_runs is
  'Stable historical Daily Follow-Up, same-day Daily Review, and Weekly Review groupings. These are not lesson assignments or curriculum objects.';
