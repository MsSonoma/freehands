// Test script for Mr. Mentor Conversation Memory
// Run with: node scripts/test-conversation-memory.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function getAuthToken() {
  console.log('🔐 Getting auth token...')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.error('❌ No active session. Please log in first.')
    process.exit(1)
  }
  console.log('✅ Auth token obtained')
  return session.access_token
}

async function testCreateMemory(token) {
  console.log('\n📝 Test 1: Creating conversation memory...')
  
  const response = await fetch(`${BASE_URL}/api/conversation-memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      learner_id: null,
      conversation_turns: [
        { role: 'user', content: 'I need help planning my 5th grade math curriculum.' },
        { role: 'assistant', content: 'I can help with that! Let\'s start by identifying your child\'s current math level and learning style.' }
      ],
      force_regenerate: false
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error(`❌ Create memory failed: ${response.status}`, error)
    return false
  }
  
  const data = await response.json()
  console.log('✅ Memory created successfully')
  console.log(`   Turn count: ${data.conversation_update.turn_count}`)
  console.log(`   Summary preview: ${data.conversation_update.summary.substring(0, 100)}...`)
  return data.conversation_update.id
}

async function testRetrieveMemory(token) {
  console.log('\n📖 Test 2: Retrieving conversation memory...')
  
  const response = await fetch(`${BASE_URL}/api/conversation-memory`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error(`❌ Retrieve memory failed: ${response.status}`, error)
    return false
  }
  
  const data = await response.json()
  if (data.conversation_update) {
    console.log('✅ Memory retrieved successfully')
    console.log(`   Turn count: ${data.conversation_update.turn_count}`)
    console.log(`   Last updated: ${data.conversation_update.updated_at}`)
    return true
  } else {
    console.log('ℹ️  No memory found (this is ok for first run)')
    return true
  }
}

async function testUpdateMemory(token) {
  console.log('\n🔄 Test 3: Updating conversation memory (incremental)...')
  
  const response = await fetch(`${BASE_URL}/api/conversation-memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      learner_id: null,
      conversation_turns: [
        { role: 'user', content: 'What about fractions and decimals?' },
        { role: 'assistant', content: 'Great question! For 5th grade, fractions and decimals are crucial. Let\'s create a progression plan.' }
      ],
      force_regenerate: false
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error(`❌ Update memory failed: ${response.status}`, error)
    return false
  }
  
  const data = await response.json()
  console.log('✅ Memory updated successfully')
  console.log(`   Turn count: ${data.conversation_update.turn_count}`)
  console.log(`   Summary preview: ${data.conversation_update.summary.substring(0, 100)}...`)
  return true
}

async function testSearch(token) {
  console.log('\n🔍 Test 4: Searching conversation history...')
  
  const response = await fetch(`${BASE_URL}/api/conversation-memory?search=math&include_archive=false`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error(`❌ Search failed: ${response.status}`, error)
    return false
  }
  
  const data = await response.json()
  console.log(`✅ Search completed: ${data.count} result(s) found`)
  if (data.results && data.results.length > 0) {
    console.log(`   First result preview: ${data.results[0].summary.substring(0, 100)}...`)
  }
  return true
}

async function testMrMentorFunctionCalling(token) {
  console.log('\n🤖 Test 5: Mr. Mentor function calling (get_conversation_memory)...')
  
  const response = await fetch(`${BASE_URL}/api/counselor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message: 'What have we discussed before?',
      history: []
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error(`❌ Mr. Mentor request failed: ${response.status}`, error)
    return false
  }
  
  const data = await response.json()
  console.log('✅ Mr. Mentor responded successfully')
  console.log(`   Response preview: ${data.reply.substring(0, 150)}...`)
  console.log(`   Function calls: ${data.functionCalls ? data.functionCalls.map(fc => fc.name).join(', ') : 'none'}`)
  return true
}

async function testCleanup(token) {
  console.log('\n🗑️  Test 6: Cleanup (delete memory - should auto-archive)...')
  
  const response = await fetch(`${BASE_URL}/api/conversation-memory`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error(`❌ Cleanup failed: ${response.status}`, error)
    return false
  }
  
  const data = await response.json()
  console.log('✅ Memory cleared (and archived)')
  console.log(`   Message: ${data.message}`)
  return true
}

async function runTests() {
  console.log('🧪 Mr. Mentor Conversation Memory Test Suite\n')
  console.log('=' .repeat(60))
  
  try {
    const token = await getAuthToken()
    
    const results = {
      create: await testCreateMemory(token),
      retrieve: await testRetrieveMemory(token),
      update: await testUpdateMemory(token),
      search: await testSearch(token),
      mrMentor: await testMrMentorFunctionCalling(token),
      cleanup: await testCleanup(token)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 Test Results:')
    console.log(`   Create Memory: ${results.create ? '✅' : '❌'}`)
    console.log(`   Retrieve Memory: ${results.retrieve ? '✅' : '❌'}`)
    console.log(`   Update Memory: ${results.update ? '✅' : '❌'}`)
    console.log(`   Search: ${results.search ? '✅' : '❌'}`)
    console.log(`   Mr. Mentor Integration: ${results.mrMentor ? '✅' : '❌'}`)
    console.log(`   Cleanup: ${results.cleanup ? '✅' : '❌'}`)
    
    const passed = Object.values(results).filter(Boolean).length
    const total = Object.keys(results).length
    
    console.log(`\n${passed}/${total} tests passed`)
    
    if (passed === total) {
      console.log('\n🎉 All tests passed! Conversation memory system is working correctly.')
    } else {
      console.log('\n⚠️  Some tests failed. Check the errors above.')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  }
}

runTests()
