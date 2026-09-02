// debug-bundle.js — find potential TDZ in session page bundle
const fs = require('fs');
const path = require('path');

// Find session page chunk
const chunks = fs.readdirSync('.next/static/chunks/app/session');
const pageChunk = chunks.find(f => f.startsWith('page-') && f.endsWith('.js'));
if (!pageChunk) { console.log('No session page chunk found'); process.exit(1); }

const file = `.next/static/chunks/app/session/${pageChunk}`;
console.log('Analyzing:', file);
const content = fs.readFileSync(file, 'utf8');
console.log('File size:', content.length, 'chars');

// Strategy 1: find all module boundaries and scan for const declared after use
// Module pattern in webpack: ,12345:(e,t,s)=>{"use strict";...}
const modulePattern = /,(\d+):\(e,t,s\)=>\{"use strict";/g;
let m;
const modules = [];
while ((m = modulePattern.exec(content)) !== null) {
  modules.push({ id: m[1], start: m.index, end: null });
}
for (let i = 0; i < modules.length - 1; i++) {
  modules[i].end = modules[i+1].start;
}
if (modules.length > 0) modules[modules.length-1].end = content.length;
console.log(`Found ${modules.length} webpack modules in session page chunk`);

// Strategy 2: look for variables used in object literals or calls BEFORE their const declaration
// This is the webpack scope hoisting TDZ pattern:
// Two-char identifiers like nC that appear as ()=>nC or similar before const nC=
const suspiciousVars = new Set();

for (const mod of modules) {
  const modCode = content.slice(mod.start, mod.end);
  
  // Find all let/const declarations of short 2-char names
  const declPattern = /\b(?:let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]{1,3})\s*=/g;
  let dm;
  const decls = [];
  while ((dm = declPattern.exec(modCode)) !== null) {
    decls.push({ name: dm[1], pos: dm.index });
  }
  
  // For each declared var, check if it appears BEFORE its declaration position
  for (const decl of decls) {
    const varName = decl.name;
    if (varName.length < 2) continue; // skip single-char
    // Look for uses of this var before its declaration position
    const usePattern = new RegExp(`\\b${varName}\\b`, 'g');
    let um;
    while ((um = usePattern.exec(modCode)) !== null) {
      if (um.index < decl.pos && um.index > 10) { // ignore module header
        // Make sure it's not another declaration
        const beforeCtx = modCode.slice(Math.max(0, um.index - 10), um.index);
        if (!/(?:let|const|var|function|class)\s*$/.test(beforeCtx)) {
          suspiciousVars.add(`Module ${mod.id}: var '${varName}' used at pos ${um.index} before decl at pos ${decl.pos}`);
          console.log(`\n⚠️  POTENTIAL TDZ: Module ${mod.id}`);
          console.log(`   var '${varName}' USED at pos ${um.index} BEFORE declared at pos ${decl.pos}`);
          console.log(`   Use context: ...${modCode.slice(Math.max(0,um.index-60), um.index+60)}...`);
          console.log(`   Decl context: ...${modCode.slice(Math.max(0,decl.pos-20), decl.pos+80)}...`);
          break;
        }
      }
    }
  }
}

if (suspiciousVars.size === 0) {
  console.log('\nNo TDZ patterns found within individual modules.');
  console.log('TDZ may be caused by webpack scope hoisting across modules.');
  
  // Strategy 3: look for the specific pattern where a const is exported
  // and imported by a module that evaluates before the exporting module
  console.log('\nLooking for modules that export constants used at module-init time...');
  
  // Find s.d(t, { X: ()=> CONST }) patterns which are re-exports
  const exportPattern = /s\.d\(t,\{([^}]+)\}\)/g;
  let em;
  while ((em = exportPattern.exec(content)) !== null) {
    // Check for arrow functions returning a const reference
    if (/:\(\)=>([a-z][A-Z])\b/.test(em[1])) {
      const ctx = content.slice(Math.max(0, em.index - 100), em.index + em[0].length + 100);
      console.log(`Export with const ref: ...${ctx}...`);
    }
  }
}

console.log('\nDone.');
