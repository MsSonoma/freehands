# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Golden Key applied from Timers overlay changes overlay clock but not session clock authority
```

Filter terms used:
```text
Golden
Key
applied
from
Timers
overlay
changes
overlay
clock
but
not
session
clock
authority
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Golden Key applied from Timers overlay changes overlay clock but not session clock authority

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/v2/SessionPageV2.jsx (f78d065f61ddcc60f2a389e10ff30a464b473f25b3641b67b407c7b53f0105b2)
- bm25: -20.8791 | relevance: 1.0000

// Reflect in local session state.
      setLearnerProfile(updated || learner);
      setHasGoldenKey(true);
      setIsGoldenKeySuspended(false);
      const timers = loadPhaseTimersForLearner(updated || learner);
      setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
      setTimerRefreshKey(k => k + 1);
      persistTimerStateNow('golden-key-applied');
    } catch (err) {
      console.warn('[SessionPageV2] Failed to apply golden key:', err);
    }
  }, [hasGoldenKey, lessonKey, goldenKeyLessonKey, learnerProfile, persistTimerStateNow]);

### 2. docs/brain/timer-system.md (f6039f66c89f72a9b7a6605c84ec61b2bb3d87b5f9d91a8dfe35b82d55d0be59)
- bm25: -20.7387 | relevance: 1.0000

### Golden Keys Gating (Plan + Per Learner)

Golden Keys have two independent gates:

1) **Plan entitlement (account level)**
- Source: `profiles.plan_tier` + `profiles.subscription_tier` resolved through `resolveEffectiveTier()` + `featuresForTier()`.
- If `featuresForTier(effectiveTier).goldenKeyFeatures === false` (e.g., `trial`), Golden Keys are not usable in-session.
- In Session V2, the plan entitlement is enforced even if the learner setting is on (learner setting is coerced off).

2) **Per-learner setting (learner level)**
- Column: `public.learners.golden_keys_enabled` (boolean, default true)
- Only applies when the plan is entitled.

**UI behavior (TimerControlOverlay):**
- Not entitled by plan: show the Golden Key section with an upgrade note; do not allow applying/suspending/earning keys.
- Entitled by plan, learner setting off: keep controls visible but disable actions with explanatory copy.
- Entitled by plan, learner setting on: full Golden Key behavior enabled.

### Golden Key Application (Per Lesson)

Golden Key usage is **per-lesson**, stored on the learner record:
- Field: `learners.active_golden_keys` (JSON map `{ [lessonKey]: true }`)
- When a facilitator applies a Golden Key for the current lesson, Session V2 must persist:
  - Set `active_golden_keys[lessonKey] = true`
  - Decrement `learners.golden_keys` inventory by 1

Once applied:
- The Golden Key bonus minutes are added to **all play timers** (phases 2-5) for that session.
- Suspending the Golden Key sets the play bonus to 0 (bonus is removed immediately from running timers).

### 3. src/app/session/page.js (441c5b0468568c0ee81383d2ff1659da127f5404e6cc3571903b476a83ca65af)
- bm25: -19.7058 | relevance: 1.0000

// Decrement available golden keys and mark this lesson as having one
      await updateLearner(learnerId, {
        name: learner.name,
        grade: learner.grade,
        targets: {
          comprehension: learner.comprehension,
          exercise: learner.exercise,
          worksheet: learner.worksheet,
          test: learner.test
        },
        session_timer_minutes: learner.session_timer_minutes,
        golden_keys: (learner.golden_keys || 0) - 1,
        active_golden_keys: activeKeys
      });
      
      // Get the golden key bonus from the learner's settings
      const bonusMinutes = learner.golden_key_bonus_min ?? 5; // Default to 5 if not set
      
      // Update local state
      setHasGoldenKey(true);
      setIsGoldenKeySuspended(false);
      setGoldenKeyBonus(bonusMinutes);
      
      // Force timer to refresh and pick up the new golden key bonus
      setTimerRefreshKey(prev => prev + 1);
      
      // Show success and close overlay
      alert('Golden key applied! This lesson now has bonus play time.');
      setShowTimerControls(false);
      
    } catch (err) {
      alert('Failed to apply golden key. Please try again.');
    }
  }, [hasGoldenKey, lessonKey]);

### 4. docs/brain/timer-system.md (b528b741fad7d3d86f62d013e0cc846e2e18e614028489363ed3671475b5ee8b)
- bm25: -19.0573 | relevance: 1.0000

**Pause behavior:**
- Stops all tick intervals (play and work)
- Stores current elapsed time for active timers
- Tick methods guard against running when paused
- **Critical:** Prevents `playTimerExpired` event from firing during pause
- Timer UI shows pause icon but displays frozen elapsed time

**Resume behavior:**
- Adjusts `startTime` to account for paused duration
- Restarts tick intervals
- Timers continue from where they left off
- No time is lost or gained during pause

**Event-Driven Display (V2):**
- `SessionPageV2` maintains separate display state for play and work timers:
  - `playTimerDisplayElapsed` / `playTimerDisplayRemaining`
  - `workTimerDisplayElapsed` / `workTimerDisplayRemaining`
- Event subscriptions update display state:
  - `playTimerTick` / `workPhaseTimerTick` - continuous updates while running
  - `playTimerStart` / `workPhaseTimerStart` - initialize display when timer starts
- `SessionTimer` receives `elapsedSeconds`/`remainingSeconds` as props based on current timer mode
- This prevents play and work timers from sharing/overwriting countdown values

**Phase Transitions:**
- `playTimerExpired` event handler calls `handlePhaseTimerTimeUp()` to trigger state changes
- Without this call, timer expiry would show overlay but not advance phases or update timer modes
- Phase state machine depends on `handlePhaseTimerTimeUp` for 'play' → 'work' transitions

**Key files:**
- `src/app/session/v2/TimerService.jsx` - `pause()`, `resume()`, pause guards in tick methods
- `src/app/session/v2/SessionPageV2.jsx` - `handleTimerPauseToggle`, `timerPaused` state, event subscriptions, separate play/work display state

## Recent Changes

### 5. src/app/session/v2/SessionPageV2.jsx (666070c5d3f55ec39dbbc5f387961507a315ceda43f33fd07c52462a167575f1)
- bm25: -18.8385 | relevance: 1.0000

return () => {
      try { unsubPlayStart?.(); } catch {}
      try { unsubWorkStart?.(); } catch {}
      try { unsubPlayExpired?.(); } catch {}
      try { unsubPlayTick?.(); } catch {}
      try { unsubWorkTick?.(); } catch {}
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [lessonKey, persistTimerStateNow]);

const handleApplyGoldenKeyForLesson = useCallback(async () => {
    if (goldenKeysEnabledRef.current === false) return;
    if (!lessonKey) return;

const learnerId = sessionLearnerIdRef.current || learnerProfile?.id || null;
    if (!learnerId || learnerId === 'demo') return;

// If already applied locally, don't reapply.
    if (hasGoldenKey) return;

try {
      const learner = await getLearner(learnerId);
      if (!learner) return;

if (!goldenKeyLessonKey) return;

const activeKeys = { ...(learner.active_golden_keys || {}) };
      if (activeKeys[goldenKeyLessonKey]) {
        setHasGoldenKey(true);
        setIsGoldenKeySuspended(false);
        const timers = loadPhaseTimersForLearner(learner);
        setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
        setTimerRefreshKey(k => k + 1);
        persistTimerStateNow('golden-key-applied');
        return;
      }

const available = Number(learner.golden_keys || 0);
      if (!Number.isFinite(available) || available <= 0) {
        return;
      }

activeKeys[goldenKeyLessonKey] = true;
      const updated = await updateLearner(learnerId, {
        golden_keys: available - 1,
        active_golden_keys: activeKeys
      });

### 6. src/app/session/page.js (94e48e98dfe42c83ad0ba9aa2ce72e862e51ac741c6764caa468e7c7a03934a0)
- bm25: -17.8117 | relevance: 1.0000

// Handle timer pause/resume (no PIN required - overlay already authenticated)
  const handleTimerPauseToggle = useCallback(async () => {
    setTimerPaused(prev => !prev);
  }, []);

// Handle timer click - open controls with PIN
  const handleTimerClick = useCallback(async (currentElapsedSeconds) => {
    const ok = await ensurePinAllowed('timer');
    if (!ok) return;
    setShowTimerControls(true);
  }, []);

// Handle timer time adjustment
  const handleUpdateTime = useCallback((newElapsedSeconds) => {
    // TimerControlOverlay now handles sessionStorage updates directly
    // Force SessionTimer to re-read its state by changing its key
    setTimerRefreshKey(prev => prev + 1);
    setShowTimerControls(false);
  }, []);

// Handle golden key application from timer controls
  const handleApplyGoldenKey = useCallback(async () => {
    if (hasGoldenKey) {
      alert('This lesson already has a golden key applied.');
      return;
    }
    
    try {
      const learnerId = localStorage.getItem('learner_id');
      if (!learnerId) {
        alert('No learner selected');
        return;
      }

// Import learner API
      const { getLearner, updateLearner } = await import('@/app/facilitator/learners/clientApi');
      const learner = await getLearner(learnerId);
      if (!learner) {
        alert('Learner not found');
        return;
      }

// Check if learner has available golden keys
      if (!learner.golden_keys || learner.golden_keys <= 0) {
        alert('No golden keys available. Complete lessons to earn golden keys.');
        return;
      }

// Apply golden key to this lesson
      const activeKeys = { ...(learner.active_golden_keys || {}) };
      activeKeys[lessonKey] = true;

### 7. src/app/session/v2/SessionPageV2.jsx (a9e9809cf3610a8a1f4183325c60c1b9b842c5539910c2a3707833c1101951c5)
- bm25: -17.2319 | relevance: 1.0000

// Play portion flags (required - no defaults or fallback)
        const playFlags = {
          comprehension: learner.play_comprehension_enabled,
          exercise: learner.play_exercise_enabled,
          worksheet: learner.play_worksheet_enabled,
          test: learner.play_test_enabled,
        };
        for (const [k, v] of Object.entries(playFlags)) {
          if (typeof v !== 'boolean') {
            throw new Error(`Learner profile missing play_${k}_enabled flag. Please run migrations.`);
          }
        }
        setPlayPortionsEnabled(playFlags);
        playPortionsEnabledRef.current = playFlags;
        
        // Load phase timer settings from learner profile
        const timers = loadPhaseTimersForLearner(learner);
        setPhaseTimers(timers);
        
        // Initialize currentTimerMode (null = not started yet), but do not clobber
        // any existing restore/resume-derived modes.
        setCurrentTimerMode((prev) => {
          const hasExistingMode = prev && Object.values(prev).some((mode) => mode === 'play' || mode === 'work');
          if (hasExistingMode) return prev;
          return {
            discussion: null,
            comprehension: null,
            exercise: null,
            worksheet: null,
            test: null
          };
        });
        
        // Check for active golden key on this lesson (only affects play timers when Golden Keys are enabled)
        // Key format must match V1 + /learn/lessons: `${subject}/${lesson}`.
        if (!goldenKeyLessonKey) {
          throw new Error('Missing lesson key for golden key lookup.');
        }
        const activeKeys = learner.active_golden_keys || {};
        if (learner.golden_keys_enabled && activeKeys[goldenKeyLessonKey]) {
          setHasGoldenKey(true);

### 8. src/app/facilitator/learners/components/LearnerEditOverlay.jsx (51c37a4c43097636d469452a1fc72ad7ca84cc7183cbbcbaa8aa3129c900b337)
- bm25: -16.8118 | relevance: 1.0000

{/* Golden Key Bonus */}
							<div style={{
								borderTop: '2px solid #e5e7eb',
								paddingTop: 12,
								marginTop: 4
							}}>
								<div style={{ position: 'relative', marginBottom: 6 }}>
										<div
											style={{
												fontSize: 16,
												fontWeight: 700,
												color: '#b45309',
												cursor: 'help',
												display: 'inline-block',
												borderBottom: '1px dotted #9ca3af',
												userSelect: 'none'
											}}
											onMouseEnter={() => handleTooltipHover('golden-key', true)}
											onMouseLeave={() => handleTooltipHover('golden-key', false)}
											onClick={() => handleTooltipClick('golden-key')}
										>
											⚡ Golden Key Bonus
										</div>

{/* Golden key tooltip */}
										{showTooltip('golden-key') && (
											<div style={{
												position: 'absolute',
												top: '100%',
												left: 0,
												marginTop: 6,
												background: '#1f2937',
												color: '#fff',
												padding: '8px 12px',
												borderRadius: 6,
												fontSize: 12,
												lineHeight: 1.4,
												boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
												zIndex: 10,
												maxWidth: 280,
												whiteSpace: 'normal'
											}}>
												Extra time added to <strong>all play timers</strong> when golden key is earned (completing 4/5 work phases) or applied by facilitator.
											</div>
										)}
									</div>

### 9. docs/brain/timer-system.md (75eb75b205360de0660d27d8b243209381277ef9ef5df63d1e5253f267fa4a8d)
- bm25: -16.5975 | relevance: 1.0000

## Key Files

### Core Timer Logic
- **src/app/session/page.js**:
  - `currentTimerMode` state (line ~398)
  - `startPhasePlayTimer()` (line ~780)
  - `transitionToWorkTimer()` (line ~788)
  - `handlePlayTimeUp()` (line ~803)
  - `handlePlayExpiredComplete()` (line ~810)
  - `handleWorkTimeUp()` (line ~835)
  - `markWorkPhaseComplete()` (line ~843)
  - `workPhaseCompletions` state (line ~491)

### Timer Component

#### Pace Coloring (Work Timers)

`SessionTimer` colors **work** timers by comparing lesson progress ($0$-$100$) vs time elapsed ($0$-$100$):

- `timeProgress = (elapsedSeconds / totalSeconds) * 100`
- `progressDiff = lessonProgress - timeProgress`
- Work timers:
  - Yellow when `progressDiff < -5`
  - Red when `progressDiff < -15` or at `00:00`

**Critical wiring rule (V2 parity):** V2 must pass a real `lessonProgress` value into every `SessionTimer` render (especially the in-video overlay timer). If omitted, `SessionTimer` defaults `lessonProgress = 0`, which causes timers to turn yellow/red almost immediately as soon as timeProgress exceeds 5%/15%.

**V2 implementation detail:** V2 computes `lessonProgress` using the same phase-weight mapping as V1 and derives within-phase progress from snapshot `phaseData[phase].nextQuestionIndex` vs total questions.
- **src/app/session/components/PlayTimeExpiredOverlay.jsx**:
  - 30-second countdown overlay
  - Auto-fires `onComplete` callback when countdown finishes

### Timer Defaults
- **src/app/session/utils/phaseTimerDefaults.js**:
  - Default minutes per phase per mode
  - Golden key bonus time constant

### Phase Handlers

### Timer Pause/Resume

**Feature:** Facilitators can pause/resume timers via PIN-gated controls in the timer overlay.

### 10. src/app/session/v2/SessionPageV2.jsx (809a1b3409384be22a2036f6eff125085adec77966a5637ee6877186752abb70)
- bm25: -16.2798 | relevance: 1.0000

{/* Fullscreen Play Timer - mirrors play timer display only (does not control timers) */}
      {showFullscreenPlayTimer && (
        <FullscreenPlayTimerOverlay
          isOpen={showFullscreenPlayTimer}
          secondsRemaining={playTimerDisplayRemaining}
          isPaused={timerPaused}
          onClose={() => setShowFullscreenPlayTimer(false)}
        />
      )}
      
      {/* Play Time Expired Overlay - V1 parity: full-screen overlay outside main container */}
      {showPlayTimeExpired && playExpiredPhase && (
        <PlayTimeExpiredOverlay
          isOpen={showPlayTimeExpired}
          phase={playExpiredPhase}
          lessonKey={lessonKey}
          isPaused={timerPaused}
          muted={isMuted}
          onComplete={handlePlayExpiredComplete}
          onStartNow={handlePlayExpiredStartNow}
        />
      )}
      
      {/* Timer Control Overlay - Facilitator controls for timer and golden key */}
      {showTimerControl && (
        <TimerControlOverlay
          isOpen={showTimerControl}
          onClose={() => setShowTimerControl(false)}
          lessonKey={lessonKey}
          phase={getCurrentPhaseName()}
          timerType={currentTimerMode[getCurrentPhaseName()] || 'work'}
          totalMinutes={getCurrentPhaseTimerDuration(getCurrentPhaseName(), currentTimerMode[getCurrentPhaseName()] || 'work')}
          goldenKeysEntitled={!!planEnt?.goldenKeyFeatures}
          goldenKeysEnabled={!!planEnt?.goldenKeyFeatures && goldenKeysEnabledRef.current !== false}
          goldenKeyBonus={!!planEnt?.goldenKeyFeatures && goldenKeysEnabledRef.current !== false ? goldenKeyBonus : 0}
          isPaused={timerPaused}
          onUpdateTime={(seconds) => {
            const phaseName = getCurrentPhaseName();
            const mode = phaseName ? (curr

### 11. docs/brain/learner-settings-bus.md (b7300c9e22d6512f30566d253d4b066121665795153995c1604d484c67d3c48f)
- bm25: -15.8109 | relevance: 1.0000

### UI Integration Gotcha (LearnerEditOverlay)

The Learners page passes a cloned `learner` prop into `LearnerEditOverlay` (spread + `initialTab`). If the overlay initializes form state in a `useEffect` that depends on the whole `learner` object, the effect will run on every parent rerender and reset local state.

Impact:
- Optimistic toggles (like `golden_keys_enabled`) can appear to "flip back" immediately even when the Supabase update succeeded.

Rule:
- In `LearnerEditOverlay`, only re-initialize local form state when the overlay opens or the learner identity changes (e.g. depend on `isOpen`, `learner.id`, `learner.initialTab`), not on the entire object identity.

This bus is intentionally "dumb": it does not do retries, persistence, or reconciliation.

## What NOT To Do

- Do not store the patches in `localStorage` (this can leak across facilitator accounts on a shared device).
- Do not treat the bus as a database or long-lived state. It is only for immediate UI reaction.
- Do not broadcast before Supabase writes succeed.
- Do not rely on the bus for initial state; always load initial state from Supabase.

## Key Files

- `src/app/lib/learnerSettingsBus.js`
  - `broadcastLearnerSettingsPatch(learnerId, patch)`
  - `subscribeLearnerSettingsPatches(handler)`

- `src/app/facilitator/learners/page.js`
  - Broadcasts patches after updating learner settings.

- `src/app/learn/lessons/page.js`
  - Subscribes and hides Golden Key UI immediately when disabled.

- `src/app/session/page.js`
  - Subscribes in-session and disables Golden Key behavior/UI immediately when disabled.

- `src/app/session/v2/SessionPageV2.jsx`
  - Subscribes in-session and updates `TimerService` Golden Key gate immediately when disabled.

### 12. docs/brain/timer-system.md (cf69c7c5147d370c19d2f265cc0927d39c4a76469db0eb8300c73e80dbae02ad)
- bm25: -14.4937 | relevance: 1.0000

**Persistence:**
- `serialize()` includes playTimers state (phase, elapsed, timeLimit, expired)
- `restore()` resumes play timers from snapshot (recalculates startTime from elapsed)
- `#saveToSessionStorage()` saves currentPlayPhase, playTimerElapsed, playTimerExpired
- `#loadFromSessionStorage()` restores play timer and resumes tick interval if not expired

### Timer State Persistence

**Authoritative source (V2):** `TimerService` state is the source of truth and is persisted/restored via SnapshotService (`snapshot.timerState`).

**Timer state must be saved continuously (V2):**
- Relying only on "one-off" snapshot saves (e.g., on Go, or on overlay actions) causes timers to reset to the full limit on refresh.
- Session V2 must persist `timerState` on a cadence while timers are running so refresh resumes from near-current elapsed time.
- Implementation: SessionPageV2 subscribes to TimerService events and snapshot-saves `timerState`:
  - On `playTimerStart`, `workPhaseTimerStart`, and `playTimerExpired` (immediate)
  - On `playTimerTick` and `workPhaseTimerTick` (throttled; currently ~10s)
  - On `visibilitychange` when the tab is hidden, and on `beforeunload`

**SessionStorage is a mirror (not authoritative):**
- Key pattern: `session_timer_state:{lessonKey}:{phase}:{mode}`
- Keys are written on each tick by TimerService.
- Keys must be cleared for the whole lesson on reset/start-over to avoid stale timers (especially discussion work timers) reappearing after restart.

**Authoritative edits (facilitator overlay):**
- TimerControlOverlay must not mutate `session_timer_state:*` directly because TimerService overwrites these keys every second.
- Authoritative add/subtract time must go through TimerService so phase transitions and the UI stay in sync.

### 13. docs/brain/games-overlay.md (3d69f6755dd3a8792771418e6e2fe533bcaad2786166bfa293915f77a4ff8f9d)
- bm25: -13.7346 | relevance: 1.0000

# Games Overlay (#games-overlay)

**Status**: Canonical  
**Last Updated**: 2026-01-13T00:59:23Z

## How It Works

Games are launched from the in-session **Games overlay**.

- The session pages (V1 and V2) open `GamesOverlay` during play time.
- `GamesOverlay` renders a full-screen modal experience:
  - A game picker menu (list of games)
  - A full-screen active-game view
- A play timer badge (rendered by `SessionTimer`) is optionally passed in and displayed at the top-left.

**Click parity:** If the timer badge is present, it should remain interactive (cursor + click) so the facilitator can open `TimerControlOverlay` from within the Games overlay (PIN-gated), matching the rest of the session.

### Difficulty and Grade

The Games overlay does **not** own a global difficulty setting.

- If a specific game needs grade-driven difficulty, that game should present its own grade selector (or other difficulty control) inside the game UI.
- Games may optionally initialize their own difficulty from the currently selected learner profile (when the game is launched), but that choice must remain scoped to the game.

### Props

`GamesOverlay` accepts:
- `onClose`: closes the overlay
- `playTimer`: a React node (typically `SessionTimer`) rendered as a badge

## What NOT To Do

- Do not add an overlay-wide difficulty selector unless explicitly requested.
- Do not store or persist Games settings to localStorage as a fallback.
- Do not couple Games overlay state to Ms. Sonoma prompt/state; games are independent UI.

## Key Files

- `src/app/session/components/games/GamesOverlay.jsx`
- `src/app/session/page.js` (V1 integration)
- `src/app/session/v2/SessionPageV2.jsx` (V2 integration)

### 14. docs/brain/timer-system.md (b404039d9962462ff4e3c0434db375ab6763da6d88ccc7462dacc762647febfb)
- bm25: -13.2042 | relevance: 1.0000

**2026-01-14**: MAJOR refactor - SessionTimer now pure display component in V2. Receives elapsed/remaining from TimerService events via SessionPageV2 subscriptions. No internal timing logic. Single source of truth architecture eliminates duplicate timer tracking and pause race conditions.

**2026-01-14**: Fixed timer pause issue (second pass): Prevented TimerService from writing to sessionStorage when paused, and prevented SessionTimer from triggering onTimeUp when paused or when resuming from a paused state past expiration time.

**2026-01-14**: Fixed timer pause issue where pausing stopped cosmetic timer display but authoritative timer kept running and could trigger playTimerExpired/stage transitions. Added pause()/resume() methods to TimerService that stop/restart intervals and adjust startTime to preserve elapsed time. Tick methods now guard against running when paused.

**2025-12-28**: Entering Test review now calls `markWorkPhaseComplete('test')`, clears the test timer, and records remaining work time immediately. Grading/review can no longer show an active or timed-out test after all questions are answered.

**2025-12-28**: Golden key detection now reads `workPhaseCompletionsRef` to include phases marked complete in the same tick (no stale state), ensuring earned keys are awarded when the third on-time work phase finishes.

**2025-12-19**: Golden key eligibility now requires three on-time work timers. Facilitator test review shows remaining work time per phase based on work timers only; play timers are ignored.

### 15. src/app/facilitator/learners/components/LearnerEditOverlay.jsx (b83f934b518dda8d3a77981f5cf9040d977cdadbc1963e2a35ce2e0680e6c975)
- bm25: -12.6225 | relevance: 1.0000

// Initialize form when overlay opens or learner identity changes.
	// IMPORTANT: Parent passes a freshly cloned `learner` object each render, so
	// depending on the whole object will reset local form state (including toggles)
	// and can cause optimistic UI (like Golden Keys Off) to snap back.
	useEffect(() => {
		if (!isOpen) return;
		if (!learner) return;
		
		setActiveTab(learner.initialTab || 'basic');
		setName(learner.name || '');
		setGrade(learner.grade || 'K');
		setHumorLevel(normalizeHumorLevel(learner.humor_level));
		setComprehension(String(learner.targets?.comprehension ?? learner.comprehension ?? ''));
		setExercise(String(learner.targets?.exercise ?? learner.exercise ?? ''));
		setWorksheet(String(learner.targets?.worksheet ?? learner.worksheet ?? ''));
		setTest(String(learner.targets?.test ?? learner.test ?? ''));
		setGoldenKeys(String(learner.golden_keys ?? 0));
		setAskDisabled(!!learner.ask_disabled);
		setPoemDisabled(!!learner.poem_disabled);
		setStoryDisabled(!!learner.story_disabled);
		setFillInFunDisabled(!!learner.fill_in_fun_disabled);
		setGoldenKeysEnabled(learner.golden_keys_enabled !== false);
		setPlayComprehensionEnabled(learner.play_comprehension_enabled !== false);
		setPlayExerciseEnabled(learner.play_exercise_enabled !== false);
		setPlayWorksheetEnabled(learner.play_worksheet_enabled !== false);
		setPlayTestEnabled(learner.play_test_enabled !== false);
		setPhaseTimers({ ...getDefaultPhaseTimers(), ...loadPhaseTimersForLearner(learner) });
		setAutoAdvancePhases(learner.auto_advance_phases !== false); // Default true if not set
	}, [isOpen, learner?.id, learner?.initialTab]);

const handleTimerChange = (phase, type, value) => {
		const key = `${phase}_${type}_min`;
		setPhaseTimers(prev => ({ ...prev, [key]: value }));
	};

### 16. sidekick_pack.md (528e7f0cc9fc4bcf24b80f3026738d927dfdc4e41e08c9426d99a1fd47de33e2)
- bm25: -12.5501 | relevance: 1.0000

## What NOT To Do

- Do not store lessons on the device (no localStorage/indexedDB/file downloads).
- Do not reuse Golden Keys to mean "unlock lessons"; Golden Keys are bonus play-time semantics.
- Do not match ownership using filename-only; subject collisions are possible.
- Do not allow path traversal in the download endpoint (`..`, `/`, `\\`).

## Key Files

- `src/app/facilitator/lessons/page.js`
- `src/app/api/facilitator/lessons/download/route.js`
- `src/app/api/facilitator/lessons/list/route.js`
- `src/app/api/lessons/[subject]/route.js`
- `src/app/api/lesson-file/route.js`

### 27. docs/brain/calendar-lesson-planning.md (4da551360e5a46cca2826bfe58a71289a036bb89df00313db4714021b4cc5eab)
- bm25: -14.3879 | relevance: 1.0000

**Usage:**
- `node scripts/check-completions-for-keys.mjs --learner Emma --from 2026-01-05 --to 2026-01-08`

### Scheduled Lessons Overlay: Built-in Lesson Editor

The Calendar day overlay includes an inline lesson editor for scheduled lessons.

This editor matches the regular lesson editor for Visual Aids (button + carousel + generation + persistence).

**Lesson load:**
- Uses `GET /api/facilitator/lessons/get?file=<lesson_key>`
- This endpoint requires an `Authorization: Bearer <access_token>` header.
- The API derives the facilitator user id from the bearer token and loads from `facilitator-lessons/<userId>/...`.
- Client code must not rely on a `userId` query param for this endpoint.

**Lesson save:**
- Uses `PUT /api/facilitator/lessons/update` with JSON body `{ file, lesson }` and `Authorization: Bearer <access_token>`.
- The server enforces that the authenticated user can only edit their own lessons.

### 17. sidekick_pack.md (af53ecc19ee10a49a8b05a6d9667006979cd7d5f304dcfad57d5acde47312bea)
- bm25: -12.5446 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Calendar day cell overlay opens generator, generates lesson, lesson appears in lessons list but not in calendar day cell or as scheduled lesson - investigate the flow from Generate on date button through to calendar state update
```

Filter terms used:
```text
Calendar
day
cell
overlay
opens
generator
generates
lesson
lesson
appears
in
lessons
list
but
not
in
calendar
day
cell
or
as
scheduled
lesson
investigate
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Calendar day cell overlay opens generator generates lesson lesson appears in lessons list but not in calendar day cell or as scheduled lesson investigate

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/calendar-lesson-planning.md (3fa72b30c4a36a0855e8b5e9c7f63b5cb1e38fd2725c7bcf9389c3fa8d2b81ed)
- bm25: -37.0855 | relevance: 1.0000

**Completion query rule (visibility > micro-optimization):**
- Do not rely on `.in('lesson_id', [...scheduledKeys])` when loading completion events.
- Because `lesson_id` formats vary, strict filtering can miss valid completions and make past calendar history appear empty.

### 18. src/app/session/page.js (dc05449d7bbe84c1738d6f67fd731600f41c57280bd3167d9da6192aae876dfa)
- bm25: -12.4971 | relevance: 1.0000

if (typeof learner?.golden_keys_enabled !== 'boolean') {
            throw new Error('Learner profile missing golden_keys_enabled flag. Please run migrations.');
          }
          setGoldenKeysEnabled(learner.golden_keys_enabled);
          goldenKeysEnabledRef.current = learner.golden_keys_enabled;
          if (learner?.session_timer_minutes) {
            setSessionTimerMinutes(Number(learner.session_timer_minutes));
          } else {
            setSessionTimerMinutes(60); // Reset to default if not set
          }
          // Load learner grade
          if (learner?.grade) {
            setLearnerGrade(learner.grade);
          } else {
            setLearnerGrade(''); // Clear if not set
          }
          
          // Load AI feature toggles (default to enabled if not set)
          setAskDisabled(!!learner?.ask_disabled);
          setPoemDisabled(!!learner?.poem_disabled);
          setStoryDisabled(!!learner?.story_disabled);
          setFillInFunDisabled(!!learner?.fill_in_fun_disabled);
          
          // Load auto-advance phases setting (default true = show buttons)
          setAutoAdvancePhases(learner?.auto_advance_phases !== false);
          
          // Load phase timer settings (11 timers)
          const timers = loadPhaseTimersForLearner(learner);
          setPhaseTimers(timers);
          
          // Initialize currentTimerMode to 'play' for all phases
          setCurrentTimerMode(prev => {
            const hasExistingMode = prev && Object.values(prev).some((mode) => mode === 'play' || mode === 'work');
            if (hasExistingMode) {
              return prev;
            }
            return {
              discussion: null, // Not started yet
              comprehension: null,
              exercise: null,

### 19. docs/brain/ingests/pack.planned-lessons-flow.md (c1630e20d42e7416e0786d4762a62020e29931c3609ba5301492ca0c6c410df5)
- bm25: -12.4475 | relevance: 1.0000

## What NOT To Do

- Do not store lessons on the device (no localStorage/indexedDB/file downloads).
- Do not reuse Golden Keys to mean "unlock lessons"; Golden Keys are bonus play-time semantics.
- Do not match ownership using filename-only; subject collisions are possible.
- Do not allow path traversal in the download endpoint (`..`, `/`, `\\`).

## Key Files

- `src/app/facilitator/lessons/page.js`
- `src/app/api/facilitator/lessons/download/route.js`
- `src/app/api/facilitator/lessons/list/route.js`
- `src/app/api/lessons/[subject]/route.js`
- `src/app/api/lesson-file/route.js`

### 27. docs/brain/calendar-lesson-planning.md (4da551360e5a46cca2826bfe58a71289a036bb89df00313db4714021b4cc5eab)
- bm25: -14.3879 | relevance: 1.0000

**Usage:**
- `node scripts/check-completions-for-keys.mjs --learner Emma --from 2026-01-05 --to 2026-01-08`

### Scheduled Lessons Overlay: Built-in Lesson Editor

The Calendar day overlay includes an inline lesson editor for scheduled lessons.

This editor matches the regular lesson editor for Visual Aids (button + carousel + generation + persistence).

**Lesson load:**
- Uses `GET /api/facilitator/lessons/get?file=<lesson_key>`
- This endpoint requires an `Authorization: Bearer <access_token>` header.
- The API derives the facilitator user id from the bearer token and loads from `facilitator-lessons/<userId>/...`.
- Client code must not rely on a `userId` query param for this endpoint.

**Lesson save:**
- Uses `PUT /api/facilitator/lessons/update` with JSON body `{ file, lesson }` and `Authorization: Bearer <access_token>`.
- The server enforces that the authenticated user can only edit their own lessons.

### 20. docs/brain/timer-system.md (93b5f5f1e95bf4a72b420f92660d6ca4559847ff7ab32409c591f92360c08643)
- bm25: -12.3941 | relevance: 1.0000

❌ **Never use local persistence fallback for `play_*_enabled`**
- Do not store per-learner play portion flags in localStorage.
- Source of truth is Supabase; the bus is for immediate UI reaction only.

❌ **Never add a Discussion play toggle**
- Discussion has no play timer in V2, and this feature only targets phases 2-5.

❌ **Never award or apply Golden Key bonus when disabled**
- If `golden_keys_enabled` is false, do not apply bonus minutes and do not write golden key awards.

❌ **Never hide play buttons manually in timer expiry handler**
- Phase handlers (handleGoComprehension, etc.) already call `setShowOpeningActions(false)`
- Setting it in handlePlayExpiredComplete creates race conditions and breaks phase transitions
- Let each phase handler manage its own button visibility

❌ **Never allow play buttons to remain visible after timer expiry**
- Timer expiry must automatically advance to work phase
- Play buttons will be hidden by the phase handler that starts the work

❌ **Never require Go button click after timer expiry**
- Timer expiry should bypass Go button confirmation
- `handlePlayExpiredComplete` must auto-start the work phase

❌ **Never allow refresh to reset play timer**
- First interaction gate persists timer state
- `recordFirstInteraction()` wrapper ensures snapshot save on first button click

❌ **Never modify timer state without clearing sessionStorage**
- When transitioning play → work, clear play timer key from sessionStorage
- Prevents stale timer state on refresh

❌ **Never show countdown overlay without phase context**
- `playExpiredPhase` must be set so correct work handler fires
- Overlay should display which phase learner will return to

## Related Brain Files

### 21. docs/brain/facilitator-help-system.md (ffbf431a9f6e26b06514fa0338cb9cd66e55ce8d4e66f733d9e2e5b45aa1864e)
- bm25: -12.1977 | relevance: 1.0000

**InlineExplainer (Footer Help Pattern)** placed in overlay footers:
- Learners page: Targets, AI Features, and Timers overlays
- Help button (❓ Show/Hide Help) appears in left side of footer
- Expands inline help text above footer buttons
- Uses `showHelp` state to toggle visibility
- Help content changes based on active tab context

**WorkflowGuide** placed at:
- Top of calendar Planner tab (automated lesson planning workflow)
- Top of lessons library (approve vs schedule workflow)

**PageHeader** replaces:
- Standalone h1/p combos on Calendar, Learners, Lessons pages
- Provides consistent page context

### Import Pattern

Components exported as named exports from `src/components/FacilitatorHelp/index.js`:

```javascript
import { InlineExplainer, WorkflowGuide, PageHeader } from '@/components/FacilitatorHelp'
```

---

## What NOT To Do

1. **Do NOT add help to every field** - Only explain genuinely confusing concepts (timers, planner workflow). Avoid over-explaining obvious controls.

2. **Do NOT replace existing tooltips** - LearnerEditOverlay has hover tooltips for individual timer fields. InlineExplainer supplements, doesn't replace.

3. **Do NOT hardcode content in 100 places** - Use centralized help components. If content needs to be dynamic, pass as props, don't fork components.

4. **Do NOT break dismissal persistence** - Always provide unique helpKey/workflowKey. Duplicate keys cause unintended dismissals across different help instances.

5. **Do NOT add help without user testing feedback** - This system addresses specific beta tester confusion. Don't add speculative help for features users haven't reported issues with.

### 22. src/app/session/v2/TimerService.jsx (c366ffd95c213031782db363c3a2ba3af35515665534c9d34e73a8e41492b13b)
- bm25: -12.1447 | relevance: 1.0000

/**
 * TimerService.jsx
 * Manages session, play, and work phase timers
 * 
 * Timers:
 * - Session timer: Tracks total session duration from start to complete
 * - Play timers: Green timer for exploration/opening actions (phases 2-5: Comprehension, Exercise, Worksheet, Test)
 * - Work phase timers: Amber/red timer for focused work (for golden key)
 * 
 * Timer Modes:
 * - Phase 1 (Discussion): No play timer, no opening actions (eliminates play timer exploit)
 * - Phases 2-5 (Comprehension, Exercise, Worksheet, Test): Play timer → opening actions → work timer
 * 
 * Golden Key Requirements:
 * - Need 3 work phases completed within time limit
 * - Work phases: exercise, worksheet, test
 * - Time limits defined per grade/subject
 * 
 * Events emitted:
 * - sessionTimerStart: { timestamp } - Session timer started
 * - sessionTimerTick: { elapsed, formatted } - Every second while running
 * - sessionTimerStop: { elapsed, formatted } - Session timer stopped
 * - playTimerStart: { phase, timestamp, timeLimit } - Play timer started
 * - playTimerTick: { phase, elapsed, remaining, formatted } - Every second during play time
 * - playTimerExpired: { phase } - Play timer reached 0:00
 * - workPhaseTimerStart: { phase, timestamp } - Work phase timer started
 * - workPhaseTimerTick: { phase, elapsed, remaining, onTime } - Every second during work time
 * - workPhaseTimerComplete: { phase, elapsed, onTime } - Work phase completed
 * - workPhaseTimerStop: { phase, elapsed } - Work phase stopped
 * - goldenKeyEligible: { completedPhases } - 3 on-time work phases achieved
 */

'use client';

### 23. src/app/session/v2/SessionPageV2.jsx (068180622d252e4bf7e9a66be7739be947aa31bb6b73c11357cd1f6d2ab6a1b7)
- bm25: -12.0934 | relevance: 1.0000

// Convert minutes -> seconds; golden key bonus applies to play timers only (and only when Golden Keys are enabled).
    const playBonusSec = goldenKeysEnabledRef.current
      ? Math.max(0, Number(goldenKeyBonusRef.current || 0)) * 60
      : 0;
    const m2s = (m) => Math.max(0, Number(m || 0)) * 60;

### 24. src/app/session/v2/SessionPageV2.jsx (02513d60ecb74795308f0a5973f855e70f428134f295b6109b606cfd91fc414f)
- bm25: -12.0201 | relevance: 1.0000

const meetsGoldenKey = (() => {
    try {
      if (!goldenKeysEnabled) return false;
      const status = timerService?.getGoldenKeyStatus?.();
      if (status && typeof status.eligible === 'boolean') return status.eligible;
      return onTimeCount >= 3;
    } catch {
      return onTimeCount >= 3;
    }
  })();
  
  const formatQuestionForDisplay = (q) => {
    if (typeof q === 'string') return q;
    return q?.question || q?.text || '';
  };
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 12, 
      overflow: 'auto', 
      paddingTop: 8, 
      paddingBottom: 8,
      height: '100%'
    }}>
      <div style={{ 
        ...card, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 12, 
        position: 'sticky', 
        top: 0, 
        zIndex: 5, 
        background: '#ffffff' 
      }}>
        <div style={{ fontSize: 'clamp(1.1rem, 2.4vw, 1.4rem)', fontWeight: 800, color: '#065f46' }}>
          {percentage}% grade
        </div>
        <div style={{ fontSize: 'clamp(1.2rem, 2.6vw, 1.5rem)' }} aria-label="Medal preview">{medal}</div>
      </div>
      
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 800 }}>Work timers</div>
        {goldenKeysEnabled ? (
          <div style={{ fontWeight: 700, color: meetsGoldenKey ? '#065f46' : '#7f1d1d' }}>
            {meetsGoldenKey ? 'Golden key eligible (3+ on-time work timers)' : 'Golden key not yet met (needs 3 on-time work timers)'}
          </div>
        ) : null}
        <div style={{ fontSize: 13, color: '#4b5563' }}>Play timers are ignored here.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minm

### 25. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (8163644eb7df3a7e0c7fbbd03814d28f85cdc1339a3c403f07748601ecc1ac92)
- bm25: -11.8671 | relevance: 1.0000

2025-12-09T20:30:00Z | Copilot | CRITICAL AUTH FIX v2: Per-user storage isolation instead of per-tab. Previous fix required re-login on every refresh (unacceptable UX). New approach: each USER gets isolated storage namespace, but same user shares auth across all tabs. Custom storage adapter implements Supabase Storage interface, stores auth at supabase-auth-user-<userId> keys. Client instances cached per userId (not singleton). Same user in multiple tabs shares client and auth (stay logged in together). Different users in different tabs use separate storage keys (isolated). Page refresh auto-detects user ID from localStorage, restores correct client (no re-login). Logout propagates to all tabs for that user but not to tabs with different users. Handles legacy migration from default storage key. Files: src/app/lib/supabaseClient.js (custom UserIsolatedStorage class, clientsByUserId Map, user ID auto-detection), docs/brain/auth-session-isolation.md (completely rewritten with per-user architecture). [REVERTED - see 2025-12-09T21:00:00Z]
2025-12-09T20:00:00Z | Copilot | CRITICAL AUTH FIX: Cross-tab auth leakage - logging out in one tab logged out ALL tabs, logging into new account in Tab A switched Tab B to that account. Root cause: Supabase client used default shared localStorage key 'sb-<project>-auth-token' for all tabs. Auth state changes in one tab immediately affected all other tabs via shared localStorage. Solution: Added per-tab unique storageKey using sessionStorage-persisted UUID (supabase-auth-<UUID>). Each tab generates unique storage key on first load, isolating auth sessions. Tab A logout/login no longer affects Tab B. Auth persists within tab across page navigation but refreshing tab generates new UUID (requires re-login, acceptable trade-off vs auth leakage)

### 26. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (6f33983453dfbb17ba0b015de6cc76fa071dc0e7a401f52396b7093115ac315c)
- bm25: -11.8410 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
  - Month navigation: month/year dropdowns plus adjacent < and > buttons to move one month backward/forward
  - Tabs under the calendar toggle BOTH:
    - The selected-date list: Scheduled vs Planned
    - The calendar date-cell markers/highlights (only the active tab is marked)
  - Tabs remain visible even before selecting a date; list shows a select-a-date hint
  - The selected date label renders below the tabs (not above)
  - Scheduled list actions:
    - Today/future: Edit (full-page editor overlay), Reschedule, Remove
    - Past (completed-only): Notes, Add Image, Remove (typed `remove` confirmation; irreversible warning)
  - Planned list actions: Generate (opens generator overlay for that date), Redo, Remove
  - Overlay stacking rule: full-screen overlays/modals are rendered via React portal to document.body so they are not trapped by spill-suppression/stacking contexts; z-index alone is not sufficient
  - Planned tab CTA: Create a Lesson Plan opens a full-screen Lesson Planner overlay (reuses the Calendar page LessonPlanner)

### 27. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (9cc323629ddd2145461939a8ea0910f1262ae81d210a78303cc32979399b4a31)
- bm25: -11.8132 | relevance: 1.0000

**`/api/counselor` integration:**
- Request body now includes `goals_notes` field
- System prompt includes: `"PERSISTENT GOALS & PRIORITIES:\n{goals_notes}"`
- Mr. Mentor sees goals in every conversation turn

## Key Files

- `src/app/counselor/CounselorClient.jsx` - Goals button, state management, auto-load on learner switch
- `src/components/GoalsClipboardOverlay.jsx` - Overlay UI component
- `src/app/api/goals-notes/route.js` - Load/save API endpoint
- `src/app/api/counselor/route.js` - Receives goals_notes, includes in system prompt

## What NOT To Do

**DON'T exceed 600 character limit** - UI enforces this but API should validate too. Longer text risks token bloat and poor UX.

**DON'T fail silently on load errors** - If goals fail to load, show user-friendly message. Missing goals can confuse facilitators who expect Mr. Mentor to remember context.

**DON'T forget to clear goals on learner switch** - When learner changes, immediately load new goals. Stale goals = wrong context.

**DON'T make goals optional in API calls** - Always send `goals_notes` field (empty string if none) so Mr. Mentor knows explicitly whether goals exist or not.

### 18. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a69efca9880db84d16bcf2416cead5e30a8ee222c1531e8f6d6ad02cf39c54d3)
- bm25: -17.0642 | relevance: 1.0000

### 28. src/app/session/v2/SessionPageV2.jsx (8a144872f2fee2d020af559c7576ecdbb801e6cdf248baf4f405694cd145de71)
- bm25: -11.7528 | relevance: 1.0000

// Clear active golden key for this lesson when the lesson is completed (V1 parity).
      // This ensures the key persists across exits/resumes until completion, but does not stick forever after completion.
      if (goldenKeysEnabledRef.current !== false && hasGoldenKeyRef.current) {
        const appliedKey = goldenKeyLessonKeyRef.current;
        const clearLearnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
        if (appliedKey && clearLearnerId && clearLearnerId !== 'demo') {
          try {
            const { getLearner, updateLearner } = await import('@/app/facilitator/learners/clientApi');
            const learner = await getLearner(clearLearnerId);
            if (learner) {
              const activeKeys = { ...(learner.active_golden_keys || {}) };
              if (activeKeys[appliedKey]) {
                delete activeKeys[appliedKey];
                await updateLearner(clearLearnerId, { active_golden_keys: activeKeys });
              }
            }
          } catch (err) {
            console.warn('[SessionPageV2] Failed to clear active golden key on completion:', err);
          }
        }
      }

### 29. sidekick_pack.md (823f4a32054ed567322f6c38220db8530887b63d7930a702a348ffe734c95072)
- bm25: -11.7054 | relevance: 1.0000

### 22. sidekick_pack.md (f0e0466a6588f66493c88c0b00e750e7c20b3e5b9f4eedd4cfc00bcd3826f40a)
- bm25: -24.5808 | relevance: 1.0000

PIN verification is server-only (no localStorage fallback):
- Server validates PIN against hashed value in `profiles.facilitator_pin_hash`
- Uses bcrypt for secure comparison
- API endpoint: `POST /api/facilitator/pin/verify`

### 38. docs/brain/ingests/pack.planned-lessons-flow.md (c1630e20d42e7416e0786d4762a62020e29931c3609ba5301492ca0c6c410df5)
- bm25: -1.7211 | entity_overlap_w: 1.30 | adjusted: -2.0461 | relevance: 1.0000

## What NOT To Do

- Do not store lessons on the device (no localStorage/indexedDB/file downloads).
- Do not reuse Golden Keys to mean "unlock lessons"; Golden Keys are bonus play-time semantics.
- Do not match ownership using filename-only; subject collisions are possible.
- Do not allow path traversal in the download endpoint (`..`, `/`, `\\`).

## Key Files

- `src/app/facilitator/lessons/page.js`
- `src/app/api/facilitator/lessons/download/route.js`
- `src/app/api/facilitator/lessons/list/route.js`
- `src/app/api/lessons/[subject]/route.js`
- `src/app/api/lesson-file/route.js`

### 27. docs/brain/calendar-lesson-planning.md (4da551360e5a46cca2826bfe58a71289a036bb89df00313db4714021b4cc5eab)
- bm25: -14.3879 | relevance: 1.0000

**Usage:**
- `node scripts/check-completions-for-keys.mjs --learner Emma --from 2026-01-05 --to 2026-01-08`

### Scheduled Lessons Overlay: Built-in Lesson Editor

The Calendar day overlay includes an inline lesson editor for scheduled lessons.

This editor matches the regular lesson editor for Visual Aids (button + carousel + generation + persistence).

### 30. docs/brain/timer-system.md (094648dd5ab12b57480db81378d3eff701f115a508b88fabd9e56c6787fe3b91)
- bm25: -11.6954 | relevance: 1.0000

When the work timer expires or the phase is completed (including when Test hands off to facilitator review):
- `markWorkPhaseComplete` stamps the phase in `workPhaseCompletions` and clears that phase's timer entry in `currentTimerMode`
- Completing 3 on-time work phases earns a golden key (play timers ignored)
- Golden key adds bonus time to all future play timers
- `workTimeRemaining` records minutes left on each work timer when the phase ends (0 on timeout) and is surfaced in facilitator review for transparency; entering Test review now captures and freezes the remaining test work time so review/grading cannot keep an active timer running
- Golden key detection uses the live `workPhaseCompletionsRef` so a just-marked phase (e.g., Test on review entry) counts immediately without waiting for React state flush

### 31. src/app/session/page.js (bd54ae00b138d3799981ca411eec174706f32b2460c5e3d029f3acc474cb5c71)
- bm25: -11.6104 | relevance: 1.0000

// Handle golden key suspension
  const handleSuspendGoldenKey = useCallback(() => {
    setIsGoldenKeySuspended(true);
    setShowTimerControls(false);
  }, []);

// Handle golden key unsuspension
  const handleUnsuspendGoldenKey = useCallback(() => {
    setIsGoldenKeySuspended(false);
    setShowTimerControls(false);
  }, []);

// Handle timer completion
  const handleTimeUp = useCallback(() => {
    // When time is up, show warning but allow learner to continue
    if (typeof window !== 'undefined') {
      alert('Time is up! Complete the lesson to see if you earned the golden key.');
    }
  }, []);

### 32. sidekick_pack.md (a6a5a8402f60a32ae3f5331f3e88e3b679090d1e257e5157603316df1542732f)
- bm25: -11.5763 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
  - Month navigation: month/year dropdowns plus adjacent < and > buttons to move one month backward/forward
  - Tabs under the calendar toggle BOTH:
    - The selected-date list: Scheduled vs Planned
    - The calendar date-cell markers/highlights (only the active tab is marked)
  - Tabs remain visible even before selecting a date; list shows a select-a-date hint
  - The selected date label renders below the tabs (not above)
  - Scheduled list actions:
    - Today/future: Edit (full-page editor overlay), Reschedule, Remove
    - Past (completed-only): Notes, Add Image, Remove (typed `remove` confirmation; irreversible warning)
  - Planned list actions: Generate (opens generator overlay for that date), Redo, Remove
  - Overlay stacking rule: full-screen overlays/modals are rendered via React portal to document.body so they are not trapped by spill-suppression/stacking contexts; z-index alone is not sufficient
  - Planned tab CTA: Create a Lesson Plan opens a full-screen Lesson Planner overlay (reuses the Calendar page LessonPlanner)

### 33. sidekick_pack.md (cad378213fd13855af53d533bd71221aed90460d4fbb4523573edc023e104f0e)
- bm25: -11.5763 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
  - Month navigation: month/year dropdowns plus adjacent < and > buttons to move one month backward/forward
  - Tabs under the calendar toggle BOTH:
    - The selected-date list: Scheduled vs Planned
    - The calendar date-cell markers/highlights (only the active tab is marked)
  - Tabs remain visible even before selecting a date; list shows a select-a-date hint
  - The selected date label renders below the tabs (not above)
  - Scheduled list actions:
    - Today/future: Edit (full-page editor overlay), Reschedule, Remove
    - Past (completed-only): Notes, Add Image, Remove (typed `remove` confirmation; irreversible warning)
  - Planned list actions: Generate (opens generator overlay for that date), Redo, Remove
  - Overlay stacking rule: full-screen overlays/modals are rendered via React portal to document.body so they are not trapped by spill-suppression/stacking contexts; z-index alone is not sufficient
  - Planned tab CTA: Create a Lesson Plan opens a full-screen Lesson Planner overlay (reuses the Calendar page LessonPlanner)

### 34. sidekick_pack.md (1f28777aa00516f363d491420dfa6a99c690b1cfebadbd59af7be0334bd94883)
- bm25: -11.5763 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
  - Month navigation: month/year dropdowns plus adjacent < and > buttons to move one month backward/forward
  - Tabs under the calendar toggle BOTH:
    - The selected-date list: Scheduled vs Planned
    - The calendar date-cell markers/highlights (only the active tab is marked)
  - Tabs remain visible even before selecting a date; list shows a select-a-date hint
  - The selected date label renders below the tabs (not above)
  - Scheduled list actions:
    - Today/future: Edit (full-page editor overlay), Reschedule, Remove
    - Past (completed-only): Notes, Add Image, Remove (typed `remove` confirmation; irreversible warning)
  - Planned list actions: Generate (opens generator overlay for that date), Redo, Remove
  - Overlay stacking rule: full-screen overlays/modals are rendered via React portal to document.body so they are not trapped by spill-suppression/stacking contexts; z-index alone is not sufficient
  - Planned tab CTA: Create a Lesson Plan opens a full-screen Lesson Planner overlay (reuses the Calendar page LessonPlanner)

### 35. docs/brain/MentorInterceptor_Architecture.md (b9af78a6a85babc29ee74ec9cf6073767b7a2e84a19456e1f96ab9a407cbd74d)
- bm25: -11.5451 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
  - Month navigation: month/year dropdowns plus adjacent < and > buttons to move one month backward/forward
  - Tabs under the calendar toggle BOTH:
    - The selected-date list: Scheduled vs Planned
    - The calendar date-cell markers/highlights (only the active tab is marked)
  - Tabs remain visible even before selecting a date; list shows a select-a-date hint
  - The selected date label renders below the tabs (not above)
  - Scheduled list actions:
    - Today/future: Edit (full-page editor overlay), Reschedule, Remove
    - Past (completed-only): Notes, Add Image, Remove (typed `remove` confirmation; irreversible warning)
  - Planned list actions: Generate (opens generator overlay for that date), Redo, Remove
  - Overlay stacking rule: full-screen overlays/modals are rendered via React portal to document.body so they are not trapped by spill-suppression/stacking contexts; z-index alone is not sufficient
  - Planned tab CTA: Create a Lesson Plan opens a full-screen Lesson Planner overlay (reuses the Calendar page LessonPlanner)

### 36. docs/brain/ingests/pack.planned-lessons-flow.md (88c29dc19b3f25ed0178c73764a3887f3532851fb2e1292ab2f58b31241fad00)
- bm25: -11.4986 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
  - Month navigation: month/year dropdowns plus adjacent < and > buttons to move one month backward/forward
  - Tabs under the calendar toggle BOTH:
    - The selected-date list: Scheduled vs Planned
    - The calendar date-cell markers/highlights (only the active tab is marked)
  - Tabs remain visible even before selecting a date; list shows a select-a-date hint
  - The selected date label renders below the tabs (not above)
  - Scheduled list actions:
    - Today/future: Edit (full-page editor overlay), Reschedule, Remove
    - Past (completed-only): Notes, Add Image, Remove (typed `remove` confirmation; irreversible warning)
  - Planned list actions: Generate (opens generator overlay for that date), Redo, Remove
  - Overlay stacking rule: full-screen overlays/modals are rendered via React portal to document.body so they are not trapped by spill-suppression/stacking contexts; z-index alone is not sufficient
  - Planned tab CTA: Create a Lesson Plan opens a full-screen Lesson Planner overlay (reuses the Calendar page LessonPlanner)

### 37. docs/brain/snapshot-persistence.md (4e5c83ecb2a3d3d2fc5d4ef712795b0c811f949a3a73536e87274e302e86b831)
- bm25: -11.2415 | relevance: 1.0000

# Snapshot Persistence System

## Core Architecture

**ATOMIC GATES, NOT POLLING**

Snapshots save at explicit checkpoints only. No autosave, no polling, no drift correction.

**Scope:** This document covers snapshot saves and restores for lesson state persistence. For session ownership and device conflict detection, see [session-takeover.md](session-takeover.md).

**Identity:** Snapshot identity is strictly `(learnerId, lessonKey)` where `lessonKey` is the canonical filename (no subject prefix, no `.json`). V2 now derives this with the same helper as V1 (`getSnapshotStorageKey` rules: URL param first, then manifest file, then lesson id; strip prefixes/extensions). Lesson == session; no extra sessionId dimension is used in the key, so golden key, timers, and snapshots all share the same canonical `lessonKey`.

## Complete Lesson Cleanup

When user clicks "Complete Lesson" button:

1. **Set prevention flag** - `window.__PREVENT_SNAPSHOT_SAVE__ = true` blocks any snapshot saves during cleanup
2. **Clear assessments** - `clearAssessments()` removes all 4 generated arrays (comprehension, exercise, worksheet, test) from localStorage and database
3. **Clear snapshots** - `clearSnapshot()` removes resume state from localStorage and database using all possible key variations
4. **Clear timer state** - Remove phase-based timer states from sessionStorage
5. **Clear golden key** - Remove active golden key for this lesson if used
6. **End tracked session** - Close `lesson_sessions` and write a `lesson_session_events` row (`event_type='completed'`) so Calendar history can detect completion
7. **Save transcript** - Persist final transcript segment to Supabase Storage
8. **Navigate away** - Redirect to /learn/lessons

### 38. docs/brain/learner-settings-bus.md (b9605e778142d0a5b6b23fbb0be32d75ff6241842ee197d10f42c66a06cbd08d)
- bm25: -11.1590 | relevance: 1.0000

Keep behavior strict:
- Do not create local fallback state that can diverge from Supabase.
- Treat settings as **unknown until loaded**. For example, `golden_keys_enabled` should start as `null` (unknown), then become `true`/`false` once loaded.
- Treat `play_*_enabled` the same way: required booleans loaded from Supabase (no local fallback).
- Avoid UI flashes: do not render Golden Key UI until `golden_keys_enabled === true` and the page is done loading learner settings.
- Hide per-lesson Golden Key indicators (like a "🔑 Active" badge) unless `golden_keys_enabled === true`.
- Avoid toast loss: do not clear `sessionStorage.just_earned_golden_key` while `golden_keys_enabled` is unknown; only clear/suppress once it is explicitly `false`.

### 39. docs/brain/README.md (a9d53428a66f32a8f0f0b034bee45fb77b0ac883ab99d0de9cdcabf09ef72d0a)
- bm25: -11.1397 | relevance: 1.0000

## Instruction Inventory
| Area | Reference | Notes |
| --- | --- | --- |
| Beta program gating | `docs/BETA_PROGRAM_IMPLEMENTATION.md` | Contains flow and schema details; summarize key guardrails here after review. |
| Universal gating overlays | `docs/UNIVERSAL_GATING_SYSTEM.md` | Track overlay patterns and migration status. |
| Lesson approvals | `APPROVED_LESSONS_IMPLEMENTATION.md` | Record facilitator approval protocol highlights. |
| Session timing | `docs/session-timer-system.md` | Capture timers, warnings, and dependencies. |
| Profanity filtering | `docs/profanity-filter*.md` | Note vocabulary policies and testing steps. |

### 40. docs/brain/timer-system.md (1f66fc9b2014880a4f602ba3a64aeb3037bbda3f80bafc5c833fb3aeea069133)
- bm25: -11.0659 | relevance: 1.0000

### Play Portion Enabled Flags (Per Learner)

Phases 2-5 (Comprehension, Exercise, Worksheet, Test) each have a per-learner flag that can disable the "play portion" of that phase.

Columns (boolean, default true):
- `public.learners.play_comprehension_enabled`
- `public.learners.play_exercise_enabled`
- `public.learners.play_worksheet_enabled`
- `public.learners.play_test_enabled`

Definition:
- "Play portion" means the intro + opening-actions gate + play timer.
- When a play portion flag is `false`, the phase should begin directly in work mode.

V2 behavior (implemented):
- When play portion is disabled for a phase, "Begin" behaves like "Go": it skips intro/opening actions, skips starting the play timer, and starts the work timer immediately.
- The session fails loudly if any `play_*_enabled` field is missing (not a boolean).
- Live updates use the Learner Settings Bus; if a flag is turned off while sitting at the Go gate (`awaiting-go`), the session transitions to work immediately.

V1 behavior:
- V1 is not updated by this feature unless explicitly requested.

### Timer Defaults

Defined in `src/app/session/utils/phaseTimerDefaults.js`:
- Discussion: 8 min play, 12 min work
- Comprehension: 8 min play, 12 min work
- Exercise: 8 min play, 12 min work
- Worksheet: 8 min play, 12 min work
- Test: 8 min play, 12 min work
- Golden key bonus: +5 min to all play timers

## What NOT To Do

❌ **Never describe Golden Keys as unlocking Poem/Story**
- A Golden Key adds bonus minutes to play timers (extra play time)
- Do not label it as unlocking specific activities (Poem/Story)
