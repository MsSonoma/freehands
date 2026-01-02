# Dev Server and Chunk 404s

## How It Works

Next.js serves JavaScript bundles under `/_next/static/chunks/*`.

In dev (`next dev`), these chunks are produced on-demand as routes compile. In practice, if the dev server is holding stale build artifacts (or artifacts have been overwritten by a production build), the HTML can reference chunk filenames that are not present, which shows up as:

- 404s for `/_next/static/chunks/main-app.js`, `app-pages-internals.js`, `app/layout.js`, etc.
- Follow-on runtime errors like `Cannot read properties of undefined (reading 'call')`.

To reduce collisions between dev and prod artifacts, this repo separates build output directories:

- Dev uses `.next-dev`
- Production build/start uses `.next`

This is configured via `distDir` in `next.config.mjs`:

- `NODE_ENV !== 'production'` -> `.next-dev`
- `NODE_ENV === 'production'` -> `.next`

## What NOT To Do

- Do not assume “the app is down” just because `/session/v2test` renders HTML but chunks 404. That state is almost always a chunk/artifact mismatch.
- Do not rely on `next build` and `next dev` sharing the same `.next` directory; it can lead to chunk 404s after rebuilds.
- Do not chase React/component bugs until chunk URLs return 200; chunk 404s mean the JS bundle never loaded.

## Recovery Checklist

When you see chunk 404s:

1. Kill the dev server (port 3001).
2. Clean build output directories (`.next`, `.next-dev`, `.turbo`).
3. Restart dev on 3001.
4. Confirm `/_next/static/chunks/webpack.js` and `/_next/static/chunks/main-app.js` return 200.

## Key Files

- `next.config.mjs` (sets `distDir` to split dev/prod)
- `.vscode/tasks.json` (Kill/Restart/Clean tasks)
- `package.json` (dev script runs `next dev -p 3001`)
