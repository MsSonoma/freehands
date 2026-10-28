/**
 * /api/webb-objectives
 *
 * Mrs. Webb objectives are the authoritative essay-body blueprint. Each mastered objective
 * yields one learner-authored note and one learner-authored body sentence in the same order.
 * Topic and conclusion sentences are additional composition structure, not mastery targets.
 */
import { NextResponse } from 'next/server.js'
import { buildInstructionalLessonView } from '../../lib/masteryEvidence/assessmentIsolation.js'
import { evaluateWebbObjectives } from '../../lib/webbObjectiveEvaluation.mjs'
import {
  assembleWebbCompositionEssay,
  buildWebbCompositionPlan,
  normalizeAcceptedCompositionSentences,
  normalizeWebbCompositionPlan,
  writingSentenceSimilarity,
} from '../../lib/webbCompositionModel.mjs'
import {
  cluesFromWebbBlueprint,
  normalizeWebbCompositionBlueprint,
  objectivesFromWebbBlueprint,
  webbCompositionBlueprintViolations,
} from '../../lib/webbCompositionBlueprint.mjs'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
import { AI_MODEL, aiModelTemperature } from '../../lib/aiModel.js'
const OPENAI_MODEL = AI_MODEL

// Allow objective generation and its validation repair time to finish.
export const maxDuration = 60

async function callGPT(apiKey, system, user, maxTokens = 500, temperature = 0.3, responseFormat = null) {
  const isLuna = /^gpt-5\.6-luna$/i.test(OPENAI_MODEL)
  // Avoid a guaranteed second full model request after an undersized Luna attempt.
  const tokenLimits = [isLuna ? Math.max(maxTokens * 3, 2400) : maxTokens]
  for (const tokenLimit of tokenLimits) {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_completion_tokens: tokenLimit,
        ...aiModelTemperature(temperature, OPENAI_MODEL),
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    })
    if (!res.ok) throw new Error('Learning evaluator unavailable (' + res.status + ')')
    const json = await res.json()
    const choice = json.choices?.[0]
    if (choice?.finish_reason !== 'length' && choice?.message?.content?.trim()) {
      return choice.message.content.trim()
    }
  }
  throw new Error('Learning evaluator returned an incomplete response')
}

function isSafeObjectiveClue(value) {
  const clue = String(value || '').trim()
  const words = clue.split(/\s+/).filter(Boolean)
  if (!clue || words.length > 6 || clue.length > 80) return false
  if (/[.!?]/.test(clue)) return false
  if (/^(?:the learner|explain|describe|identify|compare|state|name|summarize|how|why|what|when|where|who)\b/i.test(clue)) return false
  if (/\b(?:is|are|was|were|because|therefore|thus|caused|led|resulted|became|meant|made|allowed|prevented|showed|proved)\b/i.test(clue)) return false
  return true
}

function parseGeneratedBlueprint(raw) {
  let parsed
  try { parsed = JSON.parse(String(raw || '')) } catch { throw new Error('Blueprint planner returned invalid JSON') }
  const sourceUnits = Array.isArray(parsed?.body_units)
    ? parsed.body_units
    : (Array.isArray(parsed?.bodyUnits) ? parsed.bodyUnits : [])
  const blueprint = normalizeWebbCompositionBlueprint({
    controllingIdea: parsed?.controlling_idea ?? parsed?.controllingIdea,
    discourseMode: parsed?.discourse_mode ?? parsed?.discourseMode,
    closingGoal: parsed?.closing_goal ?? parsed?.closingGoal,
    bodyUnits: sourceUnits.map((row, index) => ({
      id: row?.id || `body-${index + 1}`,
      objective: row?.objective,
      clue: row?.atomic_focus ?? row?.clue,
      rhetoricalJob: row?.rhetorical_job ?? row?.rhetoricalJob,
      connection: row?.connection_from_previous ?? row?.connection,
    })),
  })
  const violations = webbCompositionBlueprintViolations(blueprint)
  if (violations.length) throw new Error('Blueprint planner returned an invalid structure: ' + violations.join('; '))
  for (const unit of blueprint.bodyUnits) {
    if (!isSafeObjectiveClue(unit.clue)) throw new Error('Blueprint planner returned an unsafe retrieval clue')
  }
  if (new Set(blueprint.bodyUnits.map(unit => unit.objective.toLocaleLowerCase())).size !== blueprint.bodyUnits.length) {
    throw new Error('Blueprint planner returned duplicate objectives')
  }
  return blueprint
}

function objectivePlanViolations(rows) {
  const violations = []
  rows.forEach((row, index) => {
    const objective = String(row?.objective || '')
    const asksTwoQuestionTypes = /\b(?:who|what|why|how|when|where)\b[\s\S]{0,220}\band\s+(?:who|what|why|how|when|where)\b/i.test(objective)
    const joinsSecondTask = /\b(?:explain|describe|identify|compare|show|state|name|summarize)\b[\s\S]{0,260}\band\s+(?:identify|explain|describe|compare|show|state|name|summarize)\b/i.test(objective)
    if (asksTwoQuestionTypes || joinsSecondTask) violations.push(`row ${index + 1} combines more than one independently gradable task`)
  })
  return [...new Set(violations)]
}

async function generateObjectives(apiKey, lesson, callModel = null) {
  const title = lesson?.title || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade = lesson?.grade ? `Grade ${lesson.grade}` : 'elementary'
  const allQ = [
    ...(lesson.sample || []).map(q => q.question),
    ...(lesson.truefalse || []).map(q => q.question),
    ...(lesson.multiplechoice || []).map(q => q.question),
    ...(lesson.fillintheblank || []).map(q => q.question),
    ...(lesson.shortanswer || []).map(q => q.question),
    ...(lesson.questions || []).map(q => typeof q === 'string' ? q : q.question),
  ].filter(Boolean).slice(0, 60)

  const system = [
    "You are a curriculum designer creating the mastery map for a learner-led Mrs. Webb lesson.",
    "First design one coherent private composition blueprint ABOUT what this lesson teaches. Choose the discourse pattern that fits the content, such as explanation, chronology, cause and effect, compare and contrast, process, literary response, report, or argument. This blueprint is instructional architecture only and is never shown to the learner as prose.",
    "Current Mrs. Webb always writes from mastered lesson notes. She does not switch into a separate composition assignment that requires a new topic, opinion, story, example, or other content that was not learned and saved during research.",
    "If the source lesson asks the learner to produce a different kind of writing, such as an opinion paragraph or narrative, observe the knowledge and skill the lesson teaches and make the hidden essay ABOUT that learned material. For example, a lesson about opinion paragraphs can produce an essay explaining how opinion paragraphs work. Do not invent an unrelated opinion for the learner to write.",
    "Then derive 5 to 8 ATOMIC core comprehension objectives from that blueprint. Each objective must represent exactly one sentence-worth of essential BODY content and must assess ONE central idea, relationship, process, or skill only.",
    "The returned objective order is authoritative for later writing. The learner will earn exactly one learner-authored note for each objective and later turn exactly that note into exactly one BODY sentence in the same order. A separate topic sentence and a separate concluding sentence will be added around those body sentences. The later planner will not merge, omit, reorder, or invent objective content.",
    "Objective 1 is the first substantive body idea after the separate topic sentence. It must contribute learned content rather than merely announce what the paragraph will discuss.",
    "Every later objective must intentionally advance the essay body from the objectives before it. Put prerequisites before dependent ideas, causes before consequences, events in meaningful chronology when chronology matters, supporting evidence before interpretation, and explanation before significance. Avoid conceptual ricochet.",
    "The final objective is the final substantive body idea before the separate conclusion. It must contribute learned content that can support the paragraph's ending, but it must not be reduced to a conclusion or summary sentence.",
    "Topic and conclusion are composition structure, not mastery objectives. Do not sacrifice the first or final content objective to make either structural sentence.",
    "An objective may describe one relationship involving multiple things, but it must never require two independently gradable answers. Do not combine identification plus explanation, definition plus cause, cause plus effect, fact plus example, or two separate functions.",
    "Each objective should be answerable by one focused comprehension question. Before returning a row containing \"and\", self-check whether the words after \"and\" create a second question, second verb task, or separately gradable fact. If they do, split, reorder, or omit the lower-priority idea.",
    "When the lesson itself teaches writing skills, those skills are legitimate lesson content. Objectives may explain what a claim, reason, supporting detail, transition, conclusion, revision step, or other writing concept does. The later Mrs. Webb essay will explain that learned content; it will not become a separate example essay unless a future writing mode explicitly supports that.",
    "Keep objective text content-focused and student-facing, normally as \"The learner can explain...\", \"The learner can describe...\", \"The learner can compare...\", or \"The learner understands...\". Do not put later writing instructions inside the objective text.",
    "For each row, atomic_focus is also the learner-facing retrieval clue. It must be a short 2 to 6 word concept label, not a sentence and not a proposition that can be lightly rewritten into the answer.",
    "A retrieval clue may name the territory (for example, a person, event, process, theme, category, or broad concept), but it must not state the tested relationship, cause, effect, definition, comparison result, sequence result, or other answer-bearing predicate.",
    "For every body unit, rhetorical_job must state what that idea contributes to the whole composition, and connection_from_previous must state WHY this unit follows what came before. Mere ordering language such as next objective, next goal, or continues the essay is invalid.",
    "Return the blueprint itself. controlling_idea is the coherent proposition or explanation the whole composition develops. discourse_mode names the organizational pattern. closing_goal states what the conclusion should synthesize without supplying learner prose.",
    "Return only valid JSON in this exact shape: {\"controlling_idea\":\"...\",\"discourse_mode\":\"explanation\",\"closing_goal\":\"...\",\"body_units\":[{\"id\":\"body-1\",\"atomic_focus\":\"short retrieval clue\",\"objective\":\"The learner can explain...\",\"rhetorical_job\":\"...\",\"connection_from_previous\":\"...\"}]}.",
  ].join(' ')
  const user = `Lesson: "${title}" - ${subject}, ${grade}.\n\nAssessment questions:\n${allQ.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
  const invoke = callModel || ((systemPrompt, userPrompt, maxTokens, temperature, responseFormat) => callGPT(apiKey, systemPrompt, userPrompt, maxTokens, temperature, responseFormat))
  const responseFormat = { type: 'json_object' }
  const validate = (candidate) => {
    try {
      const plan = parseGeneratedBlueprint(candidate)
      const violations = objectivePlanViolations(plan.bodyUnits)
      return violations.length ? { ok: false, plan, violations } : { ok: true, plan, violations: [] }
    } catch (error) {
      return { ok: false, plan: null, violations: [String(error?.message || 'Blueprint planner output was invalid')] }
    }
  }

  let raw = await invoke(system, user, 900, 0.15, responseFormat)
  let validation = validate(raw)
  if (!validation.ok) {
    const repairSystem = [
      system,
      `You are repairing a draft that failed the atomic mastery-objective validator. Return the COMPLETE corrected composition blueprint, not commentary.`,
      `The draft may have malformed JSON, the wrong number of body units, duplicate objectives, non-atomic objectives, or broken rhetorical relationships.`,
      `Do not preserve a bad row merely because its facts are true. One row must equal one independently gradable comprehension target.`,
    ].join(' ')
    raw = await invoke(repairSystem, JSON.stringify({ lesson: { title, subject, grade }, assessment_questions: allQ, raw_draft: raw, draft_plan: validation.plan, validator_violations: validation.violations }), 900, 0.05, responseFormat)
    validation = validate(raw)
  }
  if (!validation.ok) {
    raw = await invoke(`${system} Previous attempts failed deterministic validation. Start over and return one fresh complete composition blueprint.`, user, 900, 0.05, responseFormat)
    validation = validate(raw)
  }
  if (!validation.ok) throw new Error(`Blueprint planner remained invalid after recovery: ${validation.violations.join('; ')}`)
  return validation.plan
}

function fallbackObjectiveClues(objectives = []) {
  return objectives.map((_, index) => `Goal ${index + 1}`)
}

async function generateObjectiveClues(apiKey, lesson, objectives, callModel = null) {
  const cleanObjectives = (Array.isArray(objectives) ? objectives : [])
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .slice(0, 8)
  if (!cleanObjectives.length) return []

  const system = [
    "Translate hidden mastery objectives into learner-facing retrieval clues.",
    "Each clue must be a short 2 to 6 word concept label, not a sentence.",
    "The clue may name the territory but must not state the proposition being tested.",
    "Do not preserve a subject-plus-predicate relationship, cause plus effect, definition, comparison result, sequence result, or wording that can simply be paraphrased into a passing answer.",
    "Examples: an objective about why colonists resisted taxation may become \"Colonial taxation\"; an objective about how evaporation changes liquid water may become \"Changes of state\".",
    "Return exactly one clue for each objective, in the same order.",
    "Return only valid JSON in this shape: {\"clues\":[\"short clue\"]}.",
  ].join(' ')
  const user = JSON.stringify({
    lesson: {
      title: lesson?.title || '',
      subject: lesson?.subject || '',
      grade: lesson?.grade || '',
    },
    hidden_objectives: cleanObjectives,
  })
  const invoke = callModel || ((systemPrompt, userPrompt, maxTokens, temperature, responseFormat) => callGPT(apiKey, systemPrompt, userPrompt, maxTokens, temperature, responseFormat))
  try {
    const raw = await invoke(system, user, 300, 0.1, { type: 'json_object' })
    const parsed = JSON.parse(String(raw || ''))
    const clues = Array.isArray(parsed?.clues)
      ? parsed.clues.map(value => String(value || '').trim().slice(0, 100))
      : []
    if (clues.length !== cleanObjectives.length || clues.some(value => !isSafeObjectiveClue(value))) return fallbackObjectiveClues(cleanObjectives)
    return clues
  } catch {
    return fallbackObjectiveClues(cleanObjectives)
  }
}

function generateCompositionPlan(_apiKey, _lesson, objectives, learnerNotes, blueprint = null, _callModel = null) {
  return buildWebbCompositionPlan(objectives, learnerNotes, blueprint)
}
async function validateLearnerNotes(apiKey, { objectives = [], learnerNotes = {}, blueprint = null }, callModel = null) {
  const rows = (Array.isArray(objectives) ? objectives : [])
    .map((objective, objectiveIndex) => {
      const note = learnerNotes?.[objectiveIndex]
      const text = note?.provenance === 'learner-message' ? String(note?.text || '').trim() : ''
      if (!text) return null
      return {
        objectiveIndex,
        objective: String(objective || '').trim(),
        bodyUnit: blueprint?.bodyUnits?.[objectiveIndex] || null,
        learnerNote: text,
      }
    })
    .filter(Boolean)
  if (!rows.length) return { evaluations: [], readyIndices: [], invalidIndices: [] }

  const system = [
    'Judge whether each exact learner-authored note is usable later as a standalone writing note. This is NOT a mastery re-grade.',
    'A note is ready only when its own words, without relying on the earlier question or conversation, express the central proposition the assigned objective/body unit needs to explain.',
    'A context-dependent example can have demonstrated understanding while still being NOT ready as a standalone note. For example, a paraphrased fact does not by itself explain what paraphrasing is, and an example detail does not by itself explain how to decide whether evidence is relevant.',
    'Do not demand polished grammar or adult wording. A short child-written statement is ready when the needed idea is actually present.',
    'Do not rewrite or repair any note.',
    'Return only JSON: {"evaluations":[{"objectiveIndex":0,"noteReady":true}]}. Include every supplied row exactly once.',
  ].join(' ')
  const invoke = callModel || ((systemPrompt, userPrompt, maxTokens, temperature, responseFormat) => callGPT(apiKey, systemPrompt, userPrompt, maxTokens, temperature, responseFormat))
  const raw = await invoke(system, JSON.stringify({ notes: rows }), 500, 0, { type: 'json_object' })
  let parsed
  try { parsed = JSON.parse(String(raw || '')) } catch { throw new Error('Note readiness evaluator returned invalid JSON') }
  const evaluations = Array.isArray(parsed?.evaluations) ? parsed.evaluations : []
  if (evaluations.length !== rows.length) throw new Error('Note readiness evaluator returned an incomplete result')
  const allowed = new Set(rows.map(row => row.objectiveIndex))
  const seen = new Set()
  const normalized = evaluations.map(row => {
    if (!Number.isInteger(row?.objectiveIndex) || !allowed.has(row.objectiveIndex) || seen.has(row.objectiveIndex) || typeof row.noteReady !== 'boolean') {
      throw new Error('Note readiness evaluator returned an invalid result')
    }
    seen.add(row.objectiveIndex)
    return { objectiveIndex: row.objectiveIndex, noteReady: row.noteReady }
  })
  return {
    evaluations: normalized,
    readyIndices: normalized.filter(row => row.noteReady).map(row => row.objectiveIndex),
    invalidIndices: normalized.filter(row => !row.noteReady).map(row => row.objectiveIndex),
  }
}

function hasIncompatibleEssayPositionCue(text, role) {
  const value = String(text || '').trim().toLowerCase()
  if (role === 'topic') return /^(?:finally|lastly|in conclusion|to conclude|ultimately|overall)\b/.test(value)
  if (role === 'conclusion') return /^(?:first|firstly|to begin|to start|at first|next|then)\b/.test(value)
  return false
}

function deterministicDuplicate(text, priorSentences = []) {
  const candidate = String(text || '').trim()
  for (let index = 0; index < priorSentences.length; index += 1) {
    const prior = String(priorSentences[index] || '').trim()
    if (!prior) continue
    const exact = candidate.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '') === prior.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
    const similarity = writingSentenceSimilarity(candidate, prior)
    if (exact || (similarity >= 0.72 && candidate.split(/\s+/).length >= 5 && prior.split(/\s+/).length >= 5)) return { index, similarity: exact ? 1 : similarity }
  }
  return null
}

function hasMultipleWritingSentences(text) {
  const value = String(text || '').trim()
  if (!value) return false
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    return [...segmenter.segment(value)].map(part => String(part.segment || '').trim()).filter(Boolean).length > 1
  } catch {
    return /[.!?]["']?\s+[A-Z0-9]/.test(value)
  }
}
async function checkWriting(apiKey, input, callModel = null) {
  const slot = input?.slot && typeof input.slot === 'object' ? input.slot : {}
  const role = ['topic', 'body', 'conclusion'].includes(String(slot.role || '').toLowerCase()) ? String(slot.role).toLowerCase() : 'body'
  const priorSentences = Array.isArray(input?.priorSentences) ? input.priorSentences.map(value => String(value || '').trim()).filter(Boolean) : []
  const duplicate = role === 'body' ? deterministicDuplicate(input?.text, priorSentences) : null
  const system = [
    "You evaluate exactly one learner-authored essay sentence for its role in this paragraph. Judge five facts independently.",
    "(1) CONCEPT_FIT: correct, partial, or incorrect. For a body sentence, the assigned body-unit focus/objective defines the idea this sentence must express; the learner-authored research note is evidence and a wording source, not a replacement objective. The sentence must accurately express the body-unit idea while remaining supported by that learner note. For a topic sentence, judge whether it accurately introduces the overall subject and big idea of the lesson/paragraph; it does not need to restate the first research note. For a conclusion, judge whether it accurately closes or synthesizes the ideas already developed in the accepted paragraph; it does not need to restate the final research note and must not add a new unsupported fact.",
    "(2) SENTENCE_OK: yes only when the learner submitted exactly one complete coherent sentence usable verbatim. Two or more sentences must be no.",
    "(3) SLOT_FIT: yes only when the sentence performs its exact rhetorical role. A topic sentence should tell the reader what the paragraph will be about. A body sentence must develop its assigned research note. A conclusion should bring the paragraph's established ideas to a clear ending without starting a new topic.",
    "(4) ADDS_NEW_INFORMATION: for a body slot, yes only when it advances the paragraph instead of restating an accepted sentence. For a topic or conclusion, framing or synthesis is allowed and does not need to add a new fact.",
    "(5) PARAGRAPH_FIT: yes only when accepting it makes the paragraph more coherent overall rather than causing a topic jump, contradiction, orphaned example, or unnecessary repetition.",
    "A simple child-written sentence can be excellent. Do not require a transition word, sophisticated style, or adult-level polish.",
    "Never reward a sentence merely because it is a good example of the writing skill being studied. Judge whether it belongs in THIS essay and performs THIS role.",
    "Research notes are learner-authored evidence for body sentences, not wording to copy and not permission to change the planned body-unit idea. Never rewrite, correct, complete, or suggest wording.",
    "Reply exactly CONCEPT_FIT|SENTENCE_OK|SLOT_FIT|ADDS_NEW_INFORMATION|PARAGRAPH_FIT where CONCEPT_FIT is correct, partial, or incorrect and all other fields are yes or no.",
  ].join(' ')
  const user = JSON.stringify({
    instructional_context: input?.lesson || {},
    controlling_idea: String(input?.controllingIdea || ''),
    slot: { id: slot.id || null, role, focus: slot.focus || '', rhetoricalJob: slot.rhetoricalJob || '', connection: slot.connection || '', sourceObjectiveIndices: slot.sourceObjectiveIndices || [] },
    source_objectives: role === 'body' && Array.isArray(input?.sourceObjectives) ? input.sourceObjectives : [],
    learner_research_notes: role === 'body' && Array.isArray(input?.sourceNotes) ? input.sourceNotes : [],
    prior_accepted_learner_sentences: priorSentences,
    learner_proposed_sentence: String(input?.text || ''),
  })
  const invoke = callModel || ((systemPrompt, userPrompt, maxTokens, temperature) => callGPT(apiKey, systemPrompt, userPrompt, maxTokens, temperature))
  const raw = await invoke(system, user, 40, 0)
  const [conceptRaw, sentenceRaw, slotRaw, addsRaw, paragraphRaw] = String(raw || '').split('|')
  const accuracy = String(conceptRaw || '').trim().toLowerCase()
  const sentence = String(sentenceRaw || '').trim().toLowerCase()
  const slotFitRaw = String(slotRaw || '').trim().toLowerCase()
  const addsRawValue = String(addsRaw || '').trim().toLowerCase()
  const paragraphRawValue = String(paragraphRaw || '').trim().toLowerCase()
  if (!['correct', 'partial', 'incorrect'].includes(accuracy)
    || !['yes', 'no'].includes(sentence)
    || !['yes', 'no'].includes(slotFitRaw)
    || !['yes', 'no'].includes(addsRawValue)
    || !['yes', 'no'].includes(paragraphRawValue)) throw new Error('Writing evaluator returned an invalid result')
  const sentenceOk = sentence === 'yes' && !hasMultipleWritingSentences(input?.text)
  const slotFit = slotFitRaw === 'yes' && !hasIncompatibleEssayPositionCue(input?.text, role)
  const addsNewInformation = addsRawValue === 'yes' && !duplicate
  const paragraphFit = paragraphRawValue === 'yes'
  const positionFit = slotFit && (role === 'body' ? addsNewInformation : true) && paragraphFit
  return {
    accuracy,
    conceptFit: accuracy,
    sentenceOk,
    slotFit,
    addsNewInformation,
    paragraphFit,
    positionFit,
    duplicateOfIndex: duplicate?.index ?? null,
  }
}

async function checkParagraph(apiKey, { lesson, compositionPlan, acceptedSentences }, callModel = null) {
  const plan = normalizeWebbCompositionPlan(compositionPlan, 50)
  const accepted = normalizeAcceptedCompositionSentences(acceptedSentences, plan)
  const essay = assembleWebbCompositionEssay(plan, accepted)
  if (!essay) return { coherent: false, problemSlotIndex: null, reasonCode: 'incomplete' }
  const system = [
    `You perform a final coherence check on a short learner-written paragraph.`,
    `Do not rewrite, edit, or suggest any sentence. Return only a structural judgment.`,
    `Check whether the topic frames the body, body sentences develop distinct connected ideas in a sensible order, no sentence ricochets to an unrelated point, unnecessary repetition is absent, and the conclusion closes what the paragraph actually developed.`,
    `Simple child writing is acceptable. Grammar or style imperfections alone are not a coherence failure.`,
    `Return JSON only: {"coherent":true,"problemSlotIndex":null,"reasonCode":"ok"} or {"coherent":false,"problemSlotIndex":2,"reasonCode":"repetition"}.`,
    `reasonCode must be one of ok, incomplete, topic_mismatch, disconnected, repetition, conclusion_mismatch, contradiction.`,
  ].join(' ')
  const user = JSON.stringify({ instructional_context: lesson || {}, controlling_idea: plan.controllingIdea, slots: plan.slots, learner_sentences: plan.slots.map((slot, index) => ({ index, role: slot.role, text: accepted?.[index]?.text || '' })) })
  const invoke = callModel || ((systemPrompt, userPrompt, maxTokens, temperature, responseFormat) => callGPT(apiKey, systemPrompt, userPrompt, maxTokens, temperature, responseFormat))
  const raw = await invoke(system, user, 100, 0, { type: 'json_object' })
  const parsed = JSON.parse(String(raw || '{}'))
  const coherent = parsed?.coherent === true
  const reasonCode = ['ok','incomplete','topic_mismatch','disconnected','repetition','conclusion_mismatch','contradiction'].includes(String(parsed?.reasonCode || '')) ? parsed.reasonCode : (coherent ? 'ok' : 'disconnected')
  let problemSlotIndex = Number.isInteger(parsed?.problemSlotIndex) && parsed.problemSlotIndex >= 0 && parsed.problemSlotIndex < plan.slots.length ? parsed.problemSlotIndex : null
  if (!coherent && problemSlotIndex === null && plan.slots.length) {
    if (reasonCode === 'topic_mismatch') problemSlotIndex = 0
    else if (reasonCode === 'conclusion_mismatch') problemSlotIndex = plan.slots.length - 1
    else problemSlotIndex = Math.max(1, plan.slots.length - 2)
  }
  return { coherent, problemSlotIndex: coherent ? null : problemSlotIndex, reasonCode }
}

export async function POST(req, deps = {}) {
  try {
    const body = await req.json()
    const apiKey = deps.apiKey || process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

    if (body.action === 'generate') {
      const pendingObjectives = Array.isArray(body.pendingObjectives) ? body.pendingObjectives.map(value => String(value || '').trim()).filter(Boolean).slice(0, 8) : []
      if (pendingObjectives.length) {
        const objectives = [...new Set(pendingObjectives)]
        const lesson = buildInstructionalLessonView(body.lesson || {})
        const clues = await generateObjectiveClues(apiKey, lesson, objectives, deps.callModel || null)
        return NextResponse.json({ objectives, clues, revisit: true })
      }
      const blueprint = await generateObjectives(apiKey, buildInstructionalLessonView(body.lesson || {}), deps.callModel || null)
      return NextResponse.json({
        blueprint,
        objectives: objectivesFromWebbBlueprint(blueprint),
        clues: cluesFromWebbBlueprint(blueprint),
      })
    }

    if (body.action === 'clues') {
      const objectives = Array.isArray(body.objectives) ? body.objectives.map(value => String(value || '').trim()).filter(Boolean).slice(0, 8) : []
      const clues = await generateObjectiveClues(apiKey, buildInstructionalLessonView(body.lesson || {}), objectives, deps.callModel || null)
      return NextResponse.json({ clues })
    }

    if (body.action === 'validate-notes') {
      const result = await validateLearnerNotes(apiKey, {
        objectives: body.objectives || [],
        learnerNotes: body.learnerNotes || {},
        blueprint: body.blueprint || null,
      }, deps.callModel || null)
      return NextResponse.json(result)
    }

    if (body.action === 'check') {
      const result = await evaluateWebbObjectives({
        callModel: deps.callModel || ((...args) => callGPT(apiKey, ...args)),
        objectives: body.objectives || [], completedIndices: body.completedIndices || [], understoodIndices: body.understoodIndices,
        coveredIndices: body.coveredIndices || [], legacyNoteReadyIndices: body.noteReadyIndices, conversation: body.conversation || [],
        lesson: buildInstructionalLessonView(body.lesson || {}), quick: body.quick === true, objectiveEvidence: body.objectiveEvidence || {},
        priorPromptExposure: body.priorPromptExposure || {}, recoverNotes: body.recoverNotes === true,
        blueprint: body.blueprint || null,
        targetObjectiveIndex: Number.isInteger(body.targetObjectiveIndex) ? body.targetObjectiveIndex : null,
      })
      return NextResponse.json(result)
    }

    if (body.action === 'plan-writing') {
      const objectives = Array.isArray(body.objectives) ? body.objectives.map(value => String(value || '').trim()).filter(Boolean).slice(0, 12) : []
      const compositionPlan = await generateCompositionPlan(apiKey, buildInstructionalLessonView(body.lesson || {}), objectives, body.learnerNotes || {}, body.blueprint || null, deps.callModel || null)
      return NextResponse.json({ compositionPlan })
    }

    if (body.action === 'check-writing') {
      const legacyIndex = Number(body.objectiveIndex)
      const legacyTotal = Number(body.totalObjectives)
      const legacyRole = legacyIndex === 0 ? 'topic' : (Number.isInteger(legacyTotal) && legacyIndex === legacyTotal - 1 ? 'conclusion' : 'body')
      const slot = body.slot && typeof body.slot === 'object' ? body.slot : {
        id: `legacy-${Number.isInteger(legacyIndex) ? legacyIndex : 0}`,
        role: legacyRole,
        focus: String(body.objective || ''),
        connection: 'legacy objective-position writing',
        sourceObjectiveIndices: Number.isInteger(legacyIndex) ? [legacyIndex] : [],
      }
      const result = await checkWriting(apiKey, {
        slot,
        controllingIdea: body.controllingIdea || body.objective || '',
        sourceObjectives: body.sourceObjectives || (body.objective ? [{ objectiveIndex: legacyIndex, objective: String(body.objective) }] : []),
        sourceNotes: body.sourceNotes || (body.note ? [{ objectiveIndex: legacyIndex, text: String(body.note), provenance: 'learner-message' }] : []),
        text: String(body.text || ''),
        lesson: buildInstructionalLessonView(body.lesson || {}),
        priorSentences: body.priorSentences || [],
      }, deps.callModel || null)
      return NextResponse.json(result)
    }

    if (body.action === 'check-paragraph') {
      const result = await checkParagraph(apiKey, {
        lesson: buildInstructionalLessonView(body.lesson || {}),
        compositionPlan: body.compositionPlan || {},
        acceptedSentences: body.acceptedSentences || {},
      }, deps.callModel || null)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[webb-objectives]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
