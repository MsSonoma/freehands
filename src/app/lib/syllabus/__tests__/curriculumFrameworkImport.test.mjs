import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeCurriculumFrameworkSnapshot } from '../curriculumFrameworkImport.mjs'

test('framework snapshots preserve authoritative identities and relationship provenance', () => {
  const normalized = normalizeCurriculumFrameworkSnapshot({
    framework: {
      name: 'Example Grade 4 Mathematics',
      external_identifier: 'example:math:4:2026',
      source_kind: 'imported',
      version_label: '2026',
      jurisdiction: 'Example',
      source_uri: 'https://example.invalid/standards',
    },
    items: [
      {
        external_id: 'M4.DIV.1',
        code: 'M4.DIV.1',
        subject: 'Math',
        grade_band: '4th',
        statement: 'Divide multi-digit whole numbers.',
        planning_group_key: 'math:division',
      },
      {
        external_id: 'M4.DEC.1',
        code: 'M4.DEC.1',
        subject: 'Math',
        grade_band: '4th',
        statement: 'Interpret decimal notation.',
        planning_group_key: 'math:decimals',
      },
    ],
    associations: [{
      source_external_id: 'M4.DIV.1',
      target_external_id: 'M4.DEC.1',
      relationship: 'prerequisite_of',
      provenance_kind: 'source',
    }],
  })

  assert.equal(normalized.framework.external_identifier, 'example:math:4:2026')
  assert.equal(normalized.items[0].external_id, 'M4.DIV.1')
  assert.equal(normalized.items[0].planning_group_key, 'math:division')
  assert.deepEqual(normalized.associations[0], {
    source_external_id: 'M4.DIV.1',
    target_external_id: 'M4.DEC.1',
    relationship: 'prerequisite_of',
    provenance_kind: 'source',
    metadata: {},
  })
  assert.match(normalized.snapshot_sha256, /^[0-9a-f]{64}$/)
})

test('framework import rejects associations to items outside the versioned snapshot', () => {
  assert.throws(() => normalizeCurriculumFrameworkSnapshot({
    framework: {
      name: 'Example',
      external_identifier: 'example:framework',
    },
    items: [{
      external_id: 'A',
      subject: 'Science',
      statement: 'Observe a system.',
    }],
    associations: [{
      source_external_id: 'A',
      target_external_id: 'B',
      relationship: 'prerequisite_of',
    }],
  }), /target item is not present/i)
})

test('framework import rejects duplicate stable external identities', () => {
  assert.throws(() => normalizeCurriculumFrameworkSnapshot({
    framework: {
      name: 'Example',
      external_identifier: 'example:framework',
    },
    items: [
      { external_id: 'A', subject: 'Science', statement: 'First statement.' },
      { external_id: 'a', subject: 'Science', statement: 'Second statement.' },
    ],
  }), /Duplicate framework item external id/i)
})
