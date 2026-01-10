# Lesson Library Downloads (Owned vs Downloadable)

**Status:** Canonical
**Created:** 2026-01-10
**Purpose:** Define how facilitator-visible "download" works without any device storage.

## How It Works

### Concepts

- **Downloadable lesson**: A built-in lesson JSON that exists on the server under `public/lessons/<subject>/...`.
- **Owned lesson**: A facilitator-specific copy of a lesson stored in Supabase Storage under `lessons/facilitator-lessons/<facilitatorId>/<file>.json`.
- **Download action**: Server-side copy from the built-in library into the facilitator's Storage folder (not a device download).

### UX Rules (Facilitator Lessons Page)

- Top-of-page actions:
  - **📝 New Lesson** opens the lesson editor with a blank lesson (no Storage write until the user saves).
  - **✨ Generate Lesson** opens the Lesson Maker flow (`/facilitator/generator`).

- A dropdown filter controls which lessons are shown:
  - **Owned** (default): show only owned lessons (Storage-backed).
  - **Downloadable**: show only downloadable lessons that are not owned.
  - **All Lessons**: show both.

- **Gating**:
  - Downloadable lessons that are not owned show exactly one action: **Download**.
  - After Download succeeds, the owned copy exists and the regular lesson controls appear (Edit, per-learner availability, notes, schedule).

### Prefetch Behavior

- On page mount, the client prefetches built-in lesson lists immediately (no auth required) and loads subjects in parallel.
- Owned lessons are then fetched after auth/session is available and merged into the list.
- This keeps the UI responsive so clicking "Load Lessons" feels instant even if auth is slow.

### Data/Key Rules

- Owned detection is based on a `subject/file.json` key (not filename-only) to avoid cross-subject filename collisions.
- When copying a downloadable lesson into Storage, the server ensures `lesson.subject` is present.

### API

- `POST /api/facilitator/lessons/download`
  - Auth: requires `Authorization: Bearer <access_token>`.
  - Input: `{ subject, file }`.
  - Server reads the built-in file from `public/lessons/<subjectFolder>/<file>.json`.
  - Server uploads to Supabase Storage path `facilitator-lessons/<userId>/<file>.json` with `upsert: true`.

## What NOT To Do

- Do not store lessons on the device (no localStorage/indexedDB/file downloads).
- Do not reuse Golden Keys to mean "unlock lessons"; Golden Keys are bonus play-time semantics.
- Do not match ownership using filename-only; subject collisions are possible.
- Do not allow path traversal in the download endpoint (`..`, `/`, `\\`).

## Key Files

- `src/app/facilitator/lessons/page.js`
- `src/app/api/facilitator/lessons/download/route.js`
- `src/app/api/facilitator/lessons/list/route.js`
- `src/app/api/lessons/[subject]/route.js`
- `src/app/api/lesson-file/route.js`
