/**
 * Test authenticated write to transcripts bucket (simulates what the browser does).
 * Uses the magic link token to get a real access token for an actual user.
 * Run: node scripts/_diag_auth_write.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const URL  = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC  = env.SUPABASE_SERVICE_ROLE_KEY;

const svc = createClient(URL, SVC, { auth: { persistSession: false } });

// Generate a one-time link for the test user to get an access token
const testEmail = 'athellajade@gmail.com';
const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
  type: 'magiclink',
  email: testEmail,
});
if (linkErr) { console.error('Could not generate link:', linkErr.message); process.exit(1); }

// Extract hashed_token and use it to exchange for a session
const hashedToken = linkData?.properties?.hashed_token;
const actionLink = linkData?.properties?.action_link;
console.log('Magic link generated for', testEmail);
console.log('Action link type:', linkData?.properties?.email_action_type);

// Verify OTP using the hashed token
const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: verifyData, error: verifyErr } = await anonClient.auth.verifyOtp({
  email: testEmail,
  token: hashedToken,
  type: 'email',
});

if (verifyErr) {
  console.error('Could not verify OTP:', verifyErr.message);
  console.log('');
  console.log('Manual test alternative:');
  console.log('1. Sign in to Ms. Sonoma app in browser');
  console.log('2. Open DevTools Console');
  console.log('3. Run:');
  console.log('   const sb = (await import("/src/app/lib/supabaseClient.js")).getSupabaseClient()');
  console.log('   const s = await sb.auth.getSession()');
  console.log('   console.log("ownerId:", s.data.session?.user?.id)');
  console.log('   const r = await sb.storage.from("transcripts").upload("v1/"+s.data.session.user.id+"/test/_diag/t.txt", new Blob(["test"]), {upsert:true})');
  console.log('   console.log("write result:", r.error ? "FAILED: "+r.error.message : "SUCCESS")');
  process.exit(0);
}

const accessToken = verifyData?.session?.access_token;
const ownerId = verifyData?.user?.id;
console.log('Got access token for user:', ownerId);

// Now use the anon client with the real user JWT (exactly as the browser does)
const userClient = createClient(URL, ANON, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
});

const testPath = `v1/${ownerId}/test-learner-auth-diag/_diag/test.txt`;
console.log('\nTesting authenticated write (simulates browser) to:', testPath);
const blob = new Blob(['auth write test ' + Date.now()], { type: 'text/plain' });
const { error: writeErr } = await userClient.storage.from('transcripts').upload(testPath, blob, { upsert: true });

if (writeErr) {
  console.log('❌ AUTHENTICATED write FAILED:', writeErr.message);
  console.log('');
  console.log('This confirms the INSERT RLS policy is missing or misconfigured.');
  console.log('Fix: Run this SQL in Supabase Dashboard → SQL Editor:');
  console.log('  supabase/migrations/20260406000000_transcripts_storage_policies.sql');
} else {
  console.log('✅ AUTHENTICATED write SUCCEEDED!');
  console.log('Transcripts CAN be saved. The issue must be elsewhere (auth session, learner ID, etc.)');
  await svc.storage.from('transcripts').remove([testPath]);
  console.log('✅ Test file cleaned up');
}
