export const FACILITATOR_HOME_REQUEST_TIMEOUT_MS = 8000

export const FACILITATOR_HOME_SHELL_STATES = Object.freeze({
  LOADING: 'loading',
  AUTH_GATE: 'auth-gate',
  HOME: 'home',
})

export function resolveFacilitatorHomeShellState({
  authLoading = true,
  isAuthenticated = false,
  pinChecked = false,
} = {}) {
  if (authLoading || (isAuthenticated && !pinChecked)) {
    return FACILITATOR_HOME_SHELL_STATES.LOADING
  }
  return isAuthenticated
    ? FACILITATOR_HOME_SHELL_STATES.HOME
    : FACILITATOR_HOME_SHELL_STATES.AUTH_GATE
}

export class FacilitatorHomeTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} did not finish within ${timeoutMs}ms`)
    this.name = 'FacilitatorHomeTimeoutError'
    this.code = 'FACILITATOR_HOME_TIMEOUT'
  }
}

export async function settleFacilitatorHomeTask(task, {
  fallback = null,
  label = 'Facilitator Home request',
  timeoutMs = FACILITATOR_HOME_REQUEST_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController()
  let timeoutId

  try {
    const request = Promise.resolve().then(() => (
      typeof task === 'function' ? task({ signal: controller.signal }) : task
    ))
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort()
        reject(new FacilitatorHomeTimeoutError(label, timeoutMs))
      }, Math.max(0, timeoutMs))
    })
    const value = await Promise.race([request, timeout])
    return { ok: true, value, error: null }
  } catch (error) {
    return { ok: false, value: fallback, error }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function loadFacilitatorHomeSchedules({
  learners = [],
  loadSchedule,
  timeoutMs = FACILITATOR_HOME_REQUEST_TIMEOUT_MS,
} = {}) {
  const loadableLearners = learners.filter((learner) => learner?.id)
  if (!loadableLearners.length || typeof loadSchedule !== 'function') {
    return { scheduledKeys: {}, failures: 0 }
  }

  const results = await Promise.all(loadableLearners.map((learner) => (
    settleFacilitatorHomeTask(
      ({ signal }) => loadSchedule(learner, { signal }),
      { fallback: { schedule: [] }, label: `Schedule for ${learner.id}`, timeoutMs },
    )
  )))

  const scheduledKeys = {}
  for (const result of results) {
    const rows = Array.isArray(result.value) ? result.value : result.value?.schedule
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row?.lesson_key) scheduledKeys[row.lesson_key] = row.scheduled_date || true
    }
  }

  return {
    scheduledKeys,
    failures: results.filter((result) => !result.ok).length,
  }
}
