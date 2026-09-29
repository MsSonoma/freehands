import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPackForSystemMessage } from './cohereStyleMentor.js'

test('memory pack includes provenance and preserves educational authority', () => {
  const formatted = formatPackForSystemMessage({
    recent_events: [
      { role: 'user', text: 'Current question' },
    ],
    recall_snippets: [
      {
        role: 'assistant',
        text: 'Earlier context',
        memory_scope: 'same_learner',
        conversation_title: 'Math planning',
        meta: { source: 'mentor_conversations' },
      },
    ],
  })

  assert.match(formatted, /same learner \| Math planning \| mentor conversations/i)
  assert.match(formatted, /Earlier context/)
  assert.match(formatted, /contextual, not authoritative learning evidence/i)
  assert.match(formatted, /canonical learning evidence outrank remembered conversation content/i)
})
