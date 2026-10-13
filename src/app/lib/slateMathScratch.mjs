import { buildMathActivityProblem, createMathSession, normalizeMathActivity, restoreMathSession } from '../../lib/math/mathSession.mjs'
import { listVerticalMathWorkingNoteSlots, restoreVerticalMathWorkingNotes } from '../../lib/math/verticalMathNotes.mjs'

function scratchNoteKeys(state) {
  try {
    return listVerticalMathWorkingNoteSlots(buildMathActivityProblem(state.spec), state.view).map((slot) => slot.key)
  } catch { return [] }
}

export const SLATE_SCRATCH_OPERATIONS = ['addition', 'subtraction', 'multiplication', 'division']

export function slateScratchSpec(math, operation) {
  return { operation, operands: [...math.operands], commands: [] }
}

export function slateScratchChoices(math) {
  if (!math?.operands) return []
  return SLATE_SCRATCH_OPERATIONS.filter((operation) => {
    try {
      normalizeMathActivity(slateScratchSpec(math, operation))
      return true
    } catch {
      return false
    }
  })
}

export function slateScratchActivityId(originalId, operation) {
  return `slate-scratch:${String(originalId || '').slice(0, 145)}:${operation}`
}

export function createSlateScratchVariant(math, operation, originalId, phase) {
  if (!slateScratchChoices(math).includes(operation)) return null
  const activityId = slateScratchActivityId(originalId, operation)
  const result = createMathSession(slateScratchSpec(math, operation), { activityId, phase })
  return result.ok ? { session: result.state, notes: {} } : null
}

/**
 * Only restore scratch work for the same question and mathematical operands.
 * The generated operation is a UI selection, never an authoritative test answer.
 */
export function restoreSlateScratchUi(raw, originalId, math, phase) {
  if (!raw || raw.activityId !== originalId || !math || !['teaching', 'test'].includes(phase)) return null
  const supported = slateScratchChoices(math)
  const operation = supported.includes(raw.operation) ? raw.operation : math.operation
  const variants = {}
  for (const op of supported) {
    if (op === math.operation || !raw.variants?.[op]?.session) continue
    const input = raw.variants[op]
    const spec = slateScratchSpec(math, op)
    const activityId = slateScratchActivityId(originalId, op)
    const restored = restoreMathSession(input.session, { activityId, phase, spec })
    if (!restored.ok) continue
    const notes = restoreVerticalMathWorkingNotes({ activityId, notes: input.notes }, {
      activityId, validKeys: scratchNoteKeys(restored.state),
    })
    variants[op] = { session: restored.state, notes: notes.notes }
  }
  return { activityId: originalId, visible: raw.visible === true, operation, variants }
}

export function selectSlateScratchOperation(ui, originalId, math, phase, operation) {
  if (!slateScratchChoices(math).includes(operation)) return null
  const base = restoreSlateScratchUi(ui, originalId, math, phase) || {
    activityId: originalId, visible: false, operation: math.operation, variants: {},
  }
  if (operation === math.operation || base.variants[operation]) return { ...base, operation }
  const variant = createSlateScratchVariant(math, operation, originalId, phase)
  if (!variant) return null
  return { ...base, operation, variants: { ...base.variants, [operation]: variant } }
}

export function slateScratchUiForQuestion(ui, originalId, math, phase) {
  return restoreSlateScratchUi(ui, originalId, math, phase) || {
    activityId: originalId, visible: false, operation: math.operation, variants: {},
  }
}
