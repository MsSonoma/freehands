/**
 * Question formatting and validation utilities
 * Pure functions for formatting questions, detecting question types,
 * and handling answer validation logic.
 */

import { normalizeAnswer } from './answerNormalization';

/**
 * Format multiple choice options with letter labels
 * @param {Object} item - Question item with options/choices
 * @param {Object} options - Formatting options
 * @param {string} options.layout - 'inline' or 'multiline'
 * @returns {string} Formatted options string
 */
export function formatMcOptions(item, { layout = 'inline' } = {}) {
  try {
    const opts = Array.isArray(item?.options)
      ? item.options.filter(Boolean)
      : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
    if (!opts.length) return '';
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    // Normalize: strip any existing leading label for the expected letter, then prepend exactly one standardized label
    const parts = opts.map((o, i) => {
      const raw = String(o ?? '').trim();
      const label = labels[i] || '';
      // Strip ANY leading letter label like "A)", "(B)", "C.", "D:", "E -" regardless of which letter it is
      const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
      const cleaned = raw.replace(anyLabel, '').trim();
      // Use NBSP between label and option text to prevent wrapping between them
      return `${label}.\u00A0${cleaned}`;
    });
    if (layout === 'multiline') {
      return parts.join('\n');
    }
    // Default inline with spaced commas for readability
    return parts.join(',   ');
  } catch {
    return '';
  }
}

/**
 * Check if question is True/False type
 */
export function isTrueFalse(item) {
  try {
    // Normalize several possible fields
    const sourceType = String(item?.sourceType || '').toLowerCase();
    const typeField = String(item?.type || '').toLowerCase();
    const qType = String(item?.questionType || '').toLowerCase();
    if (sourceType === 'tf' || qType === 'tf') return true;
    if (/^(true\s*\/\s*false|truefalse|tf)$/i.test(typeField)) return true;
    if (/^(true\s*\/\s*false|truefalse|tf)$/i.test(qType)) return true;
    // Heuristic: treat as TF when expected/answer is literally true/false
    const exp = String((item?.expected ?? item?.answer) ?? '').trim().toLowerCase();
    if (exp === 'true' || exp === 'false') return true;
    const any = Array.isArray(item?.expectedAny) ? item.expectedAny.map((v) => String(v).trim().toLowerCase()) : [];
    if (any.includes('true') || any.includes('false')) return true;
    return false;
  } catch { return false; }
}

/**
 * Check if question is Fill-in-the-Blank type
 */
export function isFillInBlank(item) {
  try {
    const st = String(item?.sourceType || '').toLowerCase();
    const qt = String(item?.type || '').toLowerCase();
    const prompt = String(item?.prompt || item?.question || '').toLowerCase();
    if (st === 'fib') return true;
    if (/fill\s*in\s*the\s*blank|fillintheblank/.test(qt)) return true;
    if (/_{3,}/.test(prompt)) return true; // has ___ style blanks
    return false;
  } catch { return false; }
}

/**
 * Check if question is Short Answer type
 */
export function isShortAnswerItem(item) {
  try {
    const st = String(item?.sourceType || '').toLowerCase();
    const qt = String(item?.type || '').toLowerCase();
    if (st === 'short') return true;
    if (/short\s*answer|shortanswer/.test(qt)) return true;
    // Heuristic: not TF, no choices/options, not FIB -> treat as short answer
    const hasChoices = (Array.isArray(item?.choices) && item.choices.length) || (Array.isArray(item?.options) && item.options.length);
    if (!isTrueFalse(item) && !hasChoices && !isFillInBlank(item)) return true;
    return false;
  } catch { return false; }
}

/**
 * Check if question is Multiple Choice type
 * Basic multiple-choice detection: has options/choices array with 2+ items and not TF
 */
export function isMultipleChoice(item) {
  try {
    const opts = Array.isArray(item?.options)
      ? item.options.filter(Boolean)
      : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
    if (!opts || opts.length < 2) return false;
    return !isTrueFalse(item);
  } catch { return false; }
}

/**
 * Format question for speech output
 * @param {Object} item - Question item
 * @param {Object} options - Formatting options
 * @param {string} options.layout - 'inline' or 'multiline'
 * @returns {string} Formatted question string
 */
export function formatQuestionForSpeech(item, { layout = 'inline' } = {}) {
  if (!item) return '';
  const tfPrefix = isTrueFalse(item) ? 'True/False: ' : '';
  const mc = formatMcOptions(item, { layout });
  const base = String(item.prompt || item.question || '').trim();
  // Put MC options on a new line; keep them comma-separated
  return mc ? `${tfPrefix}${base}\n${mc}` : `${tfPrefix}${base}`;
}

/**
 * Get the display text of an MC option by its letter (A, B, C, ...)
 */
export function getOptionTextForLetter(item, letter) {
  try {
    if (!item || !letter) return null;
    const opts = Array.isArray(item?.options)
      ? item.options.filter(Boolean)
      : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
    if (!opts.length) return null;
    const idx = String(letter).toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    if (idx < 0 || idx >= opts.length) return null;
    const raw = String(opts[idx] ?? '').trim();
    const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.:\)\-]\s*/i;
    const cleaned = raw.replace(anyLabel, '').trim();
    return cleaned || null;
  } catch { return null; }
}

/**
 * Ensure displayed/asked question ends with a question mark
 */
export function ensureQuestionMark(s) {
  try {
    const raw = String(s || '');
    if (!raw) return raw;
    const parts = raw.split('\n');
    if (!parts.length) return raw;
    const q = parts[0].trim();
    const withQM = q.endsWith('?') ? q : q.replace(/[.!]+$/, '') + '?';
    return [withQM, ...parts.slice(1)].join('\n');
  } catch {
    return s;
  }
}

/**
 * Ensure a single terminal question mark at the very end of the line (one line only)
 */
export function ensureSingleTerminalQuestionMark(s) {
  try {
    const raw = String(s || '');
    if (!raw) return raw;
    // Strip trailing punctuation and whitespace, then append exactly one '?'
    const withoutTrail = raw.replace(/\s*[?.!]+$/, '').trimEnd();
    return `${withoutTrail}?`;
  } catch {
    return s;
  }
}

/**
 * Build a single-line ask string; for MC, include lettered choices inline on the same line
 */
export function formatQuestionForInlineAsk(item) {
  if (!item) return '';
  try {
    const tfPrefix = isTrueFalse(item) ? 'True/False: ' : '';
    const baseRaw = String(item.prompt || item.question || '').trim();
    // Remove any trailing sentence punctuation from the stem; we'll add the final '?' at the very end later
    const base = baseRaw.replace(/\s*[?.!]+$/, '');
    const mcLine = formatMcOptions(item); // already single-line like "A.\u00A0foo,   B.\u00A0bar"
    const line = mcLine ? `${tfPrefix}${base} ${mcLine}` : `${tfPrefix}${base}`;
    // Avoid collapsing non-breaking spaces; only trim ends
    return line.trim();
  } catch {
    return '';
  }
}

/**
 * Lightweight validators for inline MC ask
 */
export function hasInlineMcChoices(s) {
  try {
    const t = String(s || '');
    // Expect at least A. and B. present on the same line as the question mark
    const line = t.split(/\n/).pop();
    return /\bA\s*\./.test(line) && /\bB\s*\./.test(line);
  } catch { return false; }
}

/**
 * Count question marks in a string
 */
export function countQuestionMarks(s) {
  try { return (String(s || '').match(/\?/g) || []).length; } catch { return 0; }
}

/**
 * Determine the letter label (A, B, C, ...) for the correct option when the expected/acceptable answer
 * matches one of the provided options. Returns the uppercase letter or null if not applicable.
 */
export function letterForAnswer(item, acceptableList = []) {
  try {
    const opts = Array.isArray(item?.options)
      ? item.options.filter(Boolean)
      : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
    if (!opts.length) return null;
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const norm = (s) => normalizeAnswer(String(s ?? ''));
    const acc = Array.from(new Set((acceptableList || []).map((v) => norm(v))));
    // If expected is directly a single letter, accept it as-is
    const directLetter = acc.find(v => /^[a-d]$/i.test(v));
    if (directLetter) return String(directLetter).toUpperCase();
    const tokenize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).filter(w => !['a','an','the'].includes(w));
    for (let i = 0; i < opts.length; i += 1) {
      const label = labels[i] || '';
      const raw = String(opts[i] ?? '').trim();
      // Strip ANY leading letter label for comparison
      const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
      const cleaned = raw.replace(anyLabel, '').trim();
      const nclean = norm(cleaned);
      if (acc.includes(nclean)) return label || null;
      // Also accept when acceptable term tokens are contained within option tokens (e.g., 'notebook' ⊆ 'a notebook')
      const optTokens = tokenize(nclean);
      for (const a of acc) {
        const accTokens = tokenize(a);
        if (accTokens.length && accTokens.every(t => optTokens.includes(t))) {
          return label || null;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Join list into natural language (A, B, or C)
 */
export function naturalJoin(arr, conj = 'or') {
  const list = (arr || []).map(s => String(s || '').trim()).filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} ${conj} ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, ${conj} ${list[list.length - 1]}`;
}

/**
 * Derive a speakable/displayable "correct answer" text using front-end info
 */
export function deriveCorrectAnswerText(problem, acceptableList = [], expectedPrimary = '') {
  try {
    const rawExpected = [problem?.answer, problem?.expected].find(v => v != null && String(v).trim().length > 0);
    const rawExpectedStr = rawExpected != null ? String(rawExpected).trim() : '';
    const options = Array.isArray(problem?.options) ? problem.options : (Array.isArray(problem?.choices) ? problem.choices : []);
    // MC: prefer letter + option text
    const letter = letterForAnswer(problem, acceptableList);
    if (letter) {
      const optText = getOptionTextForLetter(problem, letter) || '';
      if (optText) return `${letter}. ${optText}`;
      return letter;
    }
    // True/False: map synonyms to canonical
    if (isTrueFalse(problem)) {
      const accNorm = new Set((acceptableList || []).map(a => normalizeAnswer(a)));
      if (accNorm.has('true')) return 'True';
      if (accNorm.has('false')) return 'False';
      if (/^\s*true\s*$/i.test(rawExpectedStr)) return 'True';
      if (/^\s*false\s*$/i.test(rawExpectedStr)) return 'False';
    }
    // Prefer raw expected text if provided
    if (rawExpectedStr) return rawExpectedStr;
    // Otherwise use the first meaningful acceptable (skip bare letters)
    const acceptableClean = Array.from(new Set((acceptableList || [])
      .map(s => String(s || '').trim())
      .filter(Boolean)
      .filter(s => !/^[A-D]$/i.test(s))));
    if (acceptableClean.length) {
      // If many, present up to 3 joined with 'or'
      return naturalJoin(acceptableClean.slice(0, 3), 'or');
    }
    // As a last resort, surface keywords for short answer items
    if (!isMultipleChoice(problem) && !isTrueFalse(problem) && Array.isArray(problem?.keywords) && problem.keywords.length) {
      const kws = problem.keywords.map(k => String(k || '').trim()).filter(Boolean);
      if (kws.length) return naturalJoin(kws.slice(0, 4), 'and');
    }
    // Nothing to show
    return '';
  } catch {
    return '';
  }
}

/**
 * Compute heuristic duration for caption display based on sentence count and word count
 * @param {Array} sentences - Array of sentence strings
 * @returns {number} Duration in seconds
 */
export function computeHeuristicDuration(sentences = []) {
  try {
    const arr = Array.isArray(sentences) ? sentences : [];
    if (!arr.length) return 3.5;
    const totalWords = arr.reduce((sum, s) => sum + ((String(s).trim().split(/\s+/).filter(Boolean).length) || 1), 0) || arr.length;
    const base = Math.max(totalWords / 3.6, Math.min(arr.length * 1.5, 12));
    // Clamp between 1.5 and 300 seconds
    return Math.max(1.5, Math.min(base, 300));
  } catch { return 6; }
}

/**
 * Check if test item is open-ended (not MC or TF)
 */
export function isOpenEndedTestItem(q) {
  const t = String(q?.type || '').toLowerCase();
  if (t === 'mc' || t === 'multiplechoice' || q?.isMC) return false;
  if (t === 'tf' || t === 'truefalse' || q?.isTF) return false;
  return true;
}

/**
 * Get prompt key for deduplication
 */
export function promptKey(q) {
  return String(q?.prompt || q?.question || '').trim().toLowerCase();
}
