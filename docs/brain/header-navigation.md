# Header Navigation

## How It Works

The global header (HeaderBar) is rendered across pages and provides:

- Brand link to home
- Back button on pages that define a back chain
- Top-level navigation links (About, Learn, Facilitator)
- Session-specific print menu actions

### Facilitator Dropdown

On non-hamburger layouts, mouseovering the "Facilitator" header link opens a small dropdown menu with quick links:

- ⚙️ Account -> `/facilitator/account`
- 🔔 Notifications -> `/facilitator/notifications`
- 👥 Learners -> `/facilitator/learners`
- 📚 Lessons -> `/facilitator/lessons`
- 📅 Calendar -> `/facilitator/calendar`
- 🧠 Mr. Mentor -> `/facilitator/mr-mentor`

The dropdown uses a short hover grace period on mouseleave so it does not flicker closed while moving from the header link down into the menu.

The dropdown is intentionally compact (narrow min width) so it feels like a tooltip menu, not a panel.

When triggered from an active Session page, these links must route through the session-exit PIN gate (`goWithPin`) so leaving a session remains protected.

## What NOT To Do

- Do not navigate from `/session/*` to `/facilitator/*` without `goWithPin()`.
- Do not add billing as a top-level header link; billing lives under Account.
- Do not create multiple overlapping header overlays; keep menus mutually non-blocking.

## Key Files

- `src/app/HeaderBar.js` - Header layout, nav links, facilitator dropdown, session print menu
- `docs/brain/pin-protection.md` - PIN gating rules for session exits and facilitator routes
