import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve paths robustly across Windows/macOS/Linux
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(path.join(__dirname, '..'));
const laDir = path.join(root, 'public', 'lessons', 'language arts');

const is5th = (name) => name.startsWith('5th_') && name.endsWith('.json');
const files = fs.readdirSync(laDir).filter(is5th);

const mustHaveArrays = ['sample', 'truefalse', 'multiplechoice', 'fillintheblank', 'shortanswer'];

let ok = true;
for (const file of files) {
  const full = path.join(laDir, file);
  let json;
  try {
    const txt = fs.readFileSync(full, 'utf8');
    json = JSON.parse(txt);
  } catch (e) {
    console.error(`JSON parse error in ${file}: ${e.message}`);
    ok = false;
    continue;
  }

  for (const key of mustHaveArrays) {
    const arr = json[key];
    if (!Array.isArray(arr)) {
      console.error(`${file}: '${key}' must be an array (found ${typeof arr}).`);
      ok = false;
      continue;
    }
    if (arr.length < 10) {
      console.error(`${file}: '${key}' must contain at least 10 items (found ${arr.length}).`);
      ok = false;
    }
    // Basic shape checks
    arr.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        console.error(`${file}: ${key}[${idx}] must be an object.`);
        ok = false;
        return;
      }
      if (typeof item.question !== 'string' || !item.question.trim()) {
        console.error(`${file}: ${key}[${idx}].question must be a non-empty string.`);
        ok = false;
      }
      if (!Array.isArray(item.expectedAny) && key !== 'multiplechoice') {
        console.error(`${file}: ${key}[${idx}].expectedAny should be an array (except MC can omit).`);
        ok = false;
      }
      if (key === 'multiplechoice') {
        if (!Array.isArray(item.choices) || item.choices.length < 2) {
          console.error(`${file}: multiplechoice[${idx}] must have 'choices' array with 2+ options.`);
          ok = false;
        }
        if (typeof item.correct !== 'number' || item.correct < 0 || item.correct >= (item.choices?.length ?? 0)) {
          console.error(`${file}: multiplechoice[${idx}] must have valid 'correct' index.`);
          ok = false;
        }
      }
    });
  }
}

if (!ok) {
  process.exit(1);
} else {
  console.log('All 5th grade language arts files passed validation.');
}
