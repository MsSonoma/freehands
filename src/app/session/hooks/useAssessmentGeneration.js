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

  const questionKey = (q) => {
    return (q?.prompt || q?.question || q?.q || q?.Q || '').toString().trim().toLowerCase();
  };

  const isPrimaryType = (q) => {
    const qt = String(q?.questionType || q?.type || q?.sourceType || '').toLowerCase();
    return qt === 'mc' || qt === 'multiplechoice' || qt === 'tf' || qt === 'truefalse';
  };

  // Blend questions to roughly 80% MC/TF (primary) and 20% SA/FIB (secondary)
  const blendByType = ({ source = [], target = 0, seed = [] } = {}) => {
    const seedKeys = new Set((seed || []).map(questionKey).filter(Boolean));
    const all = [];
    const seenAll = new Set();
    const pushUnique = (arr = []) => {
      for (const item of arr) {
        const k = questionKey(item);
        if (k && seenAll.has(k)) continue;
        if (k) seenAll.add(k);
        all.push(item);
      }
    };
    pushUnique(seed);
    pushUnique(source);

    const primPool = shuffle(all.filter(isPrimaryType));
    const secPool = shuffle(all.filter((q) => !isPrimaryType(q)));

    const seedPrim = primPool.filter((q) => seedKeys.has(questionKey(q)));
    const seedSec = secPool.filter((q) => seedKeys.has(questionKey(q)));
    const basePrim = primPool.filter((q) => !seedKeys.has(questionKey(q)));
    const baseSec = secPool.filter((q) => !seedKeys.has(questionKey(q)));

    const desiredSecondary = Math.max(0, Math.round(target * 0.2));
    const desiredPrimary = Math.max(0, target - desiredSecondary);

    const out = [];
    const takeFrom = (pool, count) => {
      const copy = Array.isArray(pool) ? [...pool] : [];
      while (count > 0 && copy.length) {
        out.push(copy.shift());
        count -= 1;
      }
      return copy;
    };

    let remainingSeedSec = takeFrom(seedSec, Math.min(seedSec.length, desiredSecondary));
    let remainingSeedPrim = takeFrom(seedPrim, Math.min(seedPrim.length, desiredPrimary));

    const remainingSecondaryNeed = Math.max(0, desiredSecondary - seedSec.length + remainingSeedSec.length);
    const remainingPrimaryNeed = Math.max(0, desiredPrimary - seedPrim.length + remainingSeedPrim.length);

    const afterSec = takeFrom(baseSec, remainingSecondaryNeed);
    const afterPrim = takeFrom(basePrim, remainingPrimaryNeed);

    let remaining = target - out.length;
    let spillPool = [...afterPrim, ...afterSec, ...remainingSeedPrim, ...remainingSeedSec];
    while (remaining > 0 && spillPool.length) {
      out.push(spillPool.shift());
      remaining -= 1;
    }

    const selectedKeys = new Set(out.map(questionKey).filter(Boolean));
    const remainder = all.filter((q) => !selectedKeys.has(questionKey(q)));

    return { selected: out.slice(0, target), remainder };
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
  const takeMixed = (target, isTest, { words, data }) => {
    const wpSel = (words || []).map((q) => ({ ...(isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q), sourceType: 'word', questionType: 'sa' }));
    const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
    const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
    const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
    const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
    const combined = [...wpSel, ...tf, ...mc, ...fib, ...sa];
    const blended = blendByType({ source: combined, target });
    return blended.selected;
  };

  // Non-math: build from category arrays using 80/20 MC+TF vs SA+FIB mix
  const buildFromCategories = (target = 0, data) => {
    const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
    const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
    const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
    const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
    const combined = [...tf, ...mc, ...fib, ...sa];
    if (!combined.length) return null;
    const blended = blendByType({ source: combined, target });
    return blended.selected;
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
    blendByType,
  };
}
