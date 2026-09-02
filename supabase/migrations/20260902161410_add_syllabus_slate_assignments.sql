-- Occurrence-bound Mr. Slate assignments are supplemental practice events.
-- They never replace the instructional teacher on a lesson association.

create table public.syllabus_slate_assignments (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  syllabus_occurrence_id text not null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint syllabus_slate_assignments_lesson_key_check check (length(btrim(lesson_key)) > 0),
  constraint syllabus_slate_assignments_occurrence_check check (length(btrim(syllabus_occurrence_id)) > 0),
  constraint syllabus_slate_assignments_occurrence_unique unique (
    facilitator_id,
    learner_id,
    syllabus_occurrence_id
  )
);

create index syllabus_slate_assignments_learner_idx
  on public.syllabus_slate_assignments(facilitator_id, learner_id, assigned_at);

alter table public.syllabus_slate_assignments enable row level security;

create policy "syllabus_slate_assignments_select_own"
  on public.syllabus_slate_assignments
  for select
  to authenticated
  using ((select auth.uid()) = facilitator_id);

revoke all on table public.syllabus_slate_assignments from public, anon, authenticated;
grant select on table public.syllabus_slate_assignments to authenticated;
grant select, insert, delete on table public.syllabus_slate_assignments to service_role;

comment on table public.syllabus_slate_assignments is
  'Facilitator-assigned, occurrence-bound Mr. Slate practice events. These do not grant instructional-teacher authority or complete an instructional lesson.';
