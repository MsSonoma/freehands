import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const lessonsDir = path.resolve('public', 'lessons', 'math');
const targetBasenames = new Set([
  '3rd_Multiplication_Facts_to_10x10_Beginner',
  '3rd_Division_Introduction_and_Facts_Intermediate',
  '3rd_Fractions_Understanding_Parts_of_Whole_Advanced',
  '3rd_Place_Value_to_Thousands_Beginner',
  '3rd_Measurement_Perimeter_and_Area_Intermediate',
  '3rd_Time_Elapsed_Time_and_Intervals_Advanced',
  '3rd_Money_Adding_and_Subtracting_Amounts_Beginner',
  '3rd_Data_Analysis_Bar_Graphs_Pictographs_Intermediate',
  '3rd_Problem_Solving_Multi_Step_Word_Problems_Advanced',
]);
const requiredCategories = [
  'sample',
  'truefalse',
  'multiplechoice',
  'fillintheblank',
  'shortanswer',
  'wordProblems',
];

function pad(str, n) {
  return (str + ' '.repeat(n)).slice(0, n);
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

  // Check categories
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
  files = files.filter((f) => targetBasenames.has(path.basename(f, '.json')));

  if (files.length === 0) {
    console.log('No 3rd grade math lesson files found.');
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
