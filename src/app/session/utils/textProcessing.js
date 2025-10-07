/**
 * Text processing utilities for the session page.
 * Pure functions with no dependencies on React or app state.
 */

/**
 * Split text into sentences, handling multi-line input and various punctuation.
 * @param {string} text - The text to split
 * @returns {string[]} Array of sentence strings
 */
export function splitIntoSentences(text) {
  if (!text) return [];
  try {
    const lines = String(text).split(/\n+/);
    const out = [];
    for (const lineRaw of lines) {
      const line = String(lineRaw).replace(/[\t ]+/g, ' ').trimEnd();
      if (!line) continue;
      const parts = line
        .split(/(?<=[.?!])/)
        .map((part) => String(part).trim())
        .filter(Boolean);
      if (parts.length) out.push(...parts);
    }
    return out.length ? out : [String(text).trim()];
  } catch {
    return [String(text).trim()];
  }
}

/**
 * Merge multiple-choice label fragments so options stay inline or multiline.
 * Example input: ["A.", "7, B.", "70, C.", "700, D.", "7000"]
 * Output: ["A. 7,   B. 70,   C. 700,   D. 7000"]
 * 
 * @param {string[]} sentences - Array of sentence fragments
 * @param {string} layout - 'inline' or 'multiline'
 * @returns {string[]} Merged sentences with MC choices formatted
 */
export function mergeMcChoiceFragments(sentences, layout = 'inline') {
  if (!Array.isArray(sentences) || !sentences.length) return sentences || [];
  const out = [];
  const isLabelToken = (s) => /^\(?[A-Z]\)?\s*[.:)\-]\s*$/.test(String(s || '').trim());
  const startsWithLabel = (s) => /^\(?[A-Z]\)?\s*[.:)\-]\s+/.test(String(s || ''));
  const isNumberLine = (s) => /^\d+\.\s*$/.test(String(s || '').trim()); // e.g., "4."

  let i = 0;
  while (i < sentences.length) {
    const cur = String(sentences[i] ?? '');
    const trimmed = cur.trim();

    if (isLabelToken(trimmed) || startsWithLabel(trimmed)) {
      // 1) Build pairs greedily: A. text, B. text, ... possibly split across tokens
      const parts = [];
      // Seed first pair
      if (startsWithLabel(trimmed) && !isLabelToken(trimmed)) {
        const m = trimmed.match(/^\(?([A-Z])\)?\s*[.:)\-]\s+(.*)$/);
        if (m) parts.push(`${m[1]}. ${m[2].trim()}`);
      } else if (isLabelToken(trimmed)) {
        const label = trimmed.match(/^\(?([A-Z])\)?/)[1];
        // Pair with following non-empty token as choice text
        let j = i + 1;
        while (j < sentences.length && String(sentences[j]).trim() === '') j++;
        const choice = j < sentences.length ? String(sentences[j]).trim() : '';
        if (choice) i = j; // advance to the choice token
        parts.push(`${label}. ${choice}`.trim());
      }

      // Continue greedily collecting subsequent label fragments
      let k = i + 1;
      while (k < sentences.length) {
        const nxt = String(sentences[k] ?? '');
        const ntrim = nxt.trim();
        if (isLabelToken(ntrim)) {
          const label = ntrim.match(/^\(?([A-Z])\)?/)[1];
          let m = k + 1;
          while (m < sentences.length && String(sentences[m]).trim() === '') m++;
          const choice = m < sentences.length ? String(sentences[m]).trim() : '';
          if (choice) k = m;
          parts.push(`${label}. ${choice}`.trim());
          k += 1;
          continue;
        }
        if (startsWithLabel(ntrim)) {
          const m = ntrim.match(/^\(?([A-Z])\)?\s*[.:)\-]\s+(.*)$/);
          if (m) parts.push(`${m[1]}. ${m[2].trim()}`);
          k += 1;
          continue;
        }
        break;
      }

      // 2) Optionally prepend preceding numeric line like "4." for Test phase numbering
      let prefix = '';
      if (out.length && isNumberLine(out[out.length - 1])) {
        prefix = String(out.pop()).trim();
      }

      // 3) If prior output line is a question/stem, decide how to attach options
      let head = '';
      if (out.length) {
        const prev = String(out[out.length - 1]);
        if (/[?)]$/.test(prev)) head = String(out.pop());
      }

      if (layout === 'multiline') {
        // Keep the question/stem as its own line, then list each option on a new line
        if (head) {
          const withPrefix = prefix ? `${prefix} ${head}` : head;
          out.push(withPrefix.trim());
        } else if (prefix && parts.length) {
          // No explicit head; attach prefix to the first option
          parts[0] = `${prefix} ${parts[0]}`;
        }
        for (const p of parts) {
          out.push(p.trim());
        }
        i = k + 1;
        continue;
      } else {
        const inline = parts.join(',   ');
        let finalLine = head ? `${head}   ${inline}` : inline;
        if (prefix) finalLine = `${prefix} ${finalLine}`;
        if (!/[.?!]$/.test(finalLine)) finalLine += '.';
        out.push(finalLine.trim());
        i = k + 1;
        continue;
      }
    }

    out.push(sentences[i]);
    i += 1;
  }
  return out;
}

/**
 * Ensure letter labels and their choices stay together visually by replacing
 * normal spaces after labels with non-breaking spaces.
 * Handles patterns like "A.", "(B)", "C:", "D)".
 * 
 * @param {string} text - Text to process
 * @returns {string} Text with NBSP after MC labels
 */
export function enforceNbspAfterMcLabels(text) {
  try {
    if (typeof text !== 'string') return text;
    return text
      .replace(/\(A\)/g, '(A)') // normalize unexpected variants just in case
      .replace(/\b\(?([A-D])\)?\s*([.:)\-])\s+(?=\S)/g, (_m, p1, p2) => `${p1}.\u00A0`)
      .replace(/\b([A-D])\)\s+(?=\S)/g, (_m, p1) => `${p1}).\u00A0`);
  } catch { return text; }
}

/**
 * Count words in a sentence or sentence-like object. Used for caption pacing.
 * Accepts a string or an object with a `text` field; returns a minimum of 1.
 * 
 * @param {string|{text: string}} s - String or object with text field
 * @returns {number} Word count (minimum 1)
 */
export function countWords(s) {
  try {
    const raw = (typeof s === 'string') ? s : (s && typeof s.text === 'string' ? s.text : '');
    if (!raw) return 1;
    // Normalize non-breaking spaces and collapse whitespace
    const norm = String(raw).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    if (!norm) return 1;
    // Split on spaces after stripping simple punctuation groups
    const cleaned = norm.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[^A-Za-z0-9'+\-]+/g, ' ');
    const parts = cleaned.trim().split(/\s+/).filter(Boolean);
    return parts.length || 1;
  } catch { return 1; }
}
