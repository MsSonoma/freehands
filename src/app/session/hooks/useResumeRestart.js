import { useCallback } from 'react';
import { clearSnapshot } from '../sessionSnapshotStore';
import { appendTranscriptSegment } from '../../lib/transcriptsClient';

/**
 * useResumeRestart
 * 
 * Manages Resume and Restart button handlers for the session footer.
 * Resume re-runs the current phase/question with audio.
 * Restart clears all progress and resets to the beginning.
 * 
 * @param {Object} deps - Dependencies object containing:
 *   - State values: phase, subPhase, teachingStage, qaAnswersUnlocked, currentCompProblem,
 *     currentExerciseProblem, currentWorksheetIndex, testActiveIndex, generatedWorksheet,
 *     generatedTest, lessonParam, lessonData, manifestInfo, effectiveLessonTitle,
 *     transcriptSessionId, WORKSHEET_TARGET, TEST_TARGET
 *   - State setters: setOfferResume, setSubPhase, setCanSend, setShowOpeningActions,
 *     setQaAnswersUnlocked, setShowBegin, setPhase, setGeneratedWorksheet, setGeneratedTest,
 *     setCurrentWorksheetIndex, setCurrentCompProblem, setCurrentExerciseProblem,
 *     setTestUserAnswers, setTestCorrectByIndex, setTestCorrectCount, setTestFinalPercent,
 *     setJokeUsedThisGate, setRiddleUsedThisGate, setPoemUsedThisGate, setStoryUsedThisGate,
 *     setTicker, setCaptionSentences, setCaptionIndex, setTranscriptSessionId
 *   - Refs: preferHtmlAudioOnceRef, forceNextPlaybackRef, activeQuestionBodyRef,
 *     worksheetIndexRef, captionSentencesRef, sessionStartRef, transcriptSegmentStartIndexRef
 *   - Functions: unlockAudioPlayback, startDiscussionStep, teachDefinitions, promptGateRepeat,
 *     teachExamples, speakFrontend, ensureQuestionMark, formatQuestionForSpeech,
 *     beginComprehensionPhase, beginSkippedExercise, beginWorksheetPhase, beginTestPhase,
 *     abortAllActivity, getSnapshotStorageKey, getAssessmentStorageKey, clearAssessments,
 *     scheduleSaveSnapshot
 *   - Constants: COMPREHENSION_INTROS, EXERCISE_INTROS, WORKSHEET_INTROS, TEST_INTROS
 * @returns {Object} { handleResumeClick, handleRestartClick }
 */
export function useResumeRestart({
  // State values
  phase,
  subPhase,
  teachingStage,
  qaAnswersUnlocked,
  currentCompProblem,
  currentExerciseProblem,
  currentWorksheetIndex,
  testActiveIndex,
  generatedWorksheet,
  generatedTest,
  lessonParam,
  lessonData,
  manifestInfo,
  effectiveLessonTitle,
  transcriptSessionId,
  WORKSHEET_TARGET,
  TEST_TARGET,
  // State setters
  setOfferResume,
  setSubPhase,
  setCanSend,
  setShowOpeningActions,
  setQaAnswersUnlocked,
  setShowBegin,
  setPhase,
  setGeneratedWorksheet,
  setGeneratedTest,
  setCurrentWorksheetIndex,
  setCurrentCompProblem,
  setCurrentExerciseProblem,
  setTestUserAnswers,
  setTestCorrectByIndex,
  setTestCorrectCount,
  setTestFinalPercent,
  setJokeUsedThisGate,
  setRiddleUsedThisGate,
  setPoemUsedThisGate,
  setStoryUsedThisGate,
  setTicker,
  setCaptionSentences,
  setCaptionIndex,
  setTranscriptSessionId,
  // Refs
  preferHtmlAudioOnceRef,
  forceNextPlaybackRef,
  activeQuestionBodyRef,
  worksheetIndexRef,
  captionSentencesRef,
  sessionStartRef,
  transcriptSegmentStartIndexRef,
  // Functions
  unlockAudioPlayback,
  startDiscussionStep,
  teachDefinitions,
  promptGateRepeat,
  teachExamples,
  speakFrontend,
  ensureQuestionMark,
  formatQuestionForSpeech,
  beginComprehensionPhase,
  beginSkippedExercise,
  beginWorksheetPhase,
  beginTestPhase,
  abortAllActivity,
  getSnapshotStorageKey,
  getAssessmentStorageKey,
  clearAssessments,
  scheduleSaveSnapshot,
  // Constants
  COMPREHENSION_INTROS,
  EXERCISE_INTROS,
  WORKSHEET_INTROS,
  TEST_INTROS,
}) {
  const handleResumeClick = useCallback(async () => {
    try { setOfferResume(false); } catch {}
    try { unlockAudioPlayback(); } catch {}
    try { preferHtmlAudioOnceRef.current = true; } catch {}
    try { forceNextPlaybackRef.current = true; } catch {}
    // Decide what to resume based on phase/subPhase
    try {
      if (phase === 'discussion') {
        // Re-run current discussion step if available
        await startDiscussionStep();
        return;
      }
      if (phase === 'teaching') {
        // Restart the current teaching stage from the beginning
        setSubPhase('teaching-3stage');
        setCanSend(false);
        if (teachingStage === 'definitions') { await teachDefinitions(false); await promptGateRepeat(); return; }
        if (teachingStage === 'examples') { await teachExamples(false); await promptGateRepeat(); return; }
        return;
      }
      if (phase === 'comprehension') {
        // Phase entrance: Begin was clicked but Go has not been pressed yet
        if (subPhase === 'comprehension-active' && !qaAnswersUnlocked) {
          try {
            const opener = COMPREHENSION_INTROS[Math.floor(Math.random() * COMPREHENSION_INTROS.length)];
            await speakFrontend(opener);
          } catch {}
          try { setShowOpeningActions(true); } catch {}
          try { setCanSend(true); } catch {}
          return;
        }
        // If we were already on a question, re-ask that exact question; otherwise restart at the entrance
        if (subPhase === 'comprehension-active' && currentCompProblem) {
          try {
            const formatted = ensureQuestionMark(formatQuestionForSpeech(currentCompProblem, { layout: 'multiline' }));
            activeQuestionBodyRef.current = formatted;
            setQaAnswersUnlocked(true);
            setCanSend(false);
            // Audible re-read without duplicating captions on screen
            await speakFrontend(formatted, { mcLayout: 'multiline', noCaptions: true });
          } catch {}
          setCanSend(true);
          return;
        }
        setSubPhase('comprehension-start');
        await beginComprehensionPhase();
        return;
      }
      if (phase === 'exercise') {
        // Phase entrance: Begin was clicked but Go has not been pressed yet
        if (subPhase === 'exercise-start' && !qaAnswersUnlocked) {
          try {
            const opener = EXERCISE_INTROS[Math.floor(Math.random() * EXERCISE_INTROS.length)];
            await speakFrontend(opener);
          } catch {}
          try { setShowOpeningActions(true); } catch {}
          try { setCanSend(true); } catch {}
          return;
        }
        // If we were already on a question, re-ask that exact question; otherwise restart at the entrance
        if (subPhase === 'exercise-start' && currentExerciseProblem) {
          try {
            const formatted = ensureQuestionMark(formatQuestionForSpeech(currentExerciseProblem, { layout: 'multiline' }));
            activeQuestionBodyRef.current = formatted;
            setQaAnswersUnlocked(true);
            setCanSend(false);
            await speakFrontend(formatted, { mcLayout: 'multiline', noCaptions: true });
          } catch {}
          setCanSend(true);
          return;
        }
        setSubPhase('exercise-awaiting-begin');
        await beginSkippedExercise();
        return;
      }
      if (phase === 'worksheet') {
        // Phase entrance: Begin was clicked but Go has not been pressed yet
        if (subPhase === 'worksheet-active' && !qaAnswersUnlocked) {
          try {
            const opener = WORKSHEET_INTROS[Math.floor(Math.random() * WORKSHEET_INTROS.length)];
            await speakFrontend(opener);
          } catch {}
          try { setShowOpeningActions(true); } catch {}
          try { setCanSend(true); } catch {}
          return;
        }
        // If already active on a worksheet question, re-ask the current one; otherwise restart at the entrance
        if (subPhase === 'worksheet-active') {
          const list = Array.isArray(generatedWorksheet) ? generatedWorksheet : [];
          const idx = (typeof worksheetIndexRef !== 'undefined' && worksheetIndexRef && typeof worksheetIndexRef.current === 'number')
            ? (worksheetIndexRef.current ?? 0)
            : (typeof currentWorksheetIndex === 'number' ? currentWorksheetIndex : 0);
          const item = list[idx] || null;
          if (item) {
            try {
              const num = (typeof item.number === 'number' && item.number > 0) ? item.number : (idx + 1);
              const formatted = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
              activeQuestionBodyRef.current = formatted;
              setQaAnswersUnlocked(true);
              setCanSend(false);
              await speakFrontend(formatted, { mcLayout: 'multiline', noCaptions: true });
            } catch {}
            setCanSend(true);
            return;
          }
        }
        setSubPhase('worksheet-awaiting-begin');
        await beginWorksheetPhase();
        return;
      }
      if (phase === 'test') {
        // If in review, stay there; if on a question, re-ask it; otherwise restart at the entrance
        if (typeof subPhase === 'string' && subPhase.startsWith('review')) {
          // No TTS necessary here; review UI is already in control
          setCanSend(false);
          return;
        }
        // Phase entrance: Begin was clicked but Go has not been pressed yet
        if (subPhase === 'test-active' && !qaAnswersUnlocked) {
          try {
            const opener = TEST_INTROS[Math.floor(Math.random() * TEST_INTROS.length)];
            await speakFrontend(opener);
          } catch {}
          try { setShowOpeningActions(true); } catch {}
          try { setCanSend(true); } catch {}
          return;
        }
        if (subPhase === 'test-active') {
          const list = Array.isArray(generatedTest) ? generatedTest : [];
          const idx = (typeof testActiveIndex === 'number' ? testActiveIndex : 0);
          const item = list[idx] || null;
          if (item) {
            try {
              const num = (typeof item.number === 'number' && item.number > 0) ? item.number : (idx + 1);
              const formatted = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
              activeQuestionBodyRef.current = formatted;
              setQaAnswersUnlocked(true);
              setCanSend(false);
              await speakFrontend(formatted, { mcLayout: 'multiline', noCaptions: true });
            } catch {}
            setCanSend(true);
            return;
          }
        }
        setSubPhase('test-awaiting-begin');
        await beginTestPhase();
        return;
      }
    } catch {}
  }, [phase, subPhase, teachingStage, qaAnswersUnlocked, currentCompProblem, currentExerciseProblem, currentWorksheetIndex, testActiveIndex, generatedWorksheet, generatedTest, worksheetIndexRef, setOfferResume, unlockAudioPlayback, preferHtmlAudioOnceRef, forceNextPlaybackRef, startDiscussionStep, setSubPhase, setCanSend, teachDefinitions, promptGateRepeat, teachExamples, COMPREHENSION_INTROS, speakFrontend, setShowOpeningActions, ensureQuestionMark, formatQuestionForSpeech, activeQuestionBodyRef, setQaAnswersUnlocked, beginComprehensionPhase, EXERCISE_INTROS, beginSkippedExercise, WORKSHEET_INTROS, beginWorksheetPhase, TEST_INTROS, beginTestPhase]);

  const handleRestartClick = useCallback(async () => {
    // Confirm irreversible action before proceeding
    try {
      const ans = typeof window !== 'undefined' ? window.prompt("Restart will clear saved progress and cannot be reversed. Type 'ok' to confirm.") : null;
      if (!ans || String(ans).trim().toLowerCase() !== 'ok') { try { console.info('[Restart] cancelled by user'); } catch {} return; }
    } catch {}
    // Stop all activity and cut the current transcript segment so nothing is lost
    try { abortAllActivity(); } catch {}
    try {
      const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
      const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
      const startIdx = Math.max(0, Number(transcriptSegmentStartIndexRef.current) || 0);
      const all = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : [];
      const slice = all.slice(startIdx).filter((ln) => ln && typeof ln.text === 'string' && ln.text.trim().length > 0).map((ln) => ({ role: ln.role || 'assistant', text: ln.text }));
      if (learnerId && learnerId !== 'demo' && slice.length > 0) {
        await appendTranscriptSegment({
          learnerId,
          learnerName,
          lessonId,
          lessonTitle: effectiveLessonTitle,
          segment: { startedAt: sessionStartRef.current || new Date().toISOString(), completedAt: new Date().toISOString(), lines: slice },
          sessionId: transcriptSessionId || undefined,
        });
      }
    } catch {}
    // Clear snapshots (server + local) for all potential keys to begin a fresh session, and clear assessments cache
    try {
      const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
      const keys = [];
      try { const k = getSnapshotStorageKey(); if (k) keys.push(k); } catch {}
      try { const k = getSnapshotStorageKey({ param: lessonParam }); if (k && !keys.includes(k)) keys.push(k); } catch {}
      try { const k = getSnapshotStorageKey({ manifest: manifestInfo }); if (k && !keys.includes(k)) keys.push(k); } catch {}
      try { if (lessonData?.id) { const k = getSnapshotStorageKey({ data: lessonData }); if (k && !keys.includes(k)) keys.push(k); } } catch {}
      for (const key of keys) {
        try { await clearSnapshot(key, { learnerId: lid }); } catch {}
        // Clear known legacy variants as well
        try {
          const variants = [
            `${key}:W15:T10`,
            `${key}:W20:T20`,
            `${key}:W${Number(WORKSHEET_TARGET) || 15}:T${Number(TEST_TARGET) || 10}`
          ];
          for (const v of variants) { try { await clearSnapshot(v, { learnerId: lid }); } catch {} }
        } catch {}
      }
      const assessKey = getAssessmentStorageKey();
      if (assessKey) { try { clearAssessments(assessKey, { learnerId: lid }); } catch {} }
    } catch {}
    // Reset transcript UI and start a brand new in-app segment
    try { captionSentencesRef.current = []; setCaptionSentences([]); setCaptionIndex(0); } catch {}
    try { sessionStartRef.current = new Date().toISOString(); } catch {}
    try { transcriptSegmentStartIndexRef.current = 0; } catch {}
    // Start a new per-restart transcript session id for per-session transcript files
    try {
      const newId = `r-${Date.now()}`;
      setTranscriptSessionId(newId);
      try { if (typeof window !== 'undefined') localStorage.setItem('current_transcript_session_id', newId); } catch {}
    } catch {}
    // Reset core session state to the very beginning
    try {
      setShowBegin(true);
      setPhase('discussion');
      setSubPhase('greeting');
      setCanSend(false);
      setGeneratedWorksheet(null);
      setGeneratedTest(null);
      setCurrentWorksheetIndex(0);
      worksheetIndexRef.current = 0;
      setCurrentCompProblem(null);
      setCurrentExerciseProblem(null);
      setTestUserAnswers([]);
      setTestCorrectByIndex([]);
      setTestCorrectCount(0);
      setTestFinalPercent(null);
      setQaAnswersUnlocked(false);
      setJokeUsedThisGate(false);
      setRiddleUsedThisGate(false);
      setPoemUsedThisGate(false);
      setStoryUsedThisGate(false);
      setTicker(0);
      setOfferResume(false);
    } catch {}
    // Seed a fresh snapshot of the reset state
    try { setTimeout(() => { try { scheduleSaveSnapshot('restart'); } catch {} }, 60); } catch {}
  }, [lessonParam, lessonData, manifestInfo, effectiveLessonTitle, transcriptSessionId, WORKSHEET_TARGET, TEST_TARGET, abortAllActivity, captionSentencesRef, sessionStartRef, transcriptSegmentStartIndexRef, getSnapshotStorageKey, getAssessmentStorageKey, clearAssessments, setCaptionSentences, setCaptionIndex, setTranscriptSessionId, setShowBegin, setPhase, setSubPhase, setCanSend, setGeneratedWorksheet, setGeneratedTest, setCurrentWorksheetIndex, worksheetIndexRef, setCurrentCompProblem, setCurrentExerciseProblem, setTestUserAnswers, setTestCorrectByIndex, setTestCorrectCount, setTestFinalPercent, setQaAnswersUnlocked, setJokeUsedThisGate, setRiddleUsedThisGate, setPoemUsedThisGate, setStoryUsedThisGate, setTicker, setOfferResume, scheduleSaveSnapshot]);

  return {
    handleResumeClick,
    handleRestartClick,
  };
}
