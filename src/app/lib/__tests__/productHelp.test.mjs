import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectProductHelp,
  getProductHelpFeature,
  getProductHelpScript,
  productHelpHistoryMessage,
} from '../productHelp.mjs'

test('strong named feature questions resolve without fuzzy matching', () => {
  assert.equal(detectProductHelp('What does the Golden Key do?', { surface: 'mentor' })?.feature?.id, 'golden-key')
  assert.equal(detectProductHelp('Where is the syllabus?', { surface: 'mentor' })?.features?.[0]?.id, 'syllabus')
  assert.equal(detectProductHelp('Where is my syllabus?', { surface: 'mentor' })?.features?.[0]?.id, 'syllabus')
  assert.equal(detectProductHelp('How does the timer work?', { surface: 'sonoma' })?.features?.[0]?.id, 'phase-timers')
})

test('weak generic language does not trigger product help', () => {
  assert.equal(detectProductHelp('How do I change my plan?', { surface: 'mentor' }), null)
  assert.equal(detectProductHelp('What are some good ways to help with test anxiety?', { surface: 'mentor' }), null)
  assert.equal(detectProductHelp('Can you explain why my learner keeps forgetting multiplication?', { surface: 'mentor' }), null)
  assert.equal(detectProductHelp('Schedule math for Monday', { surface: 'mentor' }), null)
  assert.equal(detectProductHelp('Schedule a lesson', { surface: 'mentor' }), null)
  assert.equal(detectProductHelp('Can you schedule a lesson?', { surface: 'mentor' }), null)
})

test('report-like Mentor questions remain available to report/action routing', () => {
  assert.equal(detectProductHelp('Show my learner goals', { surface: 'mentor' }), null)
  assert.equal(detectProductHelp('How many Golden Keys does my learner have?', { surface: 'mentor' }), null)
  assert.equal(detectProductHelp('How many Golden Keys does my learner have?', { surface: 'sonoma' }), null)
})

test('surface-specific help stays scoped', () => {
  assert.equal(detectProductHelp('Can you open the video?', { surface: 'webb' })?.features?.[0]?.id, 'webb-video')
  assert.equal(detectProductHelp('Can you open the video?', { surface: 'mentor' }), null)
  assert.equal(detectProductHelp('What does the skip button do?', { surface: 'webb' })?.features?.[0]?.id, 'webb-skip-speech')
})

test('feature scripts and synthetic history use the shared product_help tag', () => {
  assert.ok(getProductHelpFeature('golden-key'))
  assert.match(getProductHelpScript('golden-key'), /Golden Keys/)
  assert.match(getProductHelpScript('golden-key'), /at least three tracked work phases/)
  assert.doesNotMatch(getProductHelpScript('golden-key'), /four of five|Exercise, Worksheet, and Test/)
  assert.deepEqual(productHelpHistoryMessage('assistant', 'script', 'golden-key'), {
    role: 'assistant', content: 'script', kind: 'product_help', featureId: 'golden-key',
  })
})
