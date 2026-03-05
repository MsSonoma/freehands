# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
phaseChange handler startPhasePlayTimer overwrites work mode on resume — fix for comprehension exercise worksheet test phases
```

Filter terms used:
```text
phasechange
handler
startphaseplaytimer
overwrites
work
mode
resume
fix
comprehension
exercise
worksheet
test
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-02 19:52` — Q&A answer submission hangs or goes unresponsive in session teaching flow
- `2026-03-03 08:50` — Curriculum Preferences focuses and bans per subject with dropdown selector, custom subjects, per-subject saving, prompt 
- `2026-03-05 11:36` — hardened video initialization, resume logic correct time, golden key timer overlay applies to authoritative timer, skip 

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

Pack chunk count (approximate): 5. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

phasechange handler startphaseplaytimer overwrites work mode resume fix comprehension exercise worksheet test

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/v2/SessionPageV2.jsx (8b1614f1b3679130fde770c0d063433bcd5cb4796e14b81131a420da0c9fb6a3)
- bm25: -24.3739 | relevance: 0.9606

// Ensure a phase instance exists (e.g., when learner loads after phaseChange fired).
  const ensurePhaseInitialized = (phaseName) => {
    const refMap = {
      comprehension: comprehensionPhaseRef,
      exercise: exercisePhaseRef,
      worksheet: worksheetPhaseRef,
      test: testPhaseRef
    };
    const startMap = {
      comprehension: startComprehensionPhase,
      exercise: startExercisePhase,
      worksheet: startWorksheetPhase,
      test: startTestPhase
    };

### 2. src/app/session/v2/SessionPageV2.jsx (2dd79b6a5e5782c933381ac94dbae5728682bb02d041f40ca0d5ea32f38fd8fe)
- bm25: -23.1181 | relevance: 0.9585

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

### 3. src/app/session/v2/TimerService.jsx (5d1aff774ce802b41453c7627fd9add331616de55a4f27ac75250e10e83b7689)
- bm25: -23.0198 | relevance: 0.9584

if (mode === 'work') {
      const validPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
      if (!validPhases.includes(phase)) return;

### 4. docs/brain/snapshot-persistence.md (83771570e459d80f3130a04413886133c035ef9a1167a6692812acf99b672017)
- bm25: -22.1644 | relevance: 0.9568

## Checkpoint Gates (Where Snapshots Save)

- **Discussion entry**: `begin-discussion` (no opening actions in V2).
- **Teaching**: `begin-teaching-definitions`, `vocab-sentence-1/N` (before each TTS), `begin-teaching-examples`, `example-sentence-1/N` (before each TTS).
- **Q&A seeding** (deterministic resume): `comprehension-init`, `exercise-init`, `worksheet-init`, `test-init` fire on phase start and persist question arrays + `nextQuestionIndex` + `score` + `answers` + `timerMode` (with `phaseOverride`).
- **Q&A post-Go (work-mode checkpoint)**: `comprehension-go`, `exercise-go`, `worksheet-go`, `test-go` fire immediately when the learner presses **Go**. These writes set `timerMode:'work'` with `nextQuestionIndex:0` so a refresh before answering Q1 resumes on the first question (not back to Opening Actions).
- **Q&A granular**: `comprehension-answer`, `comprehension-skip`, `exercise-answer`, `exercise-skip`, `worksheet-answer`, `worksheet-skip`, `test-answer`, `test-skip` after each submission/skip (payload includes questions, answers, next index, timerMode; Test also includes reviewIndex).
- **Navigation**: `skip-forward`, `skip-back` (timeline jumps).

## Related Brain Files

- **[timer-system.md](timer-system.md)** - Timer state (currentTimerMode, workPhaseCompletions, golden key) persisted in snapshots
- **[session-takeover.md](session-takeover.md)** - Takeover flow triggers snapshot restore with timer state

## Key Files

- `src/app/session/sessionSnapshotStore.js` - Save/restore with localStorage+database
- `src/app/session/hooks/useSnapshotPersistence.js` - scheduleSaveSnapshot wrapper
- `src/app/session/hooks/useTeachingFlow.js` - Teaching checkpoint saves
- `src/app/session/page.js` - Comprehension/phase checkpoint saves

## What Was Removed

### 5. src/app/facilitator/learners/clientApi.js (75eb93ab506eaa0c7451ad91d14358e6207022eecf10ffe6d02f87244f5c1596)
- bm25: -21.6010 | relevance: 0.9558

// Helpers
function normalizeRow(row) {
  if (!row) return row;
  const c = (v)=> (v == null ? undefined : Number(v));
  const humorLevel = resolveHumorLevel(row.humor_level ?? row.preferences?.humor_level ?? null, DEFAULT_HUMOR_LEVEL);
  const merged = {
    ...row,
    comprehension: c(row.comprehension ?? row.targets?.comprehension),
    exercise: c(row.exercise ?? row.targets?.exercise),
    worksheet: c(row.worksheet ?? row.targets?.worksheet),
    test: c(row.test ?? row.targets?.test),
    session_timer_minutes: c(row.session_timer_minutes),
    golden_keys: c(row.golden_keys),
    active_golden_keys: row.active_golden_keys || {},
    golden_keys_enabled: row.golden_keys_enabled !== false,
    play_comprehension_enabled: row.play_comprehension_enabled !== false,
    play_exercise_enabled: row.play_exercise_enabled !== false,
    play_worksheet_enabled: row.play_worksheet_enabled !== false,
    play_test_enabled: row.play_test_enabled !== false,
    humor_level: humorLevel,
    ask_disabled: !!row.ask_disabled,
    poem_disabled: !!row.poem_disabled,
    story_disabled: !!row.story_disabled,
    fill_in_fun_disabled: !!row.fill_in_fun_disabled,
    auto_advance_phases: row.auto_advance_phases !== false,
    // Phase timer fields
    discussion_play_min: c(row.discussion_play_min),
    discussion_work_min: c(row.discussion_work_min),
    comprehension_play_min: c(row.comprehension_play_min),
    comprehension_work_min: c(row.comprehension_work_min),
    exercise_play_min: c(row.exercise_play_min),
    exercise_work_min: c(row.exercise_work_min),
    worksheet_play_min: c(row.worksheet_play_min),
    worksheet_work_min: c(row.worksheet_work_min),
    test_play_min: c(row.test_play_min),
    test_work_min: c(row.test_work_min),
    golden_key_bonus_min: c(row.golden_

### 6. src/app/session/hooks/useSnapshotPersistence.js (4698b3071633f16c3763fdf8ca347c1b304fae9a54d2632505f7143c44bfb80b)
- bm25: -21.5269 | relevance: 0.9556

// Check if play timer expired while page was closed.
              // Skip countdown by setting flag and transition to work mode.
              if (desiredMode === 'play' && Number.isFinite(target) && adjustedElapsed >= target) {
                if (typeof setPlayExpiredCountdownCompleted === 'function') {
                  setPlayExpiredCountdownCompleted(true);
                }
                setCurrentTimerMode((prev) => ({
                  ...(prev || {}),
                  [timerPhaseName]: 'work',
                }));
                try {
                  sessionStorage.removeItem(storageKey);
                } catch {}
                if (typeof setNeedsPlayExpiredTransition === 'function') {
                  setNeedsPlayExpiredTransition(timerPhaseName);
                }
              }
            }
          }
        } catch {}
        
        // Defer clearing loading until the resume reconciliation effect completes
        try { setTtsLoadingCount(0); } catch {}
        // DO NOT set isSpeaking=false here - let audio.onended handle it after caption replay
        try {
          // Minimal canSend heuristics on restore: enable only when in awaiting-begin or review or teaching stage prompts
          const enable = (
            (snap.phase === 'discussion' && snap.subPhase === 'awaiting-learner') ||
            (snap.phase === 'comprehension' && snap.subPhase === 'comprehension-start') ||
            (snap.phase === 'exercise' && snap.subPhase === 'exercise-awaiting-begin') ||
            (snap.phase === 'worksheet' && snap.subPhase === 'worksheet-awaiting-begin') ||
            (snap.phase === 'test' && (snap.subPhase === 'test-awaiting-begin' || snap.subPhase === 'review-start')) ||
            (snap.phase === 'teaching' && snap.subPhase === 'tea

### 7. docs/brain/snapshot-persistence.md (f87d966760c556fc2fde0b69db52ba05eaee701f6f8d5ee1c6782274d56614c0)
- bm25: -20.8499 | relevance: 0.9542

### V2 Save Flow
On phase transition:
1. **PhaseOrchestrator** emits `phaseChange` with the new phase name.
2. **SessionPageV2** calls `savePhaseCompletion(phase)` immediately so `SnapshotService.#snapshot.currentPhase` is set before granular saves run.
3. Each phase controller emits `requestSnapshotSave` after user actions (answers, skips, teaching sentence advances), and **saveProgress()** writes under the active phase key. `saveProgress()` now accepts `phaseOverride` so seed saves can force the correct phase even if currentPhase has not advanced yet.
4. Granular saves **wait for any in-flight save to finish** (instead of skipping) so phase-change and seed saves cannot be dropped when a prior write is still completing.
4. Q&A phases (comprehension, exercise, worksheet, test) call `saveProgress('<phase>-init')` on phase start with `{ questions, nextQuestionIndex, score, answers, timerMode: 'play', phaseOverride: '<phase>' }` to freeze deterministic question pools for resume.
5. The same Q&A phases emit `<phase>-answer` and `<phase>-skip` saves that include `questions`, `answers`, `nextQuestionIndex`, `score`, and `timerMode` (Test also includes `reviewIndex`). This keeps snapshots aligned to the next pending question.
6. Resume path: `start*Phase` reads `snapshot.phaseData.<phase>` and passes it as `resumeState` so controllers skip intros/Go, restore timer mode (play/work), reuse the exact question array, and drop the learner at `nextQuestionIndex` (Test also restores `reviewIndex`).

Without step 2, granular saves would use `idle` as currentPhase and store under the wrong phase. Without step 4, question pools would reshuffle on resume and lose intra-phase progress.

### 8. src/app/session/v2/SessionPageV2.jsx (6c8d311eec76ed7649fe9c9a711c569c02054bb1129ccf244bda9f82fabfb00d)
- bm25: -20.6861 | relevance: 0.9539

const playTimerLimits = {
      comprehension: m2s(phaseTimers.comprehension_play_min) + playBonusSec,
      exercise: m2s(phaseTimers.exercise_play_min) + playBonusSec,
      worksheet: m2s(phaseTimers.worksheet_play_min) + playBonusSec,
      test: m2s(phaseTimers.test_play_min) + playBonusSec
    };

const workPhaseTimeLimits = {
      discussion: m2s(phaseTimers.discussion_work_min),
      comprehension: m2s(phaseTimers.comprehension_work_min),
      exercise: m2s(phaseTimers.exercise_work_min),
      worksheet: m2s(phaseTimers.worksheet_work_min),
      test: m2s(phaseTimers.test_work_min)
    };

// Forward timer events to UI
    const unsubWorkTick = eventBus.on('workPhaseTimerTick', (data) => {
      setWorkPhaseTime(data.formatted);
      setWorkPhaseRemaining(data.remainingFormatted);
    });

const unsubWorkComplete = eventBus.on('workPhaseTimerComplete', (data) => {
      addEvent(`â±ï¸ ${data.phase} timer complete!`);
      hydrateWorkTimerSummaryFromTimerService('workPhaseTimerComplete');
    });

const unsubGoldenKey = eventBus.on('goldenKeyEligible', (data) => {
      if (goldenKeysEnabledRef.current === false) return;
      const eligible = data?.eligible === true;
      setGoldenKeyEligible(eligible);
      if (eligible) addEvent('🔑 Golden Key earned!');
    });

### 9. src/app/session/page.js (5806f1e849652436b202c7bb2a8661d22a9e77d4a120819ac47fb4862dbff76a)
- bm25: -20.0313 | relevance: 0.9525

// Helper to get the current phase name from phase state
  const getCurrentPhaseName = useCallback(() => {
    // Map phase state to phase timer key
    // Teaching phase uses discussion timer (they're grouped together)
    if (phase === 'discussion' || phase === 'teaching') return 'discussion';
    if (phase === 'comprehension') return 'comprehension';
    if (phase === 'exercise') return 'exercise';
    if (phase === 'worksheet') return 'worksheet';
    if (phase === 'test') return 'test';
    return null;
  }, [phase]);

// Check if we're currently in play or work mode
  const isInPlayMode = useCallback(() => {
    const currentPhase = getCurrentPhaseName();
    if (!currentPhase) return false;
    return currentTimerMode[currentPhase] === 'play';
  }, [getCurrentPhaseName, currentTimerMode]);

// Handle timer time-up callback (determines if play or work timer expired)
  const handlePhaseTimerTimeUp = useCallback(() => {
    const currentPhase = getCurrentPhaseName();
    if (!currentPhase) return;
    
    const mode = currentTimerMode[currentPhase];
    if (mode === 'play') {
      handlePlayTimeUp(currentPhase);
    } else if (mode === 'work') {
      handleWorkTimeUp(currentPhase);
    }
  }, [getCurrentPhaseName, currentTimerMode, handlePlayTimeUp, handleWorkTimeUp]);

// Reset opening actions visibility on begin and on major phase changes
  useEffect(() => {
    if (phase === 'discussion' && subPhase === 'unified-discussion') {
      setShowOpeningActions(false);
      // Game usage gates removed - games are now repeatable during play time
      // Story persists across phases - don't reset or clear transcript
      // Only clear story when starting a completely new session
    }
  }, [phase, subPhase]);

### 10. src/app/session/v2/SessionPageV2.jsx (1755a87c9805005bf194c80a94647585bb31b90951ddfefb665eb5beed7a10b4)
- bm25: -19.8019 | relevance: 0.9519

// Start play timer at the Begin gate (before Begin is clicked) for play-enabled Q&A phases.
    // Do NOT do this on resume auto-start, and do NOT double-start after timeline jumps.
    const resumeMatch = !!snapshotServiceRef.current?.snapshot && resumePhaseRef.current === 'comprehension';
    const shouldAutoStart = resumeMatch || !!savedComp;
    const shouldStartPlayAtBeginGate = !shouldAutoStart && playPortionsEnabledRef.current?.comprehension !== false;
    if (
      shouldStartPlayAtBeginGate
      && timerServiceRef.current
      && timelineJumpTimerStartedRef.current !== 'comprehension'
    ) {
      timerServiceRef.current.startPlayTimer('comprehension');
    }
    
    // Auto-start when resuming into this phase so refreshes do not surface the Begin button.
    if (shouldAutoStart && phase.start) {
      if (playPortionsEnabledRef.current?.comprehension === false) {
        transitionToWorkTimer('comprehension');
        phase.start({ skipPlayPortion: true });
        if (pendingPlayTimersRef.current?.comprehension) {
          delete pendingPlayTimersRef.current.comprehension;
        }
      } else {
        phase.start();
        if (pendingPlayTimersRef.current?.comprehension) {
          // If resuming into work, do not overwrite the restored work timer mode.
          if (savedComp?.timerMode === 'work') {
            delete pendingPlayTimersRef.current.comprehension;
          } else {
            startPhasePlayTimer('comprehension');
            delete pendingPlayTimersRef.current.comprehension;
          }
        }
      }
    }

### 11. src/app/session/page.js (e50f9bb16716e0705c0395afcd00392416183239ba7e6120dc98053d64b9f490)
- bm25: -19.2377 | relevance: 0.9506

{/* Timer Controls Overlay - facilitator can adjust timer and golden key */}
    {showTimerControls && sessionTimerMinutes > 0 && (
      <TimerControlOverlay
        isOpen={showTimerControls}
        onClose={() => setShowTimerControls(false)}
        lessonKey={lessonKey}
        phase={(() => {
          // Map current phase to timer phase key
          if (phase === 'discussion' || phase === 'teaching') return 'discussion';
          else if (phase === 'comprehension') return 'comprehension';
          else if (phase === 'exercise') return 'exercise';
          else if (phase === 'worksheet') return 'worksheet';
          else if (phase === 'test') return 'test';
          return phase;
        })()}
        timerType={(() => {
          // Get current timer mode for the phase
          let currentPhase = null;
          if (phase === 'discussion' || phase === 'teaching') currentPhase = 'discussion';
          else if (phase === 'comprehension') currentPhase = 'comprehension';
          else if (phase === 'exercise') currentPhase = 'exercise';
          else if (phase === 'worksheet') currentPhase = 'worksheet';
          else if (phase === 'test') currentPhase = 'test';
          return currentPhase ? (currentTimerMode[currentPhase] || 'play') : 'play';
        })()}
        currentElapsedSeconds={(() => {
          try {
            // Map current phase to timer phase key (inline to avoid TDZ issues)
            let currentPhase = null;
            if (phase === 'discussion' || phase === 'teaching') currentPhase = 'discussion';
            else if (phase === 'comprehension') currentPhase = 'comprehension';
            else if (phase === 'exercise') currentPhase = 'exercise';
            else if (phase === 'worksheet') currentPhase = 'worksheet';
            else

### 12. src/app/session/v2/SessionPageV2.jsx (e771da696082ec3b8216c5374c8405fb17e186d49578ed87d31e12f743ce7394)
- bm25: -19.1049 | relevance: 0.9503

// If play portion is turned off while sitting at the Go gate, jump straight to work.
        // (Do not attempt to interrupt intro playback states here.)
        try {
          const phaseNow = String(currentPhaseRef.current || '');
          const disableNow = (
            (phaseNow === 'comprehension' && nextPlayFlags.comprehension === false) ||
            (phaseNow === 'exercise' && nextPlayFlags.exercise === false) ||
            (phaseNow === 'worksheet' && nextPlayFlags.worksheet === false) ||
            (phaseNow === 'test' && nextPlayFlags.test === false)
          );
          if (disableNow) {
            const phaseStateMap = {
              comprehension: comprehensionStateRef.current,
              exercise: exerciseStateRef.current,
              worksheet: worksheetStateRef.current,
              test: testStateRef.current,
            };
            const refMap = {
              comprehension: comprehensionPhaseRef,
              exercise: exercisePhaseRef,
              worksheet: worksheetPhaseRef,
              test: testPhaseRef,
            };
            if (phaseStateMap[phaseNow] === 'awaiting-go') {
              transitionToWorkTimer(phaseNow);
              refMap[phaseNow]?.current?.go?.();
            }
          }
        } catch {}
      }
    });

return () => {
      try { unsubscribe?.(); } catch {}
    };
  }, [learnerProfile?.id, planEnt?.goldenKeyFeatures]);

// Load persisted worksheet/test sets for printing (local+Supabase)
  useEffect(() => {
    if (!lessonKey) return;
    let cancelled = false;

### 13. docs/brain/timer-system.md (1f66fc9b2014880a4f602ba3a64aeb3037bbda3f80bafc5c833fb3aeea069133)
- bm25: -18.7793 | relevance: 0.9494

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

### 14. src/app/session/page.js (3b25bf474ff0bdfa5ac71e75190fba7f2653ca17a88511fb8f821c086e257d5a)
- bm25: -18.7025 | relevance: 0.9492

// Session Timer state
  const [timerPaused, setTimerPaused] = useState(false);
  const [sessionTimerMinutes, setSessionTimerMinutes] = useState(60); // Default 1 hour
  
  // Phase-based timer system (11 timers: 5 phases × 2 types + 1 golden key bonus)
  const [phaseTimers, setPhaseTimers] = useState(null); // Loaded from learner profile
  const [currentTimerMode, setCurrentTimerModeState] = useState({}); // { discussion: 'play'|'work', comprehension: 'play'|'work', ... }
  const currentTimerModeRef = useRef(currentTimerMode);
  const setCurrentTimerMode = useCallback((updater) => {
    setCurrentTimerModeState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : (updater || {});
      currentTimerModeRef.current = next;
      return next;
    });
  }, []);
  const [workPhaseCompletions, setWorkPhaseCompletionsState] = useState({
    discussion: false,
    comprehension: false,
    exercise: false,
    worksheet: false,
    test: false
  }); // Tracks which work phases completed without timing out (for golden key earning)
  const workPhaseCompletionsRef = useRef(workPhaseCompletions);
  const setWorkPhaseCompletions = useCallback((updater) => {
    setWorkPhaseCompletionsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : (updater || {
        discussion: false,
        comprehension: false,
        exercise: false,
        worksheet: false,
        test: false,
      });
      workPhaseCompletionsRef.current = next;
      return next;
    });
  }, []);
  const [workTimeRemaining, setWorkTimeRemainingState] = useState({
    discussion: null,
    comprehension: null,
    exercise: null,
    worksheet: null,
    test: null,
  }); // Minutes remaining when each work timer stopped (null when never started)
  const work

### 15. src/app/session/v2/TimerService.jsx (4631dc02d5f103bcbe70904b1f8d2f3ce9c53e963e4e2faa5a113f2c660b787f)
- bm25: -18.3393 | relevance: 0.9483

// Sticky completion records for Golden Key + end-of-test reporting.
    // Once a phase has been completed on time, it retains credit until explicit reset.
    // Map: phase -> { completed, onTime, elapsed, timeLimit, remaining, finishedAt }
    this.workPhaseResults = new Map();
    
    // Work phase time limits (seconds) - all phases have work timers
    this.workPhaseTimeLimits = options.workPhaseTimeLimits || {
      discussion: 300,    // 5 minutes
      comprehension: 180, // 3 minutes
      exercise: 180,      // 3 minutes
      worksheet: 300,     // 5 minutes
      test: 600           // 10 minutes
    };
    
    // Golden key tracking (only counts comprehension, exercise, worksheet, test)
    this.onTimeCompletions = 0;
    this.goldenKeyAwarded = false;

### 16. src/app/session/v2/SessionPageV2.jsx (e3e46406441cc85403237439357738902a2d59ed5d6ca94c95781df4f62f1c2f)
- bm25: -18.1867 | relevance: 0.9479

// Q&A phases with play timers: after Begin, tell the learner they can play.
      // (Exclude discussion; skipPlayPortion phases should not say this.)
      if (!skipPlayPortion && ['comprehension', 'exercise', 'worksheet', 'test'].includes(phaseName)) {
        const playLine = 'Now you can play until the play timer runs out.';
        try {
          const playAudio = await fetchTTS(playLine);
          if (audioEngineRef.current) {
            await audioEngineRef.current.playAudio(playAudio || '', [playLine]);
          }
        } catch (err) {
          console.warn('[SessionPageV2] Failed to speak play timer line:', err);
        }
      }
    } else {
      addEvent(`⚠️ Unable to start ${phaseName} (not initialized yet)`);
    }
    
    // Clear the timeline jump timer flag after phase starts
    if (timelineJumpTimerStartedRef.current === phaseName) {
      timelineJumpTimerStartedRef.current = null;
    }
    
    if (pendingPlayTimersRef.current?.[phaseName]) {
      if (!skipPlayPortion) {
        startPhasePlayTimer(phaseName);
      }
      delete pendingPlayTimersRef.current[phaseName];
    }
  };
  
  // Get timer duration for a phase and type from phaseTimers
  const getCurrentPhaseTimerDuration = useCallback((phaseName, timerType) => {
    if (!phaseTimers || !phaseName || !timerType) return 0;
    const key = `${phaseName}_${timerType}_min`;
    return phaseTimers[key] || 0;
  }, [phaseTimers]);

// Calculate lesson progress percentage (V1 parity)
  // Used by SessionTimer to determine pace color for WORK timers.
  const calculateLessonProgress = useCallback(() => {
    const phaseWeights = {
      discussion: 10,
      teaching: 30,
      comprehension: 50,
      exercise: 70,
      worksheet: 85,
      test: 95
    };

### 17. src/app/session/v2/SessionPageV2.jsx (560d50d4b2106176e24e18fe0cd47383b2d1910d28f9569656d8398f1261ef81)
- bm25: -18.1400 | relevance: 0.9478

// Keep snapshot currentPhase aligned so granular saves write under the active phase.
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress('phase-change', { phaseOverride: data.phase });
      }
      
      // Update keyboard service phase
      if (keyboardServiceRef.current) {
        keyboardServiceRef.current.setPhase(data.phase);
      }
      
      // For discussion and test phases, initialize them but DON'T auto-start them
      // after a timeline jump. They should show the "Begin" button first.
      const isTimelineJump = timelineJumpInProgressRef.current;
      
      // Start phase-specific controller
      if (data.phase === 'discussion') {
        startDiscussionPhase();
        // Discussion has no play timer - start directly in work mode
        setCurrentTimerMode(prev => ({ ...prev, discussion: 'work' }));
        setTimerRefreshKey(k => k + 1);
        // If timeline jump, keep discussionState as 'idle' to show Begin button
        if (!isTimelineJump && discussionPhaseRef.current) {
          discussionPhaseRef.current.start();
        }
      } else if (data.phase === 'teaching') {
        startTeachingPhase();
        // Teaching uses discussion timer (grouped together, already in work mode)
      } else if (data.phase === 'comprehension') {
        const started = startComprehensionPhase();
        if (started) {
          // Start play timer for comprehension once phase exists (unless play portion is disabled)
          if (playPortionsEnabledRef.current?.comprehension !== false) {
            startPhasePlayTimer('comprehension');
          }
        } else {
          if (playPortionsEnabledRef.current?.comprehension !== false) {
            pendingPlayTimersRef.current.comprehension = true;
          }

### 18. docs/brain/timer-system.md (b90b83953b55369af6b1840a6cccf28923940068aa3948b4bb4042752c4610dc)
- bm25: -18.1300 | relevance: 0.9477

# Timer System Architecture

**Last updated**: 2026-02-04T01:00:00Z  
**Status**: Canonical

## How It Works

### Play vs Work Timers

**V1**: Each phase (discussion, comprehension, exercise, worksheet, test) has two timer modes.

**V2**: Discussion has **no play timer**. Phases 2-5 (Comprehension, Exercise, Worksheet, Test) use play → work mode. A **discussion work timer** still exists and spans discussion + teaching.

**Rationale**: Removing play timer from discussion phase eliminates infinite play timer exploit (learner could refresh during discussion to reset play timer indefinitely without starting teaching).

**Discussion work timer startup**: The work timer for discussion is started when the greeting begins playing (greetingPlaying event). This is an exception - all other work timers start when the awaiting-go gate appears.

**Timeline jump timer startup**: When facilitator uses timeline to jump to a phase, the appropriate timer starts immediately:
- Discussion: Work timer starts immediately (exception to normal greetingPlaying rule)
- Other phases: Play timer starts immediately (not when Begin clicked)

Timeline jumps explicitly stop any existing timers for the target phase before starting new ones, ensuring a clean reset.

**Timer restart prevention**: Removed in favor of explicit stop/start pattern on timeline jumps. Timers can now be legitimately restarted when needed.

### 19. src/app/session/v2/TimerService.jsx (c49ecc9681585c6f09b5f39f28a047ea3e9dcf1cb5d01177df9852b5a5f36b5e)
- bm25: -17.8813 | relevance: 0.9470

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

### 20. src/app/session/v2/SessionPageV2.jsx (28b87f9ab988afec3135e2565204b8968ab367697b91e81e3df87495462abca9)
- bm25: -17.8327 | relevance: 0.9469

const nextPlayFlags = {
        comprehension: ('play_comprehension_enabled' in patch) ? patch.play_comprehension_enabled : undefined,
        exercise: ('play_exercise_enabled' in patch) ? patch.play_exercise_enabled : undefined,
        worksheet: ('play_worksheet_enabled' in patch) ? patch.play_worksheet_enabled : undefined,
        test: ('play_test_enabled' in patch) ? patch.play_test_enabled : undefined,
      };
      const hasAnyPlayFlag = Object.values(nextPlayFlags).some(v => v !== undefined);
      if (hasAnyPlayFlag) {
        const merged = {
          ...playPortionsEnabledRef.current,
          ...(typeof nextPlayFlags.comprehension === 'boolean' ? { comprehension: nextPlayFlags.comprehension } : {}),
          ...(typeof nextPlayFlags.exercise === 'boolean' ? { exercise: nextPlayFlags.exercise } : {}),
          ...(typeof nextPlayFlags.worksheet === 'boolean' ? { worksheet: nextPlayFlags.worksheet } : {}),
          ...(typeof nextPlayFlags.test === 'boolean' ? { test: nextPlayFlags.test } : {}),
        };
        setPlayPortionsEnabled(merged);
        playPortionsEnabledRef.current = merged;

### 21. docs/brain/v2-architecture.md (97a3fc3349f3fcbc86f038ed45a9b6fdb7c143dedc6e04577e4b989d5805417e)
- bm25: -17.5100 | relevance: 0.9460

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

### 22. src/app/session/v2/SessionPageV2.jsx (3d2fa7afb0179208b2c8c85cb91af2d6c68c90b26a894279e75575b4596823ea)
- bm25: -17.2794 | relevance: 0.9453

if (currentPhase === 'comprehension') {
      const phaseRange = phaseWeights.comprehension - phaseWeights.teaching;
      const ratio = getRatioFromSnapshot('comprehension', comprehensionTotalQuestions);
      progress = phaseWeights.teaching + (ratio * phaseRange);
    } else if (currentPhase === 'exercise') {
      const phaseRange = phaseWeights.exercise - phaseWeights.comprehension;
      const ratio = getRatioFromSnapshot('exercise', exerciseTotalQuestions);
      progress = phaseWeights.comprehension + (ratio * phaseRange);
    } else if (currentPhase === 'worksheet') {
      const phaseRange = phaseWeights.worksheet - phaseWeights.exercise;
      const ratio = getRatioFromSnapshot('worksheet', worksheetTotalQuestions);
      progress = phaseWeights.exercise + (ratio * phaseRange);
    } else if (currentPhase === 'test') {
      const phaseRange = phaseWeights.test - phaseWeights.worksheet;
      const ratio = getRatioFromSnapshot('test', testTotalQuestions);
      progress = phaseWeights.worksheet + (ratio * phaseRange);
    }

### 23. docs/brain/timer-system.md (afad3d67c6731ffd234f48a50bd80e7569f7b92cd4cc8bdd5bcbaad5ac994b38)
- bm25: -17.1870 | relevance: 0.9450

This ensures timers tick down from the moment the relevant gate is visible (Begin for play; Go for work), not when it's clicked.

**Work timer spans discussion + teaching**: The discussion work timer starts when the discussion greeting begins playing and runs through the entire teaching phase. It is completed when teaching finishes, so the countdown must **not** be stopped at `greetingComplete` or `discussionComplete`. Completing it early will freeze the visible timer as soon as the teaching controls appear.

**Timer Modes:**
1. **Play Timer** (green) - Expected to use full time; learner can interact with Ask, Riddle, Poem, Story, Fill-in-Fun opening actions
2. **Work Timer** (amber/red) - Learner should complete phase; input focused on lesson questions

**V2** Timer mode tracked only for phases 2-5:
```javascript
{
  comprehension: 'play' | 'work',
  exercise: 'play' | 'work',
  worksheet: 'play' | 'work',
  test: 'play' | 'work'
}
```

### Phase 2 Implementation (V2)

**TimerService Extensions:**
- `playTimers` Map: phase → `{ startTime, elapsed, timeLimit, expired }`
- `playTimerInterval`: 1-second tick interval for active play timers
- `currentPlayPhase`: Currently active play phase (only one at a time)
- `mode`: Current timer mode ('play' | 'work')

### 24. src/app/session/v2/SessionPageV2.jsx (e74f8d18813593206c6800181672f17b47d4d03381e5fe952ef7f95127cf5a26)
- bm25: -17.0811 | relevance: 0.9447

const playEnabledForPhase = (p) => {
      if (!p) return true;
      if (p === 'comprehension') return playPortionsEnabledRef.current?.comprehension !== false;
      if (p === 'exercise') return playPortionsEnabledRef.current?.exercise !== false;
      if (p === 'worksheet') return playPortionsEnabledRef.current?.worksheet !== false;
      if (p === 'test') return playPortionsEnabledRef.current?.test !== false;
      return true;
    };
    const skipPlayPortion = ['comprehension', 'exercise', 'worksheet', 'test'].includes(phaseName)
      ? !playEnabledForPhase(phaseName)
      : false;
    
    // Special handling for discussion: prefetch greeting TTS before starting
    if (phaseName === 'discussion') {
      setDiscussionState('loading');
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || 'friend';
      const lessonTitle = lessonData?.title || lessonId || 'this topic';
      const greetingText = `Hi ${learnerName}, ready to learn about ${lessonTitle}?`;
      
      try {
        // Prefetch greeting TTS
        await fetchTTS(greetingText);
      } catch (err) {
        console.error('[SessionPageV2] Failed to prefetch greeting:', err);
      }
      
      // Discussion work timer starts when Begin is clicked, not here
    }
    
    const ref = getPhaseRef(phaseName);
    if (ref?.current?.start) {
      if (skipPlayPortion) {
        transitionToWorkTimer(phaseName);
        // Start work timer immediately when skipping play portion (unless timeline jump already started it)
        if (timerServiceRef.current && timelineJumpTimerStartedRef.current !== phaseName) {
          timerServiceRef.current.startWorkPhaseTimer(phaseName);
        }
        await ref.current.start({ skipPlayPortion: true });
      }

### 25. src/app/session/page.js (f118d1a55294c813ca2cadab90898a1fb0f1e96bf8acff3fe69016b88755b40d)
- bm25: -16.9703 | relevance: 0.9444

// Begin Exercise manually when awaiting begin (either skipped or auto-transitioned)
  const beginSkippedExercise = async () => {
    if (phase !== 'exercise' || subPhase !== 'exercise-awaiting-begin') return;
    // Mark comprehension work phase as completed (user finished comprehension work)
    markWorkPhaseComplete('comprehension');
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(true); } catch {}
    // Ensure audio/mic unlocked via Begin
  // mic permission will be requested only when user starts recording
    // Clear any temporary awaiting lock now that the user is explicitly starting
    try { exerciseAwaitingLockRef.current = false; } catch {}
    // Ensure pools/assessments exist if we arrived here via skip before setup
    ensureBaseSessionSetup();
    // No standalone unlock prompt
    // Do NOT arm the first question here - it will be armed when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
  setExerciseSkippedAwaitBegin(false);
  // Gate quick-answer buttons until Start the lesson
  setQaAnswersUnlocked(false);
  
    // Start the exercise play timer
    startPhasePlayTimer('exercise');
    
  setCanSend(false);
  setTicker(0);
    // Do NOT arm the first question here - it will be armed when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
    // Immediately enter active subPhase so the Begin button disappears right away
    setSubPhase('exercise-active');
  // Persist the transition to exercise-active so resume lands on the five-button view
  // Delay save to ensure state update has flushed
  setTimeout(() => {
    try { scheduleSaveSnapshot('begin-exercise'); } catch {}

### 26. src/app/session/page.js (53f025b5ec7c83531132e96db0459408484cbb4be67bde327749e497c0293a14)
- bm25: -16.7662 | relevance: 0.9437

// Dynamically load per-user targets at runtime (recomputed on each call)
async function ensureRuntimeTargets(forceReload = false) {
  try {
    const vars = await loadRuntimeVariables();
    const t = vars?.targets || {};
    COMPREHENSION_TARGET = (t.comprehension ?? t.discussion ?? COMPREHENSION_TARGET ?? 3);
    EXERCISE_TARGET = (t.exercise ?? EXERCISE_TARGET ?? 5);
    WORKSHEET_TARGET = (t.worksheet ?? WORKSHEET_TARGET ?? 15);
    TEST_TARGET = (t.test ?? TEST_TARGET ?? 10);

### 27. src/app/session/page.js (4f02e4d54517362ddce88260d0cbe03b66978c4f92e4942c5a9327953604d075)
- bm25: -16.6752 | relevance: 0.9434

if (learnerId && learnerId !== 'demo') {
      try {
        const learner = await getLearner(learnerId);
        if (learner) {
          const n = (v) => (v == null ? undefined : Number(v));
          COMPREHENSION_TARGET = n(learner.comprehension ?? learner.targets?.comprehension) ?? COMPREHENSION_TARGET;
          EXERCISE_TARGET = n(learner.exercise ?? learner.targets?.exercise) ?? EXERCISE_TARGET;
          WORKSHEET_TARGET = n(learner.worksheet ?? learner.targets?.worksheet) ?? WORKSHEET_TARGET;
          TEST_TARGET = n(learner.test ?? learner.targets?.test) ?? TEST_TARGET;
          const humorLevel = normalizeHumorLevel(learner.humor_level);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('learner_humor_level', humorLevel);
              if (learnerId && learnerId !== 'demo') {
                localStorage.setItem(`learner_humor_level_${learnerId}`, humorLevel);
              }
            } catch {}
          }
        }
      } catch (e) {
        // Silent error handling
      }
    } else if (learnerName && learnerName !== 'Demo Learner') {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('facilitator_learners') : null;
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const match = list.find(l => l && (l.name === learnerName || l.full_name === learnerName));
            if (match) {
              const n = (v) => (v == null ? undefined : Number(v));
              COMPREHENSION_TARGET = n(match.comprehension ?? match.targets?.comprehension) ?? COMPREHENSION_TARGET;
              EXERCISE_TARGET = n(match.exercise ?? match.targets?.exercise) ?? EXERCISE_TARGET;
              WORKSHEET_TARGET = n(match.worksheet ??

### 28. docs/brain/timer-system.md (b7aa6681ad045e85a58422ec46641d948683a8b9be9eb4e041d2b6d83bd36742)
- bm25: -16.6565 | relevance: 0.9434

2. **PlayTimeExpiredOverlay** displays:
   - Shows "Time to Get Back to Work!" message
   - 30-second countdown (green, turns amber at 5 seconds)
   - Displays phase name user will return to
   - Auto-advances when countdown reaches 0

3. **handlePlayExpiredComplete** fires when countdown completes:
   - Hides overlay (`showPlayTimeExpired = false`)
   - Transitions to work timer for expired phase
   - Automatically starts the work phase:
     - Discussion/Teaching: calls `startSession()` (orchestrator start)
     - Comprehension/Exercise/Worksheet/Test: calls the phase controller `go()` (`comprehensionPhaseRef.current.go()`, etc.)
   - Each phase handler hides play buttons as part of its normal flow
   - Clears `playExpiredPhase`
  - When discussion/teaching needs to auto-start, `startSession({ ignoreResume: true })` is used so a stale snapshot resumePhase cannot skip ahead during an active lesson.

### Go Button Override

If user clicks Go button during the 30-second countdown:
- Overlay is immediately dismissed
- Work timer starts without waiting for countdown
- All phase start handlers check and clear overlay state

### Work Time Completion Tracking

### 29. src/app/session/v2/TimerService.jsx (7fe20ca947fed1427b6a69117fbb54acf5dfdd9deb945a6d33bb276160b5e354)
- bm25: -16.6443 | relevance: 0.9433

export class TimerService {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    
    // Session timer
    this.sessionStartTime = null;
    this.sessionElapsed = 0; // seconds
    this.sessionInterval = null;
    
    // Play timers (phases 2-5: comprehension, exercise, worksheet, test)
    this.playTimers = new Map(); // phase -> { startTime, elapsed, timeLimit, expired }
    this.playTimerInterval = null;
    this.currentPlayPhase = null;
    
    // Play timer time limits (seconds) - default 3 minutes per phase
    this.playTimerLimits = options.playTimerLimits || {
      comprehension: 180, // 3 minutes
      exercise: 180,      // 3 minutes  
      worksheet: 180,     // 3 minutes
      test: 180           // 3 minutes
    };
    
    // Work phase timers
    this.workPhaseTimers = new Map(); // phase -> { startTime, elapsed, timeLimit, completed }
    this.workPhaseInterval = null;
    this.currentWorkPhase = null;

### 30. docs/brain/v2-architecture.md (fe3b9f85fd0c2ac0ea1bdb0dfecc4270568d1cd9a3aba24a6abf59dde77c0f05)
- bm25: -16.4081 | relevance: 0.9426

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
    - Source of trut

### 31. src/app/session/page.js (f498fdccd6175275fa89bdb6f35646ad305c3724dcd256b2f13acf8542c4c9fd)
- bm25: -16.3925 | relevance: 0.9425

// Calculate lesson progress percentage (defined after all state variables)
  const calculateLessonProgress = useCallback(() => {
    // Map phases to progress percentages
    const phaseWeights = {
      'discussion': 10,
      'teaching': 30,
      'comprehension': 50,
      'exercise': 70,
      'worksheet': 85,
      'test': 95
    };
    
    let baseProgress = phaseWeights[phase] || 0;
    
    // Add granular progress within each phase
    if (phase === 'comprehension' && currentCompIndex > 0) {
      const phaseRange = phaseWeights.comprehension - phaseWeights.teaching;
      const withinPhase = (currentCompIndex / COMPREHENSION_TARGET) * phaseRange;
      baseProgress = phaseWeights.teaching + Math.min(withinPhase, phaseRange);
    } else if (phase === 'exercise' && currentExIndex > 0) {
      const phaseRange = phaseWeights.exercise - phaseWeights.comprehension;
      const withinPhase = (currentExIndex / EXERCISE_TARGET) * phaseRange;
      baseProgress = phaseWeights.comprehension + Math.min(withinPhase, phaseRange);
    } else if (phase === 'worksheet' && worksheetAnswers.length > 0) {
      const phaseRange = phaseWeights.worksheet - phaseWeights.exercise;
      const withinPhase = (worksheetAnswers.length / WORKSHEET_TARGET) * phaseRange;
      baseProgress = phaseWeights.exercise + Math.min(withinPhase, phaseRange);
    } else if (phase === 'test' && testAnswers.length > 0) {
      const phaseRange = phaseWeights.test - phaseWeights.worksheet;
      const withinPhase = (testAnswers.length / TEST_TARGET) * phaseRange;
      baseProgress = phaseWeights.worksheet + Math.min(withinPhase, phaseRange);
    }
    
    return Math.min(100, Math.max(0, baseProgress));
  }, [phase, currentCompIndex, currentExIndex, worksheetAnswers, testAnswers]);

### 32. src/app/session/hooks/useSnapshotPersistence.js (b21361aa318eb7b862aa4217d443a08f461d579ab24dfc5cfef0211956be36e0)
- bm25: -16.2591 | relevance: 0.9421

const resolveTimerPhase = () => {
        if (phase === 'discussion' || phase === 'teaching') return 'discussion';
        if (phase === 'comprehension') return 'comprehension';
        if (phase === 'exercise') return 'exercise';
        if (phase === 'worksheet') return 'worksheet';
        if (phase === 'test') return 'test';
        return null;
      };

### 33. src/app/session/v2/SessionPageV2.jsx (a2ba52b7b15eeac5f94eae5e17b4e1dc32c9e111cddf1884492ef1d89026cbf7)
- bm25: -16.1911 | relevance: 0.9418

const loadStored = async () => {
      try {
        const learnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
        const stored = await getStoredAssessments(lessonKey, { learnerId });
        if (cancelled || !stored) return;
        if (Array.isArray(stored.comprehension) && stored.comprehension.length) {
          setGeneratedComprehension(stored.comprehension);
        }
        if (Array.isArray(stored.exercise) && stored.exercise.length) {
          setGeneratedExercise(stored.exercise);
        }
        if (Array.isArray(stored.worksheet) && stored.worksheet.length) {
          setGeneratedWorksheet(stored.worksheet);
        }
        if (Array.isArray(stored.test) && stored.test.length) {
          setGeneratedTest(stored.test);
        }
      } catch {
        /* noop */
      }
    };

### 34. docs/brain/v2-architecture.md (c2951fa25d44e4fc0435acc27bd610e877cb0bb0b1da4921680892c9bd47fa32)
- bm25: -16.0829 | relevance: 0.9415

**Worksheet/Test:** Worksheet and Test follow the same no-skip rule. Missing targets or empty pools must block with a clear error instead of auto-advancing to the next phase.
- The "Go" control in the Opening Actions footer must call the inline Exercise Go handler (not an ExercisePhase controller).
- Keyboard skip for Exercise should route to the inline skip handler, which advances to the next question and preserves the hint/hint/reveal attempt tracking.
- Worksheet question normalization must preserve provided `sourceType`/`type` so MC/TF items stay MC/TF (local judging, quick buttons). Only plain string questions should default to fill-in-blank.

### 35. src/app/session/v2/SessionPageV2.jsx (efab6d4d0e309f310567843e56622f66e8a0568c63172a12387e99abfdca3907)
- bm25: -16.0416 | relevance: 0.9413

// Start play timer at the Begin gate (before Begin is clicked) for play-enabled Q&A phases.
    // Do NOT do this on resume auto-start, and do NOT double-start after timeline jumps.
    const resumeMatch = !!snapshotServiceRef.current?.snapshot && resumePhaseRef.current === 'exercise';
    const shouldAutoStart = resumeMatch || !!savedExercise;
    const shouldStartPlayAtBeginGate = !shouldAutoStart && playPortionsEnabledRef.current?.exercise !== false;
    if (
      shouldStartPlayAtBeginGate
      && timerServiceRef.current
      && timelineJumpTimerStartedRef.current !== 'exercise'
    ) {
      timerServiceRef.current.startPlayTimer('exercise');
    }
    
    // Auto-start when resuming into this phase so refreshes do not surface the Begin button.
    if (shouldAutoStart && phase.start) {
      if (playPortionsEnabledRef.current?.exercise === false) {
        transitionToWorkTimer('exercise');
        phase.start({ skipPlayPortion: true });
        if (pendingPlayTimersRef.current?.exercise) {
          delete pendingPlayTimersRef.current.exercise;
        }
      } else {
        phase.start();
        if (pendingPlayTimersRef.current?.exercise) {
          if (savedExercise?.timerMode === 'work') {
            delete pendingPlayTimersRef.current.exercise;
          } else {
            startPhasePlayTimer('exercise');
            delete pendingPlayTimersRef.current.exercise;
          }
        }
      }
    }

### 36. src/app/session/page.js (99953f1c422ff8657f0674004e4dc20a0fe8c818407dce2bcacb6abfdc6e151c)
- bm25: -15.8444 | relevance: 0.9406

const timelineHighlight = useMemo(() => {
    // Group teaching with discussion; comprehension is its own segment on the timeline
    if (["discussion", "teaching", "awaiting-learner"].includes(phase)) {
      return "discussion";
    }
    if (phase === "comprehension") {
      return "comprehension";
    }
    if (phase === "exercise") {
      return "exercise";
    }
    if (phase === "worksheet") {
      return "worksheet";
    }
    if (["test", "grading", "congrats"].includes(phase)) {
      return "test";
    }
    return phase;
  }, [phase]);

### 37. docs/brain/v2-architecture.md (bcbaba8ae74f1369524b1c55e3e577738be446bf70f09f6d42f753c7ecc5b154)
- bm25: -15.7245 | relevance: 0.9402

**Implementation notes:**
- On every `phaseChange`, reset the per-phase UI gates (e.g., `showOpeningActions`, any active opening action state, and any games overlay) before rendering the next phase.
- Timeline click-to-skip must call `ensurePinAllowed('timeline')` before navigating.
- Timeline click-to-skip must stop active TTS before jumping (only when speech is currently playing) and then call `PhaseOrchestrator.skipToPhase(targetPhase)`.
- Timeline click-to-skip must not bypass Begin gating; after a jump, the destination phase should still present its Begin CTA (then Opening Actions, then Go).
- Timeline click-to-skip must not resume mid-phase (no resumeState). A timeline jump forces a fresh entry so Opening Actions are always available.
- Q&A phases must emit a post-Go snapshot checkpoint (`<phase>-go`) that sets `timerMode:'work'` with `nextQuestionIndex:0`. Without this, a refresh after pressing Go (but before answering Q1) can incorrectly resume back at Opening Actions (timerMode still 'play' from `<phase>-init`).
- Use the app alias when importing the PIN gate utility from V2 files: `@/app/lib/pinGate` (relative `../lib/pinGate` is one level short inside `session/v2` and will fail at build time).
- Comprehension initialization must **wait for learnerProfile** to be loaded. If the orchestrator enters Comprehension before learner load completes, the app retries comprehension initialization once `learnerLoading` is false and `learnerProfile` is present.
- Worksheet and Test initialization must follow the same rule as Comprehension: if the orchestrator enters the phase before learner load completes, initialization must be retried after learner load.
- Any helper that reads learner targets must not rely on a stale closure captured before learner load. Use a ref-backe

### 38. src/app/session/page.js (cf6b1632c1e237654ec56281ce7648c275cf3d70ed38564fd405548d66101865)
- bm25: -15.6984 | relevance: 0.9401

// Trigger work phase transition when play timer expired during restore
  useEffect(() => {
    if (!needsPlayExpiredTransition) return;
    if (!lessonData?.id) {
      console.log('[PLAY EXPIRED] Waiting for lessonData to load');
      return; // Wait for lesson data to load
    }
    
    const triggerTransition = async () => {
      try {
        const phaseName = needsPlayExpiredTransition;
        console.log('[PLAY EXPIRED] Triggering work phase transition for:', phaseName);
        
        if (phaseName === 'discussion' || phase === 'discussion' || phase === 'teaching') {
          if (handleStartLessonRef.current) {
            console.log('[PLAY EXPIRED] Calling handleStartLesson');
            await handleStartLessonRef.current();
          }
        } else if (phaseName === 'comprehension' || phase === 'comprehension') {
          if (handleGoComprehensionRef.current) {
            console.log('[PLAY EXPIRED] Calling handleGoComprehension');
            await handleGoComprehensionRef.current();
          }
        } else if (phaseName === 'exercise' || phase === 'exercise') {
          if (handleGoExerciseRef.current) {
            console.log('[PLAY EXPIRED] Calling handleGoExercise');
            await handleGoExerciseRef.current();
          }
        } else if (phaseName === 'worksheet' || phase === 'worksheet') {
          if (handleGoWorksheetRef.current) {
            console.log('[PLAY EXPIRED] Calling handleGoWorksheet');
            await handleGoWorksheetRef.current();
          }
        } else if (phaseName === 'test' || phase === 'test') {
          if (handleGoTestRef.current) {
            console.log('[PLAY EXPIRED] Calling handleGoTest');
            await handleGoTestRef.current();
          }
        }
      } catch (e) {
        console

### 39. cohere-changelog.md (b508e048bded4b34a8e326f580d781d1528d5d287713263d762459af9dc916f5)
- bm25: -15.6784 | relevance: 0.9400

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

### 40. src/app/session/v2/SessionPageV2.jsx (fbcf865f504b8089d24f755ec7d73e1e3b1a8d9f47051ddc1005d0af3ad59f92)
- bm25: -15.5607 | relevance: 0.9396

// Start play timer at the Begin gate (before Begin is clicked) for play-enabled Q&A phases.
    // Do NOT do this on resume auto-start, and do NOT double-start after timeline jumps.
    const resumeMatch = !!snapshotServiceRef.current?.snapshot && resumePhaseRef.current === 'worksheet';
    const shouldAutoStart = resumeMatch || !!savedWorksheet;
    const shouldStartPlayAtBeginGate = !shouldAutoStart && playPortionsEnabledRef.current?.worksheet !== false;
    if (
      shouldStartPlayAtBeginGate
      && timerServiceRef.current
      && timelineJumpTimerStartedRef.current !== 'worksheet'
    ) {
      timerServiceRef.current.startPlayTimer('worksheet');
    }
    
    // Auto-start when resuming into this phase so refreshes do not surface the Begin button.
    if (shouldAutoStart && phase.start) {
      if (playPortionsEnabledRef.current?.worksheet === false) {
        transitionToWorkTimer('worksheet');
        phase.start({ skipPlayPortion: true });
        if (pendingPlayTimersRef.current?.worksheet) {
          delete pendingPlayTimersRef.current.worksheet;
        }
      } else {
        phase.start();
        if (pendingPlayTimersRef.current?.worksheet) {
          if (savedWorksheet?.timerMode === 'work') {
            delete pendingPlayTimersRef.current.worksheet;
          } else {
            startPhasePlayTimer('worksheet');
            delete pendingPlayTimersRef.current.worksheet;
          }
        }
      }
    }


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
