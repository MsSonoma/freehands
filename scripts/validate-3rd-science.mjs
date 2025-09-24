import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const lessonsDir = path.resolve('public', 'lessons', 'science');
const requiredCategories = [
  'sample',
  'truefalse',
  'multiplechoice',
  'fillintheblank',
  'shortanswer',
];

function pad(str, n) {
  return (str + ' '.repeat(n)).slice(0, n);
}

function isThirdGrade(fileName) {
  return fileName.startsWith('3rd_');
}

async function validateFile(filePath) {
  const rel = path.relative(process.cwd(), filePath);
  const base = path.basename(filePath, '.json');
  let text;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (e) {
    return { file: rel, ok: false, errors: [`Read error: ${e.message}`] };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { file: rel, ok: false, errors: [`JSON parse error: ${e.message}`] };
  }

  const errors = [];

  // ID should match filename
  if (data.id && data.id !== base) {
    errors.push(`id mismatch: id='${data.id}' vs filename='${base}'`);
  }

  // wordProblems must not exist for science
  if ('wordProblems' in data) {
    errors.push("'wordProblems' must not be present for non-math lessons");
  }

  // Categories must exist and have exactly 7 items
  for (const cat of requiredCategories) {
    const arr = data[cat];
    if (!Array.isArray(arr)) {
      errors.push(`Category '${cat}' is not an array`);
      continue;
    }
    if (arr.length !== 7) {
      errors.push(`Category '${cat}' length ${arr.length} != 7`);
    }
  }

  return { file: rel, ok: errors.length === 0, errors };
}

async function main() {
  let files = await readdir(lessonsDir);
  files = files.filter((f) => isThirdGrade(f));

  if (files.length === 0) {
    console.log('No 3rd grade science lesson files found.');
    process.exit(1);
  }

  const results = await Promise.all(
    files.map((f) => validateFile(path.join(lessonsDir, f)))
  );

  let pass = 0;
  let fail = 0;
  for (const r of results) {
    if (r.ok) {
      pass++;
      console.log(`OK   ${pad(r.file, 100)}`);
    } else {
      fail++;
      console.log(`FAIL ${pad(r.file, 100)}`);
      for (const e of r.errors) {
        console.log(`  - ${e}`);
      }
    }
  }

  console.log(`\nSummary: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
