-- Append-only, facilitator-authored corrections and question feedback for completed
-- Mr. Slate tests. Never overwrite original independent assessment evidence.
create table public.slate_test_result_overrides (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.slate_liftoff_records(id) on delete cascade,
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  question_index integer not null check (question_index between 0 and 149),
  action text not null check (action in ('grade', 'question')),
  original_question text not null,
  original_status text not null check (original_status in ('correct', 'partial', 'incorrect')),
  corrected_status text check (corrected_status in ('correct', 'partial', 'incorrect')),
  feedback text not null check (char_length(btrim(feedback)) between 8 and 1500),
  proposed_question jsonb,
  source_revision_lesson_key text,
  created_at timestamptz not null default now(),
  constraint slate_result_action_payload_check check (
    (action = 'grade' and corrected_status is not null and proposed_question is null)
    or (action = 'question' and corrected_status is null)
  )
);

create index slate_test_result_overrides_record_idx
  on public.slate_test_result_overrides(record_id, created_at, id);

alter table public.slate_test_result_overrides enable row level security;
revoke all on table public.slate_test_result_overrides from public, anon, authenticated;
grant select, insert on table public.slate_test_result_overrides to service_role;

comment on table public.slate_test_result_overrides is
  'Append-only facilitator review decisions. Original independent test judgments and mastery evidence are immutable; adjusted scores are facilitator-reviewed reports only.';
