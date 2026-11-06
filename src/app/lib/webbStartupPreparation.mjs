import {
  blueprintMatchesObjectives,
  normalizeWebbCompositionBlueprint,
  webbStartupBlueprintViolations,
  WEBB_BLUEPRINT_VERSION,
} from './webbCompositionBlueprint.mjs'

// Increment this version if the blueprint-generation contract changes.
const PREPARATION_CACHE_VERSION = 'webb-preparation-2026-11-06-v1'
const PREPARATION_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const GENERATION_STAGES = new Set(['repair', 'fresh'])

function lessonPreparationSignature(lesson, pendingObjectives) {
  const questions = {}
  for (const field of ['sample', 'truefalse', 'multiplechoice', 'fillintheblank', 'shortanswer', 'questions']) {
    questions[field] = (Array.isArray(lesson?.[field]) ? lesson[field] : []).map(row =>
      typeof row === 'string' ? row : String(row?.question || ''))
  }
  return JSON.stringify({
    cacheVersion: PREPARATION_CACHE_VERSION,
    blueprintVersion: WEBB_BLUEPRINT_VERSION,
    lessonKey: lesson?.lessonKey || lesson?.lesson_id || lesson?.id || '',
    title: lesson?.title || '', subject: lesson?.subject || '', grade: lesson?.grade || '',
    questions, pendingObjectives,
  })
}

function preparationCacheKey(learnerId, lesson) {
  const key = lesson?.lessonKey || lesson?.lesson_id || lesson?.id
  return learnerId && key
    ? `webb_preparation:${encodeURIComponent(String(learnerId))}:${encodeURIComponent(String(key))}`
    : null
}

function validatedObjectives(data, pendingObjectives) {
  const objectives = data?.objectives
  const clues = data?.clues
  if (!Array.isArray(objectives) || !objectives.length || objectives.length > 8
    || objectives.some(value => typeof value !== 'string' || !value.trim())
    || new Set(objectives.map(value => value.trim().toLowerCase())).size !== objectives.length
    || !Array.isArray(clues) || clues.length !== objectives.length
    || clues.some(value => typeof value !== 'string' || !value.trim())) return null

  if (pendingObjectives.length) {
    const pending = [...new Set(pendingObjectives)]
    if (data.revisit !== true || objectives.length !== pending.length
      || !objectives.every((objective, index) => objective === pending[index])) return null
    return { objectives: [...objectives], clues: [...clues], blueprint: null, revisit: true }
  }

  if (!data?.blueprint || data.revisit === true
    || webbStartupBlueprintViolations(data.blueprint).length
    || !blueprintMatchesObjectives(data.blueprint, objectives)) return null
  const blueprint = normalizeWebbCompositionBlueprint(data.blueprint)
  if (blueprint.bodyUnits.some((unit, index) => unit.clue !== clues[index])) return null
  return { objectives: [...objectives], clues: [...clues], blueprint, revisit: false }
}

function readCachedPlan(storage, key, signature, pendingObjectives, now) {
  if (!storage || !key) return null
  try {
    const saved = JSON.parse(storage.getItem(key) || 'null')
    if (saved?.signature !== signature || !Number.isFinite(saved.cachedAt)
      || now - saved.cachedAt > PREPARATION_CACHE_MAX_AGE_MS || now < saved.cachedAt) return null
    return validatedObjectives(saved.plan, pendingObjectives)
  } catch {
    return null
  }
}

function cacheValidatedPlan(storage, key, signature, plan, now) {
  if (!storage || !key) return
  try { storage.setItem(key, JSON.stringify({ signature, plan, cachedAt: now })) } catch {}
}

export class WebbPreparationCancelled extends Error {
  constructor() {
    super('Lesson preparation cancelled')
    this.name = 'WebbPreparationCancelled'
  }
}

export class WebbPreparationFailed extends Error {
  constructor(message, retryable = false) {
    super(message)
    this.name = 'WebbPreparationFailed'
    this.retryable = retryable
  }
}

async function requestPreparationStep(fetchImpl, lesson, pendingObjectives, stage, draft, shouldContinue) {
  if (!shouldContinue()) throw new WebbPreparationCancelled()
  let response
  try {
    response = await fetchImpl('/api/webb-objectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate-step', stage, draft, lesson, pendingObjectives }),
    })
  } catch {
    if (!shouldContinue()) throw new WebbPreparationCancelled()
    throw new WebbPreparationFailed('The preparation service could not be reached.', true)
  }
  if (!shouldContinue()) throw new WebbPreparationCancelled()
  if (!response.ok) {
    // The third validated draft failed the strict blueprint rules. Let the
    // orchestrator start one fresh sequence, not accept an invalid objective.
    if (response.status === 422) return { generationInvalid: true }
    throw new WebbPreparationFailed(
      'The preparation service could not finish.',
      RETRYABLE_HTTP_STATUSES.has(response.status),
    )
  }
  const data = await response.json().catch(() => null)
  if (!data || typeof data !== 'object') {
    throw new WebbPreparationFailed('The preparation service returned an incomplete result.', true)
  }
  return data
}

/**
 * Acquire a validated lesson map before allowing Webb's learner session to start.
 * One model generation/repair runs per request, and transient errors retry the same
 * stage automatically. Only a fully validated map may be cached or used.
 */
export async function prepareWebbStartupObjectives({
  lesson,
  learnerId,
  pendingObjectives = [],
  fetchImpl,
  storage = null,
  onRetry = () => {},
  shouldContinue = () => true,
  now = () => Date.now(),
  delay = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const pending = Array.isArray(pendingObjectives)
    ? [...new Set(pendingObjectives.map(value => String(value || '').trim()).filter(Boolean).slice(0, 8))]
    : []
  const signature = lessonPreparationSignature(lesson, pending)
  const key = preparationCacheKey(learnerId, lesson)
  const cached = readCachedPlan(storage, key, signature, pending, now())
  if (cached) return cached

  // A failed final validation may be a transient generation problem; one complete
  // fresh pass is allowed. Transient HTTP failures retry their current step once.
  for (let cycle = 0; cycle < 2; cycle += 1) {
    let stage = 'initial'
    let draft = ''
    for (let step = 0; step < 3; step += 1) {
      let data = null
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          data = await requestPreparationStep(fetchImpl, lesson, pending, stage, draft, shouldContinue)
          break
        } catch (error) {
          if (!(error instanceof WebbPreparationFailed) || !error.retryable || attempt === 1) throw error
          onRetry()
          await delay(600 * (attempt + 1))
        }
      }
      if (!shouldContinue()) throw new WebbPreparationCancelled()
      const plan = validatedObjectives(data, pending)
      if (plan) {
        cacheValidatedPlan(storage, key, signature, plan, now())
        return plan
      }
      if (GENERATION_STAGES.has(data?.nextStage)
        && ((stage === 'initial' && data.nextStage === 'repair')
          || (stage === 'repair' && data.nextStage === 'fresh'))
        && typeof data.draft === 'string' && data.draft.length <= 32000) {
        stage = data.nextStage
        draft = data.draft
        continue
      }
      // Invalid HTTP 200 content is not a license to open the lesson.
      // Try a fresh generation once, then surface the existing retry button.
      if (cycle === 0) {
        onRetry()
        break
      }
      throw new WebbPreparationFailed('The lesson preparation was incomplete.')
    }
  }
  throw new WebbPreparationFailed('Mrs. Webb could not validate the lesson goals.')
}
