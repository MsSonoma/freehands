import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function migrateFacilitatorKeys() {
  console.log('Fetching learners with approved_lessons...\n')
  
  const { data: learners, error } = await supabase
    .from('learners')
    .select('id, name, approved_lessons')
    
  if (error) {
    console.error('Error fetching learners:', error)
    return
  }

  for (const learner of learners) {
    if (!learner.approved_lessons) continue
    
    let changed = false
    const newApproved = {}
    
    for (const [key, value] of Object.entries(learner.approved_lessons)) {
      if (key.startsWith('facilitator/')) {
        // Migrate to generated/ (these are user-generated lessons)
        const newKey = key.replace('facilitator/', 'generated/')
        newApproved[newKey] = value
        console.log(`  ${learner.name}: ${key} → ${newKey}`)
        changed = true
      } else if (key.startsWith('Facilitator Lessons/')) {
        // Migrate to general/
        const suffix = key.slice('Facilitator Lessons/'.length)
        const newKey = `general/${suffix}`
        newApproved[newKey] = value
        console.log(`  ${learner.name}: ${key} → ${newKey}`)
        changed = true
      } else {
        newApproved[key] = value
      }
    }
    
    if (changed) {
      console.log(`\nUpdating ${learner.name}...`)
      const { error: updateError } = await supabase
        .from('learners')
        .update({ approved_lessons: newApproved })
        .eq('id', learner.id)
        
      if (updateError) {
        console.error(`Error updating ${learner.name}:`, updateError)
      } else {
        console.log(`✅ ${learner.name} updated\n`)
      }
    }
  }
  
  console.log('\n✅ Migration complete')
}

migrateFacilitatorKeys()
