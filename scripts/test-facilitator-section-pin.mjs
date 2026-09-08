import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { ensurePinAllowed } from '../src/app/lib/pinGate.js'

const layoutSource = readFileSync(new URL('../src/app/facilitator/layout.js', import.meta.url), 'utf8')
const trackerSource = readFileSync(new URL('../src/components/FacilitatorSectionTracker.jsx', import.meta.url), 'utf8')
const headerSource = readFileSync(new URL('../src/app/HeaderBar.js', import.meta.url), 'utf8')

test('active facilitator authority bypasses PIN lookup for facilitator-page navigation', async () => {
  let preferenceLookups = 0
  const allowed = await ensurePinAllowed('facilitator-page', {
    isBrowser: true,
    isInFacilitatorSection: () => true,
    fetchServerPrefsAndHasPin: async () => {
      preferenceLookups += 1
      return { hasPin: true, prefs: { facilitatorPage: true } }
    },
  })

  assert.equal(allowed, true)
  assert.equal(preferenceLookups, 0)
})

test('entering facilitator authority from outside still requires and records a valid PIN', async () => {
  const calls = []
  const allowed = await ensurePinAllowed('facilitator-page', {
    isBrowser: true,
    isInFacilitatorSection: () => false,
    fetchServerPrefsAndHasPin: async () => {
      calls.push('lookup')
      return { hasPin: true, prefs: { facilitatorPage: true } }
    },
    promptForPinMasked: async () => {
      calls.push('prompt')
      return '1234'
    },
    verifyPinServer: async (pin) => {
      calls.push(`verify:${pin}`)
      return true
    },
    setInFacilitatorSection: (active) => calls.push(`active:${active}`),
  })

  assert.equal(allowed, true)
  assert.deepEqual(calls, ['lookup', 'prompt', 'verify:1234', 'active:true'])
})

test('shared facilitator layout establishes the section before rendering any facilitator page', () => {
  assert.match(layoutSource, /ensurePinAllowed\('facilitator-page'\)/)
  assert.match(layoutSource, /if \(!sectionAuthorized\) return null/)
  assert.match(layoutSource, /setSectionAuthorized\(true\)/)
})

test('leaving facilitator space clears authority while internal navigation does not', () => {
  assert.match(trackerSource, /wasInFacilitator && !isInFacilitator/)
  assert.match(trackerSource, /setInFacilitatorSection\(false\)/)
})

test('session-to-facilitator navigation still validates exit PIN before marking facilitator authority', () => {
  const guardIndex = headerSource.indexOf("ensurePinAllowed('session-exit')")
  const markIndex = headerSource.indexOf('setInFacilitatorSection(true)', guardIndex)
  assert.ok(guardIndex >= 0)
  assert.ok(markIndex > guardIndex)
})
