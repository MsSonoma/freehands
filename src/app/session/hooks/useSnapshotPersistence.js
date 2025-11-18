import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getStoredSnapshot, saveSnapshot, consolidateSnapshots } from '../sessionSnapshotStore';
import { updateTranscriptLiveSegment } from '../../lib/transcriptsClient';

/**
 * useSnapshotPersistence
 * 
 * Manages session state persistence, restore, and resume functionality.
 * Handles automatic snapshot saving on state changes, restores snapshots on mount,
 * and reconciles resume points to ensure valid UI state.
 * 
 * @param {Object} deps - Dependencies object containing:
 *   - State values: phase, subPhase, showBegin, ticker, teachingStage, stageRepeats,
 *     qaAnswersUnlocked, storyState, storySetupStep, storyCharacters, storySetting,
 *     storyPlot, storyPhase, storyTranscript, currentCompIndex, currentExIndex,
 *     currentWorksheetIndex, testActiveIndex, currentCompProblem, currentExerciseProblem,
 *     testUserAnswers, testCorrectByIndex, testCorrectCount, testFinalPercent,
 *     congratsStarted, congratsDone, captionSentences, captionIndex, usedTestCuePhrases, 
 *     generatedWorksheet, generatedTest, currentTimerMode, workPhaseCompletions
 *   - State setters: setPhase, setSubPhase, setShowBegin, setTicker, setTeachingStage,
 *     setStageRepeats, setQaAnswersUnlocked, setStoryState, setStorySetupStep,
 *     setStoryCharacters, setStorySetting, setStoryPlot, setStoryPhase,
 *     setStoryTranscript, setCurrentCompIndex,
 *     setCurrentExIndex, setCurrentWorksheetIndex, setTestActiveIndex, setCurrentCompProblem,
 *     setCurrentExerciseProblem, setTestUserAnswers, setTestCorrectByIndex, setTestCorrectCount,
 *     setTestFinalPercent, setCongratsStarted, setCongratsDone, setCaptionSentences, 
 *     setCaptionIndex, setUsedTestCuePhrases, setLoading, setOfferResume, setCanSend, 
 *     setShowOpeningActions, setTtsLoadingCount, setIsSpeaking, setCurrentTimerMode, setWorkPhaseCompletions
 *   - Refs: restoredSnapshotRef, restoreFoundRef, didRunRestoreRef, snapshotSaveTimerRef,
 *     pendingSaveRetriesRef, lastSavedSigRef, activeQuestionBodyRef, captionSentencesRef,
 *     worksheetIndexRef, sessionStartRef, preferHtmlAudioOnceRef, resumeAppliedRef
 *   - Functions: getSnapshotStorageKey
 *   - Data: lessonParam, lessonData, manifestInfo, effectiveLessonTitle, transcriptSessionId,
 *     WORKSHEET_TARGET, TEST_TARGET
 * @returns {Object} { scheduleSaveSnapshot, snapshotSigMemo }
 */
export function useSnapshotPersistence({
  // State values
  phase,
  subPhase,
  showBegin,
  ticker,
  teachingStage,
  stageRepeats,
  qaAnswersUnlocked,
  storyState,
  storySetupStep,
  storyCharacters,
  storySetting,
  storyPlot,
  storyPhase,
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
  congratsStarted,
  congratsDone,
  captionSentences,
  captionIndex,
  usedTestCuePhrases,
  generatedComprehension,
  generatedExercise,
  generatedWorksheet,
  generatedTest,
  currentTimerMode,
  workPhaseCompletions,
  // State setters
  setPhase,
  setSubPhase,
  setShowBegin,
  setTicker,
  setTeachingStage,
  setStageRepeats,
  setQaAnswersUnlocked,
  setStoryState,
  setStorySetupStep,
  setStoryCharacters,
  setStorySetting,
  setStoryPlot,
  setStoryPhase,
  setStoryTranscript,
  setCurrentCompIndex,
  setCurrentExIndex,
  setCurrentWorksheetIndex,
  setTestActiveIndex,
  setCurrentCompProblem,
  setCurrentExerciseProblem,
  setTestUserAnswers,
  setTestCorrectByIndex,
  setTestCorrectCount,
  setTestFinalPercent,
  setCongratsStarted,
  setCongratsDone,
  setCaptionSentences,
  setCaptionIndex,
  setUsedTestCuePhrases,
  setGeneratedComprehension,
  setGeneratedExercise,
  setLoading,
  setOfferResume,
  setCanSend,
  setShowOpeningActions,
  setTtsLoadingCount,
  setIsSpeaking,
  setCurrentTimerMode,
  setWorkPhaseCompletions,
  // Refs
  restoredSnapshotRef,
  restoreFoundRef,
  didRunRestoreRef,
  snapshotSaveTimerRef,
  pendingSaveRetriesRef,
  lastSavedSigRef,
  activeQuestionBodyRef,
  captionSentencesRef,
  worksheetIndexRef,
  sessionStartRef,
  preferHtmlAudioOnceRef,
  resumeAppliedRef,
  // Functions
  getSnapshotStorageKey,
  // Data
  lessonParam,
  lessonData,
  manifestInfo,
  effectiveLessonTitle,
  transcriptSessionId,
  WORKSHEET_TARGET,
  TEST_TARGET,
}) {
  const buildStorySignature = useCallback(() => {
    const list = Array.isArray(storyTranscript) ? storyTranscript : [];
    const len = list.length;
    const rawLast = len ? list[len - 1] : null;
    let lastRole = null;
    let lastText = null;
    if (rawLast) {
      if (typeof rawLast === 'string') {
        lastRole = 'assistant';
        lastText = rawLast.slice(0, 120);
      } else if (typeof rawLast === 'object') {
        lastRole = rawLast.role === 'user' ? 'user' : 'assistant';
        if (typeof rawLast.text === 'string') {
          lastText = rawLast.text.slice(0, 120);
        }
      }
    }
    return {
      state: storyState || 'inactive',
      step: storySetupStep || '',
      chars: storyCharacters || '',
      setting: storySetting || '',
      plot: storyPlot || '',
      phase: storyPhase || '',
      len,
      lastRole,
      lastText,
    };
  }, [storyTranscript, storyState, storySetupStep, storyCharacters, storySetting, storyPlot, storyPhase]);

  const scheduleSaveSnapshot = useCallback((label = '') => {
    // Generally do not save until restore has run at least once to avoid clobbering, except for explicit user-driven labels
    if (!restoredSnapshotRef.current && label === 'state-change') return;
    
    // For critical phase transitions, save IMMEDIATELY without debounce to avoid race conditions
    const immediateLabels = ['begin-comprehension', 'begin-exercise', 'begin-worksheet', 'begin-test', 'exercise-complete', 'worksheet-complete', 'test-complete'];
    const shouldSaveImmediately = immediateLabels.includes(label);
    
    try { if (snapshotSaveTimerRef.current) clearTimeout(snapshotSaveTimerRef.current); } catch {}
    
    const performSave = async () => {
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
              setTimeout(() => { try { scheduleSaveSnapshot(label); } catch {} }, 400);
            } else {
              // Retry limit reached - give up
            }
          } else {
            // Save skipped - no key yet
          }
          return;
        }
        const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
        // Build a compact signature that only changes when a meaningful resume point changes
        const storySig = buildStorySignature();
        const sigObj = {
          phase, subPhase,
          teachingStage,
          idx: { ci: currentCompIndex, ei: currentExIndex, wi: currentWorksheetIndex, ti: testActiveIndex },
          gates: { qa: !!qaAnswersUnlocked },
          cur: {
            c: currentCompProblem ? (currentCompProblem.id || currentCompProblem.key || currentCompProblem.question || currentCompProblem.prompt || '1') : null,
            e: currentExerciseProblem ? (currentExerciseProblem.id || currentExerciseProblem.key || currentExerciseProblem.question || currentExerciseProblem.prompt || '1') : null,
            q: (() => { try { return String(activeQuestionBodyRef.current || '').slice(0, 200); } catch { return ''; } })(),
          },
          test: {
            aLen: Array.isArray(testUserAnswers) ? testUserAnswers.length : 0,
            cLen: Array.isArray(testCorrectByIndex) ? testCorrectByIndex.length : 0,
            fin: (typeof testFinalPercent === 'number' ? testFinalPercent : null),
          },
          story: storySig,
        };
        const sig = JSON.stringify(sigObj);
        // Skip redundant autosaves when nothing meaningful changed; allow explicit labels to force-save (e.g., restart/skip/jump)
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
            (phase === 'comprehension' && (subPhase === 'comprehension-start' || subPhase === 'comprehension-active') && !qaAnswersUnlocked) ||
            (phase === 'exercise' && subPhase === 'exercise-awaiting-begin' && !qaAnswersUnlocked) ||
            (phase === 'worksheet' && subPhase === 'worksheet-active' && !qaAnswersUnlocked) ||
            (phase === 'test' && (subPhase === 'test-awaiting-begin' || subPhase === 'test-active') && !qaAnswersUnlocked)
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
          phase, subPhase, showBegin,
          // ticker excluded from signature to avoid periodic noise; we still persist it opportunistically
          ticker,
          teachingStage,
          stageRepeats,
          qaAnswersUnlocked,
          storyState,
          storySetupStep,
          storyCharacters,
          storySetting,
          storyPlot,
          storyPhase,
          storyTranscript,
          currentCompIndex, currentExIndex, currentWorksheetIndex,
          testActiveIndex,
          currentCompProblem, currentExerciseProblem,
          testUserAnswers, testCorrectByIndex, testCorrectCount, testFinalPercent,
          congratsStarted, congratsDone,
          captionSentences: Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : (Array.isArray(captionSentences) ? captionSentences : []),
          captionIndex,
          usedTestCuePhrases,
          generatedComprehension,
          generatedExercise,
          currentTimerMode,
          workPhaseCompletions,
          // Preserve timer states from sessionStorage
          timerStates: (() => {
            try {
              const timerStates = {};
              // Get all sessionStorage keys that match timer state pattern
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith('session_timer_state:')) {
                  const value = sessionStorage.getItem(key);
                  if (value) {
                    timerStates[key] = JSON.parse(value);
                  }
                }
              }
              return timerStates;
            } catch {
              return {};
            }
          })(),
          resume,
        };
        if (!storedKey || String(storedKey).trim().length === 0) {
          return;
        }
        console.log(`[SNAPSHOT SAVE] Key: ${storedKey}, Phase: ${phase}, SubPhase: ${subPhase}, CompIdx: ${currentCompIndex}, ExIdx: ${currentExIndex}, Label: ${label}`);
        await saveSnapshot(storedKey, payload, { learnerId: lid });

        // Also update live transcript segment to keep facilitator PDF in sync with the on-screen transcript
        try {
          const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
          const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
          const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
          if (learnerId && lessonId && Array.isArray(captionSentencesRef.current) && captionSentencesRef.current.length) {
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
      } catch {}
    };
    
    // Execute save immediately for phase transitions, or debounced for regular state changes
    if (shouldSaveImmediately) {
      performSave();
    } else {
      snapshotSaveTimerRef.current = setTimeout(performSave, 200);
    }
  }, [phase, subPhase, showBegin, teachingStage, qaAnswersUnlocked, storyState, storySetupStep, storyCharacters, storySetting, storyPlot, storyPhase, storyTranscript, currentCompIndex, currentExIndex, currentWorksheetIndex, testActiveIndex, currentCompProblem, currentExerciseProblem, testUserAnswers, testCorrectByIndex, testCorrectCount, testFinalPercent, congratsStarted, congratsDone, usedTestCuePhrases, currentTimerMode, workPhaseCompletions, getSnapshotStorageKey, lessonParam, effectiveLessonTitle, transcriptSessionId, restoredSnapshotRef, snapshotSaveTimerRef, pendingSaveRetriesRef, lastSavedSigRef, activeQuestionBodyRef, captionSentencesRef, captionSentences, captionIndex, ticker, sessionStartRef, buildStorySignature]);

  // Memoized signature of meaningful resume-relevant state. Changes here will cause an autosave.
  const snapshotSigMemo = useMemo(() => {
    const storySig = buildStorySignature();
    const sigObj = {
      phase, subPhase,
      teachingStage,
      idx: { ci: currentCompIndex, ei: currentExIndex, wi: currentWorksheetIndex, ti: testActiveIndex },
      gates: { qa: !!qaAnswersUnlocked },
      cur: {
        c: currentCompProblem ? (currentCompProblem.id || currentCompProblem.key || currentCompProblem.question || currentCompProblem.prompt || '1') : null,
        e: currentExerciseProblem ? (currentExerciseProblem.id || currentExerciseProblem.key || currentExerciseProblem.question || currentExerciseProblem.prompt || '1') : null,
        q: (() => { try { return String(activeQuestionBodyRef.current || '').slice(0, 200); } catch { return ''; } })(),
      },
      test: {
        aLen: Array.isArray(testUserAnswers) ? testUserAnswers.length : 0,
        cLen: Array.isArray(testCorrectByIndex) ? testCorrectByIndex.length : 0,
        fin: (typeof testFinalPercent === 'number' ? testFinalPercent : null),
      },
      story: storySig,
    };
    try { return JSON.stringify(sigObj); } catch { return '' }
  }, [phase, subPhase, teachingStage, currentCompIndex, currentExIndex, currentWorksheetIndex, testActiveIndex, qaAnswersUnlocked, currentCompProblem, currentExerciseProblem, testUserAnswers, testCorrectByIndex, testFinalPercent, activeQuestionBodyRef, buildStorySignature]);

  // Save on ticker change to support resume at each count increment (coalesced with timer)
  useEffect(() => {
    if (!restoredSnapshotRef.current) return;
    try { scheduleSaveSnapshot('ticker-change'); } catch {}
  }, [ticker, restoredSnapshotRef, scheduleSaveSnapshot]);

  // Restore snapshot as early as possible (run once when a stable key can be derived)
  useEffect(() => {
    if (didRunRestoreRef.current || restoredSnapshotRef.current) {
      return;
    }

    // Wait for lessonData.id before attempting restore - this is the most reliable key
    if (!lessonData?.id) {
      return;
    }

    // Mark as attempted IMMEDIATELY now that we have all required data
    didRunRestoreRef.current = true;

    const doRestore = async () => {
      // Ensure the overlay shows while we resolve snapshot and reconcile resume
      try { setLoading(true); } catch {}
      try {
        const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
        // Try multiple candidate keys in case different sources are available at different times
        const candidates = [];
        try { const k = getSnapshotStorageKey(); if (k) candidates.push(k); } catch {}
        try { const k = getSnapshotStorageKey({ param: lessonParam }); if (k && !candidates.includes(k)) candidates.push(k); } catch {}
        try { const k = getSnapshotStorageKey({ manifest: manifestInfo }); if (k && !candidates.includes(k)) candidates.push(k); } catch {}
        try { if (lessonData?.id) { const k = getSnapshotStorageKey({ data: lessonData }); if (k && !candidates.includes(k)) candidates.push(k); } } catch {}

        // Only proceed when we have at least one non-empty key; otherwise, postpone restore
        const keys = candidates.filter((k) => typeof k === 'string' && k.trim().length > 0);
        if (keys.length === 0) {
          return; // do not mark didRunRestore/restored flags so we can try again when deps update
        }

        // Collect all available snapshots among candidates and legacy variants, then pick the newest by savedAt
        let snap = null;
        let newestAt = 0;
        const consider = async (keyLike, note = '') => {
          try {
            const s = await getStoredSnapshot(keyLike, { learnerId: lid });
            if (s) {
              const t = Date.parse(s.savedAt || '') || 0;
              console.log(`[SNAPSHOT RESTORE CANDIDATE] Key: ${keyLike}, Note: ${note}, SavedAt: ${new Date(t).toISOString()}, Phase: ${s.phase}, SubPhase: ${s.subPhase}, CompIdx: ${s.currentCompIndex}, ExIdx: ${s.currentExIndex}`);
              if (t >= newestAt) { snap = s; newestAt = t; }
            }
          } catch { /* ignore */ }
        };
        for (const c of keys) {
          // canonical key
          await consider(c, 'canonical');
          // extension variant (.json)
          await consider(`${c}.json`, 'ext-variant');
          // Remote legacy variants: append known target suffixes as previously used in assessments keying
          const variants = [
            `${c}:W15:T10`, `${c}:W20:T20`, `${c}:W${Number(WORKSHEET_TARGET) || 15}:T${Number(TEST_TARGET) || 10}`
          ];
          for (const v of variants) {
            await consider(v, 'legacy');
            await consider(`${v}.json`, 'legacy-ext');
          }
        }
        // If we didn't find a snapshot yet, decide whether to postpone based on source readiness
        const sourcesReady = Boolean(lessonParam) && (Boolean(manifestInfo?.file) || Boolean(lessonData?.id));
        if (!snap) {
          if (!sourcesReady) {
            // Postpone finalize; dependencies will change when manifest/data load, allowing another attempt
            // Reset the flag so we can retry when dependencies change
            didRunRestoreRef.current = false;
            // Do NOT set loading=false or restoredSnapshotRef=true here; we'll retry
            return;
          }
          // No snapshot and sources are ready: finalize restore as not-found so saving can begin
          restoreFoundRef.current = false;
          restoredSnapshotRef.current = true; // Mark as restored so autosaving can begin
          try { setOfferResume(false); } catch {}
          // Hide loading immediately in no-snapshot case so UI becomes interactive
          try { setLoading(false); } catch {}
          return;
        }
        // Found a snapshot: apply it
        console.log(`[SNAPSHOT RESTORE SELECTED] Phase: ${snap.phase}, SubPhase: ${snap.subPhase}, CompIdx: ${snap.currentCompIndex}, ExIdx: ${snap.currentExIndex}, SavedAt: ${snap.savedAt}`);
        // Apply core flow state first
        try { setPhase(snap.phase || 'discussion'); } catch {}
        try { setSubPhase(snap.subPhase || 'greeting'); } catch {}
        // Never show the global Begin overlay outside the Discussion phase
        try {
          const sb = !!snap.showBegin;
          if ((snap.phase || 'discussion') !== 'discussion' && sb) {
            setShowBegin(false);
          } else {
            setShowBegin(sb);
          }
        } catch {}
        try { setTicker(Number.isFinite(snap.ticker) ? snap.ticker : 0); } catch {}
        // Gates and flags
        try { setQaAnswersUnlocked(!!snap.qaAnswersUnlocked); } catch {}
        // Game usage gates removed - games are now repeatable
  try { setStoryState(typeof snap.storyState === 'string' ? snap.storyState : 'inactive'); } catch {}
  try { setStorySetupStep(typeof snap.storySetupStep === 'string' ? snap.storySetupStep : ''); } catch {}
  try { setStoryCharacters(typeof snap.storyCharacters === 'string' ? snap.storyCharacters : ''); } catch {}
  try { setStorySetting(typeof snap.storySetting === 'string' ? snap.storySetting : ''); } catch {}
  try { setStoryPlot(typeof snap.storyPlot === 'string' ? snap.storyPlot : ''); } catch {}
  try { setStoryPhase(typeof snap.storyPhase === 'string' ? snap.storyPhase : ''); } catch {}
        try { setStoryTranscript(Array.isArray(snap.storyTranscript) ? snap.storyTranscript : []); } catch {}
        // Three-stage teaching state
        try { if (typeof snap.teachingStage === 'string') setTeachingStage(snap.teachingStage); } catch {}
        try { if (snap.stageRepeats && typeof snap.stageRepeats === 'object') setStageRepeats({ definitions: Number.isFinite(snap.stageRepeats.definitions) ? snap.stageRepeats.definitions : 0, explanation: Number.isFinite(snap.stageRepeats.explanation) ? snap.stageRepeats.explanation : 0, examples: Number.isFinite(snap.stageRepeats.examples) ? snap.stageRepeats.examples : 0 }); } catch {}
        // Indices and pointers
        try { setCurrentCompIndex(Number.isFinite(snap.currentCompIndex) ? snap.currentCompIndex : 0); } catch {}
        try { setCurrentExIndex(Number.isFinite(snap.currentExIndex) ? snap.currentExIndex : 0); } catch {}
        try {
          const wi = Number.isFinite(snap.currentWorksheetIndex) ? snap.currentWorksheetIndex : 0;
          worksheetIndexRef.current = wi; setCurrentWorksheetIndex(wi);
        } catch {}
        try { setTestActiveIndex(Number.isFinite(snap.testActiveIndex) ? snap.testActiveIndex : 0); } catch {}
        try { setCurrentCompProblem(snap.currentCompProblem || null); } catch {}
        try { setCurrentExerciseProblem(snap.currentExerciseProblem || null); } catch {}
        // Generated question arrays
        try { Array.isArray(snap.generatedComprehension) && setGeneratedComprehension(snap.generatedComprehension); } catch {}
        try { Array.isArray(snap.generatedExercise) && setGeneratedExercise(snap.generatedExercise); } catch {}
        // Test arrays
        try { Array.isArray(snap.testUserAnswers) && setTestUserAnswers(snap.testUserAnswers); } catch {}
        try { Array.isArray(snap.testCorrectByIndex) && setTestCorrectByIndex(snap.testCorrectByIndex); } catch {}
        try { typeof snap.testCorrectCount === 'number' && setTestCorrectCount(snap.testCorrectCount); } catch {}
        try { (typeof snap.testFinalPercent === 'number' || snap.testFinalPercent === null) && setTestFinalPercent(snap.testFinalPercent); } catch {}
        try { Array.isArray(snap.usedTestCuePhrases) && setUsedTestCuePhrases(snap.usedTestCuePhrases); } catch {}
        // Congrats state restoration - ensures Complete Lesson button persists on refresh
        // CRITICAL FALLBACK: If we're restoring a congrats phase snapshot from before this fix was deployed,
        // the snapshot won't have congratsStarted/congratsDone. In that case, auto-set them so the
        // Complete Lesson button appears and users aren't stuck.
        try {
          if (snap.phase === 'congrats') {
            // If old snapshot without these fields, default them to true so button shows
            const started = (snap.congratsStarted !== undefined) ? !!snap.congratsStarted : true;
            const done = (snap.congratsDone !== undefined) ? !!snap.congratsDone : true;
            setCongratsStarted(started);
            setCongratsDone(done);
          } else {
            setCongratsStarted(!!snap.congratsStarted);
            setCongratsDone(!!snap.congratsDone);
          }
        } catch {}
        // Captions/transcript
        try {
          const lines = Array.isArray(snap.captionSentences) ? snap.captionSentences : [];
          captionSentencesRef.current = lines;
          setCaptionSentences(lines.slice());
          const ci = Number.isFinite(snap.captionIndex) ? snap.captionIndex : 0;
          setCaptionIndex(Math.max(0, Math.min(ci, Math.max(0, lines.length - 1))));
        } catch {}
        
        // Phase timer state restoration
        try {
          if (snap.currentTimerMode && typeof snap.currentTimerMode === 'object' && Object.keys(snap.currentTimerMode).length > 0) {
            console.log('[SNAPSHOT RESTORE] Restoring timer modes:', snap.currentTimerMode);
            setCurrentTimerMode(snap.currentTimerMode);
          } else {
            console.log(`[SNAPSHOT RESTORE] ERROR: No timer modes in snapshot! This indicates timers were not properly initialized during normal operation. Phase: ${snap.phase}, SubPhase: ${snap.subPhase}`);
            // Don't set any fallback - this should not happen if timers are working correctly
          }
        } catch {}
        try {
          if (snap.workPhaseCompletions && typeof snap.workPhaseCompletions === 'object') {
            setWorkPhaseCompletions(snap.workPhaseCompletions);
          }
        } catch {}
        
        // Restore timer states to sessionStorage
        try {
          if (snap.timerStates && typeof snap.timerStates === 'object') {
            console.log('[SNAPSHOT RESTORE] Restoring timer states:', snap.timerStates);
            Object.entries(snap.timerStates).forEach(([key, value]) => {
              if (key.startsWith('session_timer_state:') && value) {
                sessionStorage.setItem(key, JSON.stringify(value));
              }
            });
          }
        } catch (err) {
          console.warn('[SNAPSHOT RESTORE] Failed to restore timer states:', err);
        }
        
        // Defer clearing loading until the resume reconciliation effect completes
        try { setTtsLoadingCount(0); } catch {}
        try { setIsSpeaking(false); } catch {}
        try {
          // Minimal canSend heuristics on restore: enable only when in awaiting-begin or review or teaching stage prompts
          const enable = (
            (snap.phase === 'discussion' && snap.subPhase === 'awaiting-learner') ||
            (snap.phase === 'comprehension' && snap.subPhase === 'comprehension-start') ||
            (snap.phase === 'exercise' && snap.subPhase === 'exercise-awaiting-begin') ||
            (snap.phase === 'worksheet' && snap.subPhase === 'worksheet-awaiting-begin') ||
            (snap.phase === 'test' && (snap.subPhase === 'test-awaiting-begin' || snap.subPhase === 'review-start')) ||
            (snap.phase === 'teaching' && snap.subPhase === 'teaching-3stage')
          );
          setCanSend(!!enable);
        } catch {}
        try {
          // Do not surface Resume/Restart when the snapshot is effectively the global beginning
          const atGlobalStart = ((snap.phase || 'discussion') === 'discussion') && !!snap.showBegin;
          setOfferResume(!atGlobalStart);
        } catch {}
        // Mark as restored NOW that we've successfully applied the snapshot
        restoreFoundRef.current = true;
        restoredSnapshotRef.current = true;
      } catch (err) {
        // On error, mark as restored so we don't keep retrying and can start saving
        restoredSnapshotRef.current = true;
        restoreFoundRef.current = false;
        try { setOfferResume(false); } catch {}
        try { setLoading(false); } catch {}
      } finally {
        // After first restore attempt, consolidate legacy keys in the background
        try {
          const k = getSnapshotStorageKey();
          const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
          if (k) consolidateSnapshots(k, { learnerId: lid });
        } catch {}
        // Safety: if reconciliation does not trigger a render (e.g., snapshot matches current defaults),
        // clear the loading overlay now so the screen becomes interactive.
        try { setLoading(false); } catch {}
      }
    };
    doRestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Only depend on inputs that determine IF/WHEN to restore, not the outputs we're setting
    lessonParam,
    manifestInfo?.file,
    lessonData?.id,
    WORKSHEET_TARGET,
    TEST_TARGET,
    // Refs and functions are stable
    didRunRestoreRef,
    restoredSnapshotRef,
    restoreFoundRef,
    captionSentencesRef,
    worksheetIndexRef,
    getSnapshotStorageKey,
    // Setters are stable from useState
    setLoading,
    setPhase,
    setSubPhase,
    setShowBegin,
    setTicker,
    setQaAnswersUnlocked,
  setStoryState,
  setStorySetupStep,
  setStoryCharacters,
  setStorySetting,
  setStoryPlot,
  setStoryPhase,
    setStoryTranscript,
    setTeachingStage,
    setStageRepeats,
    setCurrentCompIndex,
    setCurrentExIndex,
    setCurrentWorksheetIndex,
    setTestActiveIndex,
    setCurrentCompProblem,
    setCurrentExerciseProblem,
    setGeneratedComprehension,
    setGeneratedExercise,
    setTestUserAnswers,
    setTestCorrectByIndex,
    setTestCorrectCount,
    setTestFinalPercent,
    setUsedTestCuePhrases,
    setCaptionSentences,
    setCaptionIndex,
    setTtsLoadingCount,
    setIsSpeaking,
    setCanSend,
    setOfferResume,
  ]);

  // Save snapshot when the meaningful signature changes; coalescing occurs inside scheduleSaveSnapshot
  useEffect(() => {
    if (!restoredSnapshotRef.current) return; // skip initial mount before restore
    scheduleSaveSnapshot('state-change');
    return () => { try { if (snapshotSaveTimerRef.current) clearTimeout(snapshotSaveTimerRef.current); } catch {} };
  }, [snapshotSigMemo, scheduleSaveSnapshot, restoredSnapshotRef, snapshotSaveTimerRef]);

  // After a restore, once assessments are ready, ensure we land on a valid resume point
  useEffect(() => {
    if (!restoredSnapshotRef.current || resumeAppliedRef.current === true) return;
    // We only take action when we actually restored something earlier
    if (!restoreFoundRef.current) { resumeAppliedRef.current = true; return; }

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const ensureComprehension = () => {
      if (subPhase === 'comprehension-active') {
        // Treat active + locked answers as the phase entrance (after Begin, before Go)
        if (!qaAnswersUnlocked) {
          try { setShowOpeningActions(true); } catch {}
          try { setCanSend(true); } catch {}
          // Ensure the global Begin overlay stays hidden when resuming at an entrance
          try { setShowBegin(false); } catch {}
        } else if (!currentCompProblem) {
          // If answers are unlocked but no current problem, fall back to opening
          try { setSubPhase('comprehension-start'); } catch {}
        }
      } else if (subPhase !== 'comprehension-start') {
        // Any other subPhase goes to opening resume point
        try { setSubPhase('comprehension-start'); } catch {}
      }
    };
    const ensureExercise = () => {
      if (subPhase === 'exercise-start') {
        // Phase entrance when answers are still locked
        if (!qaAnswersUnlocked) {
          try { setShowOpeningActions(true); } catch {}
          try { setCanSend(true); } catch {}
          try { setShowBegin(false); } catch {}
        } else if (!currentExerciseProblem) {
          try { setSubPhase('exercise-awaiting-begin'); } catch {}
        }
      } else if (subPhase !== 'exercise-awaiting-begin') {
        try { setSubPhase('exercise-awaiting-begin'); } catch {}
      }
    };
    const ensureWorksheet = () => {
      if (Array.isArray(generatedWorksheet) && generatedWorksheet.length > 0) {
        const i = clamp(Number(currentWorksheetIndex) || 0, 0, Math.max(0, generatedWorksheet.length - 1));
        try { setCurrentWorksheetIndex(i); } catch {}
        if (subPhase === 'worksheet-active') {
          if (!qaAnswersUnlocked) {
            try { setShowOpeningActions(true); } catch {}
            try { setCanSend(true); } catch {}
            try { setShowBegin(false); } catch {}
          }
        } else if (subPhase !== 'worksheet-active' && subPhase !== 'worksheet-awaiting-begin') {
          try { setSubPhase('worksheet-awaiting-begin'); } catch {}
        }
      } else {
        // No worksheet yet; ensure opening screen so we don't sit in an impossible active state
        try { setSubPhase('worksheet-awaiting-begin'); } catch {}
      }
    };
    const ensureTest = () => {
      const list = Array.isArray(generatedTest) ? generatedTest : [];
      const limit = list.length
        ? Math.min((typeof TEST_TARGET === 'number' && TEST_TARGET > 0) ? TEST_TARGET : list.length, list.length)
        : 0;
      const answeredCount = Array.isArray(testUserAnswers)
        ? testUserAnswers.filter((v) => typeof v === 'string' && v.trim().length > 0).length
        : 0;
      const judgedCount = Array.isArray(testCorrectByIndex)
        ? testCorrectByIndex.filter((v) => typeof v === 'boolean').length
        : 0;
      const hasScore = typeof testFinalPercent === 'number' && Number.isFinite(testFinalPercent);
      const hasReviewProgress = answeredCount > 0 || judgedCount > 0 || hasScore;

      if (typeof subPhase === 'string' && subPhase.startsWith('review')) {
        if (!hasReviewProgress) {
          const fallbackIdx = clamp(Number(testActiveIndex) || 0, 0, Math.max(0, limit - 1));
          if (limit > 0) {
            try { setTestActiveIndex(fallbackIdx); } catch {}
          } else {
            try { setTestActiveIndex(0); } catch {}
          }
          try {
            setTestCorrectByIndex((prev) => {
              if (!Array.isArray(prev)) return prev;
              if (prev.every((item) => typeof item === 'undefined')) return prev;
              return prev.map(() => undefined);
            });
          } catch {}
          try { setTestCorrectCount(0); } catch {}
          try { setTestFinalPercent(null); } catch {}
          if (Array.isArray(testUserAnswers)) {
            try {
              setTestUserAnswers((prev) => {
                if (!Array.isArray(prev)) return prev;
                return prev.map(() => '');
              });
            } catch {}
          }
          if (!qaAnswersUnlocked) {
            try { setShowOpeningActions(true); } catch {}
            try { setCanSend(false); } catch {}
            try { setShowBegin(false); } catch {}
          }
          try { setSubPhase(limit > 0 ? 'test-active' : 'test-awaiting-begin'); } catch {}
        }
        return;
      }

      if (list.length > 0) {
        const i = clamp(Number(testActiveIndex) || 0, 0, Math.max(0, list.length - 1));
        try { setTestActiveIndex(i); } catch {}
        if (subPhase === 'test-active') {
          if (!qaAnswersUnlocked) {
            try { setShowOpeningActions(true); } catch {}
            try { setCanSend(true); } catch {}
            try { setShowBegin(false); } catch {}
          }
        } else if (subPhase !== 'test-active' && subPhase !== 'test-awaiting-begin') {
          try { setSubPhase('test-awaiting-begin'); } catch {}
        }
      } else {
        try { setSubPhase('test-awaiting-begin'); } catch {}
      }
    };

    try {
      switch (phase) {
        case 'comprehension':
          ensureComprehension();
          break;
        case 'exercise':
          ensureExercise();
          break;
        case 'worksheet':
          ensureWorksheet();
          break;
        case 'test':
          ensureTest();
          break;
        case 'teaching':
          // Teaching: after a refresh, reconcile to the stage entry point but do not auto-play.
          // We'll surface the Resume tray; the facilitator/learner will click Resume to begin audio.
          if (subPhase !== 'teaching-3stage') {
            try { setSubPhase('teaching-3stage'); } catch {}
          }
          try { setCanSend(false); } catch {}
          try { preferHtmlAudioOnceRef.current = true; } catch {}
          // Ensure the footer shows Resume/Restart controls unless we are at the global beginning
          try {
            const atGlobalStart = (phase === 'discussion') && showBegin === true;
            setOfferResume(!atGlobalStart);
          } catch {}
          break;
        default:
          break;
      }
    } finally {
      // Mark as applied so we don't loop
      resumeAppliedRef.current = true;
      // Now that resume state is reconciled, hide the initial loading overlay
      try { setLoading(false); } catch {}
    }
  }, [phase, subPhase, currentCompProblem, currentExerciseProblem, currentWorksheetIndex, testActiveIndex, generatedWorksheet, generatedTest, qaAnswersUnlocked, showBegin, testUserAnswers, testCorrectByIndex, testFinalPercent, TEST_TARGET, restoredSnapshotRef, resumeAppliedRef, restoreFoundRef, setShowOpeningActions, setCanSend, setShowBegin, setSubPhase, setCurrentWorksheetIndex, setTestActiveIndex, setTestCorrectByIndex, setTestCorrectCount, setTestFinalPercent, setTestUserAnswers, preferHtmlAudioOnceRef, setOfferResume, setLoading]);

  return {
    scheduleSaveSnapshot,
    snapshotSigMemo,
  };
}
