# Learner Settings Bus

**Status**: Canonical
**Last Updated**: 2026-01-08T03:44:22Z

## How It Works

The Learner Settings Bus is a small, client-only pub/sub mechanism for propagating per-learner setting changes immediately across open pages and tabs.

It exists to support settings that must:
- Be per-learner (not global)
- React immediately without a refresh
- Avoid local persistence fallbacks that could leak across learners or accounts on a shared device

### Message Shape

Messages are plain JS objects:

- `type`: always `learner-settings-patch`
- `learnerId`: string
- `patch`: object containing the updated fields

Example:

- `{"type":"learner-settings-patch","learnerId":"<uuid>","patch":{"golden_keys_enabled":false}}`

Also used for play portion flags (phases 2-5 only):

- `{"type":"learner-settings-patch","learnerId":"<uuid>","patch":{"play_test_enabled":false}}`

### Transport

The bus uses two mechanisms:

1) `BroadcastChannel` (cross-tab)
- Channel name: `ms-learner-settings`

2) `window` event (same-tab)
- Event name: `ms:learner-settings-patch`

The broadcaster emits to both so the sender tab updates immediately and other tabs receive the patch.

### Source of Truth

The database is still the source of truth.

Flow:
1) Facilitator UI writes the change to Supabase.
2) On success, the UI broadcasts the patch via the bus.
3) Pages currently open for that learner react immediately.

### Consumers

Consumers should:
- Filter by learner id (`msg.learnerId`).
- Check for specific fields in `msg.patch`.
- Update UI state immediately.

Keep behavior strict:
- Do not create local fallback state that can diverge from Supabase.
- Treat settings as **unknown until loaded**. For example, `golden_keys_enabled` should start as `null` (unknown), then become `true`/`false` once loaded.
- Treat `play_*_enabled` the same way: required booleans loaded from Supabase (no local fallback).
- Avoid UI flashes: do not render Golden Key UI until `golden_keys_enabled === true` and the page is done loading learner settings.
- Hide per-lesson Golden Key indicators (like a "🔑 Active" badge) unless `golden_keys_enabled === true`.
- Avoid toast loss: do not clear `sessionStorage.just_earned_golden_key` while `golden_keys_enabled` is unknown; only clear/suppress once it is explicitly `false`.

### UI Integration Gotcha (LearnerEditOverlay)

The Learners page passes a cloned `learner` prop into `LearnerEditOverlay` (spread + `initialTab`). If the overlay initializes form state in a `useEffect` that depends on the whole `learner` object, the effect will run on every parent rerender and reset local state.

Impact:
- Optimistic toggles (like `golden_keys_enabled`) can appear to "flip back" immediately even when the Supabase update succeeded.

Rule:
- In `LearnerEditOverlay`, only re-initialize local form state when the overlay opens or the learner identity changes (e.g. depend on `isOpen`, `learner.id`, `learner.initialTab`), not on the entire object identity.

This bus is intentionally "dumb": it does not do retries, persistence, or reconciliation.

## What NOT To Do

- Do not store the patches in `localStorage` (this can leak across facilitator accounts on a shared device).
- Do not treat the bus as a database or long-lived state. It is only for immediate UI reaction.
- Do not broadcast before Supabase writes succeed.
- Do not rely on the bus for initial state; always load initial state from Supabase.

## Key Files

- `src/app/lib/learnerSettingsBus.js`
  - `broadcastLearnerSettingsPatch(learnerId, patch)`
  - `subscribeLearnerSettingsPatches(handler)`

- `src/app/facilitator/learners/page.js`
  - Broadcasts patches after updating learner settings.

- `src/app/learn/lessons/page.js`
  - Subscribes and hides Golden Key UI immediately when disabled.

- `src/app/session/page.js`
  - Subscribes in-session and disables Golden Key behavior/UI immediately when disabled.

- `src/app/session/v2/SessionPageV2.jsx`
  - Subscribes in-session and updates `TimerService` Golden Key gate immediately when disabled.
