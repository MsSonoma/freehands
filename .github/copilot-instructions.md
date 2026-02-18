# GitHub Copilot Instructions for Ms. Sonoma Project (freehands directory only)

## COHERE WORKFLOW (REQUIRED)

## Recon (Use Cohere)

You MUST consult Cohere first before any other source of information. When you don’t fully understand a concept/area of the repo, do recon first using Cohere.

## Round Protocol (Required)

For every non-trivial Copilot turn (anything beyond a short yes/no), you MUST do the following BEFORE answering:

1) Update Cohere (keep DB current)
- Ensure a watcher is running for this repo (preferred):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project add freehands C:\Users\atari\freehands | Out-Null`
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sk watch -a MsSonoma -p freehands`
- If you cannot keep a watcher running, then you MUST at least ingest the file(s) you are about to discuss/change before generating packs:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <path> --project freehands [--recursive]`

2) Consult Cohere (recon pack)
- Run recon using the latest user prompt text:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sk r -a MsSonoma -t "<latest user prompt>" --out sidekick_pack.md --journal-out sidekick_rounds.jsonl`
- Then read/use `sidekick_pack.md` when forming the answer.

## End-of-Turn Closeout (Required for Edits)

If (and only if) you created/edited/deleted any repo files in the turn, you MUST do the following BEFORE ending your response:

1) Ingest the touched files (preferred) OR sync the project
- Preferred (precise):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
- Alternative (broader, slower; use if many files changed):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands`

2) Append an investigation entry to `cohere-changelog.md`
- Required when you ran recon to answer the question OR made non-trivial edits.
- Keep entries short and searchable; include the exact recon prompt string so it can be re-run.

Note: This changelog is NOT `docs/brain/*` and does not violate the Brain-folder documentation policy.

If you cannot run Cohere commands in this session, you MUST say that explicitly and ask the user to run them and paste the results.

- Default behavior (automatic recon): before answering any non-trivial user prompt, generate a fresh pack from the latest prompt text and use it as context.
   - Command: `py -m cohere sk r -a MsSonoma -t "<latest user prompt>" --out sidekick_pack.md`
   - Then read/use `sidekick_pack.md` when forming the answer.

- Use Sidekick for quick health + linkage checks (good first move before edits):
   - `py -m cohere sk a -a MsSonoma` (audit: inconsistencies, missing context, broken connections)
   - `py -m cohere sk f -a MsSonoma` (forecast: problems + opportunities)
   - If useful for Copilot context: write into the workspace and open the file:
      - `py -m cohere sk a -a MsSonoma --out sidekick_latest.txt --out-format text`

## Isolation (Required)

This workspace MUST use an isolated Cohere home so it does not share DB/blobs/history with other apps.

- Required env var (PowerShell): `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"`
- After setting it, run all Cohere commands normally (examples below).

Notes:
- If `COHERE_HOME` is not set, Cohere will fall back to the shared default (`%USERPROFILE%\.coherence\`) which is NOT allowed for this workspace.
- First-time setup in a fresh isolated home may require `project add` and an initial `ingest`/`sync`.

### Cohere Gate (Do This First)

For any question about how the code works, debugging, or architecture: you MUST run a Cohere pack first and use chunk IDs as evidence.
- If you cannot run Cohere in this session, say that explicitly and ask the user to run `py -m cohere doctor --project freehands`.

This repo uses the local `cohere` tool (in the sibling Cohere workspace) as the mechanical source-of-truth for:
- Lossless blobs + DB head state
- Deterministic extracted text + chunks
- Evidence packs (context packs)
- Audited change packs (apply/rollback provenance)

### Cohere Is Local (Not “Online”)

Treat Cohere as a local CLI + local DB (under `%USERPROFILE%\.coherence_apps\ms_sonoma\` for this workspace), not a networked service.
- If the user asks whether Cohere is "online", interpret it as: "can we run the local `py -m cohere ...` commands here?"
- Do not claim any network connectivity to external services.

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

When answering architecture questions or planning changes:
1. Build an evidence pack first:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere pack "<question>" --project freehands --profile MsSonoma --out pack.md`
2. Use the pack’s chunk IDs as evidence anchors (the IDs are the provenance tokens).

### Asking Good Pack Questions (REQUIRED)

Do not ask abstract questions first. Anchor pack questions on one of:
- Exact error text / log line
- Route/path (e.g., `/session/discussion`, `/api/...`)
- File name / folder name
- Env var name
- UI label text
- Function/class identifier

Use these templates (copy/paste and fill in anchors):
- "Where is `<feature>` implemented end-to-end? List entrypoints, key files, and data flow."
- "Where is route `<route>` defined and what calls it? Include middleware and handlers."
- "Search for the exact string `<error or label>` and show the controlling code path."
- "What reads/writes `<data file or table>` and under what conditions?"
- "What configuration keys/env vars control `<system>` and where are they read?"
- "Given file `<path>`, what other modules depend on it (imports/calls) and why?"

If pack #1 doesn't contain the entrypoint you need:
1. Re-pack with a tighter anchor (prefer an exact string, route, or filename).
2. If still missing, ingest/sync the relevant subtree, then re-pack.

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

Binary files:
- Change packs are text-only (plus deletions). Binaries are preserved losslessly by ingest/sync, not by diffs.

NOTE: `.github/instructions/*` are archived snapshots; do not edit them.

## DOCUMENTATION POLICY (COHERE-CANONICAL)

For this workspace, Cohere packs + Cohere change packs are the canonical record of system behavior and provenance.

- Do NOT update `docs/brain/*`, `docs/brain/manifest.json`, or `docs/brain/changelog.md` automatically after code changes.
- Do NOT add changelog entries automatically.
- Only edit `docs/brain/*` when the user explicitly asks for documentation updates.

## Repo Changelog (Cohere Investigations)

Use `cohere-changelog.md` as an append-only log of investigations and fixes to prevent drift and to provide “access windows” into recent recon prompts.
- Do not paste full packs.
- Prefer linking to `sidekick_pack.md` (latest) and/or referencing the corresponding line(s) in `sidekick_rounds.jsonl`.
