-- Ms. Sonoma Help memory.
-- Named conversations remain the resumable conversation record.
-- ThoughtHub supplies account-isolated cross-conversation retrieval.
-- Current Syllabus, Curriculum Guidance, and canonical learning evidence remain authoritative.

drop policy if exists threads_all on public.threads;
create policy threads_all
on public.threads
for all
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = threads.tenant_id
      and m.user_id = (select auth.uid())
  )
  and (
    sector <> 'adult'
    or exists (
      select 1
      from public.adult_sessions s
      where s.tenant_id = threads.tenant_id
        and s.user_id = (select auth.uid())
        and s.unlocked_until > now()
    )
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = threads.tenant_id
      and m.user_id = (select auth.uid())
  )
  and (
    sector <> 'adult'
    or exists (
      select 1
      from public.adult_sessions s
      where s.tenant_id = threads.tenant_id
        and s.user_id = (select auth.uid())
        and s.unlocked_until > now()
    )
  )
);

drop policy if exists events_all on public.events;
create policy events_all
on public.events
for all
to authenticated
using (
  exists (
    select 1
    from public.threads t
    where t.thread_id = events.thread_id
      and t.tenant_id = events.tenant_id
      and t.user_id = (select auth.uid())
      and (
        t.sector <> 'adult'
        or exists (
          select 1
          from public.adult_sessions s
          where s.tenant_id = t.tenant_id
            and s.user_id = (select auth.uid())
            and s.unlocked_until > now()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.threads t
    where t.thread_id = events.thread_id
      and t.tenant_id = events.tenant_id
      and t.user_id = (select auth.uid())
      and (
        t.sector <> 'adult'
        or exists (
          select 1
          from public.adult_sessions s
          where s.tenant_id = t.tenant_id
            and s.user_id = (select auth.uid())
            and s.unlocked_until > now()
        )
      )
  )
);

drop policy if exists thread_summary_versions_all on public.thread_summary_versions;
create policy thread_summary_versions_all
on public.thread_summary_versions
for all
to authenticated
using (
  exists (
    select 1
    from public.threads t
    where t.thread_id = thread_summary_versions.thread_id
      and t.tenant_id = thread_summary_versions.tenant_id
      and t.user_id = (select auth.uid())
      and (
        t.sector <> 'adult'
        or exists (
          select 1
          from public.adult_sessions s
          where s.tenant_id = t.tenant_id
            and s.user_id = (select auth.uid())
            and s.unlocked_until > now()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.threads t
    where t.thread_id = thread_summary_versions.thread_id
      and t.tenant_id = thread_summary_versions.tenant_id
      and t.user_id = (select auth.uid())
      and (
        t.sector <> 'adult'
        or exists (
          select 1
          from public.adult_sessions s
          where s.tenant_id = t.tenant_id
            and s.user_id = (select auth.uid())
            and s.unlocked_until > now()
        )
      )
  )
);

drop policy if exists user_goal_versions_all on public.user_goal_versions;
create policy user_goal_versions_all
on public.user_goal_versions
for all
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = user_goal_versions.tenant_id
      and m.user_id = (select auth.uid())
  )
  and (
    sector <> 'adult'
    or exists (
      select 1
      from public.adult_sessions s
      where s.tenant_id = user_goal_versions.tenant_id
        and s.user_id = (select auth.uid())
        and s.unlocked_until > now()
    )
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = user_goal_versions.tenant_id
      and m.user_id = (select auth.uid())
  )
  and (
    sector <> 'adult'
    or exists (
      select 1
      from public.adult_sessions s
      where s.tenant_id = user_goal_versions.tenant_id
        and s.user_id = (select auth.uid())
        and s.unlocked_until > now()
    )
  )
);

-- These tables are never intended for unauthenticated browser access.
revoke all on table public.threads from anon;
revoke all on table public.events from anon;
revoke all on table public.thread_summary_versions from anon;
revoke all on table public.user_goal_versions from anon;
revoke all on table public.mentor_conversations from anon;
revoke all on table public.conversation_updates from anon;
revoke all on table public.conversation_drafts from anon;
revoke all on table public.conversation_history_archive from anon;

-- Keep authenticated access explicit; RLS still controls rows.
grant select, insert, update, delete on table public.threads to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.thread_summary_versions to authenticated;
grant select, insert, update, delete on table public.user_goal_versions to authenticated;
grant select, insert, update, delete on table public.mentor_conversations to authenticated;
grant select, insert, update, delete on table public.conversation_updates to authenticated;
grant select, insert, update, delete on table public.conversation_drafts to authenticated;
grant select, insert, update, delete on table public.conversation_history_archive to authenticated;

-- Existing named conversations get a ThoughtHub thread if one does not exist.
insert into public.threads (tenant_id, user_id, sector, subject_key)
select
  membership.tenant_id,
  c.facilitator_id,
  'both',
  c.thread_key
from public.mentor_conversations c
join lateral (
  select m.tenant_id
  from public.tenant_memberships m
  where m.user_id = c.facilitator_id
  order by m.created_at asc
  limit 1
) membership on true
where nullif(btrim(c.thread_key), '') is not null
on conflict (tenant_id, user_id, sector, subject_key) do nothing;

-- Backfill the resumable named-conversation mirror into ThoughtHub only when that exact
-- role/text pair is not already present in the same thread.
insert into public.events (
  tenant_id,
  thread_id,
  role,
  text,
  dedupe_key,
  meta
)
select
  t.tenant_id,
  t.thread_id,
  case
    when msg.value->>'role' = 'assistant' then 'assistant'
    when msg.value->>'role' = 'system' then 'system'
    else 'user'
  end,
  msg.value->>'content',
  'mentor-conversation-backfill:' || c.id::text || ':' || msg.ordinality::text,
  jsonb_build_object(
    'source', 'mentor_conversations',
    'memory_kind', 'verbatim_conversation',
    'conversation_id', c.id,
    'conversation_title', c.title,
    'learner_id', c.learner_id,
    'context_key', c.context_key,
    'legacy_index', msg.ordinality - 1
  )
from public.mentor_conversations c
join public.threads t
  on t.user_id = c.facilitator_id
 and t.subject_key = c.thread_key
 and t.sector = 'both'
cross join lateral jsonb_array_elements(coalesce(c.conversation_history, '[]'::jsonb))
  with ordinality as msg(value, ordinality)
where nullif(btrim(msg.value->>'content'), '') is not null
  and coalesce(msg.value->>'role', 'user') in ('user', 'assistant', 'system')
  and not exists (
    select 1
    from public.events existing
    where existing.tenant_id = t.tenant_id
      and existing.thread_id = t.thread_id
  )
on conflict (tenant_id, thread_id, dedupe_key) do nothing;

-- Preserve useful old rolling summaries as derived memory. They are explicitly labeled
-- and never outrank current educational records.
insert into public.threads (tenant_id, user_id, sector, subject_key)
select
  membership.tenant_id,
  u.facilitator_id,
  'both',
  case
    when u.learner_id is null then 'facilitator'
    else 'learner:' || u.learner_id::text
  end
from public.conversation_updates u
join lateral (
  select m.tenant_id
  from public.tenant_memberships m
  where m.user_id = u.facilitator_id
  order by m.created_at asc
  limit 1
) membership on true
on conflict (tenant_id, user_id, sector, subject_key) do nothing;

insert into public.events (
  tenant_id,
  thread_id,
  role,
  text,
  dedupe_key,
  meta
)
select
  t.tenant_id,
  t.thread_id,
  'system',
  u.summary,
  'legacy-conversation-update:' || u.id::text,
  jsonb_build_object(
    'source', 'legacy_conversation_update',
    'memory_kind', 'derived_summary',
    'learner_id', u.learner_id,
    'turn_count', u.turn_count,
    'updated_at', u.updated_at
  )
from public.conversation_updates u
join lateral (
  select m.tenant_id
  from public.tenant_memberships m
  where m.user_id = u.facilitator_id
  order by m.created_at asc
  limit 1
) membership on true
join public.threads t
  on t.tenant_id = membership.tenant_id
 and t.user_id = u.facilitator_id
 and t.sector = 'both'
 and t.subject_key = case
   when u.learner_id is null then 'facilitator'
   else 'learner:' || u.learner_id::text
 end
where nullif(btrim(u.summary), '') is not null
on conflict (tenant_id, thread_id, dedupe_key) do nothing;

-- The legacy archive used permanent copies. Stop creating new ones.
drop trigger if exists trigger_archive_conversation_before_delete
  on public.conversation_updates;
drop trigger if exists trigger_archive_long_conversation
  on public.conversation_updates;

revoke execute on function public.archive_conversation_update()
  from public, anon, authenticated;
revoke execute on function public.maybe_archive_long_conversation()
  from public, anon, authenticated;

drop policy if exists "Facilitators can delete their own conversation archive"
  on public.conversation_history_archive;
create policy "Facilitators can delete their own conversation archive"
on public.conversation_history_archive
for delete
to authenticated
using ((select auth.uid()) = facilitator_id);

comment on table public.conversation_history_archive is
  'Legacy archive. Automatic permanent archiving is disabled. ThoughtHub events and named mentor conversations are the active Help memory system.';

create or replace function public.rpc_pack(
  p_tenant_id uuid,
  p_thread_id uuid,
  p_sector text,
  p_question text,
  p_mode text default 'standard'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recent_n int;
  recall_k int;
  q tsquery;
  latest_goals jsonb;
  latest_summary jsonb;
  recent_events jsonb;
  recall_snippets jsonb;
  v_uid uuid := auth.uid();
  v_subject_key text;
  v_active_learner_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select t.subject_key
  into v_subject_key
  from public.threads t
  where t.tenant_id = p_tenant_id
    and t.thread_id = p_thread_id
    and t.user_id = v_uid
  limit 1;

  if v_subject_key is null then
    raise exception 'thread_not_owned';
  end if;

  select c.learner_id
  into v_active_learner_id
  from public.mentor_conversations c
  where c.facilitator_id = v_uid
    and c.thread_key = v_subject_key
  order by c.updated_at desc, c.id desc
  limit 1;

  if v_active_learner_id is null
     and v_subject_key ~ '^learner:[0-9a-fA-F-]{36}$' then
    begin
      v_active_learner_id := substring(v_subject_key from 9)::uuid;
    exception
      when invalid_text_representation then
        v_active_learner_id := null;
    end;
  end if;

  if p_mode = 'minimal' then
    recent_n := 12;
    recall_k := 4;
  elsif p_mode = 'deep' then
    recent_n := 30;
    recall_k := 12;
  else
    recent_n := 20;
    recall_k := 8;
  end if;

  select ug.goals_json
  into latest_goals
  from public.user_goal_versions ug
  where ug.tenant_id = p_tenant_id
    and ug.user_id = v_uid
    and (ug.sector = 'both' or ug.sector = p_sector)
  order by ug.ts desc, ug.goal_version_id desc
  limit 1;

  select jsonb_build_object(
    'title', s.title,
    'summary', s.summary,
    'ts', s.ts
  )
  into latest_summary
  from public.thread_summary_versions s
  where s.tenant_id = p_tenant_id
    and s.thread_id = p_thread_id
  order by s.ts desc, s.summary_version_id desc
  limit 1;

  with recent as (
    select e.event_id, e.ts, e.role, e.text
    from public.events e
    where e.tenant_id = p_tenant_id
      and e.thread_id = p_thread_id
    order by e.ts desc, e.event_id desc
    limit recent_n
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'event_id', event_id,
        'ts', ts,
        'role', role,
        'text', text
      )
      order by ts asc, event_id asc
    ),
    '[]'::jsonb
  )
  into recent_events
  from recent;

  if nullif(btrim(coalesce(p_question, '')), '') is null then
    recall_snippets := '[]'::jsonb;
  else
    q := websearch_to_tsquery('english', p_question);

    with recent_ids as (
      select e.event_id
      from public.events e
      where e.tenant_id = p_tenant_id
        and e.thread_id = p_thread_id
      order by e.ts desc, e.event_id desc
      limit recent_n
    ),
    eligible as (
      select
        e.event_id,
        e.ts,
        e.role,
        e.text,
        e.meta,
        t.thread_id,
        t.subject_key,
        c.id as conversation_id,
        c.title as conversation_title,
        c.learner_id,
        case
          when t.thread_id = p_thread_id then 'current_conversation'
          when v_active_learner_id is not null
               and (
                 c.learner_id = v_active_learner_id
                 or t.subject_key = 'learner:' || v_active_learner_id::text
               )
            then 'same_learner'
          else 'facilitator'
        end as memory_scope,
        ts_rank_cd(e.tsv, q)
          + case
              when t.thread_id = p_thread_id then 0.30
              when v_active_learner_id is not null
                   and (
                     c.learner_id = v_active_learner_id
                     or t.subject_key = 'learner:' || v_active_learner_id::text
                   )
                then 0.20
              else 0.10
            end as score
      from public.events e
      join public.threads t
        on t.thread_id = e.thread_id
       and t.tenant_id = e.tenant_id
      left join public.mentor_conversations c
        on c.facilitator_id = v_uid
       and c.thread_key = t.subject_key
      where e.tenant_id = p_tenant_id
        and t.user_id = v_uid
        and (t.sector = 'both' or t.sector = p_sector)
        and e.tsv @@ q
        and not exists (
          select 1
          from recent_ids r
          where r.event_id = e.event_id
        )
        and (
          t.thread_id = p_thread_id
          or (
            v_active_learner_id is not null
            and (
              c.learner_id = v_active_learner_id
              or t.subject_key = 'learner:' || v_active_learner_id::text
            )
          )
          or t.subject_key = 'facilitator'
          or (c.id is not null and c.learner_id is null)
        )
    ),
    ranked as (
      select *
      from eligible
      order by score desc, ts desc, event_id desc
      limit recall_k
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'event_id', event_id,
          'ts', ts,
          'role', role,
          'text', text,
          'meta', meta,
          'score', score,
          'thread_id', thread_id,
          'subject_key', subject_key,
          'conversation_id', conversation_id,
          'conversation_title', conversation_title,
          'learner_id', learner_id,
          'memory_scope', memory_scope
        )
        order by score desc, ts desc, event_id desc
      ),
      '[]'::jsonb
    )
    into recall_snippets
    from ranked;
  end if;

  return jsonb_build_object(
    'thread_summary', latest_summary,
    'user_goals', latest_goals,
    'recent_events', recent_events,
    'recall_snippets', recall_snippets,
    'memory_scope', jsonb_build_object(
      'owner_user_id', v_uid,
      'active_subject_key', v_subject_key,
      'active_learner_id', v_active_learner_id,
      'cross_conversation_recall', true
    ),
    'limits', jsonb_build_object(
      'mode', p_mode,
      'recent_n', recent_n,
      'recall_k', recall_k
    )
  );
end;
$$;

revoke all on function public.rpc_pack(uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.rpc_pack(uuid, uuid, text, text, text)
  to authenticated;

comment on function public.rpc_pack(uuid, uuid, text, text, text) is
  'Builds Ms. Sonoma Help context from the current conversation plus owner-isolated relevant prior conversations. Current educational records remain authoritative over remembered conversation content.';