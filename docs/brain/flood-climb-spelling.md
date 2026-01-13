# Flood Climb Spelling Game (#flood-climb-spelling)

**Status**: Canonical  
**Last Updated**: 2026-01-13T01:32:57Z

## How It Works

Flood Climb is a time-pressure spelling game inside the Games overlay.

- The player sees an emoji prompt (example: 🐮).
- The player types the matching word (example: "cow") and submits (Enter or Submit).
- Correct answers move the climber upward.
- Wrong answers cause the water level to jump upward.
- The water also rises continuously over time.
- The player wins by reaching the top zone before the water catches them.

### Grade-Driven Difficulty (Game-Scoped)

Difficulty is owned by this game (not by the Games overlay).

The grade level controls:
- Water rise rate (higher grade = faster)
- Climb amount per correct answer (higher grade = smaller climb)
- Water penalty on wrong answers (higher grade = bigger penalty)
- The word deck used for prompts

## What NOT To Do

- Do not add an overlay-wide difficulty selector to support this game.
- Do not persist the grade selection via localStorage as a fallback.
- Do not require learner profile grade plumbing through `GamesOverlay` unless explicitly requested.

## Key Files

- `src/app/session/components/games/FloodClimbSpelling.jsx`
- `src/app/session/components/games/GamesOverlay.jsx`
