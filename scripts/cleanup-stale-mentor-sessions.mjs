// Deactivate stale mentor_sessions rows to prevent stuck takeovers
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials')
  console.log('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const defaultTimeout = Math.max(
  1,
  Number.parseInt(process.env.MENTOR_SESSION_TIMEOUT_MINUTES ?? '15', 10)
)

const cliMinutesArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--minutes='))

const overrideMinutes = cliMinutesArg
  ? Number.parseInt(cliMinutesArg.split('=')[1], 10)
  : NaN

const timeoutMinutes = Number.isFinite(overrideMinutes) && overrideMinutes > 0
  ? overrideMinutes
  : defaultTimeout

const timeoutMs = timeoutMinutes * 60 * 1000

function getActivityTimestamp(session) {
  const iso = session.last_activity_at || session.created_at
  if (!iso) return 0
  const ts = new Date(iso).getTime()
  return Number.isFinite(ts) ? ts : 0
}

async function run() {
  console.log(`Checking for mentor sessions idle for > ${timeoutMinutes} minute(s)...`)

  const { data: activeSessions, error } = await supabase
    .from('mentor_sessions')
    .select('id, facilitator_id, session_id, last_activity_at, created_at')
    .eq('is_active', true)

  if (error) {
  console.error('Failed to fetch active sessions:', error.message)
    process.exit(1)
  }

  const nowMs = Date.now()
  const staleSessions = (activeSessions || []).filter((session) => {
    const lastActivity = getActivityTimestamp(session)
    return lastActivity > 0 && nowMs - lastActivity > timeoutMs
  })

  if (staleSessions.length === 0) {
  console.log('No stale sessions found.')
    process.exit(0)
  }

  const ids = staleSessions.map((session) => session.id)
  const { error: deactivateError } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false })
    .in('id', ids)

  if (deactivateError) {
  console.error('Failed to deactivate stale sessions:', deactivateError.message)
    process.exit(1)
  }

  staleSessions.forEach((session) => {
    console.log(
      `Deactivated session ${session.session_id} for facilitator ${session.facilitator_id}`
    )
  })

  console.log(`Cleared ${staleSessions.length} stale session(s).`)
  process.exit(0)
}

run().catch((err) => {
  console.error('Unexpected error while cleaning mentor sessions:', err)
  process.exit(1)
})
