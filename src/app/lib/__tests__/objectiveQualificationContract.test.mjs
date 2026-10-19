import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const route = fs.readFileSync(new URL('../../api/webb-objectives/route.js', import.meta.url), 'utf8')
  + fs.readFileSync(new URL('../webbObjectiveEvaluation.mjs', import.meta.url), 'utf8')
const discussion = fs.readFileSync(new URL('../../session/v2/DiscussionPhase.jsx', import.meta.url), 'utf8')
const sonoma = fs.readFileSync(new URL('../../api/sonoma-discussion/route.js', import.meta.url), 'utf8')
const webb = fs.readFileSync(new URL('../../api/webb-chat/route.js', import.meta.url), 'utf8')
const sonomaPage = fs.readFileSync(new URL('../../session/v2/SessionPageV2.jsx', import.meta.url), 'utf8')
const webbPage = fs.readFileSync(new URL('../../session/webb/page.jsx', import.meta.url), 'utf8')

test('generated objectives are atomic rather than bundled clause checklists', () => {
  assert.match(route, /reverse-engineer that hidden essay into 5 to 8 ATOMIC core comprehension objectives/)
  assert.match(route, /assess ONE central idea, relationship, process, or skill only/)
  assert.match(route, /must never require two independently gradable answers/)
  assert.match(route, /Do not combine identification plus explanation/)
  assert.doesNotMatch(route, /Consolidate overlapping questions into a single objective/)
})

test('Mrs. Webb objective generation writes the hidden essay first and owns coherence before instruction', () => {
  assert.match(route, /silently draft a coherent short essay ABOUT what this lesson teaches/)
  assert.match(route, /returned objective order is authoritative for later writing/)
  assert.match(route, /exactly one learner-authored note for each objective/)
  assert.match(route, /exactly one essay sentence in the same order/)
  assert.match(route, /will not merge, omit, reorder, or invent content/)
  assert.match(route, /Objective 1 must establish the essay's controlling idea or necessary opening context/)
  assert.match(route, /Every middle objective must intentionally advance the essay/)
  assert.match(route, /Avoid conceptual ricochet/)
  assert.match(route, /final objective must be the essay's synthesis, significance, theme, overall explanation/)
})

test('current Mrs. Webb converts writing-production lessons into learnable essay content instead of switching formats', () => {
  assert.match(route, /always writes from mastered lesson notes/)
  assert.match(route, /does not switch into a separate composition assignment/)
  assert.match(route, /lesson about opinion paragraphs can produce an essay explaining how opinion paragraphs work/)
  assert.match(route, /will explain that learned content; it will not become a separate example essay/)
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

test('Luna starts with sufficient completion budget and Webb has extended route time', () => {
  assert.match(route, /export const maxDuration = 60/)
  assert.match(route, /const tokenLimits = \[isLuna \? Math\.max\(maxTokens \* 3, 2400\) : maxTokens\]/)
  assert.match(route, /choice\?\.finish_reason !== 'length'/)
  assert.match(route, /\.\.\.aiModelTemperature\(temperature, OPENAI_MODEL\)/)
})

test('learner objective viewers use retrieval clues until mastery and reveal the full objective afterward', () => {
  assert.match(route, /atomic_focus is also the learner-facing retrieval clue/)
  assert.match(route, /must not state the tested relationship/)
  assert.match(route, /clues: objectivePlan\.map\(row => row\.atomic_focus\)/)
  assert.match(discussion, /objectiveClues:\s+\[\.\.\.this\.#objectiveClues\]/)
  assert.match(discussion, /objectiveText:\s+this\.#objectives\[newlyCompleted\[0\]\]/)
  assert.match(sonomaPage, /\(showFullDiscussionObjectives \|\| done\) \? obj : \(discussionObjectiveClues\[i\]/)
  assert.match(webbPage, /\(showFullObjectives \|\| done\) \? obj : \(objectiveClues\[i\]/)
  assert.match(webbPage, /note\.objective \|\| objectives\[note\.idx\]/)
  assert.match(webbPage, /saved\.objectiveClues/)
  assert.match(sonomaPage, /Facilitator: show full objectives/)
  assert.match(webbPage, /Facilitator: show full objectives/)
})
