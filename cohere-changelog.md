2026-04-18 | feat(lessons): Redesign lessons selection page — horizontal list rows + detail overlay. Replaced the grid of vertical cards with stacked horizontal rows. Each row shows subject badge, title, grade/difficulty, medal, and status pills (Scheduled, Continue, Golden Key). Clicking a row opens a centered modal overlay showing the blurb, history, facilitator note (view/edit), and the Start/Continue button. Notes editing moved from inline-card to overlay. Commit: 562c4f9. Recon prompt: "learn lessons page layout lesson cards grid design UI components".

2026-04-18 | fix(lessons): "Start Lesson" / "Continue" button shows wrong text. The snapshot lookup in `learn/lessons/page.js` used `lesson.id` as the primary key, but snapshots are saved under the URL param key (filename without extension). For lessons with a non-filename `lesson.id` (e.g. `"LA-4-ADV-001"` vs `"4th_The_Importance_of_Courage_advanced"`), the lookup always missed the snapshot, forcing "Start Lesson" even for in-progress lessons. Fix: swapped priority — use `lesson.file` (stripped of `.json`) first, fall back to `lesson.id` last. Commit: 15b79a8. Recon prompt: "learn lessons page start lesson continue button logic which lessons have started".

2026-04-18 | chore(session): Remove dead V1 hooks folder (8 files, 5268 lines), dead `getStoredSnapshot` import from `learn/lessons/page.js` (lessons resume now uses `/api/snapshots` directly), and tighten timer snapshot throttle from 10s to 3s in `SessionPageV2.jsx` (worst-case timer loss on hard refresh drops from 10s to 3s). Commit: a224d37. Recon prompt: "SessionPageV2 remaining state ownership risks: parallel React state copies outside TimerService, SnapshotService, PhaseOrchestrator — any remaining zombie state, stale closure risks, or architectural gaps".

2026-05-01 | feat(session): Remove V1 session page. `src/app/session/page.js` replaced with 9-line passthrough to `SessionPageV2`. `src/app/session/v2test/page.jsx` deleted. V1 had ~9875 lines of legacy teaching flow; V2 (TimerService-owned, event-driven) has been default for all users. No localStorage flags remain. Entry points (`learn/lessons/page.js`, `LearnerTutorial.jsx`) route unchanged. Build clean. Commit: d6440da. Recon prompt: "remove V1 session page.js — V2 is now the only session implementation, promote V2 to /session route directly".

2026-04-08 | fix(webb): Wrong article fetched — "Basics of Economics" returned "The Basics" (band). Two-layer fix in `webb-resources/route.js`: (1) `articleTitleIsRelevant(lessonTitle, articleTitle)` — new guard function strips stop words, checks content-word overlap between lesson title and resolved Wikipedia article title; returns `null` (reject) if no content words match. Applied to `simple-wikipedia`, `wikipedia`, and `kiddle` fetch methods before accepting the resolved slug. (2) GPT search-term prompt rewritten to require 2–5 words and explicitly preserve subject domain ("never reduce to a generic word that could match a band, film, or proper name"). `generateArticle` now passes lesson `title` as second arg to `src.fetch()` so sources always have the original title for the relevance check. Commits: 4ff35bf, 87838d4. Recon prompt: "article fetch returning wrong irrelevant article band called The Basics for lesson Basics of Economics webb-resources search term Wikipedia".

2026-04-07 | perf(transcripts): 504 gateway timeout on learner transcripts page. Route was calling `store.download()` on every transcript file to check validity (2 round trips: download + createSignedUrl), then looping sequentially over all lessons × sessions × teachers. With a realistically sized account (3 teachers, ~10 lessons each, each with session sub-folders) this produced 40-60+ sequential Supabase Storage calls, reliably exceeding Vercel's function timeout. Fix: `tryGetTranscript` now uses `createSignedUrl` only — Supabase errors on missing paths, making it a free existence probe with zero file downloads. Removed RTF probe (client removes RTF on every write). Parallelized sessions within a lesson (`Promise.all`), and all teacher folders + lessons in parallel at the top level. Commit: 08fe1a6.

2026-04-06 | fix(transcripts): fix stale closure — V2 Sonoma saves empty transcript. The `sessionComplete` event handler is registered inside `useEffect([lessonData])`, so it closed over `transcriptLines` as `[]` (the value at mount time). Every `captionChange` event and learner-answer call updated state but the handler never saw those updates. Fix: added `transcriptLinesRef` (ref mirror of `transcriptLines`, kept in sync via a dedicated `useEffect`); replaced `transcriptLines` with `transcriptLinesRef.current` in the `sessionComplete` handler. Paired with the earlier `isInvalidTranscript` filter fix and storage migration, this restores full both-sides transcripts (Ms. Sonoma sentence-by-sentence + learner answers) for all V2 sessions. File: `SessionPageV2.jsx`. Commit: 95648bf.

2026-04-06 | fix(transcripts): Learner transcripts page broken for all 3 teachers. Two root causes found and fixed:
(1) CODE BUG — route.js `isHeaderOnlyTranscript` treated every "Learner: …" dialogue line as a header pattern match, so all V2 Sonoma transcripts (which only record learner answers) were silently discarded by the route. Replaced with `isInvalidTranscript` that only filters files containing stale JWT-error payloads. (2) SETUP GAP — no Supabase Storage migration existed for the 'transcripts' bucket; missing INSERT/UPDATE RLS policies cause all client-side saves to fail silently with 403. Added `docs/SQLs/create-transcripts-storage-bucket.sql` and `supabase/migrations/20260406000000_transcripts_storage_policies.sql` (idempotent). Files: route.js, docs/SQLs/create-transcripts-storage-bucket.sql, supabase/migrations/20260406000000_transcripts_storage_policies.sql. Commit: 1644bab. Recon prompt: "transcripts broken in Learners list per learner all 3 teachers".

2026-04-06 | fix(sonoma-v2): Re-apply golden-key mid-session timer sync fix (commit 8e11fc2). Previous apply (d1e2d5e) was reverted prematurely — user saw stale Vercel cache, not actual regression. This re-apply uses cleaner approach: handlers that already have a freshly-loaded `timers` object (both branches of `handleApplyGoldenKeyForLesson`) use it directly instead of going through `phaseTimersRef`; `handleSuspendGoldenKey` uses `phaseTimersRef.current` (phaseTimers not in closure); `handleUnsuspendGoldenKey` uses `phaseTimers` closure (it IS in deps). `TimerService.setPlayTimerLimits` now computes live elapsed from `startTime` on the immediate tick. All `[TimerFix]` debug logs removed. Build ✓.

2026-04-06 | fix(sonoma-v2): Golden key mid-session timer sync — zombie cycle analysis + permanent fix.

**Zombie chain**: Snapshot ↔ TimerService ↔ Golden Key ↔ TimerControlOverlay ↔ SessionTimer (video overlay). Each previous fix patched one link and broke another.

**Root cause**: Two data paths feed the two timer displays, on different timing:
- `TimerControlOverlay` reads `goldenKeyBonus` via React prop → updates IMMEDIATELY on the render where `setGoldenKeyBonus(bonus)` fires.
- `SessionTimer` (video overlay) reads `playTimerDisplayRemaining` → updated only AFTER `TimerService.setPlayTimerLimits()` emits a `playTimerTick` event → set via the `useEffect([phaseTimers, goldenKeyBonus, goldenKeysEnabled])` dependency cycle → ONE render cycle later.
Result: overlay shows new time; video timer shows old time. Brief (16ms) but structurally wrong.

**Full relationship map (must stay in sync)**:
1. `TimerService` — authoritative clock. `setPlayTimerLimits({phase: seconds})` updates `timer.timeLimit` AND emits `playTimerTick` for the active phase, which drives `playTimerDisplayRemaining` state → video-overlay `SessionTimer.remainingSeconds` prop.
2. `SessionTimer` (video) — **pure display mode** in V2. `remainingSeconds = playTimerDisplayRemaining`. Does NOT self-time. Remounted by `timerRefreshKey` changes but still reads from prop.
3. `TimerControlOverlay` — calculates its own remaining from `(totalMinutes + goldenKeyBonus) * 60 - elapsed_from_sessionStorage`. Prop-driven; updates the moment `goldenKeyBonus` React state changes.
4. `goldenKeyBonus` React state — set in `handleApplyGoldenKeyForLesson` / `handleSuspendGoldenKey` / `handleUnsuspendGoldenKey`. Also synced to `goldenKeyBonusRef`.
5. `phaseTimersRef` (NEW) — ref mirror of `phaseTimers` state. Required so golden-key handlers can read current phase timers without stale-closure issues (the handlers are `useCallback` with narrow deps).
6. `useEffect([phaseTimers, goldenKeyBonus, goldenKeysEnabled])` — safety net that calls `setPlayTimerLimits` reactively for all cases (learner settings changes, plan tier changes, etc.). Keeps working.
7. `SnapshotService` saves `timerService.getState()` which includes `timer.timeLimit` WITH the golden key bonus already baked in. On restore, `restoreState` sets the stored timeLimit; then `setPlayTimerLimits` from the useEffect is safe (same value, no double-bonus).
8. `TimerService.setPlayTimerLimits` — now recalculates `elapsed` from `startTime` live (not cached value from last 1-second tick) when emitting the immediate tick. More accurate remaining.

**Fix applied** (`SessionPageV2.jsx`, `TimerService.jsx`):
- Added `phaseTimersRef` (ref mirror of `phaseTimers` state).
- In `handleApplyGoldenKeyForLesson`: after setting `goldenKeyBonus`, immediately call `timerServiceRef.current.setPlayTimerLimits(...)` using `phaseTimersRef.current` and the new bonus value. This emits `playTimerTick` synchronously in the same JS event → `setPlayTimerDisplayRemaining` batched with `setGoldenKeyBonus` → both display paths update in ONE render.
- Same treatment for `handleSuspendGoldenKey` (bonus=0) and `handleUnsuspendGoldenKey` (bonus restored).
- `TimerService.setPlayTimerLimits`: recalculate live elapsed from `startTime` before emitting tick; update `timer.elapsed` in place.
- Removed debug `console.log('[TimerFix]')` statements.

Files: `src/app/session/v2/SessionPageV2.jsx`, `src/app/session/v2/TimerService.jsx`. Recon prompt: "SessionPageV2 golden key applied mid-session: video timer goldenKeyBonus not updating, TimerService goldenKeyBonus prop, timerRefreshKey, FullscreenPlayTimerOverlay, TimerControlOverlay sync bug".

2026 — Transcript system: teacher tabs + Webb/Slate saves. Restored Sonoma transcript compatibility; added Webb (3s-debounced save on CHATTING phase) and Slate (save on pagePhase='won') persistence to Supabase Storage; rewrote API route to walk teacher sub-folders (sonoma/webb/slate); rewrote transcripts page with teacher tabs + count badges; added Transcripts button to learner cards. Files: transcriptsClient.js, webb/page.jsx, slate/page.jsx, route.js, learners/[id]/transcripts/page.js, learners/page.js. Commit: e1414a3. Build: ✓. Recon prompt: "Where is transcripts feature implemented end-to-end? List entrypoints, key files, and data flow."

2026-03-31 | feat(slate): Drill transcript + print at lesson completion. Added `drillTranscript` state + ref to accumulate Q&A entries as the drill runs. `handleResult` now accepts `rawAnswer` param; `onTextSubmit`/`onChoiceClick` pass human-readable answer labels. `startDrill` resets transcript. On `pagePhase === 'won'`, an inline transcript panel shows each question color-coded (green/red/amber) with the student's answer and the correct answer if wrong. A 🖨 PRINT button opens a new window with clean print-ready HTML auto-triggering `window.print()`. No persistent button — only appears at end of lesson. Commit: cc9bd6a. Build: ✓. Recon prompt: "Mr Slate print page at end of lesson with answers and transcript of right and wrong answers, similar to Ms. Sonoma print".

2026-03-25 | fix(slate): Mr. Slate now reveals correct answer on timeout (same flow as wrong answer). Root cause: `correctAnswer` was guarded by `!correct && !timeout`, so timeout events got an empty string and fell into the "advance with delay" branch instead of the audio-chain branch. Fix: removed `!timeout` from the guard; now `correctAnswer` is populated for both wrong answers and timeouts. The existing `else if (soundRef.current && correctAnswer)` branch handles both cases: plays timeout message → "The correct answer was X" → advance. UI `EXPECTED:` label also displays on timeout. File: `src/app/session/slate/page.jsx` line 714. Commit: 0e0fbf8. Build: pending. Recon prompt: "Mr. Slate page - give correct answer on timeout, currently only does on incorrect answer".

2026-03-25 | fix(webb): Essay prompt over-polishing child's voice — 2nd fix. Previous "weave into coherent essay" prompt gave GPT license to write, resulting in added sentences and collegiate-sounding vocabulary upgrades. New prompt reframes role as "copy editor, NOT writer": fully enumerated ALLOWED list (spelling fixes, grammar fixes, tiny connective glue words, one plain-child-voice intro + closing sentence) and MUST NEVER list (replace any word, rephrase sentences, expand phrases, add new facts, make writing sound polished). Explicit example: "it was really cool and stuff" must stay verbatim. Commit: f0c518c. Build: ✓. Recon prompt: "Mrs Webb essay creation verbatim child writing polish editing prompt".

2026-03-25 | fix(webb): overlay play/pause toggle + fullscreen broken on iOS/mobile. Root cause 1: YT IFrame API `onStateChange` postMessage events are unreliable on iOS — `videoPlaying` state stayed `false` while playing, so every overlay tap called `playVideo`. Fix: added `videoPlayingRef` that's updated optimistically in the click handler AND synced from YT messages when they arrive; both overlay div and custom controls bar use the ref. Root cause 2: `requestFullscreen()` on a div + `webkitRequestFullscreen()` on cross-origin iframe both fail silently on iOS Safari — `fullscreenchange` never fired, `mediaIsFullscreen` never became true. Fix: `toggleMediaFullscreen` now directly calls `setMediaIsFullscreen(!mediaIsFullscreen)` (CSS-based fullscreen via `position:fixed; inset:0`); also attempts `requestFullscreen` as an enhancement on desktop Chrome but doesn't rely on it. `overlayPanelStyle` restructured so `mediaIsFullscreen` is the first condition, always resolving to `inset:0`. `fullscreenchange` listener simplified to only set `false` (handles Escape key exit on desktop). Commit: c5b7b1f. Build: ✓. Recon prompt: "overlay play/pause toggle broken plays but doesn't pause; fullscreen button doesn't work on mobile devices iOS Safari webkit".

2026-04-22 | feat(webb): Three Mrs. Webb upgrades. (1) `webbCompletionClient.js` (new): localStorage tracker `webb_completion_v1` — `saveWebbCompletion(learnerId, lessonKey)`, `getWebbCompletionForLearner`, `isWebbCompleted`. (2) `webb/page.jsx`: `webbCompletionMap` state loaded on mount; `handleCompleteLesson()` saves completion + refreshes map; essay end-screen gets a "Complete Lesson 👩🏻‍🏫" button (grays to "Lesson Completed ✓" once saved); a "✨ Make my essay" strip appears above the chat input whenever all objectives are met (mirrors the objectives-overlay button); `LessonCard` in `WebbLessonBrowser` now shows 👩🏻‍🏫 emoji + "Essay complete" label (teal border) for Webb-completed lessons. Commit: d2241e7. Build: ✓. Recon prompt: "Mrs. Webb essay overlay end screen complete lesson button objectives overlay write your essay button conversation". — `webb-interpret/route.js` and `webb-video-interpret/route.js` now accept `objectives[]` + `completedIndices[]` from the client. Both compute uncompleted objectives and inject an `objClause` into their GPT system prompts: "The lesson has these uncompleted learning objectives: [list]. Pick passages/moments that directly address one or more of these objectives — not just generally related content." `page.jsx` `interpretVideo()` and `interpretArticle()` now pass `objectives` and `completedIndices: completedObj` in their POST bodies. Root cause: GPT was selecting whatever was prominent in the article/video (e.g. Shakespeare biography) rather than content that demonstrates the lesson's specific learning objectives (e.g. symbolism). Commit: 205b3f0. Build: ✓. Recon prompt: "Key Parts objective alignment pass objectives and completedIndices to webb-interpret and webb-video-interpret routes so GPT selects passages/moments that address lesson objectives".

2026-03-23 | fix(webb): Essay generation no longer polishes student vocabulary. `webb-objectives/route.js` `generateEssay` system prompt rewritten: old prompt said "keep student's own words as much as possible" which GPT treated as license to upgrade vocabulary. New prompt explicitly forbids changing any word the student used, allows only one intro sentence, one closing sentence, and minimal connective words. Student's exact phrasing — including simple or awkward words — must be preserved verbatim. Recon prompt: "Mrs Webb end of lesson essay generation student words verbatim". Build: ✓.

2026-03-23 | Fix (2nd attempt): YouTube black screen on iPad — switched embed domain from youtube-nocookie.com to youtube.com. Root cause: iPad Safari defaults to desktop mode (unlike iPhone). youtube-nocookie.com's Privacy Enhanced Mode uses a different player bundle in desktop UA context; combined with controls=0 it silently fails to render, leaving a black frame. Regular youtube.com/embed works correctly in both mobile and desktop modes. Sandbox trimmed back to allow-scripts allow-same-origin allow-presentation allow-popups. Build: ✓.

2026-03-23 | Fix (1st attempt, did not fix): YouTube black screen on iPad — added allow-popups allow-popups-to-escape-sandbox allow-forms to sandbox; added fullscreen to allow Feature Policy. Not the root cause.

2026-03-23 | feat(webb): Video tiering system — relevance scoring, chapter/caption metadata, tier-aware Mrs. Webb dialogue. `webb-resources/route.js`: rewrote `generateVideo` — (1) broad search maxResults=10 with no caption filter (rich pool); (2) GPT scores ALL candidates 0–10 for lesson relevance (JSON array); (3) candidates scoring < 3 (completely irrelevant) are dropped — if all drop, returns `{ unavailable: true, reason: 'irrelevant' }`; (4) batch-fetches YouTube `videos` API for top 6 candidates to get `contentDetails.caption` (hasCaptions) and description chapter-marker parse (hasChapters); (5) composite rank: `relevanceScore × 10 + captions×20 + chapters×15` — both get weight, neither blocks; (6) returns `{ relevanceTier: 'high'|'low', hasChapters, hasCaptions, ... }` so client can tune dialogue. `page.jsx`: added `lowTierMsgSentRef` + `noVideoMsgSentRef` (reset on new lesson/refresh); replaced video button `onClick` with `handleVideoButtonClick` — no-video shows "results weren't helpful" once, low-tier shows "couldn't find a perfect video" once; `interpretVideo` gains fast path (skip API if hasCaptions===false && hasChapters===false) and tier-aware `transcript_unavailable` message; all ref resets wired into `preloadResources` and `refreshMedia`. Build: ✓. Recon prompt: "video tiering relevance chapters captions Key Part dialogue Mrs Webb webb-resources generateVideo".

2026-03-23 | Fix: video not working on Mrs Webb (YouTube API / transcript_unavailable). Root cause 1: `generateVideo` in `webb-resources/route.js` searched with `videoCaption=closedCaption`, which only returns videos with manually-authored captions — most educational videos have only auto-generated captions, so many lesson topics returned 0 results → `{ unavailable: true }`. Fix: removed `videoCaption=closedCaption` filter (broadens pool; Key Part already falls back to chapter-based approach for uncaptioned videos). Root cause 2: `interpretVideo` in `page.jsx` called `refreshMedia('video')` on `transcript_unavailable`, creating a loop — every new video from the same pool would also fail (no chapters + cloud-IP transcript block on Vercel). Fix: on `transcript_unavailable`, keep the current video and show "This video doesn't have chapter markers…" instead of refreshing. Also added `console.error` logging for YouTube API errors in `generateVideo` so quota/key errors surface in server logs. Build: ✓. Recon prompt: "video not working Mrs Webb YouTube API".

2026-03-15 | feat(webb): Objectives accordion + research mode + essay generation. (1) `webb-objectives/route.js`: `checkObjectives` now returns `{ newlyCompleted, qualifyingText }` where `qualifyingText` is a map of obj-index → student's own words; added `generateEssay` (GPT keeps student's words, adds intro+conclusion); added `generate-essay` POST action. (2) `webb-chat/route.js`: added `buildResearchSystem` helper; new `researchMode`/`targetObjective` POST params — Webb explains the objective in 3-5 sentences then ends with a "say it in your own words" question. (3) `page.jsx`: new state (`objResponses`, `expandedObj`, `essayMode`, `essay`, `generatingEssay`); `checkObjectivesAfterTurn` stores `qualifyingText`; `selectLesson` + `generateObjectives` reset new state; added `startResearch(objIdx)` (closes overlay, posts to webb-chat in researchMode) and `handleGenerateEssay`; objectives overlay rewritten as accordion (header click expands, completed shows student quote in blockquote, incomplete shows 📚 Research button, "✨ Make my essay" button appears when all complete); full-screen essay modal with "Copy It Down!" instruction. Build: clean ✅. Recon prompt: "save qualifying student response in objectives, accordion UI, research button teaches objective, essay generation from responses".

 — replaced broken sources with Kiddle. `britannica-kids` and `national-geographic-kids` were always returning 400/404. Replacement: added `kiddle` source (`kids.kiddle.co`) using Wikipedia search API to resolve title then fetch `https://kids.kiddle.co/{slug}`. Tested on 7 school topics — all 200. Updated default source list and settings overlay. Build: ✓. Recon prompt: "doesn't work using only wikipedia does nothing else work at all article sources rotation".

2026-03-15 | Fix: Article refresh shows no visual change (looks like same page). Root cause: `refreshMedia` never cleared the old article before fetching — the old article iframe stayed visible throughout the refresh, and when Simple Wikipedia rotated to Wikipedia (both look nearly identical), the user couldn't tell anything changed. Fix: `setArticleResource(null)` added at the top of `refreshMedia` when `type === 'article'`, which clears the iframe immediately and shows the existing "Finding an article…" spinner (the condition `(articleLoading || refreshingMedia) && !articleResource?.html` is now true during refresh since article is null). Added save/restore: `savedArticle = articleResource` captured before nulling, restored via `setArticleResource(savedArticle)` in the catch block and in the `!data.article?.html` branch so the user doesn't lose their article if the refresh fails. Build: ✓ compiled. Recon prompt: "longer load no change article doesn't load new page refresh same article".

2026-03-15 | Fix: Article rotation broken — only Wikipedia loaded + same article repeated. Three root-cause bugs fixed: (1) `_fetchHtml` returned `{ html, source: label }` but `excludeSource` was compared against source ID — mismatch means exclusion never fired → added `sourceId` to `_fetchHtml` signature and return value; (2) `ARTICLE_SOURCES` entries passed label string to `_fetchHtml` where ID was expected → updated all 6 entries to pass `(sourceId, sourceLabel)` correctly; (3) `generateArticle(apiKey, title, grade, preferredSources)` signature ignored the 5th `excludeSource` argument entirely → rewrote to accept `excludeSourceId`, build a shuffled try-list with excluded source last, then fallback to simple-wikipedia; (4) Ducksters hardcoded `/science/{slug}.php` failing for non-science topics → Ducksters `fetch()` now calls GPT to determine correct section path (e.g. `/history/american_revolution`, `/geography/amazon_river`); (5) POST handler renamed `excludeSource` → `excludeSourceId`; (6) `page.jsx refreshMedia` was sending `articleResource.source` (label "Simple Wikipedia") instead of `articleResource.sourceId` (ID "simple-wikipedia") → changed to `excludeSourceId: articleResource?.sourceId`. Build: ✓ compiled. Recon prompt: "Article only uses Wikipedia refreshes to same article over and over excludeSource rotation broken".

2026-03-14 | feat(webb): Objectives overlay button in top bar. Added `showObjectives` state; added checkmark badge button (shows `N/M` tally) in header — hidden until `isChatting && objectives.length > 0`; on click opens a dark portaled panel (`#0f172a`, teal border) listing all objectives with ✅/⬛ per-item status and a progress bar. No new routes or API changes. Build clean. Recon prompt: "button in top bar that opens objectives overlay showing completed and incomplete objectives webb page.jsx".

2026-03-14 | feat(webb): 50/50 video/conversation split + inset overlay. (1) Portrait: videoWrapperStyle changed to `flex: '0 0 50%'`; videoInnerStyle height `calc(100% - 4px)`; transcriptWrapperStyle `flex: '0 0 50%'`. (2) Landscape: `videoColPercent` always `50` (removed dynamic 40-45% calc). (3) Overlay: 88% width, 86% height, 6% left inset, 4% top gap — non-fullscreen only; borderRadius 10 always when non-fullscreen. Commit `801a516`. Recon prompt: "video and conversation 50/50 split landscape 50% width portrait 50% height media overlay smaller inset positioned toward top".

2026-03-14T03:00:00Z | Fix: WIKI_SOURCES ReferenceError in webb-resources article generation. Root cause: `generateArticle` was rewritten to reference `WIKI_SOURCES` (using `src.url`/`src.base` properties) but the constant in the file was still named `GREEN_SOURCES` with `fetchUrl`/`baseHref` properties — causing `ReferenceError: WIKI_SOURCES is not defined` on every article request. Fix: replaced the entire `GREEN_SOURCES` block (which contained Ducksters + Wikijunior — both block Vercel cloud IPs) with a clean `WIKI_SOURCES` array containing only Simple English Wikipedia and Wikipedia REST API, using `url`/`base` property names that match `generateArticle`. Tested: no-previousSource → `source=Simple English Wikipedia`; `previousSource=Simple English Wikipedia` → `source=Wikipedia` (flip works). Committed `418d277`, pushed to Vercel. Recon prompt: "WIKI_SOURCES is not defined at generateArticle ReferenceError GREEN_SOURCES webb-resources".

2026-03-14 | Fix: media overlay never appeared when video/article button pressed. Root cause: three required useEffects were never added to page.jsx during the portal refactor — (1) fullscreenchange listener, (2) ResizeObserver rect measurement, (3) mediaOverlay-close reset. `overlayRect` stayed `null` permanently → `overlayPanelStyle` was always `null` → portal condition `isChatting && mediaOverlay && overlayPanelStyle` never passed. Fix: inserted all three effects before `// ── Media overlay helpers`. Effect #3 deps are `[mediaPos, mediaOverlay]` so it fires immediately when user opens overlay. Commit `afa9538`. Recon prompt: "media overlay does not appear when video or article button is pressed webb page.jsx portal createPortal overlayPanelStyle overlayRect".

2026-03-XX | Fix: orphaned old overlay JSX after portal refactor. Root cause: multi_replace_string_in_file R7 removed `{isChatting && mediaOverlay && (` and outer overlay `<div>`, but R8 (spinner + closing divs removal) failed. Left old toolbar+content+article JSX orphaned inside videoInnerStyle div, with a broken unclosed JSX comment as its only "wrapper". File would not compile. Fix: replaced entire broken block (from `{/* Media overlay is now portaled...*/` through the article fallback `)}` + blank lines) with a single clean JSX comment. Build: ✓ Compiled successfully. Commit `3a6f5cf`. Recon prompt: "Where is the media overlay portaled in webb/page.jsx and what JSX was orphaned after R8 failure?".

2026-03-13T05:00:00Z | Fix: page.jsx UTF-8 encoding corruption. Root cause: `Set-Content -NoNewline` in PowerShell 5.1 defaults to Windows-1252 (ANSI), not UTF-8. When the emoji HTML entity change was applied via PowerShell regex+Set-Content, all Unicode chars above U+00FF (▶, 📖, ↻, ✕, ──, etc.) were irreversibly replaced with `?` (0x3F). Vercel build failed with "stream did not contain valid UTF-8". Fix: restored file from `88bbb55` (clean UTF-8 commit) via `git show | .NET WriteAllText(UTF8NoBOM)`. Re-applied only the emoji skin-tone change using .NET `WriteAllText` with explicit `UTF8Encoding(false)` to avoid CRLF/BOM issues. Build: ✓ Compiled successfully. Committed + pushed `3501f13`. Note: NEVER use bare `Set-Content` for Unicode files in PS5.1 — always use `[System.IO.File]::WriteAllText(..., ..., [System.Text.UTF8Encoding]::new($false))`. Recon prompt: "page.jsx UTF-8 invalid stream webpack build failed encoding Set-Content PowerShell".

2026-03-13T04:00:00Z | Fix+Feature: Mrs. Webb chat bubbles + video nocookie + article diversity. (1) `page.jsx`: removed CaptionPanel import; replaced `<CaptionPanel>` with inline iMessage-style chat bubbles — teacher messages left-aligned with 👩‍🏫 avatar and white bubble, student messages right-aligned with teal bubble; added `chatEndRef` + `useEffect` to auto-scroll to newest message; added `webb-bounce` CSS keyframes for typing indicator; `refreshMedia` now passes `previousSource: articleResource?.source` to avoid repeating same article source. (2) `route.js`: changed YouTube embed domain from `youtube.com` to `youtube-nocookie.com` for better cross-origin compatibility; `POST` body now accepts `previousSource` field; `generateArticle` accepts `prevSrc` arg and injects "pick a DIFFERENT source" line into GPT prompt when prevSrc is set. Tested: refresh with `previousSource=Wikipedia` returned Simple English Wikipedia. Recon prompt: "Mrs. Webb chat bubbles iMessage transcript CaptionPanel youtube-nocookie previousSource article refresh source diversity".

2026-03-13T03:00:00Z | Fix: Mrs. Webb video always shows "unavailable". Root cause: GPT safety reviewer returned -1 for all 5 YouTube candidates (over-strict prompt said "reject entertainment-only"), and `parseInt(-1) >= 0` is false so fell through to `{ unavailable: true }`. Fix: (1) Relaxed GPT reviewer prompt — videos are already filtered by `safeSearch=strict&videoEmbeddable=true`, so GPT only needs to pick the most educationally relevant, not re-do safety. (2) Changed rejection fallback from `unavailable` to `pickedIdx = 0` (first result) so a valid embed is always returned when YouTube has results. GPT parse errors also fall back to index 0. Verified: Photosynthesis → "Peekaboo Kidz, The Dr. Binocs Show" embed URL returned correctly. Recon prompt: "Mrs. Webb video unavailable GPT reviewer strict reject safety safeSearch YouTube".

2026-03-14T02:00:00Z | Fix: Mrs. Webb preload race + Wikipedia CSS. (1) `session/webb/page.jsx` `preloadResources`: replaced single combined `type:'both'` fetch with two independent parallel fetches (`type:'video'` and `type:'article'`). Each resolves via `.finally(() => setVideoLoading/setArticleLoading(false))` so loading state always resets even if the response is missing a key. Both fire simultaneously so video arrives as soon as video is ready, article as soon as article is ready (~3s vs ~4s). (2) `api/webb-resources/route.js`: added `baseHref: 'https://simple.wikipedia.org'` to `simple-wiki` source, `baseHref: 'https://en.wikibooks.org'` to `wikijunior`, `baseHref: 'https://en.wikipedia.org'` to `wiki`. Both fallback paths (Fallback 1/2) now inject `<base href="https://...">` into fetched HTML so Wikipedia CSS/images resolve correctly in `srcdoc` iframes (previously only Ducksters had this). Verified API returns valid YouTube embedUrl and 153KB Wikipedia HTML with built-in base tag. Build: ✓ no errors. Recon prompt: "Mrs. Webb video button nothing article generated text preload loading state Wikipedia CSS srcdoc iframe base href".

2026-03-14T01:00:00Z | Fix: Mrs. Webb media overlay — real YouTube video + Wikipedia srcdoc. (1) `webb-resources/route.js`: video now uses YouTube Data API v3 (`YOUTUBE_API_KEY` env) to get a real embeddable video ID (`/embed/{videoId}`); falls back to `searchUrl` (YouTube search page) if key absent or no results. Article now asks GPT for the best Wikipedia article title and returns `{wikiTitle, wikiUrl, wikiApiUrl}` — no more generated text. (2) `session/webb/page.jsx`: added `webpageHtml`/`webpageHtmlLoading` state; `useEffect` on `articleResource.wikiApiUrl` fetches Wikipedia's mobile-html REST endpoint (`/api/rest_v1/page/mobile-html/{title}`, CORS ✓) and stores result; overlay renders it via `<iframe srcdoc={webpageHtml}>` (bypasses X-Frame-Options). Video overlay shows real YouTube embeds when `embedUrl` present, or a styled YouTube search button when only `searchUrl`. Refresh button clears `webpageHtml` so new Wikipedia article fetches cleanly. Build: ✓ Compiled successfully. Recon prompt: "Mrs. Webb video article overlay real YouTube embed Wikipedia srcdoc mobile-html iframe YOUTUBE_API_KEY".

2026-03-14T00:00:00Z | Feature: Mrs. Webb — full OpenAI-backed rewrite. Replaced non-functional Cohere-server architecture. (1) `src/app/api/webb-chat/route.js` (new): stateless freeform chat endpoint — POST `{messages, lesson}` → `{reply}`. Mrs. Webb system prompt built from lesson title/subject/grade. Safety: `validateInput` on last user message. Uses `gpt-4o-mini`, max_tokens 160. (2) `src/app/api/webb-resources/route.js` (new): media preloader/generator — POST `{lesson, type:'video'|'article'|'both', context?}` → `{video?:{embedUrl, searchQuery}, article?:{title, text}}`. Video: GPT generates YouTube search query → `youtube.com/embed?listType=search&list=QUERY`. Article: GPT writes 150-250 word reading passage (plain text, no markdown). Context used for conversation-aware refresh. (3) `src/app/session/webb/page.jsx` (full rewrite): simplified phase machine `list→starting→chatting`. Removed all Cohere state (webbPost, webbGet, RemediationPanel, RewardVideo, ContentViewer). Added: `selectLesson(lesson)` kicks off greeting + background `preloadResources(lesson)`; `sendMessage(text)` appends to message history + calls webb-chat; `refreshMedia(type)` re-calls webb-resources with last-6-message context. Media overlay on teacher video: inset ~10px so teacher video peeks at edges; toolbar with ↻ refresh + ✕ close. Two new buttons on video overlay bottom-left: ▶ Video + 📖 Article (animated loading spinners until preload done). WebbLessonBrowser 3-tab ACTIVE/RECENT/OWNED + StudentInput kept intact. Build: ✓ Compiled successfully. Cohere ingested: 3 files, 40 chunks. Recon prompt: "Mrs. Webb OpenAI chat freeform lesson video article overlay preload refresh session/webb page.jsx webb-chat webb-resources".

2026-03-13T01:00:00Z | Rebuild: Mrs. Webb — replaced freeform chat design with full Cohere lesson-flow state machine per `C:\Users\atari\Cohere\docs\mrs_webb_ms_sonoma_design.md`. New architecture: (1) `src/app/api/webb/[...path]/route.js` — Next.js catch-all proxy to local Cohere server at `http://127.0.0.1:7720` (configurable via `WEBB_SERVER_URL` env). Forwards all Cohere API paths (`/health`, `/mrs-webb/lesson/*`). Safety layer: `validateInput` on student `text` in `/lesson/respond`; blocked replies return a safe Mrs. Webb nudge (HTTP 200) instead of hard error. (2) `src/app/session/webb/page.jsx` — Full state machine: `list → starting → presenting → probing → remediating → complete`. Components: `LessonList` (fetches `/lesson/list`), `WebbBubbles` (animated teacher speech bubbles), `ContentViewer` (routes to `VideoPlayer` or `TextReader` by `content_type`), `StudentInput` (`/lesson/respond`), `RemediationPanel` (3 options: rewatch/explain/read_aloud; respects `rewatch_blocked`; inline video re-mount on rewatch), `RewardVideo` (reward on lesson complete), progress bar in header. Session close via `/lesson/close` on exit. Old freeform OpenAI-based route removed. Recon prompt: "Mrs. Webb lesson flow session page ContentViewer VideoPlayer TextReader RemediationPanel RewardVideo state machine presenting probing remediating complete Cohere API proxy".
2026-03-13T00:00:00Z | Feature: Mrs. Webb — chat-style educational AI teacher. New button on `/learn` page (teal, 👩‍🏫, navigates to `/session/webb`). Full-page chat UI at `src/app/session/webb/page.jsx`: header with own back button + teal palette; chat bubble list (webb left / student right); textarea + Send; safety notice banner; typing indicator; char-limit guard (400 chars). API at `src/app/api/webb/route.js`: POST accepts `{ messages, learnerName, grade }`, enforces all 4 contentSafety layers (validateInput on every student message in history, hardenInstructions builds system prompt, validateOutput blocks unsafe replies), stateless (client sends full window of last 20 messages), Cohere context stub `getWebberContext()` clearly marked TODO for user to complete. HeaderBar updated: `/session/webb` hides global header (own top bar) + back-path resolves to `/learn`. Files: `src/app/api/webb/route.js` (new), `src/app/session/webb/page.jsx` (new), `src/app/learn/page.js`, `src/app/HeaderBar.js`. Recon prompt: "Mrs. Webb chat teacher button learn page like sonoma slate validator layers OpenAI moderation stateless Cohere context".
2026-03-12T00:00:00Z | Fix (2): (1) LessonPlanner Duration select onChange called `Number(e.target.value)` on strings like `"1d"`, `"2w"` — `Number("1d") === NaN`, which `parseDurationToDays` passed through as `NaN * 7 = NaN`, making the generation loop run 0 times (single-day / 2-day options always produced nothing). Fix: removed `Number()` wrapper, pass raw string. (2) `handleAutoGeneratePlan` in DayViewOverlay did not fetch `/api/curriculum-preferences`, so focus/banned concepts were never included in the context sent to `generate-lesson-outline`. Fix: added `preferencesRes` to the `Promise.all`, extracted `prefsRow = prefsJson.preferences`, added `getSubjectContextAdditions(subject)` helper (mirrors LessonPlanner logic), appended its output to `contextText` before POST. Build: ✓ clean. Files: `src/app/facilitator/calendar/LessonPlanner.jsx`, `src/app/facilitator/calendar/DayViewOverlay.jsx`. Recon prompt: "curriculum preferences generate-lesson-outline context generation one day lesson planner single day broken".
 | Fix: planned lessons deleted from CalendarOverlay (Mr. Mentor) reappear after refresh. Two root causes: (1) `loadPlannedForLearner` has a guard "if API returns empty but cache has data, preserve old data" — after a deletion the API correctly returns `{}` but sessionStorage/localStorage still held stale lesson data, so `existingCount > 0` fired and discarded the correct empty result. (2) `writeSessionCache` has a "never write empty maps" guard (`if (count === 0) return`) so it could never clear itself. Fix: in `handleRemoveClick` (CalendarOverlay.jsx), after `persistPlannedForDate` succeeds, immediately compute the new planned map (stripping empty arrays), update `plannedCacheByLearnerRef`, call `writeSessionCache` if non-empty, or explicitly `removeItem` from both `sessionStorage` and `localStorage` if empty. This ensures subsequent calls to `loadPlannedForLearner` see `existingCount === 0` and apply the empty result correctly. ALSO: `savePlannedLessons` in `page.js` now checks the API response and re-loads from DB on failure so local state stays in sync. Build: ✓ Compiled successfully. Files: `src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx`, `src/app/facilitator/calendar/page.js`. Recon prompt: "When a Planned Lesson is deleted, it still comes back after refresh."
2026-03-11T22:00:00Z | Feature: "+" add-lesson button in DayViewOverlay. A blue "+" button appears in the top-right of the day cell overlay (Calendar page). Pressing it opens a cascading dropdown: (1) Schedule Lesson → Owned (lists all facilitator-owned lessons from `/api/facilitator/lessons/list`; clicking one schedules it via POST `/api/lesson-schedule` and fires `onLessonGenerated`) | Generate (opens existing `LessonGeneratorOverlay`). (2) Plan Lesson → subject list (core + custom subjects from `/api/custom-subjects`); clicking a subject calls `/api/generate-lesson-outline` with learner history/scheduled/planned context then saves the new outline as a planned lesson via new `onPlannedLessonAdd(date, lesson)` callback. New `handlePlannedLessonAdd` added to `calendar/page.js` and passed down. `CORE_SUBJECTS_DV` constant and state/helpers added directly in `DayViewOverlay.jsx`. Build: ✓ Compiled successfully. Files: `src/app/facilitator/calendar/DayViewOverlay.jsx`, `src/app/facilitator/calendar/page.js`. Recon prompt: "DayViewOverlay + button Schedule Lesson Plan Lesson owned lessons overlay LessonGeneratorOverlay subject picker auto-plan curriculum preferences".
2026-03-11T21:00:00Z | Fix: removed planned lessons reappear after refresh. Root cause: `handlePlannedLessonRemove` in `calendar/page.js` deleted the date key from the object when the array became empty, then called `savePlannedLessons(updated)`. The API POST handler only deletes DB records for dates present in the incoming `plannedLessons` object (`newPlanDates`), so the now-absent date's records were never deleted — they persisted in the DB and came back on the next fetch. Fix: (1) removed the `delete updated[date]` guard in `handlePlannedLessonRemove` so the empty array is included in the POST body; (2) `savePlannedLessons` now strips empty arrays before calling `setPlannedLessons` (clean UI state) but passes the full object with empties to the API (so the API deletes the right DB rows). File: `src/app/facilitator/calendar/page.js`. Recon prompt: "When I remove planned lessons, they come back after a refresh."
2026-03-11T20:00:00Z | Fix: medal grades silently lost when DB write soft-fails. Root cause: `/api/medals` POST always returns HTTP 200 (even on DB upsert failure) to avoid surfacing errors in UI. `upsertMedal()` checks `resp.ok` (HTTP 200) and returns immediately without writing to localStorage. `getMedalsForLearner()` also gets HTTP 200 from GET (empty or partial DB results) and never reaches its localStorage fallback. Net result: grade silently dropped — not in DB, not in localStorage. Fix: (1) `upsertMedal`: write to localStorage FIRST as a backup, then push to API; API push clears the backup path via DB. (2) `getMedalsForLearner`: after getting DB results, scan localStorage and merge any entries where local `bestPercent > dbBestPercent` — these are DB-lost grades; fire-and-forget re-`upsertMedal` to recover them to DB. File: `src/app/lib/medalsClient.js`. Recon prompt: "lessons completed today no medal - are grades stored at all - upsertMedal always returns ok:true even on DB failure localStorage fallback never fires".
2026-03-11T19:00:00Z | Fix: V1 session page not writing test_percentage to completed event metadata. Root cause: `onCompleteLesson` in `session/page.js` called `endTrackedSession('completed', { earned_key })` without including the test score. This caused `debug-emma-mismatch.mjs backfill` to report "no test_percentage in completed events" for all V1 completions, making lost medals unrecoverable. V2 (`SessionPageV2.jsx`) already included `test_percentage`. Fix: added `test_percentage: typeof testFinalPercent === 'number' ? testFinalPercent : null` to the `endTrackedSession` metadata call in `session/page.js`. File: `src/app/session/page.js`. Recon prompt: "lessons completed but no medal showing in session list medals missing for completed lessons".
2026-03-11T12:00:00Z | UI: /learn page — "View Lessons" button renamed to "Ms. Sonoma"; new "🤖 Mr. Slate" button added below "Awards" (indigo, navigates to `/session/slate`); Mr. Slate button removed from learn/lessons page header. Files: `src/app/learn/page.js`, `src/app/learn/lessons/page.js`. Recon prompt: "change view lessons to Ms. Sonoma on /learn page, move Mr. Slate button from learn/lessons page to /learn page below Awards, change emoji from rock to robot".
2026-03-11T02:00:00Z | Feature: Reschedule mini-calendar picker for past + future lessons across all 3 calendar locations. (1) `calendar/page.js`: added `reschedulePickerItemId`/`reschedulePickerMonth` state + `PICKER_MONTHS`/`buildPickerDays` helpers; past lessons row now shows 📅 inline mini-calendar dropdown (calls existing `handleRescheduleLesson(item, date)`) and Remove button changed to 🗑️. (2) `calendar/DayViewOverlay.jsx`: added `reschedulePickerKey`/`reschedulePickerMonth`/`reschedulingBusy` state + helpers + new `handleRescheduleLesson(lesson, newDate)` (DELETE+POST+`onLessonGenerated`); past lessons: 📅 picker + 🗑️; future lessons: "Reschedule" button added next to existing "Edit Lesson" button with same mini-calendar. (3) `CalendarOverlay.jsx` (Mr. Mentor): added `reschedulePickerKey`/`reschedulePickerMonth` state + `PICKER_MONTHS_CO`/`buildPickerDaysCO` helpers; past lessons: 📅 picker (calls existing `handleRescheduleLesson(key, selectedDate, newDate)`) + 🗑️. All pickers use 7-column CSS grid, month nav arrows, backdrop div for click-outside, blue hover on day cells. Build: ✓ Compiled successfully. Recon prompt: "Calendar scheduled lessons Edit Lesson button reschedule past lessons Notes Assigns Add Images Remove rescheduling calendar picker instant no refresh". Files: `src/app/facilitator/calendar/page.js`, `src/app/facilitator/calendar/DayViewOverlay.jsx`, `src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx`.
2026-03-11T01:00:00Z | Feature: "change date" link with mini inline calendar below the "Generate on [date]" button in LessonGeneratorOverlay. Added `activeDate` state (initialized from `scheduledDate` prop) + `showDatePicker`/`pickerMonth` state. All display and scheduling logic now uses `activeDate` instead of the static `scheduledDate` prop. A small underlined "change date" text button below the Generate button toggles a compact month-grid calendar (7-column CSS grid, prev/next month arrows, selected day highlighted in blue). Selecting a day updates `activeDate` and closes the picker. Transparent fixed backdrop handles click-outside dismiss. Build: ✓ Compiled successfully. Recon prompt: "Lesson Planner Generate button opens lesson generator overlay says Generate on [date] change date calendar picker planned date override". File: `src/app/facilitator/calendar/LessonGeneratorOverlay.jsx`.
2026-03-11T00:00:00Z | Feature: Calendar "Assigns" button replaces "Visual Aids" on past scheduled lessons. Added green "Assigns" button with dropdown listing all learners + "All Learners" option. Selecting a learner (or all) writes `approved_lessons[lessonKey] = true` to Supabase `learners` table — identical to checking the box on facilitator/lessons page — making the lesson active in their learn/lessons. Implemented in 3 locations: (1) `calendar/page.js` — new `handleAssignLesson(lessonKey, targetId)` + `assignsOpenId/assigning` state, `learners` already available; (2) `calendar/DayViewOverlay.jsx` — added `learners` prop + same assign handler; updated `DayViewOverlay` call in `page.js` to pass `learners`; (3) `CalendarOverlay.jsx` (Mr. Mentor) — added `learners` prop (default []), fallback to `learnerId` if list empty; `CounselorClient.jsx` passes `learners`. All three render a positioned dropdown with a transparent backdrop for click-outside dismissal. Build: ✓ Compiled successfully. Recon prompt: "Calendar past scheduled lessons buttons Notes Visual Aids Add Images Remove - replace Visual Aids with Assigns dropdown showing learners and all - assigns lesson to learner like facilitator/lessons page checkbox making it active in learn/lessons". Files: `src/app/facilitator/calendar/page.js`, `src/app/facilitator/calendar/DayViewOverlay.jsx`, `src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx`, `src/app/facilitator/generator/counselor/CounselorClient.jsx`.
2026-03-09T01:00:00Z | Feature: timer pauses while Mr. Slate speaks. Added `slateIsSpeakingRef = useRef(false)` to slate/page.jsx. `playSlateAudio` sets it `true` on entry (before fetch), `false` in `onended`/`onerror`/catch. Timer interval skips decrement while `true`. All 7 call sites updated to pass `slateIsSpeakingRef` as 5th arg (selectLesson greeting+question, showQuestion, startDrill greeting+question, handleResult feedback, handleResult congrats). Build: ✅ compiled successfully. File: src/app/session/slate/page.jsx. Recon prompt: "timer pauses while Mr. Slate speaking TTS playback countdown".
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
## 2026-03-10 — Mr. Slate: wire GPT judging for short-answer and fill-in-the-blank
- **Recon prompt**: "How does Ms. Sonoma judge short answer and fill-in-the-blank answers? What API endpoint does she call? What is the request format, grading rules, and how is the result used in the session flow?"
- **Change**: `checkAnswer` in `src/app/session/slate/page.jsx` was a sync local string-normalizer. Replaced with async version mirroring `src/app/session/v2/judging.js`: MC/TF stay local+sync; SA/FIB POST to `/api/judge-short-answer` (GPT-4o-mini, same leniency rules as Ms. Sonoma) with 3 attempts / 5s timeout / 2s retry. Falls back to local judge if API unavailable. `onTextSubmit` changed to `async` with phase-guard after `await`.
- **Files**: `src/app/session/slate/page.jsx`
- **Build**: ✓ clean

## 2025-01 — Mr. Slate: Owned tab only showing 5 instead of 80 lessons (Supabase Storage + stale cleanup)
- **Recon prompt**: "Where are lessons stored in Supabase? What table holds lesson metadata and content? How does available-lessons API query lessons? What is the lesson_id / lessonKey format in lesson_sessions history?"
- **Root cause A**: `available-lessons` has a stale cleanup that removes lesson keys from `approved_lessons` when files can't be loaded. Many lessons are `generated/` (stored in Supabase Storage at `facilitator-lessons/{facilitatorId}/{filename}`). If `facilitatorId` is missing or the download fails, the key is removed from `approved_lessons` over time → only stock lessons survive.
- **Root cause B**: `/api/lessons/meta` route (created prior session) only read from local disk for stock subjects, silently skipping `generated/` keys → session history lesson_ids for generated lessons produced no cards.
- **Fix 1** — `src/app/api/lessons/meta/route.js`: Rewrote to accept `learner_id` param, look up `facilitator_id` from Supabase `learners` table (service role), and download `generated/` lessons from Supabase Storage (`facilitator-lessons/{facilitatorId}/{filename}`). Also added `general/` (local Facilitator Lessons folder) support.
- **Fix 2** — `src/app/session/slate/page.jsx` init effect: Changed destructuring `[{ lessons }]` → `[availRes]` to also capture `staleApprovedKeys` from `available-lessons` response. Now passes BOTH history-missing keys AND staleApprovedKeys (approved lessons that couldn't be loaded by available-lessons) into `/api/lessons/meta`. Also passes `learner_id` so generated lessons can be fetched from Storage.
- **Files**: `src/app/api/lessons/meta/route.js`, `src/app/session/slate/page.jsx`
- **Build**: ✓ clean


- **Recon prompt**: "Recent tab shows grey unclickable rows and Owned only shows two active lessons in Mr. Slate drill page"
- **Root cause**: `allOwnedLessons` = currently approved lessons (≤2); session history references many more lesson_ids not in that set → Recent rows get `lesson: undefined` → grey; Owned constrained to same 2.
- **Fix**:
  1. Created `/api/lessons/meta/route.js` — POST `{keys: string[]}` → reads `public/lessons/{subject}/{file}` and returns lesson data for up to 300 keys (stock subjects only; skips missing files silently).
  2. Added `historyLessons` state (`useState({})`) in slate/page.jsx — map of lessonKey→lessonData for sessions not in `allOwnedLessons`.
  3. Init effect: after loading history, collects lesson_ids not in approved set and fetches `/api/lessons/meta`; stores result in `historyLessons`.
  4. Tab render block: replaced `ownedByKey = new Map(allOwnedLessons...)` with `mergedMap` that merges `allOwnedLessons` + `historyLessons`; `recentList` and `ownedList` now derive from `mergedMap` so all cards are real and clickable.
  5. OWNED tab count label updated from `allOwnedLessons.length` → `mergedMap.size`.
- **Files**: `src/app/session/slate/page.jsx`, `src/app/api/lessons/meta/route.js` (new)
- **Build**: ✓ clean## 2026-03-09 — slate: configurable drill settings overlay + per-learner Supabase save
- Prompt: "make clicking on this box open an overlay where all of these stats can be changed and make the changes reflect from the variables. This will also have to be saved to the supabase per learner."
- New: `src/app/api/learner/slate-settings/route.js` (GET + PATCH, service-role, sanitizes ranges)
- New: `scripts/add-slate-settings-column.sql` (ADD COLUMN IF NOT EXISTS slate_settings JSONB)
- Changed: `slate/page.jsx` — DEFAULT_SLATE_SETTINGS + SETTINGS_CONFIG constants; settings/settingsDraft/settingsOpen/settingsSaving state; settingsRef; parallel load with lesson fetch; scoring uses settingsRef (correctPts/wrongPts/timeoutPts/scoreGoal); rules bar → clickable button with dynamic values + ✎ EDIT badge; settings overlay (sliders for all 5 params, live preview, save→PATCH API); saveSettings callback; ScorePips/TimerBar use settings state; won screen uses settings.scoreGoal

## 2026-03-09 — slate/page.jsx UX: remove ready screen, video talks-only
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

---

## 2025 — Mrs. Webb: Sonoma-style UI rebuild (session/webb/page.jsx)

**Prompt used for recon:** "Mrs. Webb UI — match Ms. Sonoma video layout: teacher looping video with Skip/Mute overlay, CaptionPanel transcript, landscape/portrait responsive exactly like SessionPageV2"

**Summary:**
- Complete rewrite of `src/app/session/webb/page.jsx` to match Ms. Sonoma's visual layout
- Teacher video (`/media/webb-teacher.mp4`) loops, plays only when TTS audio is playing, pauses when idle
- TTS uses new `/api/webb-tts` endpoint with `en-US-Neural2-F` voice (distinct US English female)
- CaptionPanel from `../components/CaptionPanel` — `{text, role}` message array, `role='user'` renders red
- Sequential TTS queue → `ttsQueueRef`/`ttsBusyRef`/`ttsCurrentRef` pattern with `drainTTSQueue()`
- Skip + Mute overlay buttons (bottom-right of video), same `clamp(34px,6.2vw,52px)` sizing as Sonoma
- Responsive: landscape = side-by-side (video left, transcript right, heights synced via ResizeObserver); portrait = stacked
- All Cohere state machine phases preserved: LIST → STARTING → PRESENTING → PROBING → REMEDIATING → COMPLETE
- Build: compiled successfully, zero errors

**Files changed:**
- src/app/session/webb/page.jsx (complete rewrite)
- src/app/api/webb-tts/route.js (created, en-US-Neural2-F voice)

---

## 2026-03-13 — Mrs. Webb: match Mr. Slate lesson browser (3-tab ACTIVE/RECENT/OWNED)

**Prompt used for recon:** "Mr. Slate lesson browser — how lessons are listed, filtered, selected, what data is shown per lesson card, what API routes are called"

**Summary:**
- Replaced Webb's simple Cohere-server lesson list (`/api/webb/lesson/list`) with the full Slate-style 3-tab browser
- Lessons now loaded from `/api/learner/available-lessons?learner_id=...` (same source as Mr. Slate)
- History loaded from `/api/learner/lesson-history` to populate RECENT tab and completed status
- ACTIVE tab: all lessons not yet completed in history
- RECENT tab: completed sessions joined to lesson metadata, most recent first
- OWNED tab: full merged set (available + history-only) with subject/grade dropdown filters
- Lesson cards show title, subject/grade/difficulty meta, green ✓ if previously completed
- `startLesson()` now accepts full lesson object; passes `lesson.lessonKey` as `lesson_id` to Cohere server
- Browser uses full page width (no video column during list phase)
- Build: compiled successfully, zero errors

**Files changed:** src/app/session/webb/page.jsx

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

## 2026-03-14 14:27 � FAQ unrecognized response fall-through
- Fixed Phase 1 and Phase 2 of UI FAQ state machine in `sendMessage`
- If input matches neither `isYes` nor `isNo`, refs cleared and execution falls through to normal AI chat
- Recon prompt: 'FAQ yes/no intercept unrecognized response fall through to AI chat'


2026-03-14T17:55:30Z | Fix: Skip videos without captions (webb-resources). Root cause: generateVideo returned the first GPT-picked YouTube video regardless of caption availability, causing webb-video-interpret to fail silently when captions were absent. Fix: (1) Added import { YoutubeTranscript } from 'youtube-transcript' to webb-resources/route.js. (2) Added hasTranscript(videoId) helper wrapping YoutubeTranscript.fetchTranscript. (3) generateVideo: after GPT picks pickedIdx, build ordered list (GPT pick first + remaining candidates) and iterate until one passes hasTranscript. First with captions is returned; if all fail → { unavailable: true }. Recon prompt: skip videos without captions available webb-resources generateVideo YoutubeTranscript.

## 2026-04-01 � Webb objective-steered Socratic questions
Recon: `Mrs. Webb Socratic questioning drive toward incomplete objectives completion goals session`
Problem: buildSystem in webb-chat/route.js only told Mrs. Webb to ask an objective-probing question 'after discussing the video or article', so chat meanders without driving toward completion.
Fix: Changed system prompt to instruct Webb to end EVERY reply with a focused question targeting goal #1 in the remaining objectives list (priority order), bridging naturally from whatever the student just said. Once goal #1 is demonstrated the list automatically shifts to #2.
File: src/app/api/webb-chat/route.js � buildSystem() lines 71-80.

## 2026-04-01 � Webb Research button: media navigation instead of vague recommendation
Recon: `Mrs. Webb Research objective researchMode video chapters article scroll highlight navigate open herself`
Problem: startResearch always called webb-chat researchMode which just vaguely mentioned the video/article title without navigating anywhere.
Fix (3 paths):
  A) Video + chapters: silently loads chapter moments if not yet fetched, uses seekRequest API to pick the best chapter for the objective, opens video and plays that segment, then asks Socratic after playback ends.
  B) Article available: calls webb-interpret with [singleObjective] to pick targeted passages, opens article overlay, highlights + scrolls to those passages, then asks Socratic.
  C) No navigable media: calls new buildDirectTeachSystem (researchDirect:true) which teaches the concept in 2-3 sentences with a real-world example then Socratic � no media mentions.
Files: src/app/session/webb/page.jsx (startResearch), src/app/api/webb-chat/route.js (buildDirectTeachSystem + researchDirect flag).

## 2026-04-07 � Slate transcript save diagnosis
- Recon: 'browser console LEARNER NORMALIZE transcript save errors no errors showing after session'
- Found [LEARNER NORMALIZE] debug log in clientApi.js (line 370) � harmless noise
- Found e.studentAnswer bug: entries built with e.answer, but lines used e.studentAnswer ? all answers '(no answer)'
- Fixed: e.studentAnswer ? e.answer
- Added txStatus state + on-screen '? TRANSCRIPT SAVED' / '? TRANSCRIPT SAVE FAILED' indicator on Slate won screen
- Added console.warn for each early-return condition in save effect
- Commit: 21e55d2
## 2026-04-15 � ban generic lesson title openers
- **Prompt**: "Every single generated lesson starts with 'Exploring'"
- **Root cause**: generate-lesson-outline/route.js prompt had no constraint on generic openers; model defaulted to "Exploring X"
- **Fix**: Added rule to prompt banning Exploring/Understanding/Discovering/Introduction to/etc. Added stripGenericOpener() safety-net function applied server-side before returning the title.
- **File**: src/app/api/generate-lesson-outline/route.js`n

## 2025 � play-dependent-on-work mode
- Recon prompt: "play timers on/off mode, work timer dependant play timer, play phase skipped when work timer runs out, learner settings checkboxes, phase transitions, 30 second timer"
- Files changed: SessionPageV2.jsx, PlayTimeExpiredOverlay.jsx, LearnerEditOverlay.jsx, scripts/add-play-timer-mode-columns.sql
- Summary: Added play_timers_enabled master toggle + play_dependent_on_work sub-toggle to learner settings. When work timer expires before phase completion and dependent mode is on, shows 30-sec WorkExpiredSkipPlay overlay (variant='work-expired') then skips play portion of next phase and jumps straight to work. SQL migration adds both columns with safe defaults (master=true, dependent=false).
- Commit: a80d7ed


## 2025-08-04 � fix phase.go() after skipPlayPortion auto-start
Recon prompt: "play-dependent-on-work phase stuck awaiting-go after work timer expired overlay"
Fix: added phase.go?.() after phase.start({ skipPlayPortion: true }) when workExpiredAutoStart is true in all 4 phase start handlers (comprehension/exercise/worksheet/test) in SessionPageV2.jsx. wait was not needed since the containing functions are not async � go() is event-driven.
Commit: 1b64f65

## 2026-05-03 � Introductory Onboarding Flow

**Recon prompt:** introductory onboarding flow for new accounts: create learner, settings/targets/timers, generate first lesson, activate or schedule lesson, calendar tooltips tutorial

**What was built:**
- src/app/hooks/useOnboarding.js � useOnboarding hook; persists step (0�5) to localStorage + Supabase profiles.onboarding_step
- src/app/components/OnboardingBanner.jsx � contextual step banner shown at top of each onboarding page
- src/app/components/OnboardingChecklist.jsx � floating checklist widget (steps 1�4, progress bar, dismiss)
- src/app/components/CalendarTutorialOverlay.jsx � 6-card modal tutorial shown on first calendar visit
- scripts/add-onboarding-step-column.sql � ALTER TABLE to add onboarding_step column to profiles

**Pages modified:**
- uth/signup/page.js ? sets localStorage step=1, redirects new signups to /facilitator/learners/add?onboarding=1
- uth/callback/route.js ? decodes 
ext param so email-confirm redirects land on add-learner
- acilitator/layout.js ? mounts <OnboardingChecklist> globally in the facilitator shell
- acilitator/learners/add/page.js ? step 1 banner + settings/targets/timers collapsible tip; on save ? advances to step 2 ? generator
- acilitator/generator/page.js ? step 2 banner; on lesson ready ? advances to step 3 ? lessons
- acilitator/lessons/page.js ? step 3 banner with calendar link; on activation ? advances to step 4
- acilitator/calendar/page.js ? mounts CalendarTutorialOverlay at step 4; on complete ? marks onboarding done (step 5)
