# Sound Effects (SFX)

**Last updated**: 2026-01-22T20:43:54Z  
**Status**: Active development

## How It Works

### Storage

Sound effect assets live in `public/sfx/` and are referenced by URL at runtime:
- `/sfx/click.mp3`
- `/sfx/success.mp3`
- `/sfx/error.mp3`

This keeps SFX simple (no bundling/importing binary assets) and works in both dev and production.

### Playback

SFX playback uses Howler for reliability (overlap, preloading, consistent volume handling) via a client-safe wrapper:
- `playSfx(nameOrUrl, { volume, rate, loop, muted })`
- `preloadSfx([nameOrUrl, ...], { volume, rate, loop })`

Implementation notes:
- The helper lazy-loads `howler` via dynamic import, which avoids SSR/server-component issues.
- The helper caches Howl instances by `(src, volume, rate, loop)` to prevent re-creating audio objects repeatedly.
- If Howler fails to load for any reason, the helper falls back to `new Audio(src)` as a best-effort.

### Muting

SFX should respect the session mute state. Pass the caller's mute state into `playSfx(..., { muted })` so that short UI sounds never play when the session is muted.

## What NOT To Do

- Do not `import 'howler'` directly inside server code (API routes, server components). Always call the wrapper.
- Do not auto-play SFX during initial render. Mobile browsers may block playback unless it is triggered by a user gesture.
- Do not store long-form audio here (TTS or lesson narration). SFX should stay short and lightweight.

## Key Files

- `src/app/session/utils/sfx.js` (client-safe Howler wrapper)
- `public/sfx/README.md` (asset drop location and conventions)
