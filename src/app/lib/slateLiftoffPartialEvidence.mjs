// Liftoff-only evidence filter. Omitted demands are not incorrect answers.
export function filterLiftoffPartialEvidence(observations, learnerResponse) {
  const answer = String(learnerResponse || '').trim().toLowerCase()
  return (Array.isArray(observations) ? observations : []).flatMap((row) => {
    const status = row?.responseStatus
    if (!['correct', 'incorrect', 'not_addressed'].includes(status)) return []
    if (status === 'not_addressed') return []
    const quote = String(row?.responseQuote || '').trim().toLowerCase()
    // An observation must point to words/numbers the learner actually submitted.
    if (!quote || !answer.includes(quote)) return []
    if (status === 'correct' && !['independent_success', 'supported_success'].includes(row?.result)) return []
    if (status === 'incorrect' && !['failure', 'possible_slip'].includes(row?.result)) return []
    return [{ ...row, responseQuote: quote }]
  })
}
