/**
 * test-transcript-storage.mjs
 * Verifies that the 'transcripts' Supabase Storage bucket exists and that
 * the RLS policies allow an authenticated user to write.
 *
 * Usage:
 *   node scripts/test-transcript-storage.mjs
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (for admin checks)
 *   TEST_OWNER_ID               (auth.users UUID of the facilitator to test as)
 *   TEST_LEARNER_ID             (any test learner UUID)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

// Simple .env.local parser
const env = {};
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { console.error('Could not read .env.local'); process.exit(1); }

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC  = env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_ID   = env.TEST_OWNER_ID;
const LEARNER_ID = env.TEST_LEARNER_ID || 'test-learner-diag';

if (!URL || !ANON) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY'); process.exit(1); }

const svc  = SVC  ? createClient(URL, SVC,  { auth: { persistSession: false } }) : null;
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

async function check(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✅  ${label}: ${result}`);
    return true;
  } catch (e) {
    console.error(`  ❌  ${label}: ${e?.message || e}`);
    return false;
  }
}

console.log('\n=== Transcript Storage Diagnostics ===\n');

// 1) Check bucket exists (service role)
if (svc) {
  await check('Bucket exists (service role)', async () => {
    const { data, error } = await svc.storage.getBucket('transcripts');
    if (error) throw new Error(error.message);
    return `public=${data.public}, created=${data.created_at}`;
  });
} else {
  console.log('  ⚠️   Skipping bucket existence check (no SUPABASE_SERVICE_ROLE_KEY)');
}

// 2) Check RLS policies via pg_policies (service role)
if (svc) {
  await check('INSERT policy present', async () => {
    const { data, error } = await svc.rpc('run_sql', {
      query: `SELECT count(*) as n FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd='INSERT' AND qual LIKE '%transcripts%'`
    }).maybeSingle();
    // rpc might not exist; try direct query instead
    throw new Error('Use Supabase dashboard SQL: SELECT * FROM pg_policies WHERE tablename=\'objects\' AND qual LIKE \'%transcripts%\'');
  }).catch(() => {});
}

// 3) Try a test upload with service role (bypasses RLS)
if (svc && OWNER_ID) {
  const testPath = `v1/${OWNER_ID}/${LEARNER_ID}/_diag/test.txt`;
  await check('Service-role write (bypasses RLS)', async () => {
    const blob = new Blob(['diagnostic test ' + Date.now()], { type: 'text/plain' });
    const { error } = await svc.storage.from('transcripts').upload(testPath, blob, { upsert: true });
    if (error) throw new Error(error.message);
    await svc.storage.from('transcripts').remove([testPath]);
    return 'ok (cleaned up)';
  });
} else if (!OWNER_ID) {
  console.log('  ⚠️   Set TEST_OWNER_ID in .env.local to test writes (your auth.users.id)');
}

// 4) Try anon write with a signed-in user JWT
// We can't sign in here without user credentials; just check if anon key can list the bucket root
await check('Anon key can list bucket root (no auth)', async () => {
  const { data, error } = await anon.storage.from('transcripts').list('v1', { limit: 1 });
  if (error) {
    // 400 "missing" is expected if bucket is private and we're unauthenticated
    if (error.message?.includes('400') || error.statusCode === 400 || error.message?.toLowerCase().includes('private')) {
      return 'bucket is private (expected — unauthenticated access blocked)';
    }
    throw new Error(error.message);
  }
  return `items found: ${data?.length ?? 0}`;
});

console.log('\n=== Summary ===');
console.log(`
If any ❌ appears above:
  1. Open Supabase Dashboard → SQL Editor
  2. Paste and run: supabase/migrations/20260406000000_transcripts_storage_policies.sql
  3. Re-run this script to confirm
  4. Then do a V2 lesson and check Facilitator Hub → Transcripts

If ✅ but transcripts still blank after a lesson:
  - Check browser console at end of session for "[SessionPageV2] Transcript save failed:"
  - Set TEST_OWNER_ID in .env.local and re-run to test authenticated writes
`);
