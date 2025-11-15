/**
 * useAssessmentGeneration.js
 * 
 * Custom hook managing assessment generation (worksheet/test) for a lesson session.
 * Provides shuffle utilities, mixed selection (math), and category-based building (non-math).
 */

import { betterShuffle } from '@/app/lib/betterRandom';

export function useAssessmentGeneration({
  // Lesson data
  lessonData,
  subjectParam,
  
  // Targets
  WORKSHEET_TARGET,
  TEST_TARGET,
  
  // Deck utilities
  reserveWords,
}) {
  // REMOVED: reserveSamples parameter - sample array is deprecated
  // See docs/KILL_SAMPLE_ARRAY.md
  // Use better shuffle with crypto-random and entropy for more varied results
  const shuffle = (arr) => {
    const sessionSeed = typeof window !== 'undefined' ? window.location.href : '';
    return betterShuffle(arr, { addEntropy: true, sessionSeed });
  };

  const shuffleArr = (arr) => shuffle(arr);

  // Remove duplicate questions from an array based on question text
  const deduplicateQuestions = (arr) => {
    const seen = new Set();
    const result = [];
    
    for (const item of arr) {
      if (!item) continue;
      
      const questionText = (
        item.question || 
        item.prompt || 
        item.q || 
        item.Q || 
        ''
      ).toString().trim().toLowerCase();
      
      if (!questionText) {
        result.push(item);
        continue;
      }
      
      if (!seen.has(questionText)) {
        seen.add(questionText);
        result.push(item);
      }
    }
    
    return result;
  };

  // Select a blended set (for math): ~70% from categories and ~30% from word problems
  // REMOVED: samples parameter - no longer using deprecated sample array
  const selectMixed = (categories = [], wpArr = [], target = 0, isTest = false) => {
    const wpAvail = Array.isArray(wpArr) ? wpArr : [];
    const baseAvail = Array.isArray(categories) ? categories : [];
    const desiredWp = Math.round(target * 0.3);
    const wpCount = Math.min(Math.max(0, desiredWp), wpAvail.length);
    const baseCount = Math.max(0, target - wpCount);
    const wpSel = shuffle(wpAvail).slice(0, wpCount).map(q => {
      const core = isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q;
      return { ...core, sourceType: 'word', questionType: 'sa' };
    });
    const baseSel = shuffle(baseAvail).slice(0, baseCount);
    
    // Deduplicate before final shuffle
    const combined = [...wpSel, ...baseSel];
    const deduplicated = deduplicateQuestions(combined);
    return shuffle(deduplicated);
  };

  // Math-specific: build mixed worksheet/test from categories, words
  // REMOVED: samples parameter - no longer using deprecated sample array
  // Caps Short Answer and Fill-in-the-Blank at 10% each
  const takeMixed = (target, isTest, { words, data }) => {
    const desiredWp = Math.round(target * 0.3);
    const wpSel = (words || []).slice(0, desiredWp).map(q => ({ ...(isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q), sourceType: 'word', questionType: 'sa' }));
    
    // Cap SA/FIB to 15% each in the remainder from categories
    const remainder = Math.max(0, target - wpSel.length);
    const cap = Math.max(0, Math.floor(target * 0.15));
    
    const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
    const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
    const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
    const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
    const cats = [...tf, ...mc, ...fib, ...sa];
    
    const fromBase = cats;
    
    const saArr = fromBase.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
    const fibArr = fromBase.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
    const others = fromBase.filter(q => !saArr.includes(q) && !fibArr.includes(q));
    
    const saPick = shuffleArr(saArr).slice(0, Math.min(cap, saArr.length));
    const fibPick = shuffleArr(fibArr).slice(0, Math.min(cap, fibArr.length));
    const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
    const otherPick = shuffleArr(others).slice(0, remaining);
    const baseSel = shuffleArr([...saPick, ...fibPick, ...otherPick]);
    
    // Combine word problems and category questions, then deduplicate
    const combined = [...wpSel, ...baseSel];
    const deduplicated = deduplicateQuestions(combined);
    const mixed = shuffleArr(deduplicated);
    
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
    
    // Combine all questions and deduplicate before final shuffle
    const combined = [...saPick, ...fibPick, ...otherPick];
    const deduplicated = deduplicateQuestions(combined);
    const built = shuffle(deduplicated);
    
    return built;
  };

  // Main generation function: creates worksheet and test arrays
  const generateAssessments = () => {
    if (!lessonData) return { worksheet: null, test: null };

    let gW = [];
    let gT = [];

    if (subjectParam === 'math') {
      // Math: mixed approach with words and categories (NO MORE SAMPLES)
      const words = reserveWords(WORKSHEET_TARGET + TEST_TARGET);
      
      const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
      const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
      const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
      const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
      const cats = [...tf, ...mc, ...fib, ...sa];
      
      if ((words && words.length) || cats.length) {
        gW = takeMixed(WORKSHEET_TARGET, false, { words, data: lessonData });
        gT = takeMixed(TEST_TARGET, true, { words, data: lessonData });
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
