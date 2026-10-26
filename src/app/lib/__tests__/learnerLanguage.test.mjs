import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildLearnerLanguageGuidance, LEARNER_LANGUAGE_MODES } from '../learnerLanguage.mjs'

test('learner-language baseline requires concrete natural child-facing speech without weakening the target', () => {
  const guidance = buildLearnerLanguageGuidance({ grade: 'Grade 4' })
  assert.match(guidance, /Grade 4/i)
  assert.match(guidance, /patient adult talking naturally to a child/i)
  assert.match(guidance, /one main idea in each sentence/i)
  assert.match(guidance, /familiar object, action, quantity, situation, comparison, or tiny example/i)
  assert.match(guidance, /State plainly what you want the learner to notice, think about, or do next/i)
  assert.match(guidance, /component, probe, dependency, evidence, integration, release, diagnostic, gate, or objective/i)
  assert.match(guidance, /Simplify the explanation, not the learning target/i)
  assert.doesNotMatch(guidance, /previous wording did not fully land/i)
})

test('learner-language recovery requires a genuinely different representation', () => {
  const guidance = buildLearnerLanguageGuidance({ mode: LEARNER_LANGUAGE_MODES.RECOVERY })
  assert.match(guidance, /previous wording did not fully land/i)
  assert.match(guidance, /Do not merely swap synonyms or repeat the same abstraction/i)
  assert.match(guidance, /different concrete anchor, smaller prerequisite, comparison, representation, or simpler sequence/i)
})

test('Mr. Slate keeps Liftoff reasoning internal while applying learner language to teaching, problems, and line help', () => {
  const slate = readFileSync('src/app/api/slate-liftoff/route.js', 'utf8')
  assert.match(slate, /buildLearnerLanguageGuidance/)
  assert.match(slate, /learner-facing fields learnerMessage and nextAction\.problem\.prompt MUST follow the learner-language contract/i)
  assert.match(slate, /LEARNER_LANGUAGE_MODES\.RECOVERY/)
  assert.match(slate, /Every Liftoff learner problem must ask for exactly ONE response target/i)
  assert.doesNotMatch(slate, /Mr\. Slate may be brisk but not harsh/i)
  assert.match(slate, /Never let directness become compressed, cryptic, or puzzle-like/i)
})

test('Ms. Sonoma uses the shared learner-language baseline in discussion, exercise, core teaching, and Study', () => {
  const discussion = readFileSync('src/app/api/sonoma-discussion/route.js', 'utf8')
  const exercise = readFileSync('src/app/api/sonoma-exercise/route.js', 'utf8')
  const teaching = readFileSync('src/app/session/v2/TeachingController.jsx', 'utf8')
  const opening = readFileSync('src/app/session/v2/OpeningActionsController.jsx', 'utf8')
  for (const source of [discussion, exercise, teaching, opening]) {
    assert.match(source, /buildLearnerLanguageGuidance/)
  }
  assert.match(exercise, /Preserve the exact factual or mathematical meaning and every answer choice/i)
  assert.match(discussion, /LEARNER_LANGUAGE_MODES\.RECOVERY/)
  assert.match(opening, /LEARNER_LANGUAGE_MODES\.RECOVERY/)
})

test('Mrs. Webb uses the shared baseline and fixed fallback copy no longer uses the identified adult phrasing', () => {
  const chat = readFileSync('src/app/api/webb-chat/route.js', 'utf8')
  const page = readFileSync('src/app/session/webb/page.jsx', 'utf8')
  const learning = readFileSync('src/app/lib/webbLearningModel.mjs', 'utf8')
  assert.match(chat, /buildLearnerLanguageGuidance/)
  assert.match(chat, /LEARNER_LANGUAGE_MODES\.RECOVERY/)
  assert.match(page, /buildLearnerLanguageGuidance/)
  assert.match(page, /LEARNER_LANGUAGE_MODES\.RECOVERY/)
  assert.doesNotMatch(learning, /distinct, connected step/i)
  assert.match(learning, /does not add the new idea this part needs/i)
  assert.match(learning, /Never write, dictate, complete, rewrite, or offer a model sentence/i)
})
