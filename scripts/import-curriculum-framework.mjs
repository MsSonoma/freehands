import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

import { normalizeCurriculumFrameworkSnapshot } from '../src/app/lib/syllabus/curriculumFrameworkImport.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadDotEnvLocal(rootDir) {
  const envPath = path.join(rootDir, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1)
    if (!(key in process.env)) process.env[key] = value
  }
}

function usage() {
  console.error('Usage: node scripts/import-curriculum-framework.mjs <snapshot.json> [--apply]')
  console.error('Without --apply, the command validates and reports the import plan without writing.')
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

async function findGlobalFramework(admin, externalIdentifier) {
  const { data, error } = await admin.from('curriculum_frameworks')
    .select('*')
    .is('facilitator_id', null)
    .eq('external_identifier', externalIdentifier)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to inspect curriculum framework')
  return data || null
}

async function saveFramework(admin, normalized) {
  const existing = await findGlobalFramework(admin, normalized.framework.external_identifier)
  const row = {
    facilitator_id: null,
    ...normalized.framework,
    metadata: {
      ...(normalized.framework.metadata || {}),
      import_snapshot_sha256: normalized.snapshot_sha256,
      imported_at: new Date().toISOString(),
    },
  }

  if (existing) {
    const { data, error } = await admin.from('curriculum_frameworks')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message || 'Failed to update curriculum framework')
    return data
  }

  const { data, error } = await admin.from('curriculum_frameworks')
    .insert(row)
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to create curriculum framework')
  return data
}

async function syncItems(admin, frameworkId, items) {
  const { data: existing, error: readError } = await admin.from('curriculum_framework_items')
    .select('*')
    .eq('framework_id', frameworkId)
  if (readError) throw new Error(readError.message || 'Failed to inspect curriculum framework items')

  const byExternalId = new Map((existing || []).map((item) => [String(item.external_id || ''), item]))
  const saved = []

  for (const item of items) {
    const prior = byExternalId.get(item.external_id)
    const row = { framework_id: frameworkId, ...item }
    if (prior) {
      const { data, error } = await admin.from('curriculum_framework_items')
        .update(row)
        .eq('id', prior.id)
        .select('*')
        .single()
      if (error) throw new Error(error.message || `Failed to update curriculum item ${item.external_id}`)
      saved.push(data)
    } else {
      const { data, error } = await admin.from('curriculum_framework_items')
        .insert(row)
        .select('*')
        .single()
      if (error) throw new Error(error.message || `Failed to create curriculum item ${item.external_id}`)
      saved.push(data)
    }
  }

  return saved
}

async function syncAssociations(admin, frameworkId, items, associations) {
  const itemIdByExternal = new Map(items.map((item) => [String(item.external_id || ''), item.id]))
  const desired = associations.map((association) => ({
    framework_id: frameworkId,
    source_item_id: itemIdByExternal.get(association.source_external_id),
    target_item_id: itemIdByExternal.get(association.target_external_id),
    relationship: association.relationship,
    provenance_kind: association.provenance_kind,
    metadata: association.metadata || {},
  }))

  const { data: existing, error: readError } = await admin.from('curriculum_framework_associations')
    .select('*')
    .eq('framework_id', frameworkId)
  if (readError) throw new Error(readError.message || 'Failed to inspect curriculum framework associations')

  const identity = (row) => [
    row.source_item_id,
    row.target_item_id,
    row.relationship,
  ].join('|')
  const existingByIdentity = new Map((existing || []).map((row) => [identity(row), row]))

  for (const row of desired) {
    if (!row.source_item_id || !row.target_item_id) {
      throw new Error('Curriculum association references an item that was not persisted')
    }
    const prior = existingByIdentity.get(identity(row))
    if (prior) {
      const { error } = await admin.from('curriculum_framework_associations')
        .update({
          provenance_kind: row.provenance_kind,
          metadata: row.metadata,
        })
        .eq('id', prior.id)
      if (error) throw new Error(error.message || 'Failed to update curriculum framework association')
    } else {
      const { error } = await admin.from('curriculum_framework_associations').insert(row)
      if (error) throw new Error(error.message || 'Failed to create curriculum framework association')
    }
  }

  return desired.length
}

async function main() {
  const root = path.resolve(__dirname, '..')
  loadDotEnvLocal(root)

  const inputPath = String(process.argv[2] || '').trim()
  const apply = process.argv.includes('--apply')
  if (!inputPath || inputPath.startsWith('--')) {
    usage()
    process.exit(1)
  }

  const absolutePath = path.resolve(process.cwd(), inputPath)
  if (!fs.existsSync(absolutePath)) fail(`Snapshot not found: ${absolutePath}`)

  let raw
  try {
    raw = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    fail(`Snapshot is not valid JSON: ${error.message}`)
  }

  let normalized
  try {
    normalized = normalizeCurriculumFrameworkSnapshot(raw)
  } catch (error) {
    fail(`Snapshot validation failed: ${error.message}`)
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    framework: normalized.framework,
    item_count: normalized.items.length,
    association_count: normalized.associations.length,
    snapshot_sha256: normalized.snapshot_sha256,
  }, null, 2))

  if (!apply) {
    console.log('Dry run complete. Re-run with --apply to write this validated snapshot.')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const framework = await saveFramework(admin, normalized)
  const items = await syncItems(admin, framework.id, normalized.items)
  const associationCount = await syncAssociations(admin, framework.id, items, normalized.associations)

  console.log(JSON.stringify({
    ok: true,
    framework_id: framework.id,
    external_identifier: framework.external_identifier,
    imported_items: items.length,
    imported_associations: associationCount,
    snapshot_sha256: normalized.snapshot_sha256,
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
