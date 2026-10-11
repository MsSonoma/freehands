/**
 * Global OpenAI language-model selector.
 *
 * OPENAI_MODEL is the single runtime handle for switching the app's OpenAI
 * language model. Teacher-specific model overrides should not bypass it.
 */
export const DEFAULT_AI_MODEL = 'gpt-5.6-luna'

export function resolveAiModel(env = process.env) {
  const configured = String(env?.OPENAI_MODEL || '').trim()
  return configured || DEFAULT_AI_MODEL
}

export const AI_MODEL = resolveAiModel()

export function aiModelTemperature(temperature, model = AI_MODEL) {
  const normalizedModel = String(model || '').trim().toLowerCase()
  const customTemperatureUnsupported = normalizedModel === 'gpt-5.6-luna' || normalizedModel.startsWith('gpt-5.6-luna-')
  if (customTemperatureUnsupported) return {}
  const value = Number(temperature)
  return Number.isFinite(value) ? { temperature: value } : {}
}
