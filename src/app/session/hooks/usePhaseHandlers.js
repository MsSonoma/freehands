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

export function usePhaseHandlers({
  // State setters
  setShowOpeningActions,
  setCurrentCompProblem,
  setSubPhase,
  setQaAnswersUnlocked,
  setCanSend,
  setCurrentCompIndex,
  setCompPool,
  setCurrentExerciseProblem,
  setCurrentExIndex,
  setExercisePool,
  
  // State values
  phase,
  currentCompProblem,
  generatedComprehension,
  currentCompIndex,
  compPool,
  currentExerciseProblem,
  generatedExercise,
  currentExIndex,
  exercisePool,
  generatedWorksheet,
  generatedTest,
  
  // Refs
  activeQuestionBodyRef,
  startThreeStageTeachingRef,
  
  // Functions
  speakFrontend,
  // REMOVED: drawSampleUnique - sample array deprecated
  buildQAPool,
  
  // Phase timer functions
  transitionToWorkTimer
}) {

  const handleGoComprehension = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'comprehension') return;
    
    // Transition from play to work timer
    if (transitionToWorkTimer) {
      transitionToWorkTimer('comprehension');
    }
    
    let item = currentCompProblem;
    if (!item) {
      let firstComp = null;
      if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
        firstComp = generatedComprehension[currentCompIndex];
        setCurrentCompIndex(currentCompIndex + 1);
      }
      // REMOVED: drawSampleUnique fallback - sample array deprecated
      if (!firstComp && compPool.length) {
        firstComp = compPool[0];
        setCompPool(compPool.slice(1));
      }
      if (!firstComp) {
        const refilled = buildQAPool();
        if (Array.isArray(refilled) && refilled.length) { firstComp = refilled[0]; setCompPool(refilled.slice(1)); }
      }
      if (!firstComp) {
        if (Array.isArray(generatedComprehension) && generatedComprehension.length) {
          firstComp = generatedComprehension[currentCompIndex] || generatedComprehension[0];
          setCurrentCompIndex((currentCompIndex || 0) + 1);
        } else if (Array.isArray(compPool) && compPool.length) {
          firstComp = compPool[0]; setCompPool(compPool.slice(1));
        }
      }
      if (firstComp) { setCurrentCompProblem(firstComp); item = firstComp; setSubPhase('comprehension-active'); }
    }
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      const formatted = ensureQuestionMark(formatQuestionForSpeech(item, { layout: 'multiline' }));
      activeQuestionBodyRef.current = formatted;
      setCanSend(false);
      await speakFrontend(formatted, { mcLayout: 'multiline' });
    } catch {}
    setCanSend(true);
  }, [
    phase, currentCompProblem, generatedComprehension, currentCompIndex, compPool,
    setShowOpeningActions, setCurrentCompProblem, setSubPhase, setQaAnswersUnlocked, setCanSend,
    setCurrentCompIndex, setCompPool, activeQuestionBodyRef, speakFrontend, buildQAPool, transitionToWorkTimer
    // REMOVED: drawSampleUnique from deps - sample array deprecated
  ]);

  const handleGoExercise = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'exercise') return;
    
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
      // REMOVED: drawSampleUnique fallback - sample array deprecated
      if (!first && exercisePool.length) { const [head, ...rest] = exercisePool; first = head; setExercisePool(rest); }
      if (!first) { const refilled = buildQAPool(); if (refilled.length) { const [head, ...rest] = refilled; first = head; setExercisePool(rest); } }
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
      await speakFrontend(formatted, { mcLayout: 'multiline' });
    } catch {}
    setCanSend(true);
  }, [
    phase, currentExerciseProblem, generatedExercise, currentExIndex, exercisePool,
    setShowOpeningActions, setCurrentExerciseProblem, setSubPhase, setQaAnswersUnlocked, setCanSend,
    setCurrentExIndex, setExercisePool, activeQuestionBodyRef, speakFrontend, buildQAPool, transitionToWorkTimer
    // REMOVED: drawSampleUnique from deps - sample array deprecated
  ]);

  const handleGoWorksheet = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'worksheet') return;
    
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
