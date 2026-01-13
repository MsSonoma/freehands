# Flood Climb Spelling Game (#flood-climb-spelling)

**Status**: Canonical  
**Last Updated**: 2026-01-13T03:35:15Z

## How It Works

Flood Climb is a time-pressure spelling game inside the Games overlay.

- The player sees an emoji prompt (example: 🐮).
- The game also shows a scrambled-letter hint for the target word.
- The prompt is shown in-stage in the "sky" area (right of the rock wall).
- The rock wall uses a non-repeating polygon SVG texture (asymmetrical facets; no round blobs) with a flat, cool stone palette to match the climber rock.
- The rock wall uses the SVG palette directly (no CSS tint overlay).
- The SVG URL is cache-busted so palette tweaks show up immediately during dev.
- The "How to play" instructions are also shown in the sky area before Start.
- Win/lose messaging and the "Play Again" / "Next Level" actions also render in that same sky area.
- The player types the matching word (example: "cow") and submits (Enter or Submit).
- The input placeholder reads "Type your answer and press Enter."
- The standalone instruction line above the input is not shown.
- Clicking in-game buttons should not steal focus from the input during play.
- Score accumulates across levels and across runs during the session.
- Correct answers move the climber upward.
- Wrong answers cause the water level to jump upward.
- The water also rises continuously over time.
- The climber renders behind the water, so submerging looks underwater.
- The climber is slightly inset from the rock wall for visibility.
- The player loses when the water reaches the climber's head.
- The player wins by reaching the top zone before the water catches them.

### Level Progression (Game-Scoped)

Difficulty is owned by this game (not by the Games overlay).

The game uses numbered levels (Level 1 .. Level 20). Levels are not labeled.
The level selector defaults to Level 1 (no placeholder option).

The level controls:
- The word deck used for prompts (higher levels use harder-to-spell words)
- Water rise rate (higher level = faster)
- Climb amount per correct answer (higher level = smaller climb)
- Water penalty on wrong answers (higher level = bigger penalty)

Notes:
- The game includes a short start delay before the water begins rising.
- Starting positions provide a playable buffer so players are not forced to type instantly.

## What NOT To Do

- Do not add an overlay-wide difficulty selector to support this game.
- Do not persist the level selection via localStorage as a fallback.
- Do not require learner profile plumbing through `GamesOverlay` unless explicitly requested.

## Key Files

- `src/app/session/components/games/FloodClimbSpelling.jsx`
- `src/app/session/components/games/GamesOverlay.jsx`
- `public/media/flood-climb-rockwall.svg`

