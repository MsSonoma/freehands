// Check if conversation_drafts table exists
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials')
  console.log('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkTable() {
  console.log('🔍 Checking for conversation_drafts table...\n')
  
  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('conversation_drafts')
      .select('id')
      .limit(1)
    
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('❌ Table "conversation_drafts" does NOT exist')
        console.log('\n📋 To fix this:')
        console.log('1. Open Supabase Dashboard → SQL Editor')
        console.log('2. Paste contents of: scripts/add-conversation-drafts-table.sql')
        console.log('3. Run the query')
        console.log('\nOr run this in SQL Editor:')
        console.log('---')
        console.log('SELECT * FROM information_schema.tables WHERE table_name = \'conversation_drafts\';')
        return false
      }
      
      console.log('⚠️  Table exists but query failed:', error.message)
      return false
    }
    
    console.log('✅ Table "conversation_drafts" exists!')
    console.log(`   Found ${data?.length || 0} draft(s)`)
    
    // Check RLS policies
    const { data: policies, error: policyError } = await supabase.rpc('get_policies', { 
      schema_name: 'public',
      table_name: 'conversation_drafts' 
    }).catch(() => ({ data: null, error: 'RPC not available' }))
    
    if (!policyError && policies) {
      console.log(`   RLS policies: ${policies.length}`)
    }
    
    return true
    
  } catch (err) {
    console.error('❌ Error checking table:', err.message)
    return false
  }
}

checkTable().then(exists => {
  process.exit(exists ? 0 : 1)
})
