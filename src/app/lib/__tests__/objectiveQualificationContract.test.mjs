import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const route = fs.readFileSync(new URL('../../api/webb-objectives/route.js', import.meta.url), 'utf8')
  + fs.readFileSync(new URL('../webbObjectiveEvaluation.mjs', import.meta.url), 'utf8')
const discussion = fs.readFileSync(new URL('../../session/v2/DiscussionPhase.jsx', import.meta.url), 'utf8')
const sonoma = fs.readFileSync(new URL('../../api/sonoma-discussion/route.js', import.meta.url), 'utf8')
const webb = fs.readFileSync(new URL('../../api/webb-chat/route.js', import.meta.url), 'utf8')

test('generated objectives are atomic rather than bundled clause checklists', () => {
  assert.match(route, /derive 5 to 8 ATOMIC core comprehension objectives/)
  assert.match(route, /assess ONE central idea, relationship, process, or skill only/)
  assert.match(route, /never merge distinct concepts merely to reduce the count/)
  assert.doesNotMatch(route, /Consolidate overlapping questions into a single objective/)
})

test('semantic qualification accepts the central concept without requiring secondary detail or polished form', () => {
  assert.match(route, /Judge the CENTRAL CONCEPT, not clause-by-clause coverage/)
  assert.match(route, /secondary detail was omitted/)
  assert.match(route, /A brief but semantically sufficient child answer is correct, not partial/)
  assert.match(route, /fragment may be ACCURACY "correct" when it contains the central concept/)
})

test('discussion progression requires demonstrated comprehension rather than correct-looking reproduction', () => {
  assert.match(route, /classification\.latestAttempt\?\.comprehension === 'demonstrated'/)
  assert.match(route, /newlyCompleted: newlyUnderstood/)
  assert.match(route, /classification\.latestAttempt\?\.reproduction/)
  assert.match(route, /evaluationStatus\[index\] = 'reproduced'/)
  assert.match(route, /state\.learnerNotes\[index\] = note/)
})

test('Sonoma uses its completed indices while Webb can explicitly use note readiness', () => {
  assert.match(route, /Array\.isArray\(understoodIndices\) \? understoodIndices/)
  assert.match(route, /legacyNoteReadyIndices: body\.noteReadyIndices/)
  assert.match(discussion, /completedIndices: this\.#completedIndices/)
  assert.match(discussion, /lesson:\s+this\.#lessonData/)
  assert.doesNotMatch(discussion, /noteReadyIndices/)
})

test('both teachers use a transfer question after reproduction instead of inviting another recitation', () => {
  assert.match(discussion, /objectiveStatus/)
  assert.match(sonoma, /objectiveStatus === 'reproduced'/)
  assert.match(sonoma, /small transfer question/)
  assert.match(webb, /masteryStatus === 'reproduced'/)
  assert.match(webb, /small transfer question/)
})
