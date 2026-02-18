# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Bug: printed worksheet/test earlier, but later in-session worksheet/test questions changed. Need saved lesson sets for four Q&A phases (comprehension/exercise/worksheet/test). Find how question pools are generated, persisted (getAssessmentStorageKey / clearAssessments), and how print builds worksheet/test.
```

Filter terms used:
```text
/exercise/worksheet/test
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/exercise/worksheet/test

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/v2/SessionPageV2.jsx (cff8b8f124f15d5e4039ef3dc8248cccdb1e47bf3849bde3a45dfaf191adedfb)
- bm25: -14.8586 | relevance: 1.0000

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

### 2. src/app/session/v2/SessionPageV2.jsx (4ca09b10a5acb822a1644ff5170d3133614fdcffd2bfa81478ed155b4b3a1dd9)
- bm25: -14.2451 | relevance: 1.0000

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

### 3. src/app/session/v2/SessionPageV2.jsx (53fff589e6e725e4370f01d7ecce3ed595c788eb6f6e698da7b831d94da45fe2)
- bm25: -13.7781 | relevance: 1.0000

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

### 4. src/app/session/page.js (77f8df0d47dd34caaa8829092bbf1677fa3e7dc43f3172bdc7aa3e171fcbe300)
- bm25: -13.5421 | relevance: 1.0000

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

### 5. src/app/session/page.js (e1975dbc9ac7256a29fdd96d883f1f1d2e6914922aaddd420b10fb3096ea241c)
- bm25: -13.5247 | relevance: 1.0000

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

### 6. src/app/session/page.js (bfcecfab46ccacd7bd7bb9a04857568d39946fd6aa0164c85b87fbd6b738b27b)
- bm25: -13.4452 | relevance: 1.0000

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

### 7. src/app/session/v2/SessionPageV2.jsx (fe2365f8f42520c5d7ba94606db577ff4abe77c21cc470e5c5b079912ac337a9)
- bm25: -13.4334 | relevance: 1.0000

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

### 8. src/app/session/v2/SessionPageV2.jsx (9d4db2e8cbdf1394524b0a570d0d9e0ba438685b9c8d7e1fe9d95ddc48f38c9d)
- bm25: -13.3376 | relevance: 1.0000

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

### 9. src/app/session/v2/SessionPageV2.jsx (c2bb7913b2dcbc81972f35b0a0b4fca8373052f293f545329153294164ec7da3)
- bm25: -13.3164 | relevance: 1.0000

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
    });

const unsubGoldenKey = eventBus.on('goldenKeyEligible', (data) => {
      if (goldenKeysEnabledRef.current === false) return;
      const eligible = data?.eligible === true;
      setGoldenKeyEligible(eligible);
      if (eligible) addEvent('🔑 Golden Key earned!');
    });

### 10. src/app/session/page.js (9d488f36e25845258b90e4cce3d8001c0100ba4a45bb316cca1904019e1e5735)
- bm25: -12.8252 | relevance: 1.0000

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

### 11. src/app/session/v2/TimerService.jsx (24f23d460a79fa93d3ef523fde272d97dcb1754020e6a22c5ba07d49add970bf)
- bm25: -12.8056 | relevance: 1.0000

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

### 12. src/app/session/page.js (3061c87d1b7814a63e5c4872ae7fddf6fca2a80c2e66d488663e73bc0c3f27f2)
- bm25: -12.6932 | relevance: 1.0000

// Atomic all-or-nothing restore: validate all 4 arrays match current lesson AND current targets
            const compOk = stored && Array.isArray(stored.comprehension) && stored.comprehension.length === COMPREHENSION_TARGET;
            const exOk = stored && Array.isArray(stored.exercise) && stored.exercise.length === EXERCISE_TARGET;
            const wOk = stored && Array.isArray(stored.worksheet) && stored.worksheet.length === WORKSHEET_TARGET;
            const tOk = stored && Array.isArray(stored.test) && stored.test.length === TEST_TARGET;
            
            if (!contentMismatch && compOk && exOk && wOk && tOk) {
              // RESTORE all 4 arrays - student continues where they left off
              setGeneratedComprehension(stored.comprehension);
              setGeneratedExercise(stored.exercise);
              setGeneratedWorksheet(stored.worksheet);
              setGeneratedTest(stored.test);
              setCurrentWorksheetIndex(0);
              worksheetIndexRef.current = 0;
            } else {
              // REGENERATE all 4 fresh - content mismatch or incomplete data
              setGeneratedComprehension(null);
              setGeneratedExercise(null);
              setGeneratedWorksheet(null);
              setGeneratedTest(null);
              setCurrentWorksheetIndex(0);
              worksheetIndexRef.current = 0;
            }
            
            // If regenerating, build fresh arrays now
            if (!compOk || !exOk || !wOk || !tOk || contentMismatch) {
              const shuffle = shuffleHook;
              const shuffleArr = shuffleArrHook;
              const selectMixed = selectMixedHook;
              const blendByType = blendByTypeHook;
              let gW = [];
              let gT = [];
              let gComp

### 13. src/app/session/v2/SessionPageV2.jsx (d583c2f2081824277dcc0278ba63f53455e14a6fc7d7bfa435418cd592866f02)
- bm25: -12.6639 | relevance: 1.0000

// Derive a canonical lesson key (filename only, no subject prefix, no .json) for per-learner persistence.
function deriveCanonicalLessonKey({ lessonData, lessonId }) {
  try {
    // Prefer explicit lesson key/id, fall back to URL param.
    const base = getSnapshotStorageKey({ lessonData, lessonParam: lessonId });
    return base || '';
  } catch {
    try {
      let key = lessonData?.key || lessonData?.id || lessonId || '';
      if (key.includes('/')) key = key.split('/').pop();
      return String(key || '').replace(/\.json$/i, '');
    } catch {
      return '';
    }
  }
}

// Timeline constants
const timelinePhases = ["discussion", "comprehension", "exercise", "worksheet", "test"];
const orderedPhases = ["discussion", "teaching", "comprehension", "exercise", "worksheet", "test", "closing"];
const phaseLabels = {
  discussion: "Discussion",
  comprehension: "Comp",
  exercise: "Exercise",
  worksheet: "Worksheet",
  test: "Test",
};

const normalizePhaseAlias = (phase) => {
  if (!phase) return null;
  if (phase === "grading" || phase === "congrats") return "test";
  if (phase === "complete") return "closing";
  return phase;
};

const deriveResumePhaseFromSnapshot = (snapshot) => {
  if (!snapshot) return null;

const rank = (phase) => {
    const normalized = normalizePhaseAlias(phase);
    const idx = orderedPhases.indexOf(normalized);
    return idx === -1 ? -1 : idx;
  };

const addCandidate = (set, value) => {
    if (!value) return;
    const normalized = normalizePhaseAlias(value);
    if (!normalized) return;
    set.add(normalized);
  };

const candidates = new Set();
  addCandidate(candidates, snapshot.currentPhase);

### 14. src/app/session/v2/SessionPageV2.jsx (6089167601d8fac07cd5087a39e37c50edf9136e7a9fb823bc3bba4335bca3d7)
- bm25: -12.6397 | relevance: 1.0000

useEffect(() => {
    const onWs = () => { try { handleDownloadWorksheet(); } catch {} };
    const onTest = () => { try { handleDownloadTest(); } catch {} };
    const onCombined = () => { try { handleDownloadCombined(); } catch {} };
    const onRefresh = () => { try { handleRefreshWorksheetAndTest(); } catch {} };

window.addEventListener('ms:print:worksheet', onWs);
    window.addEventListener('ms:print:test', onTest);
    window.addEventListener('ms:print:combined', onCombined);
    window.addEventListener('ms:print:refresh', onRefresh);

return () => {
      window.removeEventListener('ms:print:worksheet', onWs);
      window.removeEventListener('ms:print:test', onTest);
      window.removeEventListener('ms:print:combined', onCombined);
      window.removeEventListener('ms:print:refresh', onRefresh);
    };
  }, [handleDownloadCombined, handleDownloadTest, handleDownloadWorksheet, handleRefreshWorksheetAndTest]);
  
  // Helper to get the current phase name for timer key (matching V1)
  const getCurrentPhaseName = useCallback(() => {
    // Map phase state to phase timer key
    // Teaching phase uses discussion timer (they're grouped together)
    if (currentPhase === 'discussion' || currentPhase === 'teaching') return 'discussion';
    if (currentPhase === 'comprehension') return 'comprehension';
    if (currentPhase === 'exercise') return 'exercise';
    if (currentPhase === 'worksheet') return 'worksheet';
    if (currentPhase === 'test') return 'test';
    return null;
  }, [currentPhase]);

// Resolve phase ref by name
  const getPhaseRef = (phaseName) => {
    const map = {
      comprehension: comprehensionPhaseRef,
      exercise: exercisePhaseRef,
      worksheet: worksheetPhaseRef,
      test: testPhaseRef
    };
    return map[phaseName] || null;
  };

### 15. sidekick_pack.md (74cd644836f104161924b09fee0e4dfeaa866648d6ed31cf7cfd364742e148e1)
- bm25: -12.6378 | relevance: 1.0000

### 31. src/app/session/v2/SessionPageV2.jsx (dcfd660112efbe64defa526d25f61c69d614a698e83190a05aa8a8c6090748c1)
- bm25: -9.2274 | relevance: 1.0000

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
    });

const unsubGoldenKey = eventBus.on('goldenKeyEligible', (data) => {
      if (goldenKeysEnabledRef.current === false) return;
      const eligible = data?.eligible === true;
      setGoldenKeyEligible(eligible);
      if (eligible) addEvent('🔑 Golden Key earned!');
    });

### 32. sidekick_pack_lessons_hang.md (26ae99bb963289f4f4eb0782eae819b45a2c459d047a0126f196212dbdb636c6)
- bm25: -9.0617 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

### 16. src/app/session/v2/TimerService.jsx (513f5ed5db5b319f6fa117acf63ff78870e686502ea6ef611cac5998ef7f2ca1)
- bm25: -11.8447 | entity_overlap_w: 1.50 | adjusted: -12.2197 | relevance: 1.0000

// Clear TimerControlOverlay sessionStorage mirror for this phase.
    this.#removeTimerOverlayKey(phase, 'work');
    
    // Track on-time completions for golden key (comprehension, exercise, worksheet, test count)
    const goldenKeyPhases = ['comprehension', 'exercise', 'worksheet', 'test'];
    if (this.goldenKeysEnabled && onTime && goldenKeyPhases.includes(phase)) {
      this.onTimeCompletions++;
      
      // Check golden key eligibility (3 on-time work phases from comp/exercise/worksheet/test)
      if (this.onTimeCompletions >= 3 && !this.goldenKeyAwarded) {
        this.goldenKeyAwarded = true;
        this.eventBus.emit('goldenKeyEligible', {
          eligible: true,
          completedPhases: Array.from(this.workPhaseTimers.keys())
            .filter(p => goldenKeyPhases.includes(p) && this.workPhaseTimers.get(p).onTime)
        });
      }
    }
    
    this.currentWorkPhase = null;
  }
  
  /**
   * Stop work phase timer without completing
   * @param {string} phase - Phase name
   */
  stopWorkPhaseTimer(phase) {
    const timer = this.workPhaseTimers.get(phase);
    
    if (!timer) {
      return;
    }
    
    const elapsed = timer.elapsed;
    
    this.eventBus.emit('workPhaseTimerStop', {
      phase,
      elapsed,
      formatted: this.#formatTime(elapsed)
    });

this.#removeTimerOverlayKey(phase, 'work');
    this.workPhaseTimers.delete(phase);
    if (this.currentWorkPhase === phase) {
      this.currentWorkPhase = null;
    }
  }

### 17. src/app/session/v2/SessionPageV2.jsx (ba628b13e7dba25652cfb9feed9518a8cdc6c4326a37adbacfe18f56dae271da)
- bm25: -12.1095 | relevance: 1.0000

// Reset opening action input/errors when switching action types
  useEffect(() => {
    setOpeningActionInput('');
    setOpeningActionError('');
    setOpeningActionBusy(false);
  }, [openingActionType]);
  
  // Compute timeline highlight based on current phase
  const timelineHighlight = (() => {
    // Group teaching with discussion; comprehension is its own segment on the timeline
    if (["discussion", "teaching", "idle"].includes(currentPhase)) {
      return "discussion";
    }
    if (currentPhase === "comprehension") {
      return "comprehension";
    }
    if (currentPhase === "exercise") {
      return "exercise";
    }
    if (currentPhase === "worksheet") {
      return "worksheet";
    }
    if (["test", "grading", "congrats"].includes(currentPhase)) {
      return "test";
    }
    return currentPhase;
  })();

### 18. src/app/session/page.js (ebfddf33a453925d07815bf84d44d5806d7c4e2e4a91139b4945352fe534d58e)
- bm25: -11.9752 | relevance: 1.0000

export default function SessionPage(){
  // V2 is now the default architecture (clean event-driven implementation)
  // LEGACY_SESSION_V1_DISCONTINUED: to force Session V1, set localStorage.setItem('session_architecture_v1', 'true')
  // V2 documentation: docs/brain/v2-architecture.md
  if (typeof window !== 'undefined' && localStorage.getItem('session_architecture_v1') === 'true') {
    // V1 fallback - legacy implementation
    return (
      <Suspense fallback={null}>
        <SessionPageInner_LEGACY_SESSION_V1_DISCONTINUED />
      </Suspense>
    );
  }
  
  const SessionPageV2 = require('./v2/SessionPageV2').default;
  return <SessionPageV2 />;
}

// Targets are loaded dynamically per-user.
let COMPREHENSION_TARGET = 3;
let EXERCISE_TARGET = 5;
let WORKSHEET_TARGET = 15;
let TEST_TARGET = 10;

function mapToAssistantCaptionEntries(sentences) {
  if (!Array.isArray(sentences)) return [];
  return sentences.map((entry) => {
    if (entry && typeof entry === 'object' && typeof entry.text === 'string') {
      const role = entry.role === 'user' ? 'user' : 'assistant';
      return { text: entry.text, role };
    }
    const text = typeof entry === 'string' ? entry : String(entry ?? '');
    return { text, role: 'assistant' };
  });
}

// Dynamically load per-user targets at runtime (recomputed on each call)
async function ensureRuntimeTargets(forceReload = false) {
  try {
    const vars = await loadRuntimeVariables();
    const t = vars?.targets || {};
    COMPREHENSION_TARGET = (t.comprehension ?? t.discussion ?? COMPREHENSION_TARGET ?? 3);
    EXERCISE_TARGET = (t.exercise ?? EXERCISE_TARGET ?? 5);
    WORKSHEET_TARGET = (t.worksheet ?? WORKSHEET_TARGET ?? 15);
    TEST_TARGET = (t.test ?? TEST_TARGET ?? 10);

### 19. src/app/session/page.js (b5db5ec21d8d0d396bd25775e4272d89c02553afad61b78a733dad0a5e5aa4b4)
- bm25: -11.9128 | relevance: 1.0000

{/* Q&A phases Opening actions: show after phase intro ends */}
          {(() => {
            try {
              const inQnA = (
                (phase === 'comprehension' && subPhase === 'comprehension-active') ||
                (phase === 'exercise' && (subPhase === 'exercise-start' || subPhase === 'exercise-active')) ||
                (phase === 'worksheet' && subPhase === 'worksheet-active') ||
                (phase === 'test' && subPhase === 'test-active')
              );
              const canShow = (
                inQnA && !isSpeaking && showOpeningActions && askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive' && storyState === 'inactive' && fillInFunState === 'inactive'
              );
              if (!canShow) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', gap:8, padding:'6px 12px' };
              const btn = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              const goBtn = { ...btn, background:'#c7442e', boxShadow:'0 2px 12px rgba(199,68,46,0.28)' };
              const disabledBtn = { ...btn, opacity:0.5, cursor:'not-allowed' };
              // Phase-specific Go: trigger the first question for the active phase
              const actualGoAction = !lessonData ? undefined : (
                phase === 'comprehension' ? handleGoComprehension :
                phase === 'exercise' ? handleGoExercise :
                phase === 'worksheet' ? handleGoWorksheet :
                phase === 'test' ? handleGoTest :
                handleStartLesson
              );
              
              // Show confirmation

### 20. src/app/session/page.js (bd08e9e0eab5928f6222baaff0a4281d07d95625f3953a37a9fc1d51a2c53499)
- bm25: -11.6850 | relevance: 1.0000

// Local overrides (per-learner first, then global)
    const currentId = learnerId && learnerId !== 'demo' ? learnerId : null;
    if (currentId) {
      const lc = Number(localStorage.getItem(`target_comprehension_${currentId}`));
      const le = Number(localStorage.getItem(`target_exercise_${currentId}`));
      const lw = Number(localStorage.getItem(`target_worksheet_${currentId}`));
      const lt = Number(localStorage.getItem(`target_test_${currentId}`));
      if (!Number.isNaN(lc) && lc > 0) COMPREHENSION_TARGET = lc;
      if (!Number.isNaN(le) && le > 0) EXERCISE_TARGET = le;
      if (!Number.isNaN(lw) && lw > 0) WORKSHEET_TARGET = lw;
      if (!Number.isNaN(lt) && lt > 0) TEST_TARGET = lt;
    } else {
      const lc = Number(localStorage.getItem('target_comprehension'));
      const le = Number(localStorage.getItem('target_exercise'));
      const lw = Number(localStorage.getItem('target_worksheet'));
      const lt = Number(localStorage.getItem('target_test'));
      if (!Number.isNaN(lc) && lc > 0) COMPREHENSION_TARGET = lc;
      if (!Number.isNaN(le) && le > 0) EXERCISE_TARGET = le;
      if (!Number.isNaN(lw) && lw > 0) WORKSHEET_TARGET = lw;
      if (!Number.isNaN(lt) && lt > 0) TEST_TARGET = lt;
    }
  } catch (error) {
    // Silent error handling
  }
}
  
function SessionPageInner_LEGACY_SESSION_V1_DISCONTINUED() {
  // Generate or retrieve browser session ID (persists across refreshes in this tab)
  // Used for session ownership and conflict detection
  const [browserSessionId] = useState(() => {
    if (typeof window === 'undefined') return null;
    let sid = sessionStorage.getItem('lesson_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('lesson_session_id', sid);
    }
    return sid;
  });

### 21. src/app/session/page.js (d15c891f42b4529573645b977449f51ddace3b12c5d60af1a1e79a01ef843cc2)
- bm25: -11.5170 | relevance: 1.0000

// Disable sending when the UI is not ready or while Ms. Sonoma is speaking
  const comprehensionAwaitingBegin = (phase === 'comprehension' && subPhase === 'comprehension-start');
  // Allow answering Test items while TTS is still playing so buttons appear immediately
  const speakingLock = (phase === 'test' && subPhase === 'test-active') ? false : !!isSpeaking;
  // Derived gating: when Opening/Go buttons are visible, keep input inactive without mutating canSend
  const discussionButtonsVisible = (
    phase === 'discussion' &&
    subPhase === 'awaiting-learner' &&
    (!isSpeaking || captionsDone) &&
    showOpeningActions &&
    askState === 'inactive' &&
    riddleState === 'inactive' &&
    poemState === 'inactive' &&
    fillInFunState === 'inactive'
  );
  const inQnAForButtons = (
    (phase === 'comprehension' && subPhase === 'comprehension-active') ||
    (phase === 'exercise' && (subPhase === 'exercise-start' || subPhase === 'exercise-active')) ||
    (phase === 'worksheet' && subPhase === 'worksheet-active') ||
    (phase === 'test' && subPhase === 'test-active')
  );
  const qnaButtonsVisible = (
    inQnAForButtons && !isSpeaking && showOpeningActions &&
    askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive' && storyState === 'inactive' && fillInFunState === 'inactive'
  );
  const buttonsGating = discussionButtonsVisible || qnaButtonsVisible;
  // Story and Fill-in-Fun input should also respect the speaking lock
  const storyInputActive = (storyState === 'awaiting-turn' || storyState === 'awaiting-setup');
  const fillInFunInputActive = (fillInFunState === 'collecting-words');
  const sendDisabled = (storyInputActive || fillInFunInputActive) ? (!canSend || loading || speakingLock) : (!canSend || loading || comprehensionAwai

### 22. src/app/session/v2/SessionPageV2.jsx (6a90e65047dfffb0b43ee42d7a54dccda2313dc283061232023ae92bf309f397)
- bm25: -11.4998 | relevance: 1.0000

return (
              <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginBottom: 8,
                padding: '0 12px'
              }}>
                {!showPlayWithSonomaMenu ? (
                  <>
                    <button
                      onClick={() => {
                        if (currentPhase === 'comprehension') {
                          transitionToWorkTimer('comprehension');
                          comprehensionPhaseRef.current?.go();
                        } else if (currentPhase === 'exercise') {
                          transitionToWorkTimer('exercise');
                          exercisePhaseRef.current?.go();
                        } else if (currentPhase === 'worksheet') {
                          transitionToWorkTimer('worksheet');
                          worksheetPhaseRef.current?.go();
                        } else if (currentPhase === 'test') {
                          transitionToWorkTimer('test');
                          testPhaseRef.current?.go();
                        }
                      }}
                      style={{
                        padding: '10px 20px',
                        fontSize: 'clamp(1rem, 2vw, 1.125rem)',
                        background: '#c7442e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(199,68,46,0.4)'
                      }}
                    >
                      GO!
                    </button>

### 23. src/app/session/v2/SessionPageV2.jsx (adbbae53209a16a8adbe273195392a9441ba844cbc054d9a9223982125580749)
- bm25: -11.4998 | relevance: 1.0000

timerServiceRef.current.setPlayTimerLimits({
      comprehension: m2s(phaseTimers.comprehension_play_min) + playBonusSec,
      exercise: m2s(phaseTimers.exercise_play_min) + playBonusSec,
      worksheet: m2s(phaseTimers.worksheet_play_min) + playBonusSec,
      test: m2s(phaseTimers.test_play_min) + playBonusSec
    });
  }, [phaseTimers, goldenKeyBonus, goldenKeysEnabled]);
  
  // Initialize KeyboardService
  useEffect(() => {
    if (!eventBusRef.current) return;
    
    const eventBus = eventBusRef.current;
    
    // Forward hotkey events
    const unsubHotkey = eventBus.on('hotkeyPressed', (data) => {
      handleHotkey(data);
    });
    
    const keyboard = new KeyboardService(eventBus);
    
    keyboardServiceRef.current = keyboard;
    keyboard.init();
    
    return () => {
      keyboard.destroy();
      keyboardServiceRef.current = null;
    };
  }, []);
  
  const addEvent = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 15));
  };

### 24. src/app/session/page.js (6aad4295ec84ffb905176ca24b5a1cde4fc644e3b586d76dba7bca9e206dbdb4)
- bm25: -11.4554 | relevance: 1.0000

// Ensure Begin buttons appear immediately in any awaiting-begin state
  useEffect(() => {
    const awaiting = (
      (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') ||
      (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin') ||
      (phase === 'test' && subPhase === 'test-awaiting-begin')
    );
    if (awaiting) {
      if (loading) setLoading(false);
      if (isSpeaking) setIsSpeaking(false);
    }
  }, [phase, subPhase, loading, isSpeaking]);

// Stabilize exercise-awaiting-begin after skip: guard against same-tick state churn
  const awaitingGuardRef = useRef(null);
  // After a skip forward/backward into exercise awaiting-begin, hold a short lock window
  // that prevents any stray effects from advancing out of awaiting-begin until things settle.
  // The lock is cleared either when Begin is clicked or after a short timeout.
  const exerciseAwaitingLockRef = useRef(false);
  useEffect(() => {
    if (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') {
      try { if (awaitingGuardRef.current) clearTimeout(awaitingGuardRef.current); } catch {}
      awaitingGuardRef.current = setTimeout(() => {
        // If we somehow left awaiting-begin without starting, and no audio is playing, restore it
        if (phase === 'exercise' && subPhase !== 'exercise-start' && subPhase !== 'exercise-active' && !isSpeaking) {
          setSubPhase('exercise-awaiting-begin');
        }
      }, 0);
    }
    return () => { try { if (awaitingGuardRef.current) clearTimeout(awaitingGuardRef.current); } catch {} };
  }, [phase, subPhase, isSpeaking]);

### 25. src/app/session/page.js (31d804800c63e3c246516064729f97f82ee537de74dc97d12ff738904dac43f1)
- bm25: -11.4288 | relevance: 1.0000

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

### 26. sidekick_pack.md (564a22d757a28333d179b945d14278aa2e4e687b4098484adc6b803fcedbadd3)
- bm25: -11.3494 | relevance: 1.0000

try {
      // Check if golden key was earned (3 on-time work phases completed)
      const earnedKey = checkGoldenKeyEarn();
      if (earnedKey) {
        // Increment golden key in database
        const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
        if (learnerId && learnerId !== 'demo') {
          try {
            const { getLearner, updateLearner } = await import('@/app/facilitator/learners/clientApi');
            const learner = await getLearner(learnerId);
            if (learner) {
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
                golden_keys: (learner.golden_keys || 0) + 1
              });
            }
          } catch (err) {
            // Failed to increment key
          }
        }
      }

### 27. src/app/session/v2/SessionPageV2.jsx (435e154e9ff72c2ba78ece6b20aa6d0c35928af62afa04550386ff64d275cde2)
- bm25: -11.3293 | relevance: 1.0000

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

### 28. src/app/session/v2/SessionPageV2.jsx (d142b1b969996bd27020dd2ca970dde9377f3eaeced7ee88e53217522615e34e)
- bm25: -11.2914 | relevance: 1.0000

const setValue = (v) => {
              if (qaPhase === 'comprehension') setComprehensionAnswer(v);
              else if (qaPhase === 'exercise') setSelectedExerciseAnswer(v);
              else if (qaPhase === 'worksheet') setWorksheetAnswer(v);
              else if (qaPhase === 'test') setTestAnswer(v);
            };

### 29. src/app/session/page.js (0ed50569aba256f98b65d3e56613e01f647350910096915ced524f311b1025bf)
- bm25: -11.2510 | relevance: 1.0000

// Prefetch intro lines and first question when entering awaiting-begin states
  // Placed after state declarations to avoid TDZ errors
  useEffect(() => {
    try {
      if (subPhase === 'comprehension-start') {
        // Prefetch random intro from COMPREHENSION_INTROS
        const intro = COMPREHENSION_INTROS[Math.floor(Math.random() * COMPREHENSION_INTROS.length)];
        if (Array.isArray(generatedComprehension) && generatedComprehension.length > 0) {
          const firstQ = ensureQuestionMark(formatQuestionForSpeech(generatedComprehension[0], { layout: 'multiline' }));
          ttsCache.prefetch(`${intro} ${firstQ}`);
        }
      } else if (subPhase === 'exercise-awaiting-begin') {
        const intro = EXERCISE_INTROS[Math.floor(Math.random() * EXERCISE_INTROS.length)];
        if (Array.isArray(generatedExercise) && generatedExercise.length > 0) {
          const firstQ = ensureQuestionMark(formatQuestionForSpeech(generatedExercise[0], { layout: 'multiline' }));
          ttsCache.prefetch(`${intro} ${firstQ}`);
        }
      } else if (subPhase === 'worksheet-awaiting-begin') {
        const intro = WORKSHEET_INTROS[Math.floor(Math.random() * WORKSHEET_INTROS.length)];
        if (Array.isArray(generatedWorksheet) && generatedWorksheet.length > 0) {
          const firstQ = ensureQuestionMark(formatQuestionForSpeech(generatedWorksheet[0], { layout: 'multiline' }));
          ttsCache.prefetch(`Question 1. ${intro} ${firstQ}`);
        }
      } else if (subPhase === 'test-awaiting-begin') {
        const intro = TEST_INTROS[Math.floor(Math.random() * TEST_INTROS.length)];
        if (Array.isArray(generatedTest) && generatedTest.length > 0) {
          const firstQ = ensureQuestionMark(formatQuestionForSpeech(generatedTest[0], { layout: 'multiline' }

### 30. src/app/session/v2/SessionPageV2.jsx (c23a55fa482f90a6350d2efab8adc20ff46db5380c654c7dc6ed94c9dda0dcb8)
- bm25: -11.2319 | relevance: 1.0000

const onSubmit = () => {
              if (qaPhase === 'comprehension') submitComprehensionAnswer();
              else if (qaPhase === 'exercise') submitExerciseAnswer();
              else if (qaPhase === 'worksheet') submitWorksheetAnswer();
              else if (qaPhase === 'test') submitTestAnswer();
            };

const isSubmitting = (
              (qaPhase === 'comprehension' && comprehensionSubmitting) ||
              (qaPhase === 'exercise' && exerciseSubmitting) ||
              (qaPhase === 'worksheet' && worksheetSubmitting) ||
              (qaPhase === 'test' && testSubmitting)
            );

const canSubmit = !isSubmitting && !!String(currentValue || '').trim();

const quickContainerStyle = {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 8,
              paddingLeft: isMobileLandscape ? 12 : '4%',
              paddingRight: isMobileLandscape ? 12 : '4%',
              marginBottom: 6
            };

const quickButtonStyle = {
              background: '#1f2937',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 12px',
              minHeight: 40,
              minWidth: 56,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)'
            };

const options = getOpts();

### 31. src/app/session/page.js (ef6e97ee0375ec92f630a0dba9eb41e67a3a65a3d1f99c29c4725e4b7d94570f)
- bm25: -11.2208 | relevance: 1.0000

const goDiscussion = () => {
        setPhase('discussion');
        setSubPhase('greeting');
        setShowBegin(true); // initial big Begin overlay
        setCanSend(false);
        setTicker(0);
      };

const goComprehension = () => {
        ensureBaseSessionSetup();
        setPhase('comprehension');
        setSubPhase('comprehension-start');
        setShowBegin(false); // we use the dedicated Begin Comprehension button, not global overlay
        setCurrentCompProblem(null);
        setCanSend(false);
        setTicker(0);
        try {
          comprehensionAwaitingLockRef.current = true;
          setTimeout(() => { comprehensionAwaitingLockRef.current = false; }, 800);
        } catch {}
      };

const goExercise = () => {
        ensureBaseSessionSetup();
        setPhase('exercise');
        setSubPhase('exercise-awaiting-begin');
        setShowBegin(false);
        setExerciseSkippedAwaitBegin(true); // ensures Begin Exercise button path
        setCurrentExerciseProblem(null);
        setCanSend(false);
        setTicker(0);
        try {
          exerciseAwaitingLockRef.current = true;
          setTimeout(() => { exerciseAwaitingLockRef.current = false; }, 800);
        } catch {}
      };

const goWorksheet = () => {
        ensureBaseSessionSetup();
        setPhase('worksheet');
        setSubPhase('worksheet-awaiting-begin');
        setShowBegin(false);
        setWorksheetSkippedAwaitBegin(true);
        setCanSend(false);
        setTicker(0);
      };

const goTest = () => {
        ensureBaseSessionSetup();
        resetTestProgress();
        setPhase('test');
        setSubPhase('test-awaiting-begin');
        setShowBegin(false);
        setCanSend(false);
        setTicker(0);
      };

### 32. src/app/session/v2/SessionPageV2.jsx (45a98a62bbf9b28a6bd4e028bee2a8b1e5afb0efd6df3c06bbd64e38d0438ddc)
- bm25: -11.1546 | relevance: 1.0000

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

### 33. sidekick_pack_restore_medal_emojis.md (3a1cd047930f97ccb7bc8e1658a4c34b04902428f1a9bc3b685525fb56268088)
- bm25: -11.1165 | relevance: 1.0000

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
        
        // Initialize currentTimerMode (null = not started yet)
        setCurrentTimerMode({
          discussion: null,
          comprehension: null,
          exercise: null,
          worksheet: null,
          test: null
        });
        
        // Check for active golden key on this lesson (only affects play timers when Golden Keys are enabled)
        // Key format must match V1 + /learn/lessons: `${subject}/${lesson}`.
        if (!goldenKeyLessonKey) {
          throw new Error('Missing lesson key for golden key lookup.');
        }
        const activeKeys = learner.active_golden_keys || {};
        if (learner.golden_keys_enabled && activeKeys[goldenKeyLessonKey]) {
          setHasGoldenKey(true);
          setIsGoldenKeySuspended(false);
          setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
        } else if (learner.golden_keys_enabled && goldenKeyFromUrl) {
          // Golden key consumed on /learn/lessons; session must persist the per-lesson flag.
          setHas

### 34. sidekick_pack_restore_medal_emojis.md (97bb009b3d55ba95e9daf096efef751f67493785c91183348fd5efc231aead55)
- bm25: -11.1165 | relevance: 1.0000

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
        
        // Initialize currentTimerMode (null = not started yet)
        setCurrentTimerMode({
          discussion: null,
          comprehension: null,
          exercise: null,
          worksheet: null,
          test: null
        });
        
        // Check for active golden key on this lesson (only affects play timers when Golden Keys are enabled)
        // Key format must match V1 + /learn/lessons: `${subject}/${lesson}`.
        if (!goldenKeyLessonKey) {
          throw new Error('Missing lesson key for golden key lookup.');
        }
        const activeKeys = learner.active_golden_keys || {};
        if (learner.golden_keys_enabled && activeKeys[goldenKeyLessonKey]) {
          setHasGoldenKey(true);
          setIsGoldenKeySuspended(false);
          setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
        } else if (learner.golden_keys_enabled && goldenKeyFromUrl) {
          // Golden key consumed on /learn/lessons; session must persist the per-lesson flag.
          setHas

### 35. sidekick_pack_restore_medal_emojis.md (a49a6f6b227d8a64517cdb47195a5b6460fb41908765ad49fcfa00c7ac43a483)
- bm25: -11.1165 | relevance: 1.0000

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
        
        // Initialize currentTimerMode (null = not started yet)
        setCurrentTimerMode({
          discussion: null,
          comprehension: null,
          exercise: null,
          worksheet: null,
          test: null
        });
        
        // Check for active golden key on this lesson (only affects play timers when Golden Keys are enabled)
        // Key format must match V1 + /learn/lessons: `${subject}/${lesson}`.
        if (!goldenKeyLessonKey) {
          throw new Error('Missing lesson key for golden key lookup.');
        }
        const activeKeys = learner.active_golden_keys || {};
        if (learner.golden_keys_enabled && activeKeys[goldenKeyLessonKey]) {
          setHasGoldenKey(true);
          setIsGoldenKeySuspended(false);
          setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
        } else if (learner.golden_keys_enabled && goldenKeyFromUrl) {
          // Golden key consumed on /learn/lessons; session must persist the per-lesson flag.
          setHas

### 36. src/app/session/v2/TimerService.jsx (969f7a14cf9f3699f5b53bc29667946197fe2d0b7b8e41098b39fc1bade48638)
- bm25: -10.9667 | relevance: 1.0000

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

### 37. src/app/session/v2/SessionPageV2.jsx (1db52a0db61b35faa6ea319a03a11938c611a40e1a2fd95c7c049a32467af7b0)
- bm25: -10.7969 | relevance: 1.0000

if (!qaPhase || !awaitingAnswer || openingActionActive) return null;

const q =
              qaPhase === 'comprehension' ? currentComprehensionQuestion :
              qaPhase === 'exercise' ? currentExerciseQuestion :
              qaPhase === 'worksheet' ? currentWorksheetQuestion :
              currentTestQuestion;

const isMc = isMultipleChoice(q);
            const isTf = !isMc && isTrueFalse(q);
            const isFill =
              (qaPhase === 'worksheet' && !isMc && !isTf) ||
              (qaPhase === 'test' && ((q?.type === 'fill' || q?.type === 'fib' || q?.sourceType === 'fib') || (!isMc && !isTf))) ||
              ((qaPhase === 'comprehension' || qaPhase === 'exercise') && !isMc && !isTf);

const getOpts = () => {
              if (isTf) return ['True', 'False'];
              const raw = Array.isArray(q?.options) ? q.options : (Array.isArray(q?.choices) ? q.choices : []);
              const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
              const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.:\)\-]\s*/i;
              return raw.filter(Boolean).map((o, i) => ({
                key: labels[i] || String(i),
                label: labels[i] || '',
                value: String(o ?? '').trim().replace(anyLabel, '').trim()
              }));
            };

const currentValue =
              qaPhase === 'comprehension' ? comprehensionAnswer :
              qaPhase === 'exercise' ? selectedExerciseAnswer :
              qaPhase === 'worksheet' ? worksheetAnswer :
              testAnswer;

### 38. src/app/session/page.js (3884f04007b78a84502afb91cc0f8221984f2f556ec97a9fee6748214cd6246a)
- bm25: -10.6049 | relevance: 1.0000

// Global hotkey for Go buttons (Enter key triggers Go in opening actions)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (showGames) return;
      const code = e.code || e.key;
      const target = e.target;
      if (isTextEntryTarget(target)) return;
      
      const goCode = hotkeys?.goButton || DEFAULT_HOTKEYS.goButton;
      if (!goCode || code !== goCode) return;
      
      // Don't trigger if loading, speaking, or games are open
      if (loading || isSpeaking) return;
      
      try {
        // Discussion phase opening actions Go button
        if (phase === 'discussion' && subPhase === 'awaiting-learner' && showOpeningActions &&
            askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive' &&
            storyState === 'inactive' && fillInFunState === 'inactive' && lessonData) {
          e.preventDefault();
          setPendingGoAction(() => handleStartLesson);
          setShowGoConfirmation(true);
          return;
        }
        
        // Q&A phases opening actions Go button
        const inQnA = (
          (phase === 'comprehension' && subPhase === 'comprehension-active') ||
          (phase === 'exercise' && (subPhase === 'exercise-start' || subPhase === 'exercise-active')) ||
          (phase === 'worksheet' && subPhase === 'worksheet-active') ||
          (phase === 'test' && subPhase === 'test-active')
        );
        
        if (inQnA && showOpeningActions &&
            askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive' &&
            storyState === 'inactive' && fillInFunState === 'inactive' && lessonData) {
          e.preventDefault();
          const actualGoAction = (
            phase === 'comprehension' ? handleGoComprehension :
            phase ===

### 39. src/app/session/page.js (801aa7e8305d87bd3abc46308f9450de00742260d2a07b0ca1d89a817de2be4a)
- bm25: -10.4478 | relevance: 1.0000

switch (target) {
        case 'discussion':
          goDiscussion();
          try { scheduleSaveSnapshot('jump-discussion'); } catch {}
          break;
        case 'comprehension':
          goComprehension();
          try { scheduleSaveSnapshot('jump-comprehension'); } catch {}
          break;
        case 'exercise':
          goExercise();
          try { scheduleSaveSnapshot('jump-exercise'); } catch {}
          break;
        case 'worksheet':
          goWorksheet();
          try { scheduleSaveSnapshot('jump-worksheet'); } catch {}
          break;
        case 'test':
          goTest();
          try { scheduleSaveSnapshot('jump-test'); } catch {}
          break;
        default:
          break;
      }
    };
    return (
      <div style={{ position: 'relative', zIndex: 9999 }}>
        {/* Timeline is constrained to a 600px max width */}
        <div
          style={{
            width: isMobileLandscape ? '100%' : '92%',
            maxWidth: 600,
            margin: '0 auto',
            // When page height is very short in landscape, remove timeline vertical padding entirely.
            // Otherwise, when short-height+landscape, apply small padding (2px) to avoid clipping.
            paddingTop: isVeryShortLandscape ? 0 : ((isShortHeight && isMobileLandscape) ? 2 : undefined),
            paddingBottom: isVeryShortLandscape ? 0 : ((isShortHeight && isMobileLandscape) ? 2 : undefined),
          }}
        >
          <Timeline
            timelinePhases={timelinePhases}
            timelineHighlight={timelineHighlight}
            compact={isMobileLandscape}
            onJumpPhase={offerResume ? null : handleJumpPhase}
          />
        </div>
      </div>
    );
  })()}

### 40. src/app/session/page.js (441c5b0468568c0ee81383d2ff1659da127f5404e6cc3571903b476a83ca65af)
- bm25: -10.3482 | relevance: 1.0000

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
