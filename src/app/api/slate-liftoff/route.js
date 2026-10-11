import { NextResponse } from 'next/server'
import { AI_MODEL } from '@/app/lib/aiModel'
import { classifyConversationSafety, hardenInstructions, validateInput, validateOutput } from '@/lib/contentSafety'
import {
  LIFTOFF_ACTION_TYPES,
  LIFTOFF_DIAGNOSTIC_CATEGORIES,
  liftoffStateForModel,
  isLiftoffProblemFresh,
  normalizeLiftoffProblem,
  normalizeLiftoffAction,
  normalizeLiftoffComponentMap,
} from '@/app/lib/slateLiftoff.mjs'
import { verifySlateMathSubmission } from '@/app/lib/slateMath.mjs'
import {
  buildMathActivityProblem,
  createMathSession,
  normalizeMathActivity,
} from '@/lib/math/mathSession.mjs'
import { validateVerticalMathExercise } from '@/lib/math/verticalMathValidation.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const ACTIONS = new Set(LIFTOFF_ACTION_TYPES)
const DIAGNOSTICS = new Set(LIFTOFF_DIAGNOSTIC_CATEGORIES)
const PROBLEM_ACTIONS = new Set(['probe', 'reprobe', 'isolate', 'integrate'])

function clean(value, max = 12000) {
  return String(value || '').trim().slice(0, max)
}

function compactRows(value, limit = 8) {
  return (Array.isArray(value) ? value : []).slice(0, limit).map((row) => {
    if (typeof row === 'string') return clean(row, 500)
    if (!row || typeof row !== 'object') return row
    const out = {}
    for (const key of ['id', 'term', 'definition', 'question', 'prompt', 'answer', 'expected', 'expectedAny', 'choices', 'correct', 'text', 'title', 'description', 'objective']) {
      if (row[key] != null) out[key] = row[key]
    }
    return out
  })
}

function compactLesson(lesson = {}) {
  return {
    title: clean(lesson.title, 300),
    subject: clean(lesson.subject, 120),
    grade: clean(lesson.grade || lesson.gradeLevel, 80),
    difficulty: clean(lesson.difficulty, 80),
    blurb: clean(lesson.blurb || lesson.description, 1200),
    teachingNotes: clean(lesson.teachingNotes || lesson.teaching_notes, 5000),
    objectives: compactRows(lesson.objectives || lesson.learningObjectives || lesson.learning_objectives, 16),
    vocab: compactRows(lesson.vocab || lesson.vocabulary, 16),
    discussion: compactRows(lesson.discussion, 8),
    comprehension: compactRows(lesson.comprehension, 10),
    exercise: compactRows(lesson.exercise, 10),
    sample: compactRows(lesson.sample, 8),
    multiplechoice: compactRows(lesson.multiplechoice, 8),
    fillintheblank: compactRows(lesson.fillintheblank, 8),
  }
}

function parseJson(text) {
  const raw = clean(text, 30000)
  if (!raw) return null
  const unfenced = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  try { return JSON.parse(unfenced) } catch {}
  const first = unfenced.indexOf('{')
  const last = unfenced.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try { return JSON.parse(unfenced.slice(first, last + 1)) } catch {}
  }
  return null
}

function baseMethod() {
  return [
    'You are Mr. Slate, the Liftoff instructional teacher in Ms. Sonoma.',
    'Liftoff is model -> decompose -> probe -> diagnose -> adjust support -> probe again -> integrate -> release.',
    'The application, not you, owns session state and the final release gate.',
    'Never use a fixed repetition count. Every next probe must have a diagnostic reason.',
    'Treat supported correctness as supported evidence, never independent mastery.',
    'One correct answer is not automatically mastery and one error is not automatically ignorance.',
    'When possible, change one important uncertainty at a time so failure is interpretable.',
    'Respect dependencies: upstream errors can make downstream work look wrong.',
    'Support unrelated prerequisites when they are not the target, so prerequisite weakness does not masquerade as target failure.',
    'After failure, localize the problem, restore the minimum useful support, teach if needed, then re-probe on a genuinely different instance.',
    'Every learner problem must include a structured problem object with prompt and a deterministic instanceKey.',
    'The same underlying quantities and relationships must use the same instanceKey even if wording changes.',
    'For supported direct arithmetic, prefer a structured math object: problem:{prompt:"Add these numbers.",instanceKey:"addition:47:26",math:{operation:"addition",operands:["47","26"],commands:[]}}.',
    'The small math contract is exactly {operation, operands, commands}: operation is addition|subtraction|multiplication|division; operands are strings; commands is an array of {action,locations,editable?}, where action is hide|show|highlight|clear_highlight, locations is an array of named locations, and editable is an optional boolean.',
    'Bounds: addition uses 2..10 nonnegative decimal operands with at most 7 whole and 6 fractional digits each; subtraction uses exactly 2 such operands with the first at least the second; multiplication uses exactly 2 such operands with at most 7 whole and 6 fractional digits each; division uses exactly 2 integer operands, dividend >= 0 and divisor > 0, with at most 7 digits each.',
    'Answer targets are blank by default. Use result.* for the result digit row and remainder.* for the division remainder row. Decimal and operator targets are supported only for addition, subtraction, and multiplication. Do not invent pixel positions or any fields outside the contract.',
    'Commands are validated atomically as one final batch. Every math activity presented for a learner response must leave at least one valid editable target. Omit math for nonmath and unsupported fractions, negative numbers, or decimal division.',
    'Never compute the grid or answer, choose display pixels, or infer mastery from correctness alone. To expose part of a target, use a validated command batch such as show result.* followed by hide result.ones.',
    'Do not tell the learner that a problem is fresh, new, or different. Just present the problem.',
    'Vary nonessential surface features before release and test the integrated whole.',
    'Do not use speed or hesitation as proof of understanding.',
    'Stop probing once further evidence is unlikely to change the instructional decision.',
    'Tone: concise, direct, patient, calm, age-appropriate, never humiliating. Mr. Slate may be brisk but not harsh.',
    'Return JSON only. Do not wrap it in markdown.',
  ].join('\n')
}

function initializePrompt(lesson) {
  return `${baseMethod()}

TASK: Decompose this lesson into real knowledge/decision/procedure components that can transfer from teacher provision to learner responsibility. Do not invent fake steps merely to create a longer list. A conceptual lesson may have fewer components than a procedural math lesson. Dependencies must reference component ids.

Then begin instruction in learnerMessage: briefly model enough of the task that the learner has a fair basis. Do not put the first diagnostic problem inside learnerMessage. nextAction must describe the first probe and include its structured problem. The first probe must be genuinely different from the modeled example. Do not test an untaught component.

Return exactly this shape:
{
  "compatible": true,
  "compatibilityReason": "brief explanation",
  "componentMap": [
    {
      "id": "short-stable-id",
      "name": "learner-relevant component",
      "description": "what the learner must eventually do without content provision",
      "dependencies": [],
      "importance": 1,
      "essential": true
    }
  ],
  "modeledProblem": { "prompt": "the modeled example or context", "instanceKey": "deterministic key for its quantities and relationships" },
  "learnerMessage": "modeling or explanation only; do not include the diagnostic problem",
  "nextAction": {
    "type": "probe",
    "targetComponentIds": [],
    "withheldComponentIds": [],
    "supportedComponentIds": [],
    "problem": { "prompt": "the exact learner problem", "instanceKey": "deterministic key for the underlying instance" },
    "reason": "why this is the next useful move"
  }
}

Use compatible=false only when the supplied lesson does not contain enough substantive content to teach; do not reject a lesson merely because it is conceptual rather than procedural.

LESSON:
${JSON.stringify(compactLesson(lesson))}
`
}

function lineHelpPrompt({ lesson, sourceLine, action, learnerQuestion }) {
  const request = action === 'ask'
    ? `The learner asks about that line: ${JSON.stringify(clean(learnerQuestion, 1600))}`
    : 'The learner wants that exact line repeated or rephrased more simply.'
  return `You are Mr. Slate, the Liftoff instructional teacher in Ms. Sonoma.
Tone: concise, direct, patient, calm, age-appropriate, never humiliating. Mr. Slate may be brisk but not harsh.
The application owns lesson state, Liftoff evidence, progression, and assessment decisions.

TASK: Help the learner with one exact prior Mr. Slate transcript line. This is transcript help only, not a Liftoff instructional turn.

SELECTED MR. SLATE LINE:
${JSON.stringify(clean(sourceLine, 2400))}

REQUEST:
${request}

Rules:
- Do not diagnose mastery, update evidence, choose a next Liftoff move, advance the lesson, or create a new problem.
- For rephrase: preserve the same meaning and make the selected line easier to understand in 1-2 short spoken sentences.
- For a learner question: answer only what is needed to understand the selected line, using concise child-friendly language.
- If the selected line contains a question, problem, assessment item, or request for the learner to demonstrate knowledge, do not solve it, reveal its answer, or give a targeted hint that performs the learner's work. Clarify wording, terms, or what the question is asking without supplying the answer.
- Stay on the lesson topic and do not introduce unrelated material.
- Return plain spoken text only. No JSON, markdown, headings, or labels.

LESSON CONTEXT:
${JSON.stringify(compactLesson(lesson))}
`
}

function turnPrompt({ lesson, state, learnerResponse, mathEvidence = null }) {
  return `${baseMethod()}

TASK: Diagnose this learner response relative to the explicit Liftoff state. Decide what evidence, if any, the response provides about specific components. Then choose the smallest next teaching/probing move that is likely to change the instructional decision.

Important:
- A component observation may be "independent_success", "supported_success", "failure", or "possible_slip".
- independent=true only when the learner supplied the targeted content rather than copying or receiving it.
- varied=true only when the current instance meaningfully changes nonessential surface features from the modeled/familiar instance.
- integrated=true only when the component was demonstrated as part of coordinating the whole procedure or a meaningful multi-component chain.
- Do not report evidence for components the response did not actually expose.
- If failure is ambiguous because too many unsupported components were active, isolate rather than pretending to know the cause.
- If a prerequisite calculation fails but the target reasoning is intact, support the prerequisite and keep interrogating the target.
- "procedure_released" is only a request to the application. The application will reject release unless every essential component is independent and both integration and variation have been confirmed.
- For probe, reprobe, isolate, or integrate, nextAction must contain a problem object with prompt and deterministic instanceKey.
- The next problem must not repeat the current problem or any recentProblemHistory item. Same underlying quantities and relationships means the same instance even if reworded.
- learnerMessage contains feedback or teaching only. Do not include the next problem there and do not call anything fresh, new, or different.

Return exactly:
{
  "learnerMessage": "feedback or teaching only; do not include the next problem",
  "diagnosis": {
    "category": "success|selection_error|execution_error|sequencing_error|representation_error|retrieval_failure|integration_failure|transfer_failure|retention_failure|possible_slip|unknown",
    "componentId": "component id or empty",
    "evidence": "brief observable reason"
  },
  "observations": [
    {
      "componentId": "component id",
      "diagnostic": "one diagnostic category",
      "result": "independent_success|supported_success|failure|possible_slip",
      "independent": true,
      "varied": false,
      "integrated": false,
      "supportLevel": "none|cue|partial|full"
    }
  ],
  "integrationEvidence": false,
  "variationEvidence": false,
  "nextAction": {
    "type": "probe|isolate|teach|reprobe|integrate|release",
    "targetComponentIds": [],
    "withheldComponentIds": [],
    "supportedComponentIds": [],
    "problem": { "prompt": "exact next learner problem when this action asks for one", "instanceKey": "deterministic key for its underlying instance" },
    "reason": "why this next absence or restoration of help is useful"
  },
  "sessionDecision": "continue|procedure_released"
}

LESSON:
${JSON.stringify(compactLesson(lesson))}

CURRENT LIFTOFF STATE:
${JSON.stringify(liftoffStateForModel(state))}

LEARNER RESPONSE:
${JSON.stringify(clean(learnerResponse, 4000))}

${mathEvidence ? `AUTHORITATIVE STRUCTURED MATH OBSERVATION (application-verified; do not contradict it or invent a cause):\n${JSON.stringify(mathEvidence)}` : ''}
`
}

function capMathObservations(payload, evidence, state) {
  if (!evidence) return payload
  const targets = new Set(state?.currentAction?.targetComponentIds || [])
  payload.observations = payload.observations.map((row) => {
    if (targets.size && !targets.has(row.componentId)) return row
    if (!evidence.correct) return { ...row, result: 'failure', independent: false, supportLevel: row.supportLevel || 'none' }
    if (evidence.assisted) return { ...row, result: 'supported_success', independent: false, supportLevel: row.supportLevel === 'none' || !row.supportLevel ? 'partial' : row.supportLevel }
    return row
  })
  if (!evidence.correct || evidence.assisted) {
    payload.integrationEvidence = false
    payload.variationEvidence = false
    payload.sessionDecision = 'continue'
    if (payload.nextAction?.type === 'release') payload.nextAction.type = 'reprobe'
  }
  return payload
}

async function callModel(prompt) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 1800,
    }),
  })
  const raw = await response.text()
  let body
  try { body = JSON.parse(raw) } catch { body = null }
  if (!response.ok) {
    console.error('[Slate Liftoff] model request failed', response.status, raw.slice(0, 1000))
    return null
  }
  return body?.choices?.[0]?.message?.content || ''
}

function devInitialization(lesson) {
  const title = clean(lesson?.title, 200) || 'this lesson'
  return {
    compatible: true,
    compatibilityReason: 'Development fallback component map.',
    componentMap: [{
      id: 'core-skill',
      name: 'Core skill',
      description: clean(lesson?.blurb || lesson?.description || lesson?.teachingNotes, 500) || `Apply the central idea in ${title}.`,
      dependencies: [],
      importance: 5,
      essential: true,
    }],
    modeledProblem: { prompt: `Modeled example for ${title}.`, instanceKey: `dev-model:${title.toLowerCase()}` },
    learnerMessage: `We are going to take ${title} apart, learn what matters, and then remove help. Here is the core idea first.`,
    nextAction: { type: 'probe', targetComponentIds: ['core-skill'], withheldComponentIds: ['core-skill'], supportedComponentIds: [], problem: { prompt: 'Show me how you would apply the core idea to a different example.', instanceKey: 'dev-probe:core-skill:1' }, reason: 'Collect the first independent evidence after modeling the target.' },
  }
}

function devTurn(state) {
  const first = state?.components?.[0]?.id || 'core-skill'
  return {
    learnerMessage: 'Show me how you would do the next part on your own. Explain the choice you are making.',
    diagnosis: { category: 'unknown', componentId: first, evidence: 'Development fallback cannot diagnose learner work.' },
    observations: [],
    integrationEvidence: false,
    variationEvidence: false,
    nextAction: { type: 'probe', targetComponentIds: [first], withheldComponentIds: [first], supportedComponentIds: [], problem: { prompt: 'Apply the target to the next development example.', instanceKey: 'dev-probe:' + first + ':' + String(Number(state?.turnNumber || 0) + 2) }, reason: 'Collect independent evidence for the target.' },
    sessionDecision: 'continue',
  }
}

function validateTurnPayload(parsed, componentIds) {
  const validIds = new Set(componentIds)
  const diagnosis = parsed?.diagnosis && DIAGNOSTICS.has(parsed.diagnosis.category)
    ? {
        category: parsed.diagnosis.category,
        componentId: validIds.has(parsed.diagnosis.componentId) ? parsed.diagnosis.componentId : '',
        evidence: clean(parsed.diagnosis.evidence, 800),
      }
    : { category: 'unknown', componentId: '', evidence: '' }

  const observations = (Array.isArray(parsed?.observations) ? parsed.observations : [])
    .filter((row) => validIds.has(row?.componentId))
    .map((row) => ({
      componentId: row.componentId,
      diagnostic: DIAGNOSTICS.has(row?.diagnostic) ? row.diagnostic : diagnosis.category,
      result: ['independent_success', 'supported_success', 'failure', 'possible_slip'].includes(row?.result) ? row.result : 'failure',
      independent: row?.independent === true,
      varied: row?.varied === true,
      integrated: row?.integrated === true,
      supportLevel: ['none', 'cue', 'partial', 'full'].includes(row?.supportLevel) ? row.supportLevel : null,
    }))

  const nextAction = normalizeActionForValidation(parsed?.nextAction, componentIds)
  if (!ACTIONS.has(nextAction.type)) nextAction.type = 'probe'

  return {
    learnerMessage: clean(parsed?.learnerMessage, 5000),
    diagnosis,
    observations,
    integrationEvidence: parsed?.integrationEvidence === true,
    variationEvidence: parsed?.variationEvidence === true,
    nextAction,
    sessionDecision: parsed?.sessionDecision === 'procedure_released' ? 'procedure_released' : 'continue',
  }
}

function problemHistoryForState(state) {
  const history = (Array.isArray(state?.problemHistory) ? state.problemHistory : []).map(normalizeLiftoffProblem).filter(Boolean)
  const current = normalizeLiftoffProblem(state?.currentAction?.problem)
  if (current) history.push(current)
  return history
}

function mathValidationReason(error) {
  return clean(error instanceof Error ? error.message : error, 600) || 'The structured math activity is invalid.'
}

function validateLiftoffMathProblem(problem, { requireResponse = false } = {}) {
  if (!problem || typeof problem !== 'object' || Array.isArray(problem)) return { ok: true }
  if (problem.mathInvalid) return { ok: false, reason: `invalid_math:${mathValidationReason(problem.mathInvalid)}` }
  if (!Object.prototype.hasOwnProperty.call(problem, 'math')) return { ok: true }

  try {
    const math = normalizeMathActivity(problem.math)
    const created = createMathSession(math, { activityId: 'slate-payload-validation', phase: 'teaching' })
    if (!created.ok) return { ok: false, reason: `invalid_math:${mathValidationReason(created.error)}` }
    const presentation = validateVerticalMathExercise(buildMathActivityProblem(math), created.state.view)
    if (!presentation.ok) return { ok: false, reason: `invalid_math:${mathValidationReason(presentation.reason)}` }
    if (requireResponse && presentation.status === 'no_response') {
      return { ok: false, reason: 'math_requires_learner_response' }
    }
    return { ok: true, math }
  } catch (error) {
    return { ok: false, reason: `invalid_math:${mathValidationReason(error)}` }
  }
}

function normalizeProblemForValidation(rawProblem, { requireResponse = false } = {}) {
  const mathValidation = validateLiftoffMathProblem(rawProblem, { requireResponse })
  let problem
  try {
    problem = normalizeLiftoffProblem(rawProblem)
  } catch (error) {
    const withoutMath = rawProblem && typeof rawProblem === 'object' && !Array.isArray(rawProblem)
      ? Object.fromEntries(Object.entries(rawProblem).filter(([key]) => key !== 'math'))
      : rawProblem
    problem = normalizeLiftoffProblem(withoutMath)
    if (mathValidation.ok) return { problem, mathValidation: { ok: false, reason: `invalid_math:${mathValidationReason(error)}` } }
  }
  if (problem && !mathValidation.ok) problem.mathInvalid = mathValidation.reason
  if (problem && mathValidation.ok && mathValidation.math) problem.math = mathValidation.math
  return { problem, mathValidation }
}

function normalizeActionForValidation(rawAction, componentIds) {
  const normalizedProblem = normalizeProblemForValidation(rawAction?.problem, { requireResponse: true })
  const actionInput = rawAction && typeof rawAction === 'object'
    ? { ...rawAction, problem: normalizedProblem.problem }
    : rawAction
  const action = normalizeLiftoffAction(actionInput, componentIds)
  if (action.problem && !normalizedProblem.mathValidation.ok) action.problem.mathInvalid = normalizedProblem.mathValidation.reason
  return action
}

function validateProblemActionFreshness(action, priorProblems = []) {
  const mathValidation = validateLiftoffMathProblem(action?.problem, { requireResponse: true })
  if (!mathValidation.ok) return mathValidation
  if (!PROBLEM_ACTIONS.has(action?.type)) return { ok: true }
  const { problem } = normalizeProblemForValidation(action?.problem, { requireResponse: true })
  if (!problem?.prompt || !problem?.instanceKey) return { ok: false, reason: 'missing_problem_identity' }
  if (!isLiftoffProblemFresh(problem, priorProblems)) return { ok: false, reason: 'repeated_problem' }
  return { ok: true, problem }
}

function validateInitializationProblems(modeledProblem, action) {
  const normalizedModeled = normalizeProblemForValidation(modeledProblem)
  const modeled = normalizedModeled.problem
  if (!modeled?.prompt || !modeled?.instanceKey) return { ok: false, reason: 'missing_modeled_problem', priorProblems: [] }
  if (!normalizedModeled.mathValidation.ok) return { ok: false, reason: normalizedModeled.mathValidation.reason, priorProblems: [] }
  const validation = validateProblemActionFreshness(action, [modeled])
  return { ...validation, modeledProblem: modeled, priorProblems: [modeled] }
}
function composeLearnerMessage(message, action) {
  const base = clean(message, 5000)
  if (!PROBLEM_ACTIONS.has(action?.type) || !action?.problem?.prompt) return base
  const prompt = clean(action.problem.prompt, 1200)
  if (!prompt) return base
  if (base.toLowerCase().includes(prompt.toLowerCase())) return base
  return [base, prompt].filter(Boolean).join('\n\n')
}

async function parseSafeModelResponse(modelText) {
  if (!modelText) return { error: 'unavailable' }
  const output = await validateOutput(modelText, process.env.OPENAI_API_KEY, true)
  if (!output.safe) return { error: 'unsafe' }
  const parsed = parseJson(modelText)
  return parsed ? { parsed } : { error: 'invalid_json' }
}

async function retryForDifferentProblem(basePrompt, priorProblems, reason) {
  const used = priorProblems.slice(-12).map((problem) => ({ prompt: problem.prompt, instanceKey: problem.instanceKey }))
  const correction = `${basePrompt}\n\nAPPLICATION VALIDATION REJECTED YOUR LAST NEXT PROBLEM: ${reason}. Generate the JSON again. The next learner problem must be genuinely different from every used problem below. Rewording the same quantities or relationships is still the same problem. Use the same deterministic instanceKey for the same underlying instance; never invent a nonce. Do not call the problem fresh/new/different in learnerMessage.\nUSED PROBLEMS:\n${JSON.stringify(used)}`
  return callModel(correction)
}
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)
    const requestedMode = clean(body?.mode, 40)
    const mode = requestedMode === 'turn' ? 'turn' : (requestedMode === 'line_help' ? 'line_help' : 'initialize')
    const lesson = body?.lesson
    if (!lesson || typeof lesson !== 'object') {
      return NextResponse.json({ error: 'Lesson data is required.' }, { status: 400 })
    }

    if (mode === 'line_help') {
      if (body?.phase === 'test') return NextResponse.json({ error: 'Line help is unavailable during an independent test.' }, { status: 400 })
      const sourceLine = clean(body?.sourceLine, 2400)
      const action = body?.action === 'ask' ? 'ask' : 'rephrase'
      const learnerQuestion = clean(body?.learnerQuestion, 1600)
      if (!sourceLine) return NextResponse.json({ error: 'A transcript line is required.' }, { status: 400 })
      if (action === 'ask' && !learnerQuestion) return NextResponse.json({ error: 'A learner question is required.' }, { status: 400 })
      if (learnerQuestion) {
        const input = validateInput(learnerQuestion, 'general')
        if (!input.safe) return NextResponse.json({ error: 'That question could not be used.' }, { status: 400 })
      }
      const safety = classifyConversationSafety(learnerQuestion || sourceLine, { educational: true }).classification
      const rawPrompt = lineHelpPrompt({ lesson, sourceLine, action, learnerQuestion })
      const prompt = hardenInstructions(rawPrompt, clean(lesson.title || lesson.subject, 200) || 'educational content', [], safety)
      let reply = await callModel(prompt)
      if (!reply && process.env.NODE_ENV !== 'production') reply = action === 'rephrase' ? sourceLine : 'I can help explain what that line means without doing the problem for you.'
      if (!reply) return NextResponse.json({ error: 'Mr. Slate is unavailable.' }, { status: 503 })
      const output = await validateOutput(reply, process.env.OPENAI_API_KEY, true)
      if (!output.safe) return NextResponse.json({ error: 'Mr. Slate could not produce a safe response.' }, { status: 502 })
      return NextResponse.json({ ok: true, mode, reply: clean(reply, 2400) })
    }

    const learnerText = clean(body?.learnerResponse, 4000)
    let learnerResponse = learnerText
    let verifiedMath = null
    if (mode === 'turn') {
      if (!body?.state || typeof body.state !== 'object') {
        return NextResponse.json({ error: 'Liftoff state is required.' }, { status: 400 })
      }
      const currentProblem = body.state?.currentAction?.problem
      if (currentProblem?.math) {
        verifiedMath = verifySlateMathSubmission({ problem: currentProblem, snapshot: body?.mathSession, submission: body?.mathSubmission })
        if (!verifiedMath.ok) {
          const conflict = ['ACTIVITY_MISMATCH', 'STALE_SUBMISSION', 'SUBMISSION_MISMATCH'].includes(verifiedMath.code)
          return NextResponse.json({ error: verifiedMath.error, code: verifiedMath.code }, { status: conflict ? 409 : 400 })
        }
        learnerResponse = learnerText
          ? `${verifiedMath.responseText}\nLearner note: ${learnerText}`
          : verifiedMath.responseText
      }
      if (!learnerResponse) {
        return NextResponse.json({ error: 'A learner response is required.' }, { status: 400 })
      }
      const input = validateInput(learnerText || learnerResponse, 'general')
      if (!input.safe) return NextResponse.json({ error: 'That response could not be used.' }, { status: 400 })
    }

    const rawPrompt = mode === 'initialize'
      ? initializePrompt(lesson)
      : turnPrompt({ lesson, state: body.state, learnerResponse, mathEvidence: verifiedMath?.evidence || null })
    const safety = classifyConversationSafety(learnerResponse, { educational: true }).classification
    const prompt = hardenInstructions(rawPrompt, clean(lesson.title || lesson.subject, 200) || 'educational content', [], safety)
    let modelText = await callModel(prompt)

    if (!modelText && process.env.NODE_ENV !== 'production') {
      const fallback = mode === 'initialize' ? devInitialization(lesson) : devTurn(body.state)
      if (mode === 'initialize') {
        const componentMap = normalizeLiftoffComponentMap(fallback.componentMap)
        const nextAction = normalizeActionForValidation(fallback.nextAction, componentMap.map((component) => component.id))
        const validation = validateInitializationProblems(fallback.modeledProblem, nextAction)
        if (!validation.ok) return NextResponse.json({ error: 'Development Liftoff fallback did not produce a different problem.' }, { status: 500 })
        return NextResponse.json({
          ok: true,
          mode,
          compatible: fallback.compatible !== false,
          compatibilityReason: clean(fallback.compatibilityReason, 1000),
          componentMap,
          modeledProblem: validation.modeledProblem,
          learnerMessage: composeLearnerMessage(fallback.learnerMessage, nextAction),
          nextAction,
          provider: 'dev-fallback',
        })
      }
      const componentIds = (body.state?.components || []).map((component) => component.id).filter(Boolean)
      const payload = capMathObservations(validateTurnPayload(fallback, componentIds), verifiedMath?.evidence, body.state)
      const validation = validateProblemActionFreshness(payload.nextAction, problemHistoryForState(body.state))
      if (!validation.ok) return NextResponse.json({ error: 'Development Liftoff fallback repeated a problem.' }, { status: 500 })
      payload.learnerMessage = composeLearnerMessage(payload.learnerMessage, payload.nextAction)
      return NextResponse.json({ ok: true, mode, ...payload, ...(verifiedMath ? { mathReceipt: { activityId: verifiedMath.evidence.activityId, requestId: verifiedMath.evidence.requestId, submittedRevision: verifiedMath.evidence.submittedRevision } } : {}), provider: 'dev-fallback' })
    }
    if (!modelText) return NextResponse.json({ error: 'Mr. Slate is unavailable.' }, { status: 503 })

    let modelResult = await parseSafeModelResponse(modelText)
    if (modelResult.error === 'unsafe') return NextResponse.json({ error: 'Mr. Slate could not produce a safe response.' }, { status: 502 })
    if (modelResult.error) return NextResponse.json({ error: 'Mr. Slate returned an invalid instructional response.' }, { status: 502 })
    let parsed = modelResult.parsed

    if (mode === 'initialize') {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const componentMap = normalizeLiftoffComponentMap(parsed.componentMap)
        if (!componentMap.length) {
          return NextResponse.json({ error: 'Mr. Slate could not identify a teachable component map.' }, { status: 422 })
        }
        const nextAction = normalizeActionForValidation(parsed.nextAction, componentMap.map((component) => component.id))
        const validation = validateInitializationProblems(parsed.modeledProblem, nextAction)
        if (validation.ok) {
          return NextResponse.json({
            ok: true,
            mode,
            compatible: parsed.compatible !== false,
            compatibilityReason: clean(parsed.compatibilityReason, 1000),
            componentMap,
            modeledProblem: validation.modeledProblem,
            learnerMessage: composeLearnerMessage(parsed.learnerMessage, nextAction),
            nextAction,
          })
        }
        if (attempt >= 2) break
        modelText = await retryForDifferentProblem(prompt, validation.priorProblems || [], validation.reason)
        modelResult = await parseSafeModelResponse(modelText)
        if (modelResult.error) break
        parsed = modelResult.parsed
      }
      return NextResponse.json({ error: 'Mr. Slate could not generate a genuinely different diagnostic problem.' }, { status: 502 })
    }

    const componentIds = (body.state?.components || []).map((component) => component.id).filter(Boolean)
    const priorProblems = problemHistoryForState(body.state)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const payload = capMathObservations(validateTurnPayload(parsed, componentIds), verifiedMath?.evidence, body.state)
      const validation = validateProblemActionFreshness(payload.nextAction, priorProblems)
      if (validation.ok) {
        payload.learnerMessage = composeLearnerMessage(payload.learnerMessage, payload.nextAction)
        return NextResponse.json({ ok: true, mode, ...payload, ...(verifiedMath ? { mathReceipt: { activityId: verifiedMath.evidence.activityId, requestId: verifiedMath.evidence.requestId, submittedRevision: verifiedMath.evidence.submittedRevision } } : {}) })
      }
      if (attempt >= 2) break
      modelText = await retryForDifferentProblem(prompt, priorProblems, validation.reason)
      modelResult = await parseSafeModelResponse(modelText)
      if (modelResult.error) break
      parsed = modelResult.parsed
    }
    return NextResponse.json({ error: 'Mr. Slate could not generate a genuinely different diagnostic problem.' }, { status: 502 })
  } catch (error) {
    console.error('[Slate Liftoff] unexpected error', error)
    return NextResponse.json({ error: 'Mr. Slate is unavailable.' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'slate-liftoff' })
}
