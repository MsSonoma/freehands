-- Medals persistence schema for Supabase
--
-- Usage: paste into Supabase SQL editor and run. Safe to re-run.
-- Stores best percent and medal tier per (user_id, learner_id, lesson_key).

create table if not exists public.learner_medals (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  learner_id    text not null,
  lesson_key    text not null,
  best_percent  int  not null default 0 check (best_percent between 0 and 100),
  medal_tier    text check (medal_tier in ('bronze','silver','gold')),
  updated_at    timestamptz not null default now(),
  constraint learner_medals_unique unique (user_id, learner_id, lesson_key)
);

alter table public.learner_medals enable row level security;

-- RLS: a user can read/write only their own rows
drop policy if exists "learner_medals_select_owner" on public.learner_medals;
create policy "learner_medals_select_owner"
  on public.learner_medals for select
  using (auth.uid() = user_id);

drop policy if exists "learner_medals_insert_owner" on public.learner_medals;
create policy "learner_medals_insert_owner"
  on public.learner_medals for insert
  with check (auth.uid() = user_id);

drop policy if exists "learner_medals_update_owner" on public.learner_medals;
create policy "learner_medals_update_owner"
  on public.learner_medals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Grants for the authenticated role (RLS still applies)
grant usage on schema public to authenticated;
grant select, insert, update on table public.learner_medals to authenticated;

-- If your existing table uses owner_id instead of user_id, either:
-- 1) change the app config to use owner_id, or
-- 2) create a view mapping owner_id -> user_id and mirror the above policies on the base table.
