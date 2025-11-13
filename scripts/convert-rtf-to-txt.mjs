#!/usr/bin/env node

/**
 * Convert specific RTF transcripts to TXT by re-exporting ledger content.
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
  const candidates = [join(rootDir, '.env.local'), join(rootDir, '.env')];
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
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const store = supabase.storage.from('transcripts');

const OWNER_ID = 'd246d4b7-3623-49eb-a79f-96f23d44c93f';
const LEARNER_ID = 'dc8adab1-495d-4f0d-9bfa-da82bd5e746a';
const LEARNER_NAME = 'Emma';

const LESSONS_TO_CONVERT = [
  'fraction-equivalence-comparison-intermediate',
  'government-citizenship-basics-beginner',
  'magic_treehouse_11_lions_at_lunchtime',
  'weather-climate-patterns-advanced',
];

function renderTranscriptText({ lessonTitle, learnerName, learnerId, lessonId, segments }) {
  const lines = [];
  lines.push(`${lessonTitle || lessonId} — Transcript`);
  lines.push(`Learner: ${learnerName || learnerId}`);
  lines.push(`Lesson ID: ${lessonId}`);
  lines.push('');

  segments.forEach((seg, idx) => {
    const start = seg.startedAt ? new Date(seg.startedAt).toLocaleString() : 'Unknown';
    const end = seg.completedAt ? new Date(seg.completedAt).toLocaleString() : 'Unknown';
    lines.push(`Session ${idx + 1} — ${start} to ${end}`);
    lines.push('');
    (seg.lines || []).forEach((ln) => {
      const role = ln.role === 'user' ? 'Child' : 'Ms. Sonoma';
      lines.push(`${role}: ${ln.text || ''}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

async function convertLesson(lessonId) {
  const basePath = `v1/${OWNER_ID}/${LEARNER_ID}/${lessonId}`;
  const ledgerPath = `${basePath}/ledger.json`;
  const rtfPath = `${basePath}/transcript.rtf`;
  const txtPath = `${basePath}/transcript.txt`;

  console.log(`Processing ${lessonId}...`);

  // Check if ledger exists
  const { data: ledgerFile, error: ledgerError } = await store.download(ledgerPath);
  
  if (ledgerError) {
    // No ledger—just remove orphaned RTF
    console.log(`  ⚠️  No ledger found, removing orphaned RTF if present`);
    const { error: removeError } = await store.remove([rtfPath]);
    if (removeError && removeError.status !== 404) {
      console.warn(`  ⚠️  Failed to remove RTF: ${removeError.message}`);
    } else {
      console.log(`  ✓ Removed orphaned RTF`);
    }
    return;
  }

  const ledgerText = await ledgerFile.text();
  const ledger = JSON.parse(ledgerText);

  if (!Array.isArray(ledger) || ledger.length === 0) {
    console.log(`  ⚠️  Empty ledger, removing RTF`);
    await store.remove([rtfPath]);
    return;
  }

  // Render TXT
  const txt = renderTranscriptText({
    lessonTitle: lessonId,
    learnerName: LEARNER_NAME,
    learnerId: LEARNER_ID,
    lessonId,
    segments: ledger,
  });

  const txtBlob = new Blob([txt], { type: 'text/plain' });

  // Upload TXT
  const { error: txtError } = await store.upload(txtPath, txtBlob, {
    upsert: true,
    contentType: 'text/plain; charset=utf-8',
  });

  if (txtError) {
    console.error(`  ✗ Failed to upload TXT: ${txtError.message}`);
    return;
  }

  console.log(`  ✓ Uploaded ${txtPath}`);

  // Remove RTF
  const { error: removeError } = await store.remove([rtfPath]);
  if (removeError) {
    console.warn(`  ⚠️  Failed to remove RTF: ${removeError.message}`);
  } else {
    console.log(`  ✓ Removed ${rtfPath}`);
  }
}

async function main() {
  console.log(`\n=== Converting RTF transcripts to TXT for Emma ===\n`);

  for (const lessonId of LESSONS_TO_CONVERT) {
    await convertLesson(lessonId);
  }

  console.log('\nDone.');
}

main();
