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
  assert.match(route, /must never require two independently gradable answers/)
  assert.match(route, /Do not combine identification plus explanation/)
  assert.doesNotMatch(route, /Consolidate overlapping questions into a single objective/)
})

test('Mrs. Webb objective order is an essay blueprint without sacrificing atomic mastery', () => {
  assert.match(route, /silently reverse-engineer a coherent short essay appropriate to this lesson/)
  assert.match(route, /returned objective order is authoritative for later writing/)
  assert.match(route, /Objective 1 must establish the essay's controlling idea or necessary opening context/)
  assert.match(route, /A bare title, author, character name, date, vocabulary definition, or trivia fact is not a topic sentence/)
  assert.match(route, /Every middle objective must intentionally advance/)
  assert.match(route, /final objective must be the essay's synthesis, significance, theme, overall explanation/)
  assert.match(route, /Do not use a name, date, event-identification task, evidence-identification task/)
  assert.match(route, /Preserve mastery-first atomicity even while creating essay flow/)
  assert.match(route, /Do not prescribe transition words, model sentences, or exact learner wording/)
})

test('semantic qualification accepts the central concept without requiring secondary detail or polished form', () => {
  assert.match(route, /Judge the CENTRAL CONCEPT, not clause-by-clause coverage/)
  assert.match(route, /secondary detail was omitted/)
  assert.match(route, /A brief but semantically sufficient child answer is correct, not partial/)
  assert.match(route, /fragment may be ACCURACY "correct" when it contains the central concept/)
})

test('discussion progression requires demonstrated comprehension rather than correct-looking reproduction', () => {
  assert.match(route, /attempt\.comprehension === 'demonstrated'/)
  assert.match(route, /newlyCompleted: newlyUnderstood/)
  assert.match(route, /attempt\.reproduction/)
  assert.match(route, /evaluationStatus\[index\][^\n]*'reproduced'/)
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
