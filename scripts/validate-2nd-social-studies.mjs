import fs from 'fs';
import path from 'path';

const folder = path.join(process.cwd(), 'public', 'lessons', 'social studies');
const cats = ['sample', 'truefalse', 'multiplechoice', 'fillintheblank', 'shortanswer'];
let allOk = true;

function validateFile(fp) {
  const rel = path.relative(process.cwd(), fp).replace(/\\/g, '/');
  let txt;
  try {
    txt = fs.readFileSync(fp, 'utf8');
  } catch (e) {
    console.error(`READ FAIL ${rel}: ${e.message}`);
    allOk = false;
    return;
  }
  let json;
  try {
    json = JSON.parse(txt);
  } catch (e) {
    console.error(`JSON FAIL ${rel}: ${e.message}`);
    allOk = false;
    return;
  }
  // Ensure no wordProblems in social studies
  if (Object.prototype.hasOwnProperty.call(json, 'wordProblems')) {
    console.error(`SCHEMA FAIL ${rel}: has wordProblems key`);
    allOk = false;
  }
  for (const c of cats) {
    const arr = json[c];
    if (!Array.isArray(arr)) {
      console.error(`SCHEMA FAIL ${rel}: ${c} is not an array`);
      allOk = false;
      continue;
    }
    if (arr.length !== 7) {
      console.error(`LEN FAIL ${rel}: ${c} has length ${arr.length} (expected 7)`);
      allOk = false;
    }
  }
  if (allOk) {
    console.log(`${rel}: OK`);
  }
}

const files = fs.readdirSync(folder)
  .filter(f => f.startsWith('2nd_') && f.endsWith('.json'))
  .map(f => path.join(folder, f));

if (files.length === 0) {
  console.error('No 2nd grade Social Studies files found');
  process.exit(1);
}

for (const f of files) {
  validateFile(f);
}

process.exit(allOk ? 0 : 1);
