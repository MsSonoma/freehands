# Session Page V2 Architecture

**Status:** Complete session flow (teaching → comprehension → exercise → worksheet → test → closing)  
**Created:** 2025-12-30  
**Purpose:** Complete architectural rewrite of session page to eliminate coupling, race conditions, and state explosion

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

### TeachingController Component
**Owns:**
- Teaching stage machine (idle → definitions → examples)
- Sentence navigation state (current index, total count)
- Gate button state (Repeat/Next visibility)
- Vocabulary and example sentences

**Exposes:**
- `startTeaching(lessonData)`
- `advanceSentence()`
- `repeatSentence()`
- `skipToExamples()`
- Events: `onStageChange`, `onSentenceAdvance`, `onTeachingComplete`

**Does NOT:**
- Play audio directly (delegates to AudioEngine via events)
- Save snapshots (emits events for PhaseOrchestrator to handle)
- Control phase transitions

### PhaseOrchestrator Component
**Owns:**
- Phase state (discussion, teaching, comprehension, ...)
- SubPhase state
- Phase transition logic
- Snapshot save/restore coordination

**Exposes:**
- `transitionToPhase(phaseName)`
- Events: `onPhaseChange`

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
- **ComprehensionPhase component** (`src/app/session/v2/ComprehensionPhase.jsx`) - 200 lines
  - Plays comprehension question with TTS
  - Captures kid's typed answer
  - Simple validation (answer exists)
  - Emits comprehensionComplete event
  - Zero coupling to other phases
- **ClosingPhase component** (`src/app/session/v2/ClosingPhase.jsx`) - 150 lines
  - Plays encouraging closing message with TTS
  - Randomly selected from predefined messages
  - Emits closingComplete event
  - Zero coupling to other phases
- **ExercisePhase component** (`src/app/session/v2/ExercisePhase.jsx`) - 300 lines
  - Multiple choice and true/false questions with scoring
  - Plays each question with TTS
  - Displays answer options (radio buttons)
  - Validates answers and tracks score
  - Emits exerciseComplete with final score and percentage
  - Zero coupling to other phases
- **WorksheetPhase component** (`src/app/session/v2/WorksheetPhase.jsx`) - 300 lines
  - Fill-in-blank questions with text input
  - Plays each question with TTS
  - Text input for answers (supports Enter key)
  - Validates answers (case-insensitive, partial matching)
  - Shows instant feedback (correct/incorrect with answer)
  - Tracks score and emits worksheetComplete
  - Zero coupling to other phases
- **TestPhase component** (`src/app/session/v2/TestPhase.jsx`) - 400 lines
  - Graded assessment with MC/TF/fill-in questions
  - Plays each question with TTS
  - Mixed question types (radio buttons for MC/TF, text input for fill-in)
  - Tracks all answers and calculates grade (A-F)
  - Review mode shows all questions with correct/incorrect highlighting
  - Navigation: previous/next review, skip review
  - Emits testComplete with grade and percentage
  - Zero coupling to other phases
- **Services layer** (`src/app/session/v2/services.js`) - API integrations
  - fetchTTS(): Calls /api/tts endpoint, returns base64 audio
  - loadLesson(): Fetches lesson JSON from /lessons/{subject}/{key}.json
  - generateTestLesson(): Fallback test data
  - Zero coupling to components or state
- **Complete Session Flow UI** (`SessionPageV2.jsx` updated) - 1200 lines
  - PhaseOrchestrator initialization and event handling
  - Phase-specific controls (teaching, comprehension, exercise, worksheet, test with review, closing)
  - Automatic phase transitions
  - Real lesson loading and TTS audio
  - Teaching controls: Start, Next, Repeat, Restart, Skip
  - Comprehension controls: Answer input, Submit, Skip
  - Exercise controls: Radio button answer selection, Submit, Skip
  - Exercise scoring: Live score display, percentage calculation
  - Worksheet controls: Text input with Enter key support, Submit, Skip
  - Worksheet feedback: Instant correct/incorrect display with correct answer
  - Test controls: Mixed UI (radio/text based on question type), Submit, Skip
  - Test grading: Letter grade (A-F) and percentage
  - Test review: Question-by-question review with correct answers highlighted, Previous/Next navigation
  - Closing phase: Displays encouraging message
  - Audio transport controls: Stop, Pause, Resume, Mute
  - Live displays: Current phase, current sentence, live caption, system state
  - Event log showing all component events
  - Flow: Start Session → Teaching (definitions → examples) → Comprehension (question → answer) → Exercise (MC/TF scoring) → Worksheet (fill-in-blank) → Test (graded with review) → Closing (encouragement) → Complete

### 🚧 In Progress
- None (complete session flow: teaching → comprehension → exercise → worksheet → test → closing → complete)

### 📋 Next Steps
1. Browser test: Full session flow with all assessment phases
2. Browser test: Verify test review navigation and grading
3. Build discussion activities (Ask, Riddle, Poem, Story, Fill-in-Fun)
4. Add snapshot persistence (save/restore after each phase)
5. Add timer integration (session + work phase timers)
6. Add keyboard hotkeys (PageUp/PageDown, Space, etc.)
7. Add Mr. Mentor integration (counselor flow)

---

## Key Files

**V2 Implementation:**
- `src/app/session/v2/SessionPageV2.jsx` - Complete session flow UI (1200 lines)
- `src/app/session/v2/AudioEngine.jsx` - Audio playback system (600 lines)
- `src/app/session/v2/TeachingController.jsx` - Teaching stage machine with TTS (400 lines)
- `src/app/session/v2/ComprehensionPhase.jsx` - Comprehension question flow (200 lines)
- `src/app/session/v2/ExercisePhase.jsx` - Exercise questions with scoring (300 lines)
- `src/app/session/v2/WorksheetPhase.jsx` - Fill-in-blank questions (300 lines)
- `src/app/session/v2/TestPhase.jsx` - Graded test with review (400 lines)
- `src/app/session/v2/ClosingPhase.jsx` - Closing message with encouragement (150 lines)
- `src/app/session/v2/PhaseOrchestrator.jsx` - Session phase management (150 lines)
- `src/app/session/v2/services.js` - API integration layer (TTS + lesson loading)
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
