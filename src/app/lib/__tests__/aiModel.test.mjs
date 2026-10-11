import test from 'node:test'
import assert from 'node:assert/strict'

import { aiModelTemperature, resolveAiModel } from '../aiModel.js'

test('global AI model selector uses the configured handle and Luna fallback', () => {
  assert.equal(resolveAiModel({ OPENAI_MODEL: ' gpt-5.4-mini ' }), 'gpt-5.4-mini')
  assert.equal(resolveAiModel({}), 'gpt-5.6-luna')
})

test('model temperature compatibility is owned by the shared model layer', () => {
  assert.deepEqual(aiModelTemperature(0.3, 'gpt-5.6-luna'), {})
  assert.deepEqual(aiModelTemperature(0.7, 'gpt-5.6-luna-2026-10-01'), {})
  assert.deepEqual(aiModelTemperature(0.3, 'gpt-5.4-mini'), { temperature: 0.3 })
  assert.deepEqual(aiModelTemperature(undefined, 'gpt-5.4-mini'), {})
})
