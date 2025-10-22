-- Verification queries for profiles email sync
-- Run these in Supabase SQL editor to diagnose email sync issues

-- 1. Check if profiles table exists and has email column
select 
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public' 
  and table_name = 'profiles'
  and column_name in ('id', 'email', 'full_name')
order by ordinal_position;

-- 2. Check if triggers exist on auth.users
select 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
  and trigger_name in ('on_auth_user_created', 'on_auth_user_updated');

-- 3. Check if trigger functions exist
select 
  routine_name,
  routine_type,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('handle_new_user', 'handle_user_update');

-- 4. Compare auth.users vs profiles for all users
select 
  u.id,
  u.email as auth_email,
  u.created_at as user_created_at,
  p.email as profile_email,
  p.full_name,
  p.updated_at as profile_updated_at,
  case 
    when p.id is null then '❌ MISSING PROFILE'
    when p.email is null or p.email = '' then '⚠️ MISSING EMAIL IN PROFILE'
    when p.email != u.email then '⚠️ EMAIL MISMATCH'
    else '✅ OK'
  end as status
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc
limit 50;

-- 5. Count issues
select 
  count(*) as total_users,
  count(p.id) as users_with_profile,
  count(*) - count(p.id) as missing_profiles,
  count(case when p.id is not null and (p.email is null or p.email = '') then 1 end) as profiles_without_email,
  count(case when p.id is not null and p.email is not null and p.email != '' then 1 end) as profiles_with_email
from auth.users u
left join public.profiles p on p.id = u.id;

-- 6. Find your friend's account (replace 'friend@example.com' with actual email)
-- select 
--   u.id,
--   u.email as auth_email,
--   u.created_at,
--   p.email as profile_email,
--   p.full_name,
--   case 
--     when p.id is null then 'Profile missing - triggers not working'
--     when p.email is null then 'Profile exists but email not synced'
--     else 'OK'
--   end as diagnosis
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- where u.email = 'friend@example.com';

-- 7. Check RLS policies on profiles
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public' 
  and tablename = 'profiles'
order by policyname;
