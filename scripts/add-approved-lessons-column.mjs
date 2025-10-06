// Script to add approved_lessons column to learners table
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables manually from .env.local
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
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addApprovedLessonsColumn() {
  console.log('🔧 Adding approved_lessons column to learners table...')
  
  try {
    // Add the column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.learners 
        ADD COLUMN IF NOT EXISTS approved_lessons JSONB;
      `
    })

    if (alterError) {
      // Try direct SQL query if RPC doesn't work
      const { error: directError } = await supabase
        .from('learners')
        .select('approved_lessons')
        .limit(1)
      
      if (directError && directError.message.includes('column "approved_lessons" does not exist')) {
        console.log('⚠️  Column does not exist yet. Please run this SQL in Supabase SQL Editor:')
        console.log('\n' + '='.repeat(60))
        console.log('ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS approved_lessons JSONB;')
        console.log('='.repeat(60) + '\n')
        process.exit(1)
      } else if (!directError) {
        console.log('✅ Column already exists!')
      } else {
        throw directError
      }
    } else {
      console.log('✅ Column added successfully!')
    }

    // Update existing rows to have empty object
    console.log('🔧 Setting default empty object for existing rows...')
    const { data: learners, error: fetchError } = await supabase
      .from('learners')
      .select('id, approved_lessons')

    if (fetchError) {
      console.error('❌ Error fetching learners:', fetchError.message)
      process.exit(1)
    }

    if (learners && learners.length > 0) {
      const updates = learners
        .filter(l => !l.approved_lessons)
        .map(l => l.id)

      if (updates.length > 0) {
        for (const id of updates) {
          await supabase
            .from('learners')
            .update({ approved_lessons: {} })
            .eq('id', id)
        }
        console.log(`✅ Updated ${updates.length} existing rows with empty approved_lessons object`)
      } else {
        console.log('ℹ️  All rows already have approved_lessons values')
      }
    } else {
      console.log('ℹ️  No existing learners found')
    }

    console.log('\n✅ Migration complete!')
    console.log('\nYou can now:')
    console.log('  1. Go to /facilitator/lessons')
    console.log('  2. Select a learner')
    console.log('  3. Check lessons to approve them')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.log('\nIf this fails, please run this SQL manually in Supabase SQL Editor:')
    console.log('\n' + '='.repeat(60))
    console.log('ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS approved_lessons JSONB;')
    console.log('UPDATE public.learners SET approved_lessons = \'{}\' WHERE approved_lessons IS NULL;')
    console.log('='.repeat(60) + '\n')
    process.exit(1)
  }
}

addApprovedLessonsColumn()
