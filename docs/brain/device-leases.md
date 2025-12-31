# Device Leases (Concurrent Devices)

## How It Works

Limits the number of concurrent devices (browsers) active per user based on their plan tier.

### Schema

Table: `public.device_leases`

Columns:
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users)
- `device_id` (text)
- `acquired_at` (timestamptz)
- `expires_at` (timestamptz)
- `released_at` (timestamptz, nullable)

Indexes:
- `idx_device_leases_user_active` on (user_id) where released_at is null
- `idx_device_leases_active_time` on (expires_at) where released_at is null
- `uq_device_active_per_device` unique on (user_id, device_id) where released_at is null and expires_at > now()

### API Endpoints

**GET /api/devices/status**
- Returns: `{ plan_tier, devicesCap, active }`
- Shows current device usage and capacity

**POST /api/devices/claim**
- Body: `{ device_id, ttlSeconds? }`
- Attempts to claim a slot
- Extends lease if already active
- Returns 409 when at capacity

**POST /api/devices/release**
- Body: `{ device_id }`
- Releases active lease for device
- Frees slot immediately

All endpoints require Authorization Bearer token (Supabase session access token).

### Enforcement

Device cap based on plan_tier from profiles table:
- free: 1 device
- basic: 1 device
- plus: 1 device
- premium: 2 devices

Mapping duplicated in route files (can centralize to `src/app/lib/entitlements.js` if needed).

### Lease Management

- Leases auto-expire when `expires_at` passes
- Clients periodically POST claim to extend lease
- On logout or tab close, clients POST release to free slot sooner
- Consider background job to purge expired rows

## Key Files

- `/api/devices/status` - Check device usage
- `/api/devices/claim` - Claim or extend device slot
- `/api/devices/release` - Release device slot
- `public.device_leases` table - Lease storage

## What NOT To Do

- Never allow unlimited concurrent devices (enforced by API)
- Never skip lease expiration checks (auto-expire required)
- Never trust client-side device counting (server is source of truth)
- Never allow device claiming without auth token
