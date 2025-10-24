// Test conversation-drafts API
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function getAuthToken() {
  // Try to sign in (you'll need to provide test credentials)
  console.log('🔐 Need to authenticate...')
  console.log('Please provide test account email and password')
  process.exit(1)
}

async function testDraftCreation(token) {
  console.log('\n📝 Testing draft creation...')
  
  const testTurns = [
    { role: 'user', content: 'I need help planning curriculum for my 5th grader' },
    { role: 'assistant', content: 'I would be happy to help you plan curriculum for your 5th grader. What subjects are you most concerned about?' }
  ]
  
  try {
    const response = await fetch(`${BASE_URL}/api/conversation-drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        learner_id: null,
        conversation_turns: testTurns
      })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.log(`❌ POST failed: ${response.status}`)
      console.log('Response:', JSON.stringify(data, null, 2))
      return false
    }
    
    console.log('✅ POST succeeded')
    console.log('Draft:', {
      id: data.draft?.id,
      turn_count: data.draft?.turn_count,
      summary_length: data.draft?.draft_summary?.length || 0,
      summary_preview: data.draft?.draft_summary?.substring(0, 100) + '...'
    })
    
    return data.draft?.id
    
  } catch (err) {
    console.error('❌ Request failed:', err.message)
    return false
  }
}

async function testDraftRetrieval(token) {
  console.log('\n📖 Testing draft retrieval...')
  
  try {
    const response = await fetch(`${BASE_URL}/api/conversation-drafts?learner_id=`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.log(`❌ GET failed: ${response.status}`)
      console.log('Response:', JSON.stringify(data, null, 2))
      return false
    }
    
    console.log('✅ GET succeeded')
    if (data.draft) {
      console.log('Draft found:', {
        id: data.draft.id,
        turn_count: data.draft.turn_count,
        summary_preview: data.draft.draft_summary?.substring(0, 100) + '...'
      })
    } else {
      console.log('No draft found (empty state)')
    }
    
    return true
    
  } catch (err) {
    console.error('❌ Request failed:', err.message)
    return false
  }
}

async function testDraftDeletion(token) {
  console.log('\n🗑️  Testing draft deletion...')
  
  try {
    const response = await fetch(`${BASE_URL}/api/conversation-drafts?learner_id=`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.log(`❌ DELETE failed: ${response.status}`)
      console.log('Response:', JSON.stringify(data, null, 2))
      return false
    }
    
    console.log('✅ DELETE succeeded')
    return true
    
  } catch (err) {
    console.error('❌ Request failed:', err.message)
    return false
  }
}

console.log('🧪 Conversation Drafts API Test')
console.log('================================\n')
console.log('⚠️  This test requires authentication')
console.log('You need to manually get a token from the browser:')
console.log('1. Open Mr. Mentor in browser')
console.log('2. Open DevTools console')
console.log('3. Run: localStorage.getItem("sb-fyfepvozqxgldgfpznrr-auth-token")')
console.log('4. Copy the token and set TOKEN environment variable')
console.log('\nExample:')
console.log('$env:TOKEN="your-token-here"; node scripts/test-conversation-drafts-api.mjs')

if (process.env.TOKEN) {
  const token = process.env.TOKEN
  
  ;(async () => {
    await testDraftRetrieval(token)
    const draftId = await testDraftCreation(token)
    if (draftId) {
      await testDraftRetrieval(token)
      await testDraftDeletion(token)
      await testDraftRetrieval(token)
    }
    
    console.log('\n✅ Tests complete')
  })()
} else {
  console.log('\n❌ TOKEN environment variable not set')
  process.exit(1)
}
