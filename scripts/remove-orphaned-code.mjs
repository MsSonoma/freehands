import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/session/page.js';
const content = readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log(`Original file: ${lines.length} lines`);

// Step 1: Add imports after the existing imports if not already present
const componentImports = [
  `import Timeline from './components/Timeline';`,
  `import CurrentAssessmentPrompt from './components/CurrentAssessmentPrompt';`,
  `import CaptionPanel from './components/CaptionPanel';`,
  `import DownloadPanel from './components/DownloadPanel';`,
  `import InputPanel from './components/InputPanel';`,
  `import VideoPanel from './components/VideoPanel';`,
  `import PhaseDetail from './components/PhaseDetail';`
];

// Find the line after the last import statement
let lastImportIndex = -1;
for (let i = 0; i < Math.min(100, lines.length); i++) {
  if (lines[i].trim().startsWith('import ')) {
    lastImportIndex = i;
  }
}

if (lastImportIndex === -1) {
  console.error('Could not find import statements');
  process.exit(1);
}

// Check if our imports are already there
const hasImports = componentImports.some(imp => content.includes(imp));
if (!hasImports) {
  console.log(`Adding component imports after line ${lastImportIndex + 1}`);
  lines.splice(lastImportIndex + 1, 0, ...componentImports);
  console.log(`Added ${componentImports.length} import statements`);
}

// Step 2: Find where SessionPageInner component ends
// Look for ");\n}" pattern after "Intentionally nothing rendered below the fixed footer"
let componentEndIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Intentionally nothing rendered below the fixed footer')) {
    // Found the comment, now look for the closing );\n}
    for (let j = i; j < Math.min(i + 10, lines.length); j++) {
      if (lines[j].trim() === '}' && j > i + 2) {
        // Check if previous line is );
        if (lines[j-1].trim() === ');') {
          componentEndIndex = j;
          break;
        }
      }
    }
    break;
  }
}

if (componentEndIndex === -1) {
  console.error('Could not find SessionPageInner component end');
  process.exit(1);
}

console.log(`Found SessionPageInner end at line ${componentEndIndex + 1}`);

// Keep everything up to and including that line
const cleanLines = lines.slice(0, componentEndIndex + 1);

// Write back
writeFileSync(filePath, cleanLines.join('\n') + '\n', 'utf-8');
console.log(`✅ Removed orphaned code. File now has ${cleanLines.length + 1} lines (was ${lines.length})`);
