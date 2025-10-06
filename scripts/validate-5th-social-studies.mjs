// Validate all 5th grade social studies lesson JSONs for required shape
// - Arrays for: sample, truefalse, multiplechoice, fillintheblank, shortanswer
// - Each array must have >= 10 items
// - multiplechoice items must include choices[] (>=3) and a valid numeric correct index

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toAbsolute(p) {
  if (!p) return p;
  if (path.isAbsolute(p)) return p;
  return path.resolve(__dirname, '..', p);
}

const lessonsDir = toAbsolute('public/lessons/social studies');

function isArrayWithMin(arr, n) {
  return Array.isArray(arr) && arr.length >= n;
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function readJson(file) {
  const buf = await fs.readFile(file, 'utf8');
  try {
    return JSON.parse(buf);
  } catch (e) {
    throw new Error(`JSON parse failed for ${file}: ${e.message}`);
  }
}

function validateMC(item, file, idx, errors) {
  assert('choices' in item, `${file} multiplechoice[${idx}] missing choices[]`, errors);
  assert(Array.isArray(item.choices), `${file} multiplechoice[${idx}] choices is not an array`, errors);
  assert(item.choices.length >= 3, `${file} multiplechoice[${idx}] needs at least 3 choices`, errors);
  assert(Number.isInteger(item.correct), `${file} multiplechoice[${idx}] correct must be an integer index`, errors);
  if (Number.isInteger(item.correct)) {
    assert(item.correct >= 0 && item.correct < item.choices.length, `${file} multiplechoice[${idx}] correct index out of range`, errors);
  }
}

async function main() {
  const files = (await fs.readdir(lessonsDir))
    .filter((f) => /^5th_/.test(f) && f.endsWith('.json'))
    .map((f) => path.join(lessonsDir, f));

  if (!files.length) {
    console.error(`No 5th grade social studies files found under ${lessonsDir}`);
    process.exit(1);
  }

  let total = 0;
  const allErrors = [];
  for (const file of files) {
    const data = await readJson(file);
    const errs = [];

    const requiredArrays = ['sample', 'truefalse', 'multiplechoice', 'fillintheblank', 'shortanswer'];
    for (const key of requiredArrays) {
      assert(key in data, `${file} missing key '${key}'`, errs);
      if (key in data) assert(isArrayWithMin(data[key], 10), `${file} key '${key}' must be an array with >= 10 items`, errs);
    }

    if (Array.isArray(data.multiplechoice)) {
      data.multiplechoice.forEach((mc, i) => validateMC(mc, file, i, errs));
    }

    if (errs.length) {
      allErrors.push(...errs);
      console.error(`FAIL: ${path.basename(file)}`);
      errs.forEach((e) => console.error('  - ' + e));
    } else {
      console.log(`PASS: ${path.basename(file)}`);
      total += 1;
    }
  }

  console.log(`\nValidated ${total}/${files.length} 5th grade social studies files.`);
  if (allErrors.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
