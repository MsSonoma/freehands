/** Explicit live-model check using synthetic dialogue only. No app/storage/database writes.
 * Run: node scripts/test-webb-evaluator-live.mjs --live
 * Requires the repository's normal model credentials; incurs model API usage.
 */
import assert from 'node:assert/strict'
import nextEnv from '@next/env'
if (!process.argv.includes('--live')) throw Error('Pass --live to authorize model API calls. No application records are written.')
nextEnv.loadEnvConfig(process.cwd())
const { POST } = await import('../src/app/api/webb-objectives/route.js')
const { AI_MODEL } = await import('../src/app/lib/aiModel.js')
const author = 'The learner understands that The Magic Finger was written by Roald Dahl.'
const evaporation = 'The learner understands that evaporation changes liquid water into water vapor.'
const lesson = { title: 'The Magic Finger: Book Report', subject: 'language arts', grade: '5',
  truefalse: [{ question: 'The Magic Finger was written by Roald Dahl.', answer: true }] }
const teacher = content => ({ role: 'assistant', content })
const learner = (content, id = 'u1') => ({ role: 'user', content, id })
const supplied = 'Evaporation is the process in which liquid water changes into water vapor.'
const cases = [
  { name: 'first-turn fact', conversation: [teacher('What do you know about The Magic Finger?'), learner('Roald Dahl wrote the magic finger')], completes: true },
  { name: 'fixed fact after teaching', conversation: [teacher('Roald Dahl wrote The Magic Finger. Who wrote it?'), learner('Roald Dahl wrote The Magic Finger.')], completes: true, assisted: true },
  { name: 'short supplied author remains assisted', conversation: [teacher('Roald Dahl wrote The Magic Finger. Who wrote it?'), learner('Roald Dahl')], completes: true, assisted: true },
  { name: 'short factual answer in question context', conversation: [teacher('Who wrote The Magic Finger?'), learner('Roald Dahl')], completes: true },
  { name: 'wrong author stays wrong', conversation: [teacher('Who wrote The Magic Finger?'), learner('Dr. Seuss wrote The Magic Finger.')], completes: false },
  { name: 'negation is not discarded', conversation: [teacher('Who wrote The Magic Finger?'), learner('Roald Dahl did not write The Magic Finger.')], completes: false },
  { name: 'own-word explanation', objective: evaporation, conversation: [teacher('What happens during evaporation?'), learner('The liquid water becomes a gas in the air.')], completes: true },
  { name: 'copied explanation is not independent comprehension', objective: evaporation, conversation: [teacher(supplied), learner(supplied)], completes: false },
  { name: 'legacy recovery uses original answer before teacher echo', conversation: [teacher('What do you know about The Magic Finger?'), learner('The Magic Finger was written by Roald Dahl.'), teacher('Yes, Roald Dahl wrote The Magic Finger. Say it again.'), learner('Roald Dahl wrote the magic finger', 'u2')], completes: true, recoverNotes: true },
]
async function invoke(body) {
  const response = await POST(new Request('http://localhost/api/webb-objectives', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))
  const result = await response.json()
  assert.equal(response.status, 200, JSON.stringify(result))
  return result
}
for (const item of cases) {
  const result = await invoke({ action: 'check', objectives: [item.objective || author],
    lesson: item.objective ? { title: 'Evaporation', subject: 'science', grade: '5' } : lesson,
    conversation: item.conversation, priorPromptExposure: { 0: false }, quick: true,
    recoverNotes: item.recoverNotes === true })
  assert.equal(result.newlyCompleted.includes(0), item.completes, item.name)
  if (item.completes) {
    const note = result.learnerNotes[0]
    assert.ok(note, item.name)
    assert.equal(note.text, item.conversation[note.sourceMessageIndex].content, item.name)
    assert.equal(item.conversation[note.sourceMessageIndex].role, 'user')
  } else assert.equal(result.learnerNotes[0], undefined, item.name)
  if (item.assisted) {
    assert.equal(result.objectiveEvidence[0].mastery, 'pending', item.name)
    assert.equal(result.objectiveEvidence[0].latestAttempt.masteryOutcome, 'assisted_success', item.name)
  }
  if (item.recoverNotes) assert.equal(result.learnerNotes[0].sourceMessageId, 'u1')
  console.log('PASS ' + item.name)
}
const writing = await invoke({ action: 'check-writing', objective: author, lesson,
  note: 'Roald Dahl wrote the magic finger', text: 'Roald Dahl wrote The Magic Finger.' })
assert.equal(writing.accuracy, 'correct')
assert.equal(writing.sentenceOk, true)
console.log('PASS exact learner sentence accepted for writing')
console.log(JSON.stringify({ model: AI_MODEL, liveModelCases: cases.length + 1, applicationWrites: 0 }))
