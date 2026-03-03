# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
video initialization race condition Start Over button lesson restart snapshot early init order of operations
```

Filter terms used:
```text
video
initialization
race
condition
Start
Over
button
lesson
restart
snapshot
early
init
order
of
operations
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

video initialization race condition Start Over button lesson restart snapshot early init order of operations

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/session-takeover.md (14df12c7a62937c86813110078060032d35e8d76727c3cdc51c2526a532981bb)
- bm25: -22.3327 | relevance: 1.0000

**DO NOT USE:**
- Separate timer persistence API calls
- Timer state in localStorage independent of snapshots
- Race condition checks between timer updates and snapshot saves

### 2. docs/brain/v2-architecture.md (8ec1e8e7ff11b868bda1adcbf7227de9eee5ed57674484e751d290fd80163f9f)
- bm25: -21.8204 | relevance: 1.0000

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

### 3. docs/brain/snapshot-persistence.md (21a8bbfae35597a8c397e2fce48a68622e36d63147cd8c10ac34190f362ea5ff)
- bm25: -19.6202 | relevance: 1.0000

**Start Over button:**
- Confirms with user (cannot be reversed)
- Calls `snapshotServiceRef.current.deleteSnapshot()` to clear localStorage and database
- Calls `timerServiceRef.current.reset()` to clear timer Maps and remove all `session_timer_state:{lessonKey}:*` keys
- Clears `resumePhase` state **and** `resumePhaseRef` to null (prevents stale closure values)
- Calls `startSession({ ignoreResume: true })` which forces a fresh start from discussion/teaching (no resume)

**Resume phase source of truth:** `startSession` reads `resumePhaseRef.current` so it always uses the latest loaded snapshot. Call sites that should never resume (Start Over, PlayTimeExpired overlay auto-start) pass `{ ignoreResume: true }` so they cannot jump to a saved phase accidentally. Resume normalization now derives the furthest saved phase from `currentPhase`, `completedPhases`, and `phaseData` keys, preferring the latest valid phase order (discussion → teaching → comprehension → exercise → worksheet → test → closing). Aliases `grading`/`congrats` map to `test`, and `complete` maps to `closing` before ranking.

**Teaching resume state applied:** SessionPageV2 now passes `snapshot.phaseData.teaching` (stage, sentenceIndex, isInSentenceMode, vocabSentences, exampleSentences) into TeachingController so Resume lands on the exact teaching sentence and gate state instead of restarting definitions/examples.

### 4. src/app/session/page.js (4a89fc25fa89536d97056d55dd151840db0f1ebfccbf5162d219c1e3023fdd64)
- bm25: -18.6215 | relevance: 1.0000

// Preload video on mount to avoid race condition on Begin
  useEffect(() => {
    try {
      if (videoRef.current) {
        // Trigger video load immediately
        videoRef.current.load();
        
        // Track video playing state for Chrome autoplay coordination
        const video = videoRef.current;
        const onPlay = () => {
          videoPlayingRef.current = true;
        };
        const onPause = () => {
          videoPlayingRef.current = false;
        };
        const onEnded = () => {
          videoPlayingRef.current = false;
        };
        
        video.addEventListener('play', onPlay);
        video.addEventListener('playing', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        
        return () => {
          video.removeEventListener('play', onPlay);
          video.removeEventListener('playing', onPlay);
          video.removeEventListener('pause', onPause);
          video.removeEventListener('ended', onEnded);
        };
      }
    } catch (e) {
      // Silent error handling
    }
  }, []);

### 5. docs/brain/snapshot-persistence.md (45bc77a7e30d58131759caf542bc68bf11c86d57594f5691eeaa687086e61a57)
- bm25: -18.2484 | relevance: 1.0000

Initialization now fails loudly when identity is missing: SnapshotService construction is wrapped in try/catch, and `snapshotLoaded` is set in a `finally` so Begin gating does not hang. Missing `lessonKey`/`learnerId` surfaces as an error instead of silently starting over.

### 6. docs/brain/snapshot-persistence.md (d9e58e922bd58bed557959d4d85289d99d87d9c9b473ae1781ccd0bdf66ec27f)
- bm25: -17.5309 | relevance: 1.0000

### V2 Resume Flow
On session load:
1. **SnapshotService.initialize()** loads existing snapshot during mount effect (async)
2. If snapshot found:
   - Sets `resumePhase` state to `snapshot.currentPhase`
  - Displays Resume and Start Over buttons in footer when `resumePhase` is not at beginning (not idle/discussion)
3. If no snapshot or snapshot at beginning:
   - Shows normal Begin button
4. Sets `snapshotLoaded` to true when load completes

**Phase auto-start on resume:** When resuming into any Q&A phase (comprehension/exercise/worksheet/test), the phase instance is created and immediately started if snapshot data exists for that phase. This bypasses the intermediate Begin button (which visually sits before opening actions) and restores the learner directly to the in-phase state (intro/Go or current question). Pending play timers start as well so tickers and timer badges do not flash 0/X on refresh.

**Ticker seeding on resume:** When snapshot data exists for a Q&A phase, the counters and current question are pre-seeded from the saved arrays and indices before the phase starts. This keeps the question ticker/progress display accurate immediately after a refresh (no temporary 0/X) even before the next answer is submitted.

**Begin gating:** The top-level Begin button is disabled until both `audioReady` and `snapshotLoaded` are true, preventing a refresh race where the user can start a fresh session before the snapshot finishes loading.

### 7. docs/brain/v2-architecture.md (985974160a35136c392a236c5b8f254c23354ebffcf78b830174ed102767bd67)
- bm25: -17.2578 | relevance: 1.0000

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

### 8. src/app/session/page.js (f57be4543fd763ba51645d60c9bee10dfe17fefdfd6f606dc5b2ddd7303f5af6)
- bm25: -14.7598 | relevance: 1.0000

// Session was already started during early conflict check
    // Skip redundant session start here to avoid double-starting
    // The early conflict check (before snapshot restore) already called startTrackedSession
    console.log('[SESSION] Session already started during early conflict check, skipping duplicate start');

// Immediately update UI so it feels responsive
    setShowBegin(false);
    setPhase("discussion");
    setPhaseGuardSent({});
    setSubPhase("unified-discussion");
    setCanSend(false);
  try { scheduleSaveSnapshot('begin-discussion'); } catch {}

// Start the discussion play timer
    startPhasePlayTimer('discussion');

// Non-blocking: load targets in the background
    // so Opening can start speaking right away.
    (async () => {
      try {
        await ensureRuntimeTargets(true); // Force fresh reload of targets
        ensureBaseSessionSetup();
        // REMOVED: ephemeral question set generation - now done atomically during lesson load
        // All 4 arrays (comprehension, exercise, worksheet, test) generated together or restored together
      } catch (e) {
        // ensureRuntimeTargets failed
      }
    })();

// Kick off the Opening immediately (does its own loading state for TTS)
    await startDiscussionStep();
  };

// Helper: get teaching notes from the loaded lesson (if present)
  const getTeachingNotes = useCallback(() => {
    try {
      const tn = lessonData?.teachingNotes || lessonData?.teacherNotes || lessonData?.notes;
      const s = typeof tn === 'string' ? tn.trim() : '';
      return s || '';
    } catch {
      return '';
    }
  }, [lessonData]);

### 9. docs/brain/snapshot-persistence.md (cae4084ba5cfb06fad9433ab2591a046d3510a7955ef5e19123de0d42a650a18)
- bm25: -14.5305 | relevance: 1.0000

**Question set persistence (all Q&A phases):** Comprehension, Exercise, Worksheet, and Test question arrays are built once, saved to the assessment store (localStorage + Supabase), and reused on refresh/restart/resume. Snapshot `*-init` writes keep the same arrays and indices in `phaseData` so per-question snapshots align with the stored sets. Sets are only cleared in two cases: (1) the facilitator taps the red “Refresh” item in the hamburger menu (ms:print:refresh), which clears assessments and the snapshot, or (2) the lesson completes (sessionComplete), which clears assessments for a fresh next run. No other code path regenerates question arrays, preventing mismatches between printed worksheets/tests and in-session prompts.

### 10. src/app/session/v2/SessionPageV2.jsx (648f14c9f9ca255b06665f1cba4cbc1582716d50b4cf2a26245b063e61cc3e83)
- bm25: -14.2692 | relevance: 1.0000

if (forceFresh) {
      timelineJumpForceFreshPhaseRef.current = null;
    }
    return true;
  };
  
  // Start worksheet phase
  const startWorksheetPhase = () => {
    console.log('[SessionPageV2] startWorksheetPhase called');
    console.log('[SessionPageV2] startWorksheetPhase audioEngineRef:', !!audioEngineRef.current);
    if (!audioEngineRef.current || !lessonData) {
      console.log('[SessionPageV2] startWorksheetPhase - guard failed, returning early');
      return false;
    }
    if (!learnerProfile) {
      addEvent('⏸️ Learner not loaded yet - delaying worksheet init');
      return false;
    }

### 11. docs/brain/timer-system.md (cf69c7c5147d370c19d2f265cc0927d39c4a76469db0eb8300c73e80dbae02ad)
- bm25: -14.0131 | relevance: 1.0000

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

### 12. docs/brain/session-takeover.md (d2a5b9236d4e3241d8f4e67037d76d49d3dbd2ded9acab697c6da918d63a12a1)
- bm25: -13.5044 | relevance: 1.0000

- `src/app/lib/sessionTracking.js` - Session lifecycle (start/end/events), NO polling logic
- `src/app/session/sessionSnapshotStore.js` - Snapshot save with conflict detection, takeover trigger
- `src/app/session/hooks/useSnapshotPersistence.js` - Snapshot payload with timer state, restore logic
- `src/app/session/page.js` - PIN validation, takeover handler, session_id initialization
- `src/app/session/components/SessionTakeoverDialog.jsx` - Takeover UI (already exists)

### 13. docs/brain/snapshot-persistence.md (f0457970d961a840086588db5a8b8cce1d7171c4b615d5f358f49e242faf0609)
- bm25: -13.1716 | relevance: 1.0000

**Resume button:**
- Hides Resume/Restart buttons
- Calls `startSession()` which, when `resumePhase` is set, starts PhaseOrchestrator directly at that phase via `startSession({ startPhase: resumePhase })`
- This avoids starting Discussion first and then skipping, because Discussion/Teaching can still complete later and override the manual skip.
- Phase controller restores granular state from `snapshot.phaseData[phase]`
- Timer state restored via `timerServiceRef.current.restoreState(snapshot.timerState)`

### 14. src/app/session/v2/SessionPageV2.jsx (da3eab2385e310eb1361874ea3f0df07a857b24e4f20a8ba832ce25275f735df)
- bm25: -13.0393 | relevance: 1.0000

const startExercisePhase = () => {
    console.log('[SessionPageV2] startExercisePhase called');
    console.log('[SessionPageV2] startExercisePhase audioEngineRef:', !!audioEngineRef.current);
    if (!audioEngineRef.current || !lessonData) {
      console.log('[SessionPageV2] startExercisePhase - guard failed, returning early');
      return false;
    }
    if (!learnerProfile) {
      addEvent('⏸️ Learner not loaded yet - delaying exercise init');
      return false;
    }

const forceFresh = timelineJumpForceFreshPhaseRef.current === 'exercise';

const snapshot = snapshotServiceRef.current?.snapshot;
    const savedExercise = forceFresh ? null : (snapshot?.phaseData?.exercise || null);
    const savedExerciseQuestions = !forceFresh && Array.isArray(savedExercise?.questions) && savedExercise.questions.length ? savedExercise.questions : null;
    if (savedExerciseQuestions && savedExerciseQuestions.length && (!generatedExercise || !generatedExercise.length)) {
      setGeneratedExercise(savedExerciseQuestions);
    }
    const storedExerciseQuestions = !forceFresh && Array.isArray(generatedExercise) && generatedExercise.length ? generatedExercise : null;
    
    const exerciseTarget = savedExerciseQuestions ? savedExerciseQuestions.length : (storedExerciseQuestions ? storedExerciseQuestions.length : getLearnerTarget('exercise'));
    if (!exerciseTarget) return false;
    // Build exercise questions with 80/20 MC+TF vs SA+FIB blend
    const questions = savedExerciseQuestions || storedExerciseQuestions || buildQuestionPool(exerciseTarget, []);
    console.log('[SessionPageV2] startExercisePhase built questions:', questions.length);

### 15. src/app/facilitator/generator/counselor/CounselorClient.jsx (3de73a5798e52532c1b01008d1268d358c6d644a2bb073fbfd8ed54370796a29)
- bm25: -12.8351 | relevance: 1.0000

// Save audio for repeat functionality
      lastAudioRef.current = base64Audio

const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`)
      audio.muted = muted
      audio.volume = muted ? 0 : 1
      audioRef.current = audio

audio.onended = () => {
        setIsSpeaking(false)
        if (videoRef.current) {
          videoRef.current.pause()
        }
        if (buttonVideoRef.current) {
          buttonVideoRef.current.pause()
        }
        audioRef.current = null
      }

audio.onerror = () => {
        setIsSpeaking(false)
        audioRef.current = null
      }

setIsSpeaking(true)
      await audio.play()
      
      // Start video if available
      if (videoRef.current) {
        try {
          videoRef.current.play().catch(() => {})
        } catch {}
      }
      
      // Start button video if available
      if (buttonVideoRef.current) {
        try {
          buttonVideoRef.current.play().catch(() => {})
        } catch {}
      }
    } catch (err) {
      // Silent error handling
      setIsSpeaking(false)
    }
  }, [muted])

// Skip speech: stop audio and video, jump to end of response
  const handleSkipSpeech = useCallback(() => {
    // Stop audio
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current = null
      } catch {}
    }
    
    // Pause video
    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch {}
    }
    
    // Pause button video
    if (buttonVideoRef.current) {
      try {
        buttonVideoRef.current.pause()
      } catch {}
    }
    
    // Set speaking to false
    setIsSpeaking(false)
  }, [])

### 16. src/app/session/page.js (9fa2ca1f62f5e7c5c8fb58aa1333d63c3c839bf2c376cdbe57cd2f7796d1bbaf)
- bm25: -12.2716 | relevance: 1.0000

// Start NEW session for this device to take over
      if (typeof startTrackedSession === 'function') {
        try {
          const deviceName = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
          const newSession = await startTrackedSession(browserSessionId, deviceName);
          console.log('[SESSION TAKEOVER] Started new session:', newSession?.id);
        } catch (startErr) {
          console.error('[SESSION TAKEOVER] Failed to start new session:', startErr);
        }
      }

// Clear localStorage to force fresh server snapshot load
      const lsKey = `atomic_snapshot:${trackingLearnerId}:${normalizedLessonKey}`;
      try {
        localStorage.removeItem(lsKey);
      } catch {}

// Close dialog
      setShowTakeoverDialog(false);
      setConflictingSession(null);

// Reload page to restore fresh state from server
      window.location.reload();
    } catch (err) {
      throw err;
    }
  }, [trackingLearnerId, normalizedLessonKey, browserSessionId, conflictingSession, startTrackedSession]); // endTrackedSession not used, removed (TDZ fix)

const handleCancelTakeover = useCallback(() => {
    setShowTakeoverDialog(false);
    setConflictingSession(null);
    // User chose not to take over - redirect to learner dashboard
    if (typeof window !== 'undefined') {
      window.location.href = '/facilitator/learners';
    }
  }, []);

### 17. src/app/session/page.js (0fbdbe074c646b0ae0b72244711b8cac4d11853efa56564250f1dbdd6f79adbc)
- bm25: -12.1590 | relevance: 1.0000

// (session snapshot hooks moved below test state initialization to avoid TDZ)

### 18. docs/brain/snapshot-persistence.md (6f799d7afaab7f9b3ed3830fd2634632b03e89510dd0d6594971c7250a5b7c6c)
- bm25: -12.0024 | relevance: 1.0000

The prevention flag ensures no snapshot saves occur between clicking Complete Lesson and finishing cleanup. This prevents the lesson from showing "Continue" instead of "Start Lesson" on next visit.

### 19. src/app/session/v2/SessionPageV2.jsx (1a44525d187a8fbbd6a89a1f15653011dfabc1ae31b0e6f6cb02c3d479ad032b)
- bm25: -11.9045 | relevance: 1.0000

if (askExitSpeechLockRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked while Ask exit reminder is speaking');
      return;
    }
    
    // Debounce: Block rapid successive clicks
    if (timelineJumpInProgressRef.current) {
      console.warn('[SessionPageV2] Timeline jump BLOCKED - jump already in progress for:', targetPhase);
      return;
    }
    
    // Set jump in progress flag IMMEDIATELY (before any async operations)
    timelineJumpInProgressRef.current = true;
    console.log('[SessionPageV2] Flag NOW set to true, value:', timelineJumpInProgressRef.current, 'for:', targetPhase);
    
    // Only allow jumping to valid phases
    const validPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
    if (!validPhases.includes(targetPhase)) {
      console.warn('[SessionPageV2] Invalid timeline jump target:', targetPhase);
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need orchestrator
    if (!orchestratorRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no orchestrator');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need audio engine
    if (!audioEngineRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no audio engine');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }

### 20. docs/brain/v2-architecture.md (bcbaba8ae74f1369524b1c55e3e577738be446bf70f09f6d42f753c7ecc5b154)
- bm25: -11.7498 | relevance: 1.0000

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

### 21. cohere-changelog.md (6328b21c06717c18b760d7aedfef41561dfb9a67d6ef973e77621c0b36a44a9e)
- bm25: -11.6876 | relevance: 1.0000

### 2026-02-27  Generated lesson not appearing in calendar after scheduling
- Root cause (1): `loadSchedule` filtered out past-date+uncompleted lessons, hiding intentionally-scheduled entries for past/same-day dates
- Root cause (2): `onGenerated` callback passed no data; calendar had to wait for `loadSchedule` to complete before showing the new lesson (race condition)
- Fix (1): Removed `if (isPast && !completed && !completionLookupFailed) return` filter from `calendar/page.js`; all entries in `lesson_schedule` table now always display
- Fix (2): `LessonGeneratorOverlay` now parses schedule POST response and passes `newEntry` to `onGenerated(newEntry)`; forwarded through `DayViewOverlay` to calendar page which immediately injects it into `scheduledLessons` state before `loadSchedule` completes
- Files: `LessonGeneratorOverlay.jsx`, `DayViewOverlay.jsx`, `calendar/page.js`

### 22. docs/brain/snapshot-persistence.md (83771570e459d80f3130a04413886133c035ef9a1167a6692812acf99b672017)
- bm25: -11.5217 | relevance: 1.0000

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

### 23. docs/brain/timer-system.md (75d8a232d29d5fb010eabbc533054f137be7f538059c421192c44ef3e3a8eef1)
- bm25: -11.1156 | relevance: 1.0000

**2025-12-05**: CRITICAL FIX - Removed `setShowOpeningActions(false)` from `handlePlayExpiredComplete`. This was breaking all phase transitions because phase handlers already hide buttons as part of their normal flow. The premature state change created race conditions preventing Go button from working and timer from advancing phases. Each phase handler (handleGoComprehension, handleGoExercise, etc.) manages its own button visibility - timer handler should not interfere.

### 24. docs/brain/timer-system.md (93b5f5f1e95bf4a72b420f92660d6ca4559847ff7ab32409c591f92360c08643)
- bm25: -11.1031 | relevance: 1.0000

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

### 25. src/app/session/v2/SessionPageV2.jsx (846ff2cfe31debd4753a57df0c846ea02d1df3fdd4af05937cd1e16fdaf500f7)
- bm25: -11.0003 | relevance: 1.0000

if (snapshot.timerState) {
            // Keep UI timer mode aligned with the restored timer engine state.
            applyRestoredTimerStateToUi(snapshot.timerState, 'snapshot-load');
            if (timerServiceRef.current) {
              try {
                timerServiceRef.current.restoreState(snapshot.timerState);
                timerServiceRef.current.resync?.('snapshot-restore');
                hydrateWorkTimerSummaryFromTimerService('snapshot-restore');
              } catch {}
            } else {
              pendingTimerStateRef.current = snapshot.timerState;
            }
          }
        } else {
          resetTranscriptState();
          addEvent('💾 No snapshot found - Starting fresh');
        }
      }).catch(err => {
        if (cancelled) return;
        console.error('[SessionPageV2] Snapshot init error:', err);
        setError('Unable to load saved progress for this lesson.');
      }).finally(() => {
        if (!cancelled) {
          setSnapshotLoaded(true);
        }
      });
    } catch (err) {
      console.error('[SessionPageV2] Snapshot service construction failed:', err);
      setError('Unable to initialize persistence for this lesson.');
      setSnapshotLoaded(true);
    }

return () => {
      cancelled = true;
      snapshotServiceRef.current = null;
    };
  }, [lessonData, learnerProfile, browserSessionId, lessonKey, resetTranscriptState, applyRestoredTimerStateToUi]);
  
  // Initialize TimerService
  useEffect(() => {
    if (!eventBusRef.current || !lessonKey || !phaseTimers) return;

const eventBus = eventBusRef.current;

### 26. docs/brain/session-takeover.md (15220505a1b46edd3a4491aa177082deecf628df049e021e34cfda9447fbf112)
- bm25: -10.8312 | relevance: 1.0000

**Why this sequencing matters:**
- OLD BUG (pre 2026-01-14): `sessionConflictChecked` set true in finally block → Snapshot restored WHILE takeover dialog showing → Creates duplicate session/transcript splits
- NEW FIX (2026-01-14): `sessionConflictChecked` stays false on conflict → Takeover resolved first (via reload) → Snapshot restored cleanly ONCE

**Settlement order enforcement:**
- NO conflict: `sessionConflictChecked = true` immediately, snapshot restore proceeds
- CONFLICT detected: `sessionConflictChecked` stays false, snapshot restore blocked
- Takeover resolved: page reloads, fresh conflict check passes, snapshot restores once
- Error during check: `sessionConflictChecked = true` (fail-safe to allow snapshot restore)

**Old device behavior:**
- No active notification (no polling)
- Next gate attempt (user clicks Next, answers question, etc.) detects session ended
- Shows takeover notification: "This lesson was continued on another device"
- Redirects to learner dashboard

### Timer State: Snapshot-Based Persistence

**Source of truth**: Snapshot database (cross-device)  
**Mechanism**: Timer state captured at every checkpoint gate

Timer state in snapshot payload:
```javascript
{
  currentTimerMode: 'play' | 'work',
  workPhaseCompletions: { discussion: true, teaching: false, ... },
  timerSnapshot: {
    phase: 'teaching',
    mode: 'work',
    capturedAt: '2025-11-20T22:15:30.123Z',
    elapsedSeconds: 45,
    targetSeconds: 300
  }
}
```

### 27. docs/brain/beta-program.md (44b7322c4c91ceb611437def5e3574de2693a536ad54a3c2ff9f3a05be97fcc3)
- bm25: -10.8168 | relevance: 1.0000

### Derived Metrics

Expose per session:
- Total duration
- Repeats per sentence
- Counts by minute
- Notes per minute
- Transcript-note cross-reference by timestamp proximity

## Survey Content (Unlock Condition)

Require facilitator to complete fields covering:
- Environment
- Learning style
- Fatigue moments
- Struggles
- Freeform notes

**Unlock Condition**: Successful re-auth within window AND `post_lesson_surveys.submitted_at` present for session

## Admin and Lifecycle

- Only admins assign `subscription_tier = 'Beta'` in Supabase manually
- When Beta ends and tier is removed from profile, account remains
- `subscription_tier` becomes null and no gates apply
- Keep all collected data for analysis
- Gates can be disabled via flags without schema removal

## Removal Plan (Post-Beta)

1. Set `FORCE_TUTORIALS_FOR_BETA = false`
2. Set `SURVEY_GOLDEN_KEY_ENABLED = false`
3. Do not drop tables; keep data for audits
4. Optionally archive old sessions
5. Remove Beta tier values from `profiles.subscription_tier` while leaving accounts intact

## Acceptance Criteria

- Beta facilitators cannot proceed without signup video and facilitator tutorial completion
- Beta learners must complete learner tutorial once per learner profile on first lesson entry
- Golden key remains locked until password re-auth success and survey submission for session
- Transcripts and facilitator notes are timestamped
- Repeat clicks are evented and countable per sentence
- Lesson time is measurable from session start to end
- Non-Beta users are not blocked but can access tutorials optionally

## What NOT To Do

### Never Hard-Code Beta Logic in UI Components
- Use feature flags and database-driven gates
- Don't assume subscription tier in client-side code

### 28. src/app/session/page.js (c944a3d05366ae6752614849d2ed5d306adbde6b5ced4ef7fb7c574fcb58de04)
- bm25: -10.7923 | relevance: 1.0000

// Session snapshot persistence (restore and save) � placed after state declarations to avoid TDZ
  const restoredSnapshotRef = useRef(false);
  const didRunRestoreRef = useRef(false); // ensure we attempt restore exactly once per mount
  const restoreFoundRef = useRef(false);  // whether we actually applied a prior snapshot
  const resumeAppliedRef = useRef(false); // track whether resume reconciliation has been applied
  const snapshotSaveTimerRef = useRef(null);
  // Track a logical per-restart session id for per-session transcript files
  const [transcriptSessionId, setTranscriptSessionId] = useState(null);
  // Used to coalesce redundant saves: store a compact signature of the last saved meaningful state
  const lastSavedSigRef = useRef(null);
  // Retry budget for labeled saves when key is not yet ready
  const pendingSaveRetriesRef = useRef({});

### 29. docs/brain/snapshot-persistence.md (f87d966760c556fc2fde0b69db52ba05eaee701f6f8d5ee1c6782274d56614c0)
- bm25: -10.7863 | relevance: 1.0000

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

### 30. docs/brain/timer-system.md (b7aa6681ad045e85a58422ec46641d948683a8b9be9eb4e041d2b6d83bd36742)
- bm25: -10.7542 | relevance: 1.0000

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

### 31. src/app/session/v2/SessionPageV2.jsx (43985aaa7414662fa8ae12ab7faa7ca42408b12585de9ef2654661955bf556b4)
- bm25: -10.7424 | relevance: 1.0000

const res = await fetch('/api/facilitator/pin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ pin: pinCode })
    });

const result = await res.json().catch(() => null);
    if (!res.ok || !result?.ok) {
      throw new Error('Invalid PIN');
    }

if (conflictingSession?.id) {
      try {
        const { endLessonSession } = await import('@/app/lib/sessionTracking');
        await endLessonSession(conflictingSession.id, {
          reason: 'taken_over',
          metadata: {
            taken_over_by_session_id: browserSessionId,
            taken_over_at: new Date().toISOString(),
          },
          learnerId: trackingLearnerId,
          lessonId: trackingLessonId,
        });
      } catch {}
    }

try {
      const deviceName = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
      const takeoverStart = await startTrackedSession(browserSessionId, deviceName);
      if (takeoverStart?.conflict) {
        throw new Error('Lesson is still active on another device');
      }
      try { startSessionPolling?.(); } catch {}
    } catch (err) {
      throw err;
    }

// Clear local snapshot so reload pulls the latest remote snapshot.
    try {
      localStorage.removeItem(`atomic_snapshot:${trackingLearnerId}:${trackingLessonId}`);
    } catch {}

setShowTakeoverDialog(false);
    setConflictingSession(null);

if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [browserSessionId, conflictingSession, learnerProfile?.id, lessonKey, startTrackedSession, startSessionPolling]);

### 32. docs/brain/v2-architecture.md (b14f1ec9efc48af5207973c9298ed4218c7262ba742a852fa8b672fd9a713852)
- bm25: -10.7158 | relevance: 1.0000

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

### 33. docs/brain/mr-mentor-sessions.md (973e3de11950f5a0be1e7f5a77ab27d5a507cadd8918e997a510b58184d1a6d2)
- bm25: -10.7043 | relevance: 1.0000

**Initialization** (`src/app/facilitator/generator/counselor/CounselorClient.jsx`):
1. Generate/reuse a unique `sessionId`, persist it to sessionStorage/localStorage
2. Wait for accessToken and tier validation
3. `GET /api/mentor-session?sessionId={id}`
4. If another device owns the active session → show `SessionTakeoverDialog`
5. If no active session exists → `POST /api/mentor-session` with `action: 'initialize'`
6. Load `conversation_history` and `draft_summary` from the returned session
7. Start conflict detection (realtime + heartbeat)

**Conflict detection:**

- Realtime subscription listens to `mentor_sessions` updates for fast takeover detection.
- Heartbeat polling runs as a backup (`GET /api/mentor-session?sessionId={id}` every ~3 seconds).
- If an active session exists and `isOwner` is false:
  - Clear the persisted session id
  - Reset local conversation state
  - Show `SessionTakeoverDialog` with the active session info

**Conversation Persistence:**
- Every change to `conversationHistory` or `draftSummary` triggers debounced `PATCH` (1 second delay)
- On "New Conversation" click: `DELETE /api/mentor-session?sessionId={id}`

## Components

**`SessionTakeoverDialog.jsx`** - Modal for takeover flow

Props:
```jsx
{
  existingSession: {
    session_id: string,
    device_name: string,
    last_activity_at: string (ISO timestamp)
  },
  onTakeover: (pinCode: string) => Promise<void>,
  onForceEnd?: (pinCode: string) => Promise<void>,
  onCancel: () => void
}
```

Features:
- Displays device name and last activity timestamp
- 4-digit PIN input (numeric only)
- "Take Over Session" button (calls `onTakeover`)
- "Force End Session" button (calls `onForceEnd` to release frozen session)
- Warning about consequences
- Cancel button returns to facilitator page

### 34. src/app/session/page.js (dffb8a5f4f0ab8dd92946a8f638677d31fae5638b2046525a671e3dc612240e4)
- bm25: -10.6745 | relevance: 1.0000

// CRITICAL: Check for session conflicts BEFORE snapshot restore runs
  // This prevents the user from experiencing the snapshot restore twice:
  // once during initial load, then again after PIN entry
  useEffect(() => {
    const checkConflictEarly = async () => {
      // Only run once
      if (sessionConflictChecked) return;
      
      // Wait for required IDs to be available
      if (!trackingLearnerId || !normalizedLessonKey || !browserSessionId) return;
      
      console.log('[SESSION CONFLICT CHECK] Running early conflict check before snapshot restore');
      
      try {
        const deviceName = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
        const sessionResult = await startTrackedSession(browserSessionId, deviceName);
        
        // If conflict detected, show takeover dialog immediately
        if (sessionResult?.conflict) {
          console.log('[SESSION CONFLICT CHECK] Conflict detected, showing takeover dialog:', sessionResult.existingSession);
          setConflictingSession(sessionResult.existingSession);
          setShowTakeoverDialog(true);
          // Do NOT set sessionConflictChecked=true here - keep snapshot restore blocked until takeover resolved
        } else {
          console.log('[SESSION CONFLICT CHECK] No conflict, session started:', sessionResult?.id);
          // Gate-based detection handles future conflicts through snapshot saves
          // No polling needed - conflicts detected when Device A tries to save next snapshot
          setSessionConflictChecked(true);
        }
      } catch (err) {
        console.error('[SESSION CONFLICT CHECK] Error during early conflict check:', err);
        // On error, mark as checked so snapshot restore can proceed
        setSessionConflictChecked(true)

### 35. docs/brain/snapshot-persistence.md (badceaa786b7fbed311c2f1cd972c7e88b2851d87beca33fa9784a499139749c)
- bm25: -10.4978 | relevance: 1.0000

### Version Gating
- `snapshotVersion=2` marker prevents old v1 snapshots from loading
- Old snapshots ignored, session starts fresh

## What NOT To Do

**DO NOT ADD:**
- Polling/intervals for snapshot saves
- Autosave on state change
- Reconciliation after restore
- Signature comparison
- Debouncing (save immediately at checkpoints)

**DO NOT USE:**
- Session takeover polling
- checkSessionStatus intervals
- SessionTakeoverDialog overlay
- Device detection for sync

## Why Gates Not Polling

Gates are explicit, predictable, and testable:
- Save happens exactly when we say
- No drift from timing issues
- No performance overhead
- No race conditions

Polling causes:
- Unpredictable save timing
- Performance overhead
- Race conditions with React state
- Complexity in determining "what changed"

## Device Switch Behavior

When user switches devices:
1. localStorage on new device is empty
2. getStoredSnapshot falls back to database
3. Database returns latest snapshot
4. Snapshot written to new device's localStorage
5. Subsequent saves/restores use localStorage (fast)

**Session conflicts** (same learner+lesson on two devices simultaneously): Handled by session-takeover system, see [session-takeover.md](session-takeover.md). Takeover dialog appears at first gate when conflict detected, requires PIN validation.
## V2 Assessment Print System

**Integration:** SessionPageV2 registers print handlers directly (no separate hook) and persists worksheet/test decks via `assessmentStore` (localStorage + Supabase) keyed by `lesson_assessments:{learnerId}:{lessonKey}`.

### Architecture

### 36. docs/brain/v2-architecture.md (6a7b91ff6e8e0570e3cb0b8ab750c6e9a442924b2edcc946c2ebed47715132c1)
- bm25: -10.4605 | relevance: 1.0000

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

### 37. docs/brain/session-takeover.md (72ae25e3e29d75232134dc441859a03f901f7fbefdbe1ac720e5391b512b6775)
- bm25: -10.2551 | relevance: 1.0000

# Session Takeover System (Gate-Based)

## Core Architecture

**EARLY CONFLICT DETECTION, NO POLLING**

Session ownership enforced at page load before snapshot restore. No polling, no intervals, no performance overhead.

## How It Works

### Session Ownership Model

Each learner+lesson combination can have **exactly one active session** at any time. Session ownership is tracked in `lesson_sessions` table with device identification and activity timestamps.

When Device B attempts to access the same lesson that Device A is using, conflict is detected immediately at page load before any snapshot restore, triggering takeover dialog with PIN validation.

### Conflict Detection Strategy: Check Before Snapshot Restore

**CRITICAL FIX (2026-01-14)**: `sessionConflictChecked` flag now remains false when conflict is detected, blocking snapshot restore until takeover is resolved. This prevents transcript splits and duplicate sessions caused by snapshot restore running before takeover settlement.

### 38. docs/brain/v2-architecture.md (afffb9d44c9d9d5e9aee21cef0911b2f58779289d8122262e1045a2a4c0d3206)
- bm25: -10.1545 | relevance: 1.0000

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

### 39. src/app/session/page.js (371509ee9e0e1a0910876cccca05772750493bc1cb00f6f0923e6cd3b042a1e7)
- bm25: -10.1007 | relevance: 1.0000

// TEMP development helper: skip forward through major phases
  const skipForwardPhase = async () => {
    const ok = await ensurePinAllowed('skip');
    if (!ok) return;
    // Confirm out-of-order move: skipping alters the lesson timeline irreversibly
    try {
      const ans = typeof window !== 'undefined' ? window.prompt("This will alter the lesson in a way that can't be reversed. Type 'ok' to proceed.") : null;
      if (!ans || String(ans).trim().toLowerCase() !== 'ok') return;
    } catch {}
    // Centralized abort/cleanup
    abortAllActivity(true);
    // Ensure overlays tied to !loading can render immediately (Begin buttons)
    setLoading(false);
    // On any timeline skip, cut over transcript and clear prior resume snapshots
    try {
      const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
      const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
      // Append only the lines since the last segment start to avoid duplicating prior session text
      const startIdx = Math.max(0, Number(transcriptSegmentStartIndexRef.current) || 0);
      const all = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : [];
      const slice = normalizeTranscriptLines(all.slice(startIdx));
      if (learnerId && learnerId !== 'demo' && slice.length > 0) {
        await appendTranscriptSegment({
          learnerId,
          learnerName,
          lessonId,
          lessonTitle: effectiveLessonTitle,
          segment: { startedAt: sessionStartRef.current || new Date().toISOString(), completedAt: new Date().toISOString(), lines: slice },
          sessionId: transcriptSess

### 40. src/app/facilitator/generator/counselor/CounselorClient.jsx (7f3eb2007b09d0ce6b2e9e5c03cedee3dc3ff4cb20157d6a72cab3fb62b16561)
- bm25: -10.0301 | relevance: 1.0000

// If a newer init attempt started, don't clobber its loading state.
      if (attemptId !== initAttemptIdRef.current) {
        return
      }

// Silent error handling
      setSessionLoading(false)
      if (initializedSessionIdRef.current === subjectKey) {
        initializedSessionIdRef.current = null
      }
    } finally {
      if (initInFlightSubjectRef.current === subjectKey) {
        initInFlightSubjectRef.current = null
      }
    }
  }, [sessionId, accessToken, hasAccess, tierChecked, subjectKey, assignSessionIdentifier, startRealtimeSubscription])

// Initialize session when all dependencies are ready
  useEffect(() => {
    // Only attempt initialization when all required dependencies are ready
    if (!accessToken || !hasAccess || !tierChecked) {
      // If we're still waiting for dependencies, keep loading state true only if we haven't checked yet
      if (tierChecked && (!hasAccess || !accessToken)) {
        // Dependencies are checked but we don't have access - stop loading
        setSessionLoading(false)
      }
      return
    }
    
    // Don't re-initialize if we've already initialized this subject
    if (initializedSessionIdRef.current === subjectKey) {
      return
    }

// Avoid duplicate in-flight init for the same subject
    if (initInFlightSubjectRef.current === subjectKey) {
      return
    }
    
    // All dependencies ready - initialize
    initializeMentorSession()
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, hasAccess, tierChecked, subjectKey, initializeMentorSession])
