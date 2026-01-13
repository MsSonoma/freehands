# Games Overlay (#games-overlay)

**Status**: Canonical  
**Last Updated**: 2026-01-13T00:51:34Z

## How It Works

Games are launched from the in-session **Games overlay**.

- The session pages (V1 and V2) open `GamesOverlay` during play time.
- `GamesOverlay` renders a full-screen modal experience:
  - A game picker menu (list of games)
  - A full-screen active-game view
- A play timer badge (rendered by `SessionTimer`) is optionally passed in and displayed at the top-left.

### Grade Level (Difficulty Source)

Games use a **grade level** selection as the single user-facing difficulty knob.

- `GamesOverlay` owns `gradeLevel` state.
- The overlay shows a grade selector on the game picker menu.
- The overlay can be initialized with `initialGrade` from the current learner profile.
- The current `gradeLevel` is passed down to each game component as `gradeLevel`.

Design intent:
- Existing games may ignore `gradeLevel` until they become grade-aware.
- New grade-aware games should map `gradeLevel` to their own internal parameters (speed, word length, time pressure, etc.).

### Props

`GamesOverlay` accepts:
- `onClose`: closes the overlay
- `playTimer`: a React node (typically `SessionTimer`) rendered as a badge
- `initialGrade`: string, used to seed `gradeLevel` (e.g., `K`, `3`, `7`)

## What NOT To Do

- Do not hardcode a silent default grade inside games when `gradeLevel` is empty.
- Do not store or persist the Games grade selector to localStorage as a fallback.
- Do not let game difficulty drift between games; grade should remain the shared knob.
- Do not couple Games overlay state to Ms. Sonoma prompt/state; games are independent UI.

## Key Files

- `src/app/session/components/games/GamesOverlay.jsx`
- `src/app/session/page.js` (V1 integration)
- `src/app/session/v2/SessionPageV2.jsx` (V2 integration)
