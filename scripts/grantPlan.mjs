import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadDotEnvLocal(rootDir){
  const envPath = path.join(rootDir, '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq+1).trim()
    // Remove optional surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

async function main(){
  const root = path.resolve(__dirname, '..')
  loadDotEnvLocal(root)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(2)
  }

  const email = String(process.argv[2] || '').trim().toLowerCase()
  const plan = String(process.argv[3] || 'premium').trim().toLowerCase()
  if (!email) {
    console.error('Usage: node scripts/grantPlan.mjs <email> [plan]')
    process.exit(1)
  }
  if (!['free','basic','plus','premium'].includes(plan)) {
    console.error('Plan must be one of: free|basic|plus|premium')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Lookup user by email (admin API)
  let user = null
  try {
    if (typeof supabase.auth.admin.getUserByEmail === 'function') {
      const { data, error } = await supabase.auth.admin.getUserByEmail(email)
      if (!error && data?.user) user = data.user
    }
  } catch {}
  if (!user) {
    let page = 1
    const perPage = 1000
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) {
        console.error('Failed to list users:', error.message || error)
        process.exit(1)
      }
      const found = (data?.users || []).find(u => (u.email || '').toLowerCase() === email)
      if (found) { user = found; break }
      if (!data || (data.users || []).length < perPage) break
      page += 1
      if (page > 100) break
    }
  }
  if (!user) {
    console.error('User not found for email:', email)
    process.exit(1)
  }

  // Upsert profile plan_tier
  const { error: upErr } = await supabase.from('profiles').upsert({ id: user.id, plan_tier: plan }, { onConflict: 'id' })
  if (upErr) {
    console.error('Failed to set plan:', upErr.message || upErr)
    process.exit(1)
  }
  console.log('OK:', { user_id: user.id, email: user.email, plan })
}

main().catch(err => { console.error(err?.message || err); process.exit(1) })
