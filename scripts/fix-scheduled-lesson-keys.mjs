// Script to fix incorrect lesson keys in the schedule database
// This will match scheduled lessons to actual lesson files and update the keys
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

// Get all lesson files from the filesystem
function getLessonFiles() {
  const lessonsDir = path.join(process.cwd(), 'public', 'lessons')
  const subjects = ['math', 'science', 'language arts', 'social studies', 'general']
  const allFiles = {}

  for (const subject of subjects) {
    const subjectDir = subject === 'general' 
      ? path.join(lessonsDir, 'Facilitator Lessons')
      : path.join(lessonsDir, subject)
    
    if (!fs.existsSync(subjectDir)) continue
    
    const files = fs.readdirSync(subjectDir).filter(f => f.endsWith('.json'))
    allFiles[subject] = files
  }

  return allFiles
}

// Try to match a partial lesson key to an actual file
function findMatchingFile(lessonKey, allFiles) {
  const [subject, partial] = lessonKey.split('/')
  if (!subject || !partial) return null

  const files = allFiles[subject] || []
  const partialLower = partial.toLowerCase().replace('.json', '')

  // Try exact match first
  const exactMatch = files.find(f => f.toLowerCase() === partial.toLowerCase() || 
                                     f.toLowerCase() === `${partial.toLowerCase()}.json`)
  if (exactMatch) return `${subject}/${exactMatch}`

  // Try contains match
  const containsMatch = files.find(f => {
    const fLower = f.toLowerCase().replace('.json', '')
    return fLower.includes(partialLower) || partialLower.includes(fLower)
  })
  
  if (containsMatch) {
    console.log(`  📍 Fuzzy match: "${partial}" → "${containsMatch}"`)
    return `${subject}/${containsMatch}`
  }

  return null
}

console.log('🔍 Scanning for lesson files...\n')
const allFiles = getLessonFiles()

console.log('Found lesson files:')
for (const [subject, files] of Object.entries(allFiles)) {
  console.log(`  ${subject}: ${files.length} files`)
}

console.log('\n📅 Checking scheduled lessons...\n')

// Get all scheduled lessons
const { data: scheduled, error } = await supabase
  .from('lesson_schedule')
  .select('*')
  .order('scheduled_date', { ascending: true })

if (error) {
  console.error('❌ Error fetching schedule:', error.message)
  process.exit(1)
}

console.log(`Found ${scheduled.length} scheduled lessons\n`)

const fixes = []
const orphans = []

for (const item of scheduled) {
  const { id, lesson_key, scheduled_date } = item
  
  // Check if lesson key ends with .json
  if (!lesson_key.endsWith('.json')) {
    const match = findMatchingFile(lesson_key, allFiles)
    
    if (match) {
      console.log(`❌ Incorrect key: ${lesson_key}`)
      console.log(`✅ Should be:     ${match}`)
      console.log(`   Date: ${scheduled_date}\n`)
      
      fixes.push({ id, old_key: lesson_key, new_key: match })
    } else {
      console.log(`🚨 No match found for: ${lesson_key}`)
      console.log(`   Date: ${scheduled_date}`)
      console.log(`   ID: ${id}\n`)
      
      orphans.push({ id, lesson_key, scheduled_date })
    }
  }
}

if (fixes.length === 0 && orphans.length === 0) {
  console.log('✅ All scheduled lessons have correct keys!')
  process.exit(0)
}

console.log(`\n📊 Summary:`)
console.log(`   ${fixes.length} lessons need fixing`)
console.log(`   ${orphans.length} orphaned lessons (no matching file found)`)

if (orphans.length > 0) {
  console.log('\n🚨 Orphaned lessons (consider deleting these):')
  for (const orphan of orphans) {
    console.log(`   - ${orphan.lesson_key} (${orphan.scheduled_date})`)
  }
}

if (fixes.length > 0) {
  console.log('\n🔧 Applying fixes automatically...\n')
  
  for (const fix of fixes) {
    const { error: updateError } = await supabase
      .from('lesson_schedule')
      .update({ lesson_key: fix.new_key })
      .eq('id', fix.id)
    
    if (updateError) {
      console.error(`   ❌ Failed to update ${fix.id}:`, updateError.message)
    } else {
      console.log(`   ✅ Updated: ${fix.old_key} → ${fix.new_key}`)
    }
  }
  
  console.log('\n✅ Done!')
}

process.exit(0)
