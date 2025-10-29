/**
 * assessmentGenerationUtils.js
 * Assessment generation utilities for building question pools and managing question decks.
 * Handles question normalization, shuffling, and non-repeating deck management across phases.
 */

import { isShortAnswerItem } from '../utils/questionFormatting';
import { promptKey } from '../utils/questionFormatting';

/**
 * Shuffle array using Fisher-Yates algorithm.
 * 
 * @param {Array} arr - Array to shuffle
 * @returns {Array} Shuffled copy of array
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Remove duplicate questions from an array based on question text.
 * Keeps the first occurrence of each unique question.
 * 
 * @param {Array} arr - Array of question objects
 * @returns {Array} Array with duplicates removed
 */
function deduplicateQuestions(arr) {
  const seen = new Set();
  const result = [];
  
  for (const item of arr) {
    if (!item) continue;
    
    // Get question text from various possible fields
    const questionText = (
      item.question || 
      item.prompt || 
      item.q || 
      item.Q || 
      ''
    ).toString().trim().toLowerCase();
    
    if (!questionText) {
      // If no question text, keep it (might be malformed but let validation catch it)
      result.push(item);
      continue;
    }
    
    if (!seen.has(questionText)) {
      seen.add(questionText);
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Build question/answer pool from lesson data.
 * Normalizes questions, filters by subject rules, and shuffles.
 * Uses TF/MC/FIB/SA question types from all subjects.
 * 
 * @param {object} lessonData - Lesson data containing question categories
 * @param {string} subjectParam - Subject identifier (e.g., 'math')
 * @returns {Array} Shuffled array of normalized questions
 */
export function buildQAPool(lessonData, subjectParam) {
  const arrify = (val) => (Array.isArray(val) ? val : (val ? [val] : []));
  
  const ensureAE = (qIn) => {
    const q = { ...qIn };
    // If both expected and answer are missing but expectedAny exists, seed them from the first acceptable
    const any = Array.isArray(q.expectedAny) ? q.expectedAny.filter(Boolean) : [];
    if ((q.expected == null) && (q.answer == null) && any.length) {
      const seed = String(any[0]);
      q.expected = seed;
      q.answer = seed;
    } else {
      // Also check for uppercase/lowercase Q and A fields from facilitator lessons
      q.expected = q.expected ?? q.answer ?? q.A ?? q.a;
      q.answer = q.answer ?? q.expected ?? q.A ?? q.a;
    }
    return q;
  };
  
  const normalize = (q) => ensureAE(q);

  // Prepare categories (accept single object or array)
  const tf = arrify(lessonData?.truefalse).map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })).map(normalize);
  const mc = arrify(lessonData?.multiplechoice).map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })).map(normalize);
  const fib = arrify(lessonData?.fillintheblank).map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })).map(normalize);
  const sa = arrify(lessonData?.shortanswer).map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })).map(normalize);

  // Exclude invalid MC entries that have no options/choices (would behave like short answer)
  const mcValid = mc.filter(q => {
    const hasChoices = (Array.isArray(q?.choices) && q.choices.length) || (Array.isArray(q?.options) && q.options.length);
    return hasChoices;
  });

  // All subjects: Use TF/MC/FIB/SA question types
  const pool = [...tf, ...mcValid, ...fib, ...sa];
  
  // Deduplicate questions to prevent repeats within the pool
  const deduplicated = deduplicateQuestions(pool);
  
  // Log unique questionTypes for dev validation
  try { 
    console.debug('[PoolTagging] Comp/Ex pool types:', Array.from(new Set(deduplicated.map(x => x?.questionType || 'sa'))));
    if (pool.length !== deduplicated.length) {
      console.debug('[PoolTagging] Removed', pool.length - deduplicated.length, 'duplicate questions from pool');
    }
  } catch {}
  
  return shuffleArray(deduplicated);
}

/**
 * Ensure array reaches target count by topping up from backup pools.
 * Avoids duplicates unless no unique items remain and allowDuplicatesAsLastResort is true.
 * 
 * @param {Array} base - Base array to start with
 * @param {number} target - Target count
 * @param {Array<Array>} pools - Array of backup pools to draw from
 * @param {boolean} allowDuplicatesAsLastResort - Whether to allow duplicates as last resort
 * @returns {Array} Array with exactly target items (or fewer if impossible)
 */
export function ensureExactCount(base = [], target = 0, pools = [], allowDuplicatesAsLastResort = true) {
  const out = [...(Array.isArray(base) ? base : [])];
  if (out.length >= target) return out.slice(0, target);
  
  const used = new Set(out.map(promptKey));
  const pushUnique = (item) => {
    const key = promptKey(item);
    if (!key || !used.has(key)) {
      out.push(item);
      if (key) used.add(key);
    }
  };
  
  for (const pool of pools) {
    if (out.length >= target) break;
    const arr = Array.isArray(pool) ? pool : [];
    for (const item of arr) {
      if (out.length >= target) break;
      pushUnique(item);
    }
  }
  
  if (out.length < target && allowDuplicatesAsLastResort) {
    // Cycle through pools again allowing duplicates
    const flat = pools.flat().filter(Boolean);
    let idx = 0;
    while (out.length < target && flat.length) {
      out.push(flat[idx % flat.length]);
      idx += 1;
    }
  }
  
  return out.slice(0, target);
}

/**
 * Initialize sample deck with shuffled samples.
 * Resets deck and tracking refs for non-repeating draws across phases.
 * 
 * @param {object} data - Lesson data containing samples
 * @param {object} refs - React refs { sampleDeckRef, sampleIndexRef, usedSampleSetRef }
 */
export function initSampleDeck(data, refs) {
  const { sampleDeckRef, sampleIndexRef, usedSampleSetRef } = refs;
  try {
    const raw = Array.isArray(data?.sample) ? data.sample : [];
    sampleDeckRef.current = shuffleArray(raw);
    sampleIndexRef.current = 0;
    usedSampleSetRef.current = new Set();
  } catch {
    sampleDeckRef.current = [];
    sampleIndexRef.current = 0;
    usedSampleSetRef.current = new Set();
  }
}

/**
 * Draw one sample from deck without repeating until full cycle completes.
 * When deck exhausted, reshuffles and allows repeats in new cycle.
 * 
 * @param {object} refs - React refs { sampleDeckRef, sampleIndexRef, usedSampleSetRef }
 * @returns {object|null} Sample item or null if deck empty
 */
export function drawSampleUnique(refs) {
  const { sampleDeckRef, sampleIndexRef, usedSampleSetRef } = refs;
  const deck = sampleDeckRef.current || [];
  if (!deck.length) return null;
  
  if (sampleIndexRef.current >= deck.length) {
    // Completed a full cycle: reshuffle and reset (now repeats are allowed again)
    sampleDeckRef.current = shuffleArray(deck);
    sampleIndexRef.current = 0;
    usedSampleSetRef.current = new Set();
  }
  
  const item = sampleDeckRef.current[sampleIndexRef.current++];
  const key = String(item?.prompt || item?.question || '').trim();
  if (key) usedSampleSetRef.current.add(key);
  
  // Tag items from sample array with sourceType to aid detection
  if (item && !item.sourceType) {
    return { ...item, sourceType: 'short' };
  }
  
  return item || null;
}

/**
 * Reserve multiple samples from deck.
 * 
 * @param {number} count - Number of samples to reserve
 * @param {object} refs - React refs { sampleDeckRef, sampleIndexRef, usedSampleSetRef }
 * @returns {Array} Array of reserved samples
 */
export function reserveSamples(count, refs) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const it = drawSampleUnique(refs);
    if (!it) break;
    out.push(it);
  }
  return out;
}

/**
 * Initialize word problem deck with shuffled word problems.
 * Resets deck and tracking refs for non-repeating draws.
 * 
 * @param {object} data - Lesson data containing word problems
 * @param {object} refs - React refs { wordDeckRef, wordIndexRef }
 */
export function initWordDeck(data, refs) {
  const { wordDeckRef, wordIndexRef } = refs;
  try {
    const raw = Array.isArray(data?.wordProblems) ? data.wordProblems : [];
    wordDeckRef.current = shuffleArray(raw);
    wordIndexRef.current = 0;
  } catch {
    wordDeckRef.current = [];
    wordIndexRef.current = 0;
  }
}

/**
 * Draw one word problem from deck without repeating until full cycle completes.
 * When deck exhausted, reshuffles and allows repeats in new cycle.
 * 
 * @param {object} refs - React refs { wordDeckRef, wordIndexRef }
 * @returns {object|null} Word problem item or null if deck empty
 */
export function drawWordUnique(refs) {
  const { wordDeckRef, wordIndexRef } = refs;
  const deck = wordDeckRef.current || [];
  if (!deck.length) return null;
  
  if (wordIndexRef.current >= deck.length) {
    wordDeckRef.current = shuffleArray(deck);
    wordIndexRef.current = 0;
  }
  
  return wordDeckRef.current[wordIndexRef.current++] || null;
}
