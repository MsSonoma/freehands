# Notifications System

**Last updated**: 2026-01-08T13:36:08Z  
**Status**: Canonical

## How It Works

The Notifications system provides facilitator-facing alerts that persist across devices.

### Data Model (Supabase)

Notifications are stored per facilitator in Supabase (Postgres) under RLS.

**Tables**:
- `public.facilitator_notifications`
  - Per-notification rows (title/body/type/category)
  - `read_at` marks a notification as read
  - `facilitator_id` is the owner and must equal `auth.uid()` under RLS

- `public.facilitator_notification_prefs`
  - Per-facilitator preferences that control which categories are enabled
  - Includes a master `enabled` toggle

### Current UI

**Notifications page**: `/facilitator/notifications`
- Shows a list of notifications
- Each row can be marked read/unread via a checkmark button
- A gear button opens a settings overlay to control notification preferences

**Account page launcher**: `/facilitator/account`
- Shows a Notifications card matching existing Account card styling
- Clicking navigates to `/facilitator/notifications`

**Header quick-link**:
- The Facilitator hover dropdown includes a Notifications item that navigates to `/facilitator/notifications`

### Placeholder Behavior

The UI currently seeds a small set of demo notifications for a facilitator if they have zero notifications. This is intentionally temporary and exists only to make the manager usable before event producers are wired.

## What NOT To Do

- Do not store notification read state or preferences in localStorage (facilitators switch devices).
- Do not bypass RLS by querying other facilitators' rows; always scope by `facilitator_id`.
- Do not silently drop write failures; surface errors to the facilitator so RLS or auth issues are diagnosable.
- Do not add realtime/push delivery until explicitly requested; the current scope is a manager UI only.

## Key Files

- `src/app/facilitator/notifications/page.js` - Notifications manager page UI
- `src/app/facilitator/account/page.js` - Account launcher card
- `src/app/HeaderBar.js` - Facilitator dropdown link
- `src/app/lib/facilitatorNotificationsClient.js` - Supabase read/write helpers
- `supabase/migrations/20260108133500_add_facilitator_notifications.sql` - Tables + RLS policies
