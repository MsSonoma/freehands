# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Restore medal emojis on /learn/lessons lesson cards, but keep the Medal earned portion removed from Completed Lessons history (Awards remains the place for medals).
```

Filter terms used:
```text
/learn/lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/learn/lessons

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (4b7dd738e990ee2c376b5dd4958af1c0dbcb9b9ad14319c1c6eda65dc503524d)
- bm25: -6.5140 | entity_overlap_w: 9.00 | adjusted: -8.7640 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Remove the Medal earned portion from the Completed Lessons page (/learn/lessons). Medals are already shown in Awards.
```

Filter terms used:
```text
/learn/lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/learn/lessons

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (0e51f14d1c52152b9424566d3bf0c618fd241c5219d5c054fecaf89e2de88b7d)
- bm25: -7.3972 | entity_overlap_w: 4.50 | adjusted: -8.5222 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Completed Lessons page: remove 'Medal earned' portion since Awards already shows medals. Find where medal earned UI is rendered on /learn/lessons and delete it.
```

Filter terms used:
```text
/learn/lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/learn/lessons

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/v2/SessionPageV2.jsx (2bc8e681bbd1556f75d0ce083dec1df5ac8c48a7151fbf63b711d25f84060648)
- bm25: -7.6185 | entity_overlap_w: 4.50 | adjusted: -8.7435 | relevance: 1.0000

### 2. sidekick_pack.md (d126e8946a06da80b9958e13cbe36f57c952ca29d7a5bbf1d435e23877448296)
- bm25: -7.3041 | entity_overlap_w: 4.50 | adjusted: -8.4291 | relevance: 1.0000

### 2. sidekick_pack.md (300e6436492e5ed214bfdde50c72fdcf654e0985ef3d73aef7caf193464045e0)
- bm25: -6.2563 | entity_overlap_w: 4.50 | adjusted: -7.3813 | relevance: 1.0000

// End tracked session (so Calendar history can detect this completion).
      try { stopSessionPolling?.(); } catch {}
      try {
        await endTrackedSession('completed', {
          source: 'session-v2',
          test_percentage: testGrade?.percentage ?? null,
        });
      } catch {}
      
      // Navigate to lessons page
      console.log('[SessionPageV2] Attempting navigation to lessons page');
      console.log('[SessionPageV2] router:', router);
      console.log('[SessionPageV2] router.push type:', typeof router?.push);
      try {
        if (router && typeof router.push === 'function') {
          console.log('[SessionPageV2] Using router.push');
          router.push('/learn/lessons');
        } else if (typeof window !== 'undefined') {
          console.log('[SessionPageV2] Using window.location.href');
          window.location.href = '/learn/lessons';
        }
      } catch (err) {
        console.error('[SessionPageV2] Navigation error:', err);
        if (typeof window !== 'undefined') {
          try { window.location.href = '/learn/lessons'; } catch {}
        }
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);

### 3. sidekick_pack.md (0bc5cd20fd3679a163ba52d025b5a54c0e9757e112b8ca4447806ed8014e428b)
- bm25: -5.8266 | entity_overlap_w: 4.50 | adjusted: -6.9516 | relevance: 1.0000

### 3. src/app/session/v2/SessionPageV2.jsx (2bc8e681bbd1556f75d0ce083dec1df5ac8c48a7151fbf63b711d25f84060648)
- bm25: -6.7752 | entity_overlap_w: 4.50 | adjusted: -7.9002 | relevance: 1.0000

// End tracked session (so Calendar history can detect this completion).
      try { stopSessionPolling?.(); } catch {}
      try {
        await endTrackedSession('completed', {
          source: 'session-v2',
          test_percentage: testGrade?.percentage ?? null,
        });
      } catch {}
      
      // Navigate to lessons page
      console.log('[SessionPageV2] Attempting navigation to lessons page');
      console.log('[SessionPageV2] router:', router);
      console.log('[SessionPageV2] router.push type:', typeof router?.push);
      try {
        if (router && typeof router.push === 'function') {
          console.log('[SessionPageV2] Using router.push');
          router.push('/learn/lessons');
        } else if (typeof window !== 'undefined') {
          console.log('[SessionPageV2] Using window.location.href');
          window.location.href = '/learn/lessons';
        }
      } catch (err) {
        console.error('[SessionPageV2] Navigation error:', err);
        if (typeof window !== 'undefined') {
          try { window.location.href = '/learn/lessons'; } catch {}
        }
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

### 4. src/app/session/v2/SessionPageV2.jsx (2bc8e681bbd1556f75d0ce083dec1df5ac8c48a7151fbf63b711d25f84060648)
- bm25: -5.8071 | entity_overlap_w: 4.50 | adjusted: -6.9321 | relevance: 1.0000

// End tracked session (so Calendar history can detect this completion).
      try { stopSessionPolling?.(); } catch {}
      try {
        await endTrackedSession('completed', {
          source: 'session-v2',
          test_percentage: testGrade?.percentage ?? null,
        });
      } catch {}
      
      // Navigate to lessons page
      console.log('[SessionPageV2] Attempting navigation to lessons page');
      console.log('[SessionPageV2] router:', router);
      console.log('[SessionPageV2] router.push type:', typeof router?.push);
      try {
        if (router && typeof router.push === 'function') {
          console.log('[SessionPageV2] Using router.push');
          router.push('/learn/lessons');
        } else if (typeof window !== 'undefined') {
          console.log('[SessionPageV2] Using window.location.href');
          window.location.href = '/learn/lessons';
        }
      } catch (err) {
        console.error('[SessionPageV2] Navigation error:', err);
        if (typeof window !== 'undefined') {
          try { window.location.href = '/learn/lessons'; } catch {}
        }
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

const openingController = new OpeningActionsController(
      eventBusRef.current,
      audioEngineRef.current,
      {
        phase: currentPhase,
        subject: lessonData.subject || 'math',
        learnerGrade: lessonData.grade || '',
        difficulty: lessonData.difficulty || 'moderate'
      }
    );

### 5. sidekick_pack.md (cc28be838d9b07c3336396f44367cea947aec4761e41918611ac5b12c60d162f)
- bm25: -5.5750 | entity_overlap_w: 3.00 | adjusted: -6.3250 | relevance: 1.0000

### 4. src/app/session/v2/SessionPageV2.jsx (52f9de32315ef936bfe4cec88c67ac9dd7bc5afb09c7dce74279bab6de4cafb9)
- bm25: -6.8127 | entity_overlap_w: 1.50 | adjusted: -7.1877 | relevance: 1.0000

const handleCancelTakeover = useCallback(() => {
    setShowTakeoverDialog(false);
    setConflictingSession(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/learn/lessons';
    }
  }, []);

### 5. src/app/learn/awards/page.js (4d8cce309e0f536106072dd471d5d29bbc535b069533182488b0980b7295cb15)
- bm25: -6.6875 | relevance: 1.0000

{subjectsToRender.map(subject => {
            const lessons = groupedMedals[subject]
            if (!lessons || lessons.length === 0) return null

const displaySubject = customKeyToName.get(subject)
              || subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

### 6. sidekick_pack.md (adc7e54c865b383afc12cf9ecd0f7c3ccf26849388d8ddf743ca442b021f45cc)
- bm25: -6.1554 | entity_overlap_w: 1.50 | adjusted: -6.5304 | relevance: 1.0000

// Canonical per-lesson persistence key (lesson == session identity)
  const lessonKey = useMemo(() => deriveCanonicalLessonKey({ lessonData, lessonId }), [lessonData, lessonId]);

// Golden Key lookup/persistence key MUST match V1 + /learn/lessons convention.
  // V1 stored golden keys under `${subject}/${lesson}` (including .json when present).
  const goldenKeyLessonKey = useMemo(() => {
    if (!subjectParam || !lessonId) return '';
    return `${subjectParam}/${lessonId}`;
  }, [subjectParam, lessonId]);

// Normalized key for visual aids (strips folder prefixes so the same lesson shares visual aids)
  const visualAidsLessonKey = useMemo(() => {
    const raw = lessonId || lessonData?.key || lessonKey || '';
    if (!raw) return null;

### 6. src/app/session/v2/SessionPageV2.jsx (52f9de32315ef936bfe4cec88c67ac9dd7bc5afb09c7dce74279bab6de4cafb9)
- bm25: -5.8157 | entity_overlap_w: 1.50 | adjusted: -6.1907 | relevance: 1.0000

const handleCancelTakeover = useCallback(() => {
    setShowTakeoverDialog(false);
    setConflictingSession(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/learn/lessons';
    }
  }, []);

### 7. src/app/learn/lessons/page.js (b44d689a27b25c85480ad88d524d9da527a52791f9642a88945174140c3bce2e)
- bm25: -6.1242 | relevance: 1.0000

const hasLessons = Object.keys(lessonsBySubject).length > 0

### 8. src/app/learn/lessons/page.js (c2f975cb1765feb66e7702181259e3294d72e50bde356252c899501a79899b28)
- bm25: -6.0005 | relevance: 1.0000

const displaySubject = subject === 'generated' ? 'Generated Lessons' : 
                                     subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

### 9. sidekick_pack.md (50a75550054ffdbba47c5c328fcbe1b377d50fb67bbbc1567c2bcfc020c78e76)
- bm25: -5.9199 | relevance: 1.0000

### 11. sidekick_pack.md (becae40e132eaf650f24f765637736236fe2b5b62153d5ed75d16750baa2f2ca)
- bm25: -5.9771 | relevance: 1.0000

Prompt (original):
```text
Trace completed lesson tracking: where do lesson completions get recorded (session teaching flow), and where do Completed Lessons page, Learn Awards (medals), and Calendar read from? Anchor on getMedalsForLearner, /api/medals, /api/learner/lesson-history, lesson_session_events, lesson_schedule, useTeachingFlow.
```

### 12. src/app/learn/awards/page.js (0499b864d98c5cc526cdd870d00a12f230da31563456ead2b5af1a35d52a5b28)
- bm25: -5.6760 | relevance: 1.0000

const customKeyToName = new Map(customDisplayOrder.map((s) => [s.key, s.name]))

### 13. sidekick_pack.md (7fd3b469abd92575a7c2625d7b64822186454b2add4ce372e80f3b3b2745ea03)
- bm25: -5.6760 | relevance: 1.0000

### 13. src/app/learn/awards/page.js (47bc6f3bfd7d509f8e841562bc9aedb6b081a5060920834a436575e17213e74a)
- bm25: -4.6201 | relevance: 1.0000

### 14. sidekick_pack.md (9bc6d69b93ce60db6a28248803503530894773e642d2ec285fa3a567fba49155)
- bm25: -5.6760 | relevance: 1.0000

### 12. src/app/learn/awards/page.js (7bc9f9a06897b38ad7fbcd7544a86dacb73aed6c6c4ea0e854e91c40036b1551)
- bm25: -4.8047 | relevance: 1.0000

### 15. src/app/learn/awards/page.js (9b7b115c5d14e4d1b4f7ce9973b8e273d81cccc35f9535164fb84cc016b3f20a)
- bm25: -5.4674 | relevance: 1.0000

### 10. src/app/learn/awards/page.js (4d8cce309e0f536106072dd471d5d29bbc535b069533182488b0980b7295cb15)
- bm25: -5.7570 | relevance: 1.0000

{subjectsToRender.map(subject => {
            const lessons = groupedMedals[subject]
            if (!lessons || lessons.length === 0) return null

const displaySubject = customKeyToName.get(subject)
              || subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

### 11. src/app/learn/lessons/page.js (249d8f2fae6c52358bab8308540d9c573a803d3ab6ccf8a31f847b6749854a3e)
- bm25: -5.7196 | relevance: 1.0000

return () => {
      cancelled = true
    }
  }, [learnerId, refreshTrigger, router])

useEffect(() => {
    if (!sessionGateReady) return

let cancelled = false
    ;(async () => {
      if (!learnerId) {
        setLessonsLoading(false)
        return
      }

### 12. sidekick_pack.md (cb47731dfb4c9436f6c0fe27eb4db08c8d76433680f1990e74ccc0745341ce7c)
- bm25: -5.6637 | relevance: 1.0000

useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Get auth token for facilitator lessons
      let token = null
      try {
        const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          token = session?.access_token || null
        }
      } catch {}

### 14. src/app/learn/awards/page.js (6cbf7bc567229771688329f236afb1c9dffbedd8fcb6f7d8cca57ce82fdb17d8)
- bm25: -4.5263 | relevance: 1.0000

### 30. src/app/learn/awards/page.js (f45cd535ba332cbf78616690eb559625eb2e7507931a9b3848baaee84ae648ba)
- bm25: -3.7622 | relevance: 1.0000

### 13. src/app/learn/lessons/page.js (d5fde6d7299a74fffe427b7dd14b1ac9187576a63006de537aa94567ee76cbae)
- bm25: -5.4475 | relevance: 1.0000

;(async () => {
      try {
        // Just check for active session without PIN requirement
        // The lessons page should be freely accessible
        const active = await getActiveLessonSession(learnerId)
        if (cancelled) return
        // No PIN gate here - let learners view lessons freely
        if (!cancelled) setSessionGateReady(true)
      } catch (err) {
        if (!cancelled) setSessionGateReady(true)
      }
    })()

### 14. sidekick_pack.md (5270f62aae739c1d0782387acca49ee6a3acf83afafa44f206dd6238fe8e19ae)
- bm25: -4.9993 | entity_overlap_w: 1.50 | adjusted: -5.3743 | relevance: 1.0000

if (!bucket || bucket === 'generated') {
        // If the lesson exists in any known subject folder, prefer that.
        const knownSubjects = Object.keys(allLessons || {})
        const foundInKnown = knownSubjects.find((s) => {
          const list = allLessons[s] || []
          return list.some((l) => ensureJsonFile(l?.file) === file)
        })
        if (foundInKnown) bucket = foundInKnown
      }

### 10. src/app/learn/awards/page.js (aae2328e0ee15a6065296a219b86c3ca49388cd1de1f170e826da26788d23a15)
- bm25: -5.4180 | relevance: 1.0000

### 7. sidekick_pack.md (9a1a06638f6360a95160118237731dbc35f3499de67057b95c7db48fb4cfbab9)
- bm25: -6.0277 | entity_overlap_w: 1.50 | adjusted: -6.4027 | relevance: 1.0000

// Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

const openingController = new OpeningActionsController(
      eventBusRef.current,
      audioEngineRef.current,
      {
        phase: currentPhase,
        subject: lessonData.subject || 'math',
        learnerGrade: lessonData.grade || '',
        difficulty: lessonData.difficulty || 'moderate'
      }
    );

### 2. src/app/session/v2/SessionPageV2.jsx (52f9de32315ef936bfe4cec88c67ac9dd7bc5afb09c7dce74279bab6de4cafb9)
- bm25: -7.6672 | entity_overlap_w: 1.50 | adjusted: -8.0422 | relevance: 1.0000

const handleCancelTakeover = useCallback(() => {
    setShowTakeoverDialog(false);
    setConflictingSession(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/learn/lessons';
    }
  }, []);

### 3. src/app/learn/awards/page.js (4d8cce309e0f536106072dd471d5d29bbc535b069533182488b0980b7295cb15)
- bm25: -7.5123 | relevance: 1.0000

### 15. sidekick_pack.md (5520022241346e08d00cabde2f7310e6f40cb0b9857c7b6369925665dc906bbd)
- bm25: -4.5854 | entity_overlap_w: 3.00 | adjusted: -5.3354 | relevance: 1.0000

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

### 16. sidekick_pack.md (c29998e62304a9280acd5463c16bb760323b37381b8db889028084faae2c4670)
- bm25: -4.5854 | entity_overlap_w: 3.00 | adjusted: -5.3354 | relevance: 1.0000

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

### 17. src/app/session/v2/SessionPageV2.jsx (6eb0184a1679579cee951cbb6d3df37352976c3fb65a69f7e0905659e37fb486)
- bm25: -4.5552 | entity_overlap_w: 3.00 | adjusted: -5.3052 | relevance: 1.0000

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

### 18. src/app/learn/lessons/page.js (75c7169b8fe5d72a525f980ce8882809bbd62f93dcaea6b21cb20fce2a47e9cf)
- bm25: -5.1017 | relevance: 1.0000

// CRITICAL: Don't treat 'congrats' or 'test' as meaningful progress
  // Lesson is complete - no point resuming to "Complete Lesson" button
  // Test phase includes both in-progress tests AND completed tests (testFinalPercent may be null)
  if (phase === 'congrats' || phase === 'test') return false

### 19. src/app/learn/lessons/page.js (e09a8e3b9d19eabad425a4ae38958d8b1d02b5530db1a6d74da957bd2e1f715f)
- bm25: -5.0890 | relevance: 1.0000

// Poll for newly scheduled lessons every 30 seconds
  useEffect(() => {
    if (!learnerId) return
    
    // DISABLED: Polling causes too many reloads, schedule changes are rare
    // Users can manually refresh if needed
    // const pollInterval = setInterval(() => {
    //   console.log('[Learn Lessons] Polling for schedule changes')
    //   setRefreshTrigger(prev => prev + 1)
    // }, 30 * 1000) // 30 seconds
    
    // return () => clearInterval(pollInterval)
  }, [learnerId])

// Check for golden key earned notification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Only show or suppress the toast once we know the learner setting.
      // (Avoid clearing it while the setting is still loading to prevent “missing toast” bugs.)
      if (goldenKeysEnabled === false) {
        sessionStorage.removeItem('just_earned_golden_key');
        return;
      }
      if (goldenKeysEnabled !== true) return;

const justEarned = sessionStorage.getItem('just_earned_golden_key');
      if (justEarned !== 'true') return;

sessionStorage.removeItem('just_earned_golden_key');
      setShowGoldenKeyToast(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setShowGoldenKeyToast(false), 5000);
      return () => clearTimeout(timer);
    } catch {}
  }, [goldenKeysEnabled]);

### 20. sidekick_pack.md (c6d9955839052a9df1812b5fcbdba89a090c229868420a2005e26f91049cf6c4)
- bm25: -5.0286 | relevance: 1.0000

const displaySubject = customKeyToName.get(subject)
              || subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

### 4. src/app/session/v2/SessionPageV2.jsx (6eb0184a1679579cee951cbb6d3df37352976c3fb65a69f7e0905659e37fb486)
- bm25: -6.0084 | entity_overlap_w: 3.00 | adjusted: -6.7584 | relevance: 1.0000

### 8. sidekick_pack.md (e542bde72f1a720b73ba3fc325fdcae0245743d0e6e0072c94390348dce0f3d3)
- bm25: -6.3200 | relevance: 1.0000

### 5. src/app/learn/awards/page.js (0499b864d98c5cc526cdd870d00a12f230da31563456ead2b5af1a35d52a5b28)
- bm25: -6.4352 | relevance: 1.0000

const customKeyToName = new Map(customDisplayOrder.map((s) => [s.key, s.name]))

### 6. src/app/learn/awards/page.js (9b7b115c5d14e4d1b4f7ce9973b8e273d81cccc35f9535164fb84cc016b3f20a)
- bm25: -6.1538 | relevance: 1.0000

const lessonsMap = {}
      for (const subject of subjectsToFetch) {
        try {
          const subjectKey = normalizeSubjectKey(subject)
          const headers = subject === 'generated' && token 
            ? { 'Authorization': `Bearer ${token}` }
            : {}
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store',
            headers
          })
          const list = res.ok ? await res.json() : []
          lessonsMap[subjectKey] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap[normalizeSubjectKey(subject)] = []
        }
      }
      if (!cancelled) {
        setAllLessons(lessonsMap)
        setLessonsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [customSubjectNames.join('|')])

### 7. src/app/learn/awards/page.js (c65c1998a9dabde1a8764e963f6b0d48b40ab7e3e508d1f3983ad3e80c0473ed)
- bm25: -6.0853 | relevance: 1.0000

### 21. sidekick_pack.md (17fa2bbcbdea449f6d12e44851a97dc428e62acfa65b822f4240b7d2c0fd92ca)
- bm25: -4.9895 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Trace completed lesson tracking: where do lesson completions get recorded (session teaching flow), and where do Completed Lessons page, Learn Awards (medals), and Calendar read from? Anchor on getMedalsForLearner, /api/medals, /api/learner/lesson-history, lesson_session_events, lesson_schedule, useTeachingFlow.
```

Filter terms used:
```text
/api/learner/lesson-history
/api/medals
lesson_schedule
lesson_session_events
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/learner/lesson-history /api/medals lesson_schedule lesson_session_events

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -14.5857 | entity_overlap_w: 3.00 | adjusted: -15.3357 | relevance: 1.0000

if (!token) {
        setGenerating(false)
        return
      }

### 18. src/app/learn/awards/page.js (132205d5347106bc72f65a143af49b21c15f460f68553eece51f6cbf554793f7)
- bm25: -4.0476 | relevance: 1.0000

### 19. src/app/learn/awards/page.js (ebc1895801227375408072bd153c7c76812fe8756cfe668246876a991b78216e)
- bm25: -4.8406 | relevance: 1.0000

### 22. src/app/learn/lessons/page.js (e30c923008085d63f3c9de351ca2e71148a687753caeddd2a1b0dddb72390f2d)
- bm25: -4.9427 | relevance: 1.0000

<p style={{ textAlign:'center', color:'#6b7280', marginTop:24 }}>
        Daily lessons used: {Number.isFinite(todaysCount) ? todaysCount : 0} / {featuresForTier(planTier).lessonsPerDay === Infinity ? '' : featuresForTier(planTier).lessonsPerDay}
      </p>
      
      <LoadingProgress
        isLoading={sessionLoading}
        onComplete={() => setSessionLoading(false)}
      />

<LessonHistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        sessions={lessonHistorySessions}
        events={lessonHistoryEvents}
        loading={lessonHistoryLoading}
        error={lessonHistoryError}
        onRefresh={refreshLessonHistory}
        titleLookup={(lessonId) => lessonTitleLookup[lessonId]}
      />
    </main>
  )
}

export default function LessonsPage(){
  return (
    <Suspense fallback={<main style={{padding:24}}><p>Loading lessons</p></main>}>
      <LessonsPageInner />
    </Suspense>
  )
}

### 23. src/app/learn/lessons/page.js (cf9018951f4242e0277ded1b10a4cde9a28f8e7e8ae74bc165b5d1ff608c95a7)
- bm25: -4.8858 | relevance: 1.0000

useEffect(() => {
    if (!learnerId) {
      setActiveGoldenKeys({})
      // Keep golden key UI hidden until we know whether a learner is selected.
      setGoldenKeysEnabled(null)
      setLoading(false)
      return
    }
    // Demo learner doesn't need database lookup
    if (learnerId === 'demo') {
      setActiveGoldenKeys({})
      setGoldenKeysEnabled(true)
      setLoading(false)
      return
    }

// Hide Golden Key UI until we load the learner setting.
    setGoldenKeysEnabled(null)

### 24. src/app/learn/lessons/page.js (efb08a2f5c2d9fad4824e02b928df73cd4bf9e117667cc84c27234f1b4f77e3f)
- bm25: -4.8713 | relevance: 1.0000

﻿'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { getLearner, updateLearner } from '@/app/facilitator/learners/clientApi'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import LoadingProgress from '@/components/LoadingProgress'
import GoldenKeyCounter from '@/app/learn/GoldenKeyCounter'
import { getStoredSnapshot } from '@/app/session/sessionSnapshotStore'
import { getActiveLessonSession } from '@/app/lib/sessionTracking'
import { useLessonHistory } from '@/app/hooks/useLessonHistory'
import LessonHistoryModal from '@/app/components/LessonHistoryModal'
import { subscribeLearnerSettingsPatches } from '@/app/lib/learnerSettingsBus'

const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general', 'generated']

function normalizeApprovedLessonKeys(map = {}) {
  const normalized = {}
  let changed = false
  Object.entries(map || {}).forEach(([key, value]) => {
    if (typeof key === 'string' && key.startsWith('Facilitator Lessons/')) {
      const suffix = key.slice('Facilitator Lessons/'.length)
      normalized[`general/${suffix}`] = value
      changed = true
    } else if (key) {
      normalized[key] = value
    }
  })
  return { normalized, changed }
}

function snapshotHasMeaningfulProgress(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false

const phase = snapshot.phase || 'discussion'
  const subPhase = snapshot.subPhase || 'greeting'
  const resume = snapshot.resume || null

### 25. src/app/learn/lessons/page.js (94686695fdd1c06ca3bf9ec3543f5321d573d80502e21402a8a15747824c5ab0)
- bm25: -4.8629 | relevance: 1.0000

// Listen for facilitator-side per-learner settings changes (no localStorage fallback)
  useEffect(() => {
    if (!learnerId || learnerId === 'demo') return;
    return subscribeLearnerSettingsPatches((msg) => {
      if (String(msg?.learnerId) !== String(learnerId)) return;
      if (msg?.patch?.golden_keys_enabled === undefined) return;
      const enabled = !!msg.patch.golden_keys_enabled;
      setGoldenKeysEnabled(enabled);
      if (!enabled) {
        setGoldenKeySelected(false);
        setShowGoldenKeyToast(false);
      }
    });
  }, [learnerId]);

### 26. src/app/learn/lessons/page.js (613be2554cfdfe62ec79d40c075ef0b94ba1b4df32de550ff8fb683f819779f7)
- bm25: -4.7735 | relevance: 1.0000

// Set up midnight refresh timer
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const msUntilMidnight = tomorrow.getTime() - now.getTime()
      
      const timer = setTimeout(() => {
        setRefreshTrigger(prev => prev + 1)
        // Schedule next midnight refresh
        scheduleNextMidnightRefresh()
      }, msUntilMidnight)
      
      return timer
    }
    
    const timer = scheduleNextMidnightRefresh()
    return () => clearTimeout(timer)
  }, [])

### 27. src/app/session/v2/SessionPageV2.jsx (18db391b7aa643ba46e6de0c027797f5a712a85fd48f6c76129ee640d9dfd80c)
- bm25: -4.3172 | entity_overlap_w: 1.50 | adjusted: -4.6922 | relevance: 1.0000

// Canonical per-lesson persistence key (lesson == session identity)
  const lessonKey = useMemo(() => deriveCanonicalLessonKey({ lessonData, lessonId }), [lessonData, lessonId]);

// Golden Key lookup/persistence key MUST match V1 + /learn/lessons convention.
  // V1 stored golden keys under `${subject}/${lesson}` (including .json when present).
  const goldenKeyLessonKey = useMemo(() => {
    if (!subjectParam || !lessonId) return '';
    return `${subjectParam}/${lessonId}`;
  }, [subjectParam, lessonId]);

// Normalized key for visual aids (strips folder prefixes so the same lesson shares visual aids)
  const visualAidsLessonKey = useMemo(() => {
    const raw = lessonId || lessonData?.key || lessonKey || '';
    if (!raw) return null;

### 28. src/app/learn/awards/page.js (0499b864d98c5cc526cdd870d00a12f230da31563456ead2b5af1a35d52a5b28)
- bm25: -4.6850 | relevance: 1.0000

const customKeyToName = new Map(customDisplayOrder.map((s) => [s.key, s.name]))

### 29. sidekick_pack.md (b308b05b8ee2c65752a2de5e61461659664862b275d402ca429d129aaf8a3bc7)
- bm25: -4.6850 | relevance: 1.0000

### 20. src/app/learn/awards/page.js (aae2328e0ee15a6065296a219b86c3ca49388cd1de1f170e826da26788d23a15)
- bm25: -4.8294 | relevance: 1.0000

### 30. sidekick_pack.md (b5bba69740f10ce28a4cac245140425c649788eec8dd7c929e9949387c906e60)
- bm25: -4.6850 | relevance: 1.0000

### 22. src/app/learn/awards/page.js (7bc9f9a06897b38ad7fbcd7544a86dacb73aed6c6c4ea0e854e91c40036b1551)
- bm25: -4.2914 | relevance: 1.0000

### 31. sidekick_pack.md (ba223a4ad83402a26721585aeb150ed2a0dff4684eda69c975ea703f874f26aa)
- bm25: -4.6850 | relevance: 1.0000

### 9. src/app/learn/awards/page.js (ebc1895801227375408072bd153c7c76812fe8756cfe668246876a991b78216e)
- bm25: -5.4885 | relevance: 1.0000

### 32. src/app/learn/awards/page.js (9b7b115c5d14e4d1b4f7ce9973b8e273d81cccc35f9535164fb84cc016b3f20a)
- bm25: -4.6663 | relevance: 1.0000

const lessonsMap = {}
      for (const subject of subjectsToFetch) {
        try {
          const subjectKey = normalizeSubjectKey(subject)
          const headers = subject === 'generated' && token 
            ? { 'Authorization': `Bearer ${token}` }
            : {}
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store',
            headers
          })
          const list = res.ok ? await res.json() : []
          lessonsMap[subjectKey] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap[normalizeSubjectKey(subject)] = []
        }
      }
      if (!cancelled) {
        setAllLessons(lessonsMap)
        setLessonsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [customSubjectNames.join('|')])

### 33. sidekick_pack.md (438b15e6b9ffc8f9b8d9e69ddb84d098411d3aa6eec2f8a132f2451bb51c3e9c)
- bm25: -4.2882 | entity_overlap_w: 1.50 | adjusted: -4.6632 | relevance: 1.0000

### 16. src/app/session/v2/SessionPageV2.jsx (18db391b7aa643ba46e6de0c027797f5a712a85fd48f6c76129ee640d9dfd80c)
- bm25: -5.0588 | entity_overlap_w: 1.50 | adjusted: -5.4338 | relevance: 1.0000

// Canonical per-lesson persistence key (lesson == session identity)
  const lessonKey = useMemo(() => deriveCanonicalLessonKey({ lessonData, lessonId }), [lessonData, lessonId]);

// Golden Key lookup/persistence key MUST match V1 + /learn/lessons convention.
  // V1 stored golden keys under `${subject}/${lesson}` (including .json when present).
  const goldenKeyLessonKey = useMemo(() => {
    if (!subjectParam || !lessonId) return '';
    return `${subjectParam}/${lessonId}`;
  }, [subjectParam, lessonId]);

// Normalized key for visual aids (strips folder prefixes so the same lesson shares visual aids)
  const visualAidsLessonKey = useMemo(() => {
    const raw = lessonId || lessonData?.key || lessonKey || '';
    if (!raw) return null;

### 17. src/app/learn/awards/page.js (c65c1998a9dabde1a8764e963f6b0d48b40ab7e3e508d1f3983ad3e80c0473ed)
- bm25: -5.3673 | relevance: 1.0000

useEffect(() => {
    if (!learnerId) {
      setMedals({})
      setMedalsLoading(false)
      return
    }
    (async () => {
      try {
        const data = await getMedalsForLearner(learnerId)
        setMedals(data || {})
      } catch {
        setMedals({})
      }
      setMedalsLoading(false)
    })()
  }, [learnerId])

### 18. sidekick_pack.md (7837b9b95f9bac2819dbedb9ec2b4e89d36dfa3f6227d2fd7af9137672de690a)
- bm25: -4.8458 | relevance: 1.0000

### 17. sidekick_pack.md (cf5ca4605f7228a0d1b589925c16429d72823c3313b2bfdf8c702ca90c47df61)
- bm25: -4.2090 | relevance: 1.0000

Filter terms used:
```text
/api/mentor-session
facilitator_id
is_active
SessionTakeoverDialog
```
# Context Pack

### 34. src/app/learn/lessons/page.js (58c19f88ae06b1bea9ef2f0c2e153dfa3a2f9f45fd23d92b55a40ac89b852d44)
- bm25: -4.6212 | relevance: 1.0000

{/* Golden Key Counter */}
      {goldenKeysEnabled === true && !loading && !lessonsLoading && (
        <GoldenKeyCounter
          learnerId={learnerId}
          selected={goldenKeySelected}
          onToggle={() => setGoldenKeySelected(prev => !prev)}
        />
      )}

{learnerId && learnerId !== 'demo' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, marginTop: 12 }}>
          <button
            onClick={() => setShowHistoryModal(true)}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              color: '#111827',
              fontSize: 14,
              fontWeight: 600,
              cursor: lessonHistoryLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            disabled={lessonHistoryLoading && !lessonHistorySessions.length}
            title={lessonHistoryLoading ? 'Loading history…' : 'See completed lessons'}
          >
            ✅ Completed Lessons{completedLessonCount ? ` (${completedLessonCount})` : ''}
            {activeLessonCount > 0 && (
              <span style={{ fontSize: 12, color: '#d97706' }}>⏳ {activeLessonCount}</span>
            )}
          </button>
        </div>
      )}

### 35. src/app/learn/lessons/page.js (215f91210f234c85f7acee90890a6a2700fd14bd6855a4bc581174347e5b8f9a)
- bm25: -4.5599 | relevance: 1.0000

if (!sessionGateReady) {
    return (
      <main style={{ padding:24, maxWidth:980, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'320px', gap:12, marginTop:32 }}>
          <div style={{
            width:48,
            height:48,
            border:'4px solid #e5e7eb',
            borderTop:'4px solid #111',
            borderRadius:'50%',
            animation:'spin 1s linear infinite'
          }}></div>
          <p style={{ color:'#6b7280', fontSize:15, textAlign:'center' }}>Hang tight—enter the facilitator PIN to unlock lessons.</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    )
  }

### 36. sidekick_pack.md (afbc1677920ba0eebe70e3e9a318d060075020c19416a23b7d95f5b06ec14fc2)
- bm25: -4.5555 | relevance: 1.0000

export default function AwardsPage() {
  const router = useRouter()
  const [learnerName, setLearnerName] = useState(null)
  const [learnerId, setLearnerId] = useState(null)
  const [medals, setMedals] = useState({})
  const [allLessons, setAllLessons] = useState({})
  const [medalsLoading, setMedalsLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(true)
  const [customSubjects, setCustomSubjects] = useState([])
  const [customSubjectsLoading, setCustomSubjectsLoading] = useState(true)

const normalizeSubjectKey = (value) => {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  }

const customSubjectNames = (customSubjects || [])
    .map((s) => s?.name)
    .filter(Boolean)

// Fetch subjects includes generated so we can infer subject buckets for facilitator-created lessons.
  // Include custom subjects so Awards can resolve titles/blurbs where available.
  const subjectsToFetch = [
    ...CORE_SUBJECTS,
    ...customSubjectNames,
    'generated',
  ]

useEffect(() => {
    try {
      const id = localStorage.getItem('learner_id')
      const name = localStorage.getItem('learner_name')
      if (name) setLearnerName(name)
      if (id) setLearnerId(id)
    } catch {}
  }, [])

### 16. src/app/learn/awards/page.js (f45cd535ba332cbf78616690eb559625eb2e7507931a9b3848baaee84ae648ba)
- bm25: -4.2350 | relevance: 1.0000

### 25. src/app/learn/awards/page.js (47bc6f3bfd7d509f8e841562bc9aedb6b081a5060920834a436575e17213e74a)
- bm25: -4.1044 | relevance: 1.0000

### 37. src/app/learn/awards/page.js (c65c1998a9dabde1a8764e963f6b0d48b40ab7e3e508d1f3983ad3e80c0473ed)
- bm25: -4.4299 | relevance: 1.0000

useEffect(() => {
    if (!learnerId) {
      setMedals({})
      setMedalsLoading(false)
      return
    }
    (async () => {
      try {
        const data = await getMedalsForLearner(learnerId)
        setMedals(data || {})
      } catch {
        setMedals({})
      }
      setMedalsLoading(false)
    })()
  }, [learnerId])

### 38. src/app/learn/lessons/page.js (5ca5a542b77832b079813b787744ba5883ffd4916d64f072884e003dfd2d6e9f)
- bm25: -4.2058 | relevance: 1.0000

setLessonsLoading(true)
      
      const lessonsMap = {}
      
      // Load demo lessons if it's the demo learner
      if (learnerId === 'demo') {
        try {
          const res = await fetch('/api/lessons/demo', { cache: 'no-store' })
          const list = res.ok ? await res.json() : []
          lessonsMap['demo'] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap['demo'] = []
        }
      } else if (learnerId) {
        // OPTIMIZED: Call single API that returns only checked/scheduled lessons
        try {
          const res = await fetch(`/api/learner/available-lessons?learner_id=${learnerId}`, {
            cache: 'no-store'
          })
          
          if (res.ok) {
            const {
              lessons,
              scheduledKeys: serverScheduledKeys,
              rawSchedule: serverRawSchedule,
              approvedKeys: serverApprovedKeys,
              staleApprovedKeys,
              staleScheduledKeys
            } = await res.json()
            let cleanupTriggered = false
            if (Array.isArray(staleApprovedKeys) && staleApprovedKeys.length > 0) {
              cleanupTriggered = true
            }
            if (Array.isArray(staleScheduledKeys) && staleScheduledKeys.length > 0) {
              cleanupTriggered = true
            }
            if (cleanupTriggered) {
              setRefreshTrigger(prev => prev + 1)
            }
            
            // Group by subject
            for (const lesson of lessons) {
              const subject = lesson.isGenerated ? 'generated' : (lesson.subject || 'general')
              if (!lessonsMap[subject]) lessonsMap[subject] = []
              lessonsMap[subject].push(lesson)
            }
          }
        } catch (err) {
        }
      }
      
      i

### 39. src/app/learn/awards/page.js (aae2328e0ee15a6065296a219b86c3ca49388cd1de1f170e826da26788d23a15)
- bm25: -4.1823 | relevance: 1.0000

return (
              <div key={subject}>
                <h2 style={subjectHeading}>
                  {displaySubject}
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 400, 
                    color: '#6b7280',
                    background: '#f3f4f6',
                    padding: '2px 8px',
                    borderRadius: 12
                  }}>
                    {lessons.length} {lessons.length === 1 ? 'medal' : 'medals'}
                  </span>
                </h2>
                
                {lessons.map(lesson => {
                  const medal = emojiForTier(lesson.medalTier)
                  
                  return (
                    <div key={`${subject}-${lesson.file}`} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
                            {lesson.title}
                          </h3>
                          {lesson.blurb && (
                            <p style={{ margin: '4px 0', color: '#6b7280', fontSize: 14 }}>
                              {lesson.blurb}
                            </p>
                          )}
                          {(lesson.grade || lesson.difficulty) && (
                            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                              {lesson.grade && `Grade ${lesson.grade}`}
                              {lesson.grade && lesson.difficulty && ' • '}
                              {lesson.difficulty && lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
                            </div>

### 40. src/app/learn/lessons/page.js (b7f3391dd131f7baa5982184af6b0364d6f76f4a68d95de36c0cf9bb36558062)
- bm25: -4.1011 | relevance: 1.0000

const lessonsBySubject = useMemo(() => {
    const grouped = {}
    SUBJECTS.forEach(subject => {
      const subjectLessons = allLessons[subject] || []
      // Filter by available lessons - show lessons that are EITHER:
      // 1. Marked available by facilitator (checkbox), OR
      // 2. Scheduled for today (calendar)
      const availableForSubject = subjectLessons.filter(lesson => {
        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}`
          : `${subject}/${lesson.file}`
        // Also check legacy facilitator/ key for general lessons
        const legacyKey = lessonKey.replace('general/', 'facilitator/')
        // Also check just the filename (no subject prefix) for backwards compatibility
        const filenameOnly = lesson.file
        const isAvailable = availableLessons[lessonKey] === true 
          || availableLessons[legacyKey] === true 
          || availableLessons[filenameOnly] === true
          || scheduledLessons[lessonKey] === true 
          || scheduledLessons[legacyKey] === true
          || scheduledLessons[filenameOnly] === true
        return isAvailable
      }).map(lesson => {
        // Add lessonKey to each lesson object for snapshot lookup
        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}`
          : `${subject}/${lesson.file}`
        return { ...lesson, lessonKey }
      })
      if (availableForSubject.length > 0) {
        grouped[subject] = availableForSubject
      }
    })
    return grouped
  }, [allLessons, availableLessons, scheduledLessons])
