// Add goals_notes column to learners and profiles tables
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addGoalsNotesColumn() {
  try {
    console.log('Adding goals_notes column to learners table...')
    const { error: learnersError } = await supabase.rpc('exec_sql', {
      sql_string: `
        ALTER TABLE learners 
        ADD COLUMN IF NOT EXISTS goals_notes TEXT;
        
        CREATE INDEX IF NOT EXISTS idx_learners_goals_notes 
        ON learners(id) WHERE goals_notes IS NOT NULL;
      `
    })
    
    if (learnersError) {
      console.error('Error adding to learners:', learnersError)
    } else {
      console.log('✓ Added goals_notes to learners table')
    }

    console.log('Adding goals_notes column to profiles table...')
    const { error: profilesError } = await supabase.rpc('exec_sql', {
      sql_string: `
        ALTER TABLE profiles 
        ADD COLUMN IF NOT EXISTS goals_notes TEXT;
        
        CREATE INDEX IF NOT EXISTS idx_profiles_goals_notes 
        ON profiles(id) WHERE goals_notes IS NOT NULL;
      `
    })
    
    if (profilesError) {
      console.error('Error adding to profiles:', profilesError)
    } else {
      console.log('✓ Added goals_notes to profiles table')
    }

    console.log('Done!')
  } catch (err) {
    console.error('Failed:', err)
    process.exit(1)
  }
}

addGoalsNotesColumn()
