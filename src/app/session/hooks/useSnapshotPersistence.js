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
 *   - Synchronous refs: currentTimerModeRef, workPhaseCompletionsRef (optional, for pre-render updates)
 *   - State setters: setPhase, setSubPhase, setShowBegin, setTicker, setTeachingStage,
 *     setStageRepeats, setQaAnswersUnlocked, setStoryState, setStorySetupStep,
 *     setStoryCharacters, setStorySetting, setStoryPlot, setStoryPhase,
 *     setStoryTranscript, setCurrentCompIndex,
 *     setCurrentExIndex, setCurrentWorksheetIndex, setTestActiveIndex, setCurrentCompProblem,
 *     setCurrentExerciseProblem, setTestUserAnswers, setTestCorrectByIndex, setTestCorrectCount,
 *     setTestFinalPercent, setCongratsStarted, setCongratsDone, setCaptionSentences, 
 *     setCaptionIndex, setUsedTestCuePhrases, setLoading, setOfferResume, setCanSend, 
 *     setShowOpeningActions, setTtsLoadingCount, setIsSpeaking, setCurrentTimerMode, setWorkPhaseCompletions,
 *     setGeneratedWorksheet, setGeneratedTest
 *   - Teaching flow helpers: getTeachingFlowSnapshot, applyTeachingFlowSnapshot
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
  currentTimerModeRef,
  workPhaseCompletions,
  workPhaseCompletionsRef,
    getTeachingFlowSnapshot,
    applyTeachingFlowSnapshot,
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
  setGeneratedWorksheet,
  setGeneratedTest,
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
  speakFrontend,
  getSnapshotStorageKey,
  // Data
  lessonParam,
  lessonData,
  manifestInfo,
  effectiveLessonTitle,
  transcriptSessionId,
  WORKSHEET_TARGET,
  TEST_TARGET,
  lessonKey,
  getCurrentPhaseTimerDuration,
  // Session tracking
  browserSessionId,
  onSessionConflict,
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

  const lastRestoreTimeRef = useRef(0);

  const scheduleSaveSnapshot = useCallback(async (label = '') => {
    // ATOMIC SNAPSHOT: Save exactly what we have right now, no signature checking, no reconciliation
    // Only save after restore has run to avoid clobbering on mount
    if (!restoredSnapshotRef.current) {
      return;
    }
    
    // CRITICAL: Don't save snapshots when lesson is complete (congrats phase OR test phase with final results)
    // No point resuming a completed lesson - it just loads to "Complete Lesson" button again
    if (phase === 'congrats') {
      console.log('[SNAPSHOT SAVE] Skipping save - lesson complete (congrats phase)');
      return;
    }
    
    // Also skip if we're in test phase and showing final results (testFinalPercent is set)
    if (phase === 'test' && testFinalPercent != null) {
      console.log('[SNAPSHOT SAVE] Skipping save - test complete, showing final results');
      return;
    }
    
    try {
      const storedKey = getSnapshotStorageKey();
      if (!storedKey || String(storedKey).trim().length === 0) {
        return;
      }
      
      const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
      const timerModeSnapshot = currentTimerModeRef?.current ?? currentTimerMode ?? {};
      const workPhaseSnapshot = workPhaseCompletionsRef?.current ?? workPhaseCompletions ?? {};
      
      const teachingFlowState = typeof getTeachingFlowSnapshot === 'function'
        ? (() => {
          try { return getTeachingFlowSnapshot(); } catch { return null; }
        })()
        : null;

      const resolveTimerPhase = () => {
        if (phase === 'discussion' || phase === 'teaching') return 'discussion';
        if (phase === 'comprehension') return 'comprehension';
        if (phase === 'exercise') return 'exercise';
        if (phase === 'worksheet') return 'worksheet';
        if (phase === 'test') return 'test';
        return null;
      };

      const timerSnapshot = (() => {
        try {
          if (typeof window === 'undefined') return null;
          const activePhase = resolveTimerPhase();
          if (!activePhase) return null;
          const modeMap = currentTimerModeRef?.current || currentTimerMode || {};
          const activeMode = modeMap[activePhase];
          if (!activeMode) return null;
          const key = lessonKey
            ? `session_timer_state:${lessonKey}:${activePhase}:${activeMode}`
            : `session_timer_state:${activePhase}:${activeMode}`;
          const raw = sessionStorage.getItem(key);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          const elapsedSeconds = Number(parsed.elapsedSeconds);
          const storedMinutes = Number(parsed.totalMinutes);
          let targetSeconds = Number.isFinite(storedMinutes) ? Math.max(0, storedMinutes * 60) : null;
          if (!Number.isFinite(targetSeconds) && typeof getCurrentPhaseTimerDuration === 'function') {
            const minutes = getCurrentPhaseTimerDuration(activePhase, activeMode);
            if (Number.isFinite(minutes)) {
              targetSeconds = Math.max(0, minutes * 60);
            }
          }
          return {
            phase: activePhase,
            mode: activeMode,
            capturedAt: new Date().toISOString(),
            elapsedSeconds: Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0,
            targetSeconds: Number.isFinite(targetSeconds) ? targetSeconds : 0,
          };
        } catch {
          return null;
        }
      })();

      const payload = {
        // ATOMIC SNAPSHOT VERSION MARKER: Skip old snapshots from before atomic redesign
        snapshotVersion: 2, // v1 = old signature-based system, v2 = atomic checkpoint system
        phase, subPhase, showBegin,
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
        generatedWorksheet,
        generatedTest,
        teachingFlowState,
        currentTimerMode: timerModeSnapshot,
        workPhaseCompletions: workPhaseSnapshot,
        timerSnapshot,
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
      };
      
      const result = await saveSnapshot(storedKey, payload, { learnerId: lid, browserSessionId });

      // Check for session conflict
      if (result?.conflict && typeof onSessionConflict === 'function') {
        onSessionConflict(result.existingSession);
        return;
      }

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
    } catch {}
  }, [phase, subPhase, showBegin, teachingStage, stageRepeats, qaAnswersUnlocked, storyState, storySetupStep, storyCharacters, storySetting, storyPlot, storyPhase, storyTranscript, currentCompIndex, currentExIndex, currentWorksheetIndex, testActiveIndex, currentCompProblem, currentExerciseProblem, testUserAnswers, testCorrectByIndex, testCorrectCount, testFinalPercent, congratsStarted, congratsDone, usedTestCuePhrases, generatedComprehension, generatedExercise, generatedWorksheet, generatedTest, currentTimerMode, currentTimerModeRef, workPhaseCompletions, workPhaseCompletionsRef, getTeachingFlowSnapshot, getSnapshotStorageKey, lessonParam, effectiveLessonTitle, transcriptSessionId, restoredSnapshotRef, captionSentencesRef, captionSentences, captionIndex, ticker, sessionStartRef, lessonKey, getCurrentPhaseTimerDuration, browserSessionId, onSessionConflict]);

  // ATOMIC SNAPSHOT: No automatic saves. Snapshots are saved explicitly at checkpoints only.
  // This removes ALL reconciliation, signature checking, and automatic drift correction.

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

        // Only proceed when we have at least one non-empty key
        const keys = candidates.filter((k) => typeof k === 'string' && k.trim().length > 0);
        if (keys.length === 0) {
          // No valid keys available - mark as restored anyway so autosaves can begin
          restoreFoundRef.current = false;
          restoredSnapshotRef.current = true;
          try { setOfferResume(false); } catch {}
          try { setLoading(false); } catch {}
          return;
        }

        // Collect all available snapshots among candidates and legacy variants, then pick the newest by savedAt
        let snap = null;
        let newestAt = 0;
        const consider = async (keyLike, note = '') => {
          try {
            const s = await getStoredSnapshot(keyLike, { learnerId: lid });
            if (s) {
              const t = Date.parse(s.savedAt || '') || 0;
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
        // If we didn't find a snapshot yet, finalize as not-found so saving can begin
        if (!snap) {
          // No snapshot found: finalize restore as not-found so saving can begin
          restoreFoundRef.current = false;
          restoredSnapshotRef.current = true; // Mark as restored so autosaving can begin
          try { setOfferResume(false); } catch {}
          // Hide loading immediately in no-snapshot case so UI becomes interactive
          try { setLoading(false); } catch {}
          return;
        }
        
        // DIAGNOSTIC: Log what snapshot we found before any checks
        console.log('[SNAPSHOT RESTORE] Found snapshot - phase:', snap.phase, 'testFinalPercent:', snap.testFinalPercent, 'snapshotVersion:', snap.snapshotVersion);
        
        // ATOMIC SNAPSHOT VERSION CHECK: Skip old v1 snapshots from before atomic redesign
        // v1 snapshots have the old signature/reconciliation system that causes drift
        // Only accept v2 (atomic checkpoint) snapshots
        if (!snap.snapshotVersion || snap.snapshotVersion < 2) {
          // Old snapshot found - ignore it and start fresh
          restoreFoundRef.current = false;
          restoredSnapshotRef.current = true;
          try { setOfferResume(false); } catch {}
          try { setLoading(false); } catch {}
          return;
        }
        
        // CRITICAL: Skip snapshots from completed lessons (congrats OR test phase)
        // Test phase snapshots occur when Complete Lesson clicked from results screen
        // No point resuming - lesson is done, just loads to "Complete Lesson" button
        if (snap.phase === 'congrats' || snap.phase === 'test') {
          console.log('[SNAPSHOT RESTORE] Skipping completed lesson snapshot - phase:', snap.phase);
          restoreFoundRef.current = false;
          restoredSnapshotRef.current = true;
          try { setOfferResume(false); } catch {}
          try { setLoading(false); } catch {}
          return;
        }
        
  // Found a valid v2 snapshot: apply it
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
        try {
          if (snap.teachingFlowState && typeof applyTeachingFlowSnapshot === 'function') {
            applyTeachingFlowSnapshot(snap.teachingFlowState);
          }
        } catch {}
        // Indices and pointers
        try { setCurrentCompIndex(Number.isFinite(snap.currentCompIndex) ? snap.currentCompIndex : 0); } catch {}
        try { setCurrentExIndex(Number.isFinite(snap.currentExIndex) ? snap.currentExIndex : 0); } catch {}
        try {
          const wi = Number.isFinite(snap.currentWorksheetIndex) ? snap.currentWorksheetIndex : 0;
          worksheetIndexRef.current = wi; setCurrentWorksheetIndex(wi);
        } catch {}
        try { setTestActiveIndex(Number.isFinite(snap.testActiveIndex) ? snap.testActiveIndex : 0); } catch {}
        try { 
          console.log('[SNAPSHOT RESTORE] currentCompProblem from snapshot:', snap.currentCompProblem);
          if (snap.currentCompProblem) setCurrentCompProblem(snap.currentCompProblem); 
        } catch {}
        try { if (snap.currentExerciseProblem) setCurrentExerciseProblem(snap.currentExerciseProblem); } catch {}
        // Generated question arrays - only restore if non-empty to prevent stale empty arrays from overwriting fresh generation
        try { Array.isArray(snap.generatedComprehension) && snap.generatedComprehension.length > 0 && setGeneratedComprehension(snap.generatedComprehension); } catch {}
        try { Array.isArray(snap.generatedExercise) && snap.generatedExercise.length > 0 && setGeneratedExercise(snap.generatedExercise); } catch {}
  try { Array.isArray(snap.generatedWorksheet) && snap.generatedWorksheet.length > 0 && setGeneratedWorksheet(snap.generatedWorksheet); } catch {}
  try { Array.isArray(snap.generatedTest) && snap.generatedTest.length > 0 && setGeneratedTest(snap.generatedTest); } catch {}
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
            setCurrentTimerMode(snap.currentTimerMode);
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
            Object.entries(snap.timerStates).forEach(([key, value]) => {
              if (key.startsWith('session_timer_state:') && value) {
                sessionStorage.setItem(key, JSON.stringify(value));
              }
            });
          }
        } catch {}

        // Apply primary timer snapshot with drift correction
        try {
          if (snap.timerSnapshot && typeof snap.timerSnapshot === 'object' && typeof window !== 'undefined') {
            const { phase: timerPhaseName, mode: timerModeValue, capturedAt, elapsedSeconds, targetSeconds } = snap.timerSnapshot;
            if (timerPhaseName && timerModeValue) {
              const capturedMs = capturedAt ? Date.parse(capturedAt) : Date.now();
              const drift = Number.isFinite(capturedMs)
                ? Math.max(0, Math.floor((Date.now() - capturedMs) / 1000))
                : 0;
              const baseElapsed = Number(elapsedSeconds) || 0;
              const target = Number(targetSeconds);
              const adjustedElapsed = Math.max(0, Math.min(
                baseElapsed + drift,
                Number.isFinite(target) && target > 0 ? target : baseElapsed + drift
              ));
              const storageKey = lessonKey
                ? `session_timer_state:${lessonKey}:${timerPhaseName}:${timerModeValue}`
                : `session_timer_state:${timerPhaseName}:${timerModeValue}`;
              const storedState = {
                elapsedSeconds: adjustedElapsed,
                startTime: Date.now() - (adjustedElapsed * 1000),
                pausedAt: null,
              };
              if (Number.isFinite(target) && target > 0) {
                storedState.totalMinutes = target / 60;
              }
              sessionStorage.setItem(storageKey, JSON.stringify(storedState));
              setCurrentTimerMode((prev) => ({
                ...(prev || {}),
                [timerPhaseName]: timerModeValue,
              }));
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
    speakFrontend,
    applyTeachingFlowSnapshot,
    lessonKey,
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
    setCanSend,
    setOfferResume,
  ]);

  // ATOMIC SNAPSHOT: Return only the explicit save function. No automatic saves, no reconciliation.
  return {
    scheduleSaveSnapshot,
  };
}
