/**
 * /api/webb-objectives
 *
 * POST { action: 'generate', lesson }
 *   → { objectives: string[] }
 *
 * POST { action: 'check', objectives, understoodIndices, conversation }
 *   → { newlyUnderstood: number[], learnerNotes: Record<number,LearnerNote> }
 *
 * POST { action: 'check-writing', objective, note, text }
 *   → { accuracy, sentenceOk } — evaluates but never rewrites learner text
 */
import { NextResponse } from 'next/server.js'
import { buildInstructionalLessonView } from '../../lib/masteryEvidence/assessmentIsolation.js'
import { evaluateWebbObjectives } from '../../lib/webbObjectiveEvaluation.mjs'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
import { AI_MODEL } from '../../lib/aiModel.js'
const OPENAI_MODEL = AI_MODEL

async function callGPT(apiKey, system, user, maxTokens = 500, temperature = 0.3) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_completion_tokens: maxTokens,
      temperature,
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

// ── Generate objectives from a lesson's question bank ────────────────────────
async function generateObjectives(apiKey, lesson) {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary'

  // Flatten all questions across question types into a single list
  const allQ = [
    ...(lesson.sample       || []).map(q => q.question),
    ...(lesson.truefalse    || []).map(q => q.question),
    ...(lesson.multiplechoice || []).map(q => q.question),
    ...(lesson.fillintheblank || []).map(q => q.question),
    ...(lesson.shortanswer  || []).map(q => q.question),
    ...(lesson.questions    || []).map(q => typeof q === 'string' ? q : q.question),
  ].filter(Boolean).slice(0, 60)

  const system =
    `You are a curriculum designer. Given a list of assessment questions for a school lesson, ` +
    `derive 5 to 8 ATOMIC core comprehension objectives. Each objective must assess ONE central idea, relationship, process, or skill only. ` +
    `Do not combine a definition with a cause, effect, example, application, condition, or second fact in the same objective. ` +
    `If related details are independently important, split them into separate objectives; if that would create more than eight, keep only the eight most instructionally important concepts. ` +
    `Each objective should be a clear, student-facing statement of what the learner needs to understand — written as ` +
    `"The learner can explain..." or "The learner understands...". ` +
    `Overlapping questions may point to the same atomic concept, but never merge distinct concepts merely to reduce the count. ` +
    `Do NOT number them. Return one objective per line, nothing else.`

  const user =
    `Lesson: "${title}" — ${subject}, ${grade}.\n\n` +
    `Assessment questions:\n${allQ.map((q, i) => `${i + 1}. ${q}`).join('\n')}`

  const raw = await callGPT(apiKey, system, user, 400)
  const objectives = raw.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
  return objectives
}

// ── Check whether the student just demonstrated any uncompleted objectives ────
// Returns comprehension state plus exact, source-verified learner notes.
// Evaluate a learner writing attempt without rewriting it.
async function checkWriting(apiKey, objective, note, text, lesson) {
  const system =
    `You evaluate a student's proposed essay sentence. Judge two facts independently: ` +
    `(1) ACCURACY: whether the sentence materially and correctly expresses the understood concept represented by the objective and learner note, with no material misconception; ` +
    `(2) SENTENCE_OK: whether it is a complete, coherent sentence suitable to use verbatim in the essay. ` +
    `Do not rewrite, correct, or suggest wording. Reply exactly ACCURACY|SENTENCE_OK where ACCURACY is correct, partial, or incorrect and SENTENCE_OK is yes or no.`
  const raw = await callGPT(apiKey, system,
    `Instructional context: ${JSON.stringify(lesson || {})}\nObjective: ${objective}\nLearner's earlier note: ${note}\nLearner's proposed sentence: ${text}`,
    20, 0)
  const [accuracyRaw, sentenceRaw] = raw.split('|')
  const accuracy = String(accuracyRaw || '').trim().toLowerCase()
  if (!['correct', 'partial', 'incorrect'].includes(accuracy) || !['yes', 'no'].includes(String(sentenceRaw || '').trim().toLowerCase())) {
    throw new Error('Writing evaluator returned an invalid result')
  }
  return {
    accuracy,
    sentenceOk: String(sentenceRaw || '').trim().toLowerCase() === 'yes',
  }
}

export async function POST(req, deps = {}) {
  try {
    const body   = await req.json()
    const apiKey = deps.apiKey || process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

    if (body.action === 'generate') {
      const pendingObjectives = Array.isArray(body.pendingObjectives)
        ? body.pendingObjectives.map(value => String(value || '').trim()).filter(Boolean).slice(0, 8)
        : []
      if (pendingObjectives.length) {
        return NextResponse.json({ objectives: [...new Set(pendingObjectives)], revisit: true })
      }
      const objectives = await generateObjectives(apiKey, buildInstructionalLessonView(body.lesson || {}))
      return NextResponse.json({ objectives })
    }

    if (body.action === 'check') {
      const result = await evaluateWebbObjectives({
        callModel: deps.callModel || ((...args) => callGPT(apiKey, ...args)),
        objectives: body.objectives || [],
        completedIndices: body.completedIndices || [],
        understoodIndices: body.understoodIndices,
        coveredIndices: body.coveredIndices || [],
        legacyNoteReadyIndices: body.noteReadyIndices,
        conversation: body.conversation || [],
        lesson: buildInstructionalLessonView(body.lesson || {}),
        quick: body.quick === true,
        objectiveEvidence: body.objectiveEvidence || {},
        priorPromptExposure: body.priorPromptExposure || {},
        recoverNotes: body.recoverNotes === true,
      })
      return NextResponse.json(result)
    }

    if (body.action === 'check-writing') {
      const result = await checkWriting(
        apiKey,
        String(body.objective || ''),
        String(body.note || ''),
        String(body.text || ''),
        buildInstructionalLessonView(body.lesson || {}),
      )
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[webb-objectives]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
