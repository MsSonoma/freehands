create table if not exists public.webb_compositions (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  syllabus_occurrence_id text not null,
  execution_session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  browser_session_id uuid,
  status text not null default 'draft' check (status in ('draft', 'final')),
  protocol_version text not null,
  app_build_id text,
  composition_plan jsonb not null default '{}'::jsonb,
  research_notes jsonb not null default '[]'::jsonb,
  accepted_sentences jsonb not null default '{}'::jsonb,
  essay text,
  started_at timestamptz not null default now(),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (execution_session_id)
);

create index if not exists webb_compositions_facilitator_learner_idx
  on public.webb_compositions(facilitator_id, learner_id, updated_at desc);

create index if not exists webb_compositions_occurrence_idx
  on public.webb_compositions(learner_id, syllabus_occurrence_id, updated_at desc);

alter table public.webb_compositions enable row level security;

drop policy if exists webb_compositions_select_own on public.webb_compositions;
create policy webb_compositions_select_own
  on public.webb_compositions
  for select
  using (auth.uid() = facilitator_id);

comment on table public.webb_compositions is
  'Durable learner-authored Mrs. Webb compositions. Mastery evidence remains in learning_evidence_*; this table preserves the separate written artifact and its composition provenance.';

comment on column public.webb_compositions.accepted_sentences is
  'Ordered learner-authored accepted sentence records keyed by composition slot index, including source message provenance.';

comment on column public.webb_compositions.composition_plan is
  'Internal Mrs. Webb writing plan that is separate from mastery objectives. Topic and conclusion slots are composition structure, not mastery targets.';

create or replace function public.preserve_final_webb_composition()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'final' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists webb_compositions_preserve_final on public.webb_compositions;
create trigger webb_compositions_preserve_final
before update on public.webb_compositions
for each row execute function public.preserve_final_webb_composition();

comment on function public.preserve_final_webb_composition() is
  'Makes a finalized learner composition immutable so a slower in-flight draft save cannot overwrite the final essay.';
