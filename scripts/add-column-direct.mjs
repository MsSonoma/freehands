// Direct SQL execution via Supabase REST API
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

console.log('🔧 Adding approved_lessons column via SQL...')
console.log(`📍 Project: ${projectRef}`)

const sql = `
ALTER TABLE public.learners 
ADD COLUMN IF NOT EXISTS approved_lessons JSONB;

UPDATE public.learners 
SET approved_lessons = '{}'::jsonb 
WHERE approved_lessons IS NULL;
`

try {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ query: sql })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ API Error:', error)
    console.log('\n⚠️  The REST API method didn\'t work.')
    console.log('\nPlease copy and paste this SQL into Supabase SQL Editor:')
    console.log('\n' + '='.repeat(70))
    console.log(sql)
    console.log('='.repeat(70))
    console.log('\nSteps:')
    console.log('  1. Go to https://supabase.com/dashboard/project/' + projectRef + '/sql')
    console.log('  2. Create a new query')
    console.log('  3. Paste the SQL above')
    console.log('  4. Click "Run"')
    process.exit(1)
  }

  const result = await response.json()
  console.log('✅ Column added successfully!')
  console.log('✅ Migration complete!')
  
} catch (error) {
  console.error('❌ Error:', error.message)
  console.log('\n⚠️  Unable to execute SQL automatically.')
  console.log('\nPlease copy and paste this SQL into Supabase SQL Editor:')
  console.log('\n' + '='.repeat(70))
  console.log(sql)
  console.log('='.repeat(70))
  console.log('\nSteps:')
  console.log('  1. Go to https://supabase.com/dashboard/project/' + projectRef + '/sql')
  console.log('  2. Create a new query')
  console.log('  3. Paste the SQL above')
  console.log('  4. Click "Run"')
  process.exit(1)
}
