/**
 * Answer evaluation utilities for judging learner responses.
 * Includes similarity matching, synonym support, and unified correctness checking.
 */

import { normalizeAnswer, tokenize, STOPWORDS } from './answerNormalization';
import { isMultipleChoice, isTrueFalse } from './questionFormatting';

/**
 * Helper to tokenize from normalized text
 * @param {string} s - Input string
 * @returns {string[]} Array of tokens
 */
export const tokensFromNormalized = (s) => tokenize(normalizeAnswer(s));

/**
 * Calculate Levenshtein edit distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl; if (bl === 0) return al;
  const dp = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) dp[j] = j;
  for (let i = 1; i <= al; i++) {
    let prev = i - 1; dp[0] = i;
    for (let j = 1; j <= bl; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[bl];
}

/**
 * Synonym groups for answer evaluation leniency
 */
const SYNONYM_GROUPS = [
  ['kid','child','student','pupil'],
  ['children','kids','students','pupils'],
  ['buy','purchase','acquire'],
  ['big','large','huge'],
  ['small','little','tiny','mini'],
  ['start','begin','commence'],
  ['end','finish','complete','conclude'],
  ['because','since','as'],
  ['answer','response','reply','solution'],
  ['ask','question','inquire'],
  ['fast','quick','rapid','speedy'],
  ['teacher','instructor','educator']
];

/**
 * Index of synonym groups for fast lookup
 */
const SYNONYMS_INDEX = (() => {
  const m = new Map();
  for (const group of SYNONYM_GROUPS) {
    const set = new Set(group);
    for (const w of group) m.set(w, set);
  }
  return m;
})();

/**
 * Check if two tokens are similar (exact match, synonym, or small typo)
 * @param {string} a - First token
 * @param {string} b - Second token
 * @returns {boolean} True if tokens are considered similar
 */
export function tokensSimilar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // synonym group match
  const ga = SYNONYMS_INDEX.get(a);
  if (ga && ga.has(b)) return true;
  // small typo tolerance for longer tokens
  if (Math.abs(a.length - b.length) <= 1) {
    const L = Math.max(a.length, b.length);
    if (L >= 5 && levenshtein(a, b) <= 1) return true;
  }
  return false;
}

/**
 * Calculate similarity ratio between phrase tokens and learner tokens
 * @param {string[]} phraseTokens - Expected phrase tokens
 * @param {string[]} learnerTokensArr - Learner's answer tokens
 * @returns {number} Similarity ratio (0-1)
 */
export function phraseSimilarity(phraseTokens, learnerTokensArr) {
  if (!phraseTokens.length) return 0;
  let matched = 0;
  for (const t of phraseTokens) {
    if (STOPWORDS.has(t)) continue;
    const ok = learnerTokensArr.some((lt) => tokensSimilar(t, lt));
    if (ok) matched += 1;
  }
  const total = phraseTokens.filter(t => !STOPWORDS.has(t)).length || phraseTokens.length;
  return total ? (matched / total) : 0;
}

/**
 * Determine if similarity ratio meets threshold based on token count
 * @param {number} tokensCount - Number of tokens in phrase
 * @param {number} ratio - Similarity ratio
 * @returns {boolean} True if threshold is met
 */
export function meetsPhraseThreshold(tokensCount, ratio) {
  if (tokensCount <= 1) return ratio >= 1; // single-word must match
  if (tokensCount === 2) return ratio >= 1; // two-word phrases require both to avoid false positives
  return ratio >= 0.6; // 3+ words: allow partial coverage
}

/**
 * Unified local correctness check with leniency for different question types
 * @param {string} learnerRaw - Raw learner input
 * @param {string[]} acceptableList - List of acceptable answers
 * @param {Object} problem - Question object with type info
 * @returns {boolean} True if answer is considered correct
 */
export function isAnswerCorrectLocal(learnerRaw, acceptableList, problem) {
  const learnerNorm = normalizeAnswer(String(learnerRaw ?? ''));
  const accNorm = Array.from(new Set((acceptableList || []).map(a => normalizeAnswer(String(a ?? '')))));
  const hasChoices = isMultipleChoice(problem);

  // Accept single MC letter embedded (e.g., "I think b")
  const letterMatch = learnerNorm.match(/(?:^|\s)([a-d])(?:\s|$)/i);
  if (letterMatch) {
    const letter = letterMatch[1].toLowerCase();
    if (accNorm.includes(letter)) return true;
  }

  // True/False synonyms mapping when applicable
  const isTFq = isTrueFalse(problem);
  if (isTFq) {
    const TRUE_SYNS = new Set(['true','t','yes','y','correct','right']);
    const FALSE_SYNS = new Set(['false','f','no','n','incorrect','wrong']);
    if (accNorm.includes('true') && TRUE_SYNS.has(learnerNorm)) return true;
    if (accNorm.includes('false') && FALSE_SYNS.has(learnerNorm)) return true;
  }

  // Exact normalized equality
  if (accNorm.includes(learnerNorm)) return true;

  // Token/phrase acceptance
  const learnerTokensArr = Array.from(new Set(tokensFromNormalized(learnerNorm)));
  const learnerTokensSet = new Set(learnerTokensArr);
  for (const a of accNorm) {
    if (/^[a-d]$/i.test(a)) continue; // skip bare letters here
    const aTokensRaw = tokensFromNormalized(a);
    const aTokens = aTokensRaw.filter(t => !STOPWORDS.has(t));
    if (!aTokens.length) continue;
    // Strict subset for MC/TF; lenient phrase similarity for short answer
    if (hasChoices || isTrueFalse(problem)) {
      if (aTokens.every(t => learnerTokensSet.has(t))) return true;
    } else {
      const ratio = phraseSimilarity(aTokens, learnerTokensArr);
      if (meetsPhraseThreshold(aTokens.length, ratio)) return true;
    }
  }

  // Short-answer keyword path for non-MC/TF
  if (!hasChoices && !isTFq) {
    const kws = Array.isArray(problem?.keywords) ? problem.keywords.filter(Boolean).map(String) : [];
    const minK = Number.isInteger(problem?.minKeywords) ? problem.minKeywords : (kws.length ? 1 : 0);
    if (kws.length && minK >= 0) {
      const ltoks = learnerTokensArr.slice();
      let hits = 0;
      for (const kw of kws) {
        const kwTokens = tokensFromNormalized(kw).filter(t => !STOPWORDS.has(t));
        if (!kwTokens.length) continue;
        const ratio = phraseSimilarity(kwTokens, ltoks);
        if (meetsPhraseThreshold(kwTokens.length, ratio)) hits += 1;
      }
      if (hits >= minK) return true;
    }
  }
  return false;
}

/**
 * Expand expected answer with number word synonyms if applicable
 * @param {*} ans - Answer to expand
 * @param {Object} numberWordMap - Map of numbers to words
 * @returns {Object} Object with primary and synonyms array
 */
export function expandExpectedAnswer(ans, numberWordMap = {}) {
  if (ans == null) return { primary: '', synonyms: [] };
  const norm = normalizeAnswer(ans);
  const num = parseInt(norm, 10);
  if (!Number.isNaN(num) && numberWordMap[num]) {
    const word = numberWordMap[num];
    if (word !== norm) {
      return { primary: norm, synonyms: [word] };
    }
    return { primary: norm, synonyms: [word] };
  }
  return { primary: String(ans), synonyms: [] };
}

/**
 * Expand riddle acceptable answers with common phrasing variants
 * - Drop leading articles (a, an, the)
 * - Drop leading possessives (your, my, our, their, his, her)
 * - If answer is "(the) letter X", accept just "X"
 * @param {string} answer - Riddle answer
 * @returns {string[]} Array of acceptable variants
 */
export function expandRiddleAcceptables(answer) {
  const variants = new Set();
  const raw = String(answer || '').trim();
  if (!raw) return [];
  variants.add(raw);
  // Drop leading article
  const noArticle = raw.replace(/^\s*(?:a|an|the)\s+/i, '').trim();
  if (noArticle && noArticle !== raw) variants.add(noArticle);
  // Drop leading possessive pronouns
  const noPoss = raw.replace(/^\s*(?:your|my|our|their|his|her)\s+/i, '').trim();
  if (noPoss && noPoss !== raw) variants.add(noPoss);
  // If of the form "(the )?letter X" -> accept just X
  const m = raw.match(/^\s*(?:the\s+)?letter\s+([a-z])\s*$/i);
  if (m && m[1]) {
    variants.add(m[1]);
    variants.add(m[1].toLowerCase());
    variants.add(m[1].toUpperCase());
  }
  return Array.from(variants);
}
