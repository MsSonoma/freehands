/**
 * useDiscussionHandlers.js
 * Custom hook managing all Discussion phase interactive features:
 * - Jokes
 * - Riddles (with hint/reveal)
 * - Poems
 * - Stories (collaborative storytelling)
 * - Ask Questions (learner can ask Ms. Sonoma questions)
 */

import { useCallback } from 'react';
import { splitIntoSentences, mergeMcChoiceFragments, enforceNbspAfterMcLabels } from '../utils/textProcessing';
import { normalizeBase64Audio } from '../utils/audioUtils';
import { ensureQuestionMark, formatQuestionForSpeech } from '../utils/questionFormatting';
import { pickNextJoke, renderJoke } from '@/app/lib/jokes';
import { pickNextRiddle, renderRiddle } from '@/app/lib/riddles';

export function useDiscussionHandlers({
  // State setters
  setShowOpeningActions,
  setJokeUsedThisGate,
  setRiddleUsedThisGate,
  setPoemUsedThisGate,
  setStoryUsedThisGate,
  setCanSend,
  setAskState,
  setAskOriginalQuestion,
  setRiddleState,
  setCurrentRiddle,
  setPoemState,
  setStoryState,
  setStoryTranscript,
  setTtsLoadingCount,
  setIsSpeaking,
  setCaptionSentences,
  setCaptionIndex,
  setLearnerInput,
  setAbortKey,
  
  // State values
  jokeUsedThisGate,
  subjectParam,
  phase,
  subPhase,
  currentCompProblem,
  currentExerciseProblem,
  currentWorksheetIndex,
  generatedWorksheet,
  testActiveIndex,
  generatedTest,
  askOriginalQuestion,
  currentRiddle,
  storyTranscript,
  difficultyParam,
  lessonParam,
  
  // Refs
  captionSentencesRef,
  askReturnBodyRef,
  activeQuestionBodyRef,
  worksheetIndexRef,
  
  // Functions from parent component
  speakFrontend,
  callMsSonoma,
  playAudioFromBase64,
}) {
  
  // Joke handler
  const handleTellJoke = useCallback(async () => {
    if (jokeUsedThisGate) return;
    try { setShowOpeningActions(false); } catch {}
    try {
      const subjectKey = (subjectParam || 'math');
      const jokeObj = pickNextJoke(subjectKey);
      const text = renderJoke(jokeObj) || '';
      if (!text) { setShowOpeningActions(true); setJokeUsedThisGate(true); return; }
      
      let sentences = splitIntoSentences(text);
      sentences = mergeMcChoiceFragments(sentences).map((s) => enforceNbspAfterMcLabels(s));
      const prevLen = captionSentencesRef.current?.length || 0;
      const nextAll = [...(captionSentencesRef.current || []), ...sentences];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
      
      let dec = false;
      try {
        setTtsLoadingCount((c) => c + 1);
        let res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        if (!res.ok) {
          try { await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {}); } catch {}
          res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        }
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          let b64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
          if (b64) b64 = normalizeBase64Audio(b64);
          if (b64) {
            if (!dec) { setTtsLoadingCount((c) => Math.max(0, c - 1)); dec = true; }
            setIsSpeaking(true);
            try { await playAudioFromBase64(b64, sentences, prevLen); } catch {}
          } else {
            if (!dec) { setTtsLoadingCount((c) => Math.max(0, c - 1)); dec = true; }
            try { await playAudioFromBase64('', sentences, prevLen); } catch {}
          }
        }
      } finally {
        if (!dec) setTtsLoadingCount((c) => Math.max(0, c - 1));
      }
    } catch {}
    setJokeUsedThisGate(true);
    setTimeout(() => setShowOpeningActions(true), 400);
  }, [jokeUsedThisGate, subjectParam, captionSentencesRef, setCaptionSentences, setCaptionIndex, setTtsLoadingCount, setIsSpeaking, playAudioFromBase64, setShowOpeningActions, setJokeUsedThisGate]);

  // Ask Question handlers
  const handleAskQuestionStart = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
    const name = learnerName || 'friend';
    const prompt = `Yes, ${name} did you have a question?`;
    
    try {
      askReturnBodyRef.current = activeQuestionBodyRef.current || '';
    } catch {}
    
    setCanSend(true);
    setAskOriginalQuestion('');
    setAskState('awaiting-input');
    await speakFrontend(prompt);
  }, [setShowOpeningActions, askReturnBodyRef, activeQuestionBodyRef, setCanSend, setAskOriginalQuestion, setAskState, speakFrontend]);

  const handleAskConfirmYes = useCallback(() => {
    setAskState('inactive');
    setAskOriginalQuestion('');
    
    if (phase === 'discussion' && subPhase === 'awaiting-learner') {
      setShowOpeningActions(true);
    } else {
      setShowOpeningActions(false);
    }
    setCanSend(true);
    
    try {
      if (phase === 'teaching' && subPhase === 'awaiting-gate') {
        speakFrontend('Would you like me to go over the last section again?');
      } else if (
        (phase === 'comprehension' && currentCompProblem) ||
        (phase === 'exercise' && currentExerciseProblem) ||
        (phase === 'worksheet' && subPhase === 'worksheet-active') ||
        (phase === 'test' && subPhase === 'test-active')
      ) {
        try {
          let body = askReturnBodyRef.current || activeQuestionBodyRef.current || '';
          if (!body) {
            if (phase === 'comprehension' && currentCompProblem) {
              body = ensureQuestionMark(formatQuestionForSpeech(currentCompProblem, { layout: 'multiline' }));
            } else if (phase === 'exercise' && currentExerciseProblem) {
              body = ensureQuestionMark(formatQuestionForSpeech(currentExerciseProblem, { layout: 'multiline' }));
            } else if (phase === 'worksheet' && subPhase === 'worksheet-active') {
              const idx = (typeof worksheetIndexRef !== 'undefined' && worksheetIndexRef && typeof worksheetIndexRef.current === 'number') ? (worksheetIndexRef.current ?? 0) : (typeof currentWorksheetIndex === 'number' ? currentWorksheetIndex : 0);
              const list = Array.isArray(generatedWorksheet) ? generatedWorksheet : [];
              const item = list[idx] || null;
              if (item) {
                const num = (typeof idx === 'number' ? idx : 0) + 1;
                body = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
              }
            } else if (phase === 'test' && subPhase === 'test-active') {
              const list = Array.isArray(generatedTest) ? generatedTest : [];
              const idx = (typeof testActiveIndex === 'number' ? testActiveIndex : 0);
              const item = list[idx] || null;
              if (item) {
                const num = idx + 1;
                body = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
              }
            }
          }
          if (body) { speakFrontend(body); }
        } catch {}
        finally { askReturnBodyRef.current = ''; }
      }
    } catch {}
  }, [phase, subPhase, currentCompProblem, currentExerciseProblem, currentWorksheetIndex, generatedWorksheet, testActiveIndex, generatedTest, worksheetIndexRef, askReturnBodyRef, activeQuestionBodyRef, setAskState, setAskOriginalQuestion, setShowOpeningActions, setCanSend, speakFrontend]);

  const handleAskConfirmNo = useCallback(async () => {
    try { await speakFrontend('Try asking again a little bit differently.'); } catch {}
    setAskState('awaiting-input');
    setLearnerInput(askOriginalQuestion || '');
    setCanSend(true);
  }, [askOriginalQuestion, setAskState, setLearnerInput, setCanSend, speakFrontend]);

  const handleAskAnother = useCallback(() => {
    setLearnerInput('');
    setAskOriginalQuestion('');
    setAskState('awaiting-input');
    setCanSend(true);
  }, [setLearnerInput, setAskOriginalQuestion, setAskState, setCanSend]);

  const handleAskBack = useCallback(() => {
    setAskState('inactive');
    setAskOriginalQuestion('');
    
    if (phase === 'discussion' && subPhase === 'awaiting-learner') {
      setShowOpeningActions(true);
    } else {
      setShowOpeningActions(false);
    }
    setCanSend(true);
    
    try {
      if (phase === 'teaching' && subPhase === 'awaiting-gate') {
        speakFrontend('Would you like me to go over the last section again?');
      } else if (
        (phase === 'comprehension' && currentCompProblem) ||
        (phase === 'exercise' && currentExerciseProblem) ||
        (phase === 'worksheet' && subPhase === 'worksheet-active') ||
        (phase === 'test' && subPhase === 'test-active')
      ) {
        try {
          let body = askReturnBodyRef.current || activeQuestionBodyRef.current || '';
          if (!body) {
            if (phase === 'comprehension' && currentCompProblem) {
              body = ensureQuestionMark(formatQuestionForSpeech(currentCompProblem, { layout: 'multiline' }));
            } else if (phase === 'exercise' && currentExerciseProblem) {
              body = ensureQuestionMark(formatQuestionForSpeech(currentExerciseProblem, { layout: 'multiline' }));
            } else if (phase === 'worksheet' && subPhase === 'worksheet-active') {
              const idx = (typeof worksheetIndexRef !== 'undefined' && worksheetIndexRef && typeof worksheetIndexRef.current === 'number') ? (worksheetIndexRef.current ?? 0) : (typeof currentWorksheetIndex === 'number' ? currentWorksheetIndex : 0);
              const list = Array.isArray(generatedWorksheet) ? generatedWorksheet : [];
              const item = list[idx] || null;
              if (item) {
                const num = (typeof idx === 'number' ? idx : 0) + 1;
                body = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
              }
            } else if (phase === 'test' && subPhase === 'test-active') {
              const list = Array.isArray(generatedTest) ? generatedTest : [];
              const idx = (typeof testActiveIndex === 'number' ? testActiveIndex : 0);
              const item = list[idx] || null;
              if (item) {
                const num = idx + 1;
                body = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
              }
            }
          }
          if (body) { speakFrontend(body); }
        } catch {}
        finally { askReturnBodyRef.current = ''; }
      }
    } catch {}
  }, [phase, subPhase, currentCompProblem, currentExerciseProblem, currentWorksheetIndex, generatedWorksheet, testActiveIndex, generatedTest, worksheetIndexRef, askReturnBodyRef, activeQuestionBodyRef, setAskState, setAskOriginalQuestion, setShowOpeningActions, setCanSend, speakFrontend]);

  // Riddle handlers
  const handleTellRiddle = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    try { setRiddleUsedThisGate(true); } catch {}
    const pick = pickNextRiddle(subjectParam || 'math');
    if (!pick) {
      setShowOpeningActions(true);
      return;
    }
    const text = renderRiddle(pick) || '';
    setCurrentRiddle({ ...pick, text, answer: pick.answer });
    setRiddleState('presented');
    setCanSend(false);
    try { setAbortKey((k) => k + 1); } catch {}
    await speakFrontend(`Here is a riddle. ${text}`);
    setRiddleState('awaiting-solve');
  }, [subjectParam, setShowOpeningActions, setRiddleUsedThisGate, setCurrentRiddle, setRiddleState, setCanSend, setAbortKey, speakFrontend]);

  const judgeRiddleAttempt = useCallback(async (_attempt) => {
    return { ok: false, text: '' };
  }, []);

  const requestRiddleHint = useCallback(async () => {
    if (!currentRiddle) return;
    const instruction = `You are Ms. Sonoma. Give a tiny hint (one short sentence) for this riddle without revealing the answer. Riddle: "${currentRiddle.text}". Correct answer: "${currentRiddle.answer}". Keep it playful and encouraging.`;
    const result = await callMsSonoma(instruction, '', { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, step: 'riddle-hint' }, { fastReturn: true }).catch(() => null);
    const line = (result && result.text) ? result.text : 'Here is a small hint.';
    await speakFrontend(line);
    setRiddleState('awaiting-solve');
  }, [currentRiddle, subjectParam, difficultyParam, lessonParam, callMsSonoma, speakFrontend, setRiddleState]);

  const revealRiddleAnswer = useCallback(async () => {
    if (!currentRiddle) return;
    await speakFrontend(`The answer is: ${currentRiddle.answer}. Nice thinking. Let us jump back to our options.`);
    setCurrentRiddle(null);
    setRiddleState('inactive');
    setShowOpeningActions(true);
    setCanSend(true);
  }, [currentRiddle, speakFrontend, setCurrentRiddle, setRiddleState, setShowOpeningActions, setCanSend]);

  const handleRiddleBack = useCallback(() => {
    setCurrentRiddle(null);
    setRiddleState('inactive');
    try { setShowOpeningActions(true); } catch {}
    try { setCanSend(true); } catch {}
  }, [setCurrentRiddle, setRiddleState, setShowOpeningActions, setCanSend]);

  // Poem handlers
  const handlePoemStart = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    try { setPoemUsedThisGate(true); } catch {}
    setPoemState('awaiting-topic');
    setCanSend(true);
    await speakFrontend('What would you like the poem to be about?');
  }, [setShowOpeningActions, setPoemUsedThisGate, setPoemState, setCanSend, speakFrontend]);

  const handlePoemOk = useCallback(() => {
    setPoemState('inactive');
    setShowOpeningActions(true);
    setCanSend(true);
  }, [setPoemState, setShowOpeningActions, setCanSend]);

  // Story handlers
  const handleStoryStart = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    try { setStoryUsedThisGate(true); } catch {}
    setStoryTranscript([]);
    setStoryState('awaiting-turn');
    setCanSend(true);
    await speakFrontend('Start the story and I will pick up from where you leave off.');
  }, [setShowOpeningActions, setStoryUsedThisGate, setStoryTranscript, setStoryState, setCanSend, speakFrontend]);

  const handleStoryYourTurn = useCallback(async (inputValue) => {
    const trimmed = String(inputValue ?? '').trim();
    if (!trimmed) return;
    setCanSend(false);
    
    const updatedTranscript = [...storyTranscript, { role: 'user', text: trimmed }];
    
    try {
      const prevLen = captionSentencesRef.current?.length || 0;
      const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
    } catch {}
    
    const storyContext = updatedTranscript.length > 0
      ? 'Story so far: ' + updatedTranscript.map(turn => 
          turn.role === 'user' ? `Child: "${turn.text}"` : `You: "${turn.text}"`
        ).join(' ')
      : '';
    
    const instruction = [
      'You are Ms. Sonoma talking to a 5 year old.',
      'You are telling a collaborative story in turns.',
      storyContext,
      `The child just said: "${trimmed.replace(/["]/g, "'")}"`,
      'Continue the story playfully in 2-3 short sentences.',
      'Build naturally on what came before.',
      'Make it fun and age-appropriate for a child.',
      'Do not end the story yet.'
    ].filter(Boolean).join(' ');
    
    let responseText = 'What happens next?';
    try {
      const res = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '' })
      });
      if (res.ok) {
        const data = await res.json();
        responseText = (data && data.reply) ? data.reply : responseText;
      }
    } catch (err) {
      console.warn('[Story] API call failed:', err);
    }
    
    setStoryTranscript([...updatedTranscript, { role: 'assistant', text: responseText }]);
    setStoryState('awaiting-turn');
    await speakFrontend(responseText);
    setCanSend(true);
  }, [storyTranscript, captionSentencesRef, setCaptionSentences, setCaptionIndex, setStoryTranscript, setStoryState, setCanSend, speakFrontend]);

  const handleStoryEnd = useCallback(async (inputValue, endingType = 'happy') => {
    const trimmed = String(inputValue ?? '').trim();
    setCanSend(false);
    
    let updatedTranscript = [...storyTranscript];
    if (trimmed) {
      updatedTranscript = [...updatedTranscript, { role: 'user', text: trimmed }];
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
    }
    
    const storyContext = updatedTranscript.length > 0
      ? 'Story so far: ' + updatedTranscript.map(turn => 
          turn.role === 'user' ? `Child: "${turn.text}"` : `You: "${turn.text}"`
        ).join(' ')
      : '';
    
    const userPart = trimmed ? `The child just said: "${trimmed.replace(/["]/g, "'")}"` : '';
    const endingInstruction = endingType === 'funny' 
      ? 'Wrap up the story with a funny and silly conclusion in 2-3 short sentences. Make it unexpected and amusing for a child.'
      : 'Wrap up the story with a playful conclusion in 2-3 short sentences. Make the ending happy and satisfying for a child.';
    const instruction = [
      'You are Ms. Sonoma talking to a 5 year old.',
      'You are ending a collaborative story.',
      storyContext,
      userPart,
      endingInstruction
    ].filter(Boolean).join(' ');
    
    let responseText = 'And they all lived happily ever after. The end.';
    try {
      const res = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '' })
      });
      if (res.ok) {
        const data = await res.json();
        responseText = (data && data.reply) ? data.reply : responseText;
      }
    } catch (err) {
      console.warn('[Story] API call failed:', err);
    }
    
    setStoryTranscript([]);
    await speakFrontend(responseText);
    setStoryState('inactive');
    setShowOpeningActions(true);
    setCanSend(true);
  }, [storyTranscript, captionSentencesRef, setCaptionSentences, setCaptionIndex, setStoryTranscript, setCanSend, speakFrontend, setStoryState, setShowOpeningActions]);

  return {
    // Exported handlers
    handleTellJoke,
    handleAskQuestionStart,
    handleAskConfirmYes,
    handleAskConfirmNo,
    handleAskAnother,
    handleAskBack,
    handleTellRiddle,
    judgeRiddleAttempt,
    requestRiddleHint,
    revealRiddleAnswer,
    handleRiddleBack,
    handlePoemStart,
    handlePoemOk,
    handleStoryStart,
    handleStoryYourTurn,
    handleStoryEnd,
  };
}
