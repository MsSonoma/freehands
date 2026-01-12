# Platform Jumper (#platform-jumper)

## How It Works

Platform Jumper is a small in-session game rendered by a single client component.

The player moves and jumps using a simple velocity + gravity loop:

- `playerPos` holds the current position in game coordinates.
- `playerVelocity` holds the current velocity.
- Gravity (`GRAVITY`) accelerates downward each tick.
- Jumping sets an immediate upward `y` velocity.

Jump types:

- Normal jump uses `JUMP_STRENGTH` (negative y velocity).
- Trampoline jump uses `TRAMPOLINE_BOUNCE` when the current platform has `trampoline: true`.

Level layouts:

- Levels are declared in the `levels` object; keys are level numbers.
- Each level has a `platforms` array (rectangles) plus `startPos` and `goalArea`.
- Coordinates use game space: `x` increases to the right, `y` increases downward.
- Reference size: `GAME_WIDTH = 800`, `GAME_HEIGHT = 500`.
- A movement like "raise 15%" means subtract `0.15 * GAME_HEIGHT` from `y`.
- A movement like "move left 20%" means subtract `0.20 * GAME_WIDTH` from `x`.
- For beatability gaps between trampolines, prefer adding a single intermediate trampoline before changing global physics (example: Level 37 bridge).

Input:

- Keyboard: arrow keys move; Space jumps.
- Touch: left/right controls set movement; jump uses the shared `performJump` logic.

Scaling:

- The game scales to fit available viewport space using a calculated `scale` based on `GAME_WIDTH`/`GAME_HEIGHT`.

## What NOT To Do

- Do not add compatibility fallbacks for missing state; keep physics/state explicit.
- Do not change jump logic separately for touch vs keyboard; both must call the same jump function.
- Do not make trampoline behavior implicit; trampoline boost must be controlled by the `trampoline` flag on platforms.
- Avoid large physics changes (gravity, speed, jump) without validating level beatability.
- Avoid editing multiple level elements at once when fixing a single-beatability issue; move one platform, then re-check.

## Key Files

- `src/app/session/components/games/PlatformJumper.jsx`
