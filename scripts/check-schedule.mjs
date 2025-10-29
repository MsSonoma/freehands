import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkSchedule() {
  const { data, error } = await supabase
    .from('lesson_schedule')
    .select('*')
    .eq('learner_id', 'dc8adab1-495d-4f0d-9bfa-da82bd5e746a')
    .order('scheduled_date', { ascending: true })
    
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Scheduled lessons for Emma:')
  data.forEach(lesson => {
    console.log(`  ${lesson.scheduled_date}: ${lesson.lesson_key}`)
  })
}

checkSchedule()
