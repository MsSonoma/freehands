import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadDotEnvLocal(rootDir) {
  const envPath = path.join(rootDir, '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

async function getUserByEmail(admin, email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  // Prefer getUserByEmail when supported
  if (typeof admin.getUserByEmail === 'function') {
    const { data, error } = await admin.getUserByEmail(normalizedEmail)
    if (error && !/not.*found/i.test(error.message || '')) {
      throw new Error(error.message || 'Failed to lookup user')
    }
    return data?.user || null
  }

  // Fallback: listUsers
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message || 'Failed to list users')
    const found = (data?.users || []).find((u) => (u.email || '').toLowerCase() === normalizedEmail)
    if (found) return found
    if (!data || (data.users || []).length < perPage) break
    page += 1
    if (page > 100) break
  }
  return null
}

async function main() {
  const root = path.resolve(__dirname, '..')
  loadDotEnvLocal(root)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(2)
  }

  const emailArg = process.argv[2]
  const arg3 = process.argv[3]
  const arg4 = process.argv[4]

  const email = normalizeEmail(emailArg)

  // Supported invocations:
  // 1) node scripts/createPremiumUser.mjs <email> <password> [plan]
  // 2) $env:CREATE_PREMIUM_USER_PASSWORD=...; node scripts/createPremiumUser.mjs <email> [plan]
  //    (in this mode, argv[3] is treated as plan if it matches a known plan)
  const knownPlans = new Set(['free', 'trial', 'standard', 'pro', 'lifetime'])
  const arg3Lower = String(arg3 || '').trim().toLowerCase()

  const plan = String((arg4 || (knownPlans.has(arg3Lower) ? arg3Lower : 'pro')) || 'pro')
    .trim()
    .toLowerCase()

  const password = String(
    // If argv[3] is a plan name and argv[4] is empty, treat password as env-provided.
    (!arg4 && knownPlans.has(arg3Lower))
      ? (process.env.CREATE_PREMIUM_USER_PASSWORD || '')
      : (arg3 || process.env.CREATE_PREMIUM_USER_PASSWORD || '')
  )

  if (!email || !password) {
    console.error('Usage: node scripts/createPremiumUser.mjs <email> <password> [plan]')
    console.error('   or: set CREATE_PREMIUM_USER_PASSWORD then run: node scripts/createPremiumUser.mjs <email> [plan]')
    console.error('Example: node scripts/createPremiumUser.mjs george@mdisecurity.net "..." pro')
    process.exit(1)
  }
  if (!['free', 'trial', 'standard', 'pro', 'lifetime'].includes(plan)) {
    console.error('Plan must be one of: free|trial|standard|pro|lifetime')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const admin = supabase.auth.admin

  let user = await getUserByEmail(admin, email)

  if (!user) {
    const { data, error } = await admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) {
      console.error('Failed to create user:', error.message || error)
      process.exit(1)
    }
    user = data?.user || null
  } else {
    // Best effort: ensure confirmed + optionally set password
    if (typeof admin.updateUserById === 'function') {
      try {
        const { error } = await admin.updateUserById(user.id, { email_confirm: true, password })
        if (error) {
          // Non-fatal; continue to plan update
          console.warn('Warning: could not update user confirmation/password:', error.message || error)
        }
      } catch (e) {
        console.warn('Warning: could not update user confirmation/password:', e?.message || e)
      }
    }
  }

  if (!user?.id) {
    console.error('Unexpected: missing user id after create/lookup')
    process.exit(1)
  }

  // Grant plan (plan_tier drives entitlements)
  const { error: upErr } = await supabase
    .from('profiles')
    .upsert({ id: user.id, plan_tier: plan }, { onConflict: 'id' })

  if (upErr) {
    console.error('Failed to set plan_tier:', upErr.message || upErr)
    process.exit(1)
  }

  console.log('OK:', { user_id: user.id, email: user.email, plan_tier: plan })
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
