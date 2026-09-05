alter table public.lesson_schedule
  add column if not exists forecast_lineage_id uuid;

create unique index if not exists lesson_schedule_learner_forecast_lineage_unique
  on public.lesson_schedule (learner_id, forecast_lineage_id)
  where forecast_lineage_id is not null;
