#!/usr/bin/env node

/**
 * Cleanup old transcript artifacts that only contain Supabase InvalidJWT errors.
 *
 * Usage examples:
 *   node scripts/cleanup-invalid-transcripts.mjs --learner-name Emma
 *   node scripts/cleanup-invalid-transcripts.mjs --learner-id 123e4567-e89b-12d3-a456-426614174000 --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function hydrateEnv() {
  const candidates = [
    join(rootDir, '.env.local'),
    join(rootDir, '.env'),
  ];
  try {
    const dotenvMod = await import('dotenv');
    const dotenv = dotenvMod?.default || dotenvMod;
    for (const file of candidates) {
      dotenv.config({ path: file });
    }
  } catch {
    for (const file of candidates) {
      try {
        const content = await fs.readFile(file, 'utf8');
        applyEnvText(content);
      } catch {}
    }
  }
}

await hydrateEnv();

function applyEnvText(text) {
  if (!text) return;
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    if (!raw) continue;
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const store = supabase.storage.from('transcripts');

const args = process.argv.slice(2);
let learnerIdArg = null;
let learnerNameArg = null;
let dryRun = false;

const INVALID_LINE_PATTERNS = [
  /{"statusCode"\s*:\s*"400"\s*,\s*"error"\s*:\s*"InvalidJWT"/i,
  /"exp"\s*claim\s*timestamp\s*check\s*failed/i,
];

function sanitizeTranscriptLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        const text = entry.replace(/\s+/g, ' ').trim();
        if (!text) return null;
        if (INVALID_LINE_PATTERNS.some((re) => re.test(text))) return null;
        return { role: 'assistant', text };
      }
      if (typeof entry === 'object') {
        const rawText = typeof entry.text === 'string' ? entry.text : '';
        const text = rawText.replace(/\s+/g, ' ').trim();
        if (!text) return null;
        if (INVALID_LINE_PATTERNS.some((re) => re.test(text))) return null;
        const role = entry.role === 'user' ? 'user' : 'assistant';
        return { role, text };
      }
      return null;
    })
    .filter(Boolean);
}

function sanitizeLedgerSegments(ledger) {
  if (!Array.isArray(ledger)) return [];
  const out = [];
  for (const seg of ledger) {
    const lines = sanitizeTranscriptLines(seg?.lines);
    if (!lines.length) continue;
    const startedAt = seg?.startedAt || seg?.completedAt || new Date().toISOString();
    const completedAt = seg?.completedAt ? seg.completedAt : undefined;
    const entry = { startedAt, lines };
    if (completedAt) entry.completedAt = completedAt;
    out.push(entry);
  }
  return out;
}

for (let i = 0; i < args.length; i += 1) {
  const token = args[i];
  if (token === '--learner-id' && args[i + 1]) {
    learnerIdArg = args[i + 1];
    i += 1;
  } else if (token === '--learner-name' && args[i + 1]) {
    learnerNameArg = args[i + 1];
    i += 1;
  } else if (token === '--dry-run') {
    dryRun = true;
  } else if (token === '--help' || token === '-h') {
    printUsage();
    process.exit(0);
  }
}

if (!learnerIdArg && !learnerNameArg) {
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.log(`\nCleanup transcript artifacts that only contain InvalidJWT messages.\n\nUsage:\n  node scripts/cleanup-invalid-transcripts.mjs --learner-name Emma\n  node scripts/cleanup-invalid-transcripts.mjs --learner-id <uuid> [--dry-run]\n`);
}

async function fetchLearners() {
  if (learnerIdArg) {
    const { data, error } = await supabase
      .from('learners')
      .select('id,name,facilitator_id,owner_id,user_id')
      .eq('id', learnerIdArg)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? [data] : [];
  }

  const { data, error } = await supabase
    .from('learners')
    .select('id,name,facilitator_id,owner_id,user_id')
    .ilike('name', learnerNameArg);
  if (error) throw error;
  return data || [];
}

async function listAll(path, pageSize = 200) {
  const items = [];
  let offset = 0;
  while (true) {
    const { data, error } = await store.list(path, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) {
      if (error.status === 404 || /not found/i.test(error.message || '')) break;
      throw error;
    }
    if (!data || data.length === 0) break;
    items.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return items;
}

async function loadLedger(path) {
  try {
    const { data, error } = await store.download(path);
    if (error) {
      if (error.status === 404 || /not found/i.test(error.message || '')) return null;
      throw error;
    }
    const text = await data.text();
    if (!text) return [];
    return JSON.parse(text);
  } catch (err) {
    console.warn('  ⚠️  Failed to load ledger', path, err.message);
    return null;
  }
}

async function loadTranscriptText(basePath) {
  const txtPath = `${basePath}/transcript.txt`;
  try {
    const { data, error } = await store.download(txtPath);
    if (error) return null;
    return await data.text();
  } catch {
    return null;
  }
}

function isHeaderOnlyTranscript(text) {
  if (!text) return false;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return false;

  const headerMatchers = [
    /^learner\s*:/i,
    /^lesson\s*id\s*:/i,
    /^session\s+\d+/i,
    /transcript/i,
  ];

  return lines.every((line) => headerMatchers.some((matcher) => matcher.test(line)));
}

async function collectPathsWithPrefix(prefix) {
  const paths = [];
  const pageSize = 200;
  let offset = 0;
  while (true) {
    const { data, error } = await store.list(prefix, { limit: pageSize, offset });
    if (error) {
      if (error.status === 404 || /not found/i.test(error.message || '')) break;
      throw error;
    }
    if (!data || data.length === 0) break;
    for (const item of data) {
      if (item?.name) {
        paths.push(`${prefix}/${item.name}`);
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return Array.from(new Set(paths));
}

async function removeAllUnder(prefix) {
  const paths = await collectPathsWithPrefix(prefix);
  if (!paths.length) return { removed: 0 };
  if (dryRun) {
    return { removed: paths.length, dryRun: true };
  }
  const { error } = await store.remove(paths);
  if (error) throw error;
  return { removed: paths.length };
}

function ledgerChanged(original, sanitized) {
  if (!Array.isArray(original) && !Array.isArray(sanitized)) return false;
  if ((original?.length || 0) !== (sanitized?.length || 0)) return true;
  try {
    return JSON.stringify(original) !== JSON.stringify(sanitized);
  } catch {
    return true;
  }
}

async function cleanupLedger({ basePath, lessonId, learner }) {
  const ledgerPath = `${basePath}/ledger.json`;
  const ledger = await loadLedger(ledgerPath);
  
  // Always check if transcript text is header-only or invalid, even when ledger exists
  const txt = await loadTranscriptText(basePath);
  const hasInvalidText = txt && INVALID_LINE_PATTERNS.some((re) => re.test(txt));
  const hasHeaderOnlyText = txt && isHeaderOnlyTranscript(txt);
  
  if (ledger == null) {
    if (txt && (hasInvalidText || hasHeaderOnlyText)) {
      const reason = hasInvalidText ? 'txt-only InvalidJWT' : 'header-only transcript';
      console.log(`  - Removing transcript artifacts at ${basePath} (${reason})`);
      const stats = await removeAllUnder(basePath);
      return { removed: true, removedFiles: stats.removed, dryRun: stats.dryRun || false };
    }
    return { skipped: true };
  }

  const sanitized = sanitizeLedgerSegments(ledger);
  const hasSegments = sanitized.length > 0;
  
  if (!hasSegments) {
    console.log(`  - Removing empty ledger at ${ledgerPath}`);
    const stats = await removeAllUnder(basePath);
    return { removed: true, removedFiles: stats.removed, dryRun: stats.dryRun || false };
  }

  // If ledger has valid segments but transcript text is header-only, delete the whole folder
  if (hasHeaderOnlyText) {
    console.log(`  - Removing folder with header-only transcript at ${basePath}`);
    const stats = await removeAllUnder(basePath);
    return { removed: true, removedFiles: stats.removed, dryRun: stats.dryRun || false };
  }

  if (!ledgerChanged(ledger, sanitized)) {
    return { unchanged: true };
  }

  console.log('  - Mixed content detected; leaving transcript untouched so valid lines remain.');
  return { mixed: true };
}

async function cleanupLesson(basePath, lessonId, learner) {
  console.log(` Processing lesson ${lessonId}`);
  const stats = await cleanupLedger({ basePath, lessonId, learner });

  if (stats.removed) {
    console.log(`   ✓ Removed ${stats.removedFiles ?? stats.removed} files${stats.dryRun ? ' (dry run)' : ''}`);
    return;
  }
  if (stats.mixed) {
    console.log('   ↺ Skipped because ledger still has valid lines.');
  }

  // Clean per-session ledgers under sessions/<sessionId>
  const sessions = await listAll(`${basePath}/sessions`);
  for (const ses of sessions) {
    if (!ses?.name) continue;
    const sessionBase = `${basePath}/sessions/${ses.name}`;
    console.log(`   ↳ Session ${ses.name}`);
    const sessionStats = await cleanupLedger({ basePath: sessionBase, lessonId: `${lessonId} — ${ses.name}`, learner });
    if (sessionStats.removed) {
      console.log(`     ✓ Removed ${sessionStats.removedFiles ?? sessionStats.removed} session files${sessionStats.dryRun ? ' (dry run)' : ''}`);
    } else if (sessionStats.rewritten) {
      console.log(`     ✓ ${sessionStats.dryRun ? 'Would rewrite session transcript (dry run)' : 'Rewrote session transcript'}`);
    }
  }
}

async function cleanupLearner(learner) {
  console.log(`\n=== Cleaning transcripts for ${learner.name} (${learner.id}) ===`);

  const ownerCandidates = [learner.facilitator_id, learner.owner_id, learner.user_id]
    .filter((id) => typeof id === 'string' && id.length > 0);

  const ownerIds = ownerCandidates.length ? Array.from(new Set(ownerCandidates)) : await findOwnerIdsFromStorage(learner.id);

  if (!ownerIds.length) {
    console.log('  ⚠️  No owner folders found. Skipping.');
    return;
  }

  for (const ownerId of ownerIds) {
    const base = `v1/${ownerId}/${learner.id}`;
    console.log(` Owner ${ownerId}`);
    const lessons = await listAll(base);
    if (!lessons.length) {
      console.log('  (no transcript folders)');
      continue;
    }
    for (const entry of lessons) {
      if (!entry?.name) continue;
      if (entry.name.includes('.')) continue; // skip files at this level
      const lessonBase = `${base}/${entry.name}`;
      await cleanupLesson(lessonBase, entry.name, learner);
    }
  }
}

async function findOwnerIdsFromStorage(learnerId) {
  const ownerIds = new Set();
  const owners = await listAll('v1');
  for (const owner of owners) {
    if (!owner?.name) continue;
    const path = `v1/${owner.name}/${learnerId}`;
    const { data, error } = await store.list(path, { limit: 1 });
    if (!error && data && data.length) {
      ownerIds.add(owner.name);
    }
  }
  return Array.from(ownerIds);
}

async function main() {
  try {
    const learners = await fetchLearners();
    if (!learners.length) {
      console.log('No learners matched the provided filter.');
      return;
    }

    for (const learner of learners) {
      await cleanupLearner(learner);
    }

    console.log('\nDone.');
    if (dryRun) {
      console.log('Dry run mode: no changes were written.');
    }
  } catch (err) {
    console.error('Unhandled error:', err); 
    process.exit(1);
  }
}

main();
