#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.resolve('src/app');
const allowedFiles = new Set([
  'layout.js',
  'page.js',
  'error.js',
  'global-error.js',
  'not-found.js',
  'favicon.ico',
  'globals.css',
  'HeaderBar.js',
  'home-hero.module.css',
]);

function scanAppDir(dir) {
  const issues = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // scan subfolders shallowly for misplaced files with spaces
      const subEntries = fs.readdirSync(p, { withFileTypes: true });
      for (const se of subEntries) {
        if (se.isFile() && se.name.includes(' ')) {
          issues.push({ type: 'space-in-name', path: path.join(p, se.name) });
        }
      }
    } else if (entry.isFile()) {
      if (!allowedFiles.has(entry.name)) {
        issues.push({ type: 'unexpected-file', path: p });
      }
      if (entry.name.includes(' ')) {
        issues.push({ type: 'space-in-name', path: p });
      }
    }
  }
  return issues;
}

function checkMiddleware() {
  const p = path.resolve('middleware.js');
  if (fs.existsSync(p)) {
    const src = fs.readFileSync(p, 'utf8');
    const hasExport = /export\s+function\s+middleware\s*\(/.test(src);
    return { exists: true, hasExport };
  }
  return { exists: false, hasExport: false };
}

try {
  const issues = scanAppDir(appDir);
  const mw = checkMiddleware();

  if (issues.length === 0 && !(mw.exists && mw.hasExport)) {
    console.log('Doctor: No structural issues found in src/app or middleware.');
    process.exit(0);
  }

  console.log('Doctor: Potential issues detected');
  for (const it of issues) {
    console.log(`- [${it.type}] ${it.path}`);
  }
  if (mw.exists && mw.hasExport) {
    console.log('- [middleware] middleware.js exports a middleware() function; disable/remove in dev if not needed.');
  }
  process.exit(1);
} catch (e) {
  console.error('Doctor: Failed to scan', e?.message || e);
  process.exit(2);
}
