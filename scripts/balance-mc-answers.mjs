#!/usr/bin/env node
/**
 * Rebalance multiple-choice correct answer letters across lesson JSON files.
 *
 * Strategy per file:
 * - For each multiplechoice item, move the correct choice to a target index that
 *   cycles 0..N-1 (usually 0..3 for A-D). This evens out the correct-letter distribution.
 * - Re-label choices as "A. ...", "B. ..." consistently and update item.expected to target letter.
 * - Only modifies files under public/lessons/**.json that contain a multiplechoice array.
 *
 * Safety:
 * - Non-multiplechoice sections are preserved untouched.
 * - If a question has fewer than 2 choices or invalid expected, it is left as-is.
 * - Keeps JSON pretty-printed with 2 spaces.
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const lessonsRoot = path.resolve(projectRoot, 'public', 'lessons');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function relabelChoices(choices) {
  const leadingLabelRe = /^\s*\(?[A-Z]\)?\s*[\.\)\-:]\s*/i;
  return choices.map((c, i) => {
    const label = LETTERS[i] || '';
    const text = String(c ?? '').replace(leadingLabelRe, '').trim();
    return `${label}. ${text}`;
  });
}

function desiredIndexFor(i, count) {
  if (!count) return 0;
  // Round-robin within the available choices count
  return i % count;
}

function findCorrectIndexByExpected(choices, expected) {
  const idx = (typeof expected === 'string') ? LETTERS.indexOf(expected.trim().toUpperCase()) : -1;
  if (idx >= 0 && idx < choices.length) return idx;
  return -1;
}

function moveCorrectToIndex(choices, currentCorrectIdx, targetIdx) {
  if (currentCorrectIdx === targetIdx) return choices.slice();
  const arr = choices.slice();
  const [correct] = arr.splice(currentCorrectIdx, 1);
  arr.splice(targetIdx, 0, correct);
  return arr;
}

function processFile(filePath) {
  let original;
  try {
    original = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error('[balance-mc] Failed to read', filePath, e.message);
    return { changed: false };
  }
  let json;
  try {
    json = JSON.parse(original);
  } catch (e) {
    console.error('[balance-mc] Invalid JSON in', filePath, e.message);
    return { changed: false };
  }
  if (!Array.isArray(json.multiplechoice) || json.multiplechoice.length === 0) {
    return { changed: false };
  }

  let changed = false;
  const updated = json.multiplechoice.map((q, i) => {
    try {
      const choices = Array.isArray(q.choices) ? q.choices.filter(Boolean) : [];
      const expected = q.expected ?? q.answer;
      if (!choices.length || typeof expected !== 'string') return q;
      const n = Math.min(choices.length, LETTERS.length);
      if (n < 2) return q;

      const curIdx = findCorrectIndexByExpected(choices, expected);
      if (curIdx < 0 || curIdx >= n) return q; // can't determine

      const targetIdx = desiredIndexFor(i, n);
      const rearranged = moveCorrectToIndex(choices, curIdx, targetIdx);

      // Re-label choices cleanly
      const relabeled = relabelChoices(rearranged);
      const newExpected = LETTERS[targetIdx];

      // Only mark changed if something actually differs
      const sameOrder = choices.length === relabeled.length && choices.every((c, k) => c === relabeled[k]);
      const sameExpected = String(q.expected ?? '') === String(newExpected);
      if (!sameOrder || !sameExpected) changed = true;

      return { ...q, choices: relabeled, expected: newExpected };
    } catch (e) {
      console.warn('[balance-mc] Skipping a question due to error in', filePath, e.message);
      return q;
    }
  });

  if (!changed) return { changed: false };

  const out = { ...json, multiplechoice: updated };
  const pretty = JSON.stringify(out, null, 2) + '\n';
  try {
    fs.writeFileSync(filePath, pretty, 'utf8');
  } catch (e) {
    console.error('[balance-mc] Failed to write', filePath, e.message);
    return { changed: false };
  }
  return { changed: true };
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) files.push(...walk(p));
    else if (ent.isFile() && p.toLowerCase().endsWith('.json')) files.push(p);
  }
  return files;
}

function main() {
  const files = walk(lessonsRoot);
  let touched = 0;
  let examined = 0;
  for (const f of files) {
    examined++;
    const res = processFile(f);
    if (res.changed) {
      touched++;
      console.log(`[balance-mc] Updated: ${path.relative(projectRoot, f)}`);
    }
  }
  console.log(`[balance-mc] Done. Examined ${examined} files, updated ${touched}.`);
}

main();
