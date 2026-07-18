import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// List users
const { data, error } = await svc.auth.admin.listUsers({ perPage: 10 });
if (error) { console.log('Error:', error.message); process.exit(1); }
console.log('\nAuth users:');
for (const u of data.users) console.log(' ', u.id, u.email);

// Now test a write using the first user's ID as ownerId
const ownerId = data.users[0]?.id;
if (ownerId) {
  const testPath = `v1/${ownerId}/test-learner/_diag/test.txt`;
  console.log('\nTesting write as ownerId:', ownerId);
  console.log('Path:', testPath);
  const blob = new Blob(['diag ' + Date.now()], { type: 'text/plain' });
  const { error: writeErr } = await svc.storage.from('transcripts').upload(testPath, blob, { upsert: true });
  if (writeErr) {
    console.log('❌ Service-role write FAILED:', writeErr.message);
  } else {
    console.log('✅ Service-role write OK');
    await svc.storage.from('transcripts').remove([testPath]);
    console.log('✅ Cleanup OK');
  }

  // Now test RLS: can authenticated user write to their own path?
  // Create a signed JWT for this user via service role
  const { data: jwtData, error: jwtErr } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email: data.users[0].email,
  });
  if (jwtErr) {
    console.log('\nCould not generate test JWT:', jwtErr.message);
  } else {
    console.log('\nTo test RLS: check if authenticated user can write via anon client + Bearer token');
    console.log('This requires a real browser session. Bucket + policies check is sufficient.');
  }

  // Check policies via SQL
  console.log('\nChecking RLS policies via SQL...');
  const { data: policies, error: polErr } = await svc
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('tablename', 'objects')
    .ilike('qual', '%transcripts%');
  if (polErr) {
    console.log('Could not query pg_policies directly (expected). Run this SQL in Supabase dashboard:');
    console.log("SELECT policyname, cmd FROM pg_policies WHERE tablename='objects' AND qual LIKE '%transcripts%';");
  } else {
    console.log('Policies:', policies);
  }
}
