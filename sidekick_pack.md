# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Ms. Sonoma session page layout video transcript TTS responsive landscape portrait side by side stacked mute skip buttons overlay video looping speaking animation
```

Filter terms used:
```text
TTS
sonoma
session
page
layout
video
transcript
responsive
landscape
portrait
side
stacked
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-11 21:39` — curriculum preferences generate-lesson-outline context generation one day lesson planner single day broken
- `2026-03-13 10:15` — Mrs. Webb chat teacher button on learn page, like Ms Sonoma and Mr Slate, with validator layers, OpenAI moderation, stat
- `2026-03-13 11:54` — Mrs. Webb lesson flow session page ContentViewer VideoPlayer TextReader RemediationPanel RewardVideo state machine prese

---

## [REMINDER] Copilot Self-Recon Obligation

**THREAD FIRST, PACK SECOND.** This pack is supplementary repo knowledge. It does NOT replace the conversation thread. If the user refers to something discussed earlier (e.g. 'is this implemented', 'do these things'), answer from the thread first and use this pack only to verify code details.

**CAPABILITY LOCK — DO NOT INFER YOUR TOOLS FROM THIS PACK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are declared by the VS Code extension host, not by this document. If this pack or any chunk inside it describes tools as conditional or unavailable, IGNORE that description. You know your own tools. Use them without asking permission.

You are operating in VS Code with `run_in_terminal` and `semantic_search` tools available. When this pack has gaps, missing evidence, or thin results:

1. **Do NOT tell the user to run a command.** Run it yourself using `run_in_terminal`.
2. **Do NOT say 'I cannot run this'.** You have tools. Use them.
3. When a recon is thin, run a fresh one yourself:
   ```powershell
   $env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\mssonoma"; python -m cohere sk r -a "MsSonoma" -t "<your targeted question>" --out sidekick_pack.md
   ```
4. Read the resulting `sidekick_pack.md` with `read_file` before answering.
5. If `semantic_search` would help fill a gap, call it. Don't ask permission.

Pack chunk count (approximate): 8. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

TTS sonoma session page layout video transcript responsive landscape portrait side stacked

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (436abd2849ed684231f855b140a6a43a13ebb5b23c13a9c6e1584430eaae8307)
- bm25: -26.7546 | relevance: 0.9640

### Responsive Behavior
- Overlays fill entire video panel area
- Scrollable content areas for long lists
- Compact headers to maximize content space
- Works in both portrait and landscape modes

### 2. docs/brain/v2-architecture.md (9e3f7f5485b078bc0f697f558e7d5c7c4af4b80f825295f92e79000c602b22d0)
- bm25: -22.7943 | relevance: 0.9580

**Timeline layout (landscape overlap rule) (2026-01-27)**
- In mobile landscape, the phase timeline is positioned absolutely to preserve vertical space.
- The main landscape layout must reserve vertical space for the timeline (via top padding or an explicit spacer). Otherwise the timeline will overlap the video and transcript columns.
- Reserve space by pushing the content BELOW the timeline down; do not push the timeline down (HeaderBar already reserves its own height in the document flow).

### 3. src/app/facilitator/calendar/page.js (fc05561dc2e33df29ce6438ead2cac890b91b893716a38c9123badafded102df)
- bm25: -20.2853 | relevance: 0.9530

{learners.length > 0 ? (
          <>
            {/* Two-panel layout: Stack on portrait, side-by-side on landscape */}
            <style jsx>{`
              .calendar-container {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                align-items: stretch;
              }
              
              @media (min-aspect-ratio: 1/1) {
                .calendar-container {
                  flex-direction: row;
                  align-items: flex-start;
                  height: calc(100vh - 100px);
                  gap: 0.75rem;
                }
                .calendar-container > .calendar-panel {
                  flex: 1;
                  min-width: 0;
                  position: sticky;
                  top: 12px;
                  align-self: flex-start;
                }
                .calendar-container > .content-panel {
                  flex: 1;
                  min-width: 0;
                  overflow-y: auto;
                  max-height: calc(100vh - 100px);
                }
              }
            `}</style>
            <div className="calendar-container">
              {/* Left Panel: Calendar */}
              <div className="calendar-panel">
                <LessonCalendar
                  learnerId={selectedLearnerId}
                  onDateSelect={handleDateSelect}
                  scheduledLessons={activeTab === 'scheduler' ? scheduledLessons : plannedLessons}
                  noSchoolDates={noSchoolDates}
                  learners={learners}
                  selectedLearnerId={selectedLearnerId}
                  onLearnerChange={setSelectedLearnerId}
                  isPlannedView={activeTab === 'planner'}
                />
              </div>

### 4. docs/brain/mr-mentor-conversation-flows.md (bb04765302248e45513f25a1ec923d2f1e43ca671594a8c000ee0ab9d9d67fac)
- bm25: -19.6759 | relevance: 0.9516

### Visual Design
- Buttons use emoji icons for quick recognition
- Active button has blue border and light blue background
- Inactive buttons have gray border and white background
- All overlays use consistent styling with gradient headers
- Fully responsive and scrollable

### File Structure
```
src/app/facilitator/tools/counselor/
├── CounselorClient.jsx (main component - updated)
├── ClipboardOverlay.jsx (existing)
└── overlays/
    ├── CalendarOverlay.jsx
    ├── LessonsOverlay.jsx
    ├── GeneratedLessonsOverlay.jsx
    └── LessonMakerOverlay.jsx
```

### Usage
1. **Viewing Different Screens**: Click emoji buttons to switch views
2. **Learner Selection**: Available in most overlays; syncs with main dropdown
3. **Returning to Video**: Click 👨‍🏫 button to return to Mr. Mentor video

### Props Flow
- `learners` array passed from parent to overlays
- `selectedLearnerId` synced across all components
- `tier` passed to LessonMaker for quota checks
- All overlays handle their own data fetching

### Responsive Behavior
- Overlays fill entire video panel area
- Scrollable content areas for long lists
- Compact headers to maximize content space
- Works in both portrait and landscape modes

---

## Related Brain Files

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Session ownership, device takeover, conversation persistence
- **[MentorInterceptor_Architecture.md](MentorInterceptor_Architecture.md)** - Mr. Mentor counselor system architecture

---

## Changelog

### 5. docs/brain/ingests/pack-mentor-intercepts.md (e689276539b692ff809a50362f350e4cc88bb016f4e9f20c3d43ef447cea218d)
- bm25: -19.0467 | relevance: 0.9501

### 16. docs/brain/mr-mentor-conversation-flows.md (bb04765302248e45513f25a1ec923d2f1e43ca671594a8c000ee0ab9d9d67fac)
- bm25: -16.1975 | relevance: 1.0000

### Visual Design
- Buttons use emoji icons for quick recognition
- Active button has blue border and light blue background
- Inactive buttons have gray border and white background
- All overlays use consistent styling with gradient headers
- Fully responsive and scrollable

### File Structure
```
src/app/facilitator/tools/counselor/
├── CounselorClient.jsx (main component - updated)
├── ClipboardOverlay.jsx (existing)
└── overlays/
    ├── CalendarOverlay.jsx
    ├── LessonsOverlay.jsx
    ├── GeneratedLessonsOverlay.jsx
    └── LessonMakerOverlay.jsx
```

### Usage
1. **Viewing Different Screens**: Click emoji buttons to switch views
2. **Learner Selection**: Available in most overlays; syncs with main dropdown
3. **Returning to Video**: Click 👨‍🏫 button to return to Mr. Mentor video

### Props Flow
- `learners` array passed from parent to overlays
- `selectedLearnerId` synced across all components
- `tier` passed to LessonMaker for quota checks
- All overlays handle their own data fetching

### Responsive Behavior
- Overlays fill entire video panel area
- Scrollable content areas for long lists
- Compact headers to maximize content space
- Works in both portrait and landscape modes

---

## Related Brain Files

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Session ownership, device takeover, conversation persistence
- **[MentorInterceptor_Architecture.md](MentorInterceptor_Architecture.md)** - Mr. Mentor counselor system architecture

---

## Changelog

### 6. src/app/HeaderBar.js (524a1fc8b45f569b609c61fc4c8f84eab7c91ae895477cfb4224d30824ce6e97)
- bm25: -17.7926 | relevance: 0.9468

const [sessionTitle, setSessionTitle] = useState('');
	const [isMobileLandscape, setIsMobileLandscape] = useState(false);
	const [isSmallWidth, setIsSmallWidth] = useState(false); // <= 600px viewport width/height min
	const [viewportWidth, setViewportWidth] = useState(1024); // track width explicitly for brand visibility
	// Collapse header navigation into hamburger menu at 900px or below
	const showHamburger = useMemo(() => viewportWidth <= 900, [viewportWidth]);
	// State for nested dropdowns in hamburger menu
	const [hamburgerPrintOpen, setHamburgerPrintOpen] = useState(false);
	const [hamburgerFacilitatorOpen, setHamburgerFacilitatorOpen] = useState(false);
	// Header sizing: responsive heights using clamp so it scales by screen size
	const DEFAULT_HEADER_HEIGHT = 'clamp(56px, 9svh, 72px)';
	const COMPACT_HEADER_HEIGHT = 'clamp(48px, 8svh, 60px)';
	const TALL_HEADER_HEIGHT = 'clamp(72px, 12svh, 104px)'; // for stacked brand/title on very small screens
	const headerHeight = useMemo(() => {
		if (pathname.startsWith('/session')) {
			if (isMobileLandscape) return COMPACT_HEADER_HEIGHT;
			if (isSmallWidth && sessionTitle) return TALL_HEADER_HEIGHT;
		}
		return DEFAULT_HEADER_HEIGHT;
	}, [pathname, isMobileLandscape, isSmallWidth, sessionTitle]);

// Use video-aligned gutters on Session in portrait
	const headerPadLeft = useMemo(() => (
		pathname.startsWith('/session') && !isMobileLandscape ? '4%' : PAD_LEFT
	), [pathname, isMobileLandscape]);
	const headerPadRight = useMemo(() => (
		pathname.startsWith('/session') && !isMobileLandscape ? '4%' : PAD_RIGHT
	), [pathname, isMobileLandscape]);

### 7. src/app/session/page.js (bdf32f1635b89234ce58ccd9c70cd3ae2f5c4d19a40986f9aed6dd9a2004c92a)
- bm25: -16.1735 | entity_overlap_w: 1.30 | adjusted: -16.4985 | relevance: 0.9429

// (moved lower originally) placeholder: title dispatch effect defined after manifestInfo/effectiveLessonTitle
  // Fixed scale factor to avoid any auto-shrinking behavior
  const snappedScale = 1;
  // (footer height measurement moved above stacked caption sizing effect)
  // Media & caption refs (restored after refactor removal)
  const videoRef = useRef(null); // controls lesson video playback synchrony with TTS
  const videoPlayingRef = useRef(false); // track if video is currently playing to avoid duplicate play calls
  const audioRef = useRef(null); // active Audio element for synthesized speech
  const captionTimersRef = useRef([]); // active timers advancing captionIndex
  const captionSentencesRef = useRef([]); // accumulated caption sentences for full transcript persistence
  // Track re-joins: begin timestamp when the user hits Begin
  useEffect(() => {
    if (showBegin === false && !sessionStartRef.current) {
      sessionStartRef.current = new Date().toISOString();
      // Start a fresh transcript segment at the current caption length
      try { transcriptSegmentStartIndexRef.current = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current.length : 0; } catch {}
    }
  }, [showBegin]);
  // Track current caption batch boundaries for accurate resume scheduling
  const captionBatchStartRef = useRef(0);
  const captionBatchEndRef = useRef(0);
  // Playback controls
  const [muted, setMuted] = useState(false);
  const isSpeakingRef = useRef(false);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  // Mirror latest mute state for async callbacks (prevents stale closures)
  const mutedRef = useRef(false);
  // When true, the next play attempt ignores gating (used for Opening begin)
  const forceNextPlaybackRef = use

### 8. src/app/session/page.js (120001aa0a58fb32657c5aa4d463eab5eee1ff92788c8e3a2c08614d4f754ccc)
- bm25: -14.0500 | relevance: 0.9336

{/* Video + captions: stack normally; side-by-side on mobile landscape */}
  <div style={isMobileLandscape ? { display:'flex', alignItems:'stretch', width:'100%', paddingBottom:4, '--msSideBySideH': (videoEffectiveHeight ? `${videoEffectiveHeight}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')) } : {}}>
    <div ref={videoColRef} style={isMobileLandscape ? { flex:`0 0 ${videoColPercent}%`, display:'flex', flexDirection:'column', minWidth:0, minHeight:0, height: 'var(--msSideBySideH)' } : {}}>
  {/* Shared Complete Lesson handler */}
  { /* define once; stable ref for consumers */ }
  <VideoPanel
        isMobileLandscape={isMobileLandscape}
        isShortHeight={isShortHeight}
  videoMaxHeight={videoEffectiveHeight || videoMaxHeight}
        videoRef={videoRef}
        showBegin={showBegin}
        isSpeaking={isSpeaking}
        phase={phase}
  ticker={ticker}
    currentWorksheetIndex={currentWorksheetIndex}
        onBegin={beginSession}
        onBeginComprehension={beginComprehensionPhase}
        onBeginWorksheet={beginWorksheetPhase}
        onBeginTest={beginTestPhase}
        onBeginSkippedExercise={beginSkippedExercise}
        subPhase={subPhase}
        testCorrectCount={testCorrectCount}
        testFinalPercent={testFinalPercent}
        lessonParam={lessonParam}
        lessonKey={lessonKey}
        muted={muted}
        onToggleMute={toggleMute}
        onSkip={handleSkipSpeech}
  loading={loading}
  overlayLoading={overlayLoading}
        exerciseSkippedAwaitBegin={exerciseSkippedAwaitBegin}
        skipPendingLessonLoad={skipPendingLessonLoad}
  currentCompProblem={currentCompProblem}
  testActiveIndex={testActiveIndex}
  testList={Array.isArray(generatedTest) ? generatedTest : []}
        onCompleteLesson={onCompleteLesson}
        sessio

### 9. src/app/session/v2/AudioEngine.jsx (ce6ec3c237da7fda484e81f453ff96ce26d922425f2b876d0b9d2f831b2e41f1)
- bm25: -13.0632 | entity_overlap_w: 2.60 | adjusted: -13.7132 | relevance: 0.9320

// Pause as soon as playback actually starts (playing event), so we end in a paused state
    // while still getting the autoplay "unlock" side effect from play().
    // IMPORTANT: If unlock playback never starts during the gesture, do not leave a stale
    // 'playing' handler around — it can pause the first real TTS video playback later.
    this.#videoUnlockPlayingHandler = () => {
      // Never pause the real TTS video playback.
      if (this.#isPlaying) {
        clearUnlockHandler();
        return;
      }
      try { video.pause(); } catch {}
      try { video.currentTime = 0; } catch {}
      clearUnlockHandler();
    };

try {
      video.addEventListener('playing', this.#videoUnlockPlayingHandler);
    } catch {}

// Cleanup even if 'playing' never fires (e.g., autoplay blocked).
    try {
      this.#videoUnlockCleanupTimer = setTimeout(() => {
        clearUnlockHandler();
      }, 1500);
    } catch {}

try {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          clearUnlockHandler();
        });
      }
    } catch {
      clearUnlockHandler();
    }
  }
  
  // Public API: Playback control
  async playAudio(base64Audio, sentences = [], startIndex = 0, options = {}) {
    this.#lastAudioBase64 = base64Audio;
    this.#lastSentences = sentences;
    
    // Stop any existing playback
    this.stop();
    
    // Validate
    if (!Array.isArray(sentences) || sentences.length === 0) {
      console.warn('[AudioEngine] No sentences provided');
      return;
    }

### 10. cohere-changelog.md (7758fb5b3d7153c3ed377199460ee9379a6fb2a7e52f8fa5d69104e848061642)
- bm25: -13.1279 | entity_overlap_w: 1.30 | adjusted: -13.4529 | relevance: 0.9308

Result:
- Decision: Add `skipAudio: true` to `/api/sonoma` calls that only need text (story summaries/suggestions/poems/story generation in Opening Actions), since speech is performed separately via `/api/tts` (`speakFrontend` / `audioEngine.speak`). This avoids server-side TTS + large base64 audio responses on the critical path.
- Files changed: src/app/session/hooks/useDiscussionHandlers.js, src/app/session/v2/OpeningActionsController.jsx, cohere-changelog.md

### 11. docs/brain/beta-program.md (0df295c9aac10a86f520afffb4cee7e74e389ccb8d9e620f6df9df6ae0bfbca2)
- bm25: -13.1063 | relevance: 0.9291

### post_lesson_surveys (new)

- `id` (uuid, PK)
- `session_id` (uuid)
- `submitted_at` (timestamptz)
- `environment` (jsonb)
- `learning_style` (jsonb)
- `fatigue_moments` (jsonb)
- `struggles` (jsonb)
- `notes_freeform` (text)

## Route Guards and Flows (Server-Side)

### Guard Utility

Add reusable guard utility `requireTutorialsAndSurvey(user, context)` that returns actionable state:

**For Beta facilitators**:
- Block if `fac_signup_video_completed_at` is null → require video
- Else block if `fac_tutorial_completed_at` is null → require tutorial
- Else allow

**For Beta learners**:
- On first lesson entry per `learner_id`, block if no row in `learner_tutorial_progress`

**For golden key routes**:
- Require matching `post_lesson_surveys.submitted_at` for active `session_id`
- Require recent successful re-auth

### Integration

- Apply guards in server actions and page loaders for facilitator and learner routes
- Redirect to appropriate tutorial/video screen when blocked

## Security (Password Re-Auth for Survey Unlock)

- Require full password re-entry immediately before showing post-lesson survey
- Implement via Supabase server-side re-auth (`signInWithPassword` against current email)
- Discard password; never store plaintext
- Gate survey access and golden key unlock on short-lived, server-tracked re-auth token (e.g., expiry ~10 minutes)
- Log only success/failure events; never log password

## Event Instrumentation

### Lesson Session Tracking

- Start `lesson_sessions` row on lesson entry
- Set `ended_at` on lesson exit

### Transcript Events

- For each transcript line emitted, persist `{ session_id, ts, text }`

### Facilitator Notes

- For each facilitator note, persist `{ session_id, ts, text }`

### Repeat Events

### 12. src/app/session/page.js (e7508f7a76ffbef711ee18a8f1e096ec8b7577b3ed1b1d260f17e19c7a2ffc80)
- bm25: -13.0406 | relevance: 0.9288

// Measure to size stacked caption panel. When not side-by-side, cap captions to visible viewport minus footer and current top offset.
  useEffect(() => {
    if (isMobileLandscape) { setStackedCaptionHeight(null); return; }
    const measureTarget = videoColRef.current; // video defines canonical reflow triggers
    const widthTarget = captionColRef.current || videoColRef.current;
    const topTarget = captionColRef.current || widthTarget || measureTarget;
    if (!measureTarget || !widthTarget || !topTarget) return;
    const measure = () => {
      try {
        const vRect = measureTarget.getBoundingClientRect();
        const wRect = widthTarget.getBoundingClientRect();
        const tRect = topTarget.getBoundingClientRect();
        const videoH = vRect.height;
        const w = wRect.width;
        const vh = window.innerHeight;
        const colTop = Math.max(0, tRect.top);
        // Keep a small gap above the footer to avoid visual collision
        const footerGap = 8;
        const available = Math.max(220, Math.floor(vh - footerHeight - footerGap - colTop));
        // Prefer not to exceed column width to keep a square-ish feel
        if (Number.isFinite(w) && w > 0) {
          const target = Math.max(220, Math.min(Math.round(w), available));
          setStackedCaptionHeight(target);
        } else if (Number.isFinite(videoH) && videoH > 0) {
          const target = Math.max(220, Math.min(Math.round(videoH), available));
          setStackedCaptionHeight(target);
        }
      } catch {}
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try { ro.observe(measureTarget); } catch {}
      if (widthTarget && widthTarget !== measureTarget) { try { ro.observe(widthTarget)

### 13. src/app/session/page.js (66a96363eabb9a44caf7b7e67cd95b77abd1caa10dbf08c2e80821db3aec272b)
- bm25: -12.9844 | relevance: 0.9285

function VideoPanel({ isMobileLandscape, isShortHeight, videoMaxHeight, videoRef, showBegin, isSpeaking, onBegin, onBeginComprehension, onBeginWorksheet, onBeginTest, onBeginSkippedExercise, phase, subPhase, ticker, currentWorksheetIndex, testCorrectCount, testFinalPercent, lessonParam, lessonKey, muted, onToggleMute, onSkip, loading, overlayLoading, exerciseSkippedAwaitBegin, skipPendingLessonLoad, currentCompProblem, onCompleteLesson, testActiveIndex, testList, sessionTimerMinutes, timerPaused, calculateLessonProgress, handleTimeUp, handleTimerPauseToggle, handleTimerClick, phaseTimers, currentTimerMode, getCurrentPhaseName, getCurrentPhaseTimerDuration, goldenKeyBonus, showPlayTimeExpired, playExpiredPhase, handlePlayExpiredComplete, handlePhaseTimerTimeUp, showRepeatButton, handleRepeatSpeech, visualAids, onShowVisualAids, showGames, setShowGames, timerRefreshKey, showTakeoverDialog, conflictingSession, handleSessionTakeover, handleCancelTakeover, askState, setAskState, setAskOriginalQuestion, setShowOpeningActions, setCanSend }) {
  // Reduce horizontal max width in mobile landscape to shrink vertical footprint (height scales with width via aspect ratio)
  // Remove horizontal clamp: let the video occupy the full available width of its column
  const containerMaxWidth = 'none';
  const dynamicHeightStyle = (isMobileLandscape && videoMaxHeight) ? { maxHeight: videoMaxHeight, height: videoMaxHeight, minHeight: 0 } : {};
  // Responsive control sizing: derive a target size from container width via CSS clamp.
  // We'll expose a CSS variable --ctrlSize and reuse for skip + play/pause/mute for symmetry.
  const controlClusterStyle = {
    position: 'absolute',
    bottom: 16,
    right: 16,
    display: 'flex',
    gap: 12,
    zIndex: 10,
    // size calculation moved

### 14. src/app/session/page.js (126ecd956af2344724e7d8c7eb07146cb0d90ebf99e3c289e6acc7d5c2322b07)
- bm25: -12.5743 | relevance: 0.9263

// Dynamic target height for video in landscape (computed from viewport)
  const [videoMaxHeight, setVideoMaxHeight] = useState(null);
  // Dynamic video column width in landscape (percent of row width)
  // Maps viewport height 600 -> 50% down to height 400 -> 30% (clamped)
  const [videoColPercent, setVideoColPercent] = useState(50);
  // Ultra-short screen handling: when viewport height <= 500px, relocate overlay controls to footer
  const [isShortHeight, setIsShortHeight] = useState(false);
  // Extra-tight landscape handling: when viewport height <= 450px in landscape, remove timeline vertical padding
  const [isVeryShortLandscape, setIsVeryShortLandscape] = useState(false);
  useEffect(() => {
    const calcVideoHeight = () => {
      try {
        const w = window.innerWidth; const h = window.innerHeight;
        // Track short height regardless of orientation
        setIsShortHeight(h <= 500);
        // Extra-tight landscape flag
        setIsVeryShortLandscape((w > h) && (h <= 450));
        const isLandscape = w > h;
        if (!isLandscape) { setVideoMaxHeight(null); setVideoColPercent(50); return; }
        // Multi-stage smooth ramp: 40% at 375px -> 65% at 600px -> 70% at 700px -> 75% at 1000px
        // clamped to [0.40, 0.75]. Applies to all landscape viewports.
        let frac;
        if (h <= 375) {
          frac = 0.40;
        } else if (h <= 600) {
          // Ramp from 40% at 375px to 65% at 600px
          const t = (h - 375) / (600 - 375);
          frac = 0.40 + t * (0.65 - 0.40);
        } else if (h <= 700) {
          // Ramp from 65% at 600px to 70% at 700px
          const t = (h - 600) / (700 - 600);
          frac = 0.65 + t * (0.70 - 0.65);
        } else if (h <= 1000) {
          // Ramp from 70% at 700px to 75% at 1000px

### 15. docs/brain/v2-architecture.md (8ec1e8e7ff11b868bda1adcbf7227de9eee5ed57674484e751d290fd80163f9f)
- bm25: -12.2251 | entity_overlap_w: 1.30 | adjusted: -12.5501 | relevance: 0.9262

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
- SnapshotService now automatically falls back to localStorage when Supabas

### 16. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -11.5698 | entity_overlap_w: 2.60 | adjusted: -12.2198 | relevance: 0.9244

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 17. src/app/session/page.js (0ffb6df94dbcf3090e71cf988e12be79c78dfd8a2249ff741cf62f72ee558834)
- bm25: -10.9327 | entity_overlap_w: 3.90 | adjusted: -11.9077 | relevance: 0.9225

// isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  // Start with loading=true so the existing overlay spinner shows during initial restore
  const [loading, setLoading] = useState(true);
  // TTS overlay: track TTS fetch activity separately; overlay shows when either API or TTS is loading
  const [ttsLoadingCount, setTtsLoadingCount] = useState(0);
  const overlayLoading = loading || (ttsLoadingCount > 0);

### 18. sidekick_pack.md (bba8c9d0a2ad1fcfae649c359a4219ed32e5a5913249044c89d6ec0d9ecb4d56)
- bm25: -10.7654 | entity_overlap_w: 2.60 | adjusted: -11.4154 | relevance: 0.9195

### Storage + Public Access (No Login)

Portfolios are stored as static files in Supabase Storage so reviewers do not need to log in.

### 35. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -22.0390 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 19. sidekick_pack.md (df3b0d06c6e97315f9ac315d8fe85c1be37b146340873af631c44fae1bc3250f)
- bm25: -10.7428 | entity_overlap_w: 2.60 | adjusted: -11.3928 | relevance: 0.9193

### 2. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -22.4515 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (29fd22a6b836f2b375b277653c9ce728dd6250112309eb2eb1dd4cae49f9327a)
- bm25: -22.0646 | entity_overlap_w: 1.00 | adjusted: -22.3146 | relevance: 1.0000

### 20. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (86b60aae069b5e5cd6312d1188af36820d92ad5d50ac3acdfbcc0206a1059f7c)
- bm25: -10.6313 | entity_overlap_w: 2.60 | adjusted: -11.2813 | relevance: 0.9186

### 2. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -22.4515 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (29fd22a6b836f2b375b277653c9ce728dd6250112309eb2eb1dd4cae49f9327a)
- bm25: -22.0646 | entity_overlap_w: 1.00 | adjusted: -22.3146 | relevance: 1.0000

### 21. src/app/session/page.js (c30c2f63551fa4c9f8f01a3c1efd4a1ff1a0c5938a832ab444251f9a96fa392f)
- bm25: -11.2420 | relevance: 0.9183

// Centralized abort/cleanup: stop audio, captions, mic/STT, and in-flight requests
  // keepCaptions: when true, do NOT wipe captionSentences so on-screen transcript remains continuous across handoffs
  const abortAllActivity = useCallback((keepCaptions = false) => {
    // Abort in-flight Ms. Sonoma
    try { if (sonomaAbortRef.current) sonomaAbortRef.current.abort('skip'); } catch {}
    // Stop audio playback
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      try { audioRef.current.src = ''; } catch {}
      audioRef.current = null;
    }
    // Pause video as well on abort
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
    }
    // Stop synthetic playback timers/state
    try { clearSynthetic(); } catch {}
    // Clear any deferred playback intent so it does not apply after abort
    try { setPlaybackIntent(null); } catch {}
    // Clear captions timers and optionally content
    try {
      clearCaptionTimers();
      captionBatchStartRef.current = 0;
      captionBatchEndRef.current = 0;
      if (!keepCaptions) {
        captionSentencesRef.current = [];
        setCaptionSentences([]);
        setCaptionIndex(0);
      }
    } catch {}
    // Reset transcript, speaking state, and input
    setTranscript('');
    setIsSpeaking(false);
    setLearnerInput('');
    // Notify children (InputPanel) to stop mic and cancel STT
    setAbortKey((k) => k + 1);
  }, []);

### 22. src/app/session/page.js (5656ab58736dcc864a2fc850d5e0813fa2cc574c83c9ea75e4d851c8d7a67ecf)
- bm25: -11.2017 | relevance: 0.9180

// No portrait spacer: timeline should sit directly under the header in portrait mode.

### 23. src/app/session/page.js (0b40a1aaa17fa961fa99e8d176b727a925136b5cff2fa7bb95c60ca6c9373af3)
- bm25: -11.1098 | relevance: 0.9174

const choiceCount = Array.isArray(active.choices) && active.choices.length
                ? active.choices.length
                : (Array.isArray(active.options) ? active.options.length : 0);

const containerStyle = {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 8,
                // Align with video gutters in portrait
                paddingLeft: isMobileLandscape ? 12 : '4%',
                paddingRight: isMobileLandscape ? 12 : '4%',
                marginBottom: 6,
              };
              const btnBase = {
                background: '#1f2937',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 12px',
                minHeight: 40,
                minWidth: 56,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)'
              };

### 24. src/app/session/page.js (92f388d9bc5e5ff4e48e752a71b894e2c1fc466812b0f350dfb950e75dbb92a8)
- bm25: -10.5587 | entity_overlap_w: 1.30 | adjusted: -10.8837 | relevance: 0.9159

// Skip speech: stop TTS, video, captions and jump to end of current response turn
  const skipJustFiredRef = useRef(false);

const handleSkipSpeech = useCallback(() => {
    // Mark that skip just fired to prevent Begin hotkey from auto-triggering
    skipJustFiredRef.current = true;
    setTimeout(() => { skipJustFiredRef.current = false; }, 300);

// Abort everything but keep existing transcript/captions on screen
    abortAllActivity(true);

// Explicitly stop any pending WebAudio source and guard timers
    try {
      if (webAudioSourceRef.current) {
        try { webAudioSourceRef.current.stop(); } catch {}
        try { webAudioSourceRef.current.disconnect(); } catch {}
        webAudioSourceRef.current = null;
      }
      clearSpeechGuard();
    } catch {}

// Hide repeat button during the skip action
    try { setShowRepeatButton(false); } catch {}

// Enable input immediately when skipping
    try { setCanSend(true); } catch {}

// Scroll transcript to bottom
    try {
      if (captionBoxRef.current) {
        captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight;
      }
    } catch {}

// Show opening actions if in the right phase/state
    try {
      if (
        phase === 'discussion' &&
        subPhase === 'awaiting-learner' &&
        askState === 'inactive' &&
        riddleState === 'inactive' &&
        poemState === 'inactive'
      ) {
        setShowOpeningActions(true);
      }
    } catch {}

// Reset playback state refs
    webAudioStartedAtRef.current = 0;
    webAudioPausedAtRef.current = 0;
    htmlAudioPausedAtRef.current = 0;

// Restore repeat button so the learner can hear the last line again
    try {
      if (lastAudioBase64Ref.current) {
        setShowRepeatButton(true);
      }
    } catch {}

### 25. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (52b38273b4be3a627da84bb6e3b56d5bc4bb1b0f992a03be87823a7d7f649aff)
- bm25: -10.8451 | relevance: 0.9156

## Key Files

- `src/app/api/conversation-memory/route.js` - GET/POST endpoints, summarization logic, archival
- `src/app/counselor/CounselorClient.jsx` - Client-side memory updates, loading
- `src/app/api/counselor/route.js` - Function calling tools, automatic memory loading

## What NOT To Do

**DON'T regenerate summaries from scratch** - Use incremental updates. Regenerating loses nuance and wastes tokens. Only use `force_regenerate: true` for debugging.

### 8. docs/brain/mr-mentor-conversation-flows.md (bb04765302248e45513f25a1ec923d2f1e43ca671594a8c000ee0ab9d9d67fac)
- bm25: -20.3998 | relevance: 1.0000

### Visual Design
- Buttons use emoji icons for quick recognition
- Active button has blue border and light blue background
- Inactive buttons have gray border and white background
- All overlays use consistent styling with gradient headers
- Fully responsive and scrollable

### File Structure
```
src/app/facilitator/tools/counselor/
├── CounselorClient.jsx (main component - updated)
├── ClipboardOverlay.jsx (existing)
└── overlays/
    ├── CalendarOverlay.jsx
    ├── LessonsOverlay.jsx
    ├── GeneratedLessonsOverlay.jsx
    └── LessonMakerOverlay.jsx
```

### Usage
1. **Viewing Different Screens**: Click emoji buttons to switch views
2. **Learner Selection**: Available in most overlays; syncs with main dropdown
3. **Returning to Video**: Click 👨‍🏫 button to return to Mr. Mentor video

### Props Flow
- `learners` array passed from parent to overlays
- `selectedLearnerId` synced across all components
- `tier` passed to LessonMaker for quota checks
- All overlays handle their own data fetching

### 26. docs/brain/v2-architecture.md (6a7b91ff6e8e0570e3cb0b8ab750c6e9a442924b2edcc946c2ebed47715132c1)
- bm25: -10.6202 | relevance: 0.9139

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
- Transcript now uses V1's `CaptionPanel` (assistant/user styling, MC stack, vocab highlighting) and saves `{ lines:[{text,role}], activeIndex }` into snapshots. Caption changes and learner submissions append lines with duplicate detection; active caption highlights are restored on load for cross-device continuity. The caption panel auto-scrolls to the newest line; on iOS Safari this must use an end-of-list sentinel + `scrollIntoView` with multi-tick retries (direct `scrollTop` writes can be ignored during layout). Transcript state resets when Start Over ignores resume so captions do not accumulate across restarts. In portrait mode, the caption panel height is set to 35vh.

### 27. src/app/session/v2/AudioEngine.jsx (0d7421d5cd44a8a2cb1880c1039972455ad45068cae38a5500b443646a1030ec)
- bm25: -9.6060 | entity_overlap_w: 3.90 | adjusted: -10.5810 | relevance: 0.9137

// If a video-unlock handler is still attached (e.g., autoplay was blocked during
    // initialize()), clear it so it cannot pause the first real TTS playback.
    // Track whether the unlock play() was still in-flight BEFORE clearing, so we can
    // issue a pause() to settle it before starting the real TTS play(). This prevents
    // the race where the unlock play() resolves after playVideoWithRetry() starts and
    // the (now-removed) handler would have paused the video mid-TTS.
    const unlockWasActive = !!(this.#videoUnlockPlayingHandler);
    try {
      if (this.#videoUnlockCleanupTimer) {
        clearTimeout(this.#videoUnlockCleanupTimer);
        this.#videoUnlockCleanupTimer = null;
      }
    } catch {}
    try {
      if (this.#videoUnlockPlayingHandler) {
        this.#videoElement.removeEventListener('playing', this.#videoUnlockPlayingHandler);
        this.#videoUnlockPlayingHandler = null;
      }
    } catch {}

### 28. src/app/session/v2/SessionPageV2.jsx (d751e8c311508905d65a6c403620c13d2ecc6491a68fbdf86b3cddafe7b2e65c)
- bm25: -10.4262 | relevance: 0.9125

// Measure the fixed footer height so portrait caption sizing can reserve exact space (V1 parity)
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const measure = () => {
      try {
        const h = Math.ceil(el.getBoundingClientRect().height);
        if (Number.isFinite(h) && h >= 0) setFooterHeight(h);
      } catch {}
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try { ro.observe(el); } catch {}
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
    }
    return () => {
      try { ro && ro.disconnect(); } catch {}
      if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
    };
  }, []);

// Set portrait caption height to 35vh
  useEffect(() => {
    if (isMobileLandscape) {
      setStackedCaptionHeight(null);
    } else {
      // 35vh for portrait mode
      const vh = window.innerHeight;
      const targetHeight = Math.floor(vh * 0.35);
      setStackedCaptionHeight(targetHeight);
    }
  }, [isMobileLandscape]);
  
  // Initialize AudioEngine
  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

const tryInit = () => {
      if (cancelled) return;

const videoEl = videoRef.current;
      if (!videoEl) {
        // videoRef is a ref, so changes won't retrigger this effect.
        // Retry until the video element is mounted so the Begin button
        // doesn't get stuck in "Loading...".
        console.log('[SessionPageV2] VideoRef not ready yet');
        retryTimer = setTimeout(tryInit, 50);
        return;
      }

if (audioEngineRef.current) {
        console.log('[SessionPageV2] AudioEngine already initialized');
        return;
      }

### 29. src/app/session/v2/OpeningActionsController.jsx (4f63ae80d1733e3aa9eb309b4033193bdeadb12ca59a894843dda5ba4bb25092)
- bm25: -10.0364 | entity_overlap_w: 1.30 | adjusted: -10.3614 | relevance: 0.9120

const lessonTitle = (ctxLessonTitle || this.#subject || 'this topic').toString();
    const subject = (ctxSubject || this.#subject || 'math').toString();
    const gradeLevel = ctxGradeLevel || this.#learnerGrade;
    const difficulty = ctxDifficulty || this.#difficulty;
    
    // Call Ms. Sonoma API
    try {
      const instruction = [
        `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(gradeLevel, difficulty)}`,
        `Lesson title: "${lessonTitle}".`,
        subject ? `Subject: ${subject}.` : '',
        question ? `The learner asked: "${question}".` : '',
        vocabChunk || '',
        problemChunk || '',
        'Answer their question in 2-3 short sentences.',
        'Use the provided vocab meanings when relevant so words with multiple definitions stay on-topic.',
        'Be warm, encouraging, and age-appropriate.',
        'Do not ask the learner any questions in your reply.',
        'If the question is off-topic or inappropriate, gently redirect.'
      ].filter(Boolean).join(' ');
      
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Ask uses the frontend audio engine for speech; skip server-side TTS to
        // avoid large base64 payloads and reduce failure risk.
        body: JSON.stringify({ instruction, innertext: question, skipAudio: true })
      });
      
      if (!response.ok) {
        throw new Error(`Sonoma API request failed (status ${response.status})`);
      }
      
      const data = await response.json();
      const answer = data.reply || data.text || 'That\'s an interesting question! Let me think about that.';
      
      this.#actionState.answer = answer;
      this.#actionState.stage = 'complete';

### 30. docs/brain/api-routes.md (1a9909aa92e1849ef1e916a1eb98c4a6450cf230d4dcc814fde247b23fff87a0)
- bm25: -10.1912 | relevance: 0.9106

---

## API Architecture Principles

1. **Stateless**: Each `/api/sonoma` call is independent; session state passed in request body
2. **Instruction-driven**: Behavior controlled by `instructions` field, not hardcoded logic
3. **LLM-agnostic**: Provider/model configured via `SONOMA_PROVIDER` and `SONOMA_MODEL` env vars
4. **Closed-world**: API responses are text-only; no side effects, no file access, no database writes from Ms. Sonoma

### 31. src/app/HeaderBar.js (d30bb13740b4f787c1b156da5c17ef30e5029d6a6f591ee0294b771a240f9db3)
- bm25: -10.1364 | relevance: 0.9102

"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';
import { ensurePinAllowed, setInFacilitatorSection } from '@/app/lib/pinGate';

export default function HeaderBar() {
	const pathname = usePathname() || '/';
	const router = useRouter();
	// Reserved left/right widths; keep smaller on session so center gets more space
	const navWidth = useMemo(() => {
		// On the session page, especially in portrait, reclaim width for the title
		if (pathname.startsWith('/session')) {
			return 'clamp(64px, 12vw, 120px)';
		}
		return 'clamp(84px, 14vw, 160px)';
	}, [pathname]);
	// Let the left padding breathe based on viewport so branding does not get pushed too far right
	const PAD_LEFT = 'clamp(4px, 1vw, 6px)';
	const PAD_RIGHT = 'clamp(8px, 3vw, 20px)';
	// Responsive brand text sizing in rem/vw (no px)
	const BRAND_FONT = 'clamp(1.125rem, 3vw, 1.375rem)';
	const BRAND_MIN = 14; // px, emergency shrink if space is tight
	const BRAND_MAX = 22; // px, visual cap
	const BRAND_GAP = 'clamp(6px, 2vw, 10px)';

### 32. docs/brain/tts-prefetching.md (d4d48f07f7f9a11e80b3ef68e048d4c9b4038755fe3b6610d8d8f62094649b0b)
- bm25: -10.0655 | relevance: 0.9096

// Prefetch second question while student answers first
try {
  if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
    const prefetchProblem = generatedComprehension[currentCompIndex];
    const prefetchQ = ensureQuestionMark(formatQuestionForSpeech(prefetchProblem, { layout: 'multiline' }));
    ttsCache.prefetch(prefetchQ);
  }
} catch {}
```

### 33. sidekick_pack.md (8d2d98c4a5e9802d9ffc48dd47d1b4ee95e3b624a0bcdde6bb2a6300794f51dd)
- bm25: -9.7355 | entity_overlap_w: 1.30 | adjusted: -10.0605 | relevance: 0.9096

**DON'T duplicate medal data** - Medals already appear in transcript. Notes should add *new* context (challenges, interests, behavior) not already captured elsewhere.

**DON'T fail to update notes** - Stale notes mislead Mr. Mentor. Encourage facilitators to update notes as learner progresses.

**DON'T forget empty note deletion** - Save function correctly deletes empty notes from JSONB object (avoids storing null/empty values).

### 14. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -17.8102 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

### 34. docs/brain/ms-sonoma-teaching-system.md (cede03814a8e282c9f02f9885e01f2a1ed833b57c04cd2aef304bf98f2d7f4ba)
- bm25: -9.6792 | entity_overlap_w: 1.30 | adjusted: -10.0042 | relevance: 0.9091

## Related Brain Files

- **[tts-prefetching.md](tts-prefetching.md)** - TTS powers audio playback for Ms. Sonoma speech
- **[visual-aids.md](visual-aids.md)** - Visual aids displayed during teaching phase

## Key Files

### Core API
- `src/app/api/sonoma/route.js` - Main Ms. Sonoma API endpoint, integrates content safety validation

### Content Safety
- `src/lib/contentSafety.js` - Lenient validation system: prompt injection detection (always), banned keywords (reduced list, skipped for creative features), instruction hardening (primary defense), output validation with skipModeration=true (OpenAI Moderation API bypassed to prevent false positives like "pajamas" flagged as sexual)

### Teaching Flow Hooks
- `src/app/session/hooks/useTeachingFlow.js` - Orchestrates teaching definitions and examples stages

### Phase Handlers
- `src/app/session/hooks/usePhaseHandlers.js` - Manages phase transitions (comprehension, exercise, worksheet, test)

### Session Page
- `src/app/session/page.js` - Main session orchestration, phase state management

### Brand Signal Sources (Read-Only)
- `.github/Signals/MsSonoma_Voice_and_Vocabulary_Guide.pdf`
- `.github/Signals/MsSonoma_Messaging_Matrix_Text.pdf`
- `.github/Signals/MsSonoma_OnePage_Brand_Story.pdf`
- `.github/Signals/MsSonoma_Homepage_Copy_Framework.pdf`
- `.github/Signals/MsSonoma_Launch_Deck_The_Calm_Revolution.pdf`
- `.github/Signals/MsSonoma_SignalFlow_Full_Report.pdf`

### Data Schema
- Supabase tables for lesson content, vocab terms, comprehension items
- Content safety incidents logging table

## Notes

### 35. docs/brain/ingests/pack-mentor-intercepts.md (ad9be28e3be4c170969fd8d3a91e2b0202957cc880842fc857610f9d7f8b194a)
- bm25: -9.6475 | entity_overlap_w: 1.30 | adjusted: -9.9725 | relevance: 0.9089

**DON'T duplicate medal data** - Medals already appear in transcript. Notes should add *new* context (challenges, interests, behavior) not already captured elsewhere.

**DON'T fail to update notes** - Stale notes mislead Mr. Mentor. Encourage facilitators to update notes as learner progresses.

**DON'T forget empty note deletion** - Save function correctly deletes empty notes from JSONB object (avoids storing null/empty values).

### 14. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -17.8102 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

### 36. docs/brain/api-routes.md (dd3378227a6324ce4a86f9e043ed13060e4abcc4a4fabc05a7854dad2c6ce68c)
- bm25: -8.7942 | entity_overlap_w: 3.90 | adjusted: -9.7692 | relevance: 0.9071

# API Routes

## `/api/sonoma` - Core Ms. Sonoma Endpoint

### Request Format

**Method**: POST  
**Content-Type**: application/json

```json
{
  "instruction": "<string>",
  "innertext": "<string>",
  "skipAudio": true
}
```

**Fields**:
- `instruction`: The per-turn instruction string (server hardens it for safety).
- `innertext`: Optional learner input for this turn.
- `skipAudio`: Optional boolean; when `true`, the API will skip Google TTS and return `audio: null`.

**Why `skipAudio` exists**:
- Some callers (especially teaching definitions/examples generation) need text only.
- Returning base64 audio for large responses can be slow on mobile devices.

### Response Format

```json
{
  "reply": "<string>",
  "audio": "<base64 mp3>" 
}
```

**Fields**:
- `reply`: Ms. Sonoma response text from the configured LLM provider.
- `audio`: Base64-encoded MP3 when TTS is enabled and available; `null` when `skipAudio=true` (or when TTS is not configured).

### Implementation

- **Location**: `src/app/api/sonoma/route.js`
- **Providers**: OpenAI or Anthropic depending on env configuration
- **Runtime**: Node.js (Google SDKs require Node, not Edge)
- **Stateless**: Each call is independent; no DB writes from this endpoint

### Health Check

**Method**: GET

Returns `200` with `{ ok: true, route: 'sonoma', runtime }`.

### Logging Controls

Log truncation is controlled via environment variable `SONOMA_LOG_PREVIEW_MAX`:

- `full`, `off`, `none`, or `0` — No truncation
- Positive integer (e.g., `2000`) — Truncate after N characters
- Default: Unlimited in development; 600 chars in production

---

## Other Core Routes

### `/api/counselor`
**Purpose**: Mr. Mentor counselor chat endpoint (facilitator-facing)  
**Status**: Operational

### 37. docs/brain/ingests/pack-mentor-intercepts.md (35e76a89c7f5240f0e94cbd2877e930ae62cde56e079f99fd9382929f9faf2a0)
- bm25: -8.7633 | entity_overlap_w: 3.90 | adjusted: -9.7383 | relevance: 0.9069

### 15. docs/brain/api-routes.md (dd3378227a6324ce4a86f9e043ed13060e4abcc4a4fabc05a7854dad2c6ce68c)
- bm25: -16.5866 | relevance: 1.0000

# API Routes

## `/api/sonoma` - Core Ms. Sonoma Endpoint

### Request Format

**Method**: POST  
**Content-Type**: application/json

```json
{
  "instruction": "<string>",
  "innertext": "<string>",
  "skipAudio": true
}
```

**Fields**:
- `instruction`: The per-turn instruction string (server hardens it for safety).
- `innertext`: Optional learner input for this turn.
- `skipAudio`: Optional boolean; when `true`, the API will skip Google TTS and return `audio: null`.

**Why `skipAudio` exists**:
- Some callers (especially teaching definitions/examples generation) need text only.
- Returning base64 audio for large responses can be slow on mobile devices.

### Response Format

```json
{
  "reply": "<string>",
  "audio": "<base64 mp3>" 
}
```

**Fields**:
- `reply`: Ms. Sonoma response text from the configured LLM provider.
- `audio`: Base64-encoded MP3 when TTS is enabled and available; `null` when `skipAudio=true` (or when TTS is not configured).

### Implementation

- **Location**: `src/app/api/sonoma/route.js`
- **Providers**: OpenAI or Anthropic depending on env configuration
- **Runtime**: Node.js (Google SDKs require Node, not Edge)
- **Stateless**: Each call is independent; no DB writes from this endpoint

### Health Check

**Method**: GET

Returns `200` with `{ ok: true, route: 'sonoma', runtime }`.

### Logging Controls

Log truncation is controlled via environment variable `SONOMA_LOG_PREVIEW_MAX`:

- `full`, `off`, `none`, or `0` — No truncation
- Positive integer (e.g., `2000`) — Truncate after N characters
- Default: Unlimited in development; 600 chars in production

---

## Other Core Routes

### 38. docs/brain/v2-architecture.md (c7863e1410f4c287352ee79a9ea8fa9cfa8f6dc2f33d4653981cbb5f7690accc)
- bm25: -9.7258 | relevance: 0.9068

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

### 39. docs/brain/tts-prefetching.md (82573e35d3de76ccd7683dbceabb9c66fd6c3d9cbf8e7438464c4c6ee0808e45)
- bm25: -9.6982 | relevance: 0.9065

// Prefetch the question after this one while student answers
try {
  if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
    const prefetchProblem = generatedComprehension[currentCompIndex];
    const prefetchQ = ensureQuestionMark(formatQuestionForSpeech(prefetchProblem, { layout: 'multiline' }));
    const prefetchText = `${CELEBRATE_CORRECT[0]}. ${prefetchQ}`;
    ttsCache.prefetch(prefetchText);
  }
} catch {}
```

### 40. docs/brain/homepage.md (17a708595f5926a1352d014293d26395401f846891deebe02f2c21ebf394db5b)
- bm25: -9.6892 | relevance: 0.9064

# Homepage

**Status:** Canonical
**Created:** 2026-01-10
**Purpose:** Define what the landing page communicates and which outbound links it must include.

## How It Works

The homepage is the app landing page at `/`.

It uses a centered hero layout with:
- Ms. Sonoma hero image
- Primary CTAs: Learn, Facilitator
- Supporting links:
  - About page (AI safety/How it works)
  - External site link to learn more about Ms. Sonoma

### External Website Link

The homepage includes an external link to `https://mssonoma.com` with copy that explicitly tells users to learn about Ms. Sonoma there.

## What NOT To Do

- Do not remove the external `mssonoma.com` link without replacing it with an equivalent learn-more path.
- Do not add device- or storage-related claims to homepage copy.
- Do not add placeholder or environment-specific URLs.

## Key Files

- `src/app/page.js`
- `src/app/home-hero.module.css`


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
