/**
 * useTeachingFlow.js
 * 
 * Custom hook managing the two-stage teaching flow (Definitions → Examples).
 * Handles stage progression, repeat logic, and gate transitions.
 * Supports sentence-by-sentence gating for vocab definitions.
 */

import { useState, useRef, useCallback } from 'react';
import { ttsCache } from '../utils/ttsCache';

export function useTeachingFlow({
  // State setters
  setCanSend,
  setSubPhase,
  setPhase,
  setTeachingStage,
  setTeachingGateLocked,
  setStageRepeats,
  setCaptionSentences,
  setCaptionIndex,
  setTtsLoadingCount,
  setCurrentCompProblem,
  
  // State values
  teachingStage,
  
  // Refs
  captionSentencesRef,
  
  // API & utilities
  callMsSonoma,
  speakFrontend,
  playAudioFromBase64,
  scheduleSaveSnapshot,
  ensureLessonDataReady,
  getAvailableVocab,
  getGradeNumber,
  getCleanLessonTitle,
  getTeachingNotes,
  splitIntoSentences,
  mergeMcChoiceFragments,
  enforceNbspAfterMcLabels,
  
  // Timer functions
  markWorkPhaseComplete,
  
  // Lesson context
  subjectParam,
  difficultyParam,
  lessonParam,
  effectiveLessonTitle,
  
  // Constants
  COMPREHENSION_CUE_PHRASE,
}) {
  
  // Sentence-by-sentence gating state for vocab definitions
  const [vocabSentences, setVocabSentences] = useState([]);
  const [vocabSentenceIndex, setVocabSentenceIndex] = useState(0);
  const [isInSentenceMode, setIsInSentenceMode] = useState(false); // Track if navigating sentences vs final gate
  const vocabSentencesRef = useRef([]);
  const vocabSentenceIndexRef = useRef(0);
  const isInSentenceModeRef = useRef(false);
  
  // Sentence-by-sentence gating state for examples
  const [exampleSentences, setExampleSentences] = useState([]);
  const [exampleSentenceIndex, setExampleSentenceIndex] = useState(0);
  const exampleSentencesRef = useRef([]);
  const exampleSentenceIndexRef = useRef(0);
  
  // Prefetch promise for examples GPT content (loaded in background during definitions gate)
  const examplesGptPromiseRef = useRef(null);
  
  const getTeachingFlowSnapshot = useCallback(() => {
    return {
      vocabSentences: Array.isArray(vocabSentencesRef.current)
        ? vocabSentencesRef.current.filter((s) => typeof s === 'string' && s.trim().length)
        : [],
      vocabSentenceIndex: Math.max(0, Number(vocabSentenceIndexRef.current) || 0),
      exampleSentences: Array.isArray(exampleSentencesRef.current)
        ? exampleSentencesRef.current.filter((s) => typeof s === 'string' && s.trim().length)
        : [],
      exampleSentenceIndex: Math.max(0, Number(exampleSentenceIndexRef.current) || 0),
      isInSentenceMode: !!isInSentenceModeRef.current,
    };
  }, []);

  const applyTeachingFlowSnapshot = useCallback((snap) => {
    const safeArray = (arr) => (
      Array.isArray(arr)
        ? arr.map((s) => (typeof s === 'string' ? s : '')).filter((s) => s && s.trim())
        : []
    );
    const vocabList = safeArray(snap?.vocabSentences);
    const vocabIdx = Math.min(
      vocabList.length > 0 ? vocabList.length - 1 : 0,
      Math.max(0, Number(snap?.vocabSentenceIndex) || 0)
    );
    vocabSentencesRef.current = vocabList;
    setVocabSentences(vocabList);
    vocabSentenceIndexRef.current = vocabIdx;
    setVocabSentenceIndex(vocabIdx);

    const exampleList = safeArray(snap?.exampleSentences);
    const exampleIdx = Math.min(
      exampleList.length > 0 ? exampleList.length - 1 : 0,
      Math.max(0, Number(snap?.exampleSentenceIndex) || 0)
    );
    exampleSentencesRef.current = exampleList;
    setExampleSentences(exampleList);
    exampleSentenceIndexRef.current = exampleIdx;
    setExampleSentenceIndex(exampleIdx);

    const inSentence = !!snap?.isInSentenceMode;
    isInSentenceModeRef.current = inSentence;
    setIsInSentenceMode(inSentence);
  }, []);
  
  /**
   * Prefetch examples GPT content in background
   * Called after sample questions finish loading during definitions gate
   */
  const prefetchExamplesContent = useCallback(async () => {
    // Don't prefetch if already loading or loaded
    if (examplesGptPromiseRef.current) {
      console.log('[TEACHING] Examples GPT already prefetching/loaded, skipping');
      return;
    }
    
    console.log('[TEACHING] Starting examples GPT prefetch');
    
    const lessonTitle = getCleanLessonTitle();
    const notes = getTeachingNotes() || '';
    
    // Get vocab list to provide context for examples
    const loaded = await ensureLessonDataReady();
    const vocabList = getAvailableVocab(loaded || undefined);
    const hasAnyVocab = Array.isArray(vocabList) && vocabList.length > 0;
    
    // Extract vocab terms for context
    const terms = hasAnyVocab
      ? Array.from(new Map(
          vocabList
            .map(v => {
              const raw = (typeof v === 'string') ? v : (v?.term || v?.word || v?.key || '');
              const t = (raw || '').trim();
              return t ? [t.toLowerCase(), t] : null;
            })
            .filter(Boolean)
        ).values())
      : [];
    
    const vocabContext = terms.length > 0 ? `Use these vocabulary words naturally in your examples: ${terms.join(', ')}.` : '';
    
    const instruction = [
      '',
      `Teaching notes (for your internal guidance; integrate naturally—do not read verbatim): ${notes}`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the examples.',
      `Examples: Show 2–3 tiny worked examples appropriate for this lesson. ${vocabContext} You compute every step. Be concise, warm, and playful. Do not add definitions or broad explanations beyond what is needed to show the steps. Do not do an introduction or a wrap; give only the examples.`,
      '',
      'CRITICAL ACCURACY: All examples and facts must be scientifically and academically correct. Never demonstrate incorrect procedures, state false information, or contradict established knowledge. Verify accuracy before presenting. OVERRIDE: If teaching notes below specify particular examples or methods, base your examples on that guidance - paraphrase naturally in your own style, but preserve the meaning and facts exactly as given. Do not correct, contradict, or add different information.',
      '',
      'Kid-friendly style rules: Use simple everyday words a 5–7 year old can understand. Keep sentences short (about 6–12 words). Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses. Use a warm, friendly tone with everyday examples. Speak directly to the learner using \"you\" and \"we\". One idea per sentence; do not pack many steps into one sentence.',
      '',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.'
    ].join('\n');
    
    // Start GPT call in background (don't await)
    examplesGptPromiseRef.current = callMsSonoma(
      instruction,
      '',
      {
        phase: 'teaching',
        subject: subjectParam,
        difficulty: difficultyParam,
        lesson: lessonParam,
        lessonTitle: effectiveLessonTitle,
        step: 'examples',
        teachingNotes: notes || undefined,
        vocab: hasAnyVocab ? vocabList : [],
        stage: 'examples'
      },
      { skipAudio: true } // Skip audio - we'll play sentence-by-sentence
    );
    
    console.log('[TEACHING] Examples GPT prefetch started');
  }, [
    callMsSonoma,
    ensureLessonDataReady,
    getAvailableVocab,
    getCleanLessonTitle,
    getTeachingNotes,
    subjectParam,
    difficultyParam,
    lessonParam,
    effectiveLessonTitle
  ]);
  
  /**
   * Gate prompt: "Do you have any questions?" + example questions
   */
  const promptGateRepeat = async () => {
    try { setTeachingGateLocked?.(true); } catch {}
    setCanSend(false);
    setSubPhase('teaching-3stage'); // hide gate buttons while we generate examples
    let result = null;
    let lessonTitle = '';
    let stageLabel = teachingStage === 'definitions' ? 'vocabulary definitions' : 'examples';
    let contextInfo = '';

    try {
      // Start generating example questions BEFORE speaking so GPT completes during speech
      lessonTitle = getCleanLessonTitle();
      const notes = getTeachingNotes() || '';
      
      // For definitions stage with sentence-by-sentence gating, reference the specific sentence
      if (teachingStage === 'definitions' && vocabSentencesRef.current.length > 0) {
        const currentSentence = vocabSentencesRef.current[vocabSentenceIndexRef.current];
        const sentenceNum = vocabSentenceIndexRef.current + 1;
        const totalSentences = vocabSentencesRef.current.length;
        
        stageLabel = `vocabulary definition (sentence ${sentenceNum} of ${totalSentences})`;
        contextInfo = `The sentence we just covered was: "${currentSentence}"`;
      }
      
      // For examples stage with sentence-by-sentence gating, reference the specific sentence
      if (teachingStage === 'examples' && exampleSentencesRef.current.length > 0) {
        const currentSentence = exampleSentencesRef.current[exampleSentenceIndexRef.current];
        const sentenceNum = exampleSentenceIndexRef.current + 1;
        const totalSentences = exampleSentencesRef.current.length;
        
        stageLabel = `example (sentence ${sentenceNum} of ${totalSentences})`;
        contextInfo = `The sentence we just covered was: "${currentSentence}"`;
      }
      
      const instruction = [
        `The lesson is "${lessonTitle}".`,
        `We just covered ${stageLabel}.`,
        contextInfo,
        'Generate 2-3 short example questions a child might ask about this topic.',
        'Start with: "You could ask questions like..."',
        'Then list the questions briefly and naturally.',
        'Keep it very short and friendly.',
        'Do not answer the questions.',
        'Kid-friendly style rules: Use simple everyday words a 5–7 year old can understand. Keep sentences short (about 6–12 words).',
        'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, or symbols.'
      ].filter(Boolean).join(' ');
      
      // Start GPT call (don't await yet)
      const gptPromise = callMsSonoma(
        instruction,
        '',
        {
          phase: 'teaching',
          subject: subjectParam,
          difficulty: difficultyParam,
          lesson: lessonParam,
          lessonTitle: effectiveLessonTitle,
          step: 'gate-example-questions',
          teachingNotes: notes || undefined,
          stage: teachingStage
        },
        { skipAudio: true } // We'll speak the generated sample questions explicitly after fetch
      );
      
      // While GPT is generating, speak "Do you have any questions?"
      await speakFrontend('Do you have any questions?');
      
      // By now GPT should be done or nearly done - wait for it to complete
      result = await gptPromise;
    } catch (err) {
      // Error generating example questions - continue to fallback
    }

    try {
      const cleanedTitle = (lessonTitle || getCleanLessonTitle() || 'this topic').trim();
      const fallback = `You could ask questions like... What does ${cleanedTitle} mean in simple words? How would we use ${cleanedTitle} in real life? Could you show one more example?`;
      const sampleText = (result && result.success && (result.text || '').trim()) ? (result.text || '').trim() : fallback;
      try { await speakFrontend(sampleText); } catch {}
      
      // If we just finished definitions stage and we successfully got text, prefetch examples GPT content
      if (teachingStage === 'definitions' && result && result.success && result.text) {
        console.log('[TEACHING] Triggering examples GPT prefetch after sample questions loaded');
        prefetchExamplesContent();
      }
    } catch (err) {
      // Silent fallback failure
    } finally {
      setSubPhase('awaiting-gate');
      setCanSend(false);
      try { setTeachingGateLocked?.(false); } catch {}
    }
  };

  /**
   * Teach definitions stage - sentence-by-sentence gating
   */
  const teachDefinitions = async (isRepeat = false) => {
    console.log('[TEACHING DEBUG] teachDefinitions called. vocabSentences.length:', vocabSentencesRef.current.length, 'isRepeat:', isRepeat);
    // If we already have vocab sentences stored, handle repeat/next
    if (vocabSentencesRef.current.length > 0) {
      console.log('[TEACHING DEBUG] Early return - sentences exist, speaking current sentence');
      
      // If NOT a repeat and we have sentences, reset to beginning (fresh start)
      if (!isRepeat) {
        console.log('[TEACHING DEBUG] Not a repeat - resetting to sentence 0');
        vocabSentenceIndexRef.current = 0;
        setVocabSentenceIndex(0);
      }
      
      const currentSentence = vocabSentencesRef.current[vocabSentenceIndexRef.current];
      if (currentSentence) {
        // Ensure subPhase is set to awaiting-gate (in case we're resuming from snapshot)
        setSubPhase('awaiting-gate');
        setCanSend(false);
        
        // Speak the current sentence (whether repeat or continuing)
        // Use noCaptions ONLY if it's truly a repeat (isRepeat=true), otherwise show captions normally
        const currentIdx = vocabSentenceIndexRef.current;
        console.log('[TEACHING] Speaking vocab sentence', currentIdx + 1, ':', currentSentence.substring(0, 50));
        try { await speakFrontend(currentSentence, isRepeat ? { noCaptions: true } : {}); } catch {}
        
        // Prefetch next sentence AFTER speaking completes (while student reads/processes)
        if (currentIdx + 1 < vocabSentencesRef.current.length) {
          console.log('[TEACHING] Prefetching vocab sentence', currentIdx + 2, ':', vocabSentencesRef.current[currentIdx + 1].substring(0, 50));
          ttsCache.prefetch(vocabSentencesRef.current[currentIdx + 1]);
        }
        
        return true;
      }
      return false;
    }
    
    // First time through: set phase and speak intro
    console.log('[TEACHING DEBUG] First time - setting subPhase to teaching-3stage');
    setCanSend(false);
    setSubPhase('teaching-3stage');
    
    // First time through: speak intro and get all vocab definitions from GPT
    if (!isRepeat) {
      try { await speakFrontend("First let's go over some definitions."); } catch {}
    }
    
    const loaded = await ensureLessonDataReady();
    const vocabList = getAvailableVocab(loaded || undefined);
    const hasAnyVocab = Array.isArray(vocabList) && vocabList.length > 0;
    
    // Extract and deduplicate vocab terms
    const terms = hasAnyVocab
      ? Array.from(new Map(
          vocabList
            .map(v => {
              const raw = (typeof v === 'string') ? v : (v?.term || v?.word || v?.key || '');
              const t = (raw || '').trim();
              return t ? [t.toLowerCase(), t] : null;
            })
            .filter(Boolean)
        ).values())
      : [];
    
    const gradeText = getGradeNumber();
    const lessonTitle = getCleanLessonTitle();
    const vocabCsv = terms.join(', ');
    
    const instruction = [
      '',
      `Grade: ${gradeText || ''}`.trim(),
      '',
      `Lesson: (do not read aloud): "${lessonTitle}"`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the definitions.',
      '',
      `Definitions: Define these words: ${vocabCsv}. Keep it warm, playful, and brief. Do not ask a question.`,
      '',
      'CRITICAL ACCURACY: All definitions must be factually accurate and scientifically correct. Never state incorrect facts, make false comparisons, or contradict established knowledge. If unsure about any fact, omit it rather than guess. OVERRIDE: If vocab definitions or teaching notes are provided below, base your teaching on that content - paraphrase naturally in your own style, but preserve the meaning and facts exactly as given. Do not correct, contradict, or add different information.',
      '',
      "Kid-friendly: Use simple everyday words a 5 year old can understand. Keep sentences short (about 6–12 words). Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses. Use a warm, friendly tone with everyday examples. Speak directly to the learner using 'you' and 'we'. One idea per sentence; do not pack many steps into one sentence.",
      '',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.'
    ].join('\n');
    
    // Get full definitions from GPT but skip audio playback (we'll play sentence-by-sentence)
    const result = await callMsSonoma(
      instruction,
      '',
      {
        phase: 'teaching',
        subject: subjectParam,
        difficulty: difficultyParam,
        lesson: lessonParam,
        lessonTitle: effectiveLessonTitle,
        step: isRepeat ? 'definitions-repeat' : 'definitions',
        teachingNotes: getTeachingNotes() || undefined,
        vocab: hasAnyVocab ? vocabList : [],
        stage: 'definitions'
      },
      { skipAudio: true } // Skip audio - we'll play sentence-by-sentence
    );
    
    if (result.success && result.text) {
      // Split the GPT response into sentences
      const sentences = splitIntoSentences(result.text).filter(s => s.trim());
      
      console.log('[TEACHING] Split into', sentences.length, 'vocab sentences');
      
      if (sentences.length === 0) {
        return false;
      }
      
      // Store all sentences for sentence-by-sentence gating
      vocabSentencesRef.current = sentences;
      setVocabSentences(sentences);
      vocabSentenceIndexRef.current = 0;
      setVocabSentenceIndex(0);
      isInSentenceModeRef.current = true;
      setIsInSentenceMode(true);
      
      console.log('[TEACHING] Stored', vocabSentencesRef.current.length, 'sentences in ref');
      
      // Show loading overlay during save (consistent with subsequent sentences)
      setTtsLoadingCount(prev => prev + 1);
      
      // ATOMIC SNAPSHOT: Save BEFORE speaking so skip doesn't lose progress
      try { await scheduleSaveSnapshot('vocab-sentence-1'); } catch (err) {
        console.error('[TEACHING FLOW] First vocab sentence save failed:', err);
      }
      
      setTtsLoadingCount(prev => prev - 1);
      
      // Speak the first sentence
      console.log('[TEACHING] Speaking vocab sentence 1:', sentences[0].substring(0, 50));
      try { await speakFrontend(sentences[0]); } catch (err) {
        console.error('[TEACHING] Error speaking sentence 1:', err);
      }
      
      // Prefetch next sentence AFTER speaking completes (while student reads/processes)
      if (sentences.length > 1) {
        console.log('[TEACHING] Prefetching vocab sentence 2:', sentences[1].substring(0, 50));
        ttsCache.prefetch(sentences[1]);
      }
      
      // Set subPhase to awaiting-gate so buttons appear AFTER speaking
      setSubPhase('awaiting-gate');
      setCanSend(false);
      
      return true;
    }
    
    return !!result.success;
  };

  /**
   * Teach examples stage - sentence-by-sentence gating
   */
  const teachExamples = async (isRepeat = false) => {
    // If we already have example sentences stored, handle repeat/next
    // DO NOT change subPhase - we're resuming from restore or repeating
    if (exampleSentencesRef.current.length > 0) {
      
      // If NOT a repeat and we have sentences, reset to beginning (fresh start)
      if (!isRepeat) {
        exampleSentenceIndexRef.current = 0;
        setExampleSentenceIndex(0);
      }
      
      const currentSentence = exampleSentencesRef.current[exampleSentenceIndexRef.current];
      if (currentSentence) {
        
        // Speak the current sentence (whether repeat or continuing)
        // Use noCaptions to avoid re-transcribing (sentence already in transcript from before)
        try { await speakFrontend(currentSentence, { noCaptions: true }); } catch {}
        
        // Prefetch next sentence AFTER speaking completes (while student reads/processes)
        const currentIdx = exampleSentenceIndexRef.current;
        if (currentIdx + 1 < exampleSentencesRef.current.length) {
          ttsCache.prefetch(exampleSentencesRef.current[currentIdx + 1]);
        }
        
        return true;
      }
      return false;
    }
    
    // First time through: set phase and speak intro
    setCanSend(false);
    setSubPhase('teaching-3stage');
    
    // Check if we already prefetched the examples content
    let result;
    if (examplesGptPromiseRef.current) {
      console.log('[TEACHING] Using prefetched examples GPT content');
      // First time through: speak intro while waiting for prefetch to complete
      if (!isRepeat) {
        try { await speakFrontend("Now let's see this in action."); } catch {}
      }
      result = await examplesGptPromiseRef.current;
      examplesGptPromiseRef.current = null; // Clear after use
    } else {
      console.log('[TEACHING] No prefetch found, starting fetch now');
      
      const lessonTitle = getCleanLessonTitle();
      const notes = getTeachingNotes() || '';
      
      // Get vocab list to provide context for examples
      const loaded = await ensureLessonDataReady();
      const vocabList = getAvailableVocab(loaded || undefined);
      const hasAnyVocab = Array.isArray(vocabList) && vocabList.length > 0;
      
      // Extract vocab terms for context
      const terms = hasAnyVocab
        ? Array.from(new Map(
            vocabList
              .map(v => {
                const raw = (typeof v === 'string') ? v : (v?.term || v?.word || v?.key || '');
                const t = (raw || '').trim();
                return t ? [t.toLowerCase(), t] : null;
              })
              .filter(Boolean)
          ).values())
        : [];
      
      const vocabContext = terms.length > 0 ? `Use these vocabulary words naturally in your examples: ${terms.join(', ')}.` : '';
      
      const instruction = [
        '',
        `Teaching notes (for your internal guidance; integrate naturally—do not read verbatim): ${notes}`,
        '',
        'No intro: Do not greet or introduce yourself; begin immediately with the examples.',
        `Examples: Show 2–3 tiny worked examples appropriate for this lesson. ${vocabContext} You compute every step. Be concise, warm, and playful. Do not add definitions or broad explanations beyond what is needed to show the steps. Do not do an introduction or a wrap; give only the examples.`,
        '',
        'CRITICAL ACCURACY: All examples and facts must be scientifically and academically correct. Never demonstrate incorrect procedures, state false information, or contradict established knowledge. Verify accuracy before presenting. OVERRIDE: If teaching notes below specify particular examples or methods, base your examples on that guidance - paraphrase naturally in your own style, but preserve the meaning and facts exactly as given. Do not correct, contradict, or add different information.',
        '',
        'Kid-friendly style rules: Use simple everyday words a 5–7 year old can understand. Keep sentences short (about 6–12 words). Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses. Use a warm, friendly tone with everyday examples. Speak directly to the learner using \"you\" and \"we\". One idea per sentence; do not pack many steps into one sentence.',
        '',
        'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.'
      ].join('\n');
      
      // Start GPT call (don't await yet)
      const gptPromise = callMsSonoma(
        instruction,
        '',
        {
          phase: 'teaching',
          subject: subjectParam,
          difficulty: difficultyParam,
          lesson: lessonParam,
          lessonTitle: effectiveLessonTitle,
          step: isRepeat ? 'examples-repeat' : 'examples',
          teachingNotes: notes || undefined,
          vocab: hasAnyVocab ? vocabList : [],
          stage: 'examples'
        },
        { skipAudio: true } // Skip audio - we'll play sentence-by-sentence
      );
      
      // While GPT is generating, speak intro (if first time)
      if (!isRepeat) {
        try { await speakFrontend("Now let's see this in action."); } catch {}
      }
      
      // Wait for GPT to complete
      result = await gptPromise;
    }

    // Build sentence list from GPT only
    console.log('[TEACHING EXAMPLES DEBUG] GPT result:', result ? { success: result.success, textLength: result.text?.length } : 'null');
    console.log('[TEACHING EXAMPLES DEBUG] GPT raw text:', result?.text);
    const sentences = (result && result.success && result.text)
      ? splitIntoSentences(result.text).filter(s => s.trim())
      : [];
    console.log('[TEACHING EXAMPLES DEBUG] Sentences after split:', sentences.length, 'sentences:', sentences);
    if (!sentences.length) {
      console.log('[TEACHING EXAMPLES DEBUG] No sentences, returning early');
      return !!(result && result.success);
    }
    
    // Store all sentences for sentence-by-sentence gating
    exampleSentencesRef.current = sentences;
    setExampleSentences(sentences);
    exampleSentenceIndexRef.current = 0;
    setExampleSentenceIndex(0);
    isInSentenceModeRef.current = true;
    setIsInSentenceMode(true);
    
    // Show loading overlay during save (consistent with subsequent sentences)
    setTtsLoadingCount(prev => prev + 1);
    
    // ATOMIC SNAPSHOT: Save BEFORE speaking so skip doesn't lose progress
    try { await scheduleSaveSnapshot('example-sentence-1'); } catch (err) {
      console.error('[TEACHING FLOW] First example sentence save failed:', err);
    }
    
    setTtsLoadingCount(prev => prev - 1);
    
    // Speak the first sentence
    try { await speakFrontend(sentences[0]); } catch {}
    
    // Prefetch next sentence AFTER speaking completes (while student reads/processes)
    if (sentences.length > 1) {
      ttsCache.prefetch(sentences[1]);
    }
    
    // Set subPhase to awaiting-gate so buttons appear
    console.log('[TEACHING EXAMPLES DEBUG] Setting awaiting-gate after speaking first sentence');
    setSubPhase('awaiting-gate');
    setCanSend(false);
    
    return true;
  };

  /**
   * Start two-stage teaching flow (Definitions → Examples)
   */
  const startTwoStageTeaching = async () => {
    setSubPhase('teaching-3stage');
    setPhase('teaching');
    
    setTeachingStage('definitions');
    try { scheduleSaveSnapshot('begin-teaching-definitions'); } catch {}
    
    const ok = await teachDefinitions(false);
    if (ok) {
      // Just show gate buttons, don't ask "Do you have any questions?" yet
      setSubPhase('awaiting-gate');
      setCanSend(false);
    }
  };

  /**
   * Handle "Yes" button - repeat current sentence or stage
   */
  const handleGateYes = async () => {
    
    if (teachingStage === 'definitions') {
      // If we have sentences, just repeat the current one
      if (vocabSentencesRef.current.length > 0) {
        const currentSentence = vocabSentencesRef.current[vocabSentenceIndexRef.current];
        if (currentSentence) {
          // Use noCaptions to avoid re-transcribing
          try { await speakFrontend(currentSentence, { noCaptions: true }); } catch {}
          // Don't call promptGateRepeat - just show gate buttons again
          setSubPhase('awaiting-gate');
          setCanSend(false);
          return;
        }
      }
      
      // Fallback: repeat the whole stage (shouldn't happen normally)
      const ok = await teachDefinitions(true);
      if (ok) {
        setStageRepeats((s) => ({ ...s, definitions: (s.definitions || 0) + 1 }));
        // Don't call promptGateRepeat - teachDefinitions already sets awaiting-gate after first sentence
      }
      return;
    }
    
    if (teachingStage === 'examples') {
      // If we have sentences, just repeat the current one
      if (exampleSentencesRef.current.length > 0) {
        const currentSentence = exampleSentencesRef.current[exampleSentenceIndexRef.current];
        if (currentSentence) {
          // Use noCaptions to avoid re-transcribing
          try { await speakFrontend(currentSentence, { noCaptions: true }); } catch {}
          // Don't call promptGateRepeat - just show gate buttons again
          setSubPhase('awaiting-gate');
          setCanSend(false);
          return;
        }
      }
      
      // Fallback: repeat the whole stage (shouldn't happen normally)
      const ok = await teachExamples(true);
      if (ok) {
        setStageRepeats((s) => ({ ...s, examples: (s.examples || 0) + 1 }));
        // Don't call promptGateRepeat - teachExamples already sets awaiting-gate after first sentence
      }
      return;
    }
  };

  /**
   * Handle "No" button - advance to next sentence or next stage
   */
  const handleGateNo = async () => {
    console.log('[TEACHING] handleGateNo called - stage:', teachingStage, 'vocabSentences.length:', vocabSentencesRef.current.length, 'currentIndex:', vocabSentenceIndexRef.current);
    
    if (teachingStage === 'definitions') {
      // If we have sentences stored, try to advance to the next one
      if (vocabSentencesRef.current.length > 0) {
        const nextIndex = vocabSentenceIndexRef.current + 1;
        
        // Check if there are more sentences
        if (nextIndex < vocabSentencesRef.current.length) {
          // Advance to next sentence
          vocabSentenceIndexRef.current = nextIndex;
          setVocabSentenceIndex(nextIndex);
          
          // ATOMIC SNAPSHOT: Save (non-blocking) - progress is already in ref
          scheduleSaveSnapshot(`vocab-sentence-${nextIndex + 1}`).catch(err => {
            console.error('[TEACHING FLOW] Save failed:', err);
          });
          
          const nextSentence = vocabSentencesRef.current[nextIndex];
          console.log('[TEACHING] Speaking vocab sentence', nextIndex + 1, ':', nextSentence.substring(0, 50));
          
          // Prefetch the sentence AFTER this one BEFORE speaking current (parallel load)
          if (nextIndex + 1 < vocabSentencesRef.current.length) {
            console.log('[TEACHING] Prefetching vocab sentence', nextIndex + 2, ':', vocabSentencesRef.current[nextIndex + 1].substring(0, 50));
            ttsCache.prefetch(vocabSentencesRef.current[nextIndex + 1]);
          } else {
            // On the last sentence - prefetch "Do you have any questions?" for instant gate
            console.log('[TEACHING] Prefetching gate prompt: Do you have any questions?');
            ttsCache.prefetch('Do you have any questions?');
          }
          
          try { await speakFrontend(nextSentence); } catch (err) {
            console.error('[TEACHING] Error speaking sentence', nextIndex + 1, ':', err);
          }
          
          // Don't call promptGateRepeat - just show gate buttons again
          setSubPhase('awaiting-gate');
          setCanSend(false);
          return;
        }
        
        // No more sentences - NOW call promptGateRepeat for the final gate
        vocabSentencesRef.current = []; // Clear vocab sentences
        setVocabSentences([]);
        vocabSentenceIndexRef.current = 0;
        setVocabSentenceIndex(0);
        isInSentenceModeRef.current = false; // Now in final gate mode
        setIsInSentenceMode(false);
        
        // Show the "Do you have any questions?" gate AFTER all sentences
        await promptGateRepeat();
        return;
      }
      
      // Final gate "No" - advance to Examples stage
      setTeachingStage('examples');
      try { scheduleSaveSnapshot('begin-teaching-examples'); } catch {}
      await teachExamples(false);
      // Don't call promptGateRepeat here - it will be called after all example sentences are done
      return;
    }
    
    if (teachingStage === 'examples') {
      // If we have sentences stored, try to advance to the next one
      if (exampleSentencesRef.current.length > 0) {
        const nextIndex = exampleSentenceIndexRef.current + 1;
        
        // Check if there are more sentences
        if (nextIndex < exampleSentencesRef.current.length) {
          // Advance to next sentence
          exampleSentenceIndexRef.current = nextIndex;
          setExampleSentenceIndex(nextIndex);
          
          // ATOMIC SNAPSHOT: Save (non-blocking) - progress is already in ref
          scheduleSaveSnapshot(`example-sentence-${nextIndex + 1}`).catch(err => {
            console.error('[TEACHING FLOW] Save failed:', err);
          });
          
          const nextSentence = exampleSentencesRef.current[nextIndex];
          
          // Prefetch the sentence AFTER this one BEFORE speaking current (parallel load)
          if (nextIndex + 1 < exampleSentencesRef.current.length) {
            ttsCache.prefetch(exampleSentencesRef.current[nextIndex + 1]);
          } else {
            // On the last sentence - prefetch "Do you have any questions?" for instant gate
            console.log('[TEACHING] Prefetching gate prompt: Do you have any questions?');
            ttsCache.prefetch('Do you have any questions?');
          }
          
          try { await speakFrontend(nextSentence); } catch {}
          
          // Don't call promptGateRepeat - just show gate buttons again
          setSubPhase('awaiting-gate');
          setCanSend(false);
          return;
        }
        
        // No more sentences - NOW call promptGateRepeat for the final gate
        exampleSentencesRef.current = []; // Clear example sentences
        setExampleSentences([]);
        exampleSentenceIndexRef.current = 0;
        setExampleSentenceIndex(0);
        isInSentenceModeRef.current = false; // Now in final gate mode
        setIsInSentenceMode(false);
        
        // Show the "Do you have any questions?" gate AFTER all sentences
        await promptGateRepeat();
        return;
      }
      
      // Final gate "No" - Done with teaching: transition to comprehension
      setTeachingStage('idle');
      await moveToComprehensionWithCue();
      return;
    }
  };

  /**
   * Transition to comprehension with audio cue
   */
  const moveToComprehensionWithCue = async () => {
    setCanSend(false);
    const cue = COMPREHENSION_CUE_PHRASE;
    let sentences = splitIntoSentences(cue);
    try { 
      sentences = mergeMcChoiceFragments(sentences).map((s) => enforceNbspAfterMcLabels(s)); 
    } catch {}
    
    const prevLen = captionSentencesRef.current?.length || 0;
    try {
      const nextAll = [...(captionSentencesRef.current || []), ...sentences];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
    } catch {}
    
    const FALLBACK_SECS = 1.8;
    let transitioned = false;
    
    try {
      setTtsLoadingCount((c) => c + 1);
      let res = await fetch('/api/tts', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ text: cue }) 
      });
      
      if (!res.ok) { 
        try { 
          await fetch('/api/tts', { 
            method: 'GET', 
            headers: { 'Accept': 'application/json' } 
          }).catch(() => {}); 
        } catch {}
        res = await fetch('/api/tts', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ text: cue }) 
        }); 
      }
      
      if (res.ok) {
        const data = await res.json();
        let b64 = (data && data.audio) ? String(data.audio) : '';
        if (b64) {
          setTtsLoadingCount((c) => Math.max(0, c - 1));
          b64 = b64.replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, '').trim();
          try { await playAudioFromBase64(b64, sentences, prevLen); } catch {}
          // Mark discussion phase as successfully completed before advancing to comprehension
          if (markWorkPhaseComplete) {
            markWorkPhaseComplete('discussion');
          }
          setPhase('comprehension');
          setSubPhase('comprehension-start');
          setCurrentCompProblem(null);
          setCanSend(false);
          transitioned = true;
        }
      }
    } catch {}
    finally { 
      setTtsLoadingCount((c) => Math.max(0, c - 1)); 
    }
    
    if (!transitioned) {
      // No audio path: use synthetic playback for consistent behavior
      setTtsLoadingCount((c) => Math.max(0, c - 1));
      try { await playAudioFromBase64('', sentences, prevLen); } catch {}
      // Mark discussion phase as successfully completed before advancing to comprehension
      if (markWorkPhaseComplete) {
        markWorkPhaseComplete('discussion');
      }
      setPhase('comprehension');
      setSubPhase('comprehension-start');
      setCurrentCompProblem(null);
      setCanSend(false);
    }
  };

  return {
    teachDefinitions,
    teachExamples,
    startTwoStageTeaching,
    handleGateYes,
    handleGateNo,
    moveToComprehensionWithCue,
    isInSentenceMode, // Export sentence navigation mode flag
    getTeachingFlowSnapshot,
    applyTeachingFlowSnapshot,
    // Export sentence state for prefetch useEffect
    vocabSentences,
    vocabSentenceIndex,
    exampleSentences,
    exampleSentenceIndex,
  };
}
