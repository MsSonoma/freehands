export const SLATE_COGNITIVE_DEMAND_TYPES = Object.freeze([
  'identify',
  'choose',
  'compare',
  'calculate',
  'find_evidence',
  'evaluate',
  'predict',
  'describe',
  'explain',
  'demonstrate',
  'propose',
  'plan',
])

const VALID_TYPES = new Set(SLATE_COGNITIVE_DEMAND_TYPES)

function text(value) {
  return String(value || '').trim()
}

export function normalizeSlateCognitiveDemandType(value) {
  const raw = text(value).toLowerCase().replace(/[\s-]+/g, '_')
  const aliases = {
    evidence: 'find_evidence',
    cite_evidence: 'find_evidence',
    identify_evidence: 'find_evidence',
    justify: 'explain',
    defend: 'explain',
    select: 'choose',
    judge: 'evaluate',
    design: 'propose',
  }
  const normalized = aliases[raw] || raw
  return VALID_TYPES.has(normalized) ? normalized : ''
}

function splitDirectiveFragments(value) {
  return text(value)
    .split(/(?<=[?.!;])\s+|\bthen\b|\band\s+(?=(?:explain|justify|defend|compare|identify|name|state|choose|select|evaluate|judge|describe|calculate|compute|predict|use|give|cite|find|suggest|propose|plan)\b)/gi)
    .map(part => part.trim())
    .filter(Boolean)
}

function signalsForFragment(fragment) {
  const value = text(fragment).toLowerCase()
  if (!value) return []

  const signals = new Set()

  const evidence = /\b(?:use|give|cite|identify|find|name|state)\b.{0,50}\b(?:evidence|result|results|data|observation)\b|\bwhat\s+(?:fact|result|detail|part|number|observation)\b.{0,60}\b(?:show|shows|support|supports|tell|tells|help|helps)\b/.test(value)
  const explain = /\b(?:explain|justify|defend)\b|\bwhy\b|\bhow\s+(?:does|do|did|can|could|would)\b/.test(value)
  const evaluate = /\b(?:evaluate|judge)\b|\bwhich\b.{0,70}\b(?:better\s+meets|best\s+meets|meets\s+all|follows\s+all|works\s+better|is\s+better)\b|\bdoes\b.{0,60}\bmeet\b/.test(value)
  const compare = /\bcompare\b|\bhow\b.{0,50}\b(?:different|similar)\b|\bwhat\s+changed\b|\bwhich\b.{0,60}\b(?:more|less|farther|closer|larger|smaller|greater|fewer)\b/.test(value)
  const calculate = /\b(?:calculate|compute|solve)\b|\bfind\s+the\s+(?:sum|difference|product|quotient|value|answer)\b/.test(value)
  const predict = /\bpredict\b|\bwhat\s+(?:will|would)\s+happen\b|\bwhat\s+do\s+you\s+think\s+will\b/.test(value)
  const plan = /\bplan\b.{0,40}\b(?:test|experiment|procedure)\b|\b(?:describe|state|tell)\b.{0,35}\bhow\b.{0,35}\b(?:test|experiment)\b|\bhow\s+should\b.{0,35}\b(?:test|compare)\b/.test(value)
  const propose = /\b(?:propose|suggest)\b|\bwhat\s+(?:change|improvement)\b.{0,45}\b(?:make|try|use)\b|\bwhat\s+should\b.{0,45}\bchange\b/.test(value)
  const describe = /\bdescribe\b/.test(value)
  const choose = /\b(?:choose|select|pick)\b|\bwhich\s+(?:design|option|answer|method|solution|position|phase)\b/.test(value)
  const identify = /\b(?:identify|name|state)\b|\bwhat\s+(?:is|are)\b/.test(value)
  const demonstrate = /\bdemonstrate\b|\bshow\s+(?:your\s+work|how\s+you)\b/.test(value)

  if (evidence) signals.add('find_evidence')
  if (explain) signals.add('explain')
  if (evaluate) signals.add('evaluate')
  if (compare) signals.add('compare')
  if (calculate) signals.add('calculate')
  if (predict) signals.add('predict')
  if (plan) signals.add('plan')
  if (propose) signals.add('propose')
  if (describe && !plan) signals.add('describe')
  if (choose && !evaluate && !compare) signals.add('choose')
  if (identify && !evidence && !evaluate && !compare && !calculate && !predict && !plan && !propose && !describe && !choose) signals.add('identify')
  if (demonstrate && !explain) signals.add('demonstrate')

  return [...signals]
}

function hasMultipleRequestedTargets(fragment) {
  const value = text(fragment)
  if (!value) return false
  if (/\b(?:state|name|identify|give|list)\b[^?.!]{0,180},[^?.!]{0,180}\band\b/i.test(value)) return true
  if (/\bincluding\b[^?.!]{0,120}\band\b/i.test(value)) return true
  if (/\bwhat\b[^?.!]{0,100}\band\s+what\b/i.test(value)) return true
  return false
}

export function analyzeSlateCognitiveDemand({ prompt = '', criterion = '', demandType = '' } = {}) {
  const declaredType = normalizeSlateCognitiveDemandType(demandType)
  const fragments = [...splitDirectiveFragments(prompt), ...splitDirectiveFragments(criterion)]
  let operations = [...new Set(fragments.flatMap(signalsForFragment))]
  const compatibleAliases = {
    find_evidence: new Set(['find_evidence', 'identify']),
    evaluate: new Set(['evaluate', 'choose']),
    plan: new Set(['plan', 'describe']),
    propose: new Set(['propose', 'choose']),
  }
  if (declaredType && compatibleAliases[declaredType]) {
    operations = [...new Set(operations.map(operation => (
      compatibleAliases[declaredType].has(operation) ? declaredType : operation
    )))]
  }
  const multipleTargets = fragments.some(hasMultipleRequestedTargets)

  if (text(demandType) && !declaredType) {
    return { ok: false, reason: 'invalid_cognitive_demand_type', declaredType: '', operations, multipleTargets }
  }
  if (multipleTargets) {
    return { ok: false, reason: 'multiple_response_targets', declaredType, operations, multipleTargets: true }
  }
  if (operations.length > 1) {
    return { ok: false, reason: 'stacked_cognitive_demands', declaredType, operations, multipleTargets: false }
  }
  if (declaredType && operations.length === 1 && operations[0] !== declaredType) {
    return { ok: false, reason: 'cognitive_demand_type_mismatch', declaredType, operations, multipleTargets: false }
  }

  return {
    ok: true,
    reason: '',
    declaredType: declaredType || operations[0] || '',
    operations,
    multipleTargets: false,
  }
}

export function validateSlateCognitiveDemand(input = {}) {
  return analyzeSlateCognitiveDemand(input)
}
