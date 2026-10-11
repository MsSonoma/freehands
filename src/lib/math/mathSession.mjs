import { buildVerticalAdditionProblem } from './verticalAddition.mjs'
import { buildVerticalSubtractionProblem } from './verticalSubtraction.mjs'
import { buildVerticalMultiplicationProblem } from './verticalMultiplication.mjs'
import { buildVerticalDivisionProblem } from './verticalDivision.mjs'
import {
  applyVerticalMathCommand,
  createVerticalMathView,
  enterVerticalMathCell,
  evaluateVerticalMath,
  resolveVerticalMathLocations,
  validateVerticalMathExercise,
} from './verticalMath.mjs'
import {
  evaluateMathTestAnswer,
  isDefaultMathTestView,
  mathTestEnteredIds,
} from './mathTestAnswer.mjs'

export const MATH_SESSION_PROTOCOL_VERSION = 1
export const MATH_SESSION_MAX_COMMANDS = 32
export const MATH_SESSION_MAX_EVENTS = 2000
export const MATH_SESSION_MAX_ATTEMPTS = 2000
export const MATH_SESSION_MAX_RECEIPTS = 2000

const OPERATIONS = new Set(['addition', 'subtraction', 'multiplication', 'division'])
const ACTIONS = new Set(['hide', 'show', 'highlight', 'clear_highlight'])
const PHASES = new Set(['teaching', 'test'])
const BUILDERS = {
  addition: buildVerticalAdditionProblem,
  subtraction: buildVerticalSubtractionProblem,
  multiplication: buildVerticalMultiplicationProblem,
  division: buildVerticalDivisionProblem,
}

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const plainObject = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const copy = (value) => JSON.parse(JSON.stringify(value))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const failure = (code, error) => ({ ok: false, error, code })

function assertKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(label + ' contains an unknown field: ' + key + '.')
  }
}

function rawNormalizedSpec(raw) {
  if (!plainObject(raw)) throw new Error('Math activity must be a structured object.')
  assertKeys(raw, ['operation', 'operands', 'commands'], 'Math activity')
  if (!OPERATIONS.has(raw.operation)) throw new Error('Unsupported math operation.')
  if (!Array.isArray(raw.operands) || raw.operands.some((operand) => typeof operand !== 'string')) {
    throw new Error('Operands must be an array of strings.')
  }
  const commands = raw.commands === undefined ? [] : raw.commands
  if (!Array.isArray(commands)) throw new Error('Commands must be an array.')
  if (commands.length > MATH_SESSION_MAX_COMMANDS) {
    throw new Error('A math activity may contain at most ' + MATH_SESSION_MAX_COMMANDS + ' commands.')
  }
  const normalizedCommands = commands.map((command, index) => {
    if (!plainObject(command)) throw new Error('Command ' + (index + 1) + ' must be an object.')
    assertKeys(command, ['action', 'locations', 'editable'], 'Command ' + (index + 1))
    if (!ACTIONS.has(command.action)) throw new Error('Command ' + (index + 1) + ' has an unsupported action.')
    if (!Array.isArray(command.locations) || command.locations.some((location) => typeof location !== 'string')) {
      throw new Error('Command ' + (index + 1) + ' locations must be an array of strings.')
    }
    if (command.action !== 'clear_highlight' && command.locations.length === 0) {
      throw new Error('Command ' + (index + 1) + ' must select at least one location.')
    }
    if (own(command, 'editable') && typeof command.editable !== 'boolean') {
      throw new Error('Command ' + (index + 1) + ' editable must be a boolean.')
    }
    return {
      action: command.action,
      locations: [...command.locations],
      ...(own(command, 'editable') ? { editable: command.editable } : {}),
    }
  })
  return { operation: raw.operation, operands: [...raw.operands], commands: normalizedCommands }
}

function buildNormalizedProblem(spec) {
  return BUILDERS[spec.operation](spec.operands)
}

export function normalizeMathActivity(raw) {
  const spec = rawNormalizedSpec(raw)
  const problem = buildNormalizedProblem(spec)
  const canonical = { ...spec, operands: [...problem.operands] }
  const configured = applyCommandBatch(problem, createVerticalMathView(problem), canonical.commands)
  if (!configured.ok) throw new Error(configured.error)
  return canonical
}

export function buildMathActivityProblem(spec) {
  return buildNormalizedProblem(normalizeMathActivity(spec))
}

function requestContext(state, request, type, payload) {
  if (!plainObject(state)) return failure('INVALID_STATE', 'Math session state is required.')
  if (!plainObject(request)) return failure('INVALID_REQUEST', 'A structured request is required.')
  if (typeof request.activityId !== 'string' || request.activityId.length === 0 || request.activityId.length > 200) {
    return failure('INVALID_ACTIVITY_ID', 'A bounded activityId is required.')
  }
  if (request.activityId !== state.activityId) return failure('ACTIVITY_MISMATCH', 'The request belongs to a different activity.')
  if (typeof request.requestId !== 'string' || request.requestId.length === 0 || request.requestId.length > 200) {
    return failure('INVALID_REQUEST_ID', 'A bounded requestId is required.')
  }
  const fingerprint = JSON.stringify({ type, payload })
  if (!Array.isArray(state.receipts)) return failure('INVALID_STATE', 'Math session receipts are invalid.')
  const prior = state.receipts.find((receipt) => receipt.requestId === request.requestId)
  if (prior) {
    if (prior.fingerprint !== fingerprint) return failure('REQUEST_ID_CONFLICT', 'That requestId was already used for a different request.')
    return { duplicate: true, receipt: prior }
  }
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    return failure('INVALID_REVISION', 'expectedRevision must be a nonnegative safe integer.')
  }
  if (request.expectedRevision !== state.revision) return failure('STALE_REVISION', 'The math session revision is stale.')
  if (!Array.isArray(state.receipts) || state.receipts.length >= MATH_SESSION_MAX_RECEIPTS) {
    return failure('HISTORY_FULL', 'The math session receipt limit has been reached.')
  }
  return { fingerprint }
}

function requestFields(request, allowed) {
  if (!plainObject(request)) return failure('INVALID_REQUEST', 'A structured request is required.')
  try { assertKeys(request, allowed, 'Request') }
  catch (error) { return failure('INVALID_REQUEST', error.message) }
  return null
}

function withReceipt(state, requestId, fingerprint, response = {}) {
  return {
    ...state,
    receipts: [...state.receipts, { requestId, fingerprint, response: copy(response) }],
  }
}

function duplicateResponse(state, context) {
  return { ok: true, state, ...copy(context.receipt.response), duplicate: true }
}

function canAppend(state, { event = false, attempt = false } = {}) {
  if (!Array.isArray(state.events) || !Array.isArray(state.attempts)) {
    return failure('INVALID_STATE', 'Math session history is invalid.')
  }
  if (event && state.events.length >= MATH_SESSION_MAX_EVENTS) {
    return failure('HISTORY_FULL', 'The math session event limit has been reached.')
  }
  if (attempt && state.attempts.length >= MATH_SESSION_MAX_ATTEMPTS) {
    return failure('HISTORY_FULL', 'The math session attempt limit has been reached.')
  }
  return null
}

function presentation(view) {
  return {
    hidden: [...view.hidden],
    editable: [...view.editable],
    highlighted: [...view.highlighted],
  }
}

function presentationChanged(left, right) {
  return !same(presentation(left), presentation(right))
}

function entryChanges(left, right) {
  const ids = [...new Set([...Object.keys(left.entries), ...Object.keys(right.entries)])].sort()
  return ids.flatMap((location) => {
    const previous = own(left.entries, location) ? left.entries[location] : undefined
    const next = own(right.entries, location) ? right.entries[location] : undefined
    if (previous === next) return []
    return [{ location, ...(previous === undefined ? {} : { previous }), ...(next === undefined ? {} : { next }) }]
  })
}

function commandAssists(problem, before, after) {
  if (!presentationChanged(before, after)) return false
  if (after.highlighted.length && !same(before.highlighted, after.highlighted)) return true
  const priorHidden = new Set(before.hidden)
  for (const id of before.hidden) {
    if (!after.hidden.includes(id)) {
      const cell = problem.cellsById[id]
      if (cell?.kind === 'result' || cell?.kind === 'work') return true
    }
  }
  for (const id of after.hidden) {
    if (!priorHidden.has(id)) {
      const cell = problem.cellsById[id]
      if (cell?.kind === 'operand' || id.endsWith('.decimal') || id === 'operator') return true
    }
  }
  return false
}

function applyCommandBatch(problem, startingView, commands) {
  let view = startingView
  let assisted = false
  for (const command of commands) {
    const applied = applyVerticalMathCommand(problem, view, command)
    if (!applied.ok) return failure('INVALID_COMMAND', applied.error)
    assisted ||= commandAssists(problem, view, applied.view)
    view = applied.view
  }
  const validation = validateVerticalMathExercise(problem, view)
  if (!validation.ok) return failure('INVALID_PRESENTATION', validation.reason)
  return { ok: true, view, assisted, validation }
}

export function createMathSession(rawSpec, { activityId, phase = 'teaching' } = {}) {
  if (typeof activityId !== 'string' || activityId.length === 0 || activityId.length > 200) {
    return failure('INVALID_ACTIVITY_ID', 'A bounded activityId is required.')
  }
  if (!PHASES.has(phase)) return failure('INVALID_PHASE', 'Phase must be teaching or test.')
  let spec
  let problem
  try {
    spec = normalizeMathActivity(rawSpec)
    problem = buildNormalizedProblem(spec)
  } catch (error) {
    return failure('INVALID_SPEC', error.message)
  }
  if (phase === 'test' && spec.commands.length > 0) {
    return failure('TEST_PRESENTATION_LOCKED', 'Independent tests cannot include presentation commands.')
  }
  const initial = createVerticalMathView(problem)
  const configured = applyCommandBatch(problem, initial, spec.commands)
  if (!configured.ok) return configured
  const initialEvents = spec.commands.length
    ? [{ revision: 0, type: 'commands', source: 'initial_spec', commands: copy(spec.commands) }]
    : []
  return {
    ok: true,
    state: {
      protocolVersion: MATH_SESSION_PROTOCOL_VERSION,
      activityId,
      phase,
      revision: 0,
      spec,
      view: copy(configured.view),
      events: initialEvents,
      attempts: [],
      receipts: [],
      assisted: configured.assisted,
    },
  }
}

function applyMathSessionCommandsInternal(state, request) {
  const fields = requestFields(request, ['activityId', 'expectedRevision', 'requestId', 'commands'])
  if (fields) return fields
  let commands
  try {
    commands = rawNormalizedSpec({ operation: state?.spec?.operation, operands: state?.spec?.operands, commands: request?.commands }).commands
  } catch (error) {
    return failure('INVALID_COMMANDS', error.message)
  }
  const context = requestContext(state, request, 'commands', { commands })
  if (!context.ok && !context.fingerprint && !context.duplicate) return context
  if (context.duplicate) return duplicateResponse(state, context)
  if (state.phase === 'test') return failure('TEST_PRESENTATION_LOCKED', 'Math presentation is locked during an independent test.')
  const capacity = canAppend(state, { event: true })
  if (capacity) return capacity
  let problem
  try { problem = buildNormalizedProblem(state.spec) } catch (error) { return failure('INVALID_STATE', error.message) }
  const applied = applyCommandBatch(problem, copy(state.view), commands)
  if (!applied.ok) return applied
  const changed = presentationChanged(state.view, applied.view)
  if (!changed) {
    const next = withReceipt(state, request.requestId, context.fingerprint, { changed: false })
    return { ok: true, state: next, changed: false }
  }
  const revision = state.revision + 1
  let next = {
    ...state,
    revision,
    view: copy(applied.view),
    assisted: state.assisted || applied.assisted,
    events: [...state.events, {
      revision, type: 'commands', requestId: request.requestId, commands: copy(commands),
      previous: presentation(state.view), next: presentation(applied.view), assisted: applied.assisted,
      entryChanges: entryChanges(state.view, applied.view),
    }],
  }
  next = withReceipt(next, request.requestId, context.fingerprint, { changed: true })
  return { ok: true, state: next, changed: true }
}

function validateViewShape(problem, view) {
  if (!plainObject(view)) return failure('INVALID_VIEW', 'The renderer view must be an object.')
  assertKeys(view, ['hidden', 'editable', 'highlighted', 'entries'], 'View')
  for (const field of ['hidden', 'editable', 'highlighted']) {
    if (!Array.isArray(view[field]) || view[field].some((id) => typeof id !== 'string') || new Set(view[field]).size !== view[field].length) {
      return failure('INVALID_VIEW', 'View ' + field + ' must contain unique location strings.')
    }
    for (const id of view[field]) {
      // Default views conceal null-valued structural work cells. They are
      // valid view locations even though commands cannot select them.
      if (problem.cellsById[id]) continue
      try { resolveVerticalMathLocations(problem, [id]) }
      catch (error) { return failure('INVALID_VIEW', error.message) }
    }
  }
  if (!plainObject(view.entries) || Object.values(view.entries).some((value) => typeof value !== 'string')) {
    return failure('INVALID_VIEW', 'View entries must be an object of strings.')
  }
  if (view.editable.some((id) => !view.hidden.includes(id))) {
    return failure('INVALID_VIEW', 'Editable locations must remain hidden presentation targets.')
  }
  let checked = { ...copy(view), entries: {} }
  for (const [id, value] of Object.entries(view.entries)) {
    const entered = enterVerticalMathCell(problem, checked, id, value)
    if (!entered.ok) return failure('INVALID_ENTRY', entered.error)
    checked = entered.view
  }
  const validation = validateVerticalMathExercise(problem, checked)
  if (!validation.ok) return failure('INVALID_PRESENTATION', validation.reason)
  return { ok: true, view: checked }
}

function updateMathSessionViewInternal(state, nextView, request) {
  const fields = requestFields(request, ['activityId', 'expectedRevision', 'requestId'])
  if (fields) return fields
  const payload = plainObject(nextView) ? copy(nextView) : nextView
  const context = requestContext(state, request, 'input', payload)
  if (!context.ok && !context.fingerprint && !context.duplicate) return context
  if (context.duplicate) return duplicateResponse(state, context)
  if (!plainObject(nextView)) return failure('INVALID_VIEW', 'The renderer view must be an object.')
  try { assertKeys(nextView, ['hidden', 'editable', 'highlighted', 'entries'], 'View') } catch (error) {
    return failure('INVALID_VIEW', error.message)
  }
  for (const field of ['hidden', 'editable', 'highlighted']) {
    if (!same(nextView[field], state.view[field])) {
      return failure('UNAUTHORIZED_PRESENTATION', 'Renderer input may only change entries.')
    }
  }
  if (!plainObject(nextView.entries) || Object.values(nextView.entries).some((value) => typeof value !== 'string')) {
    return failure('INVALID_ENTRY', 'Entries must be an object of strings.')
  }
  const capacity = canAppend(state, { event: true })
  if (capacity) return capacity
  let problem
  try { problem = buildNormalizedProblem(state.spec) } catch (error) { return failure('INVALID_STATE', error.message) }
  let view = copy(state.view)
  const ids = [...new Set([...Object.keys(state.view.entries), ...Object.keys(nextView.entries)])].sort()
  const diffs = []
  for (const id of ids) {
    const previous = own(state.view.entries, id) ? state.view.entries[id] : undefined
    const next = own(nextView.entries, id) ? nextView.entries[id] : undefined
    if (previous === next) continue
    const entered = enterVerticalMathCell(problem, view, id, next === undefined ? '' : next)
    if (!entered.ok) return failure('INVALID_ENTRY', entered.error)
    view = entered.view
    diffs.push({ location: id, ...(previous === undefined ? {} : { previous }), ...(next === undefined ? {} : { next }) })
  }
  if (diffs.length === 0) {
    const noChange = withReceipt(state, request.requestId, context.fingerprint, { changed: false })
    return { ok: true, state: noChange, changed: false }
  }
  const revision = state.revision + 1
  let updated = {
    ...state,
    revision,
    view,
    events: [...state.events, { revision, type: 'input', requestId: request.requestId, changes: copy(diffs) }],
  }
  updated = withReceipt(updated, request.requestId, context.fingerprint, { changed: true })
  return { ok: true, state: updated, changed: true }
}

function recordMathSessionHelpInternal(state, request) {
  const fields = requestFields(request, ['activityId', 'expectedRevision', 'requestId', 'kind'])
  if (fields) return fields
  const kind = request?.kind
  if (typeof kind !== 'string' || kind.trim().length === 0 || kind.length > 200) {
    return failure('INVALID_HELP', 'Help kind must be a nonempty bounded string.')
  }
  const context = requestContext(state, request, 'help', { kind })
  if (!context.ok && !context.fingerprint && !context.duplicate) return context
  if (context.duplicate) return duplicateResponse(state, context)
  if (state.phase === 'test') return failure('TEST_HELP_LOCKED', 'Help is unavailable during an independent test.')
  const capacity = canAppend(state, { event: true })
  if (capacity) return capacity
  const revision = state.revision + 1
  let next = {
    ...state,
    revision,
    assisted: true,
    events: [...state.events, { revision, type: 'help', requestId: request.requestId, kind }],
  }
  next = withReceipt(next, request.requestId, context.fingerprint)
  return { ok: true, state: next }
}

function targetIds(problem, view) {
  return view.editable.filter((id) => {
    const cell = problem.cellsById[id]
    return cell ? cell.value !== null : true
  })
}

function evaluationSummary(evaluation) {
  return {
    complete: evaluation.complete,
    correct: evaluation.correct,
    checked: evaluation.checked,
    gradable: evaluation.gradable,
    status: evaluation.status,
    missingLocations: [...evaluation.missingLocations],
    incorrectLocations: [...evaluation.incorrectLocations],
  }
}

function publicSubmission(state, requestId, submittedRevision, targets, entries, evaluation) {
  const responseText = targets.map((id) => id + '=' + entries[id]).join(', ')
  return {
    activityId: state.activityId,
    submittedRevision,
    requestId,
    entries: copy(entries),
    responseText,
    phase: state.phase,
    ...(state.phase === 'teaching' ? { evaluation: evaluationSummary(evaluation) } : {}),
  }
}

function submitMathSessionInternal(state, request) {
  const fields = requestFields(request, ['activityId', 'expectedRevision', 'requestId'])
  if (fields) return fields
  const context = requestContext(state, request, 'submission', {})
  if (!context.ok && !context.fingerprint && !context.duplicate) return context
  if (context.duplicate) return duplicateResponse(state, context)
  const capacity = canAppend(state, { event: true, attempt: true })
  if (capacity) return capacity
  let problem
  try { problem = buildNormalizedProblem(state.spec) } catch (error) { return failure('INVALID_STATE', error.message) }
  const validation = validateVerticalMathExercise(problem, state.view)
  if (!validation.ok) return failure('INVALID_PRESENTATION', validation.reason)
  if (validation.status === 'no_response') return failure('NO_RESPONSE_REQUIRED', 'A demonstration without learner targets cannot be submitted.')
  const evaluation = state.phase === 'test'
    ? evaluateMathTestAnswer(problem, state.view)
    : evaluateVerticalMath(problem, state.view)
  if (!evaluation.gradable) return failure('INVALID_PRESENTATION', evaluation.validation.reason)
  if (!evaluation.complete) return failure('INCOMPLETE_RESPONSE', 'Fill every required target before submitting.')
  const targets = state.phase === 'test'
    ? mathTestEnteredIds(problem, state.view)
    : targetIds(problem, state.view)
  if (targets.length === 0) return failure('NO_RESPONSE_REQUIRED', 'A demonstration without learner targets cannot be submitted.')
  const entries = Object.fromEntries(targets.map((id) => [id, state.view.entries[id]]))
  const submittedRevision = state.revision
  const submission = publicSubmission(state, request.requestId, submittedRevision, targets, entries, evaluation)
  const attempt = {
    requestId: request.requestId,
    submittedRevision,
    phase: state.phase,
    targets: [...targets],
    entries: copy(entries),
    view: copy(state.view),
    evaluation: evaluationSummary(evaluation),
    assisted: Boolean(state.assisted),
    independent: !state.assisted,
  }
  const revision = state.revision + 1
  let next = {
    ...state,
    revision,
    attempts: [...state.attempts, attempt],
    events: [...state.events, {
      revision, type: 'submission', requestId: request.requestId,
      attemptIndex: state.attempts.length, submittedRevision, assisted: Boolean(state.assisted),
    }],
  }
  next = withReceipt(next, request.requestId, context.fingerprint, { submission })
  return { ok: true, state: next, submission }
}

export function serializeMathSession(state) {
  return copy(state)
}

function validHistoryArray(value, maximum) {
  return Array.isArray(value) && value.length <= maximum && value.every(plainObject)
}

function restoreAttempt(problem, attempt, phase) {
  if (!plainObject(attempt) || !Array.isArray(attempt.targets) || !plainObject(attempt.entries) || !plainObject(attempt.view)) {
    throw new Error('Snapshot contains an invalid attempt.')
  }
  const checked = validateViewShape(problem, attempt.view)
  if (!checked.ok) throw new Error(checked.error)
  if (phase === 'test' && !isDefaultMathTestView(problem, checked.view)) {
    throw new Error('Test snapshot attempts must use the default presentation.')
  }
  const evaluation = phase === 'test'
    ? evaluateMathTestAnswer(problem, checked.view)
    : evaluateVerticalMath(problem, checked.view)
  const targets = phase === 'test'
    ? mathTestEnteredIds(problem, checked.view)
    : targetIds(problem, checked.view)
  if (!same(targets, attempt.targets)) throw new Error('Snapshot attempt targets do not match its view.')
  const entries = Object.fromEntries(targets.filter((id) => own(checked.view.entries, id)).map((id) => [id, checked.view.entries[id]]))
  if (!same(entries, attempt.entries)) throw new Error('Snapshot attempt entries do not match its view.')
  return {
    ...copy(attempt),
    targets,
    entries,
    view: checked.view,
    evaluation: evaluationSummary(evaluation),
    assisted: Boolean(attempt.assisted),
    independent: !attempt.assisted,
  }
}

export function restoreMathSession(snapshot, { activityId, phase, spec } = {}) {
  try {
    if (!plainObject(snapshot)) throw new Error('Snapshot must be an object.')
    assertKeys(snapshot, [
      'protocolVersion', 'activityId', 'phase', 'revision', 'spec', 'view',
      'events', 'attempts', 'receipts', 'assisted',
    ], 'Snapshot')
    if (snapshot.protocolVersion !== MATH_SESSION_PROTOCOL_VERSION) throw new Error('Snapshot protocol version is unsupported.')
    if (snapshot.activityId !== activityId) throw new Error('Snapshot activityId does not match the requested context.')
    if (!PHASES.has(phase) || snapshot.phase !== phase) throw new Error('Snapshot phase does not match the requested context.')
    const canonical = normalizeMathActivity(spec)
    if (!same(snapshot.spec, canonical)) throw new Error('Snapshot spec does not match the requested context.')
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) throw new Error('Snapshot revision is invalid.')
    if (!validHistoryArray(snapshot.events, MATH_SESSION_MAX_EVENTS) ||
        !validHistoryArray(snapshot.attempts, MATH_SESSION_MAX_ATTEMPTS) ||
        !validHistoryArray(snapshot.receipts, MATH_SESSION_MAX_RECEIPTS)) {
      throw new Error('Snapshot history is malformed or exceeds a protocol limit.')
    }
    if (typeof snapshot.assisted !== 'boolean') throw new Error('Snapshot assistance state is invalid.')
    const requestIds = new Set()
    for (const receipt of snapshot.receipts) {
      if (typeof receipt.requestId !== 'string' || typeof receipt.fingerprint !== 'string' || !plainObject(receipt.response) || requestIds.has(receipt.requestId)) {
        throw new Error('Snapshot receipts are invalid.')
      }
      requestIds.add(receipt.requestId)
    }
    const problem = buildNormalizedProblem(canonical)
    const checked = validateViewShape(problem, snapshot.view)
    if (!checked.ok) throw new Error(checked.error)
    if (phase === 'test' && canonical.commands.length) throw new Error('Test snapshots cannot contain presentation commands.')
    if (phase === 'test' && !isDefaultMathTestView(problem, checked.view)) {
      throw new Error('Test snapshots must use the default presentation.')
    }
    const attempts = snapshot.attempts.map((attempt) => restoreAttempt(problem, attempt, phase))
    const state = {
      protocolVersion: MATH_SESSION_PROTOCOL_VERSION,
      activityId,
      phase,
      revision: snapshot.revision,
      spec: canonical,
      view: checked.view,
      events: copy(snapshot.events),
      attempts,
      receipts: copy(snapshot.receipts),
      assisted: snapshot.assisted,
    }
    return { ok: true, state }
  } catch (error) {
    return failure('INVALID_SNAPSHOT', error.message)
  }
}

function safeMutation(run) {
  try { return run() }
  catch (error) {
    return failure('INVALID_REQUEST', error instanceof Error ? error.message : 'The mutation request is invalid.')
  }
}

export function applyMathSessionCommands(state, request) {
  return safeMutation(() => applyMathSessionCommandsInternal(state, request))
}

export function updateMathSessionView(state, nextView, request) {
  return safeMutation(() => updateMathSessionViewInternal(state, nextView, request))
}

export function recordMathSessionHelp(state, request) {
  return safeMutation(() => recordMathSessionHelpInternal(state, request))
}

export function submitMathSession(state, request) {
  return safeMutation(() => submitMathSessionInternal(state, request))
}
