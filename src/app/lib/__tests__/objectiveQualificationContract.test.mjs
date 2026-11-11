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

test('generated objectives are atomic and not padded to a count', () => {
  assert.match(route, /Derive only the genuinely distinct ATOMIC comprehension objectives/)
  assert.match(route, /Do not invent, split, reword, or repeat an idea merely to reach a count/)
  assert.match(route, /must assess ONE central idea, relationship, process, or skill/)
  assert.match(route, /must never require two independently gradable answers/)
  assert.match(route, /Do not combine identification plus explanation/)
})

test('Mrs. Webb keeps mastery evidence separate from the number of writing thoughts', () => {
  assert.match(route, /always writes from mastered lesson notes/)
  assert.match(route, /later writing plan may group related notes into fewer distinct BODY thoughts/)
  assert.match(route, /Do not repeat comprehension questions or writing requests to satisfy a count/)
  assert.match(route, /Topic and conclusion are composition structure, not mastery objectives/)
  assert.match(route, /Each objective must be answerable by one focused comprehension question|Each objective should be answerable by one focused comprehension question/)
  assert.doesNotMatch(route, /later turn exactly that note into exactly one BODY sentence/)
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

test('learner objective viewers use safe retrieval clues until the goal is complete', () => {
  assert.match(route, /atomic_focus is also the learner-facing retrieval clue/)
  assert.match(route, /must not state the tested relationship/)
  assert.match(route, /cluesFromWebbBlueprint/)
  assert.match(discussion, /objectiveClues:\s+\[\.\.\.this\.#objectiveClues\]/)
  assert.match(discussion, /objectiveText:\s+this\.#objectives\[newlyCompleted\[0\]\]/)
  assert.match(sonomaPage, /const learnerText = done \? obj : \(discussionObjectiveClues\[i\]/)
  assert.match(webbPage, /const learnerText = done \? obj : \(objectiveClues\[i\]/)
  assert.match(webbPage, /note\.objective \|\| objectives\[note\.idx\]/)
  assert.match(webbPage, /saved\.objectiveClues/)
})
