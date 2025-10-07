import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/session/page.js';
const content = readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log(`Original file: ${lines.length} lines`);

// Remove computeHeuristicDuration function (around line 1709-1718)
let removed = 0;
let newLines = [];
let i = 0;
let inRemovalBlock = false;
let blockStartPattern = null;
let blockEndPattern = null;

while (i < lines.length) {
  const line = lines[i];
  
  // Start of computeHeuristicDuration function
  if (line.trim().startsWith('const computeHeuristicDuration = (sentences = []) => {')) {
    inRemovalBlock = true;
    blockStartPattern = 'computeHeuristicDuration';
    console.log(`Removing computeHeuristicDuration starting at line ${i + 1}`);
    i++;
    continue;
  }
  
  // Start of isOpenEndedTestItem function
  if (line.trim().startsWith('const isOpenEndedTestItem = (q) => {')) {
    inRemovalBlock = true;
    blockStartPattern = 'isOpenEndedTestItem';
    console.log(`Removing isOpenEndedTestItem starting at line ${i + 1}`);
    i++;
    continue;
  }
  
  // Start of formatMcOptions function (large block from ~line 3933-4300)
  if (line.trim().startsWith('const formatMcOptions = (item, { layout')) {
    inRemovalBlock = true;
    blockEndPattern = 'const wordDeckRef = useRef([]);';
    console.log(`Removing question formatting block starting at line ${i + 1}`);
    i++;
    continue;
  }
  
  // Check for end of removal block by specific end pattern
  if (inRemovalBlock && blockEndPattern && line.trim() === blockEndPattern) {
    console.log(`End of ${blockStartPattern || 'block'} removal at line ${i + 1}`);
    inRemovalBlock = false;
    blockEndPattern = null;
    blockStartPattern = null;
    newLines.push(line);
    i++;
    continue;
  }
  
  // Check for end of small function blocks
  if (inRemovalBlock && !blockEndPattern) {
    // Count braces to find function end
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    
    // Simple heuristic: if we hit a line with }; at the end and it's at the same indentation
    // as the function start, we've found the end
    if (line.trim() === '};' && line.startsWith('  }')) {
      console.log(`End of ${blockStartPattern} removal at line ${i + 1}`);
      inRemovalBlock = false;
      blockStartPattern = null;
      removed++;
      i++;
      continue;
    }
  }
  
  if (!inRemovalBlock) {
    newLines.push(line);
  } else {
    removed++;
  }
  
  i++;
}

writeFileSync(filePath, newLines.join('\n'), 'utf-8');
console.log(`✅ Removed ${removed} lines. File now has ${newLines.length} lines (was ${lines.length})`);
