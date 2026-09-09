import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../page.jsx', import.meta.url), 'utf8')
const studio = fs.readFileSync(new URL('../WebbWritingStudio.jsx', import.meta.url), 'utf8')
const route = fs.readFileSync(new URL('../../../api/webb-objectives/route.js', import.meta.url), 'utf8')
const model = fs.readFileSync(new URL('../../../lib/webbLearningModel.mjs', import.meta.url), 'utf8')

test('objective coverage cannot fabricate a writing note', () => {
  assert.match(route, /noteReadyIndices/)
  assert.match(route, /const completionGate = Array\.isArray\(noteReadyIndices\) \? noteReadyIndices : progressionIndices/)
  assert.match(route, /filter\(\(\{ i \}\) => !completionGate\.includes\(i\)\)/)
  assert.doesNotMatch(route, /createVerbatimLearnerRecord/)
  assert.match(page, /mergeValidLearnerNotes/)
  assert.match(page, /Let's save that to our notes\./)
  assert.match(page, /Goal achieved &middot; Note saved/)
})

test('composition unlocks from source-verified notes rather than raw coverage', () => {
  assert.match(page, /hasAllWritingReadyNotes\(objectives, learnerNotes\)/)
  assert.match(page, /noteReadyIndices: \[\.\.\.writingReady\]/)
  assert.match(page, /allObjectivesMet: objectives\.length > 0 && writingReady\.size >= objectives\.length/)
  assert.doesNotMatch(page, /learnerNotes\[i\]\?\.text \|\| '\.\.\.'/)
  assert.doesNotMatch(page, /Note unavailable/)
})

test('writing studio isolates one note and one attempt while preserving comparison and commit views', () => {
  assert.match(page, /<WebbWritingStudio/)
  assert.match(studio, />\s*Your note\s*</)
  assert.match(studio, />\s*Previous attempt\s*</)
  assert.match(studio, /'Try again'/)
  assert.match(studio, />\s*Your essay so far\s*</)
  assert.match(studio, /webb-writing-glow/)
  assert.doesNotMatch(studio, /learnerNotes/)
})

test('writing resume persists explicit subphase and unsent draft', () => {
  assert.match(model, /WEBB_SNAPSHOT_VERSION = 4/)
  assert.match(page, /writingSubphase, writingDraft, writingAttempts/)
  assert.match(page, /setWritingSubphase\(normalizeWritingSubphase/)
  assert.match(page, /setWritingDraft\(String\(saved\.writingDraft \|\| ''\)\)/)
})

test('normal Mrs. Webb chat input is hidden while the writing studio is active', () => {
  assert.match(page, /\{isChatting && !writingMode && \(/)
  assert.match(page, /open=\{isChatting && writingMode\}/)
})