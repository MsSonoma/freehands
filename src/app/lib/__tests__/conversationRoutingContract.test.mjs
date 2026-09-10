import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

test('Mr. Mentor feature FAQ no longer owns conversational confirmation', () => {
  const source = read('src/app/facilitator/generator/counselor/MentorInterceptor.js')
  const start = source.indexOf('async handleFaq(userMessage, context)')
  const end = source.indexOf('async executeAction()', start)
  assert.ok(start >= 0 && end > start)
  const block = source.slice(start, end)
  assert.doesNotMatch(block, /faq_feature_confirm|faq_feature_select|Is that correct\?/)
  assert.match(block, /reportMatch/)
})

test('Mrs. Webb product help is UI-owned and excluded from objective evidence', () => {
  const source = read('src/app/session/webb/page.jsx')
  assert.match(source, /FeatureHelpToast/)
  assert.match(source, /detectProductHelp\(text, \{ surface: 'webb' \}\)/)
  assert.match(source, /filter\(message => message\?\.kind !== 'product_help'\)/)
  assert.doesNotMatch(source, /const UI_FAQ =/)
})

test('Ms. Sonoma discussion keeps synthetic help in continuity but outside mastery checks', () => {
  const source = read('src/app/session/v2/DiscussionPhase.jsx')
  assert.match(source, /recordSyntheticExchange/)
  assert.match(source, /filter\(m => m\.kind !== 'product_help'\)/)
  assert.match(source, /kind, featureId/)
})

test('Ms. Sonoma Ask resolves product help before recording mastery assistance', () => {
  const page = read('src/app/session/v2/SessionPageV2.jsx')
  const controller = read('src/app/session/v2/OpeningActionsController.jsx')
  const start = page.indexOf('const handleOpeningAskSubmit = useCallback')
  const end = page.indexOf('const handleOpeningAskWhatsTheAnswer', start)
  assert.ok(start >= 0 && end > start)
  const askBlock = page.slice(start, end)
  const detection = askBlock.indexOf("detectProductHelp(question, { surface: 'sonoma' })")
  const evidence = askBlock.indexOf('recordAskUsed')
  assert.ok(detection >= 0 && evidence > detection)
  assert.match(page, /pending.phase === 'opening-ask'/)
  assert.match(controller, /recordSyntheticAskAnswer/)
  assert.match(controller, /Treat the prior Ms. Sonoma lines as words you already said/)
})

test('transition ownership forbids outgoing duplicate segues', () => {
  const discussion = read('src/app/api/sonoma-discussion/route.js')
  const teaching = read('src/app/session/v2/TeachingController.jsx')
  const exercise = read('src/app/api/sonoma-exercise/route.js')
  assert.match(discussion, /application owns the next boundary/i)
  assert.doesNotMatch(discussion, /use exactly the phrase "time for the Exercise"/)
  assert.match(teaching, /Do NOT announce definitions or the next step/)
  assert.match(teaching, /Do NOT announce examples or the next step/)
  assert.match(exercise, /next-question prompt owns that transition/i)
})

test('stale 2025 Mentor scheduling rule and canned crisis paragraph are removed', () => {
  const source = read('src/app/api/counselor/route.js')
  assert.doesNotMatch(source, /always use the year 2025/i)
  assert.doesNotMatch(source, /National Suicide Prevention Lifeline: 988/)
  assert.match(source, /buildConversationSafetyContext/)
})
