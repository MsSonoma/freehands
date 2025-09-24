Stripe Billing Setup

Overview
- We use Stripe Billing for subscriptions with three tiers: Basic, Plus, Premium.
- Server routes: /api/billing/checkout, /api/billing/portal, /api/billing/webhook
- Supabase holds plan state in profiles.plan_tier and optional subscriptions table.

1) Create Products and Prices
- In Stripe Dashboard, create Products: Basic ($5/mo), Plus ($20/mo), Premium ($35/mo)
- Copy the monthly Price IDs and set them as env vars:
  - STRIPE_PRICE_BASIC=price_xxx
  - STRIPE_PRICE_PLUS=price_xxx
  - STRIPE_PRICE_PREMIUM=price_xxx

2) Environment Variables (.env.local)
- STRIPE_SECRET_KEY=sk_live_or_test_...
- STRIPE_WEBHOOK_SECRET=whsec_...
- NEXT_PUBLIC_SUPABASE_URL=...
- NEXT_PUBLIC_SUPABASE_ANON_KEY=...
- SUPABASE_SERVICE_ROLE_KEY=...
- APP_URL=http://localhost:3000

3) Supabase Schema
Run in Supabase SQL editor:

-- profiles additions
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists plan_tier text not null default 'free' check (plan_tier in ('free','basic','plus','premium'));

-- optional subscriptions table
create table if not exists subscriptions (
  user_id uuid references profiles(id) on delete cascade,
  stripe_subscription_id text primary key,
  status text,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false
);

-- RLS (example - adjust as needed)
alter table subscriptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'subscriptions' and policyname = 'user can read own') then
    create policy "user can read own" on subscriptions for select using (auth.uid() = user_id);
  end if;
end $$;

4) Webhooks (local dev)
- Install Stripe CLI and run:
  stripe login
  stripe listen --forward-to localhost:3000/api/billing/webhook
- Copy the webhook signing secret output into STRIPE_WEBHOOK_SECRET.

5) Test Flow
- Sign up and log in
- Go to Facilitator > Plan and choose Basic/Plus/Premium
- Complete checkout; webhook updates profiles.plan_tier
- Use Manage subscription to access billing portal.

Notes
- The webhook route requires raw body; we set runtime nodejs and read req.text().
- The checkout route upserts stripe_customer_id on profiles using service role key.
