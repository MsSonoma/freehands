create table if not exists public.syllabus_restart_intents (
 id uuid primary key default gen_random_uuid(),
 facilitator_id uuid not null,
 learner_id uuid not null references public.learners(id),
 lesson_key text not null,
 instructional_teacher text not null check (instructional_teacher in ('sonoma','webb','slate')),
 scheduled_date date not null,
 source_occurrence_id text not null,
 created_at timestamptz not null default now()
);
create index if not exists syllabus_restart_intents_learner_date_idx on public.syllabus_restart_intents(learner_id,scheduled_date);
alter table public.syllabus_restart_intents enable row level security;
revoke all on public.syllabus_restart_intents from public, anon, authenticated;
grant select,insert on public.syllabus_restart_intents to service_role;
