-- Complete profiles table setup with email sync triggers
-- Run this in your Supabase SQL editor to ensure emails are saved

-- 1. Create profiles table if it doesn't exist
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan_tier text not null default 'free' check (plan_tier in ('free','basic','plus','premium')),
  stripe_customer_id text,
  timezone text,
  facilitator_pin_hash text,
  facilitator_pin_prefs jsonb,
  facilitator_hotkeys jsonb,
  updated_at timestamptz default now()
);

-- 2. Create indexes
create index if not exists idx_profiles_email on public.profiles(email);

-- 3. Enable RLS
alter table public.profiles enable row level security;

-- 4. Drop existing policies to avoid conflicts
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_all_service" on public.profiles;

-- 5. Create RLS policies
create policy "profiles_select_own" on public.profiles 
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles 
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles 
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_all_service" on public.profiles 
  for all to service_role using (true) with check (true);

-- 6. Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- 7. Backfill profiles for existing users (idempotent)
insert into public.profiles (id, email, full_name)
select 
  u.id, 
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- 8. Create trigger function for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Exception-safe: never block auth flow
  begin
    insert into public.profiles (id, email, full_name)
    values (
      new.id, 
      new.email, 
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
    )
    on conflict (id) do update
      set email = excluded.email,
          full_name = coalesce(excluded.full_name, public.profiles.full_name),
          updated_at = now();
  exception when others then
    raise notice 'handle_new_user error: % %', SQLSTATE, SQLERRM;
  end;
  return new;
end
$$;

-- 9. Create trigger for user updates
create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Exception-safe: never block auth flow
  begin
    update public.profiles p
    set email = new.email,
        full_name = coalesce(new.raw_user_meta_data->>'full_name', p.full_name),
        updated_at = now()
    where p.id = new.id;
  exception when others then
    raise notice 'handle_user_update error: % %', SQLSTATE, SQLERRM;
  end;
  return new;
end
$$;

-- 10. Drop existing triggers if they exist
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;

-- 11. Create triggers on auth.users
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_user_update();

-- 12. Set function ownership to postgres (required for SECURITY DEFINER)
alter function public.handle_new_user() owner to postgres;
alter function public.handle_user_update() owner to postgres;

-- 13. Verification query - run this separately to check if setup worked
-- select 
--   u.id,
--   u.email as auth_email,
--   p.email as profile_email,
--   case 
--     when p.id is null then 'MISSING PROFILE'
--     when p.email is null then 'MISSING EMAIL'
--     when p.email = u.email then 'OK'
--     else 'EMAIL MISMATCH'
--   end as status
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- order by u.created_at desc
-- limit 20;
