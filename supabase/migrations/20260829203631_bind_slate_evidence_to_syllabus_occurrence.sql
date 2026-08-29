-- Preserve the server-verified Syllabus occurrence for new standalone Slate
-- evidence without inventing an occurrence for historical evidence rows.

alter table public.learning_evidence_sessions
  add column syllabus_occurrence_id text;

create function public.guard_learning_evidence_syllabus_occurrence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.syllabus_occurrence_id is distinct from old.syllabus_occurrence_id then
    raise exception 'The Syllabus occurrence recorded at evidence-session creation is immutable';
  end if;
  return new;
end;
$$;

create trigger guard_learning_evidence_syllabus_occurrence
  before update of syllabus_occurrence_id on public.learning_evidence_sessions
  for each row execute function public.guard_learning_evidence_syllabus_occurrence();

revoke all on function public.guard_learning_evidence_syllabus_occurrence()
  from public, anon, authenticated;

comment on column public.learning_evidence_sessions.syllabus_occurrence_id is
  'Server-verified Syllabus occurrence for new standalone Slate evidence. Historical NULL values remain unknown.';
