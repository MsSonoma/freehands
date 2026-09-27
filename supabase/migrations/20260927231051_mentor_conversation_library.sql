-- Canonical Ms. Sonoma conversation library.
-- Execution ownership remains in mentor_sessions. Conversation identity/history is independent.

create table if not exists public.mentor_conversations (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete set null,
  context_key text not null default 'facilitator',
  thread_key text not null,
  title text not null default 'New conversation',
  conversation_history jsonb not null default '[]'::jsonb,
  draft_summary text,
  token_count integer not null default 0,
  last_local_update_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_conversations_title_length check (char_length(title) between 1 and 120),
  constraint mentor_conversations_unique_thread unique (facilitator_id, thread_key)
);

create index if not exists mentor_conversations_facilitator_activity_idx
  on public.mentor_conversations (facilitator_id, last_activity_at desc);
create index if not exists mentor_conversations_learner_idx
  on public.mentor_conversations (learner_id)
  where learner_id is not null;

alter table public.mentor_conversations enable row level security;

drop policy if exists "Users can read their own mentor conversations" on public.mentor_conversations;
create policy "Users can read their own mentor conversations"
  on public.mentor_conversations
  for select
  to authenticated
  using ((select auth.uid()) = facilitator_id);

drop policy if exists "Users can create their own mentor conversations" on public.mentor_conversations;
create policy "Users can create their own mentor conversations"
  on public.mentor_conversations
  for insert
  to authenticated
  with check ((select auth.uid()) = facilitator_id);

drop policy if exists "Users can update their own mentor conversations" on public.mentor_conversations;
create policy "Users can update their own mentor conversations"
  on public.mentor_conversations
  for update
  to authenticated
  using ((select auth.uid()) = facilitator_id)
  with check ((select auth.uid()) = facilitator_id);

drop policy if exists "Users can delete their own mentor conversations" on public.mentor_conversations;
create policy "Users can delete their own mentor conversations"
  on public.mentor_conversations
  for delete
  to authenticated
  using ((select auth.uid()) = facilitator_id);

-- Preserve the currently durable conversation as the first library item.
insert into public.mentor_conversations (
  id,
  facilitator_id,
  learner_id,
  context_key,
  thread_key,
  title,
  conversation_history,
  draft_summary,
  token_count,
  last_local_update_at,
  last_activity_at,
  created_at,
  updated_at
)
select
  legacy.id,
  legacy.facilitator_id,
  learner.id,
  legacy.subject_key,
  legacy.subject_key,
  case
    when learner.name is not null and btrim(learner.name) <> '' then left(btrim(learner.name) || ' conversation', 120)
    else 'General conversation'
  end,
  coalesce(legacy.conversation_history, '[]'::jsonb),
  legacy.draft_summary,
  coalesce(legacy.token_count, 0),
  legacy.last_local_update_at,
  legacy.last_activity_at,
  legacy.created_at,
  legacy.updated_at
from public.mentor_conversation_threads legacy
left join public.learners learner
  on legacy.subject_key like 'learner:%'
 and learner.id::text = substring(legacy.subject_key from 9)
where not exists (
  select 1
  from public.mentor_conversations existing
  where existing.id = legacy.id
     or (existing.facilitator_id = legacy.facilitator_id and existing.thread_key = legacy.subject_key)
);

create or replace function public.write_mentor_conversation_owned_transactional(
  p_facilitator_id uuid,
  p_session_id text,
  p_device_id text,
  p_conversation_id uuid,
  p_conversation_history jsonb,
  p_draft_summary text,
  p_token_count integer,
  p_last_local_update_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.mentor_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select *
    into v_session
    from public.mentor_sessions
   where facilitator_id = p_facilitator_id
     and session_id = p_session_id
   order by created_at desc, id desc
   limit 1
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'missing');
  end if;

  if not v_session.is_active then
    return jsonb_build_object('ok', false, 'state', 'ended', 'endedReason', v_session.ended_reason);
  end if;

  if coalesce(v_session.device_id, '') <> coalesce(p_device_id, '') then
    return jsonb_build_object('ok', false, 'state', 'ownership_lost', 'endedReason', v_session.ended_reason);
  end if;

  update public.mentor_conversations
     set conversation_history = coalesce(p_conversation_history, '[]'::jsonb),
         draft_summary = coalesce(p_draft_summary, ''),
         token_count = greatest(0, coalesce(p_token_count, 0)),
         last_local_update_at = coalesce(p_last_local_update_at, v_now),
         last_activity_at = v_now,
         updated_at = v_now
   where id = p_conversation_id
     and facilitator_id = p_facilitator_id;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'missing_conversation');
  end if;

  update public.mentor_sessions
     set last_activity_at = v_now
   where id = v_session.id;

  return jsonb_build_object('ok', true, 'state', 'written', 'last_activity_at', v_now);
end;
$$;

revoke all on function public.write_mentor_conversation_owned_transactional(
  uuid, text, text, uuid, jsonb, text, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.write_mentor_conversation_owned_transactional(
  uuid, text, text, uuid, jsonb, text, integer, timestamptz
) to service_role;

comment on table public.mentor_conversations is
  'Canonical named Ms. Sonoma conversations. Execution ownership remains separate in mentor_sessions.';
comment on column public.mentor_conversations.context_key is
  'Learner/facilitator context captured for this conversation, for example learner:<uuid> or facilitator.';
comment on column public.mentor_conversations.thread_key is
  'ThoughtHub/Cohere thread scope. Existing conversations retain their prior subject key; new conversations use conversation:<uuid>.';
