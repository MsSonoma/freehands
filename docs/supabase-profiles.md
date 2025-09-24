Profiles table setup

Run in Supabase SQL editor for your project:

-- Ensure profiles has required columns
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists plan_tier text not null default 'free' check (plan_tier in ('free','basic','plus','premium'));
alter table profiles add column if not exists timezone text;

-- Optional: create profiles table if missing (adjust auth linkage as needed)
-- create table profiles (
--   id uuid primary key references auth.users(id) on delete cascade,
--   plan_tier text not null default 'free' check (plan_tier in ('free','basic','plus','premium')),
--   stripe_customer_id text
--   , timezone text
-- );

Notes
- The admin grant and webhook depend on profiles.plan_tier. Create/add the column if it's missing.
- If you use a different schema name, update server code accordingly.
