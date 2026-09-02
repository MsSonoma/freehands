-- Add a service-route-only, append-only record for facilitator-attested legacy
-- activity. These rows are display provenance, not canonical lesson sessions,
-- transcripts, mastery evidence, retention evidence, or Syllabus membership.

alter table public.syllabus_lesson_associations
  drop constraint syllabus_lesson_associations_source_check;

alter table public.syllabus_lesson_associations
  add constraint syllabus_lesson_associations_source_check check (
    association_source in ('generator', 'prepare', 'availability', 'schedule', 'syllabus')
  );

create table public.syllabus_legacy_activity_records (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  syllabus_occurrence_id text not null,
  activity_type text not null,
  instructional_teacher text,
  occurred_at timestamptz not null,
  provenance text not null,
  source_identity text not null,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint syllabus_legacy_activity_lesson_key_check check (length(btrim(lesson_key)) > 0),
  constraint syllabus_legacy_activity_occurrence_check check (length(btrim(syllabus_occurrence_id)) > 0),
  constraint syllabus_legacy_activity_type_check check (
    activity_type in ('instructional_completion', 'slate_drill_completion')
  ),
  constraint syllabus_legacy_activity_teacher_check check (
    (activity_type = 'instructional_completion' and instructional_teacher is not null and instructional_teacher in ('sonoma', 'webb'))
    or (activity_type = 'slate_drill_completion' and instructional_teacher is null)
  ),
  constraint syllabus_legacy_activity_provenance_check check (
    provenance = 'facilitator_recorded_legacy_activity'
    or (
      provenance = 'facilitator_attested_webb_completion_v1_import'
      and activity_type = 'instructional_completion'
      and instructional_teacher = 'webb'
    )
  ),
  constraint syllabus_legacy_activity_recorded_by_check check (recorded_by = facilitator_id),
  constraint syllabus_legacy_activity_source_unique unique (facilitator_id, learner_id, source_identity)
);

create index syllabus_legacy_activity_learner_time_idx
  on public.syllabus_legacy_activity_records(learner_id, occurred_at);

create function public.reject_syllabus_legacy_activity_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Historical Syllabus activity records are append-only';
end;
$$;

create trigger reject_syllabus_legacy_activity_mutation
  before update or delete on public.syllabus_legacy_activity_records
  for each row execute function public.reject_syllabus_legacy_activity_mutation();

revoke all on function public.reject_syllabus_legacy_activity_mutation() from public, anon, authenticated;

alter table public.syllabus_legacy_activity_records enable row level security;

revoke all on table public.syllabus_legacy_activity_records from public, anon, authenticated, service_role;
grant select, insert on table public.syllabus_legacy_activity_records to service_role;

comment on table public.syllabus_legacy_activity_records is
  'Facilitator-attested legacy activity for Syllabus display only. Never canonical mastery, retention, transcript, or lesson-session evidence.';
comment on column public.syllabus_legacy_activity_records.syllabus_occurrence_id is
  'Exact active-Syllabus occurrence selected by the facilitator; required to prevent repeated-lesson ambiguity.';
comment on column public.syllabus_legacy_activity_records.provenance is
  'Explicit legacy source. facilitator_attested_webb_completion_v1_import records a facilitator-attested completed browser record and timestamp; it is not server-verified learning evidence.';
