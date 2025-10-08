/**
 * useAssessmentGeneration.js
 * 
 * Custom hook managing assessment generation (worksheet/test) for a lesson session.
 * Provides shuffle utilities, mixed selection (math), and category-based building (non-math).
 */

export function useAssessmentGeneration({
  // Lesson data
  lessonData,
  subjectParam,
  
  // Targets
  WORKSHEET_TARGET,
  TEST_TARGET,
  
  // Deck utilities
  reserveSamples,
  reserveWords,
}) {
  // Fisher-Yates shuffle implementation
  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffleArr = (arr) => shuffle(arr);

  // Select a blended set (for math): ~70% from samples/categories and ~30% from word problems
  const selectMixed = (samples = [], wpArr = [], target = 0, isTest = false) => {
    const wpAvail = Array.isArray(wpArr) ? wpArr : [];
    const baseAvail = Array.isArray(samples) ? samples : [];
    const desiredWp = Math.round(target * 0.3);
    const wpCount = Math.min(Math.max(0, desiredWp), wpAvail.length);
    const baseCount = Math.max(0, target - wpCount);
    const wpSel = shuffle(wpAvail).slice(0, wpCount).map(q => {
      const core = isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q;
      return { ...core, sourceType: 'word', questionType: 'sa' };
    });
    const baseSel = shuffle(baseAvail).slice(0, baseCount).map(q => ({ ...q, sourceType: 'sample', questionType: 'sa' }));
    return shuffle([...wpSel, ...baseSel]);
  };

  // Math-specific: build mixed worksheet/test from samples, words, and categories
  // Caps Short Answer and Fill-in-the-Blank at 10% each
  const takeMixed = (target, isTest, { samples, words, data }) => {
    const desiredWp = Math.round(target * 0.3);
    const wpSel = (words || []).slice(0, desiredWp).map(q => ({ ...(isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q), sourceType: 'word', questionType: 'sa' }));
    
    // Cap SA/FIB to 15% each in the remainder from samples+categories
    const remainder = Math.max(0, target - wpSel.length);
    const cap = Math.max(0, Math.floor(target * 0.15));
    
    const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
    const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
    const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
    const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
    const cats = [...tf, ...mc, ...fib, ...sa];
    
    const fromBase = [
      ...((samples || []).map(q => ({ ...q, sourceType: 'sample', questionType: 'sa' }))),
      ...cats
    ];
    
    const saArr = fromBase.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
    const fibArr = fromBase.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
    const others = fromBase.filter(q => !saArr.includes(q) && !fibArr.includes(q));
    
    const saPick = shuffleArr(saArr).slice(0, Math.min(cap, saArr.length));
    const fibPick = shuffleArr(fibArr).slice(0, Math.min(cap, fibArr.length));
    const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
    const otherPick = shuffleArr(others).slice(0, remaining);
    const baseSel = shuffleArr([...saPick, ...fibPick, ...otherPick]);
    const mixed = shuffleArr([...wpSel, ...baseSel]);
    
    try { 
      console.debug('[PoolTagging] Mixed select types:', Array.from(new Set(mixed.map(x => x?.questionType || 'sa')))); 
    } catch {}
    
    return mixed;
  };

  // Non-math: build from category arrays, capping Short Answer and Fill-in-the-Blank at 15% each
  const buildFromCategories = (target = 0, data) => {
    const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
    const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
    const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
    const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
    
    const anyCats = tf.length || mc.length || fib.length || sa.length;
    if (!anyCats) return null;
    
    const cap = Math.max(0, Math.floor(target * 0.15)); // 15% cap for SA and FIB each
    const saPick = shuffle(sa).slice(0, Math.min(cap, sa.length));
    const fibPick = shuffle(fib).slice(0, Math.min(cap, fib.length));
    const others = shuffle([...tf, ...mc]);
    const remaining = Math.max(0, target - saPick.length - fibPick.length);
    const otherPick = others.slice(0, remaining);
    const built = shuffle([...saPick, ...fibPick, ...otherPick]);
    
    try { 
      console.debug('[PoolTagging] Non-math category types:', Array.from(new Set(built.map(x => x?.questionType || 'sa')))); 
    } catch {}
    
    return built;
  };

  // Main generation function: creates worksheet and test arrays
  const generateAssessments = () => {
    if (!lessonData) return { worksheet: null, test: null };

    let gW = [];
    let gT = [];

    if (subjectParam === 'math') {
      // Math: mixed approach with samples, words, and categories
      const samples = reserveSamples(WORKSHEET_TARGET + TEST_TARGET);
      const words = reserveWords(WORKSHEET_TARGET + TEST_TARGET);
      
      const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
      const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
      const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
      const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
      const cats = [...tf, ...mc, ...fib, ...sa];
      
      if ((samples && samples.length) || (words && words.length) || cats.length) {
        gW = takeMixed(WORKSHEET_TARGET, false, { samples, words, data: lessonData });
        gT = takeMixed(TEST_TARGET, true, { samples, words, data: lessonData });
      }
    } else {
      // Non-math: category-based approach
      const fromCatsW = buildFromCategories(WORKSHEET_TARGET, lessonData);
      const fromCatsT = buildFromCategories(TEST_TARGET, lessonData);
      
      if (fromCatsW) {
        gW = fromCatsW;
      } else if (Array.isArray(lessonData.worksheet) && lessonData.worksheet.length) {
        gW = shuffle(lessonData.worksheet).slice(0, WORKSHEET_TARGET).map(q => ({ ...q, questionType: (q?.questionType) ? q.questionType : 'sa' }));
      }
      
      if (fromCatsT) {
        gT = fromCatsT;
      } else if (Array.isArray(lessonData.test) && lessonData.test.length) {
        gT = shuffle(lessonData.test).slice(0, TEST_TARGET).map(q => ({ ...q, questionType: (q?.questionType) ? q.questionType : 'sa' }));
      }
    }

    return { worksheet: gW, test: gT };
  };

  return {
    shuffle,
    shuffleArr,
    selectMixed,
    takeMixed,
    buildFromCategories,
    generateAssessments,
  };
}
