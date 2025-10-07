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

const ENCOURAGEMENT_SNIPPETS = [
  "You've got this",
  "Great job so far",
  "Nice work",
  "Keep going",
  "You're doing great",
  "Excellent progress"
];

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
  drawSampleUnique,
  buildQAPool
}) {

  const handleGoComprehension = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'comprehension') return;
    let item = currentCompProblem;
    if (!item) {
      let firstComp = null;
      if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
        let idx = currentCompIndex;
        while (idx < generatedComprehension.length && isShortAnswerItem(generatedComprehension[idx])) idx += 1;
        if (idx < generatedComprehension.length) { firstComp = generatedComprehension[idx]; setCurrentCompIndex(idx + 1); }
      }
      if (!firstComp) {
        let tries = 0; while (tries < 5) { const s = drawSampleUnique(); if (s && !isShortAnswerItem(s)) { firstComp = s; break; } tries += 1; }
      }
      if (!firstComp && compPool.length) {
        const filtered = compPool.filter(q => !isShortAnswerItem(q));
        if (filtered.length > 0) { firstComp = filtered[0]; setCompPool(compPool.slice(1)); }
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
    setCurrentCompIndex, setCompPool, activeQuestionBodyRef, speakFrontend, drawSampleUnique, buildQAPool
  ]);

  const handleGoExercise = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'exercise') return;
    let item = currentExerciseProblem;
    if (!item) {
      let first = null;
      if (Array.isArray(generatedExercise) && currentExIndex < generatedExercise.length) {
        let idx = currentExIndex;
        while (idx < generatedExercise.length && isShortAnswerItem(generatedExercise[idx])) idx += 1;
        if (idx < generatedExercise.length) { first = generatedExercise[idx]; setCurrentExIndex(idx + 1); }
      }
      if (!first) { let tries = 0; while (tries < 5) { const s = drawSampleUnique(); if (s && !isShortAnswerItem(s)) { first = s; break; } tries += 1; } }
      if (!first && exercisePool.length) { const [head, ...rest] = exercisePool; first = isShortAnswerItem(head) ? null : head; setExercisePool(rest); }
      if (!first) { const refilled = buildQAPool(); if (refilled.length) { const [head, ...rest] = refilled; first = head; setExercisePool(rest); } }
      if (first) { setCurrentExerciseProblem(first); item = first; setSubPhase('exercise-start'); }
    }
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      // Speak a quick encouragement right after Go, before the first Exercise question.
      const encouragement = ENCOURAGEMENT_SNIPPETS && ENCOURAGEMENT_SNIPPETS.length
        ? ENCOURAGEMENT_SNIPPETS[Math.floor(Math.random() * ENCOURAGEMENT_SNIPPETS.length)]
        : null;
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
    setCurrentExIndex, setExercisePool, activeQuestionBodyRef, speakFrontend, drawSampleUnique, buildQAPool
  ]);

  const handleGoWorksheet = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'worksheet') return;
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
  }, [phase, generatedWorksheet, setShowOpeningActions, setQaAnswersUnlocked, setCanSend, activeQuestionBodyRef, speakFrontend]);

  const handleGoTest = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'test') return;
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
  }, [phase, generatedTest, setShowOpeningActions, setQaAnswersUnlocked, setCanSend, activeQuestionBodyRef, speakFrontend]);

  // Handler: Start the lesson now (fallback/generic)
  const handleStartLesson = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
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
    speakFrontend, startThreeStageTeachingRef
  ]);

  return {
    handleGoComprehension,
    handleGoExercise,
    handleGoWorksheet,
    handleGoTest,
    handleStartLesson
  };
}
