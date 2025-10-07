/**
 * useTeachingFlow.js
 * 
 * Custom hook managing the two-stage teaching flow (Definitions → Examples).
 * Handles stage progression, repeat logic, and gate transitions.
 */

export function useTeachingFlow({
  // State setters
  setCanSend,
  setSubPhase,
  setPhase,
  setTeachingStage,
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
  
  // Lesson context
  subjectParam,
  difficultyParam,
  lessonParam,
  effectiveLessonTitle,
  
  // Constants
  COMPREHENSION_CUE_PHRASE,
}) {
  
  /**
   * Gate prompt: "Do you have any questions?" + example questions
   */
  const promptGateRepeat = async () => {
    setCanSend(false);
    setSubPhase('teaching-3stage'); // hide gate buttons while we generate examples
    
    try {
      // First part: "Do you have any questions?"
      await speakFrontend('Do you have any questions?');
      
      // Generate example questions relevant to the current teaching stage and lesson
      const lessonTitle = getCleanLessonTitle();
      const notes = getTeachingNotes() || '';
      const stageLabel = teachingStage === 'definitions' ? 'vocabulary definitions' : 'examples';
      
      const instruction = [
        `The lesson is "${lessonTitle}".`,
        `We just covered ${stageLabel}.`,
        'Generate 2-3 short example questions a child might ask about this topic.',
        'Start with: "You could ask questions like..."',
        'Then list the questions briefly and naturally.',
        'Keep it very short and friendly.',
        'Do not answer the questions.',
        'Kid-friendly style rules: Use simple everyday words a 5–7 year old can understand. Keep sentences short (about 6–12 words).',
        'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, or symbols.'
      ].join(' ');
      
      const result = await callMsSonoma(
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
        }
      );
      
      if (!result.success) {
        console.warn('[GateRepeat] Failed to generate example questions');
      }
    } catch (err) {
      console.warn('[GateRepeat] Error generating example questions:', err);
    }
    
    setSubPhase('awaiting-gate');
    setCanSend(false); // gated via buttons
  };

  /**
   * Teach definitions stage
   */
  const teachDefinitions = async (isRepeat = false) => {
    setCanSend(false);
    setSubPhase('teaching-3stage');
    
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
    
    try {
      if (!terms.length) {
        console.warn('[Definitions] No vocab terms found. Lesson keys:', Object.keys(loaded || {}));
      } else {
        console.info('[Definitions] Injecting vocab terms:', terms);
      }
    } catch {}
    
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
      "Kid-friendly: Use simple everyday words a 5 year old can understand. Keep sentences short (about 6–12 words). Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses. Use a warm, friendly tone with everyday examples. Speak directly to the learner using 'you' and 'we'. One idea per sentence; do not pack many steps into one sentence.",
      '',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.'
    ].join('\n');
    
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
      }
    );
    
    return !!result.success;
  };

  /**
   * Teach examples stage
   */
  const teachExamples = async (isRepeat = false) => {
    setCanSend(false);
    setSubPhase('teaching-3stage');
    
    if (!isRepeat) {
      try { await speakFrontend("Now let's see this in action."); } catch {}
    }
    
    const lessonTitle = getCleanLessonTitle();
    const notes = getTeachingNotes() || '';
    
    const instruction = [
      '',
      `Teaching notes (for your internal guidance; integrate naturally—do not read verbatim): ${notes}`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the examples.',
      'Examples: Show 2–3 tiny worked examples appropriate for this lesson. You compute every step. Be concise, warm, and playful. Do not add definitions or broad explanations beyond what is needed to show the steps. Do not do an introduction or a wrap; give only the examples.',
      '',
      'Kid-friendly style rules: Use simple everyday words a 5–7 year old can understand. Keep sentences short (about 6–12 words). Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses. Use a warm, friendly tone with everyday examples. Speak directly to the learner using \"you\" and \"we\". One idea per sentence; do not pack many steps into one sentence.',
      '',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.'
    ].join('\n');
    
    const result = await callMsSonoma(
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
        vocab: [],
        stage: 'examples'
      }
    );
    
    return !!result.success;
  };

  /**
   * Start two-stage teaching flow (Definitions → Examples)
   */
  const startTwoStageTeaching = async () => {
    setSubPhase('teaching-3stage');
    setPhase('teaching');
    
    try {
      const loaded = await ensureLessonDataReady();
      const v = getAvailableVocab(loaded || undefined);
      const detectedCount = Array.isArray(v) ? v.length : 0;
      console.info('[Teaching] Start: forcing definitions first; detectedVocabCount=', detectedCount);
    } catch {}
    
    setTeachingStage('definitions');
    try { scheduleSaveSnapshot('begin-teaching-definitions'); } catch {}
    
    const ok = await teachDefinitions(false);
    if (ok) await promptGateRepeat();
  };

  /**
   * Handle "Yes" button - repeat current stage
   */
  const handleGateYes = async () => {
    try { console.info('[Gate] YES clicked: repeat stage', teachingStage); } catch {}
    
    if (teachingStage === 'definitions') {
      const ok = await teachDefinitions(true);
      if (ok) {
        setStageRepeats((s) => ({ ...s, definitions: (s.definitions || 0) + 1 }));
        await promptGateRepeat();
      }
      return;
    }
    
    if (teachingStage === 'examples') {
      const ok = await teachExamples(true);
      if (ok) {
        setStageRepeats((s) => ({ ...s, examples: (s.examples || 0) + 1 }));
        await promptGateRepeat();
      }
      return;
    }
  };

  /**
   * Handle "No" button - advance to next stage or comprehension
   */
  const handleGateNo = async () => {
    try { console.info('[Gate] NO clicked: next stage', teachingStage); } catch {}
    
    if (teachingStage === 'definitions') {
      // Advance to Examples
      setTeachingStage('examples');
      try { scheduleSaveSnapshot('begin-teaching-examples'); } catch {}
      const ok = await teachExamples(false);
      if (ok) await promptGateRepeat();
      return;
    }
    
    if (teachingStage === 'examples') {
      // Done with teaching: transition to comprehension
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
      setPhase('comprehension');
      setSubPhase('comprehension-start');
      setCurrentCompProblem(null);
      setCanSend(false);
    }
  };

  return {
    promptGateRepeat,
    teachDefinitions,
    teachExamples,
    startTwoStageTeaching,
    handleGateYes,
    handleGateNo,
    moveToComprehensionWithCue,
  };
}
