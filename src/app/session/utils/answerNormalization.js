/**
 * Answer normalization utilities for evaluating learner responses.
 * Includes stopword filtering, stemming, number-word conversion, and text normalization.
 */

/**
 * Common stopwords to filter out during answer normalization
 */
export const STOPWORDS = new Set([
  'a','an','the','to','of','in','on','at','and','or','is','are','am','was','were','be','being','been',
  'it','its','it\'s','i','im','i\'m','me','my','mine','you','your','yours','we','us','our','ours',
  'please','thanks','thank','okay','ok','yup','yeah','hey','hi'
]);

/**
 * Remove diacritical marks from text
 * @param {string} s - Input string
 * @returns {string} String with diacritics removed
 */
const stripDiacritics = (s) => {
  try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { return s; }
};

/**
 * Simple stemming function to reduce words to base forms
 * @param {string} t - Token to stem
 * @returns {string} Stemmed token
 */
const simpleStem = (t) => {
  let w = t;
  w = w.replace(/'(s|re|ve|d|ll|m)$/i, '');
  if (/ies$/i.test(w) && w.length > 3) w = w.slice(0, -3) + 'y';
  else if (/([sxz]|ch|sh)es$/i.test(w) && w.length > 3) w = w.replace(/es$/i, '');
  else if (/s$/i.test(w) && !/ss$/i.test(w) && w.length > 3) w = w.slice(0, -1);
  if (/ing$/i.test(w) && w.length > 4) w = w.slice(0, -3);
  else if (/ed$/i.test(w) && w.length > 3) w = w.replace(/ed$/i, '');
  return w;
};

/**
 * Map of ordinal words to their numeric equivalents
 */
const ORDINALS = new Map(Object.entries({
  'first':'1','second':'2','third':'3','fourth':'4','fifth':'5','sixth':'6','seventh':'7','eighth':'8','ninth':'9','tenth':'10',
  'eleventh':'11','twelfth':'12','thirteenth':'13','fourteenth':'14','fifteenth':'15','sixteenth':'16','seventeenth':'17','eighteenth':'18','nineteenth':'19','twentieth':'20'
}));

/**
 * Small number words (0-19)
 */
const SMALLS = new Map(Object.entries({
  zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
  ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19
}));

/**
 * Tens number words (20-90)
 */
const TENS = new Map(Object.entries({
  twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90
}));

/**
 * Scale words (hundred, thousand)
 */
const SCALES = new Map(Object.entries({ hundred:100, thousand:1000 }));

/**
 * Convert number words to numeric value starting from a token position
 * @param {string[]} tokens - Array of tokens
 * @param {number} start - Starting index
 * @returns {Object|null} Object with {value, consumed} or null if no number words found
 */
const wordsToNumberFrom = (tokens, start) => {
  let i = start; let total = 0; let current = 0; let consumed = 0; let matched = false;
  while (i < tokens.length) {
    const tk = tokens[i];
    if (SMALLS.has(tk)) { current += SMALLS.get(tk); matched = true; i += 1; consumed += 1; continue; }
    if (TENS.has(tk)) {
      current += TENS.get(tk);
      // optional unit after tens
      if (i + 1 < tokens.length && SMALLS.has(tokens[i+1])) { current += SMALLS.get(tokens[i+1]); i += 1; consumed += 1; }
      matched = true; i += 1; consumed += 1; continue;
    }
    if (SCALES.has(tk)) {
      const scale = SCALES.get(tk);
      if (current === 0) current = 1;
      current *= scale;
      total += current; current = 0;
      matched = true; i += 1; consumed += 1; continue;
    }
    break;
  }
  if (!matched) return null;
  total += current;
  return { value: total, consumed };
};

/**
 * Split string into tokens (whitespace-separated)
 * @param {string} s - Input string
 * @returns {string[]} Array of tokens
 */
export const tokenize = (s) => String(s || '').split(/\s+/).filter(Boolean);

/**
 * Normalize an answer for comparison - lowercase, remove diacritics, punctuation,
 * convert number words to digits, remove stopwords, apply stemming
 * @param {*} val - Input value to normalize
 * @returns {string} Normalized string
 */
export function normalizeAnswer(val) {
  if (val == null) return '';
  let s = String(val).toLowerCase();
  s = stripDiacritics(s);
  // Convert ordinal digits like 1st -> 1
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1');
  // Replace punctuation/underscores/hyphens with spaces
  s = s.replace(/[\-_]/g, ' ');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // Early return for pure digits
  if (/^-?\d+$/.test(s)) return String(parseInt(s, 10));
  // Normalize ordinal words
  const ord = ORDINALS.get(s);
  if (ord) return ord;
  // Tokenize for number-word sequences and stopwords/stemming
  let toks = tokenize(s);
  // Map ordinal words to digits at token level
  toks = toks.map(t => ORDINALS.get(t) || t);
  // Replace sequences of number words with digits
  const out = [];
  for (let i = 0; i < toks.length; ) {
    const res = wordsToNumberFrom(toks, i);
    if (res && res.consumed > 0) {
      out.push(String(res.value));
      i += res.consumed; continue;
    }
    out.push(toks[i]); i += 1;
  }
  // Remove stopwords and stem
  const out2 = out
    .filter(t => !STOPWORDS.has(t))
    .map(t => simpleStem(t))
    .filter(Boolean);
  return out2.join(' ').trim();
}
