# Account Provisioning (Paid Tiers + Demo)

## How It Works

This project uses **Supabase Auth** for logins and a separate app-owned table (`public.profiles`) for plan/tier gating.

### Gating source of truth

- Feature access is ultimately gated by `public.profiles.plan_tier`.
- Entitlement logic lives in `src/app/lib/entitlements.js` and resolves the effective tier via:
  - `profiles.subscription_tier` (special-case: `beta` -> `pro`), and
  - `profiles.plan_tier` for the configured plan (`free`, `trial`, `standard`, `pro`, or legacy `lifetime`).

### Creating accounts without confirmation emails

Do NOT insert directly into Supabase auth tables.

To create a user that can immediately sign in (no email confirmation step), use the Supabase Admin API with `email_confirm: true`, then upsert `profiles.plan_tier` to the desired value (typically `standard` or `pro`).

This repo provides a script that does exactly that:

- `scripts/createPremiumUser.mjs`

The script accepts `free|trial|standard|pro|lifetime` and defaults to `pro` if no plan is provided.

To avoid placing passwords directly in terminal history, the script also supports reading the password from an environment variable:

- `CREATE_PREMIUM_USER_PASSWORD`

There is also a convenience PowerShell wrapper that prompts for the password:

- `scripts/create-premium-user.ps1`

If your environment injects `_vscodecontentref_` URLs when copying commands from chat, use the npm wrapper (no file paths to paste):

- `npm run provision:plan`

It:
1. Uses `SUPABASE_SERVICE_ROLE_KEY` to call `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
2. Upserts `public.profiles.plan_tier` for the created/located user

### DEMO login alias

The login page supports an optional alias where typing `DEMO` into the email field maps to a real email for Supabase sign-in.

- If the user enters `DEMO` (case-insensitive), the app uses `NEXT_PUBLIC_DEMO_LOGIN_EMAIL` (or defaults to `demo@mssonoma.com`) as the actual sign-in email.
- The password field is not transformed; it is passed through as entered.

This allows an operator to share a simple login instruction ("Email: DEMO") while still using a real Supabase Auth user.

## What NOT To Do

- Do not store plaintext passwords anywhere in the database.
- Do not attempt to create users by inserting rows into `auth.users` or related auth tables.
- Do not commit real credentials (emails/passwords/tokens) into the repo, brain files, or changelog.
- Do not grant paid access by client-side code only; set `profiles.plan_tier` server-side (service role) to avoid spoofing.

## Key Files

- `scripts/createPremiumUser.mjs` - Creates/updates a confirmed Auth user and grants `plan_tier`
- `scripts/create-premium-user.ps1` - Prompts for password and invokes the script via `CREATE_PREMIUM_USER_PASSWORD`
- `src/app/auth/login/page.js` - DEMO alias mapping + relaxed email input validation
- `src/app/lib/entitlements.js` - Tier resolution and feature entitlements
- `src/app/hooks/useAccessControl.js` - Reads `profiles.subscription_tier` + `profiles.plan_tier` for gating
- `docs/SQLs/profiles-schema.sql` - Reference schema + triggers that mirror auth user metadata into `public.profiles`
