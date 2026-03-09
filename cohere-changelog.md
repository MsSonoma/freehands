2026-03-09T00:00:00Z | Fix+Feature: slate/page.jsx encoding corruption + Mr. Slate video. Root cause of garbled ðŸ¤– / â€" / â"€ symbols: PowerShell Set-Content in PS 5.1 re-reads UTF-8 bytes as Windows-1252, corrupting all multibyte chars. Fix: deleted and recreated file via create_file tool (writes proper UTF-8). Also wired in /media/Mr-%20Slate%20Loop.mp4 via SlateVideo component (autoPlay loop muted playsInline). Video appears in: loading screen, list header, list empty state, ready screen, won screen, drill screen avatar, drill header. Small 🤖 emoji kept for mastery badges. Build: compiled successfully. File: src/app/session/slate/page.jsx.
2026-03-07T02:00:00Z | Feature+Fix: Mr. Slate drill page complete rewrite + remove Practice buttons from lesson cards. (1) slate/page.jsx: replaced URL-param + loadLesson architecture with in-page lesson picker using /api/learner/available-lessons (handles static, Supabase-stored, and generated lessons uniformly). New phase flow: loading → list → ready → asking ↔ feedback → won | error. Lesson list shows all drillable lessons (filtered by non-empty pool) with mastery badges, question count, grade/difficulty labels. Fixed root cause of "Lesson not found" error: loadLesson from services.js is client-side static fetch — Supabase-stored lessons don't exist in the public folder. New code uses lesson.lessonKey from the API response directly as mastery key. Mastery map refreshed from localStorage after winning. (2) learn/lessons/page.js: removed the 🤖 Practice/Mastered button from each lesson card. MasteryMap state, import, and 🤖 title icon remain. Header "🤖 Mr. Slate" button still wired. Build: ✅ compiled successfully. Files: src/app/session/slate/page.jsx, src/app/learn/lessons/page.js. Recon prompt: "Mr. Slate practice page lesson not found error loadLesson available-lessons lesson list picker".
2026-03-07T01:00:00Z | Feature: "Make Active for" dropdown in Lesson Generator. Added listLearners import + learners/makeActiveFor state + dropdown (None / [each learner] / All learners) in the generate button row. After successful generation, if makeActiveFor != 'none', merges { [lessonKey]: true } into approved_lessons for the selected learner(s) via Supabase. File: src/app/facilitator/generator/page.js. Recon prompt: "lesson generator page generate button learner list make active approved lessons activate after generation".
2026-03-07T00:00:00Z | Feature: "Generate a Lesson" button on learn/lessons page. Added FacilitatorPinPrompt import + showGeneratorPinPrompt state + button at bottom of page. Clicking shows PIN prompt; on success navigates to /facilitator/generator. File: src/app/learn/lessons/page.js. Recon prompt: "learn lessons page generate a lesson button pin request lesson generator".
2026-03-05T13:00:00Z | Fix: session page refresh hangs, times out, then eventually loads. Root cause: `loadLearnerProfile` useEffect had 3 stale deps — `lessonData`, `lessonKey`, `planEnt?.goldenKeyFeatures` — none used inside the function, but each caused a full re-run (+ redundant Supabase `getLearner` call) on every page refresh: (1) initial mount, (2) when lesson loaded (`lessonData` changed), (3) when plan tier Supabase query resolved (`planEnt?.goldenKeyFeatures` changed). Fix: (A) removed those three deps from the array; (B) added `planGoldenKeyFeaturesRef` (mirrors `planEnt?.goldenKeyFeatures`) read via ref inside the function; (C) added `learnerProfileRef` (mirrors loaded learner) used by the plan-tier sync effect; (D) expanded the plan-tier force-disable effect to also re-enable golden keys when plan upgrades post-load, avoiding the need for a reload. File: src/app/session/v2/SessionPageV2.jsx. Recon prompt: "session page refresh hangs times out eventually loads".
2026-03-05T01:00:00Z | Fix Bug 1 (video init) + Bug 2 (golden key authoritative timer). Bug 1: startSession() bailed immediately when audioEngineRef.current was null (engine retry loop still in-flight on slow iOS). Fix: construct AudioEngine from videoRef.current inside the Begin gesture before bailing — videoRef is always mounted by Begin-click time; the subsequent initialize() call handles iOS unlock. Bug 2: setPlayTimerLimits useEffect read goldenKeyBonusRef.current and goldenKeysEnabledRef.current (refs) but depended on goldenKeyBonus and goldenKeysEnabled (state). The ref-sync effect (line 886) runs in the same React batch and could lag. Fix: read state values directly inside the effect body. setPlayTimerLimits in TimerService already writes sessionStorage for every existing play timer phase, so TimerControlOverlay sees the correct totalMinutes. File: src/app/session/v2/SessionPageV2.jsx.
2026-03-05T00:00:00Z | Fix: on session resume, timer showed PLAY mode even when user was in WORK mode at time of refresh. Root cause: `phaseChange` event handler in SessionPageV2.jsx called `startPhasePlayTimer(phase)` unconditionally for all four Q&A phases (comprehension, exercise, worksheet, test) after `startXxxPhase()` returned. But `startXxxPhase()` calls `phase.start()` synchronously which emits `stateChange({ timerMode: 'work' })` first (queuing 'work' on `currentTimerMode`), then `startPhasePlayTimer` queues 'play' — React processes both functional updates in order, and 'play' wins, overwriting the correct 'work' mode. Fix: guard each `startPhasePlayTimer` call with `snapshotServiceRef.current?.snapshot?.phaseData?.[phase]?.timerMode === 'work'` — skip the call when resuming in work mode. File: src/app/session/v2/SessionPageV2.jsx. Recon prompt: "phaseChange handler startPhasePlayTimer overwrites work mode on resume — fix for comprehension exercise worksheet test phases".
2026-03-03T00:00:00Z | Feature: per-subject curriculum preferences + Lesson Planner duration options redesign. (1) CurriculumPreferencesOverlay: full rewrite — added subject dropdown listing Global, core subjects (math, language arts, science, social studies, general), and custom subjects passed as `customSubjects` prop from LessonPlanner. Selecting a subject loads/saves that subject's focus/ban lists. Global subject maps to existing top-level columns; per-subject data stored in new `subject_preferences` JSONB column (scripts/add-curriculum-subject-preferences.sql). (2) API route `/api/curriculum-preferences`: POST now accepts `subject` field (defaults 'all'). 'all' saves global columns via upsert (unchanged). Any other subject does a read-merge-write on `subject_preferences` JSONB blob. GET unchanged. (3) LessonPlanner: duration dropdown changed from "1–4 Months" to day/week options (1d, 2d, 3d, 4d, 1w, 2w, 3w, 4w) using `parseDurationToDays()` helper; old numeric values treated as weeks for backward compat. Generation loop refactored from week×dayIndex nested loops to single dayOffset loop over totalDays. Preferences context bug fixed (was referencing `curriculumPrefs.focus_concepts` on the raw response envelope — was always undefined). Per-subject context now injected per-slot in `getSubjectContextAdditions(subject)` merging global + subject-specific. Partial results on outer error preserved via `onPlannedLessonsChange` in catch block. `customSubjects` now passed to CurriculumPreferencesOverlay. Files: CurriculumPreferencesOverlay.jsx, LessonPlanner.jsx, src/app/api/curriculum-preferences/route.js, scripts/add-curriculum-subject-preferences.sql. DB: run scripts/add-curriculum-subject-preferences.sql. Recon prompt: "Curriculum Preferences focuses and bans per subject with dropdown selector, custom subjects, per-subject saving, prompt wiring. Lesson Planner Generator duration options change from months to days and weeks."
2026-03-02T21:00:00Z | Refine judging.js: removed local fallback for SA/FIB; replaced with retry loop (3 attempts, 5s timeout each, 2s gap). On total failure throws `judge-unavailable`. SessionPageV2 catch blocks now call `recover()` on ANY error (previously only on `submit-watchdog`); watchdog expanded from 20s to 35s to cover full retry budget. Files: src/app/session/v2/judging.js, src/app/session/v2/SessionPageV2.jsx. Recon prompt: "retry instead of local fallback for SA/FIB judge-short-answer deterministic".
2026-03-02T20:30:00Z | Harden: Q&A answer submission hangs / goes unresponsive. Root cause (1): `fetchTTS` in services.js had no AbortController/timeout — a stalled `/api/tts` call blocked the entire `submitAnswer` async chain indefinitely, keeping `submitting=true` forever (finally block never ran). Root cause (2): `judgeAnswer` in judging.js had no timeout on the `/api/judge-short-answer` fetch — same hang for SA/FIB questions. Root cause (3): on watchdog expiry the phase class stayed in `playing-feedback`, blocking any retry. Fixes: (A) `fetchTTS` — added AbortController with 12s timeout; (B) `judgeAnswer` judge-short-answer fetch — added AbortController with 8s timeout; (C) added `recover()` public method to ComprehensionPhase, ExercisePhase, WorksheetPhase, TestPhase — stops audio, resets `#state` to `awaiting-answer`, emits stateChange; (D) all four submit handlers in SessionPageV2.jsx now wrap `phase.submitAnswer()` in `Promise.race([...phase.submitAnswer, 20s watchdog])` — on watchdog expiry calls `phase.recover()` and always clears `submitting` in finally. Files: src/app/session/v2/services.js, src/app/session/v2/judging.js, src/app/session/v2/ComprehensionPhase.jsx, src/app/session/v2/ExercisePhase.jsx, src/app/session/v2/WorksheetPhase.jsx, src/app/session/v2/TestPhase.jsx, src/app/session/v2/SessionPageV2.jsx. Recon prompt: "Q&A answer submission hangs or goes unresponsive in session teaching flow".
2026-03-02T19:00:00Z | Fix: video initialization race condition on rapid Start Over → Begin. Root cause (1): Start Over handler did not call audioEngineRef.stop() before state reset, leaving AudioEngine in #isPlaying=true with a video.play() from the unlock sequence still in-flight when Begin was pressed. Root cause (2): startSession() called videoRef.currentTime=0 without pausing first, which on iOS Safari can leave a pending video.play() (from the unlock) in a half-settled state that races with the playVideoWithRetry() inside #startVideo(). Root cause (3): AudioEngine.#startVideo() removed the #videoUnlockPlayingHandler ref but did not pause the video element first, so the in-flight unlock play() could still fire 'playing', calling video.pause() on a sentence already being played. Root cause (4): Start Over button had no debounce — rapid taps ran concurrent async handlers (each awaiting deleteSnapshot network call). Fixes: (A) Start Over onClick: call audioEngineRef.stop() first, wrap in startOverInProgressRef debounce with try/finally. (B) startSession() video prep: call video.pause() before video.currentTime=0. (C) AudioEngine.#startVideo(): check unlockWasActive flag before calling playVideoWithRetry; if true, pause video first so pending play() settles cleanly. Files: src/app/session/v2/SessionPageV2.jsx, src/app/session/v2/AudioEngine.jsx. Recon prompt: "video initialization race condition Start Over button lesson restart snapshot early init order of operations".
2026-03-02T17:00:00Z | Fix: bold vocab words displayed as **asterisks** and TTS read asterisks aloud. Root cause: (1) `/api/tts/route.js` toSsml() did not strip markdown before synthesis (unlike mentor-tts/counselor which did). (2) `mapToAssistantCaptionEntries()` stored raw markdown strings so captions rendered `**word**` as literal text. Fix: added `stripMarkdownForSpeech()` in tts/route.js called before escapeForSsml(); added `stripMarkdownFromCaption()` applied in mapToAssistantCaptionEntries() before storing caption entries. Both strip **bold**, *italic*, _italic_, `code`. Vocab highlighting in captions still works via the vocabTerms `<strong>` pass. Files: src/app/api/tts/route.js, src/app/session/page.js. Recon prompt: "bold vocab words showing up with asterisks not bold TTS reads asterisks".
2026-03-02T16:30:00Z | Feature: numeric keyboard on iOS for Flash Cards answer input. Added `getInputMode(topicId)` helper: fraction topics → `inputMode="text"` (needs `/`), decimal topics → `inputMode="decimal"` (numpad + decimal point), all others (addition/subtraction/multiplication/division/place-value) → `inputMode="numeric"` (pure numpad). Wired to the answer `<input>`. File: FlashCards.jsx.
2026-03-02T16:00:00Z | Fix: landscape+keyboard compact mode for Flash Cards. When vpHeight < 260 (keyboard open in landscape) switch to compact layout: header hidden (✕ back button inline with meter bar instead), meter collapses to a 6px bare bar + stage fraction label, card panel drops border/padding and card text shrinks to 26px, input/send button use reduced padding. All elements still flex:1/flexShrink:0 so card fills whatever space is left between the slim meter and the compact input row. File: FlashCards.jsx.
2026-03-02T15:30:00Z | Fix: Flash Cards card screen still pushed off-screen by iOS keyboard despite dvh/flex fixes. Root cause: on iOS Safari, `position:fixed` is anchored to the layout viewport (never shrinks); `dvh`/`svh` also reflect the layout viewport, not the visible area. Only `window.visualViewport.height` + `.offsetTop` reliably track keyboard-reduced visible area. Fix: added `vpHeight`+`vpOffsetTop` state, subscribe to `visualViewport` `resize`+`scroll`; card screen container uses `position:fixed; top:vpOffsetTop; height:vpHeight; overflow:hidden` — always exactly covers and anchors to the visual viewport. File: FlashCards.jsx.
2026-03-02T15:00:00Z | Fix: portrait whitespace under answer input + landscape card off-screen (keyboard ~65-70% of height). Root cause: card screen used the generic `frame` style (no height constraint) so the outer fixed container had dead space below content in portrait; in landscape the fixed-pixel card height overflowed the visible area. Fix: card screen outer div now `height: 100dvh, display: flex, flexDirection: column` — fills visual viewport exactly in both orientations. Card area uses `flex: 1, minHeight: 0` to absorb leftover space between header/meter and the input row; card itself has `maxHeight: 520` as a cap. Input row is `flexShrink: 0` so it is always visible at bottom. File: FlashCards.jsx. Recon prompt: "portrait whitespace under answer field landscape card off screen keyboard iPad".
2026-03-02T14:00:00Z | Fix: Flash Cards keyboard covers game on iPad. Root cause: GamesOverlay used `maxHeight: 90vh` (layout viewport, doesn't shrink when iOS keyboard opens) and the card used `height: min(520px, 62vh)` (same). Fix: (1) GamesOverlay maxHeight → `90dvh`; (2) card height → `min(520px, 50dvh)` so it shrinks proportionally when keyboard appears; (3) added `onFocus` scroll-into-view (120ms delay) on the answer input so it is always visible after keyboard opens. Files: GamesOverlay.jsx, FlashCards.jsx. Recon prompt: "flash cards game keyboard covers game on iPad when keyboard opens".
2026-03-02T12:00:00Z | Fix: skip button was skipping questions instead of only stopping TTS. Root cause: `skipTTS()` in SessionPageV2.jsx called `phase.skip()` on comprehension/exercise/worksheet/test phases after `stopAudioSafe()`, recording a skip-answer and advancing the question. Fix: removed all `phase.skip()` calls from `skipTTS()`; function now only calls `stopAudioSafe()`. The on-screen button is TTS-only. Keyboard hotkeys (handleHotkey) retain their own skip-question path for power users. File: src/app/session/v2/SessionPageV2.jsx. Recon prompt: "skip button skips questions instead of only skipping TTS speech audio".
2026-03-02T00:00:00Z | Fix: session clock didn't update when Golden Key applied from Timers overlay. Root cause: TimerService.setPlayTimerLimits updated timer.timeLimit + sessionStorage but never emitted a playTimerTick event. SessionPageV2 session clock is driven by playTimerTick events, so it stayed frozen until the next natural 1-second interval — or indefinitely if timer was paused. Fix: emit playTimerTick immediately after updating timer.timeLimit for currentPlayPhase (skip if expired). File: src/app/session/v2/TimerService.jsx. Recon prompt: "Golden Key applied from Timers overlay changes overlay clock but not session clock authority". See sidekick_pack.md.
2026-02-27T18:25:00Z | Fix: quota useEffect was gated on hasAccess (itself blocked by RLS) so quotaInfo never loaded; fallback tier logic never fired. Changed gate to isAuthenticated-only so quota API always loads for signed-in users. generator/page.js.
2026-02-27T18:15:00Z | Fix: generator/calendar entitlement checks bypassed RLS by using quota API tier (service role) as authoritative fallback; useAccessControl client-side query was RLS-blocked returning free tier silently. generator/page.js + calendar/page.js updated.
2026-02-27T18:00:00Z | Fix: Infinity serializes as null in JSON \u2014 quota routes now use -1 sentinel for unlimited; generator display handles -1 as "Unlimited generations". See sidekick_pack.md.
2026-02-27T17:39:00Z | Fix: quota false-positives for premium/pro. Recon prompt: "Quota hit when generating lessons (calendar + lesson generator) even though account is premium; gating other accounts may have affected entitlement." Updated `/api/lessons/quota` to return `allowed` and updated `/api/usage/check-lesson-quota` to use `plan_tier` + `lessonsPerDay`; generator now computes allowance robustly. See `sidekick_pack.md`.

# Cohere Investigations Changelog
## 2025 — slate/page.jsx UX: remove ready screen, video talks-only
- Prompt: "I don't think we need 2 screens before getting to the actual session. The screen with a list of lessons should just have the rules and description briefly at the very top. Also, I only want Mr. Slate to move while he is talking, the same as Ms. Sonoma."
- Changes: deleted ready screen; selectLesson now goes directly to asking phase; rules panel added to top of list screen; SlateVideo converted to forwardRef (no autoPlay); playSlateAudio plays/pauses videoEl around TTS; small header icon videos made static; slateVideoRef wired to drill body avatar

## 2025 — slate/page.jsx responsive layout fix
- Prompt: "page is too tall for the button to be seen at the bottom. responsive layout that looks right at all sizes"
- Changes: added `overflowY: 'auto'` to loading/ready/won outer wrappers; reduced video size 180→120 on ready/won/drill screens, 140→100 on loading; drill main area changed to `justifyContent: flex-start` + `overflowY: auto`; ready card padding changed to `clamp(20px, 5vw, 40px)`
- Build: ✅ compiled successfully## 2026-03-09 — Move Generate a Lesson button; add Mr. Slate button
- Recon prompt: "move Generate a Lesson button on /learn/lessons page to be right after Completed Lessons button, and add a new Mr. Slate button on the same row"
- Changed `src/app/learn/lessons/page.js`: merged the standalone "Generate a Lesson" `<div>` (bottom of page) into the "Completed Lessons" button row; added gap/flexWrap to the row container; added a no-op "🪨 Mr. Slate" button as the third button in the row.
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

### 2026-02-27 � Lesson generated with warnings / Missing file or changeRequest
- Root cause: generator sent `changes` in POST body but `/api/facilitator/lessons/request-changes` destructures `changeRequest`  
- Fix: `src/app/facilitator/generator/page.js` � renamed field `changes` ? `changeRequest` in request body

### 2026-02-27 � Generated lesson not appearing in calendar after scheduling
- Root cause (1): `loadSchedule` filtered out past-date+uncompleted lessons, hiding intentionally-scheduled entries for past/same-day dates
- Root cause (2): `onGenerated` callback passed no data; calendar had to wait for `loadSchedule` to complete before showing the new lesson (race condition)
- Fix (1): Removed `if (isPast && !completed && !completionLookupFailed) return` filter from `calendar/page.js`; all entries in `lesson_schedule` table now always display
- Fix (2): `LessonGeneratorOverlay` now parses schedule POST response and passes `newEntry` to `onGenerated(newEntry)`; forwarded through `DayViewOverlay` to calendar page which immediately injects it into `scheduledLessons` state before `loadSchedule` completes
- Files: `LessonGeneratorOverlay.jsx`, `DayViewOverlay.jsx`, `calendar/page.js`

## 2026-03-02 � Remove redundant PIN on timer pause toggle (v2)
Prompt: `Timers overlay PIN check pause redundant already authenticated`
Fix: Removed `ensurePinAllowed('timer')` from `handleTimerPauseToggle` in SessionPageV2.jsx. Opening the overlay is still PIN-gated via `handleTimerClick`. V1 page.js already had this correct.
File: src/app/session/v2/SessionPageV2.jsx
## 2026-03-09 — Flash Cards difficulty curve overhaul (places + carry/borrow + speed)
Prompt: `Flash Cards game difficulty scaling: value places (1-3=1 place, 4-6=2 places, 7-10=3 places), borrowing/carrying introduction timing, speed scaling too fast at high levels`
Changes:
- `makeAdditionCard`: operands now capped to 1/2/3 digit places per stage band. No carry stages 1-2; carry introduced stage 3 (single-digit only); no carry stages 4-5; carry allowed stages 6-10.
- `makeSubtractionCard`: same place bands. No borrow stages 1-5 (digit-column generation ensures hi_digit >= lo_digit); borrow allowed stages 6-10.
- `getMeterDecayPerSecond`: stage 1 slowed to 400s drain (was 250s); stage 10 slowed to 200s drain (was 100s). Gradient compressed from 2.5× to 2× so speed pressure doesn't compound with harder math.
Files: src/app/session/components/games/flashcardsMathDeck.js, src/app/session/components/games/FlashCards.jsx
## 2026-03-02 � Auto-bold vocab in captions; strip GPT markdown asterisks
Prompt: `vocab words bold captions TTS text display caption rendering`
Fix: CaptionPanel.js � (1) Added stripMarkdown() to remove **bold** markers from displayed text before render. (2) Removed phase==='discussion'||'teaching' restriction so vocab terms are bolded in all phases.
File: src/app/session/components/CaptionPanel.js

## 2026-03-09T14:39:32Z � Mr. Slate implementation

**Prompt**: "Mr. Slate quiz bot page - what is the V2 session page structure, lesson json format, TTS setup, avatar video, and learn/lessons page button routing?"

**Files created/modified**:
- src/app/api/slate-tts/route.js � NEW: Google TTS route with male US Standard voice (en-US-Standard-B, rate 1.08, pitch -1.5) for robot character
- src/app/lib/masteryClient.js � NEW: localStorage mastery tracker (slate_mastery_v1), getMasteryForLearner / isMastered / saveMastery
- src/app/session/slate/page.jsx � NEW: Full Mr. Slate drill page. Dark terminal theme. Phases: loading|error|no-lesson|ready|asking|feedback|won. Question pool built from sample+truefalse+multiplechoice+fillintheblank. 15s per-question countdown. Score 0?10 with +1/-1/�0 logic. Question deck rotates, reshuffles at 80% exhaustion. On score=10: saves mastery to localStorage via masteryClient.
- src/app/learn/lessons/page.js � MODIFIED: Import masteryClient, add masteryMap state, load mastery on learner init, wire "?? Mr. Slate" header button ? /session/slate, show ?? icon on mastered lesson titles, add "?? Practice / Mastered" button on each lesson card routed to /session/slate?lesson=<file>&subject=<subject>
