// Debug script to check scheduled lessons in the database
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

// Get today's date in local timezone
const now = new Date()
const year = now.getFullYear()
const month = String(now.getMonth() + 1).padStart(2, '0')
const day = String(now.getDate()).padStart(2, '0')
const localToday = `${year}-${month}-${day}`

// Get today's date in UTC
const utcToday = now.toISOString().split('T')[0]

// Get yesterday's date
const yesterday = new Date(now)
yesterday.setDate(yesterday.getDate() - 1)
const yesterdayStr = yesterday.toISOString().split('T')[0]

// Get tomorrow's date
const tomorrow = new Date(now)
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = tomorrow.toISOString().split('T')[0]

console.log('🕐 Date Information')
console.log('==================')
console.log('Local timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)
console.log('Local today:', localToday)
console.log('UTC today:', utcToday)
console.log('Yesterday:', yesterdayStr)
console.log('Tomorrow:', tomorrowStr)
console.log()

// Query all scheduled lessons
console.log('📅 All Scheduled Lessons')
console.log('========================')
const { data: allLessons, error: allError } = await supabase
  .from('lesson_schedule')
  .select('*')
  .order('scheduled_date', { ascending: true })

if (allError) {
  console.error('❌ Error querying all lessons:', allError.message)
} else if (!allLessons || allLessons.length === 0) {
  console.log('No scheduled lessons found in database')
} else {
  console.log(`Found ${allLessons.length} total scheduled lessons:\n`)
  allLessons.forEach(lesson => {
    const isToday = lesson.scheduled_date === localToday || lesson.scheduled_date === utcToday
    const isYesterday = lesson.scheduled_date === yesterdayStr
    const isTomorrow = lesson.scheduled_date === tomorrowStr
    
    let dateLabel = lesson.scheduled_date
    if (isToday) dateLabel += ' ← TODAY'
    else if (isYesterday) dateLabel += ' ← YESTERDAY'
    else if (isTomorrow) dateLabel += ' ← TOMORROW'
    
    console.log(`  Date: ${dateLabel}`)
    console.log(`  Learner ID: ${lesson.learner_id}`)
    console.log(`  Lesson: ${lesson.lesson_key}`)
    console.log(`  Created: ${lesson.created_at}`)
    console.log()
  })
}

// Query today's lessons specifically
console.log('\n🎯 Today\'s Scheduled Lessons (Local)')
console.log('====================================')
const { data: todayLocal, error: todayLocalError } = await supabase
  .from('lesson_schedule')
  .select('*')
  .eq('scheduled_date', localToday)

if (todayLocalError) {
  console.error('❌ Error querying today (local):', todayLocalError.message)
} else if (!todayLocal || todayLocal.length === 0) {
  console.log(`No lessons scheduled for ${localToday} (local)`)
} else {
  console.log(`Found ${todayLocal.length} lessons for ${localToday}:`)
  todayLocal.forEach(lesson => {
    console.log(`  - ${lesson.lesson_key} (learner: ${lesson.learner_id})`)
  })
}

// If local and UTC differ, also check UTC
if (localToday !== utcToday) {
  console.log('\n🎯 Today\'s Scheduled Lessons (UTC)')
  console.log('==================================')
  const { data: todayUtc, error: todayUtcError } = await supabase
    .from('lesson_schedule')
    .select('*')
    .eq('scheduled_date', utcToday)

  if (todayUtcError) {
    console.error('❌ Error querying today (UTC):', todayUtcError.message)
  } else if (!todayUtc || todayUtc.length === 0) {
    console.log(`No lessons scheduled for ${utcToday} (UTC)`)
  } else {
    console.log(`Found ${todayUtc.length} lessons for ${utcToday}:`)
    todayUtc.forEach(lesson => {
      console.log(`  - ${lesson.lesson_key} (learner: ${lesson.learner_id})`)
    })
  }
}

// Check learners table for approved_lessons
console.log('\n👥 Learner Approved Lessons')
console.log('===========================')
const { data: learners, error: learnersError } = await supabase
  .from('learners')
  .select('id, name, approved_lessons')

if (learnersError) {
  console.error('❌ Error querying learners:', learnersError.message)
} else if (!learners || learners.length === 0) {
  console.log('No learners found')
} else {
  learners.forEach(learner => {
    const approvedCount = learner.approved_lessons ? Object.keys(learner.approved_lessons).length : 0
    console.log(`\n${learner.name} (${learner.id}):`)
    console.log(`  Approved lessons: ${approvedCount}`)
    if (approvedCount > 0 && approvedCount <= 5) {
      Object.keys(learner.approved_lessons).forEach(key => {
        console.log(`    - ${key}`)
      })
    }
  })
}

console.log('\n✅ Debug complete')
