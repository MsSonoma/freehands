-- ThoughtHub one-time backfill
--
-- Migrates legacy Mr. Mentor history stored in public.mentor_conversation_threads.conversation_history
-- into ThoughtHub (public.events) as append-only events, then clears the legacy JSON once ingestion
-- is verified.
--
-- Prereqs (run first):
-- - scripts/add-cohere-style-chronograph.sql
-- - scripts/add-cohere-style-rls-and-rpcs.sql
-- - scripts/add-thought-hub-dedupe-key.sql (or equivalent dedupe_key + unique index)
--
-- Notes:
-- - Creates a tenant + owner membership for any facilitator lacking one.
-- - Creates ThoughtHub threads at sector='both' for each (facilitator_id, subject_key).
-- - Inserts events with a stable per-message timestamp order.
-- - Uses dedupe_key = legacy:<subject_key>:<index> so reruns are safe.

begin;

-- 1) Ensure every facilitator in mentor_conversation_threads has a ThoughtHub tenant + membership.
do $$
declare
  u record;
  tid uuid;
begin
  for u in (
    select distinct facilitator_id as user_id
    from public.mentor_conversation_threads
    where facilitator_id is not null
  ) loop
    select m.tenant_id into tid
    from public.tenant_memberships m
    where m.user_id = u.user_id
    order by m.created_at asc
    limit 1;

    if tid is null then
      insert into public.tenants (name)
      values ('Household')
      returning tenant_id into tid;

      insert into public.tenant_memberships (tenant_id, user_id, role)
      values (tid, u.user_id, 'owner');
    end if;
  end loop;
end $$;

-- 2) Create ThoughtHub threads (sector='both') for each mentor_conversation_threads row.
insert into public.threads (tenant_id, user_id, sector, subject_key)
select
  m.tenant_id,
  t.facilitator_id as user_id,
  'both' as sector,
  t.subject_key
from public.mentor_conversation_threads t
join lateral (
  select tenant_id
  from public.tenant_memberships tm
  where tm.user_id = t.facilitator_id
  order by tm.created_at asc
  limit 1
) m on true
where t.facilitator_id is not null
on conflict (tenant_id, user_id, sector, subject_key) do nothing;

-- 3) Insert ThoughtHub events from legacy JSON history (idempotent via dedupe_key).
with legacy as (
  select
    t.id as legacy_thread_row_id,
    t.facilitator_id as user_id,
    t.subject_key,
    t.conversation_history,
    coalesce(t.last_local_update_at, t.updated_at, t.created_at, now()) as base_ts,
    m.tenant_id
  from public.mentor_conversation_threads t
  join lateral (
    select tenant_id
    from public.tenant_memberships tm
    where tm.user_id = t.facilitator_id
    order by tm.created_at asc
    limit 1
  ) m on true
  where jsonb_typeof(t.conversation_history) = 'array'
    and jsonb_array_length(t.conversation_history) > 0
), mapped as (
  select
    l.tenant_id,
    th.thread_id,
    (l.base_ts + ((j.ord - 1) * interval '1 millisecond')) as ts,
    case
      when lower(coalesce(j.msg->>'role','')) in ('user','assistant','system') then lower(j.msg->>'role')
      when lower(coalesce(j.msg->>'role','')) = 'ai' then 'assistant'
      else 'system'
    end as role,
    coalesce(j.msg->>'content','') as text,
    ('legacy:' || l.subject_key || ':' || j.ord::text) as dedupe_key,
    jsonb_build_object(
      'source', 'mentor_conversation_threads',
      'legacy_thread_row_id', l.legacy_thread_row_id,
      'subject_key', l.subject_key,
      'legacy_index', j.ord
    ) as meta,
    l.subject_key,
    l.legacy_thread_row_id
  from legacy l
  join public.threads th
    on th.tenant_id = l.tenant_id
   and th.user_id = l.user_id
   and th.sector = 'both'
   and th.subject_key = l.subject_key
  cross join lateral jsonb_array_elements(l.conversation_history) with ordinality as j(msg, ord)
  where coalesce(j.msg->>'content','') <> ''
)
insert into public.events (tenant_id, thread_id, ts, role, text, dedupe_key, meta)
select tenant_id, thread_id, ts, role, text, dedupe_key, meta
from mapped
on conflict (tenant_id, thread_id, dedupe_key) do nothing;

-- 4) Clear legacy JSON only when we can verify all messages exist as ThoughtHub events.
with legacy as (
  select
    t.id as legacy_thread_row_id,
    t.facilitator_id as user_id,
    t.subject_key,
    jsonb_array_length(t.conversation_history) as expected_count,
    m.tenant_id,
    th.thread_id
  from public.mentor_conversation_threads t
  join lateral (
    select tenant_id
    from public.tenant_memberships tm
    where tm.user_id = t.facilitator_id
    order by tm.created_at asc
    limit 1
  ) m on true
  join public.threads th
    on th.tenant_id = m.tenant_id
   and th.user_id = t.facilitator_id
   and th.sector = 'both'
   and th.subject_key = t.subject_key
  where jsonb_typeof(t.conversation_history) = 'array'
    and jsonb_array_length(t.conversation_history) > 0
), counts as (
  select
    l.legacy_thread_row_id,
    l.expected_count,
    count(e.*) as actual_count
  from legacy l
  left join public.events e
    on e.tenant_id = l.tenant_id
   and e.thread_id = l.thread_id
   and e.dedupe_key like ('legacy:' || l.subject_key || ':%')
  group by l.legacy_thread_row_id, l.expected_count
)
update public.mentor_conversation_threads t
set
  conversation_history = '[]'::jsonb,
  updated_at = now()
from counts c
where t.id = c.legacy_thread_row_id
  and c.actual_count >= c.expected_count;

commit;
