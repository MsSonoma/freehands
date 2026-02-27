2026-02-27T18:25:00Z | Fix: quota useEffect was gated on hasAccess (itself blocked by RLS) so quotaInfo never loaded; fallback tier logic never fired. Changed gate to isAuthenticated-only so quota API always loads for signed-in users. generator/page.js.
2026-02-27T18:15:00Z | Fix: generator/calendar entitlement checks bypassed RLS by using quota API tier (service role) as authoritative fallback; useAccessControl client-side query was RLS-blocked returning free tier silently. generator/page.js + calendar/page.js updated.
2026-02-27T18:00:00Z | Fix: Infinity serializes as null in JSON \u2014 quota routes now use -1 sentinel for unlimited; generator display handles -1 as "Unlimited generations". See sidekick_pack.md.
2026-02-27T17:39:00Z | Fix: quota false-positives for premium/pro. Recon prompt: "Quota hit when generating lessons (calendar + lesson generator) even though account is premium; gating other accounts may have affected entitlement." Updated `/api/lessons/quota` to return `allowed` and updated `/api/usage/check-lesson-quota` to use `plan_tier` + `lessonsPerDay`; generator now computes allowance robustly. See `sidekick_pack.md`.

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

---

Date (UTC): 2026-02-18T16:07:58.5279157Z

Topic: Expand feature registry coverage + add more deterministic report actions

Recon prompt (exact string):
Fill in all user-facing app features for Mr. Mentor feature registry so it can describe them all, and add deterministic report actions for features with variables/state. Identify existing FAQ features, missing user-facing features, and existing API routes that can power report actions.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Keep “describe” sourced from FAQ + registry entries, and add deterministic “report” actions only when there are already authoritative APIs (goals/notes, custom subjects, planned lessons, scheduled lessons, no-school dates, medals, timezone, device status, quota).
- Files changed: src/lib/mentor/featureRegistry.js, src/app/facilitator/generator/counselor/MentorInterceptor.js, src/app/facilitator/generator/counselor/CounselorClient.jsx, cohere-changelog.md

Follow-ups:
- Add more report-capable features (e.g., learner transcript summary, lesson library filters) only where there is an existing stable endpoint.

---

Date (UTC): 2026-02-18T16:16:16.4741284Z

Topic: Add AI safety + facilitator tools to FAQ registry

Recon prompt (exact string):
Ms. Sonoma / Mr. Mentor: enumerate all user-facing facilitator features and settings (UI routes, overlays, tools) and identify where to document/explain them (FAQ JSON + mentor feature registry). Also locate existing AI safety guardrails/policies in code (deterministic report vs describe, blindspot logging gates, ThoughtHub event storage, proposal workflow) so we can add an accurate 'AI safety' explanation feature.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Add new FAQ categories (AI Safety & Trust, Facilitator Settings & Tools) and load them via faqLoader. Update mentor feature registry merge so report capability layers onto FAQ text rather than replacing it.
- Files changed: src/lib/faq/faqLoader.js, src/lib/faq/safety.json, src/lib/faq/facilitator-tools.json, src/lib/mentor/featureRegistry.js, cohere-changelog.md

---

Date (UTC): 2026-02-18T17:04:01.722Z

Topic: Deterministic descriptions for all facilitator child pages

Recon prompt (exact string):
Explain everything on each of the pages that are children of the facilitator page (/src/app/facilitator/**/page.js). List routes, purpose, and user-facing controls/sections for each.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Add a route-level FAQ category (one entry per facilitator page under `/facilitator/**`) so Mr. Mentor can describe each page deterministically without guessing UI details.
- Files changed: src/lib/faq/facilitator-pages.json, src/lib/faq/faqLoader.js, cohere-changelog.md

Follow-ups:
- If you want deeper per-page explainers (exact button labels/flows), we can tighten entries by scanning each page’s render tree for visible strings and modal names.

---

Date (UTC): 2026-02-18T17:06:43.820Z

Topic: Improve recon by retroactive knowledge ingestion + gap notes

Recon prompt (exact string):
Explain everything on each of the pages that are children of the facilitator page (/src/app/facilitator/**/page.js). List routes, purpose, and user-facing controls/sections for each.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Ingest `docs/brain/**` so recon can use historical system knowledge, and add a lightweight gap-note workflow (template + helper script) to capture highly-anchored facts when recon still fails.
- Files changed: docs/reference/cohere/recon-gap-workflow.md, docs/reference/cohere/recon-gap-note-template.md, scripts/cohere-gap-note.ps1, cohere-changelog.md

Follow-ups:
- When recon misses a feature, write a short note under `docs/reference/cohere/gaps/` with routes + exact UI labels as anchors, ingest it, then re-run recon.

---

Date (UTC): 2026-02-18T17:10:50.499Z

Topic: Auto-catch suspicious recon packs

Recon prompt (exact string):
Cohere recon reliability: how can we detect when a sidekick pack is likely missing evidence for a prompt, and auto-remediate via ingest + a gap-note workflow? Anchor on sidekick_pack.md, sidekick_rounds.jsonl, ingest, and scripts tooling.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Add a wrapper script that runs Sidekick recon, checks for prompt anchors in the pack, and if suspicious can auto-ingest likely targets and emit a gap-note stub + audit log.
- Files changed: scripts/cohere-recon.ps1, docs/reference/cohere/recon-gap-workflow.md, cohere-changelog.md

---

Date (UTC): 2026-02-18T17:44:15.770Z

Topic: Fix recon auto-catch scripts (PowerShell 5.1 + meaningful anchor checks)

Recon prompt (exact string):
Fix scripts/cohere-recon.ps1 to run on Windows PowerShell 5.1 (no PS7-only syntax), implement auto-catch recon failure via anchor scoring, auto-ingest, optional gap note, and audit log.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Fix PowerShell parsing issues caused by backticks in double-quoted regex strings; make anchor scoring meaningful by ignoring prompt/filter/question metadata (and pack self-citations) so “suspicious” can actually trigger; make gap-note helper PS5.1 compatible.
- Files changed: scripts/cohere-recon.ps1, scripts/cohere-gap-note.ps1, cohere-changelog.md

Follow-ups:
- If we want stronger detection, add an optional manual `-Expect` list (high-value anchors) and require a minimum hit-rate (e.g., >= 30%).

---

Date (UTC): 2026-02-23T17:13:02.2543565Z

Topic: Flash Cards progress sync across devices/browsers

Recon prompt (exact string):
Flash Cards progress across all devices and browsers: locate the existing Supabase learner-scoped persistence patterns (tables, RLS, upsert/read helpers) used by sessionSnapshotStore/SnapshotService, then outline how to implement the same for flashcards progress.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Reuse the existing `/api/snapshots` + `learner_snapshots` mechanism (Supabase auth token + learner_id + lesson_key) for flashcards progress, with localStorage as an instant cache and debounced remote sync.
- Files changed: src/app/session/components/games/FlashCards.jsx, src/app/session/components/games/flashcardsProgressStore.js, cohere-changelog.md

Follow-ups:
- None (takeover enforces a single active session per account).

---

Date (UTC): 2026-02-23T17:37:08.8912021Z

Topic: Flash Cards visual polish (portrait card + slide animation)

Recon prompt (exact string):
Flash Cards game: make the card look like a real vertical flashcard and add a simple slide-in/slide-out animation between cards. Find existing animation/style patterns in the session UI and confirm where FlashCards is rendered.

Key evidence:
- sidekick_pack: sidekick_pack.md

Result:
- Updated the card UI to a tall portrait “flash card” and added a lightweight slide-out/slide-in transition when advancing cards.
- Files changed: src/app/session/components/games/FlashCards.jsx, cohere-changelog.md

---

Date (UTC): 2026-02-23T18:07:12.8146173Z

Topic: Flash Cards meter decay (stage-scaled time pressure)

Recon prompt (exact string):
Flash Cards game: add gradual meter degradation over time on the card screen; decay rate increases with stage. Find current meter logic in FlashCards.jsx and implement an interval/timer consistent with existing patterns.

Key evidence:
- sidekick_pack: sidekick_pack.md

Result:
- Added a meter decay interval while on the card screen; decay speeds up as stage increases, creating a variable time limit.
- Smoothed meter width changes via a short CSS transition so the bar glides left.
- Files changed: src/app/session/components/games/FlashCards.jsx, cohere-changelog.md

---

Date (UTC): 2026-02-23T21:02:07.7947459Z

Topic: Flash Cards meter decay fix (smooth tick-down + beatable)

Issue:
- Decay felt like it “waits then clears entirely” and made stages effectively unbeatable.

Fix:
- Changed decay from whole-point steps to a smooth fractional tick every 100ms.
- Made the meter bar width continuous (removed rounding) so it visibly drifts left.
- Removed stale-closure stage-complete check; compute the post-answer meter value and use it directly.

Files changed:
- src/app/session/components/games/FlashCards.jsx
- cohere-changelog.md

---

Date (UTC): 2026-02-23T21:05:30.6266490Z

Topic: Flash Cards meter decay tuning

Result:
- Slowed the decay curve so Stage 1 feels forgiving and Stage 10 remains beatable (~25s/point → ~10s/point).
- File changed: src/app/session/components/games/FlashCards.jsx

Follow-ups:
- If we want stronger detection, add optional `-Expect` anchors to the wrapper (manual list) for high-value prompts.

---

Date (UTC): 2026-02-18T00:00:00Z

Topic: Clean up Sidekick snapshot outputs in repo root

Recon prompt (exact string):
(none — housekeeping)

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl

Result:
- Decision: Keep only `sidekick_pack.md` and `sidekick_rounds.jsonl` as the canonical latest outputs; delete topic/snapshot variants from the repo root.
- Files changed: (deleted) sidekick_pack_*.md, sidekick_rounds_*.jsonl; updated cohere-changelog.md

Follow-ups:
- If you want, we can add a `.gitignore` rule or wrapper script default to prevent new snapshot files from being created.

---

Date (UTC): 2026-02-18T18:19:10.1845844Z

Topic: Resume snapshot in work timer mode (avoid play 0:00)

Recon prompt (exact string):
Ms. Sonoma resume snapshot during work timer subphase shows play timer 0:00; should resume work timer countdown. Fix restore logic to keep work timer mode.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: During restore, prefer `snap.currentTimerMode[phase]` over a potentially stale `snap.timerSnapshot.mode`, and drift-correct the correct timer state key (work vs play) so the resumed countdown uses a fresh `startTime`.
- Files changed: src/app/session/hooks/useSnapshotPersistence.js, cohere-changelog.md

Follow-ups:
- If this still reproduces, log the restored `snap.currentTimerMode`, `snap.timerSnapshot`, and which key was drift-corrected to confirm which mode was captured at save time.

---

Date (UTC): 2026-02-22T19:03:42.3423235Z

Topic: App slowness from unnecessary base64 audio payloads

Recon prompt (exact string):
Performance: the entire freehands app feels extremely slow / barely works. Identify likely bottlenecks (Next.js App Router, session page, API routes like /api/sonoma), and where to instrument or optimize. Focus on critical path on initial load.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Add `skipAudio: true` to `/api/sonoma` calls that only need text (story summaries/suggestions/poems/story generation in Opening Actions), since speech is performed separately via `/api/tts` (`speakFrontend` / `audioEngine.speak`). This avoids server-side TTS + large base64 audio responses on the critical path.
- Files changed: src/app/session/hooks/useDiscussionHandlers.js, src/app/session/v2/OpeningActionsController.jsx, cohere-changelog.md

Follow-ups:
- If the app still feels slow, instrument counts/latency of `/api/sonoma` calls per phase and consider parallelizing non-dependent prefetches.

---

Date (UTC): 2026-02-23T16:53:49.2989770Z

Topic: New Games overlay game — Flash Cards (math)

Recon prompt (exact string):
Build new Games overlay game 'Flash Cards': setup screen selects subject (math dropdown), topic, stage; 50 flashcards per topic per stage; 10 stages per topic; meter up/down with goal to advance; stage completion screen (Next); topic completion screen (more exciting, movement, shows next topic + Next). Persist per-learner progress across sessions.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Implement Flash Cards entirely client-side inside GamesOverlay, with deterministic per-learner math decks (50 cards per stage/topic) and localStorage persistence so progress resumes across sessions.
- Files changed: src/app/session/components/games/GamesOverlay.jsx, src/app/session/components/games/FlashCards.jsx, src/app/session/components/games/flashcardsMathDeck.js, cohere-changelog.md

Follow-ups:
- If you want cross-device progress (not just same browser), add a Supabase-backed progress table and swap the storage adapter.

### 2026-02-27 � Generation error: e.map is not a function
- Recon prompt: `Generation Failed error from lesson generator API route - investigate callModel and storage upload`
- Root cause: `buildValidationChangeRequest(validation)` passed whole `{ passed, issues, warnings }` object; function calls `.map()` directly on its argument
- Fix: `src/app/facilitator/generator/page.js` � `buildValidationChangeRequest(validation)` ? `buildValidationChangeRequest(validation.issues)`
