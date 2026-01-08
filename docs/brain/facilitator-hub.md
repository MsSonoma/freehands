# Facilitator Hub

## How It Works

The Facilitator hub is the main entry point for facilitator workflows at `/facilitator`.

- It shows a small grid of primary sections (cards) that route to key areas.
- It displays the current subscription tier as informational status.
- Billing is treated as part of **Account** (plan + billing lives under `/facilitator/account/*`).

## What NOT To Do

- Do not add a separate "Billing" section on the hub. Billing navigation belongs under **Account**.
- Do not duplicate billing management UIs on the hub. Use the account plan/billing pages.

## Key Files

- `src/app/facilitator/page.js` - Facilitator hub cards and subscription status display
- `src/app/facilitator/account/page.js` - Account hub (settings overlays)
- `src/app/facilitator/account/plan/page.js` - Plans & billing entry point
- `src/app/billing/manage/*` - Billing portal UI
