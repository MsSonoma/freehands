import { buildMathActivityProblem, createMathSession, normalizeMathActivity, restoreMathSession } from '../../lib/math/mathSession.mjs'
import { sanitizeVerticalMathWorkingNotes } from '../../lib/math/verticalMathNotes.mjs'
import { sanitizeMultiplicationScratchEntries } from '../../lib/math/multiplicationScratch.mjs'
import { slateScratchChoices, SLATE_SCRATCH_OPERATIONS } from './slateMathScratch.mjs'

export function slateManualOperationChoices(operands) {
  const supported = slateScratchChoices({ operands })
  return SLATE_SCRATCH_OPERATIONS.filter((operation) =>
    operation === 'subtraction' || supported.includes(operation))
}

export function initialSlateManualScratch() {
  return { visible: false, operands: ['', ''], operation: 'addition', session: null, notes: {}, partialEntries: {} }
}

export function buildSlateManualScratch(draft, activityId, phase) {
  if (!draft || !['teaching', 'test'].includes(phase)) return null
  const math = { operation: draft.operation, operands: draft.operands, commands: [] }
  if (!slateScratchChoices(math).includes(draft.operation)) return null
  try {
    const spec = normalizeMathActivity(math)
    const problem = buildMathActivityProblem(spec)
    const restored = draft.session ? restoreMathSession(draft.session, { activityId, phase, spec }) : null
    const result = restored?.ok ? restored : createMathSession(spec, { activityId, phase })
    return result.ok ? { spec, problem, session: result.state } : null
  } catch {
    return null
  }
}
export function restoreSlateManualScratch(raw, activityId, phase) {
  const empty = initialSlateManualScratch()
  if (!raw || !Array.isArray(raw.operands) || raw.operands.length !== 2) return empty
  if (!raw.operands.every((x) => typeof x === 'string' && x.length <= 26 && /^[0-9.,]*$/.test(x))) return empty
  const operation = SLATE_SCRATCH_OPERATIONS.includes(raw.operation) ? raw.operation : 'addition'
  const draft = { visible: raw.visible === true, operands: [...raw.operands], operation, session: null, notes: {}, partialEntries: {} }
  const built = buildSlateManualScratch(draft, activityId, phase)
  if (built && raw.session) {
    const restored = restoreMathSession(raw.session, { activityId, phase, spec: built.spec })
    if (restored.ok) draft.session = restored.state
  }
  draft.notes = sanitizeVerticalMathWorkingNotes(raw.notes || {})
  draft.partialEntries = sanitizeMultiplicationScratchEntries(built?.problem, raw.partialEntries)
  return draft
}
