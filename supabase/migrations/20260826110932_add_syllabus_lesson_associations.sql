-- Durable learner association for operational lesson placement in the Syllabus.
-- Dates remain in immutable forecast rows or explicit lesson_schedule rows;
-- inferred weekly-pattern placement is computed by the read model only.

create table public.syllabus_lesson_associations (
  id bigint generated always as identity primary key,
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  subject text not null,
  title text not null,
  readiness_state text not null default 'saved',
  association_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint syllabus_lesson_associations_key_check check (length(btrim(lesson_key)) > 0),
  constraint syllabus_lesson_associations_subject_check check (length(btrim(subject)) > 0),
  constraint syllabus_lesson_associations_title_check check (length(btrim(title)) > 0),
  constraint syllabus_lesson_associations_readiness_check check (
    readiness_state in ('draft', 'approved', 'available', 'saved')
  ),
  constraint syllabus_lesson_associations_source_check check (
    association_source in ('generator', 'prepare', 'availability', 'schedule')
  ),
  constraint syllabus_lesson_associations_identity_unique unique (facilitator_id, learner_id, lesson_key)
);

create index syllabus_lesson_associations_learner_idx
  on public.syllabus_lesson_associations(learner_id);

create function public.preserve_syllabus_lesson_association_readiness()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_rank integer;
  new_rank integer;
begin
  old_rank := case old.readiness_state
    when 'saved' then 0
    when 'draft' then 1
    when 'approved' then 2
    when 'available' then 3
  end;
  new_rank := case new.readiness_state
    when 'saved' then 0
    when 'draft' then 1
    when 'approved' then 2
    when 'available' then 3
  end;

  if new_rank < old_rank then
    new.readiness_state := old.readiness_state;
  end if;
  return new;
end;
$$;

create trigger preserve_syllabus_lesson_association_readiness
  before update of readiness_state
  on public.syllabus_lesson_associations
  for each row
  execute function public.preserve_syllabus_lesson_association_readiness();

revoke all on function public.preserve_syllabus_lesson_association_readiness() from public, anon, authenticated;

alter table public.syllabus_lesson_associations enable row level security;

create policy "syllabus_lesson_associations_select_own"
  on public.syllabus_lesson_associations
  for select
  to authenticated
  using ((select auth.uid()) = facilitator_id);

revoke all on table public.syllabus_lesson_associations from public, anon, authenticated;
revoke all on sequence public.syllabus_lesson_associations_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.syllabus_lesson_associations to service_role;
grant usage, select on sequence public.syllabus_lesson_associations_id_seq to service_role;

comment on table public.syllabus_lesson_associations is
  'Operational learner-to-lesson identity only. It does not store an inferred or explicit placement date.';

comment on function public.preserve_syllabus_lesson_association_readiness() is
  'Keeps durable lesson readiness monotonic: saved < draft < approved < available.';
