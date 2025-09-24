-- Profiles table: stores plan info and user identity (email, full name)
-- Run this in Supabase SQL editor.

-- Create table if missing (minimal shape). Adjust as needed for your project.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan_tier text not null default 'free' check (plan_tier in ('free','basic','plus','premium')),
  stripe_customer_id text,
  timezone text,
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_email on public.profiles(email);

-- RLS: users can see and manage their own profile
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Allow service_role (backend) to manage profiles without RLS restrictions (safe for server)
drop policy if exists "profiles_all_service" on public.profiles;
create policy "profiles_all_service" on public.profiles for all to service_role using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- Backfill profiles for existing auth.users (idempotent)
insert into public.profiles (id, email, full_name)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Sync email/full_name from auth.users when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Exception-safe: never block auth flow. If anything fails, swallow and continue.
  begin
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
    on conflict (id) do update
      set email = excluded.email,
          full_name = coalesce(excluded.full_name, public.profiles.full_name),
          updated_at = now();
  exception when others then
    -- Don't raise; log for debugging.
    raise notice 'handle_new_user: % %', SQLSTATE, SQLERRM;
  end;
  return new;
end
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Optional: keep email up to date if changed in auth.users
create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Exception-safe: never block auth flow on update.
  begin
    update public.profiles p
       set email = new.email,
           full_name = coalesce(new.raw_user_meta_data->>'full_name', p.full_name),
           updated_at = now()
     where p.id = new.id;
  exception when others then
    raise notice 'handle_user_update: % %', SQLSTATE, SQLERRM;
  end;
  return new;
end
$fn$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_user_update();

-- Ensure functions are owned by postgres so SECURITY DEFINER runs with bypass RLS
do $do$ begin
  begin
    alter function public.handle_new_user() owner to postgres;
  exception when insufficient_privilege then null; end;
  begin
    alter function public.handle_user_update() owner to postgres;
  exception when insufficient_privilege then null; end;
end $do$;

-- Debug helpers (optional): If you suspect these triggers cause auth 500s,
-- you can temporarily disable them, test login, then re-enable.
-- NOTE: Keep these commented and run manually in the SQL editor when needed.
--
-- -- Disable
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop trigger if exists on_auth_user_updated on auth.users;
--
-- -- Re-enable
-- create trigger on_auth_user_created
-- after insert on auth.users
-- for each row execute function public.handle_new_user();
--
-- create trigger on_auth_user_updated
-- after update on auth.users
-- for each row execute function public.handle_user_update();
