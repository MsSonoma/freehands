#!/usr/bin/env node

/**
 * backfill-resend-audience.mjs
 *
 * Syncs all existing Supabase auth users into the Resend "Ms. Sonoma Email List"
 * audience, enriching each contact with their full_name from the profiles table.
 *
 * Safety:
 *   - Default is --dry-run. Pass --write to commit.
 *   - Resend upserts contacts by email, so it's safe to run multiple times.
 *
 * Usage:
 *   node scripts/backfill-resend-audience.mjs --dry-run
 *   node scripts/backfill-resend-audience.mjs --write
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const AUDIENCE_ID = '1743ddf7-62ae-4a05-99db-103d95da4daf'

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnvFiles() {
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(process.cwd(), filename)
    if (!fs.existsSync(fullPath)) continue
    for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const idx = t.indexOf('=')
      if (idx < 1) continue
      const k = t.slice(0, idx).trim()
      const v = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}

loadEnvFiles()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_KEY = process.env.RESEND_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!RESEND_KEY) {
  console.error('Missing RESEND_API_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const isDryRun = !args.includes('--write')
if (isDryRun) console.log('[dry-run] Pass --write to commit changes.\n')

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function getAllAuthUsers() {
  const users = []
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const batch = data?.users || []
    users.push(...batch)
    if (batch.length < perPage) break
    page++
  }
  return users
}

async function getProfileNames(userIds) {
  // Fetch full_name for all user ids in one query
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)
  if (error) {
    console.warn(`profiles lookup warning: ${error.message}`)
    return {}
  }
  return Object.fromEntries((data || []).map(p => [p.id, p.full_name || '']))
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

async function addContactToResend(email, firstName, lastName) {
  const res = await fetch(`https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      first_name: firstName || '',
      last_name: lastName || '',
      unsubscribed: false,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
  return await res.json()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let added = 0, skipped = 0, errors = 0

console.log('Fetching all auth users from Supabase...')
const users = await getAllAuthUsers()
console.log(`Found ${users.length} users.\n`)

const userIds = users.map(u => u.id)
console.log('Fetching full names from profiles...')
const nameMap = await getProfileNames(userIds)

for (const user of users) {
  const email = user.email
  if (!email) { skipped++; continue }

  const fullName = (nameMap[user.id] || user.user_metadata?.full_name || user.user_metadata?.name || '').trim()
  const parts = fullName.split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ') || ''

  if (isDryRun) {
    console.log(`  [dry] would add: ${email} (${fullName || 'no name'})`)
    added++
    continue
  }

  try {
    await addContactToResend(email, firstName, lastName)
    console.log(`  ✓ ${email}`)
    added++
  } catch (err) {
    console.error(`  ✗ ${email}: ${err.message}`)
    errors++
  }

  // Small delay to stay within Resend rate limits
  await new Promise(r => setTimeout(r, 50))
}

console.log(`\nDone. Added: ${added}, Skipped (no email): ${skipped}, Errors: ${errors}`)
if (isDryRun) console.log('\nRun with --write to commit.')
