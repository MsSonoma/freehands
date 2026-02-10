# GitHub Copilot Instructions for Ms. Sonoma Project (freehands directory only)

## COHERE WORKFLOW (REQUIRED)

### Cohere Gate (Do This First)

For any question about how the code works, debugging, or architecture: you MUST run a Cohere pack first and use chunk IDs as evidence.
- If you cannot run Cohere in this session, say that explicitly and ask the user to run `py -m cohere doctor --project freehands`.

This repo uses the local `cohere` tool (in the sibling Cohere workspace) as the mechanical source-of-truth for:
- Lossless blobs + DB head state
- Deterministic extracted text + chunks
- Evidence packs (context packs)
- Audited change packs (apply/rollback provenance)

### Cohere Is Local (Not “Online”)

Treat Cohere as a local CLI + local DB (under `C:\Users\atari\.coherence\` by default), not a networked service.
- If the user asks whether Cohere is "online", interpret it as: "can we run the local `py -m cohere ...` commands here?"
- Do not claim any network connectivity to external services.

Local health-check sequence:
- `py -m cohere --help`
- `py -m cohere project list`
- `py -m cohere doctor --project freehands`

When answering architecture questions or planning changes:
1. Build an evidence pack first:
   - `py -m cohere pack "<question>" --project freehands --profile MsSonoma --out pack.md`
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
   - `py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `py -m cohere doctor --project freehands`

Binary files:
- Change packs are text-only (plus deletions). Binaries are preserved losslessly by ingest/sync, not by diffs.

NOTE: `.github/instructions/*` are archived snapshots; do not edit them.
