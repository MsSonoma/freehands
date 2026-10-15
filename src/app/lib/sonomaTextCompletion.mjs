// Shared plain-text reply recovery for Ms. Sonoma's short conversational turns.
// Reasoning models may consume the entire completion budget before producing spoken text.
export const SONOMA_TEXT_TOKEN_BUDGETS = Object.freeze([1024, 2048])

export function parseSonomaTextReply(choice) {
  if (!choice || choice.message?.refusal) return null
  if (choice.finish_reason && choice.finish_reason !== 'stop') return null
  const text = choice.message?.content
  return typeof text === 'string' ? text.trim() || null : null
}

export async function requestSonomaTextReply({
  fetchImpl = fetch,
  endpoint,
  apiKey,
  model,
  messages,
  temperatureOptions = {},
  context = 'discussion',
  logger = console,
}) {
  for (let attempt = 0; attempt < SONOMA_TEXT_TOKEN_BUDGETS.length; attempt += 1) {
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          max_completion_tokens: SONOMA_TEXT_TOKEN_BUDGETS[attempt],
          ...temperatureOptions,
        }),
      })
    } catch {
      logger.warn('[sonoma-text] Upstream request failed', { context, reason: 'network', attempt: attempt + 1 })
      continue
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500
      logger.warn('[sonoma-text] Upstream request failed', { context, reason: 'http', status: response.status, attempt: attempt + 1 })
      if (retryable && attempt === 0) continue
      return { ok: false, reason: 'upstream_error' }
    }

    let data
    try {
      data = await response.json()
    } catch {
      logger.warn('[sonoma-text] Unusable completion', { context, reason: 'invalid_upstream_json', attempt: attempt + 1 })
      continue
    }

    const choice = data?.choices?.[0]
    const finishReason = choice?.finish_reason || null
    const refusal = Boolean(choice?.message?.refusal)
    const text = parseSonomaTextReply(choice)
    if (text) return { ok: true, text }

    // Record metadata only; never put learner messages, model text, or API keys in logs.
    logger.warn('[sonoma-text] Unusable completion', {
      context,
      reason: refusal ? 'refusal' : finishReason === 'length' ? 'token_limit' : 'missing_or_invalid_reply',
      attempt: attempt + 1,
      finishReason,
      completionTokens: data?.usage?.completion_tokens ?? null,
      reasoningTokens: data?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    })
    if (refusal || finishReason === 'content_filter') {
      return { ok: false, reason: 'unusable_reply' }
    }
  }
  return { ok: false, reason: 'unusable_reply' }
}
