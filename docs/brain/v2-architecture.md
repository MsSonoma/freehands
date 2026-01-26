# Session Page V2 Architecture

**Status:** Production-ready - All critical issues from second audit fixed  
**Created:** 2025-12-30  
**Updated:** 2026-01-10  
**Purpose:** Complete architectural rewrite of session page to eliminate coupling, race conditions, and state explosion

---

## Second Audit Critical Fixes (2025-12-31 - Final Pass)

After first round of fixes, second comprehensive audit found 6 additional critical integration bugs. ALL FIXED:

**Post-audit UX/telemetry fixes (2026-01-01)**
- Teaching controls (Next/Repeat/Restart/Skip) are anchored in the fixed footer instead of overlaid on the video to match V1 footer placement and avoid covering the video.
- All Q&A phase controls (Comprehension, Exercise, Worksheet, Test) are anchored in the fixed footer (answer input or MC/TF quick buttons + submit/skip) and must not render as on-video overlays.
- `captionChange` payloads from HTMLAudio now emit `{ index, text }`, keeping transcript rendering consistent with WebAudio/Synthetic paths.
- Session timer interval is bound to the TimerService instance, ensuring `sessionTimerTick` events fire and the on-screen timer advances.
- HTMLAudio path emits the first caption immediately so transcripts populate as soon as playback starts (no blank transcript on first line).
- AudioEngine replays the current caption immediately on `captionChange` subscription so the transcript works even if playback starts before the UI attaches listeners.
- AudioEngine falls back to Synthetic playback (caption scheduling only) when both HTMLAudio and WebAudio playback fail (e.g., invalid base64, decode errors), so transcripts still populate and sessions can proceed even when TTS audio cannot be decoded.
- Captions/transcripts are rendered only in the transcript panel (no on-video caption overlay).
- Fixed AudioEngine initialization race: AudioEngine now retries initialization until the video element ref is available, preventing the Discussion phase Begin button from getting stuck on "Loading..." due to a one-shot effect returning early.
- Teaching phase no longer auto-plays the first sentence; audio waits for the learner's first Next/Repeat click (V1 pacing gate).
- SnapshotService now automatically falls back to localStorage when Supabase snapshot persistence is unavailable (e.g., missing `snapshots` table / schema cache issues), so phase completion saves do not break the session flow.
- Video now plays continuously during TTS playback: removed `#cleanup()` video pause and `onpause` handler that was stopping video between sentences.

**Video priming + audio unlock (2026-01-07)**
- V2 must not start the looping video as an "autoplay unlock" step.
- On the Begin click (`startSession`), V2 must preload/seek the video AND request a video unlock during the trusted user gesture.
- iOS Safari can fail to unlock if the app calls `play()` and then immediately `pause()` in the same tick. The reliable approach is: call `video.play()` inside the gesture, then `pause()` when the `playing` event fires.
- The video must still end in a paused state after priming/unlock.
- Audio unlock must be performed during the Begin click by calling `AudioEngine.initialize()`; relying only on a document-level "first interaction" listener is not sufficient because React `onClick` can run before the listener fires.
- `AudioEngine.initialize()` must be retry-safe and iOS-safe:
  - It must be idempotent and coalesce concurrent calls (auto unlock listener + Begin click can both call it).
  - It must time-box `AudioContext.resume()` so a suspended context cannot deadlock the Begin CTA.
  - It must NOT await the `HTMLAudioElement.play()` promise for the silent unlock clip. On iOS Safari that promise can remain pending; the unlock should be best-effort.
- AudioEngine remains the sole owner of video play/pause during TTS (`#startVideo` on start, `#cleanup` pause on end).

**Idle Begin CTA loading feedback (2026-01-07)**
- When the learner clicks the initial "Begin" (idle phase) or "Resume", the CTA must immediately flip to "Loading..." and disable until `startSession()` returns.
- The Begin CTA must never hang indefinitely.
  - Any awaited Begin-start steps must be time-boxed.
  - On timeout/failure, the CTA must re-enable and show a user-facing error so the learner can retry.
- When the CTA is disabled because prerequisites are still initializing (e.g., snapshot load), the label must not misleadingly show "Loading..." without context.

**Complete Lesson farewell sequencing (2026-01-07)**
- The Test review "Complete Lesson" click plays a short congrats line to hide end-of-lesson load.
- The Closing phase farewell must NOT interrupt that congrats line.
- If congrats audio is playing when Closing begins, defer `ClosingPhase.start()` until the AudioEngine emits `end`.
- Transcript now uses V1's `CaptionPanel` (assistant/user styling, MC stack, vocab highlighting) and saves `{ lines:[{text,role}], activeIndex }` into snapshots. Caption changes and learner submissions append lines with duplicate detection; active caption highlights are restored on load for cross-device continuity. The caption panel auto-scrolls to the newest line, and transcript state resets when Start Over ignores resume so captions do not accumulate across restarts. In portrait mode, the caption panel height is set to 35vh.

**1. AudioEngine.initialize() Method Added** ✅
- Added missing initialize() method with iOS audio unlock
- Creates AudioContext during user gesture
- Plays silent audio to unlock HTMLAudio on iOS (best-effort; do not await `play()`)
- Resumes suspended AudioContext (time-boxed)

**2. AudioEngine captionChange Data Format Fixed** ✅
- Changed emission from numeric index to object with { index, text }
- UI now receives caption text directly
- Captions display correctly

**3. DiscussionPhase Audio API Fixed** ✅
- Changed from play() to playAudio()
- Changed from 'playbackComplete' to 'end' event
- Audio listeners removed in destroy()
- Memory leak fixed

**4. Timer Event Name Standardized** ✅
- Changed SessionPageV2 listener from 'goldenKeyEligibilityChanged' to 'goldenKeyEligible'
- Matches TimerService emission
- Golden key status updates correctly

**5. Shared EventBus Instance Created** ✅
- ONE EventBus instance in eventBusRef.current
- All services receive same EventBus
- Events cross service boundaries correctly
- TimerService, KeyboardService, DiscussionPhase all connected

**6. DiscussionPhase Cleanup Fixed** ✅
- Added audioEngine.off('end', handler) in destroy()
- Prevents orphaned listeners
- No memory leaks

---

## First Audit Critical Fixes (2025-12-31 - Initial Pass)

V2 underwent comprehensive audit comparing to V1 (9,797 lines) and all critical blockers have been fixed:

**1. EventBus Pattern Fixed**
- Created `EventBus.js` - proper EventEmitter-like class with .on() and .emit()
- All services now use EventBus instances instead of simple { emit: fn } objects
- Phase transitions work correctly with event subscriptions

**2. Supabase Client Initialized**
- SnapshotService now receives initialized Supabase client via createBrowserClient
- Database persistence working (localStorage fallback still available)

**3. Audio System Initialized**
- AudioEngine.initialize() called on user interaction
- iOS unlock logic implemented
- Audio playback ready on all platforms

**4. Timer Service Integrated**
- EventBus emits sessionTimerTick, workPhaseTimerTick events
- UI updates reactively to timer events
- Auto-starts when session begins
- Golden key tracking operational

**5. Generated Lesson Support**
- Added regenerate parameter support
- Loads from /api/lesson-engine/regenerate endpoint
- Falls back to test data on error

**6. Service Instantiation Fixed**
- DiscussionPhase receives proper ttsService: { fetchTTS: fn }
- KeyboardService receives EventBus instance
- TimerService receives EventBus instance

---

## V2 Architectural Decisions

### Phase Entry Gating (Begin Buttons) (2026-01-02)

**Decision:** Each Q&A phase (Comprehension, Exercise, Worksheet, Test) uses an explicit **Begin** gate before showing Opening Actions and the **Go** control.

**Rules:**
- The Begin gate state must be **reset on every phase transition**.
- Phase entry must **never** auto-complete a Q&A phase or depend on question array contents. Phase entry must always reach the Begin gate.
- Timeline phase navigation (clicking a phase tile) is allowed, but must be **PIN-gated**.

**Why:** If a prior phase leaves the "opening actions shown" gate enabled, the next phase's Begin CTA can be hidden, leaving the session stuck with the timeline highlighting the new phase but no visible way to start it.

**Why:** If phase entry tries to pre-select questions and then "early exits" (missing targets, empty pools), the app can silently skip the entire phase (and cascade to Closing) before the user ever sees Begin/Opening Actions.

**Implementation notes:**
- On every `phaseChange`, reset the per-phase UI gates (e.g., `showOpeningActions`, any active opening action state, and any games overlay) before rendering the next phase.
- Timeline click-to-skip must call `ensurePinAllowed('timeline')` before navigating.
- Timeline click-to-skip must stop active TTS before jumping (only when speech is currently playing) and then call `PhaseOrchestrator.skipToPhase(targetPhase)`.
- Timeline click-to-skip must not bypass Begin gating; after a jump, the destination phase should still present its Begin CTA (then Opening Actions, then Go).
- Timeline click-to-skip must not resume mid-phase (no resumeState). A timeline jump forces a fresh entry so Opening Actions are always available.
- Use the app alias when importing the PIN gate utility from V2 files: `@/app/lib/pinGate` (relative `../lib/pinGate` is one level short inside `session/v2` and will fail at build time).
- Comprehension initialization must **wait for learnerProfile** to be loaded. If the orchestrator enters Comprehension before learner load completes, the app retries comprehension initialization once `learnerLoading` is false and `learnerProfile` is present.
- Worksheet and Test initialization must follow the same rule as Comprehension: if the orchestrator enters the phase before learner load completes, initialization must be retried after learner load.
- Any helper that reads learner targets must not rely on a stale closure captured before learner load. Use a ref-backed lookup (read the latest learner profile) so phaseChange handlers created early can still access targets later.
- Learner identity must be **pinned at load** (sessionLearnerId). Target overrides must key off the pinned id, not `localStorage.learner_id`, to avoid mid-session drift. Phase init must bail until `learnerProfile` is loaded instead of calling target helpers on null.
- If a Q&A phase is entered before learnerProfile is available, **defer init and retry** after learner load. Begin buttons must call the initializer if the phase ref is null, then start the phase. Play timers must only start after the phase is initialized; if init is deferred, mark the timer pending and start it when init completes.
- End-of-comprehension is **not** end-of-lesson. When Comprehension completes, the app speaks a short transition line and advances the orchestrator to Exercise. The Exercise phase must then show its own Begin gate ("Begin Exercise") before Opening Actions/Go.
- For Q&A phases that select questions from pools, do not compute/slice the question array during phase entry. Do it on **Go** so Begin and Opening Actions are always reachable.
- If required data is missing (e.g., learner targets), fail loudly (blocking error) rather than silently skipping the phase.

**Non-goal:** Do not render large work-timer countdown overlays that obscure the video. Timer UI should be non-blocking and must not cover core interactions.

**Worksheet UI rule:** Do not render Worksheet question/answer controls as on-video overlays. Worksheet answering uses the fixed footer input (same surface as Comprehension/Exercise).

**Test UI rule:** Do not render Test question/answer controls as on-video overlays. Test answering uses the fixed footer input (same surface as Comprehension/Exercise/Worksheet).

**Test speech + parsing rule (MC/TF parity):** When speaking a Test question, MC options must be spoken with letter labels (A., B., C., D.) and included with the question (same utterance). Learner answers may be the letter or the option text.

**Test question sourcing rule:** Test must be able to meet the learner's Test target by sourcing from all allowed pools.
- Prefer `lessonData.test.questions[]` when present (generated lessons).
- Otherwise, build the pool from: `multiplechoice`, `truefalse`, `fillintheblank`, and `shortanswer`.

**Worksheet judging rule (Comprehension parity):** Worksheet uses the same retry loop as Comprehension.
- Judge the learner answer (MC/TF locally; SA/FIB via `/api/judge-short-answer` through `judging.js` with local fallback).
- On wrong attempt 1: speak a gentle retry hint (no UI feedback).
- On wrong attempt 2: speak a stronger hint (no UI feedback).
- On wrong attempt 3: speak the correct answer, then advance to the next question.
- Do not reveal the correct answer in the event log or other UI surfaces on attempts 1-2. Reveals happen only via speech (and optional non-primary logging after the reveal event).

**Worksheet judging data rule:** Worksheet question normalization must preserve answer schema fields (especially `expectedAny[]`).
**Rule:** Worksheet question normalization must preserve all answer schema fields used by judging (especially `expectedAny[]` and `acceptable[]`).
- Do not drop `expectedAny` or `acceptable` when mapping lesson questions into phase-internal objects.
- V2 judging merges `expectedAny[]` + `acceptable[]` (V1 parity). If either is lost, `/api/judge-short-answer` can be sent an empty or incomplete acceptable list.

**Test judging rule (V1 parity):** Test is single-attempt.
- Judge the learner answer (MC/TF locally; SA/FIB via `/api/judge-short-answer` through `judging.js` with local fallback).
- If correct: speak praise, then advance.
- If incorrect: speak the correct answer immediately, then advance.

**Test ticker rule (single-attempt):** The Test question counter must advance on every answered/skipped question.
- Do not derive the question counter from `score` (score only increments on correct answers).
- Use the current question index (questionNumber = questionIndex + 1) so incorrect answers still advance the ticker.

**Test Skip/Next robustness rule (no premature actions):** In Test, user actions must never break the phase even when pressed repeatedly during async work.
- The learner may mash Skip/Submit while question TTS is still loading or while judging is in-flight.
- The phase must not double-advance, throw, or play stale audio for a previously-skipped question.
- When an action advances to a new question while a prior question's TTS fetch is in-flight, the stale fetch result must be discarded (do not play it).
- While a Submit/Skip transition is in-flight, additional Submit/Skip presses must be safely ignored (no double grading, no double skipping).
- The Test intro line ("Time for the test") must also be skippable: the phase must advance to `awaiting-go` on AudioEngine `end` (completed OR skipped) and must not depend on awaiting `playAudio()`.

### Exercise: Inline Q&A (Comprehension Parity) (2026-01-02)

**Decision:** Exercise uses the same inline (V1-style) Q&A flow as Comprehension: questions are spoken via TTS, and the learner answers using the footer input.

**Rules:**
- Questions are spoken via TTS using V1 formatting (`formatQuestionForSpeech` + `ensureQuestionMark`).
- The footer input is the primary answer surface for Exercise (no per-question overlay UI).
- For MC/TF, quick buttons appear (A/B/C/D or True/False) and submit immediately.
- For FIB/SA, the footer shows the text input (same surface as comprehension/worksheet/test) so FITB answers can be typed.
- Worksheet and Test MC/TF also surface quick buttons; only non-MC/TF items show the text input.
- Wrong answers follow V1 retry behavior: hint, hint, then spoken reveal on the 3rd incorrect attempt.

**Implementation notes:**
- Exercise must show "Begin Exercise" on phase entry (Exercise state `awaiting-go`). Question selection must not block this gate.
- Exercise question selection comes only from the allowed pools (TF/MC/FIB/SA) and is limited by the learner target for Exercise.
- Exercise question selection happens on **Go** (lazy initialization). This keeps Begin/Opening Actions independent from pool/target checks.
- If learner targets are missing, Exercise must block with a clear error (no silent fallback; no auto-advance).
- Test decks must stay stable across timeline jumps; only refresh via the hamburger “refresh” action or after completion. Prefer saved deck, then cached generation; rebuild only when none exist.
- Test start must still clamp the deck to the learner target and clamp saved nextQuestionIndex/answers/reviewIndex to that length so completion always enters review after the target count (no extra questions from older snapshots).
- Question pool blending must backfill to the learner target (cycle source pool if dedup leaves fewer items) so decks never stall below target counts.
- Test submit/skip must enter review immediately when the next index reaches deck length (no reliance on follow-up playback), preventing hangs after the last question.
- Praise/reveal playback in Test must await audio completion before advancing to next question, matching WorksheetPhase pattern to prevent overlapping TTS (duplicate "Perfect!" and next question playing together).
- Starting Test must tear down any existing TestPhase instance and stop active audio before rebuilding so duplicate listeners cannot trigger overlapping question/praise/reveal playback.

**Worksheet/Test:** Worksheet and Test follow the same no-skip rule. Missing targets or empty pools must block with a clear error instead of auto-advancing to the next phase.
- The "Go" control in the Opening Actions footer must call the inline Exercise Go handler (not an ExercisePhase controller).
- Keyboard skip for Exercise should route to the inline skip handler, which advances to the next question and preserves the hint/hint/reveal attempt tracking.
- Worksheet question normalization must preserve provided `sourceType`/`type` so MC/TF items stay MC/TF (local judging, quick buttons). Only plain string questions should default to fill-in-blank.

### Question Pool Rules (No `sample`) (2026-01-02)

**Rule:** V2 must not read or depend on `lesson.sample` / `lessonData.sample`.

**Allowed pools:** `truefalse`, `multiplechoice`, `fillintheblank`, `shortanswer`.

**Blend rule:** All Q&A phases (comprehension, exercise, worksheet, test) target roughly 80% MC/TF (primary) and 20% FIB/SA (secondary). Worksheet is no longer FIB-only and Exercise now allows FIB/SA; shortages backfill from whatever remains to hit the target count.

**Why:** `sample` is a killed zombie category (see `docs/reference/KILL_SAMPLE_ARRAY.md`). Any runtime reference tends to spread and causes schema drift.

### Discussion Phase Simplification (2025-12-31)

**Decision:** Remove opening actions (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games) from discussion phase in V2.

**Rationale:**
1. **Play Timer Exploit Elimination** - V1 has infinite play timer hack: learner can refresh during discussion phase to reset play timer indefinitely without ever starting teaching. Removing opening actions from discussion phase eliminates exploit entirely.
2. **Architectural Clarity** - Opening actions are complex multi-step state machines (949 lines in useDiscussionHandlers.js). Removing from discussion phase simplifies V2 architecture while retaining play/work timer modes for phases 2-5 where they provide value.
3. **First-Interaction Gate Obsolete** - With no play time in discussion phase, first-interaction snapshot gate is no longer needed for exploit prevention.

**Implementation:**
- Discussion phase: greeting TTS + single "Begin" button → advances to teaching
- No opening action buttons in discussion phase
- No play timer in discussion phase (instant transition)
- Play/work timer modes still apply to Teaching, Repeat, Transition, Comprehension, Closing phases
- Lesson title in discussion/closing flows comes from `lessonData.title` with `lessonId` fallback; never reference undeclared locals when wiring DiscussionPhase
- The discussion work timer **spans both discussion and teaching**. It starts on discussion entry and must be completed when teaching finishes (not on `discussionComplete`), or the visible timer will freeze as soon as the definitions CTA appears.
- Opening action buttons (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games) appear during play time in phases 2-5

**User Flow:**
1. Learner clicks Start Lesson
2. Discussion phase loads, plays greeting: "Hi [name], ready to learn about [topic]?"
3. Learner clicks "Begin" button
4. Teaching phase starts with play timer (green) - opening action buttons available
5. Learner can interact with opening actions during play time in teaching phase
6. Play timer expires → PlayTimeExpiredOverlay → work timer starts → teaching questions begin

---

## Why V2 Exists

The v1 session page (`src/app/session/page.js`) is a 9,797-line monolith managing 30+ coupled state machines simultaneously:
- Phase/subPhase navigation
- Teaching flow (definitions → examples with sentence-by-sentence gating)
- Audio playback (HTMLAudio vs WebAudio vs Synthetic paths)
- Caption synchronization
- Video coordination
- Question tracking (comprehension, exercise, worksheet, test)
- Discussion activities (Ask, Riddle, Poem, Story, Fill-in-Fun)
- Snapshot persistence
- Timer systems (session timer + 11 phase timers + speech guard)
- Keyboard hotkeys

**Problem:** All systems share state directly via props drilling (~150 props to each hook). Every fix breaks something else because there are no boundaries. Example: Skip hotkey clears audio, but Next Sentence hotkey fires immediately after, advancing teaching stage while audio system thinks playback is still active → examples stage plays no audio.

**Solution:** V2 implements clean architectural boundaries with event-driven communication. Systems don't manipulate each other's state—they emit events and react to events.

---

## Migration Strategy: Parallel Implementation (Option C)

**NOT incremental extraction** (half-migrated broken state)  
**NOT phase-by-phase rewrite** (coordinating multiple systems per phase)  
**YES parallel implementation** (old system intact, new system feature-flagged)

### Direct Test Access

**Test route:** `http://localhost:3001/session/v2test`

Navigate directly to the V2 test harness without feature flags or V1 flow. This is a standalone test page for AudioEngine validation.

### Feature Flag (for production integration later)
```javascript
// Enable V2 in browser console:
localStorage.setItem('session_architecture_v2', 'true');

// Disable (revert to V1):
localStorage.removeItem('session_architecture_v2');
window.location.reload();
```

Note: Feature flag only works when already on a session page. For testing, use the direct route above.

### Implementation Sequence

**Week 1: Audio Engine**
- Build `src/app/session/v2/AudioEngine.jsx`
- Manages all audio playback (HTML/WebAudio/Synthetic)
- Manages caption synchronization
- Manages video coordination
- Exposes: `playAudio(base64, sentences)`, `stopAudio()`, events: `onAudioEnd`, `onCaptionChange`
- Test independently with hardcoded sentences

**Week 2: Teaching Controller**
- Build `src/app/session/v2/TeachingController.jsx`
- Manages teaching stage machine (definitions → examples)
- Manages sentence-by-sentence navigation
- Consumes AudioEngine for playback
- Exposes: events: `onTeachingComplete`
- Test definitions + examples flow in isolation

**Week 3: Snapshot Compatibility**
- Wire V2 to read V1 snapshot format (migration layer)
- V1 snapshots continue working (forward-compatible)
- V2 writes both old + new formats during transition
- Don't enable saving yet (read-only validation)

**Week 4: Single Learner Test**
- Enable V2 for one test learner
- Monitor Teaching examples bug specifically
- Compare behavior vs V1 side-by-side

**Week 5: Facilitator Rollout**
- Enable V2 for facilitator's own learners
- Controlled rollout with opt-in per learner

**Week 6: Default Flip**
- Make V2 the default
- V1 becomes opt-in (localStorage flag inverted)
- Monitor for regressions

**Week 7+: Cleanup**
- Remove V1 code once V2 proven stable for 2 weeks
- Delete page.js, rename SessionPageV2.jsx → page.js
- Archive v1 implementation in git history

---

## Core Architectural Principles

### 1. Event-Driven Communication
Systems emit events, don't call each other's functions directly.

```javascript
// ❌ V1 (direct coupling)
audioSystem.playAudio(base64);
teachingSystem.advanceSentence();
snapshotSystem.save();

// ✅ V2 (event-driven)
audioEngine.emit('play', { base64, sentences });
// TeachingController listens:
audioEngine.on('audioEnd', () => {
  this.emit('sentenceComplete');
});
// PhaseOrchestrator listens:
teachingController.on('teachingComplete', () => {
  this.transitionToComprehension();
});
```

### 2. Single Source of Truth
Each system owns its state. No refs + state duplication.

```javascript
// ❌ V1 (double-sourced)
const [captionIndex, setCaptionIndex] = useState(0);
const captionIndexRef = useRef(0);
// Ref and state can diverge

// ✅ V2 (single source)
class AudioEngine {
  #captionIndex = 0; // Private field, only AudioEngine mutates
  getCurrentCaptionIndex() { return this.#captionIndex; }
}
```

### 3. Deterministic State Updates
State changes in predictable order via promise chains.

```javascript
// ❌ V1 (race conditions)
scheduleSaveSnapshot('example-2').catch(...); // Fire and forget
await speakFrontend(sentence); // Blocks, but save may complete first

// ✅ V2 (deterministic)
await teachingController.advanceSentence();
  // → Waits for audio to complete
  // → Then saves snapshot
  // → Then advances index
```

### 4. Independent Testing
Each component can be tested without the full page context.

```javascript
// ✅ V2 (unit testable)
const engine = new AudioEngine();
engine.playAudio('base64data', ['Sentence 1', 'Sentence 2']);
expect(engine.isPlaying).toBe(true);
```

---

## System Boundaries (Planned)

### AudioEngine Component
**Owns:**
- Audio playback state (HTMLAudio vs WebAudio vs Synthetic)
- Caption timing and synchronization
- Video play/pause coordination
- Mute state
- Speech guard timer

**Exposes:**
- `playAudio(base64, sentences, options)`
- `stopAudio()`
- `pauseAudio()`
- `resumeAudio()`
- Events: `onAudioStart`, `onAudioEnd`, `onCaptionChange`

**Does NOT:**
- Know about teaching stages
- Know about phase transitions
- Mutate phase state

### Video Playback Coordination

**How It Works:**
1. Video element has `loop`, `playsInline`, `muted`, and `preload="auto"` props - NO `autoPlay`
2. Video is preloaded on page load but remains paused
3. When user clicks Begin button, `startSession()` unlocks video playback:
   - Checks if video needs load: `if (videoRef.current.readyState < 2)` → `videoRef.current.load()`
   - Waits 100ms for load to register
   - Seeks to first frame: `videoRef.current.currentTime = 0`
   - Attempts to play: `await videoRef.current.play()`
   - If play fails, uses fallback: `play().then(pause()).then(play())` to unlock Chrome autoplay
4. After unlock, video loops continuously (has `loop` attribute)
5. Video continues looping throughout entire session - provides brand immersion
6. **iOS-safe playback:** AudioEngine uses `playVideoWithRetry()` utility for robust mobile playback:
   - Waits for video `readyState >= 2` (HAVE_CURRENT_DATA)
   - Handles `ended` state by resetting `currentTime` to 0
   - Implements exponential backoff with 3 retry attempts
   - Listens for `loadeddata`/`canplay` events with timeout fallback
   - Prevents session breakage if video fails to play

**Why This Pattern:**
- Chrome autoplay policy requires user gesture before video/audio can play
- V2 matches V1's exact behavior: preload → user gesture unlock → continuous loop
- Preloading during page load ensures smooth playback start
- Fallback pattern (play→pause→play) handles edge cases where first play() is blocked
- **iOS Safari is finicky with video.play()** - requires readyState checks, event listeners, and retries
- V1's `playVideoWithRetry()` function proven reliable across iOS/Chrome/Safari

**Key Files:**
- `SessionPageV2.jsx` lines 1304-1340: `startSession()` function with video unlock
- `SessionPageV2.jsx` lines 1495-1507: Video element with preload settings and onLoadedMetadata handler
- `AudioEngine.jsx` lines 617-626: `#startVideo()` method using `playVideoWithRetry()`
- `utils/audioUtils.js` lines 10-68: `playVideoWithRetry()` utility with iOS edge case handling

**What NOT To Do:**
- ❌ Don't add `autoPlay` prop - violates Chrome policy and defeats unlock pattern
- ❌ Don't pause video when audio stops - video loops continuously (brand immersion)
- ❌ Don't try to sync video play/pause with isSpeaking state - video always loops once unlocked
- ❌ Don't use simple `video.play()` without retry logic - breaks on iOS Safari

### TeachingController Component
**Owns:**
- Teaching stage machine (idle → definitions → examples)
- Sentence navigation state (current index, total count)
- Gate button state (Repeat/Next visibility)
- Vocabulary and example sentences
- **GPT-based content generation** (definitions, examples, gate prompts)
- **Background prefetching** (zero-latency teaching flow)

**Architecture (matches V1 `useTeachingFlow.js`):**
- Definitions and examples are **NOT read from JSON** - they are generated by GPT
- Vocab terms are extracted from `lessonData.vocab` (just the terms, not definitions)
- `#fetchDefinitionsFromGPT()` calls `/api/sonoma` with kid-friendly instruction
- `#fetchExamplesFromGPT()` calls `/api/sonoma` for real-world usage examples
- `#fetchGatePromptFromGPT(stage)` calls `/api/sonoma` for sample questions
- GPT responses are split into sentences via `#splitIntoSentences()` for pacing
- Constructor accepts `lessonMeta: { subject, difficulty, lessonId, lessonTitle }`

**Zero-Latency Prefetch Strategy:**
- `prefetchAll()` triggered on Begin click (deferred to next tick so it does not block the UI)
- Prefetch is **single-flight** (subsequent calls are ignored)
- GPT calls are **staggered** to reduce 429 risk:
  - Start definitions first
  - Start examples only after definitions resolves (or fails)
  - Gate prompts start after their parent stage begins
- GPT calls run in background during discussion greeting (~3-5 seconds)
- When teaching starts, prefetched data is awaited (often already complete)
- TTS prefetched for first 3 sentences of each stage + gate prompt text
- **No loading states** - UI never shows "loading" for teaching content
- Prefetch chain: GPT completes → automatically prefetches TTS for sentences

**Retry + Rate Limit Handling:**
- If GPT returns 429, TeachingController enters a cooldown and produces a deterministic "wait then press Next" sentence
- If GPT returns 500+ (or the fetch throws), TeachingController shows a generic server error message (not rate limit)
- When a non-429 error message is shown, the next Next/Repeat/Restart action triggers an actual retry fetch (instead of advancing past the error sentence and effectively skipping the stage)
- Next/Repeat/Restart must not spam GPT requests during cooldown
- Public methods called without `await` (Repeat/Skip/Restart) must not generate unhandled promise rejections

**Environment Variable Requirements:**
- At least one LLM provider key must be configured: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- Google TTS requires: `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON file) or `GOOGLE_TTS_CREDENTIALS` (inline JSON or base64)
- Dev server must be restarted after adding/changing `.env.local` to load new environment variables
- Missing keys cause 500 errors (not 429s); TeachingController now distinguishes these in user-facing messages

**Gate Prompt Flow (uses prefetched content):**
1. Speak "Do you have any questions?" (TTS prefetched)
2. Await prefetched GPT result (usually instant)
3. Speak GPT-generated sample questions (TTS prefetched)
4. Fallback if GPT failed: deterministic questions using lesson title

**Exposes:**
- `prefetchAll()` - start all background prefetches (call on Begin)
- `startTeaching(lessonData)`
- `advanceSentence()`
- `repeatSentence()`
- `skipToExamples()`
- Events: `onStageChange`, `onSentenceAdvance`, `onTeachingComplete`

**Does NOT:**
- Play audio directly (delegates to AudioEngine via events)
- Save snapshots (emits events for PhaseOrchestrator to handle)
- Control phase transitions
- Read definitions/examples from JSON (always calls GPT)
- Emit 'loading' stage changes (prefetch eliminates most loading states; only surfaced when the learner clicks and definitions/examples are still loading)

**Race Condition Fix (2026-01-03):**
When user presses Next/Skip during intro audio (e.g., "First let's go over some definitions"), the GPT content may not be ready yet. Fixed with async content awaiting:

**Stage Machine:**
- `idle` → `loading-definitions` → `definitions` → `loading-examples` → `examples` → `complete`
- Loading stages (`loading-definitions`, `loading-examples`) track when intro is playing and GPT is being fetched

**nextSentence() / repeatSentence() Async Behavior:**
- If called during `loading-definitions`: stops intro audio, awaits `#ensureDefinitionsLoaded()`, sets stage to `definitions`, plays first sentence
- If called during `loading-examples`: stops intro audio, awaits `#ensureExamplesLoaded()`, sets stage to `examples`, plays first sentence
- Emits `'loading'` event when awaiting GPT (UI can show spinner if needed)

**Double-Load Prevention:**
- `#startDefinitions()` checks if stage changed during intro (user already triggered nextSentence)
- If stage changed, content is already loaded and playing - exits early to avoid double-load
- Same pattern in `#startExamples()`

**User Experience:**
- User can press Next/Skip anytime - never blocked
- If content not ready, brief wait then plays (no forced finishes)
- If content ready, plays immediately (zero latency from prefetch)
- Teaching CTA label is **stage-driven** (not "first click" driven):
  - Shows "Continue to Definitions" only while `teachingStage === 'idle'` (pre-definitions)
  - Shows "Next Sentence" while reading sentence-by-sentence
  - Shows "Continue to Examples" at the definitions gate
  - Shows "Complete Teaching" at the examples gate
  - Must remain correct after refresh/resume (no local "first click" state)
- If definitions/examples are still loading after a click, the button shows loading feedback and disables Repeat until content is ready
- During the definitions gate, the "Continue to Examples" button is hidden while the "Do you have any questions?" + suggested questions audio plays and only appears after that sequence finishes

### PhaseOrchestrator Component
**Owns:**
- Phase state (discussion, teaching, comprehension, ...)
- SubPhase state
- Phase transition logic
- Snapshot save/restore coordination

**Exposes:**
- `startSession()` - starts at Discussion (if enabled) or Teaching
- `startSession({ startPhase })` - starts directly at the requested phase (used by Resume)
- `skipToPhase(phase)` - manual navigation (e.g., timeline jumps)
- Events: `phaseChange`, `sessionComplete`

**Does NOT:**
- Render UI (presentation components subscribe to events)
- Play audio
- Manage teaching sentence state

---

## What NOT To Do

### ❌ Don't Mix V1 and V2 Code
- Keep V1 (`page.js`) completely untouched except for feature flag check
- Don't import V2 components into V1 hooks
- Don't share utility functions between V1 and V2 (duplicate if needed)

### ❌ Don't Rush Extraction
- Build each component fully before wiring to next
- Test each component in isolation before integration
- Don't skip stub → isolated test → integration test sequence

### ❌ Don't Break Snapshots
- V2 must read V1 snapshot format perfectly
- Test snapshot restore on real session data before enabling writes
- Keep dual-write (V1 + V2 formats) until all active sessions migrated

### ❌ Don't Assume V2 is Better Until Proven
- Validate Teaching examples bug is actually fixed
- Verify no regressions in other flows (comprehension, exercise, worksheet, test)
- Get facilitator signoff before defaulting to V2

---

## Current Implementation Status

### ✅ Completed
- Feature flag check in `page.js` (lines 65-69)
- V2 stub component (`SessionPageV2.jsx`)
- Brain file documentation (this file)
- Manifest entry
- Changelog entry
- Q&A judging parity: Comprehension now matches V1 retry flow (hint, hint, reveal on 3rd) and does NOT advance on incorrect answers; Exercise/Worksheet match the same retry + reveal behavior; Test remains single-attempt grading with correct-answer reveal. SA/FIB route through `/api/judge-short-answer` with local fallback; MC/TF use V1-style local leniency (letters, TF synonyms).
- **AudioEngine component** (`src/app/session/v2/AudioEngine.jsx`) - 600 lines
  - Three playback paths: HTMLAudio (preferred), WebAudio (iOS), Synthetic (no audio)
  - Event-driven architecture (start, end, captionChange, captionsDone, error)
  - Single source of truth (no ref/state duplication)
  - Deterministic caption timing (one timer system)
  - Self-contained video coordination
  - Pause/resume support
  - Speech guard timeout
- **AudioEngine tests** (`AudioEngine.test.jsx`) - Unit tests + manual browser test helpers
- **PhaseOrchestrator component** (`src/app/session/v2/PhaseOrchestrator.jsx`) - 150 lines
  - Manages session phase flow: teaching → comprehension → closing
  - Owns phase state machine
  - Emits phaseChange, sessionComplete events
  - Consumes phase completion events
  - Zero knowledge of phase implementation details
- **ComprehensionPhase** - DEPRECATED (2026-01-03)
  - **No longer used** - comprehension is now handled inline in SessionPageV2
  - V2 uses V1's multi-question pattern instead of single-question class
  - Questions loaded from lesson pools: truefalse, multiplechoice, fillintheblank, shortanswer
  - Questions shuffled and limited to the learner's configured target
    - Source of truth: Learners page "Learning Targets" overlay (stored on learner record)
    - Fields supported (all phases): learner.{comprehension,exercise,worksheet,test} (normalized), learner.targets.{comprehension,exercise,worksheet,test}, or the JSON-string `targets` column (parsed if Supabase returns it as text)
    - Legacy compatibility: comprehension also accepts the V1 alias `discussion` (flat or targets.discussion) so older learner rows keep working without defaults
    - Also honors V1 per-learner overrides stored in localStorage (`target_{phase}_{learnerId}` or `target_{phase}`) when those values are positive (user-set only; no defaults)
    - No fallback: V2 does not default targets. If targets are missing/invalid, the session blocks with a Learner Required error and directs facilitators back to the Learners page to set targets.
    - Ticker behavior: the top-right score ticker uses learner targets for its denominator and does not display default targets while learner data is loading
  - Questions spoken via TTS, user types answer in footer input
  - State: generatedComprehension (array), currentCompIndex, currentCompProblem
  - Handlers: handleComprehensionGo (speaks question), handleComprehensionSubmit (validates; holds on incorrect with hint/hint/reveal after 3 tries), handleComprehensionSkip
  - Judging: shared V2 judging helper `src/app/session/v2/judging.js`
    - MC/TF: local judge (`isAnswerCorrectLocal`) with acceptable list that includes letters + option text
    - SA/FIB: POST `/api/judge-short-answer` then fallback to local judge
  - Video overlay removed - uses footer input during awaiting-answer state
  - Quick-answer buttons (MC/TF): clicking a quick button submits that answer immediately and does not populate the text input
  - Quick-answer layout matches V1: centered dark pill buttons; MC renders letters only (A-D), TF shows True/False labels
- **DiscussionPhase component** (`src/app/session/v2/DiscussionPhase.jsx`) - 200 lines
  - Manages discussion activities: Ask, Riddle, Poem, Story, Fill-in-Fun
  - Plays prompt with TTS
  - Captures student response (typed text)
  - Cycles through multiple activities in sequence
  - Emits discussionComplete when all activities done
  - Zero coupling to other phases
- **ClosingPhase component** (`src/app/session/v2/ClosingPhase.jsx`) - 150 lines
  - Plays encouraging closing message with TTS
  - Randomly selected from predefined messages
  - Emits closingComplete event
  - Zero coupling to other phases
- **ExercisePhase component** (`src/app/session/v2/ExercisePhase.jsx`) - 300 lines
  - Multiple choice and true/false questions with scoring
  - Question count is limited to the learner's configured target (exercise)
  - Plays each question with TTS
  - Displays answer options (radio buttons)
  - Validates answers via shared judging helper (`judging.js`) and tracks score
    - Accepts MC letters (A-D) and option text (V1 parity)
  - Question sourcing supports both lesson schemas:
    - Generated lesson schema: lessonData.exercise.questions[]
    - V1 pool schema fallback: lessonData.multiplechoice[] + lessonData.truefalse[]
  - Emits exerciseComplete with final score and percentage
  - Zero coupling to other phases
- **WorksheetPhase component** (`src/app/session/v2/WorksheetPhase.jsx`) - 300 lines
  - Fill-in-blank questions with text input
  - Question count is limited to the learner's configured target (worksheet)
  - Plays each question with TTS
  - Answer UI is rendered in SessionPageV2 using the fixed footer input (supports Enter key)
  - Validates answers via shared judging helper (`judging.js`)
    - FIB uses `/api/judge-short-answer` with local fallback
  - Shows instant feedback (correct/incorrect with answer)
  - Tracks score and emits worksheetComplete
  - Question sourcing supports both lesson schemas:
    - Generated lesson schema: lessonData.worksheet.questions[]
    - V1 pool schema fallback: lessonData.fillintheblank[]
  - Zero coupling to other phases
- **TestPhase component** (`src/app/session/v2/TestPhase.jsx`) - 400 lines
  - Graded assessment with MC/TF/fill-in questions
  - Question count is limited to the learner's configured target (test)
  - Plays each question with TTS
  - Mixed question types (radio buttons for MC/TF, text input for fill-in)
  - Tracks all answers and calculates grade (A-F)
  - Judging: shared judging helper (`judging.js`)
    - FIB uses `/api/judge-short-answer` with local fallback
    - MC/TF uses local judge with letter/synonym acceptance
  - Question sourcing supports both lesson schemas:
    - Generated lesson schema: lessonData.test.questions[]
    - V1 pool schema fallback: mix of lessonData.multiplechoice[] + lessonData.truefalse[] + lessonData.fillintheblank[]
  - Review mode shows all questions with correct/incorrect highlighting
  - Navigation: previous/next review, skip review
  - Emits testComplete with grade and percentage
  - Zero coupling to other phases
- **SnapshotService** (`src/app/session/v2/SnapshotService.jsx`) - 300 lines
  - Saves session progress after each phase completion
  - Loads existing snapshot on session start (resume capability)
  - Atomic saves (no partial writes)
  - Stores phase completion, scores, answers
  - Deletes snapshot on session complete
  - Supabase integration with localStorage fallback
  - Zero coupling to phase components
- **TimerService** (`src/app/session/v2/TimerService.jsx`) - 350 lines
  - Session timer: Tracks total session duration
  - Work phase timers: Tracks exercise, worksheet, test times
  - Golden key tracking: 3 on-time work phase completions
  - Time limits: Exercise 3min, Worksheet 5min, Test 10min
  - Serialization for snapshot persistence
  - Emits timer events (tick, complete, eligible)
  - Zero coupling to phase components
- **KeyboardService** (`src/app/session/v2/KeyboardService.jsx`) - 150 lines
  - Keyboard hotkey management
  - Hotkeys: PageDown (skip), PageUp (repeat), End (next), Space (pause), Escape (stop)
  - Context-aware: Different hotkeys available per phase
  - Prevents default browser behavior
  - Ignores hotkeys when typing in inputs (except PageUp/PageDown)
  - Zero coupling to phase components
- **Services layer** (`src/app/session/v2/services.js`) - API integrations
  - fetchTTS(): Calls /api/tts endpoint, returns base64 audio
  - loadLesson(): Fetches built-in lesson JSON from /lessons/{subject}/{key}.json (math/science/language arts/social studies)
  - Generated lessons: SessionPageV2 handles `subject=generated` by requiring a Supabase session (canonical browser client), normalizing the lesson filename to `.json`, and calling `/api/facilitator/lessons/get?file={lessonId}` with an `Authorization: Bearer {access_token}` header. The API derives `userId` from the token (no userId query param, no auth fallbacks). If no session user/token exists, it surfaces a sign-in error.
  - generateTestLesson(): Fallback test data
  - Zero coupling to components or state
- **Complete Session Flow UI** (`SessionPageV2.jsx` updated) - 1820 lines
  - PhaseOrchestrator initialization with discussion enabled
  - SnapshotService initialization and auto-save after each phase
  - TimerService initialization with session + work phase timers
  - KeyboardService initialization with phase-aware hotkeys
  - Broadcasts `ms:session:title` with the lesson title so HeaderBar shows the active lesson in mobile landscape (V1 parity)
  - Phase-specific controls (discussion, teaching, comprehension, exercise, worksheet, test with review, closing)
  - Automatic phase transitions
  - Real lesson loading and TTS audio
  - Keyboard hotkeys: PageDown skip, PageUp repeat, End next, Space pause/resume, Escape stop
  - Hotkey display panel showing available shortcuts
  - Timer display: Session time, work phase time, time remaining, golden key status
  - Discussion controls: Multiple activities, text response, Submit, Skip (hotkey enabled)
  - Teaching controls: Start, Next, Repeat, Restart, Skip (hotkey enabled)
  - Comprehension controls: Answer input, Submit, Skip (hotkey enabled)
  - Exercise controls: Radio button answer selection, Submit, Skip (hotkey enabled, with timer)
  - Exercise scoring: Live score display, percentage calculation, on-time status
  - Worksheet controls: Answer input in fixed footer (Enter submits), Submit/Skip (hotkey enabled, with timer); no on-video Worksheet overlays
  - Worksheet feedback: Instant correct/incorrect display with correct answer, on-time status
  - Test controls: Answer input in fixed footer (Enter submits); no on-video Test Q&A overlays
  - Test grading: Letter grade (A-F), percentage, on-time status
  - Test review: Question-by-question review with correct answers highlighted, Previous/Next navigation
  - Golden key award: Eligibility is displayed when 3 work phases complete on-time; on Complete Lesson, SessionPageV2 increments the learner's `golden_keys` inventory in Supabase (the /learn/lessons toast is only a notification flag and is not the source of truth)
  - Closing phase: Displays encouraging message
  - Audio transport controls: Stop, Pause, Resume, Mute (with Space hotkey)
  - Snapshot auto-save: Saves after discussion, teaching, comprehension, exercise, worksheet, test completion
  - Snapshot resume: Loads on start, displays resume phase
  - Live displays: Current phase, session time, work phase time, golden key status, hotkey legend
  - Event log showing all component events including hotkey presses and timer milestones
  - Flow: Start Session → Discussion (Ask/Riddle/Poem/Story/Fill-in-Fun) → Teaching (definitions → examples) → Comprehension (question → answer) → Exercise (MC/TF scoring + timer) → Worksheet (fill-in-blank + timer) → Test (graded with review + timer) → Closing (encouragement) → Complete (show final time + golden key)

### 🚧 In Progress
- None (all critical issues fixed, ready for testing)

### 📋 Next Steps
1. Browser test: Full session flow with EventBus event coordination
2. Browser test: Verify Supabase snapshot persistence
3. Browser test: Verify audio initialization on iOS
4. Browser test: Verify timer events update UI correctly
5. Browser test: Verify golden key award persistence (3 on-time completions increments `learners.golden_keys`)
6. Browser test: Verify generated lesson loading
7. Production deployment with feature flag

---

## Related Brain Files

- **[snapshot-persistence.md](snapshot-persistence.md)** - V2 reimplements snapshot system with SnapshotService
- **[timer-system.md](timer-system.md)** - V2 reimplements timers with TimerService
- **[tts-prefetching.md](tts-prefetching.md)** - V2 reimplements TTS with AudioEngine
- **[ms-sonoma-teaching-system.md](ms-sonoma-teaching-system.md)** - V2 reimplements teaching flow with TeachingController

## Key Files

**V2 Implementation:**
- `src/app/session/v2/SessionPageV2.jsx` - Complete session flow UI (3500+ lines, includes comprehension logic)
- `src/app/session/v2/AudioEngine.jsx` - Audio playback system (600 lines)
- `src/app/session/v2/TeachingController.jsx` - Teaching stage machine with TTS (400 lines)
- `src/app/session/v2/ComprehensionPhase.jsx` - DEPRECATED, not used (comprehension handled inline in SessionPageV2)
- `src/app/session/v2/DiscussionPhase.jsx` - Discussion activities (200 lines)
- `src/app/session/v2/ExercisePhase.jsx` - Exercise questions with scoring (300 lines)
- `src/app/session/v2/WorksheetPhase.jsx` - Fill-in-blank questions (300 lines)
- `src/app/session/v2/TestPhase.jsx` - Graded test with review (400 lines)
- `src/app/session/v2/ClosingPhase.jsx` - Closing message with encouragement (150 lines)
- `src/app/session/v2/PhaseOrchestrator.jsx` - Session phase management (150 lines)
- `src/app/session/v2/SnapshotService.jsx` - Session persistence (300 lines)
- `src/app/session/v2/TimerService.jsx` - Session and work phase timers (350 lines)
- `src/app/session/v2/KeyboardService.jsx` - Keyboard hotkey management (150 lines)
- `src/app/session/v2/services.js` - API integration layer (TTS + lesson loading, includes question pools)
- `src/app/session/v2test/page.jsx` - Direct test route

**V1 Implementation (keep intact):**
- `src/app/session/page.js` - Original monolith (9,797 lines)
- `src/app/session/hooks/useTeachingFlow.js` - Teaching logic (923 lines)
- `src/app/session/hooks/useAudioPlayback.js` - Audio logic (603 lines)
- All other hooks remain untouched

**Documentation:**
- `docs/brain/v2-architecture.md` - This file (canonical reference)
- `docs/brain/manifest.json` - Brain index (includes v2-architecture entry)
- `docs/brain/changelog.md` - Change log (parallel implementation entry)

---

## Decision Log

**2025-12-30:** Chose Option C (parallel implementation) over Options A (incremental extraction) and B (phase-by-phase rewrite). Rationale: A and B both leave the codebase in broken hybrid states during migration. C keeps V1 working 100% until V2 is proven stable. Feature flag enables instant rollback. Gradual per-learner rollout reduces risk.

**2025-12-30:** Created separate brain file (v2-architecture.md) instead of updating existing ms-sonoma-teaching-system.md. Rationale: V2 is a complete architectural rewrite, not an incremental fix. Keeping separate documentation prevents confusion between V1 maintenance and V2 development. Once V2 replaces V1, we can merge/archive this brain file.
