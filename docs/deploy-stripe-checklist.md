# Stripe Deploy Checklist (Vercel)

This checklist ensures a smooth transition from local dev to production on Vercel.

## 1) Environment Variables (Vercel → Project Settings → Environment)

Set for each environment you use (Production; optionally Preview):

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (match mode: pk_live_ for prod)
- STRIPE_SECRET_KEY (match mode: sk_live_ for prod)
- STRIPE_PRICE_BASIC (price_… from the same mode)
- STRIPE_PRICE_PLUS (price_…)
- STRIPE_PRICE_PREMIUM (price_…)
- STRIPE_WEBHOOK_SECRET (from Dashboard webhook endpoint for that environment)
- APP_URL = https://YOUR_DOMAIN

Deploy after updating envs.

## 2) Stripe Webhook (Production)

In Stripe Dashboard → Developers → Webhooks:

- Add endpoint: `https://YOUR_DOMAIN/api/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- Reveal signing secret → set `STRIPE_WEBHOOK_SECRET` in Vercel (Production)

## 3) Customer Portal (optional but recommended)

- Configure branding and features in Stripe Dashboard (Test and Live separately)
- Ensure plans/prices are visible if you use the portal

## 4) Post-Deploy Smoke Test

1. Sign in to your app
2. Visit `/billing/element/checkout?tier=premium`
3. Complete a payment (test card in Preview, real in Production)
4. In Stripe Dashboard → Events, confirm a 200 delivery to `/api/billing/webhook`
5. In Supabase, confirm `profiles.plan_tier` or subscription records updated

## 5) Health Endpoint Hygiene

- Production returns minimal data by default; add `?detail=1` only if needed for rollout
- Consider restricting access (e.g., to admins) if requirements change

## 6) Notes

- Keys and prices are per mode. Do not mix Test and Live.
- `APP_URL` stabilizes return URLs across environments.
- Local `stripe listen` secrets (whsec_…) are temporary; production uses Dashboard-generated secrets bound to your domain.
