import fs from 'fs';
import path from 'path';

const lessonsDir = path.resolve('public', 'lessons');

function isMathPath(p) {
  // path components are case-insensitive on Windows; normalize to lower
  return p.toLowerCase().split(path.sep).includes('math');
}

function processFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let data = JSON.parse(raw);
    if (data && data.wordProblems !== undefined) {
      delete data.wordProblems;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      return true;
    }
  } catch (err) {
    console.error('Error processing', filePath, err.message);
  }
  return false;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
    } else if (ent.isFile() && ent.name.endsWith('.json')) {
      if (!isMathPath(full)) {
        const removed = processFile(full);
        if (removed) console.log('Updated', full);
      }
    }
  }
}

console.log('Removing wordProblems from non-math lesson files under', lessonsDir);
walk(lessonsDir);
console.log('Done.');
