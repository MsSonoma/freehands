-- Cohere-style RLS + RPC functions for chronograph/packs.
-- Run after scripts/add-cohere-style-chronograph.sql

-- 1) Helper functions
create or replace function public.rpc_get_or_create_my_tenant()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_tenant uuid;
  new_tenant uuid;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select m.tenant_id into existing_tenant
  from public.tenant_memberships m
  where m.user_id = uid
  order by m.created_at asc
  limit 1;

  if existing_tenant is not null then
    return existing_tenant;
  end if;

  insert into public.tenants (name)
  values ('Household')
  returning tenant_id into new_tenant;

  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (new_tenant, uid, 'owner');

  return new_tenant;
end;
$$;

revoke all on function public.rpc_get_or_create_my_tenant() from public;
grant execute on function public.rpc_get_or_create_my_tenant() to authenticated;

create or replace function public.rpc_get_or_create_thread(
  p_tenant_id uuid,
  p_sector text,
  p_subject_key text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  tid uuid;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Will be constrained by RLS on threads/tenant_memberships.
  select thread_id into tid
  from public.threads t
  where t.tenant_id = p_tenant_id
    and t.user_id = uid
    and t.sector = p_sector
    and t.subject_key = p_subject_key
  limit 1;

  if tid is not null then
    return tid;
  end if;

  insert into public.threads (tenant_id, user_id, sector, subject_key)
  values (p_tenant_id, uid, p_sector, p_subject_key)
  returning thread_id into tid;

  return tid;
end;
$$;

revoke all on function public.rpc_get_or_create_thread(uuid,text,text) from public;
grant execute on function public.rpc_get_or_create_thread(uuid,text,text) to authenticated;

create or replace function public.rpc_append_event(
  p_tenant_id uuid,
  p_thread_id uuid,
  p_role text,
  p_text text,
  p_meta jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  eid uuid;
begin
  insert into public.events (tenant_id, thread_id, role, text, meta)
  values (p_tenant_id, p_thread_id, p_role, p_text, coalesce(p_meta,'{}'::jsonb))
  returning event_id into eid;
  return eid;
end;
$$;

revoke all on function public.rpc_append_event(uuid,uuid,text,text,jsonb) from public;
grant execute on function public.rpc_append_event(uuid,uuid,text,text,jsonb) to authenticated;

-- 2) Gate suggest (deterministic ranking + tie-breakers)
create or replace function public.rpc_gate_suggest(
  p_tenant_id uuid,
  p_sector text,
  p_question text,
  p_top_k int default 5
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  q tsquery;
  out_json jsonb;
begin
  q := websearch_to_tsquery('english', coalesce(p_question,''));

  with ranked as (
    select
      i.intent_id,
      i.label,
      i.answer_text,
      i.robot_text,
      ts_rank_cd(i.tsv, q) as score,
      i.updated_at
    from public.gate_intents i
    where i.tenant_id = p_tenant_id
      and (i.sector = 'both' or i.sector = p_sector)
      and i.tsv @@ q
    order by score desc, i.updated_at desc, i.intent_id asc
    limit greatest(1, least(p_top_k, 20))
  )
  select jsonb_build_object(
    'candidates', coalesce(jsonb_agg(jsonb_build_object(
      'intent_id', intent_id,
      'label', label,
      'score', score,
      'robot_text', robot_text,
      'answer_text', answer_text
    ) order by score desc, updated_at desc, intent_id asc), '[]'::jsonb)
  ) into out_json
  from ranked;

  return out_json;
end;
$$;

revoke all on function public.rpc_gate_suggest(uuid,text,text,int) from public;
grant execute on function public.rpc_gate_suggest(uuid,text,text,int) to authenticated;

-- 3) Pack builder (deterministic caps)
create or replace function public.rpc_pack(
  p_tenant_id uuid,
  p_thread_id uuid,
  p_sector text,
  p_question text,
  p_mode text default 'standard'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  recent_n int;
  recall_k int;
  out_json jsonb;
  q tsquery;
  latest_goals jsonb;
  latest_summary jsonb;
  recent_events jsonb;
  recall_snippets jsonb;
begin
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

  -- Latest goals (may be null)
  select ug.goals_json into latest_goals
  from public.user_goal_versions ug
  where ug.tenant_id = p_tenant_id
    and ug.user_id = auth.uid()
    and (ug.sector = 'both' or ug.sector = p_sector)
  order by ug.ts desc, ug.goal_version_id desc
  limit 1;

  -- Latest summary (may be null)
  select jsonb_build_object('title', s.title, 'summary', s.summary, 'ts', s.ts) into latest_summary
  from public.thread_summary_versions s
  where s.tenant_id = p_tenant_id
    and s.thread_id = p_thread_id
  order by s.ts desc, s.summary_version_id desc
  limit 1;

  -- Recent events, verbatim, deterministic order
  with recent as (
    select e.event_id, e.ts, e.role, e.text
    from public.events e
    where e.tenant_id = p_tenant_id
      and e.thread_id = p_thread_id
    order by e.ts desc, e.event_id desc
    limit recent_n
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event_id,
    'ts', ts,
    'role', role,
    'text', text
  ) order by ts asc, event_id asc), '[]'::jsonb)
  into recent_events
  from recent;

  -- Recall snippets (older), only if question yields FTS hits.
  q := websearch_to_tsquery('english', coalesce(p_question,''));

  with hits as (
    select e.event_id, e.ts, e.role, e.text,
      ts_rank_cd(e.tsv, q) as score
    from public.events e
    where e.tenant_id = p_tenant_id
      and e.thread_id = p_thread_id
      and e.tsv @@ q
    order by score desc, e.ts desc, e.event_id desc
    limit recall_k
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event_id,
    'ts', ts,
    'role', role,
    'text', text,
    'score', score
  ) order by score desc, ts desc, event_id desc), '[]'::jsonb)
  into recall_snippets
  from hits;

  out_json := jsonb_build_object(
    'thread_summary', latest_summary,
    'user_goals', latest_goals,
    'recent_events', recent_events,
    'recall_snippets', recall_snippets,
    'limits', jsonb_build_object(
      'mode', p_mode,
      'recent_n', recent_n,
      'recall_k', recall_k
    )
  );

  return out_json;
end;
$$;

revoke all on function public.rpc_pack(uuid,uuid,text,text,text) from public;
grant execute on function public.rpc_pack(uuid,uuid,text,text,text) to authenticated;

create or replace function public.rpc_pack_more(
  p_tenant_id uuid,
  p_thread_id uuid,
  p_sector text,
  p_query text,
  p_top_k int default 10
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  q tsquery;
  out_json jsonb;
begin
  q := websearch_to_tsquery('english', coalesce(p_query,''));

  with hits as (
    select e.event_id, e.ts, e.role, e.text,
      ts_rank_cd(e.tsv, q) as score
    from public.events e
    where e.tenant_id = p_tenant_id
      and e.thread_id = p_thread_id
      and e.tsv @@ q
    order by score desc, e.ts desc, e.event_id desc
    limit greatest(1, least(p_top_k, 50))
  )
  select jsonb_build_object(
    'recall_snippets', coalesce(jsonb_agg(jsonb_build_object(
      'event_id', event_id,
      'ts', ts,
      'role', role,
      'text', text,
      'score', score
    ) order by score desc, ts desc, event_id desc), '[]'::jsonb)
  ) into out_json
  from hits;

  return out_json;
end;
$$;

revoke all on function public.rpc_pack_more(uuid,uuid,text,text,int) from public;
grant execute on function public.rpc_pack_more(uuid,uuid,text,text,int) to authenticated;

create or replace function public.rpc_archive_search(
  p_tenant_id uuid,
  p_sector text,
  p_query text,
  p_limit int default 10
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  q tsquery;
  out_json jsonb;
begin
  q := websearch_to_tsquery('english', coalesce(p_query,''));

  with ranked as (
    select
      s.thread_id,
      s.title,
      s.summary,
      ts_rank_cd(s.tsv, q) as score,
      s.ts
    from public.thread_summary_versions s
    join public.threads t on t.thread_id = s.thread_id
    where s.tenant_id = p_tenant_id
      and t.tenant_id = p_tenant_id
      and (t.sector = 'both' or t.sector = p_sector)
      and s.tsv @@ q
    order by score desc, s.ts desc, s.summary_version_id desc
    limit greatest(1, least(p_limit, 50))
  )
  select jsonb_build_object(
    'results', coalesce(jsonb_agg(jsonb_build_object(
      'thread_id', thread_id,
      'title', title,
      'summary', summary,
      'score', score,
      'ts', ts
    ) order by score desc, ts desc), '[]'::jsonb)
  ) into out_json
  from ranked;

  return out_json;
end;
$$;

revoke all on function public.rpc_archive_search(uuid,text,text,int) from public;
grant execute on function public.rpc_archive_search(uuid,text,text,int) to authenticated;

-- 4) RLS policies
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.adult_sessions enable row level security;
alter table public.threads enable row level security;
alter table public.events enable row level security;
alter table public.user_goal_versions enable row level security;
alter table public.thread_summary_versions enable row level security;
alter table public.gate_intents enable row level security;

-- Tenants: members can select their tenant
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
for select
using (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenants.tenant_id
      and m.user_id = auth.uid()
  )
);

-- Memberships: user can see their own membership rows
drop policy if exists tenant_memberships_select on public.tenant_memberships;
create policy tenant_memberships_select on public.tenant_memberships
for select
using (user_id = auth.uid());

-- Adult sessions: user can manage their own unlock rows
drop policy if exists adult_sessions_manage on public.adult_sessions;
create policy adult_sessions_manage on public.adult_sessions
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Threads: must be member, and if adult sector then require unlock
drop policy if exists threads_all on public.threads;
create policy threads_all on public.threads
for all
using (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = threads.tenant_id
      and m.user_id = auth.uid()
  )
  and (
    threads.sector <> 'adult'
    or exists (
      select 1 from public.adult_sessions s
      where s.tenant_id = threads.tenant_id
        and s.user_id = auth.uid()
        and s.unlocked_until > now()
    )
  )
)
with check (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = threads.tenant_id
      and m.user_id = auth.uid()
  )
  and (
    threads.sector <> 'adult'
    or exists (
      select 1 from public.adult_sessions s
      where s.tenant_id = threads.tenant_id
        and s.user_id = auth.uid()
        and s.unlocked_until > now()
    )
  )
);

-- Events: gate via parent thread sector + membership
drop policy if exists events_all on public.events;
create policy events_all on public.events
for all
using (
  exists (
    select 1
    from public.threads t
    where t.thread_id = events.thread_id
      and t.tenant_id = events.tenant_id
      and exists (
        select 1 from public.tenant_memberships m
        where m.tenant_id = t.tenant_id
          and m.user_id = auth.uid()
      )
      and (
        t.sector <> 'adult'
        or exists (
          select 1 from public.adult_sessions s
          where s.tenant_id = t.tenant_id
            and s.user_id = auth.uid()
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
      and exists (
        select 1 from public.tenant_memberships m
        where m.tenant_id = t.tenant_id
          and m.user_id = auth.uid()
      )
      and (
        t.sector <> 'adult'
        or exists (
          select 1 from public.adult_sessions s
          where s.tenant_id = t.tenant_id
            and s.user_id = auth.uid()
            and s.unlocked_until > now()
        )
      )
  )
);

-- Goal versions: member only; adult requires unlock
drop policy if exists user_goal_versions_all on public.user_goal_versions;
create policy user_goal_versions_all on public.user_goal_versions
for all
using (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = user_goal_versions.tenant_id
      and m.user_id = auth.uid()
  )
  and (
    user_goal_versions.sector <> 'adult'
    or exists (
      select 1 from public.adult_sessions s
      where s.tenant_id = user_goal_versions.tenant_id
        and s.user_id = auth.uid()
        and s.unlocked_until > now()
    )
  )
)
with check (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = user_goal_versions.tenant_id
      and m.user_id = auth.uid()
  )
  and (
    user_goal_versions.sector <> 'adult'
    or exists (
      select 1 from public.adult_sessions s
      where s.tenant_id = user_goal_versions.tenant_id
        and s.user_id = auth.uid()
        and s.unlocked_until > now()
    )
  )
);

-- Summary versions: gate via thread + membership
drop policy if exists thread_summary_versions_all on public.thread_summary_versions;
create policy thread_summary_versions_all on public.thread_summary_versions
for all
using (
  exists (
    select 1
    from public.threads t
    where t.thread_id = thread_summary_versions.thread_id
      and t.tenant_id = thread_summary_versions.tenant_id
      and exists (
        select 1 from public.tenant_memberships m
        where m.tenant_id = t.tenant_id
          and m.user_id = auth.uid()
      )
      and (
        t.sector <> 'adult'
        or exists (
          select 1 from public.adult_sessions s
          where s.tenant_id = t.tenant_id
            and s.user_id = auth.uid()
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
      and exists (
        select 1 from public.tenant_memberships m
        where m.tenant_id = t.tenant_id
          and m.user_id = auth.uid()
      )
      and (
        t.sector <> 'adult'
        or exists (
          select 1 from public.adult_sessions s
          where s.tenant_id = t.tenant_id
            and s.user_id = auth.uid()
            and s.unlocked_until > now()
        )
      )
  )
);

-- Gate intents: member only; adult requires unlock
drop policy if exists gate_intents_all on public.gate_intents;
create policy gate_intents_all on public.gate_intents
for all
using (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = gate_intents.tenant_id
      and m.user_id = auth.uid()
  )
  and (
    gate_intents.sector <> 'adult'
    or exists (
      select 1 from public.adult_sessions s
      where s.tenant_id = gate_intents.tenant_id
        and s.user_id = auth.uid()
        and s.unlocked_until > now()
    )
  )
)
with check (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = gate_intents.tenant_id
      and m.user_id = auth.uid()
  )
  and (
    gate_intents.sector <> 'adult'
    or exists (
      select 1 from public.adult_sessions s
      where s.tenant_id = gate_intents.tenant_id
        and s.user_id = auth.uid()
        and s.unlocked_until > now()
    )
  )
);

-- Grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.tenants to authenticated;
grant select, insert, update, delete on table public.tenant_memberships to authenticated;
grant select, insert, update, delete on table public.adult_sessions to authenticated;
grant select, insert, update, delete on table public.threads to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.user_goal_versions to authenticated;
grant select, insert, update, delete on table public.thread_summary_versions to authenticated;
grant select, insert, update, delete on table public.gate_intents to authenticated;
