import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local manually
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Fetching learners with approved_lessons...\n');

const { data, error } = await supabase
  .from('learners')
  .select('id, name, approved_lessons')
  .order('name');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

data.forEach(learner => {
  console.log(`\n📚 ${learner.name} (${learner.id})`);
  console.log('Approved lessons:', JSON.stringify(learner.approved_lessons, null, 2));
  
  // Check for general lessons specifically
  const approvedKeys = Object.keys(learner.approved_lessons || {});
  const generalLessons = approvedKeys.filter(k => k.startsWith('general/'));
  const facilitatorLessons = approvedKeys.filter(k => k.startsWith('Facilitator Lessons/'));
  
  if (generalLessons.length > 0) {
    console.log(`  ✅ Has ${generalLessons.length} general/ lessons`);
  }
  if (facilitatorLessons.length > 0) {
    console.log(`  ⚠️  Has ${facilitatorLessons.length} Facilitator Lessons/ lessons (OLD FORMAT - needs migration)`);
  }
});

console.log('\n✅ Done');
