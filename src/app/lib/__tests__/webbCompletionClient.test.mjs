import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getWebbCompletionForLearner,
  saveWebbCompletion,
} from '../webbCompletionClient.js'

function localStorageDouble() {
  const values = new Map()
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  }
}

test('lesson completion persists mastery-pending objectives without claiming mastery', () => {
  const previousWindow = globalThis.window
  const previousLocalStorage = globalThis.localStorage
  const storage = localStorageDouble()
  globalThis.window = { localStorage: storage }
  globalThis.localStorage = storage
  try {
    saveWebbCompletion('learner-1', 'lesson-1', {
      masterySummary: {
        mastered: ['Objective A'],
        masteryPending: ['Objective B'],
        retention: 'not_measured',
      },
    })
    const completion = getWebbCompletionForLearner('learner-1')['lesson-1']
    assert.equal(completion.completed, true)
    assert.deepEqual(completion.masterySummary.mastered, ['Objective A'])
    assert.deepEqual(completion.masterySummary.masteryPending, ['Objective B'])
    assert.equal(completion.masterySummary.retention, 'not_measured')
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousLocalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previousLocalStorage
  }
})
