// The model may spend completion tokens on reasoning before emitting spoken JSON.
// Budget for that work; do not turn an empty or truncated completion into learner dialogue.
export const WEBB_CHAT_TOKEN_BUDGETS = Object.freeze([1024, 2048])

export function parseWebbStructuredReply(raw, finishReason = null) {
  if (finishReason && finishReason !== 'stop') return null
  let parsed
  try { parsed = JSON.parse(String(raw || '')) } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) return null
  const reply = parsed.reply.trim()
  const candidate = typeof parsed.objectivePrompt === 'string' ? parsed.objectivePrompt.trim() : ''
  return { reply, objectivePrompt: candidate && reply.includes(candidate) ? candidate : null }
}

export async function requestWebbStructuredReply({
  fetchImpl = fetch,
  endpoint,
  apiKey,
  model,
  messages,
  temperatureOptions = {},
  logger = console,
}) {
  for (let attempt = 0; attempt < WEBB_CHAT_TOKEN_BUDGETS.length; attempt += 1) {
    const max_completion_tokens = WEBB_CHAT_TOKEN_BUDGETS[attempt]
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, messages, max_completion_tokens,
          ...temperatureOptions,
          response_format: { type: 'json_object' },
        }),
      })
    } catch {
      logger.warn('Webb-chat upstream request failed', { reason: 'network', attempt: attempt + 1 })
      continue
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500
      logger.warn('Webb-chat upstream request failed', { reason: 'http', status: response.status, attempt: attempt + 1 })
      if (retryable && attempt === 0) continue
      return { ok: false, reason: 'upstream_error' }
    }

    let data
    try { data = await response.json() } catch {
      logger.warn('Webb-chat unusable completion', { reason: 'invalid_upstream_json', attempt: attempt + 1 })
      continue
    }

    const choice = data?.choices?.[0]
    const finishReason = choice?.finish_reason || null
    const refusal = Boolean(choice?.message?.refusal)
    const parsed = refusal ? null : parseWebbStructuredReply(choice?.message?.content, finishReason)
    if (parsed) return { ok: true, ...parsed }

    // Log metadata only: never record the learner's words, model output, or API key.
    logger.warn('Webb-chat unusable completion', {
      reason: refusal ? 'refusal' : finishReason === 'length' ? 'token_limit' : 'missing_or_invalid_reply',
      attempt: attempt + 1,
      finishReason,
      completionTokens: data?.usage?.completion_tokens ?? null,
      reasoningTokens: data?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    })
    // A refusal or filtered response is not a transient formatting problem.
    if (refusal || finishReason === 'content_filter') return { ok: false, reason: 'unusable_reply' }
  }
  return { ok: false, reason: 'unusable_reply' }
}
