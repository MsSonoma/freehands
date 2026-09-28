/**
 * /api/webb-objectives
 *
 * Mrs. Webb objectives are the authoritative essay blueprint. Each mastered objective
 * yields one learner-authored note and one learner-authored essay sentence in the same order.
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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
import { AI_MODEL } from '../../lib/aiModel.js'
const OPENAI_MODEL = AI_MODEL

async function callGPT(apiKey, system, user, maxTokens = 500, temperature = 0.3, responseFormat = null) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_completion_tokens: maxTokens,
      temperature,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  })
  if (!res.ok) throw new Error('Learning evaluator unavailable (' + res.status + ')')
  const json = await res.json()
  const choice = json.choices?.[0]
  if (choice?.finish_reason === 'length' || !choice?.message?.content?.trim()) {
    throw new Error('Learning evaluator returned an incomplete response')
  }
  return choice.message.content.trim()
}

function parseGeneratedObjectives(raw) {
  let parsed
  try { parsed = JSON.parse(String(raw || '')) } catch { throw new Error('Objective planner returned invalid JSON') }
  const rows = parsed?.objectives
  if (!Array.isArray(rows) || rows.length < 5 || rows.length > 8) throw new Error('Objective planner returned an invalid objective count')
  const normalized = rows.map((row) => {
    const atomicFocus = String(row?.atomic_focus || '').trim().slice(0, 240)
    const objective = String(row?.objective || '').trim().slice(0, 600)
    if (!atomicFocus || !objective) throw new Error('Objective planner returned an incomplete objective')
    return { atomic_focus: atomicFocus, objective }
  })
  if (new Set(normalized.map(row => row.objective.toLocaleLowerCase())).size !== normalized.length) {
    throw new Error('Objective planner returned duplicate objectives')
  }
  return normalized
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
    "Before writing any objectives, silently draft a coherent short essay ABOUT what this lesson teaches. Choose the discourse pattern that fits the content, such as explanation, chronology, cause and effect, compare and contrast, process, literary response, report, or argument. This hidden essay is planning only and is never shown to the learner.",
    "Current Mrs. Webb always writes from mastered lesson notes. She does not switch into a separate composition assignment that requires a new topic, opinion, story, example, or other content that was not learned and saved during research.",
    "If the source lesson asks the learner to produce a different kind of writing, such as an opinion paragraph or narrative, observe the knowledge and skill the lesson teaches and make the hidden essay ABOUT that learned material. For example, a lesson about opinion paragraphs can produce an essay explaining how opinion paragraphs work. Do not invent an unrelated opinion for the learner to write.",
    "Then reverse-engineer that hidden essay into 5 to 8 ATOMIC core comprehension objectives. Each objective must represent exactly one sentence-worth of essential essay content and must assess ONE central idea, relationship, process, or skill only.",
    "The returned objective order is authoritative for later writing. The learner will earn exactly one learner-authored note for each objective and later turn exactly that note into exactly one essay sentence in the same order. A later planner will not merge, omit, reorder, or invent content, so solve essay coherence here.",
    "Objective 1 must establish the essay's controlling idea or necessary opening context and be capable of producing a natural topic/opening sentence from that objective's learner note.",
    "Every middle objective must intentionally advance the essay from the objectives before it. Put prerequisites before dependent ideas, causes before consequences, events in meaningful chronology when chronology matters, supporting evidence before interpretation, and explanation before significance. Avoid conceptual ricochet.",
    "The final objective must be the essay's synthesis, significance, theme, overall explanation, or other closing idea supported by the earlier objectives. It must be capable of producing a natural closing sentence from that objective's learner note.",
    "A bare title, author, character name, date, vocabulary definition, isolated example, or trivia fact is not suitable opening or closing content unless it genuinely carries the essay's controlling or synthesizing idea.",
    "An objective may describe one relationship involving multiple things, but it must never require two independently gradable answers. Do not combine identification plus explanation, definition plus cause, cause plus effect, fact plus example, or two separate functions.",
    "Each objective should be answerable by one focused comprehension question. Before returning a row containing \"and\", self-check whether the words after \"and\" create a second question, second verb task, or separately gradable fact. If they do, split, reorder, or omit the lower-priority idea.",
    "When the lesson itself teaches writing skills, those skills are legitimate lesson content. Objectives may explain what a claim, reason, supporting detail, transition, conclusion, revision step, or other writing concept does. The later Mrs. Webb essay will explain that learned content; it will not become a separate example essay unless a future writing mode explicitly supports that.",
    "Keep objective text content-focused and student-facing, normally as \"The learner can explain...\", \"The learner can describe...\", \"The learner can compare...\", or \"The learner understands...\". Do not put later writing instructions inside the objective text.",
    "For each row, atomic_focus must name the single gradable concept in a short phrase.",
    "Return only valid JSON in this exact shape: {\"objectives\":[{\"atomic_focus\":\"one concept\",\"objective\":\"The learner can explain...\"}]}.",
  ].join(' ')
  const user = `Lesson: "${title}" - ${subject}, ${grade}.\n\nAssessment questions:\n${allQ.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
  const invoke = callModel || ((systemPrompt, userPrompt, maxTokens, temperature, responseFormat) => callGPT(apiKey, systemPrompt, userPrompt, maxTokens, temperature, responseFormat))
  const responseFormat = { type: 'json_object' }
  const validate = (candidate) => {
    try {
      const plan = parseGeneratedObjectives(candidate)
      const violations = objectivePlanViolations(plan)
      return violations.length ? { ok: false, plan, violations } : { ok: true, plan, violations: [] }
    } catch (error) {
      return { ok: false, plan: null, violations: [String(error?.message || 'Objective planner output was invalid')] }
    }
  }

  let raw = await invoke(system, user, 900, 0.15, responseFormat)
  let validation = validate(raw)
  if (!validation.ok) {
    const repairSystem = [
      system,
      `You are repairing a draft that failed the atomic mastery-objective validator. Return the COMPLETE corrected mastery map, not commentary.`,
      `The draft may have malformed JSON, the wrong number of rows, duplicate objectives, or non-atomic objectives.`,
      `Do not preserve a bad row merely because its facts are true. One row must equal one independently gradable comprehension target.`,
    ].join(' ')
    raw = await invoke(repairSystem, JSON.stringify({ lesson: { title, subject, grade }, assessment_questions: allQ, raw_draft: raw, draft_plan: validation.plan, validator_violations: validation.violations }), 900, 0.05, responseFormat)
    validation = validate(raw)
  }
  if (!validation.ok) {
    raw = await invoke(`${system} Previous attempts failed deterministic validation. Start over and return one fresh complete mastery map.`, user, 900, 0.05, responseFormat)
    validation = validate(raw)
  }
  if (!validation.ok) throw new Error(`Objective planner remained invalid after recovery: ${validation.violations.join('; ')}`)
  return validation.plan.map(row => row.objective)
}

function generateCompositionPlan(_apiKey, _lesson, objectives, learnerNotes, _callModel = null) {
  return buildWebbCompositionPlan(objectives, learnerNotes)
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
    "You evaluate exactly one learner-authored essay sentence against the exact mastered lesson note assigned to this slot. Judge five facts independently.",
    "(1) CONCEPT_FIT: correct, partial, or incorrect. When learner research is supplied, it is the authoritative content boundary. The proposed sentence must materially and accurately express the same central concept as that source objective and learner note. A sentence about a different topic is incorrect even when it would be excellent writing in some other essay. Topic and conclusion sentences are not exempt from this rule.",
    "(2) SENTENCE_OK: yes only when the learner submitted exactly one complete coherent sentence usable verbatim. Two or more sentences must be no.",
    "(3) SLOT_FIT: yes only when the sentence both stays faithful to its assigned note and performs this exact rhetorical role. A topic sentence must use the first note as opening content; a body sentence must develop its note; a conclusion must use the final note as closing content.",
    "(4) ADDS_NEW_INFORMATION: for a body slot, yes only when it advances the paragraph instead of restating an accepted sentence. For a topic or conclusion, it may frame or synthesize rather than introduce new factual content, but it still cannot introduce content outside its assigned note.",
    "(5) PARAGRAPH_FIT: yes only when accepting it makes the paragraph more coherent overall rather than causing a topic jump, contradiction, orphaned example, or unnecessary repetition.",
    "A simple child-written sentence can be excellent. Do not require a transition word, sophisticated style, or adult-level polish.",
    "Never reward a sentence merely because it is a good example of the writing skill being studied. Judge whether it belongs in THIS essay and derives from THIS assigned learner note.",
    "The learner's research notes are evidence and a content boundary, not wording to copy. Never rewrite, correct, complete, or suggest wording.",
    "Reply exactly CONCEPT_FIT|SENTENCE_OK|SLOT_FIT|ADDS_NEW_INFORMATION|PARAGRAPH_FIT where CONCEPT_FIT is correct, partial, or incorrect and all other fields are yes or no.",
  ].join(' ')
  const user = JSON.stringify({
    instructional_context: input?.lesson || {},
    controlling_idea: String(input?.controllingIdea || ''),
    slot: { id: slot.id || null, role, focus: slot.focus || '', connection: slot.connection || '', sourceObjectiveIndices: slot.sourceObjectiveIndices || [] },
    source_objectives: Array.isArray(input?.sourceObjectives) ? input.sourceObjectives : [],
    learner_research_notes: Array.isArray(input?.sourceNotes) ? input.sourceNotes : [],
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
      if (pendingObjectives.length) return NextResponse.json({ objectives: [...new Set(pendingObjectives)], revisit: true })
      const objectives = await generateObjectives(apiKey, buildInstructionalLessonView(body.lesson || {}), deps.callModel || null)
      return NextResponse.json({ objectives })
    }

    if (body.action === 'check') {
      const result = await evaluateWebbObjectives({
        callModel: deps.callModel || ((...args) => callGPT(apiKey, ...args)),
        objectives: body.objectives || [], completedIndices: body.completedIndices || [], understoodIndices: body.understoodIndices,
        coveredIndices: body.coveredIndices || [], legacyNoteReadyIndices: body.noteReadyIndices, conversation: body.conversation || [],
        lesson: buildInstructionalLessonView(body.lesson || {}), quick: body.quick === true, objectiveEvidence: body.objectiveEvidence || {},
        priorPromptExposure: body.priorPromptExposure || {}, recoverNotes: body.recoverNotes === true,
        targetObjectiveIndex: Number.isInteger(body.targetObjectiveIndex) ? body.targetObjectiveIndex : null,
      })
      return NextResponse.json(result)
    }

    if (body.action === 'plan-writing') {
      const objectives = Array.isArray(body.objectives) ? body.objectives.map(value => String(value || '').trim()).filter(Boolean).slice(0, 12) : []
      const compositionPlan = await generateCompositionPlan(apiKey, buildInstructionalLessonView(body.lesson || {}), objectives, body.learnerNotes || {}, deps.callModel || null)
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
