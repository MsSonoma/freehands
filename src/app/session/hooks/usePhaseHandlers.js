/**
 * usePhaseHandlers.js
 * Custom hook managing phase start handlers:
 * - handleGoComprehension: Start comprehension phase with first question
 * - handleGoExercise: Start exercise phase with encouragement + question
 * - handleGoWorksheet: Start worksheet phase with numbered question
 * - handleGoTest: Start test phase with numbered question
 * - handleStartLesson: Generic start handler (delegates to appropriate phase)
 */

import { useCallback } from 'react';
import { ensureQuestionMark, formatQuestionForSpeech, isShortAnswerItem } from '../utils/questionFormatting';
import { getEncouragement, ENCOURAGEMENT_SNIPPETS } from '../utils/openingSignals';
import { ttsCache } from '../utils/ttsCache';

export function usePhaseHandlers({
  // State setters
  setShowOpeningActions,
  setCurrentCompProblem,
  setSubPhase,
  setQaAnswersUnlocked,
  setCanSend,
  setCurrentCompIndex,
  // REMOVED: setCompPool, setExercisePool - pools eliminated
  setCurrentExerciseProblem,
  setCurrentExIndex,
  setShowPlayTimeExpired,
  setPlayExpiredPhase,
  
  // State values
  phase,
  currentCompProblem,
  generatedComprehension,
  currentCompIndex,
  // REMOVED: compPool, exercisePool - pools eliminated
  currentExerciseProblem,
  generatedExercise,
  currentExIndex,
  generatedWorksheet,
  generatedTest,
  
  // Refs
  activeQuestionBodyRef,
  startThreeStageTeachingRef,
  
  // Functions
  speakFrontend,
  // REMOVED: drawSampleUnique, buildQAPool - no refill logic needed
  
  // Phase timer functions
  transitionToWorkTimer
}) {

  const handleGoComprehension = useCallback(async () => {
    console.log('[handleGoComprehension] START - phase:', phase, 'currentCompProblem:', currentCompProblem);
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'comprehension') {
      console.log('[handleGoComprehension] EARLY RETURN - wrong phase');
      return;
    }
    
    // CRITICAL: If play time expired overlay is showing, dismiss it immediately
    // User clicking "Go" overrides the countdown
    if (setShowPlayTimeExpired) {
      try { setShowPlayTimeExpired(false); } catch {}
    }
    if (setPlayExpiredPhase) {
      try { setPlayExpiredPhase(null); } catch {}
    }
    
    // Transition from play to work timer
    if (transitionToWorkTimer) {
      console.log('[handleGoComprehension] Transitioning to work timer');
      transitionToWorkTimer('comprehension');
    }
    
    let item = currentCompProblem;
    console.log('[handleGoComprehension] currentCompProblem:', item);
    console.log('[handleGoComprehension] generatedComprehension:', generatedComprehension, 'length:', generatedComprehension?.length, 'currentCompIndex:', currentCompIndex);
    if (!item) {
      let firstComp = null;
      if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
        firstComp = generatedComprehension[currentCompIndex];
        setCurrentCompIndex(currentCompIndex + 1);
        console.log('[handleGoComprehension] Got first question from array:', firstComp);
      }
      // REMOVED: pool fallback logic - arrays are source of truth, no refill
      if (firstComp) { setCurrentCompProblem(firstComp); item = firstComp; setSubPhase('comprehension-active'); }
    }
    if (!item) {
      console.log('[handleGoComprehension] NO QUESTION - showing opening actions');
      setShowOpeningActions(true);
      return;
    }
    console.log('[handleGoComprehension] Speaking question:', item);
    try {
      setQaAnswersUnlocked(true);
      const formatted = ensureQuestionMark(formatQuestionForSpeech(item, { layout: 'multiline' }));
      activeQuestionBodyRef.current = formatted;
      setCanSend(false);
      
      // Prefetch this question immediately (before speaking it) for instant playback
      try { ttsCache.prefetch(formatted); } catch {}
      
      await speakFrontend(formatted, { mcLayout: 'multiline' });
      
      // Prefetch second question while student answers first
      try {
        if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
          const prefetchProblem = generatedComprehension[currentCompIndex];
          const prefetchQ = ensureQuestionMark(formatQuestionForSpeech(prefetchProblem, { layout: 'multiline' }));
          ttsCache.prefetch(prefetchQ);
        }
      } catch {}
    } catch {}
    setCanSend(true);
    console.log('[handleGoComprehension] DONE');
  }, [
    phase, currentCompProblem, generatedComprehension, currentCompIndex,
    setShowOpeningActions, setCurrentCompProblem, setSubPhase, setQaAnswersUnlocked, setCanSend,
    setCurrentCompIndex, activeQuestionBodyRef, speakFrontend, transitionToWorkTimer
  ]);

  const handleGoExercise = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'exercise') return;
    
    // CRITICAL: If play time expired overlay is showing, dismiss it immediately
    // User clicking "Go" overrides the countdown
    if (setShowPlayTimeExpired) {
      try { setShowPlayTimeExpired(false); } catch {}
    }
    if (setPlayExpiredPhase) {
      try { setPlayExpiredPhase(null); } catch {}
    }
    
    // Transition from play to work timer
    if (transitionToWorkTimer) {
      transitionToWorkTimer('exercise');
    }
    
    let item = currentExerciseProblem;
    if (!item) {
      let first = null;
      if (Array.isArray(generatedExercise) && currentExIndex < generatedExercise.length) {
        first = generatedExercise[currentExIndex];
        setCurrentExIndex(currentExIndex + 1);
      }
      // REMOVED: pool fallback logic - arrays are source of truth, no refill
      if (first) { setCurrentExerciseProblem(first); item = first; setSubPhase('exercise-start'); }
    }
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      // Speak a quick encouragement right after Go, before the first Exercise question.
      const encouragement = getEncouragement();
      setCanSend(false);
      if (encouragement) {
        try { await speakFrontend(`${encouragement}.`); } catch {}
      }
      const formatted = ensureQuestionMark(formatQuestionForSpeech(item, { layout: 'multiline' }));
      activeQuestionBodyRef.current = formatted;
      
      // Prefetch this question immediately (before speaking it) for instant playback
      try { ttsCache.prefetch(formatted); } catch {}
      
      await speakFrontend(formatted, { mcLayout: 'multiline' });
      
      // Prefetch second question while student answers first
      try {
        if (Array.isArray(generatedExercise) && currentExIndex < generatedExercise.length) {
          const prefetchProblem = generatedExercise[currentExIndex];
          const prefetchQ = ensureQuestionMark(formatQuestionForSpeech(prefetchProblem, { layout: 'multiline' }));
          ttsCache.prefetch(prefetchQ);
        }
      } catch {}
    } catch {}
    setCanSend(true);
  }, [
    phase, currentExerciseProblem, generatedExercise, currentExIndex,
    setShowOpeningActions, setCurrentExerciseProblem, setSubPhase, setQaAnswersUnlocked, setCanSend,
    setCurrentExIndex, activeQuestionBodyRef, speakFrontend, transitionToWorkTimer
  ]);

  const handleGoWorksheet = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'worksheet') return;
    
    // CRITICAL: If play time expired overlay is showing, dismiss it immediately
    // User clicking "Go" overrides the countdown
    if (setShowPlayTimeExpired) {
      try { setShowPlayTimeExpired(false); } catch {}
    }
    if (setPlayExpiredPhase) {
      try { setPlayExpiredPhase(null); } catch {}
    }
    
    // Transition from play to work timer
    if (transitionToWorkTimer) {
      transitionToWorkTimer('worksheet');
    }
    
    const list = Array.isArray(generatedWorksheet) ? generatedWorksheet : [];
    const item = list[0];
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      const num = (typeof item.number === 'number' && item.number > 0) ? item.number : 1;
      const formatted = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
      activeQuestionBodyRef.current = formatted;
      setCanSend(false);
      await speakFrontend(formatted, { mcLayout: 'multiline' });
    } catch {}
    setCanSend(true);
  }, [phase, generatedWorksheet, setShowOpeningActions, setQaAnswersUnlocked, setCanSend, activeQuestionBodyRef, speakFrontend, transitionToWorkTimer]);

  const handleGoTest = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'test') return;
    
    // CRITICAL: If play time expired overlay is showing, dismiss it immediately
    // User clicking "Go" overrides the countdown
    if (setShowPlayTimeExpired) {
      try { setShowPlayTimeExpired(false); } catch {}
    }
    if (setPlayExpiredPhase) {
      try { setPlayExpiredPhase(null); } catch {}
    }
    
    // Transition from play to work timer
    if (transitionToWorkTimer) {
      transitionToWorkTimer('test');
    }
    
    const list = Array.isArray(generatedTest) ? generatedTest : [];
    const item = list[0];
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      const formatted = ensureQuestionMark(`1. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
      activeQuestionBodyRef.current = formatted;
      setCanSend(false);
      await speakFrontend(formatted, { mcLayout: 'multiline' });
    } catch {}
    setCanSend(true);
  }, [phase, generatedTest, setShowOpeningActions, setQaAnswersUnlocked, setCanSend, activeQuestionBodyRef, speakFrontend, transitionToWorkTimer]);

  // Handler: Start the lesson now (fallback/generic)
  const handleStartLesson = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    
    // CRITICAL: If play time expired overlay is showing, dismiss it immediately
    // User clicking "Go" overrides the countdown
    if (setShowPlayTimeExpired) {
      try { setShowPlayTimeExpired(false); } catch {}
    }
    if (setPlayExpiredPhase) {
      try { setPlayExpiredPhase(null); } catch {}
    }
    
    // If in discussion/teaching phase, transition from play to work timer
    if ((phase === 'discussion' || phase === 'teaching') && transitionToWorkTimer) {
      transitionToWorkTimer('discussion');
    }
    
    if (phase === 'comprehension' && currentCompProblem) {
      try {
        setQaAnswersUnlocked(true);
        const formatted = ensureQuestionMark(formatQuestionForSpeech(currentCompProblem, { layout: 'multiline' }));
        activeQuestionBodyRef.current = formatted;
        setCanSend(false);
        await speakFrontend(formatted, { mcLayout: 'multiline' });
      } catch {}
      setCanSend(true);
      return;
    }
    if (phase === 'exercise' && currentExerciseProblem) {
      try {
        setQaAnswersUnlocked(true);
        const formatted = ensureQuestionMark(formatQuestionForSpeech(currentExerciseProblem, { layout: 'multiline' }));
        activeQuestionBodyRef.current = formatted;
        setCanSend(false);
        await speakFrontend(formatted, { mcLayout: 'multiline' });
      } catch {}
      setCanSend(true);
      return;
    }
    if (phase === 'worksheet' && Array.isArray(generatedWorksheet) && generatedWorksheet[0]) {
      try {
        setQaAnswersUnlocked(true);
        const first = generatedWorksheet[0];
        const num = (typeof first.number === 'number' && first.number > 0) ? first.number : 1;
        const formatted = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(first, { layout: 'multiline' })}`);
        activeQuestionBodyRef.current = formatted;
        setCanSend(false);
        await speakFrontend(formatted, { mcLayout: 'multiline' });
      } catch {}
      setCanSend(true);
      return;
    }
    if (phase === 'test' && Array.isArray(generatedTest) && generatedTest[0]) {
      try {
        setQaAnswersUnlocked(true);
        const formatted = ensureQuestionMark(`1. ${formatQuestionForSpeech(generatedTest[0], { layout: 'multiline' })}`);
        activeQuestionBodyRef.current = formatted;
        setCanSend(false);
        await speakFrontend(formatted, { mcLayout: 'multiline' });
      } catch {}
      setCanSend(true);
      return;
    }
    try { 
      if (startThreeStageTeachingRef.current) {
        await startThreeStageTeachingRef.current(); 
      }
    } catch {}
  }, [
    phase, currentCompProblem, currentExerciseProblem, generatedWorksheet, generatedTest,
    setShowOpeningActions, setQaAnswersUnlocked, setCanSend, activeQuestionBodyRef,
    speakFrontend, startThreeStageTeachingRef, transitionToWorkTimer
  ]);

  return {
    handleGoComprehension,
    handleGoExercise,
    handleGoWorksheet,
    handleGoTest,
    handleStartLesson
  };
}
