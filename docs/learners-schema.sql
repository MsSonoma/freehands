
-- Ensure UUID generator is available for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  -- Ownership columns (preferred first): facilitator_id -> owner_id -> user_id
  user_id uuid references auth.users(id) on delete cascade,
  -- Basic learner info
  name text not null,
  grade text, -- 'K'..'12' as text for simplicity
  -- Two schema variants supported by app code:
  -- 1) Flat numeric columns
  comprehension int,
  exercise int,
  worksheet int,
  test int,
  -- 2) JSONB targets column containing { comprehension, exercise, worksheet, test }
  targets jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes
-- Index on created_at is safe to add directly
create index if not exists idx_learners_created_at on public.learners(created_at desc);

-- Ensure core variable columns exist on existing tables (idempotent)
alter table public.learners add column if not exists name text;
alter table public.learners add column if not exists grade text;
alter table public.learners add column if not exists comprehension int;
alter table public.learners add column if not exists exercise int;
alter table public.learners add column if not exists worksheet int;
alter table public.learners add column if not exists test int;
alter table public.learners add column if not exists targets jsonb;
alter table public.learners add column if not exists approved_lessons jsonb;
alter table public.learners add column if not exists session_timer_minutes int; -- Range: 60-300 (1-5 hours)
alter table public.learners add column if not exists created_at timestamptz default now();

-- Keep JSONB targets and flat numeric columns in sync on write
create or replace function public.sync_learners_targets()
returns trigger
language plpgsql
as $fn$
declare
  c int;
  e int;
  w int;
  t int;
begin
  -- Parse values from JSONB targets if provided
  if new.targets is not null then
    begin c := (new.targets->>'comprehension')::int; exception when others then c := null; end;
    begin e := (new.targets->>'exercise')::int;      exception when others then e := null; end;
    begin w := (new.targets->>'worksheet')::int;     exception when others then w := null; end;
    begin t := (new.targets->>'test')::int;          exception when others then t := null; end;
  end if;

  -- Prefer explicit numeric columns if already provided; else use parsed JSON values
  if new.comprehension is null and c is not null then new.comprehension := c; end if;
  if new.exercise      is null and e is not null then new.exercise      := e; end if;
  if new.worksheet     is null and w is not null then new.worksheet     := w; end if;
  if new.test          is null and t is not null then new.test          := t; end if;

  -- Ensure targets JSON mirrors final numeric values
  new.targets := jsonb_strip_nulls(jsonb_build_object(
    'comprehension', new.comprehension,
    'exercise',      new.exercise,
    'worksheet',     new.worksheet,
    'test',          new.test
  ));

  return new;
end
$fn$;

drop trigger if exists sync_learners_targets_biu on public.learners;
create trigger sync_learners_targets_biu
before insert or update on public.learners
for each row execute function public.sync_learners_targets();

-- Owner index and RLS policies are created dynamically below to avoid 42703

-- Ensure owner_id column exists and link to profiles if available
alter table public.learners add column if not exists owner_id uuid;
do $do$
declare coltype text;
begin
  -- If owner_id exists but is not uuid, coerce it safely
  select data_type into coltype
    from information_schema.columns
   where table_schema='public' and table_name='learners' and column_name='owner_id';
  if coltype is not null and coltype <> 'uuid' then
    -- Null out invalid UUID strings to avoid cast errors
    execute $sql$
      update public.learners
         set owner_id = null
       where owner_id is not null
         and owner_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    $sql$;
    -- Convert column type to uuid
    execute 'alter table public.learners alter column owner_id type uuid using owner_id::uuid';
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    begin
      alter table public.learners drop constraint if exists learners_owner_id_fkey;
      alter table public.learners add constraint learners_owner_id_fkey
        foreign key (owner_id) references public.profiles(id) on delete cascade;
    exception when duplicate_object then
      -- FK already present
      null;
    end;
  end if;
end $do$;

-- Ensure facilitator_id column exists and link to profiles
alter table public.learners add column if not exists facilitator_id uuid;
do $do$
declare coltype text;
begin
  -- If facilitator_id exists but is not uuid, coerce it safely
  select data_type into coltype
    from information_schema.columns
   where table_schema='public' and table_name='learners' and column_name='facilitator_id';
  if coltype is not null and coltype <> 'uuid' then
    -- Null out invalid UUID strings to avoid cast errors
    execute $sql$
      update public.learners
         set facilitator_id = null
       where facilitator_id is not null
         and facilitator_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    $sql$;
    -- Convert column type to uuid
    execute 'alter table public.learners alter column facilitator_id type uuid using facilitator_id::uuid';
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    begin
      alter table public.learners drop constraint if exists learners_facilitator_id_fkey;
      alter table public.learners add constraint learners_facilitator_id_fkey
        foreign key (facilitator_id) references public.profiles(id) on delete cascade;
    exception when duplicate_object then null;
    end;
  end if;
end $do$;

-- Enable RLS and add policies (per-user ownership)
alter table public.learners enable row level security;

-- Drop any previous policies to avoid name clashes
drop policy if exists "learners_select_owner" on public.learners;
drop policy if exists "learners_insert_owner" on public.learners;
drop policy if exists "learners_update_owner" on public.learners;
drop policy if exists "learners_delete_owner" on public.learners;
drop policy if exists "learners_select_all" on public.learners;

-- Dynamically choose owner column (prefer facilitator_id, else owner_id, else user_id). If none exists,
-- create a permissive select policy temporarily to prevent 42703 while you migrate.
do $do$
declare
  owner_col text;
begin
  select case
           when exists (
             select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'learners' and column_name = 'facilitator_id'
           ) then 'facilitator_id'
           when exists (
             select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'learners' and column_name = 'owner_id'
           ) then 'owner_id'
           when exists (
             select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'learners' and column_name = 'user_id'
           ) then 'user_id'
           else null
         end
  into owner_col;

  if owner_col is not null then
    execute format('create index if not exists idx_learners_owner on public.learners(%I)', owner_col);

    -- Ensure clean slate for these policy names (idempotent even if already dropped above)
    execute 'drop policy if exists "learners_select_owner" on public.learners';
    execute 'drop policy if exists "learners_insert_owner" on public.learners';
    execute 'drop policy if exists "learners_update_owner" on public.learners';
    execute 'drop policy if exists "learners_delete_owner" on public.learners';
    execute 'drop policy if exists "learners_select_all" on public.learners';

    execute format('create policy "learners_select_owner" on public.learners for select using (auth.uid() = %I)', owner_col);
    execute format('create policy "learners_insert_owner" on public.learners for insert with check (auth.uid() = %I)', owner_col);
    execute format('create policy "learners_update_owner" on public.learners for update using (auth.uid() = %I) with check (auth.uid() = %I)', owner_col, owner_col);
    execute format('create policy "learners_delete_owner" on public.learners for delete using (auth.uid() = %I)', owner_col);
  else
    -- TEMP: allow authenticated users to select to avoid breaking UI until owner column is added
    execute 'create policy "learners_select_all" on public.learners for select using (true)';
  end if;
end $do$;

-- Grants for the authenticated role (RLS still applies)
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.learners to authenticated;

-- Default facilitator_id/owner_id to the signed-in user if not provided (so RLS will allow access)
create or replace function public.set_learners_owner_id()
returns trigger
language plpgsql
as $fn$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='learners' and column_name='facilitator_id'
  ) then
    if new.facilitator_id is null then
      new.facilitator_id := auth.uid();
    end if;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='learners' and column_name='owner_id'
  ) then
    if new.owner_id is null then
      new.owner_id := auth.uid();
    end if;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='learners' and column_name='user_id'
  ) then
    if new.user_id is null then
      new.user_id := auth.uid();
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists set_learners_owner on public.learners;
create trigger set_learners_owner
before insert on public.learners
for each row execute function public.set_learners_owner_id();

-- Backfill existing learners: set facilitator_id from owner_id/user_id if present
do $do$
declare
  has_fac boolean;
  has_owner boolean;
  has_user boolean;
begin
  select exists (
           select 1 from information_schema.columns
            where table_schema='public' and table_name='learners' and column_name='facilitator_id'
         ) into has_fac;
  select exists (
           select 1 from information_schema.columns
            where table_schema='public' and table_name='learners' and column_name='owner_id'
         ) into has_owner;
  select exists (
           select 1 from information_schema.columns
            where table_schema='public' and table_name='learners' and column_name='user_id'
         ) into has_user;

  if has_fac then
    if has_owner then
      update public.learners
         set facilitator_id = owner_id
       where facilitator_id is null and owner_id is not null;
    end if;
    if has_user then
      update public.learners
         set facilitator_id = user_id
       where facilitator_id is null and user_id is not null;
    end if;
  elsif has_owner then
    if has_user then
      update public.learners
         set owner_id = user_id
       where owner_id is null and user_id is not null;
    end if;
  end if;
end $do$;

-- Optional: If your project uses owner_id instead of user_id
-- 1) Add the column and migrate ownership
-- alter table public.learners add column if not exists owner_id uuid;
-- update public.learners set owner_id = user_id where owner_id is null and user_id is not null;
-- 2) Mirror RLS policies on owner_id instead:
-- drop policy if exists "learners_select_owner" on public.learners;
-- create policy "learners_select_owner"
--   on public.learners for select
--   using (auth.uid() = owner_id);
-- drop policy if exists "learners_insert_owner" on public.learners;
-- create policy "learners_insert_owner"
--   on public.learners for insert
--   with check (auth.uid() = owner_id);
-- drop policy if exists "learners_update_owner" on public.learners;
-- create policy "learners_update_owner"
--   on public.learners for update
--   using (auth.uid() = owner_id)
--   with check (auth.uid() = owner_id);
-- drop policy if exists "learners_delete_owner" on public.learners;
-- create policy "learners_delete_owner"
--   on public.learners for delete
--   using (auth.uid() = owner_id);

-- Note: The app's clientApi auto-detects whether owner column exists (user_id/owner_id)
-- and whether the table has flat numeric target columns or a JSONB targets column.
-- After applying this schema, reload the app and it will stop doing POST 400s.

-- -----------------------------------------------------------------------------
-- Migration helper (existing projects seeing 42703: column "user_id" does not exist)
-- -----------------------------------------------------------------------------
-- If your learners table already exists WITHOUT user_id, add it and (optionally)
-- backfill from owner_id if you used that previously.
-- Run this block safely; it only adds missing pieces.

-- 1) Add user_id if missing
alter table public.learners add column if not exists user_id uuid;

-- 2) If you historically stored ownership in owner_id, mirror it into user_id
alter table public.learners add column if not exists owner_id uuid;
update public.learners
  set user_id = owner_id
  where user_id is null and owner_id is not null;

-- 3) Recreate policies dynamically (see block above); dropping here ensures clean slate
drop policy if exists "learners_select_owner" on public.learners;
drop policy if exists "learners_insert_owner" on public.learners;
drop policy if exists "learners_update_owner" on public.learners;
drop policy if exists "learners_delete_owner" on public.learners;
drop policy if exists "learners_select_all" on public.learners;
-- Immediately re-create policies dynamically (same logic as earlier)
do $do$
declare owner_col text;
begin
  select case
           when exists (
             select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'learners' and column_name = 'facilitator_id'
           ) then 'facilitator_id'
           when exists (
             select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'learners' and column_name = 'owner_id'
           ) then 'owner_id'
           when exists (
             select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'learners' and column_name = 'user_id'
           ) then 'user_id'
           else null
         end
  into owner_col;

  if owner_col is not null then
    execute format('create index if not exists idx_learners_owner on public.learners(%I)', owner_col);
    -- Ensure clean slate inside this block too
    execute 'drop policy if exists "learners_select_owner" on public.learners';
    execute 'drop policy if exists "learners_insert_owner" on public.learners';
    execute 'drop policy if exists "learners_update_owner" on public.learners';
    execute 'drop policy if exists "learners_delete_owner" on public.learners';
    execute 'drop policy if exists "learners_select_all" on public.learners';
    execute format('create policy "learners_select_owner" on public.learners for select using (auth.uid() = %I)', owner_col);
    execute format('create policy "learners_insert_owner" on public.learners for insert with check (auth.uid() = %I)', owner_col);
    execute format('create policy "learners_update_owner" on public.learners for update using (auth.uid() = %I) with check (auth.uid() = %I)', owner_col, owner_col);
    execute format('create policy "learners_delete_owner" on public.learners for delete using (auth.uid() = %I)', owner_col);
  else
    execute 'create policy "learners_select_all" on public.learners for select using (true)';
  end if;
end $do$;

-- 4) Index (idempotent) - owner index handled by dynamic block; created_at index above
create index if not exists idx_learners_created_at on public.learners(created_at desc);

-- Alternative: If you prefer to keep owner_id as the sole owner column,
-- re-run the policy block above but replace user_id with owner_id everywhere.
