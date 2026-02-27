# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Quota hit when generating lessons (calendar + lesson generator) even though account is premium; gating other accounts may have affected entitlement.
```

Filter terms used:
```text
Quota
hit
when
generating
lessons
calendar
lesson
generator
even
though
account
is
premium
gating
other
accounts
may
have
affected
entitlement
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Quota hit when generating lessons calendar lesson generator even though account is premium gating other accounts may have affected entitlement

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/gating-system.md (e69ed2f9f8503e13bd8b75938a075c288190593db4070e26484ed2d0efb061c8)
- bm25: -27.3018 | relevance: 1.0000

# Universal Gating System

## How It Works

Users can browse pages and see what features look like, but gated actions are blocked with a consistent overlay/CTA. Gating is driven by entitlements (not hardcoded tier strings).

### GatedOverlay Component

Location: `src/app/components/GatedOverlay.jsx`

Reusable overlay component that shows appropriate messaging based on gate type:

**Auth Gate**
- Prompts user to sign up/sign in with buttons
- Shows feature preview with benefits
- Links to authentication flow

**Tier Gate**
- Prompts user to upgrade with upgrade button
- Shows current tier vs required tier
- Lists feature benefits
- Links to upgrade/account page

**Props:**
- `show` (boolean): Whether to display overlay
- `gateType` ('auth' | 'tier'): Type of gate
- `feature` (string): Feature name
- `emoji` (string): Display emoji
- `description` (string): Feature description
- `benefits` (array): List of benefits
- `currentTier` (string): User's current tier (for tier gates)
- `requiredTier` (string): Required tier (for tier gates)

**Tier model (current)**

- `free` - signed in, no paid features
- `trial` - limited (lifetime) generations; can view all surfaces; write actions for Calendar/Mr. Mentor/Golden Keys/Visual Aids/Games remain gated
- `standard` - paid
- `pro` - paid; includes Mr. Mentor and planner/curriculum prefs
- `lifetime` - legacy tier (treated as fully entitled)

**Tier normalization (legacy compatibility)**

Some older accounts may still have legacy tier ids stored in `profiles.plan_tier` **or** `profiles.subscription_tier`.
Entitlement checks must normalize these values before lookup, and resolve the effective tier using the most-entitled value across both columns:

- `premium` / `premium-plus` -> `pro`
- `plus` / `basic` -> `standard`

### 2. docs/brain/ingests/pack.planned-lessons-flow.md (22976d3d45f57b0ca0f251d436bae2dd3aff4c514a699692154bc470a2f754ca)
- bm25: -25.3153 | relevance: 1.0000

﻿2026-02-09T01:00:04Z | Copilot | Mr. Mentor Calendar overlay now force-refreshes planned/scheduled/completed markers; removes stale self-cache that blocked polling updates [#MentorInterceptor: CalendarOverlay, refresh, planned-lessons] 
2026-02-05T03:28:35Z | Copilot | Fix Calendar LessonPlanner JSX parse error (Duration <select> tag) that broke Vercel Next build [#calendar-lesson-planning: LessonPlanner, JSX, build] 
2026-02-05T00:30:46Z | Copilot | Entitlements: resolveEffectiveTier now considers subscription_tier + plan_tier (Premium->Pro in either) to prevent false lockouts [#gating-system: tier-normalization, resolveEffectiveTier, tier-gates]
2026-02-05T00:25:09Z | Copilot | Mr. Mentor: remove blocking Pro overlay; signed-in view + read-only loads; gate session init and actions behind Pro [#gating-system: window-shopping, view-only, tier-gates] [#mr-mentor-sessions: realtime conflict detection, session takeover, heartbeat polling]
2026-02-04T21:15:00Z | Copilot | Calendar: always viewable when signed in; gate only schedule/plan writes behind Pro (no tier-blocking overlay) [#calendar-lesson-planning: view-only, canPlan, manual-scheduling] [#gating-system: window-shopping, tier-gates, view-only]
2026-02-04T20:59:14Z | Copilot | Normalize legacy plan_tier values (premium/plus/basic) so learner caps and entitlements resolve correctly [#gating-system: tier-gates, useAccessControl, universal-gating]
2026-02-04T19:31:04Z | Copilot | Clean up remaining legacy tier refs (Basic/Plus/Premium) in UI copy, docs, tasks, and schema examples [#gating-system: requiredFeature, requiredTier, window-shopping] [#account-provisioning: provision wrapper, plan_tier values] [#lesson-quota: lessonsPerDay, quota overlay] [#calendar-lesson-planning: lessonPlanner, tier-gate]
2026-02-04T18:14

### 3. docs/brain/changelog.md (0e54fa3021f5880823f03c827371d24752fe976456e6c7bf9dc17b57ebbc36ed)
- bm25: -25.0074 | relevance: 1.0000

﻿2026-02-09T01:00:04Z | Copilot | Mr. Mentor Calendar overlay now force-refreshes planned/scheduled/completed markers; removes stale self-cache that blocked polling updates [#MentorInterceptor: CalendarOverlay, refresh, planned-lessons] 
2026-02-05T03:28:35Z | Copilot | Fix Calendar LessonPlanner JSX parse error (Duration <select> tag) that broke Vercel Next build [#calendar-lesson-planning: LessonPlanner, JSX, build] 
2026-02-05T00:30:46Z | Copilot | Entitlements: resolveEffectiveTier now considers subscription_tier + plan_tier (Premium->Pro in either) to prevent false lockouts [#gating-system: tier-normalization, resolveEffectiveTier, tier-gates]
2026-02-05T00:25:09Z | Copilot | Mr. Mentor: remove blocking Pro overlay; signed-in view + read-only loads; gate session init and actions behind Pro [#gating-system: window-shopping, view-only, tier-gates] [#mr-mentor-sessions: realtime conflict detection, session takeover, heartbeat polling]
2026-02-04T21:15:00Z | Copilot | Calendar: always viewable when signed in; gate only schedule/plan writes behind Pro (no tier-blocking overlay) [#calendar-lesson-planning: view-only, canPlan, manual-scheduling] [#gating-system: window-shopping, tier-gates, view-only]
2026-02-04T20:59:14Z | Copilot | Normalize legacy plan_tier values (premium/plus/basic) so learner caps and entitlements resolve correctly [#gating-system: tier-gates, useAccessControl, universal-gating]
2026-02-04T19:31:04Z | Copilot | Clean up remaining legacy tier refs (Basic/Plus/Premium) in UI copy, docs, tasks, and schema examples [#gating-system: requiredFeature, requiredTier, window-shopping] [#account-provisioning: provision wrapper, plan_tier values] [#lesson-quota: lessonsPerDay, quota overlay] [#calendar-lesson-planning: lessonPlanner, tier-gate]
2026-02-04T18:14

### 4. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (1da55e732affaa214805f19e9609c30a8abd65c5572b458ab7795f4208a304be)
- bm25: -24.9521 | relevance: 1.0000

﻿2026-02-09T01:00:04Z | Copilot | Mr. Mentor Calendar overlay now force-refreshes planned/scheduled/completed markers; removes stale self-cache that blocked polling updates [#MentorInterceptor: CalendarOverlay, refresh, planned-lessons] 
2026-02-05T03:28:35Z | Copilot | Fix Calendar LessonPlanner JSX parse error (Duration <select> tag) that broke Vercel Next build [#calendar-lesson-planning: LessonPlanner, JSX, build] 
2026-02-05T00:30:46Z | Copilot | Entitlements: resolveEffectiveTier now considers subscription_tier + plan_tier (Premium->Pro in either) to prevent false lockouts [#gating-system: tier-normalization, resolveEffectiveTier, tier-gates]
2026-02-05T00:25:09Z | Copilot | Mr. Mentor: remove blocking Pro overlay; signed-in view + read-only loads; gate session init and actions behind Pro [#gating-system: window-shopping, view-only, tier-gates] [#mr-mentor-sessions: realtime conflict detection, session takeover, heartbeat polling]
2026-02-04T21:15:00Z | Copilot | Calendar: always viewable when signed in; gate only schedule/plan writes behind Pro (no tier-blocking overlay) [#calendar-lesson-planning: view-only, canPlan, manual-scheduling] [#gating-system: window-shopping, tier-gates, view-only]
2026-02-04T20:59:14Z | Copilot | Normalize legacy plan_tier values (premium/plus/basic) so learner caps and entitlements resolve correctly [#gating-system: tier-gates, useAccessControl, universal-gating]
2026-02-04T19:31:04Z | Copilot | Clean up remaining legacy tier refs (Basic/Plus/Premium) in UI copy, docs, tasks, and schema examples [#gating-system: requiredFeature, requiredTier, window-shopping] [#account-provisioning: provision wrapper, plan_tier values] [#lesson-quota: lessonsPerDay, quota overlay] [#calendar-lesson-planning: lessonPlanner, tier-gate]
2026-02-04T18:14

### 5. docs/brain/ingests/pack.lesson-schedule-debug.md (7b6a5ae27f0b9bafc01effbfbe0540f8869c9f810eb899dbca033e71d05ebe01)
- bm25: -24.9319 | relevance: 1.0000

﻿2026-02-09T01:00:04Z | Copilot | Mr. Mentor Calendar overlay now force-refreshes planned/scheduled/completed markers; removes stale self-cache that blocked polling updates [#MentorInterceptor: CalendarOverlay, refresh, planned-lessons] 
2026-02-05T03:28:35Z | Copilot | Fix Calendar LessonPlanner JSX parse error (Duration <select> tag) that broke Vercel Next build [#calendar-lesson-planning: LessonPlanner, JSX, build] 
2026-02-05T00:30:46Z | Copilot | Entitlements: resolveEffectiveTier now considers subscription_tier + plan_tier (Premium->Pro in either) to prevent false lockouts [#gating-system: tier-normalization, resolveEffectiveTier, tier-gates]
2026-02-05T00:25:09Z | Copilot | Mr. Mentor: remove blocking Pro overlay; signed-in view + read-only loads; gate session init and actions behind Pro [#gating-system: window-shopping, view-only, tier-gates] [#mr-mentor-sessions: realtime conflict detection, session takeover, heartbeat polling]
2026-02-04T21:15:00Z | Copilot | Calendar: always viewable when signed in; gate only schedule/plan writes behind Pro (no tier-blocking overlay) [#calendar-lesson-planning: view-only, canPlan, manual-scheduling] [#gating-system: window-shopping, tier-gates, view-only]
2026-02-04T20:59:14Z | Copilot | Normalize legacy plan_tier values (premium/plus/basic) so learner caps and entitlements resolve correctly [#gating-system: tier-gates, useAccessControl, universal-gating]
2026-02-04T19:31:04Z | Copilot | Clean up remaining legacy tier refs (Basic/Plus/Premium) in UI copy, docs, tasks, and schema examples [#gating-system: requiredFeature, requiredTier, window-shopping] [#account-provisioning: provision wrapper, plan_tier values] [#lesson-quota: lessonsPerDay, quota overlay] [#calendar-lesson-planning: lessonPlanner, tier-gate]
2026-02-04T18:14

### 6. docs/brain/ingests/pack.md (4013862c9bc765a47e0245e75c0bfcad8366a76bd72eacef2a3a92b824037683)
- bm25: -23.7115 | relevance: 1.0000

﻿2026-02-05T03:28:35Z | Copilot | Fix Calendar LessonPlanner JSX parse error (Duration <select> tag) that broke Vercel Next build [#calendar-lesson-planning: LessonPlanner, JSX, build] 
2026-02-05T00:30:46Z | Copilot | Entitlements: resolveEffectiveTier now considers subscription_tier + plan_tier (Premium->Pro in either) to prevent false lockouts [#gating-system: tier-normalization, resolveEffectiveTier, tier-gates]
2026-02-05T00:25:09Z | Copilot | Mr. Mentor: remove blocking Pro overlay; signed-in view + read-only loads; gate session init and actions behind Pro [#gating-system: window-shopping, view-only, tier-gates] [#mr-mentor-sessions: realtime conflict detection, session takeover, heartbeat polling]
2026-02-04T21:15:00Z | Copilot | Calendar: always viewable when signed in; gate only schedule/plan writes behind Pro (no tier-blocking overlay) [#calendar-lesson-planning: view-only, canPlan, manual-scheduling] [#gating-system: window-shopping, tier-gates, view-only]
2026-02-04T20:59:14Z | Copilot | Normalize legacy plan_tier values (premium/plus/basic) so learner caps and entitlements resolve correctly [#gating-system: tier-gates, useAccessControl, universal-gating]
2026-02-04T19:31:04Z | Copilot | Clean up remaining legacy tier refs (Basic/Plus/Premium) in UI copy, docs, tasks, and schema examples [#gating-system: requiredFeature, requiredTier, window-shopping] [#account-provisioning: provision wrapper, plan_tier values] [#lesson-quota: lessonsPerDay, quota overlay] [#calendar-lesson-planning: lessonPlanner, tier-gate]
2026-02-04T18:14:47Z | Copilot | ESLint: ignore .next-dev output so lint only checks source
2026-02-04T01:05:00Z | Copilot | Gate Session V2 Games/Visual Aids/Golden Keys by plan entitlements; sync provisioning + brain docs to free/trial/standard/pro [#

### 7. docs/brain/ingests/pack-mentor-intercepts.md (4e6b345c94962231d83f404904696a91ec930acd9a3b6c5446ca8afb19f3135c)
- bm25: -23.6444 | relevance: 1.0000

﻿2026-02-05T03:28:35Z | Copilot | Fix Calendar LessonPlanner JSX parse error (Duration <select> tag) that broke Vercel Next build [#calendar-lesson-planning: LessonPlanner, JSX, build] 
2026-02-05T00:30:46Z | Copilot | Entitlements: resolveEffectiveTier now considers subscription_tier + plan_tier (Premium->Pro in either) to prevent false lockouts [#gating-system: tier-normalization, resolveEffectiveTier, tier-gates]
2026-02-05T00:25:09Z | Copilot | Mr. Mentor: remove blocking Pro overlay; signed-in view + read-only loads; gate session init and actions behind Pro [#gating-system: window-shopping, view-only, tier-gates] [#mr-mentor-sessions: realtime conflict detection, session takeover, heartbeat polling]
2026-02-04T21:15:00Z | Copilot | Calendar: always viewable when signed in; gate only schedule/plan writes behind Pro (no tier-blocking overlay) [#calendar-lesson-planning: view-only, canPlan, manual-scheduling] [#gating-system: window-shopping, tier-gates, view-only]
2026-02-04T20:59:14Z | Copilot | Normalize legacy plan_tier values (premium/plus/basic) so learner caps and entitlements resolve correctly [#gating-system: tier-gates, useAccessControl, universal-gating]
2026-02-04T19:31:04Z | Copilot | Clean up remaining legacy tier refs (Basic/Plus/Premium) in UI copy, docs, tasks, and schema examples [#gating-system: requiredFeature, requiredTier, window-shopping] [#account-provisioning: provision wrapper, plan_tier values] [#lesson-quota: lessonsPerDay, quota overlay] [#calendar-lesson-planning: lessonPlanner, tier-gate]
2026-02-04T18:14:47Z | Copilot | ESLint: ignore .next-dev output so lint only checks source
2026-02-04T01:05:00Z | Copilot | Gate Session V2 Games/Visual Aids/Golden Keys by plan entitlements; sync provisioning + brain docs to free/trial/standard/pro [#

### 8. docs/brain/account-provisioning.md (0f03e35407bd04933941ffb70f166adbe8750f40e74e629e9e98247b1709a299)
- bm25: -22.9370 | relevance: 1.0000

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

### 9. docs/brain/timer-system.md (f6039f66c89f72a9b7a6605c84ec61b2bb3d87b5f9d91a8dfe35b82d55d0be59)
- bm25: -21.2639 | relevance: 1.0000

### Golden Keys Gating (Plan + Per Learner)

Golden Keys have two independent gates:

1) **Plan entitlement (account level)**
- Source: `profiles.plan_tier` + `profiles.subscription_tier` resolved through `resolveEffectiveTier()` + `featuresForTier()`.
- If `featuresForTier(effectiveTier).goldenKeyFeatures === false` (e.g., `trial`), Golden Keys are not usable in-session.
- In Session V2, the plan entitlement is enforced even if the learner setting is on (learner setting is coerced off).

2) **Per-learner setting (learner level)**
- Column: `public.learners.golden_keys_enabled` (boolean, default true)
- Only applies when the plan is entitled.

**UI behavior (TimerControlOverlay):**
- Not entitled by plan: show the Golden Key section with an upgrade note; do not allow applying/suspending/earning keys.
- Entitled by plan, learner setting off: keep controls visible but disable actions with explanatory copy.
- Entitled by plan, learner setting on: full Golden Key behavior enabled.

### Golden Key Application (Per Lesson)

Golden Key usage is **per-lesson**, stored on the learner record:
- Field: `learners.active_golden_keys` (JSON map `{ [lessonKey]: true }`)
- When a facilitator applies a Golden Key for the current lesson, Session V2 must persist:
  - Set `active_golden_keys[lessonKey] = true`
  - Decrement `learners.golden_keys` inventory by 1

Once applied:
- The Golden Key bonus minutes are added to **all play timers** (phases 2-5) for that session.
- Suspending the Golden Key sets the play bonus to 0 (bonus is removed immediately from running timers).

### 10. src/lib/faq/facilitator-pages.json (4b848d3bcb8fd074168f4bfd8805c4c4143f1f27948661b54e4fbba3e5eaf7e3)
- bm25: -17.4777 | relevance: 1.0000

{
  "category": "Facilitator Pages",
  "features": [
    {
      "id": "facilitator-page-hub",
      "title": "Facilitator Hub (/facilitator)",
      "keywords": [
        "facilitator hub",
        "facilitator home",
        "facilitator dashboard page",
        "/facilitator",
        "account learners lessons calendar",
        "talk to mr mentor"
      ],
      "description": "The Facilitator Hub is the entry point to adult tools. It shows quick links to Account, Learners, Lessons, Calendar, and Mr. Mentor.",
      "howToUse": "Use the cards to open a section (Account/Learners/Lessons/Calendar). Use the Mr. Mentor button to open the facilitator chat experience.",
      "relatedFeatures": ["facilitator-dashboard", "mr-mentor", "pin-security"]
    },
    {
      "id": "facilitator-page-account",
      "title": "Account (/facilitator/account)",
      "keywords": [
        "facilitator account",
        "account page",
        "profile",
        "security",
        "2fa",
        "connected accounts",
        "timezone",
        "marketing emails",
        "policies",
        "danger zone",
        "/facilitator/account"
      ],
      "description": "The Account page is the central place to manage facilitator profile and security settings, connections, hotkeys, timezone, and billing links.",
      "howToUse": "Open a card to edit: Your Name; Email and Password; Two-Factor Auth; Facilitator PIN; Connected Accounts; Hotkeys; Timezone; Marketing Emails; Policies; Plan; Danger Zone. Notifications is also linked from here.",
      "relatedFeatures": ["pin-security", "subscription-tiers"]
    },
    {
      "id": "facilitator-page-account-settings-redirect",
      "title": "Account Settings (Redirect) (/facilitator/account/settings)",
      "keywords": [
        "account se

### 11. docs/brain/auth-session-isolation.md (9da46bc8495d845a56fab200c340c1d2f3775c432f8d0972bfbdceaf7d46e82a)
- bm25: -16.5088 | relevance: 1.0000

## Files Changed

- `src/app/facilitator/account/settings/page.js` - Added `scope: 'local'` to delete account signOut
- `src/app/facilitator/account/page.js` - Added `scope: 'local'` to logout button signOut

## What NOT To Do

**DO NOT:**
- Use `scope: 'global'` unless you explicitly want to log out all devices (e.g., "Log out everywhere" button)
- Remove the scope parameter (reverts to global logout)
- Assume localStorage changes affect other devices (they don't - this was server-side)

## When To Use Each Scope

**Use `scope: 'local'` (default choice):**
- Normal logout button
- Account deletion (user may have other devices)
- Session timeout on current device
- "Log out of this device" action

**Use `scope: 'global'` (explicit choice):**
- "Log out everywhere" feature (security)
- Password change (force re-auth on all devices)
- Account compromise response
- Admin-initiated logout

## Security Considerations

**Reduced Security vs. Better UX:**
- `scope: 'local'` means compromised device logout doesn't revoke other devices
- Session remains valid until JWT expiry (default: 1 hour with 7-day refresh)
- Attacker with stolen token could use it until natural expiry

**Mitigation:**
- Keep JWT expiry time reasonable (1 hour is good)
- Provide "Log out everywhere" button for users who want it
- Force global logout on password change
- Monitor suspicious activity and force global logout server-side

**Why this trade-off is OK:**
- Most users expect device-independent sessions (Gmail, Facebook, etc. work this way)
- Losing all devices on single logout is bad UX
- Users can explicitly choose "log out everywhere" if needed

## Testing Verification

### 12. docs/brain/ingests/pack.lesson-schedule-debug.md (962db15602c7a56e119fa6521f0d391b7908264c0bf5f9173aac4b49ca9433c4)
- bm25: -16.4415 | relevance: 1.0000

**API:**
- `GET /api/portfolio-scans/load?learnerId=...&lessonKey=...&kind=worksheet|test|other`
- `POST /api/portfolio-scans/upload` (multipart form-data: `learnerId`, `lessonKey`, `kind`, `files[]`)
- `POST /api/portfolio-scans/delete` (JSON body: `{ learnerId, path }`)

**Auth + ownership rule:**
- All endpoints require `Authorization: Bearer <access_token>`.
- Endpoints fail closed if the learner is not owned by the authenticated facilitator.

### Backfilling Calendar Schedule From Completion History

If you have existing recorded completions but no corresponding `lesson_schedule` rows (so the Calendar looks empty historically), use the backfill script to insert schedule rows for each completed lesson.

**Script:** `scripts/backfill-schedule-from-history.mjs`

**Default source of truth:**
- Uses `lesson_session_events` rows where `event_type = 'completed'`.
- (Legacy) `--source lesson_history` is supported by the script, but the `lesson_history` table may not exist in the current schema; expect it to fail unless you have that table.

**Performance rule (important):**
- When `--learner` is provided, the script queries ONLY those learner rows (case-insensitive exact match) instead of paging every learner.
- This keeps targeted backfills fast (e.g., `--learner Emma,Test`).

### 8. src/app/facilitator/generator/counselor/MentorInterceptor.js (d04d8e10d99dc3007332e68d4a8a38dae8060ca1740d776346d1ecf832122424)
- bm25: -22.4946 | relevance: 1.0000

### 13. docs/brain/calendar-lesson-planning.md (9deb51ba2dd90ddaeee2ec696cc923087de9a8728187af5d9b6f9c4fb5277d7d)
- bm25: -16.2543 | relevance: 1.0000

This is separate from Visual Aids:
- **Visual Aids** are lesson-level aids (generated or curated) used during instruction.
- **Portfolio scans** are learner work artifacts (uploaded images/PDFs).

**Storage:**
- Bucket: `transcripts`
- Path prefix:
  - `v1/<facilitatorUserId>/<learnerId>/<lessonKey>/portfolio-scans/<kind>/...`
- `kind` is one of: `worksheet`, `test`, `other`

**API:**
- `GET /api/portfolio-scans/load?learnerId=...&lessonKey=...&kind=worksheet|test|other`
- `POST /api/portfolio-scans/upload` (multipart form-data: `learnerId`, `lessonKey`, `kind`, `files[]`)
- `POST /api/portfolio-scans/delete` (JSON body: `{ learnerId, path }`)

**Auth + ownership rule:**
- All endpoints require `Authorization: Bearer <access_token>`.
- Endpoints fail closed if the learner is not owned by the authenticated facilitator.

### Backfilling Calendar Schedule From Completion History

If you have existing recorded completions but no corresponding `lesson_schedule` rows (so the Calendar looks empty historically), use the backfill script to insert schedule rows for each completed lesson.

**Script:** `scripts/backfill-schedule-from-history.mjs`

**Default source of truth:**
- Uses `lesson_session_events` rows where `event_type = 'completed'`.
- (Legacy) `--source lesson_history` is supported by the script, but the `lesson_history` table may not exist in the current schema; expect it to fail unless you have that table.

**Performance rule (important):**
- When `--learner` is provided, the script queries ONLY those learner rows (case-insensitive exact match) instead of paging every learner.
- This keeps targeted backfills fast (e.g., `--learner Emma,Test`).

### 14. docs/brain/mr-mentor-sessions.md (95c5d8ee89bec161e1389e1a584071b192c328c10af6d2e17e78baee9f204279)
- bm25: -15.6031 | relevance: 1.0000

- If the facilitator does not have the `mentorSessions` entitlement, the Mr. Mentor surface is still viewable, but the client must not initialize or persist a `mentor_sessions` row (no POST/PATCH/DELETE to `/api/mentor-session`).
- When entitled, the normal session lifecycle below applies.

### 15. docs/brain/gating-system.md (cb1248e270a257df23ad524e2c2b63707ede02617183dccb7aecf99c85524a2b)
- bm25: -15.4201 | relevance: 1.0000

- For in-session buttons (e.g., Games / Visual Aids), keep the UI visible and block only the action with a short, in-context notice.
- For the Facilitator Calendar, do not use a tier overlay that blocks scrolling/clicking. Keep the page viewable and gate only write actions (view-only banner + guarded handlers).
- For Mr. Mentor, keep the page viewable when signed in (no full-screen lock overlay). Load read-only context (e.g., learners, transcripts, notes) without requiring the paid entitlement.
- For Mr. Mentor, gate write paths behind entitlements: sending messages, session initialization/persistence, and any mutations triggered from the Mr. Mentor surface.
- Server routes must enforce the same entitlements (UI gating is not sufficient).

### 16. src/app/facilitator/generator/page.js (26b99101059420161110d2299108b071f452f3bc92ef1dc2ea6d4e144241e672)
- bm25: -15.2302 | relevance: 1.0000

async function handleGenerate(e){
    e.preventDefault()
     if (!ent.lessonGenerator) {
       setMessage('Upgrade required to generate lessons.')
       return
     }
    
    // Check quota before generating
    if (quotaInfo && !quotaInfo.allowed) {
      setMessage('Generation limit reached. Upgrade to increase your quota.')
      return
    }
    
    setBusy(true); setMessage(''); setToast(null)
    setGeneratedLessonKey(null) // Reset previous lesson
    let generatedFile = null
    let generatedUserId = null
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      // STEP 1: Generate the lesson
      setToast({ message: 'Generating lesson...', type: 'info' })
      const res = await fetch('/api/facilitator/lessons/generate', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
        body: JSON.stringify(form)
      })
      const js = await res.json().catch(()=>null)
      if (!res.ok) { 
        setMessage(js?.error || 'Failed to generate')
        setToast({ message: 'Generation failed', type: 'error' })
        return
      }

### 17. docs/brain/ingests/pack.md (2a2474c33e1886efce4e1ae36e6b3481cdfa631f2676d805eaab189c70153402)
- bm25: -14.1268 | relevance: 1.0000

// Incomplete lessons
        const incomplete = (history.sessions || [])
          .filter(s => s.status === 'incomplete')
          .map(s => ({
            name: s.lesson_id,
            date: s.started_at,
            status: 'incomplete'
          }))

lessonContext = [...completed, ...incomplete]
      }

### 20. docs/brain/gating-system.md (cb1248e270a257df23ad524e2c2b63707ede02617183dccb7aecf99c85524a2b)
- bm25: -20.4275 | relevance: 1.0000

- For in-session buttons (e.g., Games / Visual Aids), keep the UI visible and block only the action with a short, in-context notice.
- For the Facilitator Calendar, do not use a tier overlay that blocks scrolling/clicking. Keep the page viewable and gate only write actions (view-only banner + guarded handlers).
- For Mr. Mentor, keep the page viewable when signed in (no full-screen lock overlay). Load read-only context (e.g., learners, transcripts, notes) without requiring the paid entitlement.
- For Mr. Mentor, gate write paths behind entitlements: sending messages, session initialization/persistence, and any mutations triggered from the Mr. Mentor surface.
- Server routes must enforce the same entitlements (UI gating is not sufficient).

### 21. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -20.0228 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

### 18. docs/brain/ingests/pack.md (90a382c3781f765190781869790ccf18304821e4a8a147aac0b1f34bf9033e76)
- bm25: -14.0968 | relevance: 1.0000

- **Gating**:
  - Downloadable lessons that are not owned show exactly one action: **Download**.
  - After Download succeeds, the owned copy exists and the regular lesson controls appear (Edit, per-learner availability, notes, schedule).

### Prefetch Behavior

- On page mount, the client prefetches built-in lesson lists immediately (no auth required) and loads subjects in parallel.
- Owned lessons are then fetched after auth/session is available and merged into the list.
- This keeps the UI responsive so clicking "Load Lessons" feels instant even if auth is slow.

### Data/Key Rules

### 25. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -19.5330 | relevance: 1.0000

const allSubjects = [...CORE_SUBJECTS, ...customSubjects.map(s => s.name)]

### 19. docs/brain/visual-aids.md (e74548a799c6f7cdab336a065fe8d5a3087f363944e68c43818c93ba0d168f71)
- bm25: -13.6765 | relevance: 1.0000

**Important**:
- DALL-E URLs expire; the system persists images to Supabase Storage to make them permanent.
- Generated images may be persisted (as permanent URLs) so facilitators can leave and return without losing them.
- Session display still uses `selected_images`.

- **Storage Bucket**: `visual-aids`
  - Supabase storage for permanent image files
  - Public read access
  - Facilitator write access via RLS

### Documentation
- **`docs/VISUAL_AIDS_IMPLEMENTATION.md`** - Original implementation notes (may contain outdated details)

## Why This Matters

Visual aids significantly improve engagement and comprehension for visual learners, especially in subjects like science and social studies. The no-text constraint is critical because:

1. **Usability**: Images with gibberish text are worse than no images at all
2. **Trust**: Facilitators must trust that generated images will be classroom-appropriate
3. **Efficiency**: Re-generating images due to text gibberish wastes API quota and time

By enforcing visual-only content through layered prompt engineering, the system produces reliably useful educational illustrations that enhance lessons without the cognitive load of trying to decipher illegible text.

### 20. docs/brain/lesson-quota.md (4927576fd06b03d5537c24ee9b97d2464692ace34ad20cce0d5a8f83555e3f9c)
- bm25: -13.0389 | relevance: 1.0000

# Lesson Quota (Daily Unique Lessons)

## How It Works

Server-side enforcement for daily unique lesson starts using Supabase. Revisiting the same lesson on the same day does NOT increase the count. The day boundary is computed using the user's IANA time zone.

### Schema

Table: `lesson_unique_starts`

Columns:
- `user_id` (uuid, not null)
- `day` (date, not null)
- `lesson_key` (text, not null)
- Primary key: (user_id, day, lesson_key)

RLS enabled with policy "user can read own" using auth.uid() = user_id.

### API Endpoints

**GET /api/lessons/quota?tz=America/New_York**
- Returns: `{ plan_tier, count, limit, remaining }`
- Shows current day's quota usage

**POST /api/lessons/quota**
- Body: `{ lesson_key: string, timezone?: string }`
- Records unique start if not present
- Returns: `{ plan_tier, count, limit }`
- Returns 429 if adding would exceed daily limit

### Client Usage

**Lesson Maker (Generator UI)**
- Uses **GET /api/lessons/quota** to display today's remaining count in the Lesson Maker page.

**On Begin Click**
- Call POST with `{ lesson_key, timezone }` before navigating
- If 429, show message and do not navigate
- Client keeps local set of unique lesson_keys per day for snappy feedback
- Server remains source of truth

### Quota Limits by Tier

Limits are driven by `featuresForTier(effectiveTier).lessonsPerDay` (see `src/app/lib/entitlements.js`).

Current intent:
- `free`: 1 per day
- `trial`: 1 per day (separate lifetime generation quota enforced elsewhere)
- `standard`: unlimited (`Infinity`)
- `pro`: unlimited (`Infinity`)
- `lifetime`: unlimited (`Infinity`)

Note: Trial's **5 lifetime lesson generations** is enforced by usage/quota routes using `lifetimeGenerations`, not by this daily unique-start table.

### Notes

### 21. src/app/facilitator/account/page.js (effdfff11e825a9eadf541b68090219a19d4b2a78dda5b463ac44adad0ef5fb1)
- bm25: -13.0281 | relevance: 1.0000

{/* Facilitator PIN */}
            <div
              onClick={() => setActiveOverlay('pin')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>📌</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginBottom: 2 }}>Facilitator PIN</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Protect sensitive actions</div>
              </div>
            </div>

{/* Connected Accounts */}
            <div
              onClick={() => setActiveOverlay('accounts')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>🔗</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginBottom: 2 }}>Connected Accounts</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Link Google and other services</div>
              </div>
            </div>

### 22. docs/brain/account-provisioning.md (47da22602f3389633ba6dddba4339d7e7cd957c89f47fbea9033fe52e1b8249e)
- bm25: -12.6680 | relevance: 1.0000

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

### 23. docs/brain/gating-system.md (00574f7148c6afa8fe392d80292f05984395748613c276f80283ede759c06fe2)
- bm25: -12.6667 | relevance: 1.0000

{/* Overlay */}
      <GatedOverlay
        show={!hasAccess}
        gateType={gateType}
        feature="Feature Name"
        emoji="🎓"
        description="Paid feature description"
        benefits={[
          'Feature benefit 1',
          'Feature benefit 2'
        ]}
        currentTier={tier}
        requiredTier="standard"
      />
    </>
  )
}
```

## Related Brain Files

- **[beta-program.md](beta-program.md)** - Universal gates enforce beta tier restrictions
- **[device-leases.md](device-leases.md)** - GatedOverlay wraps device lease enforcement
- **[lesson-quota.md](lesson-quota.md)** - GatedOverlay wraps lesson quota enforcement

## Key Files

- `src/app/components/GatedOverlay.jsx` - Overlay component
- `src/app/hooks/useAccessControl.js` - Access control hook
- `src/app/lib/entitlements.js` - Feature entitlements by tier

## What NOT To Do

- Never hide page content when showing overlay (always render for preview)
- Never allow functionality without access check (server-side validation required)
- Never skip loading state (prevents flash of wrong UI)
- Never hardcode tier requirements (use entitlements config)
- Never forget to pass currentTier and requiredTier for tier gates

## Notes

### 24. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (100c40cc6f2074add4795d1b163053dd8aeab8e2dea45414d04ebc543ac20d98)
- bm25: -12.6661 | relevance: 1.0000

### ✅ DO: Load planned lessons on page mount and learner change
**Why**: User switching between learners or returning to page needs to see their saved plans instantly.

### ✅ DO: Handle API failures gracefully with defaults
**Why**: External data should enhance generation, not block it. Default to empty arrays/objects when APIs fail.

### ✅ DO: Use date-specific overwrite for POST saves
**Why**: Allows multiple non-overlapping plans to coexist. Only deletes dates that are in the new plan, preserving all other dates. Enables incremental planning and gap-filling without losing unrelated lessons.

## Related Brain Files

- **[lesson-assessment-architecture.md](lesson-assessment-architecture.md)** - Planner uses medals API from assessment system

## Key Files

**Component:**
- `src/app/facilitator/calendar/page.js` (lines 220-275)
  - `loadPlannedLessons()` - fetch from database on mount/learner change
  - `savePlannedLessons(lessons)` - update state AND persist to database
  - useEffect hooks wire loading to selectedLearnerId changes

- `src/app/facilitator/calendar/LessonPlanner.jsx` (lines 215-410)
  - `generatePlannedLessons()` function - main generation logic
  - Fetches context from multiple APIs
  - Loops through weeks/days/subjects generating outlines
  - Calls `onPlannedLessonsChange(lessons)` with complete plan
  - Handles errors and updates state

### 33. src/app/facilitator/generator/counselor/MentorInterceptor.js (ad52f792b6b992c82bed565cb13b30bde0789aa2ababb37aa2fede07d9b500a7)
- bm25: -14.2031 | relevance: 1.0000

### 25. src/app/facilitator/account/page.js (4982a13ecf48ab7d34e2f1ea4e8ec9e1a9303c238b837f217549e454c9f6150a)
- bm25: -12.6298 | relevance: 1.0000

return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Connected Accounts"
    >
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Link external accounts to sign in more easily and keep your profile in sync.
          </p>

### 26. docs/brain/mr-mentor-sessions.md (0f0ef394916da8a11db2215e0273c72dba088f715c68ce104a6523679e5bfde1)
- bm25: -12.6259 | relevance: 1.0000

## API Endpoints

**`GET /api/mentor-session?sessionId={id}`** - Check session status

Response:
```json
{
  "status": "active" | "taken" | "none",
  "session": {
    "session_id": "...",
    "device_name": "...",
    "conversation_history": [...],
    "draft_summary": "...",
    "last_activity_at": "..."
  },
  "isOwner": true | false
}
```

**`POST /api/mentor-session`** - Create/takeover/force-end session

Request:
```json
{
  "sessionId": "...",
  "deviceName": "My Desktop",
  "pinCode": "1234",
  "action": "resume" | "takeover" | "force_end",
  "targetSessionId": "..." // for force_end
}
```

- **`action: 'resume'`**: Create new session (fails if another session active)
- **`action: 'takeover'`**: Deactivate other session, create new one (requires valid PIN)
- **`action: 'force_end'`**: Release frozen session without taking over (requires valid PIN)
- Automatically clears stale sessions older than `MENTOR_SESSION_TIMEOUT_MINUTES` (default: 15 minutes)

Response:
```json
{
  "session": { ... },
  "status": "active" | "taken_over" | "force_ended"
}
```

**`PATCH /api/mentor-session`** - Update conversation/draft

Request:
```json
{
  "sessionId": "...",
  "conversationHistory": [...],
  "draftSummary": "..."
}
```

Auto-debounced on client (saves 1 second after last change).

**`DELETE /api/mentor-session?sessionId={id}`** - End session

Called when user clicks "New Conversation". Deactivates session, returns `{ success: true }`.

## Client Flow

**Entitlement gating (view-only vs active session)**

### 27. docs/brain/ingests/pack.md (ba535074b2f0f77bd019d7cbc5af650b25c0a1324c4e30da69008dc9db4c053b)
- bm25: -12.5205 | relevance: 1.0000

### 30. docs/brain/custom-subjects.md (7e58ee1ca5dc34b720347edc91b697304897f6b53937497421004d738d51df62)
- bm25: -18.4045 | relevance: 1.0000

- API
  - `src/app/api/custom-subjects/route.js`
- Shared subject utilities
  - `src/app/hooks/useFacilitatorSubjects.js`
  - `src/app/lib/subjects.js`
- UI surfaces that must reflect custom subjects
  - `src/app/facilitator/calendar/LessonPicker.js` (scheduler subject filter)
  - `src/app/facilitator/lessons/page.js` (lesson library subject filter)
  - `src/components/LessonEditor.jsx` (lesson subject field)
  - `src/app/facilitator/generator/page.js` (Lesson Maker)
  - `src/app/facilitator/generator/counselor/overlays/*` (Mr. Mentor overlays)

### 31. docs/brain/mr-mentor-conversation-flows.md (8d38642aa37f8b8a7e6bd2d6e130151a77c5668c362ce9ff98a5f6a237c14f91)
- bm25: -18.2419 | relevance: 1.0000

---

## What NOT To Do

### ❌ DON'T Skip Confirmation When Intent Is Ambiguous
```
User: "I need a language arts lesson but I don't want one of the ones we have in 
       the library. It should have a Christmas theme, please make some recommendations."

WRONG: "Is this lesson for Emma's grade (4)?"
RIGHT: "Would you like me to generate a custom lesson?"
       (If they say no: "Let me search for Christmas-themed language arts lessons...")
```

### ❌ DON'T Trigger Generation on Advice-Seeking Language
```
User: "Emma has one more Language Arts lesson and then it's Christmas vacation. 
       Do you have any suggestions?"

WRONG: Start asking for grade, subject, difficulty
RIGHT: Search language arts lessons, recommend Christmas-themed options
```

### 28. docs/brain/lesson-quota.md (667668f994e6639c835e761aecd5152eb6f331cdb22b15442f025701e70ba167)
- bm25: -12.4842 | relevance: 1.0000

## Key Files

- `/api/lessons/quota` - Quota check and enforcement
- `lesson_unique_starts` table - Daily lesson tracking
- `src/app/lib/entitlements.js` - Tier limits

## What NOT To Do

- Never allow unlimited lesson starts (enforced by API)
- Never trust client-side quota counting (server is source of truth)
- Never skip timezone parameter (day boundary matters)
- Never allow quota bypass without tier check
- Never delete lesson_unique_starts records (historical data)

### 29. docs/brain/ms-sonoma-teaching-system.md (6a2edee4e3cfc75ce3af218db8d3ad5077d743885a3415aa675b5984f9edc421)
- bm25: -12.3215 | relevance: 1.0000

**Allowed Phases**:

1. **Opening** (V2: greeting only, no activities)
   - **V1**: Greeting with child's exact name and lesson title (1-2 sentences) + encouragement + joke + silly question
   - **V2**: Greeting with child's exact name and lesson title (1-2 sentences) only. No joke, no silly question. "Begin" button advances to teaching immediately.
   - **Rationale**: V2 removes opening actions from discussion phase to eliminate play timer exploit. Opening actions (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games) moved to play time in phases 2-5.

2. **Teaching Definitions** (first stage)
   - One short kid-friendly definition per vocab term (one sentence each)
   - End with [VERBATIM]: "Do you have any questions? You could ask questions like..." + 2-3 example questions

3. **Teaching Examples** (second stage)
   - Inputs: the examples prompt receives the full lesson JSON (including all generated questions used for assessment)
   - Goal: reverse-engineer the assessment questions back into the teaching examples
   - Coverage requirement (CRITICAL): examples must teach all knowledge needed to answer every lesson question (comprehension, exercise, worksheet, test), even when multiple questions overlap
   - Output shape: 2-3 tiny worked examples by default; may use up to 5 tiny examples when needed to cover all question content
   - End with [VERBATIM]: "Do you have any questions? You could ask questions like..." + 2-3 example questions

4. **Repeat** (when Repeat Vocab clicked)
   - Shorter recap of current stage
   - End with [VERBATIM]: "Do you have any questions? You could ask questions like..." + 2-3 example questions

5. **Transition to Comprehension** (when Next clicked after examples)
   - [VERBATIM]: "Great. Let's move on to comprehension."

### 30. docs/brain/facilitator-help-system.md (e7aac353101308d57f1fd60b5f3f803d31343881ecc59bd6858d0e1652ecc798)
- bm25: -12.2663 | relevance: 1.0000

### Expansion Points
- Account settings pages (PIN setup, 2FA, preferences)
- Mr. Mentor page (natural language commands)
- Hotkeys configuration
- Learner transcript analysis

### Maintenance
- Review help content quarterly against beta feedback
- Update when workflows change (e.g., new planner features)
- Remove help for features that become self-evident after redesign
- Keep help content in sync with actual UI behavior (no drift)

---

## Related Brain Files

- **calendar-lesson-planning.md** - Automated planning backend logic (planner workflow backend)
- **timer-system.md** - Phase timer mechanics (what timers control in lessons)
- **pin-protection.md** - Facilitator section gating (why PIN checks appear)
- **beta-program.md** - Tutorial system (complementary to help system)

### 31. docs/brain/mr-mentor-conversation-flows.md (b092cfb0641074435856e69633799ea1e14b0c7b1d03a8076be2d125e178142e)
- bm25: -12.2094 | relevance: 1.0000

#### Layer 1: Confirmation Before Parameter Collection (Primary Defense)
When intent is ambiguous, Mr. Mentor should ASK before starting parameter collection:

**Question:** "Would you like me to generate a custom lesson?"

**Only proceed with generation if user confirms:**
- "yes, generate"
- "create one"
- "make a lesson"
- Clear affirmative for generation

**Switch to search/recommend if user says:**
- "no"
- "search"
- "recommend"
- "I'm not sure"
- "show me what you have"
- Anything other than clear generation confirmation

**Why This Works:** Prevents awkward parameter collection when user just wanted recommendations. Gives user explicit choice before committing to generation flow.

#### Layer 2: Escape During Parameter Collection (Backup Defense)

**           |
             v
           Call generate_lesson function
```

---

### Escape Hatch Mechanism

**Problem:** Once parameter collection begins, GPT-4o function calling wants to complete required parameters before executing function. This creates a "locked in" experience where user can't back out.

**Solution:** Explicit escape instructions in system prompt:

```
If user says during parameter collection:
- "stop"
- "no"
- "I don't want to generate"
- "give me advice instead"
- "I don't want you to generate the lesson"
Skip Confirmation When Intent Is Ambiguous
```
User: "I need a language arts lesson but I don't want one of the ones we have in 
       the library. It should have a Christmas theme, please make some recommendations."

WRONG: "Is this lesson for Emma's grade (4)?"
RIGHT: "Would you like me to generate a custom lesson?"
       (If they say no: "Let me search for Christmas-themed language arts lessons...")
```

### 32. docs/brain/ingests/pack.lesson-schedule-debug.md (c655645d4b4fb88fc1cb2306a3aac4d735367a19dda03999f28fc4679ced66a5)
- bm25: -12.2060 | relevance: 1.0000

**Response**:
- Returns `{ outline: { kind, title, description, subject, grade, difficulty } }`
- `kind` is `new` or `review`
- When `kind=review`, the title is prefixed with `Review:` for clarity

### `/api/generate-lesson`
**Purpose**: Generate new lesson content via LLM  
**Status**: Legacy route, may be superseded by facilitator lesson editor

### `/api/tts`
**Purpose**: Text-to-speech conversion (Google TTS)  
**Status**: Operational, used for all Ms. Sonoma audio

### `/api/visual-aids/generate`
**Purpose**: Generate visual aid images via DALL-E 3  
**Status**: Operational, see `docs/brain/visual-aids.md`

### 14. docs/brain/calendar-lesson-planning.md (9173fe378f56c3786b75c00e9b12c63312fc70bdcd188229f8dd2f7466567dc9)
- bm25: -21.3579 | relevance: 1.0000

**What it checks:**
- `lesson_schedule` rows in a date window
- matching `lesson_session_events(event_type='completed')` rows for those scheduled lessons
- `learner_medals` rows for those lessons

### 15. docs/brain/calendar-lesson-planning.md (ca128987408f6009b4bc0b991a9c397f7bb90b4e589d5d04580e78c782af275e)
- bm25: -21.2091 | relevance: 1.0000

## What NOT To Do

### ❌ DON'T: Break JSX tags during gating edits
**Why**: A malformed JSX tag (for example, accidentally deleting a `<select` opening tag while moving click-guards) will compile in dev only until the file is imported, then fail the production build with parser errors like "Unexpected token" near a bare `>`.

**Rule**:
- Only add access guards on interactive handlers (e.g., `onClick`, submit handlers), or in the called function (e.g., `generatePlannedLessons()` already calls `requirePlannerAccess()`).
- Do not splice guard blocks into JSX without confirming the opening tag still exists.

### 33. docs/brain/calendar-lesson-planning.md (8471470a735a79332c0085400ffaf63cf33c55dc69d22a40bbf8280784aabc7b)
- bm25: -12.0557 | relevance: 1.0000

**Score-aware repeat policy (important):**
- The planner should prefer new topics, but it is allowed to repeat a concept as a **Review** when prior scores are low.
- Low-score completed lessons are eligible for review; high-score lessons should generally not be repeated soon.
- Review lessons must be rephrased (new framing/examples) and the title should start with `Review:`.
- Outlines may include `kind: "review" | "new"`, and review outlines are title-prefixed for visibility.

### 34. docs/brain/lesson-validation.md (8a41364210721171ac7306268990ee121dc1621c126a9fb8aaf6768032fe7dae)
- bm25: -11.8092 | relevance: 1.0000

# Lesson Validation

## How It Works

Automatically validates generated lessons and improves quality using a two-call approach that stays within Vercel's 60-second timeout limit. User sees progress via toast notifications, and quality issues are fixed transparently before lesson is finalized.

**Flow:**
```
User: "Generate Lesson"
  ↓
Toast: "Generating lesson..." 
  ↓
API Call 1: /api/facilitator/lessons/generate (30-60s)
  ↓
Toast: "Validating lesson quality..."
  ↓
Frontend Validation: lessonValidation.js checks quality (<1s)
  ↓
IF issues found:
  Toast: "Improving lesson quality..."
  ↓
  API Call 2: /api/facilitator/lessons/request-changes (30-60s)
  ↓
Toast: "Lesson ready!" ✓
```

**Purpose**: Ensures high-quality lessons without timeout errors. More acceptable answers = more lenient grading = better student experience. Each call stays under 60s, user sees transparent progress.

## Validation Rules

**Critical Issues (blocks until fixed):**
1. **Short Answer questions**: Must have 3+ acceptable answers each
2. **Fill-in-the-Blank questions**: Must have 3+ acceptable answers each
3. **True/False questions**: Must have complete question text
4. **Multiple Choice questions**: Must have exactly 4 choices
5. **Question counts**: Each type needs 10+ questions

**Warnings (logged but doesn't retry):**
- Missing or insufficient vocabulary (< 5 terms)
- Brief teaching notes (< 50 characters)
- No sample questions

**Change request format** (sent to API if issues found):
```
"Please improve this lesson by fixing the following quality issues:
- Question 3 has only 1 acceptable answer. Add 2 more plausible variations.
- Question 7 is missing question text for true/false.
...
Return the full, improved lesson JSON."
```

## Integration Points

### 35. src/app/facilitator/account/page.js (6dbfd959da380f72dc1b799cb3a4bc9f02cc888dd1edf136582920a5ebb0b5b8)
- bm25: -11.6449 | relevance: 1.0000

<PasswordOverlay
        isOpen={activeOverlay === 'password'}
        onClose={() => setActiveOverlay(null)}
        email={email}
      />

<TwoFactorOverlay
        isOpen={activeOverlay === '2fa'}
        onClose={() => setActiveOverlay(null)}
      />

<PinOverlay
        isOpen={activeOverlay === 'pin'}
        onClose={() => setActiveOverlay(null)}
        email={email}
      />

<ConnectedAccountsOverlay
        isOpen={activeOverlay === 'accounts'}
        onClose={() => setActiveOverlay(null)}
      />

<HotkeysOverlay
        isOpen={activeOverlay === 'hotkeys'}
        onClose={() => setActiveOverlay(null)}
      />

<TimezoneOverlay
        isOpen={activeOverlay === 'timezone'}
        onClose={() => setActiveOverlay(null)}
      />

<MarketingOverlay
        isOpen={activeOverlay === 'marketing'}
        onClose={() => setActiveOverlay(null)}
      />

<PoliciesOverlay
        isOpen={activeOverlay === 'policies'}
        onClose={() => setActiveOverlay(null)}
      />

<PlanOverlay
        isOpen={activeOverlay === 'plan'}
        onClose={() => setActiveOverlay(null)}
      />

<DangerZoneOverlay
        isOpen={activeOverlay === 'danger'}
        onClose={() => setActiveOverlay(null)}
      />
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType={gateType}
      feature="Account Management"
      emoji="👤"
      description="Sign in to manage your account settings, security preferences, and connected services."
      benefits={[
        'Manage your profile and display name',
        'Set up two-factor authentication',
        'Configure PIN protection for sensitive actions',
        'Link and manage connected accounts (Google, etc.)'
      ]}
    />
    </>
  )
}

### 36. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (927a36610f2e66911e7ea826ffa802962a757c0ec7b545a69c3fcf9244a1445d)
- bm25: -11.6021 | relevance: 1.0000

**2025-12-15**: Added database persistence for planned lessons
- Created `planned_lessons` table with JSONB lesson_data column
- Created `/api/planned-lessons` route (GET/POST/DELETE)
- Modified calendar page to load planned lessons on mount/learner change
- Added `savePlannedLessons()` that updates state AND persists to database
- Wired `savePlannedLessons` as callback to LessonPlanner
- Planned lessons now survive refresh, long absence, logout/login
- Tied to specific facilitator + learner combination via foreign keys

**2025-12-14**: Fixed medals API 404 causing generation failure
- Changed endpoint from `/api/learner/medals` to `/api/medals`
- Decoupled medals loading from history processing
- Added fallback to empty medals object when API fails
- Generation now succeeds even without medal data

**2025-12-14**: Fixed scheduled lessons API response structure
- API returns `{schedule: [...]}` not raw array
- Changed code to access `scheduledData.schedule` property
- Prevents ".map is not a function" error during context building

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (b6e6ebc1dbed05c56ca851c80bcd9e000659d12c23c8c859a044e2daec8d0991)
- bm25: -15.7328 | relevance: 1.0000

### 37. docs/brain/beta-program.md (cae6df5d6046a2f57313f44becea8e960b732d9849e6bb3963232d991ff6fd57)
- bm25: -11.5924 | relevance: 1.0000

### Never Block Non-Beta Users
- Tutorials are optional for non-Beta users
- Gates apply only when `subscription_tier == 'Beta'`

### Never Mix Tutorial State with Ms. Sonoma Payload
- Tutorial completion tracking is server-side only
- Ms. Sonoma remains unaware of Beta program
- No mentions of tutorials, surveys, or Beta in child-facing content

## Related Brain Files

- **[facilitator-help-system.md](facilitator-help-system.md)** - Beta tier gates facilitator tutorial
- **[lesson-quota.md](lesson-quota.md)** - Beta tier affects daily lesson quotas
- **[device-leases.md](device-leases.md)** - Beta tier sets concurrent device limits

## Key Files

### Route Guards
- Server actions for tutorial and survey gating (to be implemented)
- Page loaders for facilitator and learner routes (to be implemented)

### Database Schema
- Migration files for new tables: `learner_tutorial_progress`, `lesson_sessions`, `facilitator_notes`, `repeat_events`, `post_lesson_surveys`
- Existing tables: `profiles`, `transcripts` (extended)

### Feature Flags
- Environment variables: `FORCE_TUTORIALS_FOR_BETA`, `SURVEY_GOLDEN_KEY_ENABLED`, `TUTORIALS_AVAILABLE_FOR_ALL`

### Authentication
- Supabase auth utilities for password re-auth flow

## Notes

- Beta program is completely separate from Ms. Sonoma teaching system
- Tutorial completion and survey gates are server-enforced
- Event instrumentation provides analytics for Beta evaluation
- Feature flags allow graceful uninstall without data loss
- Cross-references with snapshot-persistence.md for session state continuity

### 38. docs/brain/lesson-library-downloads.md (b1b9e213db751b5765dbf2e696989c3293e61bd99e1db9d560a4332ae5c3532e)
- bm25: -11.5864 | relevance: 1.0000

# Lesson Library Downloads (Owned vs Downloadable)

**Status:** Canonical
**Created:** 2026-01-10
**Purpose:** Define how facilitator-visible "download" works without any device storage.

## How It Works

### Concepts

- **Downloadable lesson**: A built-in lesson JSON that exists on the server under `public/lessons/<subject>/...`.
- **Owned lesson**: A facilitator-specific copy of a lesson stored in Supabase Storage under `lessons/facilitator-lessons/<facilitatorId>/<file>.json`.
- **Download action**: Server-side copy from the built-in library into the facilitator's Storage folder (not a device download).

### UX Rules (Facilitator Lessons Page)

- Top-of-page actions:
  - **📝 New Lesson** opens the lesson editor with a blank lesson (no Storage write until the user saves).
  - **✨ Generate Lesson** opens the Lesson Maker flow (`/facilitator/generator`).

- A dropdown filter controls which lessons are shown:
  - **Owned** (default): show only owned lessons (Storage-backed).
  - **Downloadable**: show only downloadable lessons that are not owned.
  - **All Lessons**: show both.

- **Gating**:
  - Downloadable lessons that are not owned show exactly one action: **Download**.
  - After Download succeeds, the owned copy exists and the regular lesson controls appear (Edit, per-learner availability, notes, schedule).

### Prefetch Behavior

- On page mount, the client prefetches built-in lesson lists immediately (no auth required) and loads subjects in parallel.
- Owned lessons are then fetched after auth/session is available and merged into the list.
- This keeps the UI responsive so clicking "Load Lessons" feels instant even if auth is slow.

### Data/Key Rules

### 39. docs/brain/calendar-lesson-planning.md (1c551999eb292e7d45b7c6306ea7223b5fc642288558019cf5b0b429daccc9cf)
- bm25: -11.5307 | relevance: 1.0000

### ✅ DO: Save planned lessons to database immediately after generation
**Why**: Persistence must be automatic and immediate. User expects generated plan to "just work" across sessions.

### ✅ DO: Load planned lessons on page mount and learner change
**Why**: User switching between learners or returning to page needs to see their saved plans instantly.

### ✅ DO: Handle API failures gracefully with defaults
**Why**: External data should enhance generation, not block it. Default to empty arrays/objects when APIs fail.

### ✅ DO: Use date-specific overwrite for POST saves
**Why**: Allows multiple non-overlapping plans to coexist. Only deletes dates that are in the new plan, preserving all other dates. Enables incremental planning and gap-filling without losing unrelated lessons.

## Related Brain Files

- **[lesson-assessment-architecture.md](lesson-assessment-architecture.md)** - Planner uses medals API from assessment system

## Key Files

**Component:**
- `src/app/facilitator/calendar/page.js` (lines 220-275)
  - `loadPlannedLessons()` - fetch from database on mount/learner change
  - `savePlannedLessons(lessons)` - update state AND persist to database
  - useEffect hooks wire loading to selectedLearnerId changes

- `src/app/facilitator/calendar/LessonPlanner.jsx` (lines 215-410)
  - `generatePlannedLessons()` function - main generation logic
  - Fetches context from multiple APIs
  - Loops through weeks/days/subjects generating outlines
  - Calls `onPlannedLessonsChange(lessons)` with complete plan
  - Handles errors and updates state

### 40. docs/brain/tts-prefetching.md (072d1470417a91efeda996cf6ff4ab16a94be413be6e572d439f2f0f73e61aeb)
- bm25: -11.5272 | relevance: 1.0000

prefetch(text) {
  const controller = new AbortController();
  this.pendingFetches.set(text, controller);
  
  fetch('/api/tts', { signal: controller.signal, ... })
    .then(...)
    .catch(err => {
      if (err.name === 'AbortError') return; // Silent - expected
      // Other errors also silent - prefetch is non-critical
    })
    .finally(() => this.pendingFetches.delete(text));
}

clear() {
  this.pendingFetches.forEach(controller => controller.abort());
  this.pendingFetches.clear();
  this.cache.clear();
}
```

Ensures no memory leaks from abandoned prefetch requests.

### Text Normalization

```javascript
normalizeText(text) {
  return text.toLowerCase().trim();
}
```

Cache keys are normalized so "What is 2+2?" and "what is 2+2? " hit same entry.

### Audio Extraction

```javascript
extractAudio(data) {
  if (!data) return null;
  
  // API can return audio in multiple formats:
  // { audio, audioBase64, audioContent, content, b64 }
  return data.audio || data.audioBase64 || data.audioContent || 
         data.content || data.b64 || null;
}
```

Handles various TTS API response formats.

## What NOT To Do

**DON'T prefetch without abort capability**
- Memory leaks from abandoned requests
- Network congestion from redundant fetches
- Phase transitions leave orphaned requests

**DON'T fail loudly on prefetch errors**
- Prefetch is optimization only
- User should never see prefetch failures
- Core flow must work without cache

**DON'NOT show loading indicator on cache hits**
```javascript
// WRONG - shows loading even for instant cache hits
setTtsLoadingCount((c) => c + 1);
let b64 = ttsCache.get(text);
if (!b64) { /* fetch */ }
setTtsLoadingCount((c) => c - 1);
