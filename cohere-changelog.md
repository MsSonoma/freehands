# Cohere Investigations Changelog

Purpose: an append-only, human-readable log of *what was investigated*, the *exact recon prompt used*, and the *files/decisions* that resulted.

Notes
- Do not paste full packs here; keep this file short and searchable.
- Latest evidence snapshot is typically in `sidekick_pack.md`.
- Historical recon runs append to `sidekick_rounds.jsonl`.

---

## Entry Template

Date (UTC): YYYY-MM-DDTHH:mm:ssZ

Topic:

Recon prompt (exact string):

Key evidence:
- sidekick_pack: (optional) `sidekick_pack.md`
- rounds journal: (optional) `sidekick_rounds.jsonl` (search by prompt)

Result:
- Decision:
- Files changed:

Follow-ups:

---

Date (UTC): 2026-02-18T00:00:00Z

Topic: Tighten Cohere workflow requirements (end-of-turn ingest + repo changelog)

Recon prompt (exact string):
Update copilot-instructions to require end-of-turn cohere ingest/sync for touched files and maintain a repo changelog of Cohere investigations/prompts to steer future recons and prevent drift

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Add mandatory closeout ingest step for edit turns; add `cohere-changelog.md` as append-only investigation log (not `docs/brain/*`).
- Files changed: .github/copilot-instructions.md, cohere-changelog.md

Follow-ups:
- Optional: Add a small script to pretty-print the last N entries from sidekick_rounds.jsonl.

---

Date (UTC): 2026-02-18T15:16:57.0077881Z

Topic: Mr. Mentor deterministic “describe vs report” for curriculum preferences

Recon prompt (exact string):
Implement deterministic Mr. Mentor intercept responses for curriculum preferences: distinguish describe vs report; report should fetch current learner curriculum preferences via /api/curriculum-preferences; identify where to implement in MentorInterceptor and CounselorClient.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Special-case curriculum preferences in `handleFaq` to answer “describe” locally and route “report” to a new interceptor action that fetches preferences via existing API.
- Files changed: src/app/facilitator/generator/counselor/MentorInterceptor.js, src/app/facilitator/generator/counselor/CounselorClient.jsx, cohere-changelog.md

Follow-ups:
- Consider adding similar report handlers for weekly pattern and custom subjects.

---

Date (UTC): 2026-02-18T15:28:05.4203857Z

Topic: Feature registry (describe+report) + ThoughtHub blindspot hook

Recon prompt (exact string):
Implement a feature registry for Mr. Mentor: a machine-readable catalog of user-facing features that supports (1) deterministic describe responses, (2) deterministic report responses by calling existing app APIs (learner-scoped when needed), and (3) a hook to log blindspots to ThoughtHub. Identify existing FAQ loader data sources and interceptor entrypoints.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Create a registry that merges existing FAQ JSON features with report-capable feature entries; route FAQ intent through the registry; log no-match queries via `interceptor_context.mentor_blindspot` and persist into ThoughtHub event meta.
- Files changed: src/lib/mentor/featureRegistry.js, src/app/facilitator/generator/counselor/MentorInterceptor.js, src/app/facilitator/generator/counselor/CounselorClient.jsx, src/app/api/counselor/route.js, cohere-changelog.md

Follow-ups:
- Add more report-capable entries (custom subjects, goals notes, lesson schedule summaries).

---

Date (UTC): 2026-02-18T15:35:35.2073314Z

Topic: ThoughtHub blindspot harvester + proposal storage APIs

Recon prompt (exact string):
Implement ThoughtHub blindspot harvester + feature proposal storage: where are ThoughtHub events stored and how can an API route list events with meta.mentor_blindspot? What auth patterns exist (cohereGetUserAndClient/cohereEnsureThread)? Propose minimal endpoints to (1) list grouped blindspots for a subjectKey/thread and (2) append a proposal event with meta.mentor_feature_proposal.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Add two authenticated API routes backed by ThoughtHub events: one groups `meta.mentor_blindspot` by normalized query; one lists/appends `meta.mentor_feature_proposal` as an append-only event for later promotion into the registry.
- Files changed: src/app/api/mentor-blindspots/route.js, src/app/api/mentor-feature-proposals/route.js, cohere-changelog.md

Follow-ups:
- Add a tiny internal script or admin panel step to promote stored proposals into src/lib/mentor/featureRegistry.js.

---

Date (UTC): 2026-02-18T15:38:08.8938153Z

Topic: Avoid logging blindspots for personal advice

Recon prompt (exact string):
Mr. Mentor/ThoughtHub: how do we decide a user message is a feature/FAQ question vs general conversation? Where is FAQ intent detection implemented (MentorInterceptor INTENT_PATTERNS)? Where is mentor_blindspot meta attached, and how to avoid logging blindspots for personal advice / non-app questions?

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Add an app-domain heuristic guard so no-match FAQ queries only emit `mentor_blindspot` when they look like app/UI questions.
- Files changed: src/lib/mentor/featureRegistry.js, src/app/facilitator/generator/counselor/MentorInterceptor.js, cohere-changelog.md
