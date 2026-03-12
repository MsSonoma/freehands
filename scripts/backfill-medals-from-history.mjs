#!/usr/bin/env node

/**
 * backfill-medals-from-history.mjs
 *
 * For every lesson_session_events row with event_type='completed' that has no
 * corresponding learner_medals row, insert a medal at --percent (default 90).
 *
 * Why:
 *   The medal API used to soft-fail silently (return HTTP 200) even when the DB
 *   write failed, meaning many lessons recorded as "completed" in
 *   lesson_session_events have no entry in learner_medals.  The awards page and
 *   the lesson-library medal indicators both read from learner_medals, so they
 *   show nothing for those lessons.
 *
 * What it writes (when not dry-run):
 *   - learner_medals: upserts { user_id, learner_id, lesson_key, best_percent,
 *     medal_tier, updated_at } for each missing lesson.
 *   If the event metadata already contains a test_percentage it uses that;
 *   otherwise it falls back to --percent (default 90 = gold).
 *
 * Safety:
 *   - Default is --dry-run.  Pass --write to commit.
 *   - Existing medals are never downgraded; only missing ones are created.
 *   - Idempotent: safe to run multiple times.
 *
 * Usage:
 *   # Dry-run all learners:
 *   node scripts/backfill-medals-from-history.mjs --dry-run
 *
 *   # Dry-run a specific learner by name:
 *   node scripts/backfill-medals-from-history.mjs --dry-run --learner Emma
 *
 *   # Commit for a specific learner:
 *   node scripts/backfill-medals-from-history.mjs --write --learner Emma
 *
 *   # Commit all learners at 90%:
 *   node scripts/backfill-medals-from-history.mjs --write --percent 90
 *
 *   # Commit all learners at 100%:
 *   node scripts/backfill-medals-from-history.mjs --write --percent 100
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { normalizeLessonKey } from '../src/app/lib/lessonKeyNormalization.js'

// ---------------------------------------------------------------------------
// Env / Supabase
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

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local)')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// ---------------------------------------------------------------------------
// Public-lessons index (filename → subject/filename.json)
// Used to resolve bare lesson keys (no subject prefix) that V1 session tracking
// wrote into lesson_session_events.lesson_id.
// ---------------------------------------------------------------------------

let _lessonIndex = null // Map<bareNameNoExt, 'subject/filename.json'>

function buildLessonIndex() {
  if (_lessonIndex) return _lessonIndex
  _lessonIndex = new Map()
  try {
    const root = path.join(process.cwd(), 'public', 'lessons')
    if (!fs.existsSync(root)) return _lessonIndex
    for (const subjectDir of fs.readdirSync(root, { withFileTypes: true })) {
      if (!subjectDir.isDirectory()) continue
      const subject = subjectDir.name
      const subjectPath = path.join(root, subject)
      for (const entry of fs.readdirSync(subjectPath, { withFileTypes: true })) {
        if (!entry.isFile() || !/\.json$/i.test(entry.name)) continue
        const bareNoExt = entry.name.replace(/\.json$/i, '')
        const fullKey = normalizeLessonKey(`${subject}/${entry.name}`) || `${subject}/${entry.name}`
        // There can be name collisions across subjects; keep first match (deterministic)
        if (!_lessonIndex.has(bareNoExt)) {
          _lessonIndex.set(bareNoExt, fullKey)
        }
      }
    }
  } catch { /* ignore */ }
  return _lessonIndex
}

/**
 * Given a raw lesson_id from lesson_session_events, return the canonical
 * `subject/filename.json` key that learner_medals.lesson_key uses.
 */
function resolveToFullKey(raw, existingMedalKeys) {
  if (!raw) return null
  const normalized = normalizeLessonKey(raw) || raw

  // Already has a subject prefix → use as-is
  if (normalized.includes('/')) return normalized

  // Bare key (legacy V1): try to find it in the existing medals map first
  // (if it was ever written directly under the bare key format, keep that)
  if (existingMedalKeys && existingMedalKeys.has(normalized)) return normalized

  // Look it up in the public lessons index
  const withExt = normalized.replace(/\.json$/i, '') // ensure no ext before lookup
  const index = buildLessonIndex()
  if (index.has(withExt)) return index.get(withExt)

  // Try with .json
  const withJsonExt = `${withExt}.json`
  if (index.has(withJsonExt.replace(/\.json$/i, ''))) return index.get(withJsonExt.replace(/\.json$/i, ''))

  // Cannot resolve — return as-is (will store/match against whatever is there)
  console.log(`  WARN  cannot resolve bare key to subject path: ${normalized}`)
  return normalized
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_RANK = { none: 0, bronze: 1, silver: 2, gold: 3 }

function tierForPercent(p) {
  const n = Number(p)
  if (!Number.isFinite(n)) return null
  if (n >= 90) return 'gold'
  if (n >= 80) return 'silver'
  if (n >= 70) return 'bronze'
  return null
}

async function fetchAll(queryFactory, pageSize = 1000) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dryRun: true, learnerFilter: null, percent: 90 }
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--dry-run') { args.dryRun = true; continue }
    if (t === '--write')   { args.dryRun = false; continue }
    if (t === '--learner') { args.learnerFilter = String(argv[++i] || '').trim(); continue }
    if (t === '--percent') { args.percent = Number(argv[++i]); continue }
    throw new Error(`Unknown arg: ${t}`)
  }
  if (!Number.isFinite(args.percent) || args.percent < 70 || args.percent > 100) {
    throw new Error('--percent must be a number between 70 and 100')
  }
  return args
}

// ---------------------------------------------------------------------------
// Per-learner logic
// ---------------------------------------------------------------------------

async function processLearner(supabase, learner, { dryRun, defaultPercent }) {
  const learnerId = learner.id
  const userId = learner.facilitator_id || learner.owner_id || learner.user_id || null

  if (!userId) {
    console.log(`  SKIP ${learner.name} (${learnerId}): cannot resolve user_id / facilitator_id`)
    return { skipped: 0, backfilled: 0, alreadyHave: 0 }
  }

  // Fetch all completed events for this learner
  const completedEvents = await fetchAll(() =>
    supabase
      .from('lesson_session_events')
      .select('lesson_id, occurred_at, metadata')
      .eq('learner_id', learnerId)
      .eq('event_type', 'completed')
      .order('occurred_at', { ascending: true })
  )

  if (!completedEvents.length) {
    console.log(`  ${learner.name}: no completed events found`)
    return { skipped: 0, backfilled: 0, alreadyHave: 0 }
  }

  // Fetch all existing medals for this learner
  const existingMedals = await fetchAll(() =>
    supabase
      .from('learner_medals')
      .select('lesson_key, best_percent, medal_tier')
      .eq('learner_id', learnerId)
  )

  // Index existing medals by normalized lesson key
  const medalMap = new Map()
  const existingMedalKeys = new Set()
  for (const m of existingMedals) {
    const k = normalizeLessonKey(m.lesson_key) || m.lesson_key
    if (k) {
      medalMap.set(k, m)
      existingMedalKeys.add(k)
    }
  }

  // Build a set of distinct lessons from completed events, picking the best
  // available percent for each (event metadata > defaultPercent).
  const bestByKey = new Map() // resolvedKey => { lessonKey, percent }
  for (const ev of completedEvents) {
    const raw = ev.lesson_id
    if (!raw) continue
    const resolved = resolveToFullKey(raw, existingMedalKeys)
    if (!resolved) continue
    const metaPct = Number(ev.metadata?.test_percentage ?? ev.metadata?.percent ?? NaN)
    const pct = Number.isFinite(metaPct) && metaPct >= 0 ? metaPct : defaultPercent
    const prev = bestByKey.get(resolved)
    if (!prev || pct > prev.percent) {
      bestByKey.set(resolved, { lessonKey: resolved, percent: pct })
    }
  }

  let backfilled = 0
  let alreadyHave = 0
  let skipped = 0

  for (const [resolvedKey, { lessonKey, percent }] of bestByKey.entries()) {
    const existing = medalMap.get(resolvedKey)

    if (existing) {
      const existingPct = Number(existing.best_percent) || 0
      if (existingPct >= percent) {
        alreadyHave++
        continue
      }
      // Existing medal has a lower percent — we'll upgrade it
    }

    const tier = tierForPercent(percent)
    if (!tier) {
      console.log(`  SKIP ${lessonKey}: percent ${percent} < 70 (no tier)`)
      skipped++
      continue
    }

    if (dryRun) {
      const action = existing ? `UPGRADE ${existing.best_percent}% → ${percent}%` : `ADD ${percent}%`
      console.log(`  DRY-RUN  ${action}  ${lessonKey}  (${tier})`)
      backfilled++
      continue
    }

    // Upsert the medal — never downgrade an existing tier
    const currentTier = existing?.medal_tier || null
    const currentRank = TIER_RANK[currentTier || 'none'] || 0
    const newRank = TIER_RANK[tier || 'none'] || 0
    const nextTier = newRank > currentRank ? tier : currentTier
    const bestPercent = Math.max(Number(existing?.best_percent) || 0, percent)

    const { error } = await supabase
      .from('learner_medals')
      .upsert(
        {
          user_id: userId,
          learner_id: learnerId,
          lesson_key: lessonKey,
          best_percent: bestPercent,
          medal_tier: nextTier,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,learner_id,lesson_key' }
      )

    if (error) {
      console.error(`  ERROR  ${lessonKey}: ${error.message}`)
      skipped++
    } else {
      console.log(`  WROTE  ${lessonKey}  ${bestPercent}%  (${nextTier})`)
      backfilled++
    }
  }

  return { skipped, backfilled, alreadyHave }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvFiles()
  const { dryRun, learnerFilter, percent: defaultPercent } = parseArgs(process.argv)

  const supabase = getClient()

  console.log(`\n=== backfill-medals-from-history ===`)
  console.log(`Mode:          ${dryRun ? 'DRY-RUN (pass --write to commit)' : 'WRITE'}`)
  console.log(`Default pct:   ${defaultPercent}% (${tierForPercent(defaultPercent)})`)
  console.log(`Learner:       ${learnerFilter || '(all)'}`)
  console.log()

  // Fetch learners
  let learnersQuery = supabase
    .from('learners')
    .select('id, name, facilitator_id, owner_id, user_id')
    .order('name', { ascending: true })

  if (learnerFilter) {
    learnersQuery = learnersQuery.ilike('name', `%${learnerFilter}%`)
  }

  const { data: learners, error: learnersErr } = await learnersQuery
  if (learnersErr) throw new Error(learnersErr.message)
  if (!learners?.length) {
    console.log('No learners found.')
    return
  }

  let totalBackfilled = 0
  let totalAlreadyHave = 0
  let totalSkipped = 0

  for (const learner of learners) {
    console.log(`\n--- ${learner.name} (${learner.id}) ---`)
    const { backfilled, alreadyHave, skipped } = await processLearner(supabase, learner, { dryRun, defaultPercent })
    totalBackfilled += backfilled
    totalAlreadyHave += alreadyHave
    totalSkipped += skipped
  }

  console.log(`\n=== Summary ===`)
  console.log(`${dryRun ? 'Would backfill' : 'Backfilled'}:  ${totalBackfilled}`)
  console.log(`Already had:   ${totalAlreadyHave}`)
  console.log(`Skipped:       ${totalSkipped}`)
  if (dryRun) {
    console.log(`\nRe-run with --write to commit.`)
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err?.message || err)
  process.exit(1)
})
