import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return
    const raw = fs.readFileSync(filePath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = String(line || '').trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if (!key) continue
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  } catch {
    // ignore
  }
}

const repoRoot = process.cwd()
loadEnvFile(path.join(repoRoot, '.env.local'))
loadEnvFile(path.join(repoRoot, '.env'))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const learnerId = process.argv[2]
  if (!learnerId) {
    console.error('Usage: node scripts/check-planned.mjs <learnerId>')
    process.exit(1)
  }

  const { data, error } = await supabase
    .from('planned_lessons')
    .select('scheduled_date, facilitator_id, lesson_data')
    .eq('learner_id', learnerId)
    .order('scheduled_date', { ascending: true })

  if (error) {
    console.error('Error:', error)
    process.exit(2)
  }

  const rows = Array.isArray(data) ? data : []
  console.log(`Planned lessons for learner ${learnerId}: count=${rows.length}`)

  const byDate = new Map()
  for (const row of rows) {
    const d = row?.scheduled_date
    if (!d) continue
    const list = byDate.get(d) || []
    list.push(row)
    byDate.set(d, list)
  }

  for (const [date, list] of Array.from(byDate.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    console.log(`  ${date}: ${list.length}`)
    for (const item of list.slice(0, 3)) {
      const title = item?.lesson_data?.title || item?.lesson_data?.name || item?.lesson_data?.description || '(no title)'
      console.log(`    - ${String(title).slice(0, 120)}`)
    }
    if (list.length > 3) {
      console.log(`    ... +${list.length - 3} more`)
    }
  }
}

main()
