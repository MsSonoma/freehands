import { createHash } from 'node:crypto'

const SOURCE_KINDS = new Set(['system', 'imported'])
const RELATIONSHIPS = new Set(['parent_of', 'prerequisite_of', 'related_to'])
const PROVENANCE_KINDS = new Set(['source', 'facilitator', 'inferred'])

function clean(value, max = Infinity) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function metadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? structuredClone(value)
    : {}
}

function requireText(value, label, max) {
  const normalized = clean(value, max)
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

function uniqueKey(value) {
  return clean(value, 500).toLocaleLowerCase()
}

export function normalizeCurriculumFrameworkSnapshot(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Curriculum framework snapshot must be an object')
  }

  const rawFramework = input.framework
  if (!rawFramework || typeof rawFramework !== 'object' || Array.isArray(rawFramework)) {
    throw new Error('framework is required')
  }

  const externalIdentifier = requireText(
    rawFramework.external_identifier || rawFramework.externalIdentifier,
    'framework.external_identifier',
    500,
  )
  const sourceKind = clean(
    rawFramework.source_kind || rawFramework.sourceKind || 'imported',
    40,
  ).toLocaleLowerCase()
  if (!SOURCE_KINDS.has(sourceKind)) {
    throw new Error('framework.source_kind must be system or imported')
  }

  const framework = {
    source_kind: sourceKind,
    name: requireText(rawFramework.name, 'framework.name', 500),
    external_identifier: externalIdentifier,
    version_label: clean(rawFramework.version_label || rawFramework.versionLabel, 300) || null,
    jurisdiction: clean(rawFramework.jurisdiction, 300) || null,
    source_uri: clean(rawFramework.source_uri || rawFramework.sourceUri, 2000) || null,
    metadata: metadata(rawFramework.metadata),
  }

  const rawItems = Array.isArray(input.items) ? input.items : []
  if (!rawItems.length) throw new Error('At least one curriculum framework item is required')
  if (rawItems.length > 10000) throw new Error('A curriculum framework snapshot may contain at most 10,000 items')

  const seenItems = new Set()
  const items = rawItems.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`items[${index}] must be an object`)
    }
    const externalId = requireText(
      raw.external_id || raw.externalId || raw.code,
      `items[${index}].external_id`,
      500,
    )
    const identity = uniqueKey(externalId)
    if (seenItems.has(identity)) throw new Error(`Duplicate framework item external id: ${externalId}`)
    seenItems.add(identity)

    return {
      external_id: externalId,
      code: clean(raw.code, 300) || null,
      subject: requireText(raw.subject, `items[${index}].subject`, 300),
      grade_band: clean(raw.grade_band || raw.gradeBand, 200) || null,
      statement: requireText(raw.statement, `items[${index}].statement`, 5000),
      planning_group_key: clean(
        raw.planning_group_key || raw.planningGroupKey || externalId,
        500,
      ),
      sort_order: Number.isInteger(raw.sort_order)
        ? raw.sort_order
        : Number.isInteger(raw.sortOrder)
          ? raw.sortOrder
          : index,
      metadata: metadata(raw.metadata),
    }
  })

  const itemIdentities = new Map(items.map((item) => [uniqueKey(item.external_id), item.external_id]))
  const rawAssociations = Array.isArray(input.associations) ? input.associations : []
  if (rawAssociations.length > 30000) {
    throw new Error('A curriculum framework snapshot may contain at most 30,000 associations')
  }

  const seenAssociations = new Set()
  const associations = rawAssociations.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`associations[${index}] must be an object`)
    }

    const sourceExternalId = requireText(
      raw.source_external_id || raw.sourceExternalId,
      `associations[${index}].source_external_id`,
      500,
    )
    const targetExternalId = requireText(
      raw.target_external_id || raw.targetExternalId,
      `associations[${index}].target_external_id`,
      500,
    )
    if (!itemIdentities.has(uniqueKey(sourceExternalId))) {
      throw new Error(`Association source item is not present in the snapshot: ${sourceExternalId}`)
    }
    if (!itemIdentities.has(uniqueKey(targetExternalId))) {
      throw new Error(`Association target item is not present in the snapshot: ${targetExternalId}`)
    }
    if (uniqueKey(sourceExternalId) === uniqueKey(targetExternalId)) {
      throw new Error('A curriculum framework item cannot be associated with itself')
    }

    const relationship = clean(raw.relationship, 80).toLocaleLowerCase()
    if (!RELATIONSHIPS.has(relationship)) {
      throw new Error(`associations[${index}].relationship is invalid`)
    }
    const provenanceKind = clean(
      raw.provenance_kind || raw.provenanceKind || 'source',
      80,
    ).toLocaleLowerCase()
    if (!PROVENANCE_KINDS.has(provenanceKind)) {
      throw new Error(`associations[${index}].provenance_kind is invalid`)
    }

    const identity = [
      uniqueKey(sourceExternalId),
      uniqueKey(targetExternalId),
      relationship,
    ].join('|')
    if (seenAssociations.has(identity)) throw new Error('Duplicate curriculum framework association')
    seenAssociations.add(identity)

    return {
      source_external_id: itemIdentities.get(uniqueKey(sourceExternalId)),
      target_external_id: itemIdentities.get(uniqueKey(targetExternalId)),
      relationship,
      provenance_kind: provenanceKind,
      metadata: metadata(raw.metadata),
    }
  })

  const normalized = { framework, items, associations }
  return {
    ...normalized,
    snapshot_sha256: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
  }
}
