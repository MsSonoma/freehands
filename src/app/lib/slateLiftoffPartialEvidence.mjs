// Liftoff-only evidence admission. The learner-visible question controls ordinary negative evidence.
const DEMAND_STATUSES = new Set(['satisfied', 'incorrect', 'not_addressed', 'ambiguous'])
const BASES = new Set(['asked_target', 'volunteered_correct', 'volunteered_contradiction'])
const POSITIVE_RESULTS = new Set(['independent_success', 'supported_success'])
const NEGATIVE_RESULTS = new Set(['failure', 'possible_slip'])
const FEEDBACK_DISPOSITIONS = new Set(['affirm', 'correct', 'clarify', 'neutral'])

function clean(value, max = 800) {
  return String(value || '').trim().slice(0, max)
}

function groundedQuote(learnerResponse, quote) {
  const answer = clean(learnerResponse, 12000).toLowerCase()
  const candidate = clean(quote, 500).toLowerCase()
  return Boolean(candidate && answer.includes(candidate))
}

function normalizeDemandJudgment(raw, contract) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const status = DEMAND_STATUSES.has(raw.status) ? raw.status : null
  if (!status) return null
  return {
    contractId: clean(raw.contractId, 160),
    status,
    responseQuote: clean(raw.responseQuote, 500),
    reason: clean(raw.reason, 800),
    ...(contract ? { criterion: contract.criterion } : {}),
  }
}

function normalizedBasis(row, contract) {
  if (BASES.has(row?.basis)) return row.basis
  if (row?.responseStatus === 'correct') {
    return contract && row?.componentId === contract.targetComponentId ? 'asked_target' : 'volunteered_correct'
  }
  return ''
}

export function validateLiftoffEvidenceAgainstDemand({
  observations,
  demandJudgment,
  feedbackDisposition,
  learnerResponse,
  currentAction,
  authoritativeMathEvidence = null,
} = {}) {
  const contract = currentAction?.problem?.responseContract || null
  const judgment = normalizeDemandJudgment(demandJudgment, contract)
  const disposition = FEEDBACK_DISPOSITIONS.has(feedbackDisposition) ? feedbackDisposition : null
  const violations = []
  const accepted = []

  if (contract) {
    if (!judgment) {
      violations.push('missing_demand_judgment')
    } else if (judgment.contractId !== contract.contractId) {
      violations.push('demand_contract_mismatch')
    } else if (['satisfied', 'incorrect'].includes(judgment.status)
      && !groundedQuote(learnerResponse, judgment.responseQuote)) {
      violations.push('ungrounded_demand_judgment')
    }
  }

  for (const source of Array.isArray(observations) ? observations : []) {
    const row = source && typeof source === 'object' ? { ...source } : null
    if (!row) continue
    const status = row.responseStatus
    if (!['correct', 'incorrect', 'not_addressed'].includes(status) || status === 'not_addressed') continue

    const quote = clean(row.responseQuote, 500)
    if (!groundedQuote(learnerResponse, quote)) {
      violations.push('ungrounded_observation')
      continue
    }

    const positive = status === 'correct' && POSITIVE_RESULTS.has(row.result)
    const negative = status === 'incorrect' && NEGATIVE_RESULTS.has(row.result)
    if (!positive && !negative) {
      violations.push('observation_status_result_mismatch')
      continue
    }

    const basis = normalizedBasis(row, contract)
    if (!basis) {
      violations.push('missing_negative_basis')
      continue
    }

    if (basis === 'asked_target') {
      if (!contract) {
        const authoritativeWrong = authoritativeMathEvidence?.correct === false
        if (negative && !authoritativeWrong) {
          violations.push('legacy_uncontracted_negative')
          continue
        }
      } else {
        if (row.componentId !== contract.targetComponentId) {
          violations.push('asked_target_component_mismatch')
          continue
        }
        if (!judgment || judgment.contractId !== contract.contractId) {
          violations.push('asked_target_without_matching_judgment')
          continue
        }
        if (positive && judgment.status !== 'satisfied') {
          violations.push('positive_target_judgment_mismatch')
          continue
        }
        if (negative && judgment.status !== 'incorrect') {
          violations.push('negative_target_judgment_mismatch')
          continue
        }
      }
    }

    if (basis === 'volunteered_correct' && !positive) {
      violations.push('volunteered_correct_cannot_be_negative')
      continue
    }

    if (basis === 'volunteered_contradiction') {
      if (!negative) {
        violations.push('volunteered_contradiction_must_be_negative')
        continue
      }
      if (!clean(row.contradiction, 800)) {
        violations.push('volunteered_contradiction_missing_claim')
        continue
      }
    }

    accepted.push({
      ...row,
      basis,
      accepted: true,
      responseQuote: quote,
      contractId: basis === 'asked_target' && contract ? contract.contractId : clean(row.contractId, 160) || null,
      criterion: basis === 'asked_target' && contract ? contract.criterion : clean(row.criterion, 800) || null,
      contradiction: basis === 'volunteered_contradiction' ? clean(row.contradiction, 800) : null,
    })
  }

  if (contract && judgment && judgment.contractId === contract.contractId) {
    const targetRows = accepted.filter(row => row.basis === 'asked_target' && row.componentId === contract.targetComponentId)
    if (judgment.status === 'satisfied' && !targetRows.some(row => POSITIVE_RESULTS.has(row.result))) {
      violations.push('satisfied_without_positive_target_evidence')
    }
    if (judgment.status === 'incorrect' && !targetRows.some(row => NEGATIVE_RESULTS.has(row.result))) {
      violations.push('incorrect_without_negative_target_evidence')
    }
    if (['not_addressed', 'ambiguous'].includes(judgment.status)
      && targetRows.some(row => NEGATIVE_RESULTS.has(row.result))) {
      violations.push('uncertain_demand_cannot_fail_target')
    }
  }

  const hasAcceptedContradiction = accepted.some(row => row.basis === 'volunteered_contradiction' && NEGATIVE_RESULTS.has(row.result))
  if (contract && judgment) {
    if (judgment.status === 'satisfied' && !['affirm', 'neutral'].includes(disposition)) {
      violations.push('satisfied_feedback_must_not_correct')
    }
    if (judgment.status === 'incorrect' && disposition !== 'correct') {
      violations.push('incorrect_feedback_must_correct')
    }
    if (['not_addressed', 'ambiguous'].includes(judgment.status)
      && !hasAcceptedContradiction
      && !['clarify', 'neutral'].includes(disposition)) {
      violations.push('uncertain_feedback_must_not_correct')
    }
  }

  return {
    valid: violations.length === 0,
    observations: accepted,
    demandJudgment: judgment,
    feedbackDisposition: disposition,
    violations: [...new Set(violations)],
  }
}

// Backward-compatible helper retained for existing callers/tests.
export function filterLiftoffPartialEvidence(observations, learnerResponse) {
  return (Array.isArray(observations) ? observations : []).flatMap((row) => {
    const status = row?.responseStatus
    if (!['correct', 'incorrect', 'not_addressed'].includes(status) || status === 'not_addressed') return []
    const quote = clean(row?.responseQuote, 500)
    if (!groundedQuote(learnerResponse, quote)) return []
    if (status === 'correct' && !POSITIVE_RESULTS.has(row?.result)) return []
    if (status === 'incorrect' && !NEGATIVE_RESULTS.has(row?.result)) return []
    return [{ ...row, responseQuote: quote.toLowerCase() }]
  })
}
