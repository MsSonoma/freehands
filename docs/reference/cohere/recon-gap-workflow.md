# Recon Gap Workflow (Cohere)

When a Cohere/Sidekick recon pack doesn’t surface the evidence you expect (missing routes, missing UI feature details, missing settings semantics), the fastest way to “repair” future recon is to write a short, highly-anchored note and ingest it.

This repo already treats Cohere packs + change packs as canonical provenance. These notes are meant to be *small*, *searchable*, and *anchor-heavy* so they rank well.

## When to write a gap note

Write a note when:
- A recon pack returns unrelated files (BM25 noise), or repeats old packs as evidence.
- A question needs “what does the UI do?” and the page is mostly composed of components where strings/controls aren’t easy to pick up.
- The behavior is important but spread across multiple modules (page → component → hook → API).

Avoid writing a note when:
- The missing evidence is simply not ingested yet (ingest the folder first).

## What makes a good gap note

Include:
- The exact recon prompt that failed.
- 3–10 **anchors** that are likely to appear in searches:
  - route paths (e.g., `/facilitator/calendar`)
  - component names (e.g., `LessonPlanner`, `SettingsOverlay`)
  - API routes (e.g., `/api/lesson-schedule`)
  - exact UI label text (e.g., “Load Lessons”, “Manage subscription”)
- A short “what the user sees / can do” description.
- A “key files” list that names the real entrypoints.

Keep it short. Prefer bullet lists. Don’t paste giant code blocks.

## Suggested loop

1) Ingest the relevant subtree if needed (example):
- `py -m cohere ingest src/app/facilitator --project freehands --recursive`

2) Re-run recon with a *tighter anchor* (route + exact label):
- Example prompt: `"Where is /facilitator/calendar implemented? Include user-visible actions like Planner tab, Day View, Notes, Visual Aids."`

3) If it still fails, create a gap note under `docs/reference/cohere/gaps/` and ingest it.

4) Re-run recon again.

## Optional: use the recon wrapper (auto-catch)

If you don’t want to manually decide whether a pack “looks wrong”, use:

- `scripts/cohere-recon.ps1`

It runs Sidekick recon, then performs a lightweight check: it extracts anchors (routes/paths/backticked literals) from your prompt and verifies they actually appear in the generated pack. If the pack looks suspicious, it can:

- auto-ingest likely folders inferred from anchors (e.g., `/facilitator/*` → `src/app/facilitator`), and
- optionally emit a gap-note stub under `docs/reference/cohere/gaps/`.

Example:

- `./scripts/cohere-recon.ps1 -Prompt "Explain /facilitator/calendar…" -AutoIngest -AutoGapNote`

## Files

- Template: `docs/reference/cohere/recon-gap-note-template.md`
- Notes directory: `docs/reference/cohere/gaps/`
- Helper: `scripts/cohere-gap-note.ps1`
