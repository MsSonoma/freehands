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
 *     qaAnswersUnlocked, jokeUsedThisGate, riddleUsedThisGate, poemUsedThisGate, 
 *     storyUsedThisGate, storyTranscript, currentCompIndex, currentExIndex,
 *     currentWorksheetIndex, testActiveIndex, currentCompProblem, currentExerciseProblem,
 *     testUserAnswers, testCorrectByIndex, testCorrectCount, testFinalPercent,
 *     captionSentences, captionIndex, usedTestCuePhrases, generatedWorksheet, generatedTest
 *   - State setters: setPhase, setSubPhase, setShowBegin, setTicker, setTeachingStage,
 *     setStageRepeats, setQaAnswersUnlocked, setJokeUsedThisGate, setRiddleUsedThisGate,
 *     setPoemUsedThisGate, setStoryUsedThisGate, setStoryTranscript, setCurrentCompIndex,
 *     setCurrentExIndex, setCurrentWorksheetIndex, setTestActiveIndex, setCurrentCompProblem,
 *     setCurrentExerciseProblem, setTestUserAnswers, setTestCorrectByIndex, setTestCorrectCount,
 *     setTestFinalPercent, setCaptionSentences, setCaptionIndex, setUsedTestCuePhrases,
 *     setLoading, setOfferResume, setCanSend, setShowOpeningActions, setTtsLoadingCount,
 *     setIsSpeaking
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
  captionSentences,
  captionIndex,
  usedTestCuePhrases,
  generatedComprehension,
  generatedExercise,
  generatedWorksheet,
  generatedTest,
  // State setters
  setPhase,
  setSubPhase,
  setShowBegin,
  setTicker,
  setTeachingStage,
  setStageRepeats,
  setQaAnswersUnlocked,
  setJokeUsedThisGate,
  setRiddleUsedThisGate,
  setPoemUsedThisGate,
  setStoryUsedThisGate,
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
  const scheduleSaveSnapshot = useCallback((label = '') => {
    // Generally do not save until restore has run at least once to avoid clobbering, except for explicit user-driven labels
    if (!restoredSnapshotRef.current && label === 'state-change') return;
    try { if (snapshotSaveTimerRef.current) clearTimeout(snapshotSaveTimerRef.current); } catch {}
    snapshotSaveTimerRef.current = setTimeout(async () => {
      try {
        // Double-guard inside timer as well
        if (!restoredSnapshotRef.current && label === 'state-change') {
          try { console.debug('[Snapshot] skip before restore', { label, at: new Date().toISOString() }); } catch {}
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
              try { console.debug('[Snapshot] key not ready; retry scheduled', { label, attempt: used + 1, at: new Date().toISOString() }); } catch {}
              setTimeout(() => { try { scheduleSaveSnapshot(label); } catch {} }, 400);
            } else {
              try { console.debug('[Snapshot] key not ready; giving up after retries', { label, at: new Date().toISOString() }); } catch {}
            }
          } else {
            try { console.debug('[Snapshot] save skipped (no key yet)', { label, at: new Date().toISOString() }); } catch {}
          }
          return;
        }
        const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
        // Build a compact signature that only changes when a meaningful resume point changes
        const sigObj = {
          phase, subPhase,
          teachingStage,
          idx: { ci: currentCompIndex, ei: currentExIndex, wi: currentWorksheetIndex, ti: testActiveIndex },
          gates: { qa: !!qaAnswersUnlocked, jk: !!jokeUsedThisGate, rd: !!riddleUsedThisGate, pm: !!poemUsedThisGate, st: !!storyUsedThisGate },
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
          qaAnswersUnlocked, jokeUsedThisGate, riddleUsedThisGate, poemUsedThisGate, storyUsedThisGate,
          storyTranscript,
          currentCompIndex, currentExIndex, currentWorksheetIndex,
          testActiveIndex,
          currentCompProblem, currentExerciseProblem,
          testUserAnswers, testCorrectByIndex, testCorrectCount, testFinalPercent,
          captionSentences: Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : (Array.isArray(captionSentences) ? captionSentences : []),
          captionIndex,
          usedTestCuePhrases,
          generatedComprehension,
          generatedExercise,
          resume,
        };
        if (!storedKey || String(storedKey).trim().length === 0) {
          try { console.debug('[Snapshot] save skipped (no key yet)', { learnerId: lid, phase, subPhase, label, at: new Date().toISOString() }); } catch {}
          return;
        }
  try { console.debug('[Snapshot] save', { key: storedKey, learnerId: lid, phase, subPhase, label, restored: restoredSnapshotRef.current, at: new Date().toISOString() }); } catch {}
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
    }, 200);
  }, [phase, subPhase, showBegin, teachingStage, qaAnswersUnlocked, jokeUsedThisGate, riddleUsedThisGate, poemUsedThisGate, storyUsedThisGate, storyTranscript, currentCompIndex, currentExIndex, currentWorksheetIndex, testActiveIndex, currentCompProblem, currentExerciseProblem, testUserAnswers, testCorrectByIndex, testCorrectCount, testFinalPercent, usedTestCuePhrases, getSnapshotStorageKey, lessonParam, effectiveLessonTitle, transcriptSessionId, restoredSnapshotRef, snapshotSaveTimerRef, pendingSaveRetriesRef, lastSavedSigRef, activeQuestionBodyRef, captionSentencesRef, captionSentences, captionIndex, ticker, sessionStartRef]);

  // Memoized signature of meaningful resume-relevant state. Changes here will cause an autosave.
  const snapshotSigMemo = useMemo(() => {
    const sigObj = {
      phase, subPhase,
      teachingStage,
      idx: { ci: currentCompIndex, ei: currentExIndex, wi: currentWorksheetIndex, ti: testActiveIndex },
      gates: { qa: !!qaAnswersUnlocked, jk: !!jokeUsedThisGate, rd: !!riddleUsedThisGate, pm: !!poemUsedThisGate, st: !!storyUsedThisGate },
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
    };
    try { return JSON.stringify(sigObj); } catch { return '' }
  }, [phase, subPhase, teachingStage, currentCompIndex, currentExIndex, currentWorksheetIndex, testActiveIndex, qaAnswersUnlocked, jokeUsedThisGate, riddleUsedThisGate, poemUsedThisGate, storyUsedThisGate, currentCompProblem, currentExerciseProblem, testUserAnswers, testCorrectByIndex, testFinalPercent, activeQuestionBodyRef]);

  // Save on ticker change to support resume at each count increment (coalesced with timer)
  useEffect(() => {
    if (!restoredSnapshotRef.current) return;
    try { scheduleSaveSnapshot('ticker-change'); } catch {}
  }, [ticker, restoredSnapshotRef, scheduleSaveSnapshot]);

  // Restore snapshot as early as possible (run once when a stable key can be derived)
  useEffect(() => {
    if (didRunRestoreRef.current || restoredSnapshotRef.current) return;
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
          try { console.debug('[Snapshot] restore postponed (no key yet)', { at: new Date().toISOString() }); } catch {}
          return; // do not mark didRunRestore/restored flags so we can try again when deps update
        }

  // Mark as attempted IMMEDIATELY to prevent re-entry during async operations
  didRunRestoreRef.current = true;

        // Collect all available snapshots among candidates and legacy variants, then pick the newest by savedAt
        let snap = null;
        let newestAt = 0;
        const consider = async (keyLike, note = '') => {
          try {
            const s = await getStoredSnapshot(keyLike, { learnerId: lid });
            if (s) {
              const t = Date.parse(s.savedAt || '') || 0;
              if (t >= newestAt) { snap = s; newestAt = t; }
              // Only log candidates when they're actually viable (reduces noise)
              if (t > 0) {
                try { console.debug('[Snapshot] candidate', { key: keyLike, note, savedAt: s.savedAt }); } catch {}
              }
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
        if (snap) { try { console.debug('[Snapshot] restore hit', { key: 'NEWEST', learnerId: lid, at: new Date().toISOString(), savedAt: snap.savedAt }); } catch {} }
        // If we didn't find a snapshot yet, decide whether to postpone based on source readiness
        const sourcesReady = Boolean(lessonParam) && (Boolean(manifestInfo?.file) || Boolean(lessonData?.id));
        if (!snap) {
          if (!sourcesReady) {
            // Postpone finalize; dependencies will change when manifest/data load, allowing another attempt
            // Reset the flag so we can retry when dependencies change
            didRunRestoreRef.current = false;
            try { console.debug('[Snapshot] no snapshot yet; will retry when sources are ready', { at: new Date().toISOString() }); } catch {}
            return;
          }
          // No snapshot and sources are ready: finalize restore as not-found so saving can begin
          restoreFoundRef.current = false;
          try { setOfferResume(false); } catch {}
          // Hide loading immediately in no-snapshot case so UI becomes interactive
          try { setLoading(false); } catch {}
          return;
        }
        // Found a snapshot: apply it
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
        try { setJokeUsedThisGate(!!snap.jokeUsedThisGate); } catch {}
        try { setRiddleUsedThisGate(!!snap.riddleUsedThisGate); } catch {}
        try { setPoemUsedThisGate(!!snap.poemUsedThisGate); } catch {}
        try { setStoryUsedThisGate(!!snap.storyUsedThisGate); } catch {}
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
        // Captions/transcript
        try {
          const lines = Array.isArray(snap.captionSentences) ? snap.captionSentences : [];
          captionSentencesRef.current = lines;
          setCaptionSentences(lines.slice());
          const ci = Number.isFinite(snap.captionIndex) ? snap.captionIndex : 0;
          setCaptionIndex(Math.max(0, Math.min(ci, Math.max(0, lines.length - 1))));
        } catch {}
        restoreFoundRef.current = true;
  try { console.debug('[Snapshot] restore applied', { phase: snap.phase, subPhase: snap.subPhase, teachingStage: snap.teachingStage, at: new Date().toISOString() }); } catch {}
  // Defer clearing loading until the resume reconciliation effect completes
        try { setTtsLoadingCount(0); } catch {}
        try { setIsSpeaking(false); } catch {}
        try {
          // Minimal canSend heuristics on restore: enable only when in awaiting-begin or review or teaching stage prompts
          const enable = (
            (phase === 'discussion' && subPhase === 'awaiting-learner') ||
            (phase === 'comprehension' && subPhase === 'comprehension-start') ||
            (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') ||
            (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin') ||
            (phase === 'test' && (subPhase === 'test-awaiting-begin' || subPhase === 'review-start')) ||
            (phase === 'teaching' && subPhase === 'teaching-3stage')
          );
          setCanSend(!!enable);
        } catch {}
        try {
          // Do not surface Resume/Restart when the snapshot is effectively the global beginning
          const atGlobalStart = ((snap.phase || 'discussion') === 'discussion') && !!snap.showBegin;
          setOfferResume(!atGlobalStart);
        } catch {}
      } finally {
        // Whether or not a snapshot was found, mark restored so subsequent state changes start saving
        restoredSnapshotRef.current = true;
        try { console.debug('[Snapshot] restore attempt finished', { restored: restoreFoundRef.current, at: new Date().toISOString() }); } catch {}
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
    setJokeUsedThisGate,
    setRiddleUsedThisGate,
    setPoemUsedThisGate,
    setStoryUsedThisGate,
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
      if (subPhase === 'review-start') {
        // Allowed resume point; nothing to reconcile
        return;
      }
      if (Array.isArray(generatedTest) && generatedTest.length > 0) {
        const i = clamp(Number(testActiveIndex) || 0, 0, Math.max(0, generatedTest.length - 1));
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
  }, [phase, subPhase, currentCompProblem, currentExerciseProblem, currentWorksheetIndex, testActiveIndex, generatedWorksheet, generatedTest, qaAnswersUnlocked, showBegin, restoredSnapshotRef, resumeAppliedRef, restoreFoundRef, setShowOpeningActions, setCanSend, setShowBegin, setSubPhase, setCurrentWorksheetIndex, setTestActiveIndex, preferHtmlAudioOnceRef, setOfferResume, setLoading]);

  return {
    scheduleSaveSnapshot,
    snapshotSigMemo,
  };
}
