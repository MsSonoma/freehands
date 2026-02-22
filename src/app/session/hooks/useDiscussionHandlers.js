/**
 * useDiscussionHandlers.js
 * Custom hook managing all Discussion phase interactive features:
 * - Jokes
 * - Riddles (with hint/reveal)
 * - Poems
 * - Stories (collaborative storytelling)
 * - Fill-in-Fun (word game similar to Mad Libs)
 * - Ask Questions (learner can ask Ms. Sonoma questions)
 */

import { useCallback } from 'react';
import { splitIntoSentences, mergeMcChoiceFragments, enforceNbspAfterMcLabels } from '../utils/textProcessing';
import { normalizeBase64Audio } from '../utils/audioUtils';
import { ensureQuestionMark, formatQuestionForSpeech } from '../utils/questionFormatting';
import { pickNextJoke, renderJoke } from '@/app/lib/jokes';
import { pickNextRiddle, renderRiddle } from '@/app/lib/riddles';
import { getGradeAndDifficultyStyle } from '../utils/constants';

export function useDiscussionHandlers({
  // State setters
  setShowOpeningActions,
  setCanSend,
  setLoading,
  setAskState,
  setAskOriginalQuestion,
  setRiddleState,
  setCurrentRiddle,
  setPoemState,
  setShowPoemSuggestions,
  setStoryState,
  setStoryTranscript,
  setStorySetupStep,
  setStoryCharacters,
  setStorySetting,
  setStoryPlot,
  setStoryPhase,
  setFillInFunState,
  setFillInFunTemplate,
  setFillInFunCollectedWords,
  setFillInFunCurrentIndex,
  setTtsLoadingCount,
  setIsSpeaking,
  setCaptionSentences,
  setCaptionIndex,
  setLearnerInput,
  setAbortKey,
  
  // State values
  subjectParam,
  lessonData,
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
  storySetupStep,
  storyCharacters,
  storySetting,
  storyPlot,
  storyPhase,
  fillInFunTemplate,
  fillInFunCollectedWords,
  fillInFunCurrentIndex,
  difficultyParam,
  lessonParam,
  learnerGrade = '',
  
  // Refs
  captionSentencesRef,
  askReturnBodyRef,
  activeQuestionBodyRef,
  worksheetIndexRef,
  
  // Functions from parent component
  speakFrontend,
  callMsSonoma,
  playAudioFromBase64,
  
  // Golden key flag
  hasGoldenKey = false,
}) {
  
  // Joke handler
  const handleTellJoke = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    try {
      // Use lessonData.subject if available, otherwise fall back to subjectParam
      let subjectKey = (lessonData?.subject || subjectParam || 'math').toLowerCase();
      const validSubjects = ['math', 'science', 'language arts', 'social studies'];
      if (!validSubjects.includes(subjectKey)) {
        subjectKey = 'math';
      }
      const jokeObj = pickNextJoke(subjectKey);
      const text = renderJoke(jokeObj) || '';
      if (!text) { setShowOpeningActions(true); return; }
      
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
    setTimeout(() => setShowOpeningActions(true), 400);
  }, [subjectParam, lessonData, captionSentencesRef, setCaptionSentences, setCaptionIndex, setTtsLoadingCount, setIsSpeaking, playAudioFromBase64, setShowOpeningActions]);

  // Ask Question handlers
  const handleAskQuestionStart = useCallback(async () => {
    // Save snapshot to prevent infinite play timer hack via refresh
    // This fires when user clicks Ask (or any button other than Begin)
    try { scheduleSaveSnapshot('ask-question-start'); } catch {}
    
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
    
    // Show opening actions in discussion phase or Q&A entrance states (before Go is clicked)
    // Hide them only when actively answering questions (currentProblem exists)
    const inDiscussion = (phase === 'discussion' && subPhase === 'awaiting-learner');
    const inActiveQA = (
      (phase === 'comprehension' && currentCompProblem) ||
      (phase === 'exercise' && currentExerciseProblem) ||
      (phase === 'worksheet' && currentWorksheetIndex >= 0 && generatedWorksheet && generatedWorksheet.length > 0) ||
      (phase === 'test' && testActiveIndex >= 0 && generatedTest && generatedTest.length > 0)
    );
    
    if (inDiscussion || !inActiveQA) {
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
    
    // Show opening actions in discussion phase or Q&A entrance states (before Go is clicked)
    // Hide them only when actively answering questions (currentProblem exists)
    const inDiscussion = (phase === 'discussion' && subPhase === 'awaiting-learner');
    const inActiveQA = (
      (phase === 'comprehension' && currentCompProblem) ||
      (phase === 'exercise' && currentExerciseProblem) ||
      (phase === 'worksheet' && currentWorksheetIndex >= 0 && generatedWorksheet && generatedWorksheet.length > 0) ||
      (phase === 'test' && testActiveIndex >= 0 && generatedTest && generatedTest.length > 0)
    );
    
    if (inDiscussion || !inActiveQA) {
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
    // Use lessonData.subject if available, otherwise fall back to subjectParam
    let subject = (lessonData?.subject || subjectParam || 'math').toLowerCase();
    const validSubjects = ['math', 'science', 'language arts', 'social studies', 'general'];
    if (!validSubjects.includes(subject)) {
      subject = 'math';
    }
    const pick = pickNextRiddle(subject);
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
  }, [subjectParam, lessonData, setShowOpeningActions, setCurrentRiddle, setRiddleState, setCanSend, setAbortKey, speakFrontend]);

  const judgeRiddleAttempt = useCallback(async (_attempt) => {
    return { ok: false, text: '' };
  }, []);

  const requestRiddleHint = useCallback(async () => {
    if (!currentRiddle) return;
    const instruction = `You are Ms. Sonoma. Give a tiny hint (one short sentence) for this riddle without revealing the answer. Riddle: "${currentRiddle.text}". Correct answer: "${currentRiddle.answer}". Keep it playful and encouraging.`;
    const result = await callMsSonoma(instruction, '', { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, step: 'riddle-hint' }, { fastReturn: true }).catch(() => null);
    // Backend already synthesizes and plays audio via fastReturn; no need to call speakFrontend again
    if (!result || !result.text) {
      // Fallback only if API call failed
      await speakFrontend('Here is a small hint.');
    }
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
    // Golden key only affects timer bonus, not access to poems
    try { setShowOpeningActions(false); } catch {}
    setPoemState('awaiting-topic');
    setShowPoemSuggestions(true);
    setCanSend(true);
    await speakFrontend('What would you like the poem to be about?');
  }, [setShowOpeningActions, setPoemState, setShowPoemSuggestions, setCanSend, speakFrontend]);

  const handlePoemSuggestions = useCallback(async () => {
    setShowPoemSuggestions(false);
    await speakFrontend('You could ask for a poem about your favorite animal, a fun adventure, or something you learned today.');
  }, [setShowPoemSuggestions, speakFrontend]);

  const handlePoemOk = useCallback(() => {
    setPoemState('inactive');
    setShowPoemSuggestions(false);
    setShowOpeningActions(true);
    setCanSend(true);
  }, [setPoemState, setShowPoemSuggestions, setShowOpeningActions, setCanSend]);

  const handlePoemBack = useCallback(() => {
    setPoemState('inactive');
    setShowPoemSuggestions(false);
    try { setShowOpeningActions(true); } catch {}
    try { setCanSend(true); } catch {}
  }, [setPoemState, setShowPoemSuggestions, setShowOpeningActions, setCanSend]);

  // Story handlers
  const handleStoryStart = useCallback(async () => {
    // Golden key only affects timer bonus, not access to stories
    try { setShowOpeningActions(false); } catch {}
    
    // Check if this is a continuation from a previous phase
    if (storyTranscript.length > 0) {
      try { setLoading(true); } catch {}
      
      // Determine the prompt based on actual phase
      const isTestPhase = phase === 'test' || subPhase === 'test-active';
      
      if (isTestPhase) {
        // Test phase: ask for ending
        // Generate a brief paraphrased summary using AI
        const lastAssistant = [...storyTranscript].reverse().find(t => t.role === 'assistant');
        let briefSummary = 'Let me remind you where we left off in our story.';
        
        if (lastAssistant) {
          const summaryInstruction = [
            `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(learnerGrade, difficultyParam)}`,
            `Briefly paraphrase this story part in 1-2 short sentences: "${lastAssistant.text.replace(/To be continued\.?/i, '').trim()}"`,
            'Keep it simple and exciting.',
            'Do not add "To be continued."'
          ].filter(Boolean).join(' ');
          
          try {
            const res = await fetch('/api/sonoma', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instruction: summaryInstruction, innertext: '', skipAudio: true })
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.reply) {
                briefSummary = data.reply.trim();
              }
            }
          } catch (err) {
            // Summary generation failed - use fallback
          }
        }
        
        try { setLoading(false); } catch {}
        setStoryState('awaiting-turn');
        await speakFrontend(`${briefSummary} How would you like the story to end?`);
        setCanSend(true);
      } else {
        // Comprehension, Exercise, Worksheet: suggest story possibilities
        // Generate a brief paraphrased summary using AI
        const lastAssistant = [...storyTranscript].reverse().find(t => t.role === 'assistant');
        let briefSummary = 'Let me remind you where we left off.';
        
        if (lastAssistant) {
          const summaryInstruction = [
            `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(learnerGrade, difficultyParam)}`,
            `Briefly paraphrase this story part in 1-2 short sentences: "${lastAssistant.text.replace(/To be continued\.?/i, '').trim()}"`,
            'Keep it simple and exciting.',
            'Do not add "To be continued."'
          ].filter(Boolean).join(' ');
          
          try {
            const res = await fetch('/api/sonoma', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instruction: summaryInstruction, innertext: '', skipAudio: true })
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.reply) {
                briefSummary = data.reply.trim();
              }
            }
          } catch (err) {
            // Summary generation failed - use fallback
          }
        }
        
        // Generate story suggestions using AI
        const storyContext = storyTranscript.length > 0
          ? 'Story so far: ' + storyTranscript.slice(-4).map(turn => 
              turn.role === 'user' ? `Child: "${turn.text}"` : `You: "${turn.text}"`
            ).join(' ')
          : '';
        
        const suggestionInstruction = [
          `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(learnerGrade, difficultyParam)}`,
          storyContext,
          'Suggest 3 brief, exciting story possibilities for what could happen next.',
          'Keep each suggestion to 4-6 words maximum.',
          'Make them fun and age-appropriate.',
          'Format as: "You could say: [option 1], or [option 2], or [option 3]."'
        ].filter(Boolean).join(' ');
        
        let suggestions = 'You could say: the hero finds treasure, or a friend appears, or something magical happens.';
        try {
          const res = await fetch('/api/sonoma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction: suggestionInstruction, innertext: '', skipAudio: true })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.reply) {
              suggestions = data.reply;
            }
          }
        } catch (err) {
          // Suggestions generation failed - use fallback
        }
        
        try { setLoading(false); } catch {}
        setStoryState('awaiting-turn');
        await speakFrontend(`${briefSummary} What would you like to happen next? ${suggestions}`);
        setCanSend(true);
      }
    } else {
      // New story - start with setup
      setStoryTranscript([]);
      setStoryCharacters('');
      setStorySetting('');
      setStoryPlot('');
      setStorySetupStep('characters');
      setStoryPhase(phase); // Track which phase the story started in
      setStoryState('awaiting-setup');
      await speakFrontend('Who are the characters in the story?');
      setCanSend(true);
    }
  }, [
    setShowOpeningActions, setStoryTranscript, setStoryState, 
    setStorySetupStep, setStoryCharacters, setStorySetting, setStoryPlot, setStoryPhase,
    setCanSend, setLoading, speakFrontend, storyTranscript, phase, subPhase, learnerGrade, difficultyParam
  ]);

  const handleStoryYourTurn = useCallback(async (inputValue) => {
    const trimmed = String(inputValue ?? '').trim();
    if (!trimmed) return;
    setCanSend(false);
    
    // Handle setup phase
    if (storySetupStep === 'characters') {
      setStoryCharacters(trimmed);
      setStorySetupStep('setting');
      
      // Add user's characters input to captions in red
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: `Characters: ${trimmed}`, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
      
      await speakFrontend('Where does the story take place?');
      setCanSend(true);
      return;
    }
    
    if (storySetupStep === 'setting') {
      setStorySetting(trimmed);
      setStorySetupStep('plot');
      
      // Add user's setting input to captions in red
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: `Setting: ${trimmed}`, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
      
      await speakFrontend('What happens in the story?');
      setCanSend(true);
      return;
    }
    
    if (storySetupStep === 'plot') {
      setStoryPlot(trimmed);
      setStorySetupStep('complete');
      
      // Add user's plot input to captions in red
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: `Plot: ${trimmed}`, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
      
      // Now generate the first part of the story with all setup info
      const instruction = [
        `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(learnerGrade, difficultyParam)}`,
        'You are starting a collaborative story.',
        `The characters are: ${storyCharacters}`,
        `The setting is: ${storySetting}`,
        `The plot involves: ${trimmed}`,
        'Tell the first part of the story in 4-6 sentences.',
        'Follow the child\'s ideas closely and make the story about what they want unless it\'s inappropriate.',
        'Make it fun and age-appropriate for a child.',
        'End by saying "To be continued."'
      ].filter(Boolean).join(' ');
      
      let responseText = 'Once upon a time. To be continued.';
      try {
        const res = await fetch('/api/sonoma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction, innertext: '', skipAudio: true })
        });
        if (res.ok) {
          const data = await res.json();
          responseText = (data && data.reply) ? data.reply : responseText;
        }
      } catch (err) {
        // API call failed - use fallback responseText
      }
      
      const setupTranscript = [
        { role: 'user', text: `Characters: ${storyCharacters}` },
        { role: 'user', text: `Setting: ${storySetting}` },
        { role: 'user', text: `Plot: ${trimmed}` },
        { role: 'assistant', text: responseText }
      ];
      setStoryTranscript(setupTranscript);
      setStoryState('inactive');
      await speakFrontend(responseText);
      setShowOpeningActions(true);
      setCanSend(true);
      return;
    }
    
    // Handle story continuation
    const updatedTranscript = [...storyTranscript, { role: 'user', text: trimmed }];
    
    try {
      const prevLen = captionSentencesRef.current?.length || 0;
      const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
    } catch {}
    
    // Check if this is the test phase (should end the story)
    const isTestPhase = phase === 'test' || subPhase === 'test-active';
    
    const storyContext = updatedTranscript.length > 0
      ? 'Story so far: ' + updatedTranscript.map(turn => 
          turn.role === 'user' ? `Child: "${turn.text}"` : `You: "${turn.text}"`
        ).join(' ')
      : '';
    
    const instruction = isTestPhase
      ? [
          `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(learnerGrade, difficultyParam)}`,
          'You are ending a collaborative story.',
          storyContext,
          `The child wants the story to end like this: "${trimmed.replace(/["]/g, "'")}"`,
          'End the story based on their idea in 4-6 sentences.',
          'Follow the child\'s ideas closely and make the ending about what they want unless it\'s inappropriate.',
          'Make it satisfying and age-appropriate for a child.',
          'Say "The end." at the very end.'
        ].filter(Boolean).join(' ')
      : [
          `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(learnerGrade, difficultyParam)}`,
          'You are telling a collaborative story in turns.',
          storyContext,
          `The child just said: "${trimmed.replace(/["]/g, "'")}"`,
          'Continue the story in 4-6 sentences.',
          'Follow the child\'s ideas closely and make the story about what they want unless it\'s inappropriate.',
          'Build naturally on what came before.',
          'Make it fun and age-appropriate for a child.',
          'End by saying "To be continued."'
        ].filter(Boolean).join(' ');
    
    let responseText = isTestPhase ? 'And they all lived happily ever after. The end.' : 'What happens next? To be continued.';
    try {
      const res = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '', skipAudio: true })
      });
      if (res.ok) {
        const data = await res.json();
        responseText = (data && data.reply) ? data.reply : responseText;
      }
    } catch (err) {
      // API call failed - use fallback responseText
    }
    
    setStoryTranscript([...updatedTranscript, { role: 'assistant', text: responseText }]);
    
    // Add assistant's response to captions with role='assistant' so it doesn't show in red
    try {
      const prevLen = captionSentencesRef.current?.length || 0;
      const nextAll = [...(captionSentencesRef.current || []), { text: responseText, role: 'assistant' }];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
    } catch {}
    
    if (isTestPhase) {
      // Story ends in test phase - add thank you message
      setStoryState('inactive');
      setStoryTranscript([]); // Clear for next session
      setStorySetupStep('');
      setStoryCharacters('');
      setStorySetting('');
      setStoryPlot('');
      setStoryPhase('');
      await speakFrontend(responseText, { noCaptions: true });
      // Add thank you message after the story ends
      await speakFrontend('Thanks for helping me tell this story.');
      setShowOpeningActions(true);
      setCanSend(true);
    } else {
      // Story continues
      setStoryState('inactive');
      await speakFrontend(responseText, { noCaptions: true });
      setShowOpeningActions(true);
      setCanSend(true);
    }
  }, [
    storyTranscript, storySetupStep, storyCharacters, storySetting, storyPlot, phase, subPhase,
    captionSentencesRef, setCaptionSentences, setCaptionIndex, setStoryTranscript, setStoryState,
    setStorySetupStep, setStoryCharacters, setStorySetting, setStoryPlot, setStoryPhase,
    setCanSend, setShowOpeningActions, speakFrontend
  ]);

  const handleStoryEnd = useCallback(async (inputValue, endingType = 'happy') => {
    // This function is kept for backward compatibility but is no longer used
    // Story endings are now handled through handleStoryYourTurn in test phase
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
    
    const userPart = trimmed ? `The child wants the story to end like this: "${trimmed.replace(/["]/g, "'")}"` : '';
    const instruction = [
      `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(learnerGrade, difficultyParam)}`,
      'You are ending a collaborative story.',
      storyContext,
      userPart,
      'End the story based on their idea in 2-3 short sentences.',
      'Follow the child\'s ideas closely and make the ending about what they want unless it\'s inappropriate.',
      'Make it satisfying and age-appropriate for a child.',
      'Say "The end." at the very end.'
    ].filter(Boolean).join(' ');
    
    let responseText = 'And they all lived happily ever after. The end.';
    try {
      const res = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '', skipAudio: true })
      });
      if (res.ok) {
        const data = await res.json();
        responseText = (data && data.reply) ? data.reply : responseText;
      }
    } catch (err) {
      // API call failed - use fallback responseText
    }
    
    setStoryTranscript([]);
    setStorySetupStep('');
    setStoryCharacters('');
    setStorySetting('');
    setStoryPlot('');
    setStoryPhase('');
    await speakFrontend(responseText);
    setStoryState('inactive');
    setShowOpeningActions(true);
    setCanSend(true);
  }, [
    storyTranscript, captionSentencesRef, setCaptionSentences, setCaptionIndex, 
    setStoryTranscript, setStorySetupStep, setStoryCharacters, setStorySetting, 
    setStoryPlot, setStoryPhase, setCanSend, speakFrontend, setStoryState, setShowOpeningActions
  ]);

  const handleStoryBack = useCallback(() => {
    setStoryTranscript([]);
    setStorySetupStep('');
    setStoryCharacters('');
    setStorySetting('');
    setStoryPlot('');
    setStoryPhase('');
    setStoryState('inactive');
    try { setShowOpeningActions(true); } catch {}
    try { setCanSend(true); } catch {}
  }, [
    setStoryTranscript, setStorySetupStep, setStoryCharacters, setStorySetting,
    setStoryPlot, setStoryPhase, setStoryState, setShowOpeningActions, setCanSend
  ]);

  // Fill-in-Fun handlers
  const handleFillInFunStart = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    setFillInFunState('loading');
    setCanSend(false);
    
    await speakFrontend('Let me create a fun fill-in story for you!');
    
    // Show loading screen while generating template
    setLoading(true);
    
    try {
      // Call the API to generate a template
      const subject = lessonData?.subject || subjectParam || 'general';
      const lessonTitle = lessonData?.title || '';
      
      const response = await fetch('/api/fill-in-fun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, lessonTitle })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate template');
      }
      
      const data = await response.json();
      
      setFillInFunTemplate(data);
      setFillInFunCollectedWords({});
      setFillInFunCurrentIndex(0);
      setFillInFunState('collecting-words');
      setLoading(false);
      
      // Ask for the first word
      const firstWord = data.words[0];
      await speakFrontend(`Give me ${firstWord.prompt}.`);
      setCanSend(true);
      
    } catch (error) {
      // Error generating template - use fallback
      setLoading(false);
      await speakFrontend('Oops! Something went wrong. Let us try something else.');
      setFillInFunState('inactive');
      setShowOpeningActions(true);
      setCanSend(true);
    }
  }, [
    lessonData, subjectParam, speakFrontend,
    setShowOpeningActions, setFillInFunState, setFillInFunTemplate,
    setFillInFunCollectedWords, setFillInFunCurrentIndex,
    setCanSend, setLoading
  ]);

  const handleFillInFunWordSubmit = useCallback(async (inputValue) => {
    const trimmed = String(inputValue ?? '').trim();
    if (!trimmed || !fillInFunTemplate) return;
    
    setCanSend(false);
    
    const currentWord = fillInFunTemplate.words[fillInFunCurrentIndex];
    const newCollected = {
      ...fillInFunCollectedWords,
      [currentWord.label]: trimmed
    };
    setFillInFunCollectedWords(newCollected);
    
    // Add user's word to captions in red
    try {
      const prevLen = captionSentencesRef.current?.length || 0;
      const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
    } catch {}
    
    const nextIndex = fillInFunCurrentIndex + 1;
    
    if (nextIndex < fillInFunTemplate.words.length) {
      // Ask for next word
      setFillInFunCurrentIndex(nextIndex);
      const nextWord = fillInFunTemplate.words[nextIndex];
      await speakFrontend(`Great! Now give me ${nextWord.prompt}.`);
      setCanSend(true);
    } else {
      // All words collected - substitute and read the story
      let finalStory = fillInFunTemplate.template;
      
      // Replace all placeholders with collected words
      Object.keys(newCollected).forEach(label => {
        const regex = new RegExp(`\\{${label}\\}`, 'g');
        finalStory = finalStory.replace(regex, newCollected[label]);
      });
      
      setFillInFunState('awaiting-ok');
      await speakFrontend(`Here is your story! ${finalStory}`);
      // Don't set canSend(true) - wait for Ok button
    }
  }, [
    fillInFunTemplate, fillInFunCurrentIndex, fillInFunCollectedWords,
    captionSentencesRef, setCaptionSentences, setCaptionIndex,
    setFillInFunCollectedWords, setFillInFunCurrentIndex, setFillInFunState,
    setCanSend, speakFrontend
  ]);

  const handleFillInFunOk = useCallback(() => {
    setFillInFunState('inactive');
    setFillInFunTemplate(null);
    setFillInFunCollectedWords({});
    setFillInFunCurrentIndex(0);
    try { setShowOpeningActions(true); } catch {}
    try { setCanSend(true); } catch {}
  }, [
    setFillInFunState, setFillInFunTemplate, setFillInFunCollectedWords,
    setFillInFunCurrentIndex, setShowOpeningActions, setCanSend
  ]);

  const handleFillInFunBack = useCallback(() => {
    setFillInFunState('inactive');
    setFillInFunTemplate(null);
    setFillInFunCollectedWords({});
    setFillInFunCurrentIndex(0);
    try { setShowOpeningActions(true); } catch {}
    try { setCanSend(true); } catch {}
  }, [
    setFillInFunState, setFillInFunTemplate, setFillInFunCollectedWords,
    setFillInFunCurrentIndex, setShowOpeningActions, setCanSend
  ]);

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
    handlePoemSuggestions,
    handlePoemOk,
    handlePoemBack,
    handleStoryStart,
    handleStoryYourTurn,
    handleStoryEnd,
    handleStoryBack,
    handleFillInFunStart,
    handleFillInFunWordSubmit,
    handleFillInFunOk,
    handleFillInFunBack,
  };
}
