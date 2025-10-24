/**
 * Feedback messages, hints, and encouragement utilities for the session page.
 * Includes constants for celebrations, hints, and helper functions for building feedback.
 */

import { CELEBRATE_CORRECT, generatePraise } from './praiseSignals';
import { ENCOURAGEMENT_SNIPPETS } from './openingSignals';

/**
 * Question type constraint note for AI instructions
 */
export const ALLOWED_Q_TYPES_NOTE = "Question type constraint: Only use Multiple Choice (include four choices labeled 'A.', 'B.', 'C.', 'D.'), True/False, or Fill in the Blank (use _____). Do NOT use short answer or any open-ended question types in the Comprehension or Exercise phases.";

/**
 * Short encouragement snippets for progress cues
 * Used around progress/count cues in comprehension, exercise, worksheet phases
 * Re-exported from openingSignals for backward compatibility
 */
export { ENCOURAGEMENT_SNIPPETS };

/**
 * Celebration phrases for correct comprehension answers
 * Short, warm, domain-agnostic celebrations
 * Re-exported from praiseSignals for backward compatibility
 */
export { CELEBRATE_CORRECT, generatePraise };

/**
 * First-attempt hint variations
 */
export const HINT_FIRST = [
  'Not quite right. Think about the key idea and try again.',
  'Not quite. Take another look and try again.',
  'Almost there. Read it once more and try again.'
];

/**
 * Second-attempt hint variations
 */
export const HINT_SECOND = [
  'Good effort. You have got this—focus on the main idea.',
  'Nice try. Think about what the question is really asking.',
  'You are close. Pick the best match for the idea.'
];

/**
 * Extract expected answer list from question object
 * Merges expectedAny and acceptable arrays, filtering out null/empty values
 * @param {Object} q - Question object
 * @returns {Array|null} Merged list of expected answers or null if empty
 */
export function expectedAnyList(q) {
  try {
    // Keep boolean false; drop only null/undefined and empty strings after trim
    const keep = (v) => {
      if (v == null) return false;
      const s = typeof v === 'string' ? v.trim() : v;
      return !(typeof s === 'string' && s.length === 0);
    };
    const a = Array.isArray(q?.expectedAny) ? q.expectedAny.filter(keep) : [];
    const b = Array.isArray(q?.acceptable) ? q.acceptable.filter(keep) : [];
    const merged = [...a, ...b];
    return merged.length ? merged : null;
  } catch { return null; }
}

/**
 * Pick a hint from array using stable hash-based selection
 * Provides variety without randomness per turn
 * @param {Array} arr - Array of hint strings
 * @param {string} qKey - Question key for stable hashing
 * @returns {string} Selected hint
 */
export function pickHint(arr, qKey) {
  try {
    const list = Array.isArray(arr) && arr.length ? arr : ['Try again.'];
    // Simple stable pick by key hash to keep variety without randomness per turn
    let h = 0; const s = String(qKey || '');
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return list[h % list.length];
  } catch { return 'Try again.'; }
}

/**
 * Build a randomized pattern specification for progress cues with encouragement
 * Returns an object with pattern hint for AI instructions and a pick function
 * @param {string} progressPhrase - The progress phrase to use
 * @returns {Object} Object with { encouragement, placeBefore, patternHint, pick }
 */
export function buildCountCuePattern(progressPhrase) {
  // Decide order on the client so UX sees variety deterministically per turn
  const encouragement = ENCOURAGEMENT_SNIPPETS[Math.floor(Math.random() * ENCOURAGEMENT_SNIPPETS.length)];
  const placeBefore = Math.random() < 0.5;
  const patternHint = placeBefore
    ? `Say a brief encouragement (e.g., "${encouragement}.") immediately BEFORE you say: "${progressPhrase}"`
    : `Say the progress phrase "${progressPhrase}" then immediately AFTER it one brief encouragement such as: "${encouragement}."`;
  const pick = () => placeBefore
    ? `${encouragement}. ${progressPhrase}`
    : `${progressPhrase} ${encouragement}.`;
  return { encouragement, placeBefore, patternHint, pick };
}

/**
 * Build a combined expected answer bundle string for AI instructions
 * Format: primary=<value>; any=[v1, v2]; acceptable=[a1, a2]
 * @param {Object} options - Options object with primary, any, acceptable
 * @returns {string} Formatted bundle string
 */
export function composeExpectedBundle({ primary, any, acceptable } = {}) {
  const arrify = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const toStr = (v) => {
    if (v == null) return '';
    const s = String(v).trim();
    return s;
  };
  const uniq = (list) => {
    const out = [];
    const seen = new Set();
    for (const v of list) {
      const s = toStr(v);
      if (!s) continue;
      if (!seen.has(s)) { seen.add(s); out.push(s); }
    }
    return out;
  };
  const primaryStr = toStr(primary);
  const anyList = uniq(arrify(any));
  const acceptableListBase = uniq(arrify(acceptable));
  // Determine primary_final
  const primaryFinal = primaryStr || (anyList.length ? anyList[0] : '') || (acceptableListBase.length ? acceptableListBase[0] : '');
  // Build acceptable list including primaryFinal (when truthy), then dedupe
  const acceptableList = uniq([primaryFinal, ...acceptableListBase]);
  const parts = [];
  parts.push('primary=' + (primaryFinal ?? ''));
  if (anyList.length) parts.push('any=[' + anyList.join(', ') + ']');
  if (acceptableList.length) parts.push('acceptable=[' + acceptableList.join(', ') + ']');
  return parts.join('; ');
}
