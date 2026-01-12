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

## Key Files

- `src/app/session/components/games/PlatformJumper.jsx`
