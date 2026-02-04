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

- `lesson_key` should be stable per-lesson identifier (JSON filename from `/public/lessons/...`)
- If timezone omitted, UTC is used on server
- Daily boundary computed using user's IANA time zone

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
