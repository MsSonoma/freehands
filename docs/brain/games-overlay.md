# Games Overlay (#games-overlay)

**Status**: Canonical  
**Last Updated**: 2026-01-13T00:59:23Z

## How It Works

Games are launched from the in-session **Games overlay**.

- The session pages (V1 and V2) open `GamesOverlay` during play time.
- `GamesOverlay` renders a full-screen modal experience:
  - A game picker menu (list of games)
  - A full-screen active-game view
- A play timer badge (rendered by `SessionTimer`) is optionally passed in and displayed at the top-left.

**Click parity:** If the timer badge is present, it should remain interactive (cursor + click) so the facilitator can open `TimerControlOverlay` from within the Games overlay (PIN-gated), matching the rest of the session.

### Difficulty and Grade

The Games overlay does **not** own a global difficulty setting.

- If a specific game needs grade-driven difficulty, that game should present its own grade selector (or other difficulty control) inside the game UI.
- Games may optionally initialize their own difficulty from the currently selected learner profile (when the game is launched), but that choice must remain scoped to the game.

### Props

`GamesOverlay` accepts:
- `onClose`: closes the overlay
- `playTimer`: a React node (typically `SessionTimer`) rendered as a badge

## What NOT To Do

- Do not add an overlay-wide difficulty selector unless explicitly requested.
- Do not store or persist Games settings to localStorage as a fallback.
- Do not couple Games overlay state to Ms. Sonoma prompt/state; games are independent UI.

## Key Files

- `src/app/session/components/games/GamesOverlay.jsx`
- `src/app/session/page.js` (V1 integration)
- `src/app/session/v2/SessionPageV2.jsx` (V2 integration)
