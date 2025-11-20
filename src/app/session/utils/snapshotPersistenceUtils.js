/**
 * snapshotPersistenceUtils.js
 * 
 * Snapshot persistence helpers for saving and managing session state.
 * - getSnapshotStorageKey: Builds canonical storage key from lesson data/manifest/param
 * - scheduleSaveSnapshot: Debounced snapshot save with retry logic, signature deduplication, resume pointer construction
 */

/**
 * Build canonical storage key from lesson identifiers.
 * Always returns just the filename without subject prefix or .json extension.
 * This ensures snapshots are stored/retrieved with a consistent key format.
 * 
 * Examples:
 * - "generated/4th_Procrastination_beginner.json" -> "4th_Procrastination_beginner"
 * - "4th_Procrastination_beginner.json" -> "4th_Procrastination_beginner"
 * - "4th_Procrastination_beginner" -> "4th_Procrastination_beginner"
 * 
 * @param {Object} params - Parameters for key generation
 * @param {Object} params.lessonData - Lesson data object (may have .id)
 * @param {Object} params.manifestInfo - Manifest info object (may have .file)
 * @param {string} params.lessonParam - Lesson parameter string
 * @param {Object} params.override - Override object with .data, .manifest, or .param
 * @returns {string} Canonical storage key (filename without subject/extension)
 */
export function getSnapshotStorageKey({ lessonData, manifestInfo, lessonParam, override }) {
  try {
    const d = override?.data ?? lessonData;
    const m = override?.manifest ?? manifestInfo;
    const p = override?.param ?? lessonParam;
    // Priority: URL param (most reliable) > manifest file > lessonData.id (can be corrupted)
    let base = p || (m && m.file) || (d && d.id) || '';
    
    // Normalize: strip subject prefix if present (e.g., "generated/file.json" -> "file.json")
    if (base.includes('/')) {
      base = base.split('/').pop();
    }
    
    // Strip .json extension
    base = String(base).replace(/\.json$/i, '');
    
    return `${base}`;
  } catch {
    const fallback = (lessonParam || '');
    const withoutPrefix = fallback.includes('/') ? fallback.split('/').pop() : fallback;
    return withoutPrefix.replace(/\.json$/i, '');
  }
}

/**
 * Schedule debounced snapshot save with retry logic and signature-based deduplication.
 * 
 * @param {Object} params - All parameters needed for snapshot save
 * @param {string} params.label - Label for this save operation
 * @param {Object} params.refs - Object containing all needed refs
 * @param {Object} params.state - Object containing all needed state values
 * @param {Function} params.getSnapshotStorageKey - Function to get storage key
 * @param {Function} params.saveSnapshot - Function to persist snapshot
 * @param {Function} params.updateTranscriptLiveSegment - Function to update transcript
 * @param {Function} params.scheduleSaveSnapshot - Recursive reference for retries
 */
export async function scheduleSaveSnapshotCore({
  label = '',
  refs,
  state,
  getSnapshotStorageKey,
  saveSnapshot,
  updateTranscriptLiveSegment,
  scheduleSaveSnapshot,
}) {
  const {
    restoredSnapshotRef,
    snapshotSaveTimerRef,
    pendingSaveRetriesRef,
    lastSavedSigRef,
    activeQuestionBodyRef,
    captionSentencesRef,
    sessionStartRef,
  } = refs;

  const {
    phase,
    subPhase,
    teachingStage,
    currentCompIndex,
    currentExIndex,
    currentWorksheetIndex,
    testActiveIndex,
    qaAnswersUnlocked,
    jokeUsedThisGate,
    riddleUsedThisGate,
    poemUsedThisGate,
    storyUsedThisGate,
    currentCompProblem,
    currentExerciseProblem,
    testUserAnswers,
    testCorrectByIndex,
    testFinalPercent,
    showBegin,
    ticker,
    stageRepeats,
    storyTranscript,
    testCorrectCount,
    captionSentences,
    captionIndex,
    usedTestCuePhrases,
    lessonParam,
    effectiveLessonTitle,
    transcriptSessionId,
  } = state;

  // Generally do not save until restore has run at least once to avoid clobbering
  if (!restoredSnapshotRef.current && label === 'state-change') return;

  try {
    if (snapshotSaveTimerRef.current) clearTimeout(snapshotSaveTimerRef.current);
  } catch {}

  snapshotSaveTimerRef.current = setTimeout(async () => {
    try {
      // Double-guard inside timer as well
      if (!restoredSnapshotRef.current && label === 'state-change') {
        return;
      }

      const storedKey = getSnapshotStorageKey();
      if (!storedKey) {
        // If key not ready yet, retry labeled saves a few times
        if (label !== 'state-change') {
          const keyLbl = String(label || 'label');
          const map = pendingSaveRetriesRef.current || {};
          const used = Number.isFinite(map[keyLbl]) ? map[keyLbl] : 0;
          if (used < 5) {
            map[keyLbl] = used + 1;
            pendingSaveRetriesRef.current = map;
            setTimeout(() => {
              try {
                scheduleSaveSnapshot(label);
              } catch {}
            }, 400);
          } else {
          }
        } else {
        }
        return;
      }

      const lid =
        typeof window !== 'undefined' ? localStorage.getItem('learner_id') || 'none' : 'none';

      // Build a compact signature that only changes when a meaningful resume point changes
      const sigObj = {
        phase,
        subPhase,
        teachingStage,
        idx: { ci: currentCompIndex, ei: currentExIndex, wi: currentWorksheetIndex, ti: testActiveIndex },
        gates: {
          qa: !!qaAnswersUnlocked,
          jk: !!jokeUsedThisGate,
          rd: !!riddleUsedThisGate,
          pm: !!poemUsedThisGate,
          st: !!storyUsedThisGate,
        },
        cur: {
          c: currentCompProblem
            ? currentCompProblem.id ||
              currentCompProblem.key ||
              currentCompProblem.question ||
              currentCompProblem.prompt ||
              '1'
            : null,
          e: currentExerciseProblem
            ? currentExerciseProblem.id ||
              currentExerciseProblem.key ||
              currentExerciseProblem.question ||
              currentExerciseProblem.prompt ||
              '1'
            : null,
          q: (() => {
            try {
              return String(activeQuestionBodyRef.current || '').slice(0, 200);
            } catch {
              return '';
            }
          })(),
        },
        test: {
          aLen: Array.isArray(testUserAnswers) ? testUserAnswers.length : 0,
          cLen: Array.isArray(testCorrectByIndex) ? testCorrectByIndex.length : 0,
          fin: typeof testFinalPercent === 'number' ? testFinalPercent : null,
        },
      };
      const sig = JSON.stringify(sigObj);

      // Skip redundant autosaves when nothing meaningful changed; allow explicit labels to force-save
      if (label === 'state-change' && lastSavedSigRef.current === sig) {
        return;
      }

      // Build normalized resume pointer (single authoritative progress state)
      const resume = (() => {
        // Teaching stage entrance
        if (phase === 'teaching' && teachingStage && teachingStage !== 'idle') {
          return { kind: 'teaching-stage', phase: 'teaching', stage: teachingStage };
        }
        // Phase entrances
        if (
          (phase === 'comprehension' &&
            (subPhase === 'comprehension-start' || subPhase === 'comprehension-active') &&
            !qaAnswersUnlocked) ||
          (phase === 'exercise' && subPhase === 'exercise-awaiting-begin' && !qaAnswersUnlocked) ||
          (phase === 'worksheet' && subPhase === 'worksheet-active' && !qaAnswersUnlocked) ||
          (phase === 'test' &&
            (subPhase === 'test-awaiting-begin' || subPhase === 'test-active') &&
            !qaAnswersUnlocked)
        ) {
          return { kind: 'phase-entrance', phase, ticker: Number.isFinite(ticker) ? ticker : 0 };
        }
        // Question pointers (1-based index where possible)
        if (phase === 'comprehension' && (currentCompProblem || currentCompIndex > 0)) {
          const idx = Math.max(1, currentCompIndex || 1);
          return { kind: 'question', phase: 'comprehension', index: idx, ticker: Number.isFinite(ticker) ? ticker : 0 };
        }
        if (phase === 'exercise' && (currentExerciseProblem || currentExIndex > 0)) {
          const idx = Math.max(1, currentExIndex || 1);
          return { kind: 'question', phase: 'exercise', index: idx, ticker: Number.isFinite(ticker) ? ticker : 0 };
        }
        if (phase === 'worksheet' && typeof currentWorksheetIndex === 'number') {
          const idx = Math.max(1, (currentWorksheetIndex || 0) + 1);
          return { kind: 'question', phase: 'worksheet', index: idx, ticker: Number.isFinite(ticker) ? ticker : 0 };
        }
        if (phase === 'test' && typeof testActiveIndex === 'number') {
          const idx = Math.max(1, (testActiveIndex || 0) + 1);
          return { kind: 'question', phase: 'test', index: idx, ticker: Number.isFinite(ticker) ? ticker : 0 };
        }
        // Default to current phase entrance
        return { kind: 'phase-entrance', phase: phase || 'discussion', ticker: Number.isFinite(ticker) ? ticker : 0 };
      })();

      const payload = {
        phase,
        subPhase,
        showBegin,
        ticker,
        teachingStage,
        stageRepeats,
        qaAnswersUnlocked,
        jokeUsedThisGate,
        riddleUsedThisGate,
        poemUsedThisGate,
        storyUsedThisGate,
        storyTranscript,
        currentCompIndex,
        currentExIndex,
        currentWorksheetIndex,
        testActiveIndex,
        currentCompProblem,
        currentExerciseProblem,
        testUserAnswers,
        testCorrectByIndex,
        testCorrectCount,
        testFinalPercent,
        captionSentences: Array.isArray(captionSentencesRef.current)
          ? captionSentencesRef.current
          : Array.isArray(captionSentences)
            ? captionSentences
            : [],
        captionIndex,
        usedTestCuePhrases,
        resume,
      };

      if (!storedKey || String(storedKey).trim().length === 0) {
        // Save skipped - no key available yet
        return;
      }

      await saveSnapshot(storedKey, payload, { learnerId: lid });

      // Also update live transcript segment to keep facilitator PDF in sync
      try {
        const learnerId =
          (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
        const learnerName =
          (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
        const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
        if (
          learnerId &&
          lessonId &&
          Array.isArray(captionSentencesRef.current) &&
          captionSentencesRef.current.length
        ) {
          const startedAt = sessionStartRef.current || new Date().toISOString();
          await updateTranscriptLiveSegment({
            learnerId,
            learnerName,
            lessonId,
            lessonTitle: effectiveLessonTitle,
            startedAt,
            lines: captionSentencesRef.current,
            sessionId: transcriptSessionId || undefined,
          });
        }
      } catch {}

      lastSavedSigRef.current = sig;
    } catch (err) {
    }
  }, 300);
}
