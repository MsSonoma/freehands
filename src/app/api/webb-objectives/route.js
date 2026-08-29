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
import { NextResponse } from 'next/server'
import { buildInstructionalLessonView } from '@/app/lib/masteryEvidence/assessmentIsolation.js'
import { createVerbatimLearnerRecord, parseComprehensionEvaluations } from '@/app/lib/webbLearningModel.mjs'
import { classifyWebbObjectiveAttempt } from '@/app/lib/webbMasteryModel.mjs'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
import { AI_MODEL } from '@/app/lib/aiModel'
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
  const json = await res.json()
  return json.choices?.[0]?.message?.content?.trim() || ''
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
    `derive 5 to 8 core comprehension objectives. Each objective should be a clear, ` +
    `student-facing statement of what the learner needs to understand — written as ` +
    `"The learner can explain..." or "The learner understands...". ` +
    `Consolidate overlapping questions into a single objective. ` +
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
async function checkObjectives(apiKey, objectives, coveredIndices, conversation, lesson = {}, quick = false, priorObjectiveEvidence = {}, priorPromptExposure = {}) {
  const incomplete = objectives
    .map((obj, i) => ({ obj, i }))
    .filter(({ i }) => !coveredIndices.includes(i))

  if (!incomplete.length) return { newlyCovered: [], newlyUnderstood: [], newlyCompleted: [], learnerNotes: {}, qualifyingText: {}, objectiveEvidence: priorObjectiveEvidence }

  // quick=true  → only last 2 user turns (inline pre-check before webb-chat)
  // quick=false → last 20 messages (~10 turns) for catch-up / video-research checks
  const windowSize = quick ? 4 : 20
  const recentTurns = conversation.slice(-windowSize)
    .filter(m => m.role === 'user')
    .map(m => ({ idx: conversation.indexOf(m), text: String(m.content || '').trim() }))
    .filter(t => t.text)

  if (!recentTurns.length) return { newlyCovered: [], newlyUnderstood: [], newlyCompleted: [], learnerNotes: {}, qualifyingText: {}, objectiveEvidence: priorObjectiveEvidence }

  const system =
    `You are evaluating whether a student has mastered lesson objectives. ` +
    `Evaluate meaning flexibly, but correctness strictly. ` +
    `The student may use any age-appropriate wording, paraphrase, explanation, or valid example. NEVER require exact terminology, a memorized definition, or wording that matches the lesson. ` +
    `Judge semantic meaning, not textual similarity. A materially correct explanation that differs from the lesson wording should pass. ` +
    `An objective is correct only when the student's own words materially and accurately demonstrate the objective, are sufficient to show understanding, and contain no material misconception or contradiction. ` +
    `Do not infer missing understanding merely because a response is related to the topic. Partial, vague, guessed, or conceptually wrong answers are NOT complete. ` +
    `Use the instructional lesson context to help judge meaning and factual or conceptual correctness, never as a required answer key. ` +
    `For each remaining objective that the recent student messages address enough to evaluate, output one line: OBJECTIVE_INDEX|ACCURACY|SENTENCE_OK|MESSAGE_INDEX|STUDENT_QUOTE ` +
    `where ACCURACY is exactly "correct", "partial", or "incorrect". Judge ACCURACY from conceptual meaning alone, independently of grammar or sentence form. A fragment may be ACCURACY "correct" when it contains the full materially correct concept; SENTENCE_OK must separately reject the fragment. Never downgrade ACCURACY merely because the response is not a complete sentence or has poor grammar. ` +
    `SENTENCE_OK is "yes" only when the student's quoted response is a complete, grammatically coherent sentence suitable for the child's essay with at most minor spelling, capitalization, or punctuation fixes. ` +
    `Use SENTENCE_OK "no" for a fragment, single word, phrase, materially broken grammar, garbled or repeated wording, or anything that would require rephrasing, restructuring, or adding missing words. ` +
    `MESSAGE_INDEX must be the bracketed index of the one student message that demonstrates the objective. STUDENT_QUOTE must be a verbatim excerpt from that same message. Never combine text from multiple messages and never paraphrase it. ` +
    `If a response contains a material contradiction or misconception, do not cherry-pick one correct phrase and call the objective correct. ` +
    `If no remaining objective is addressed enough to evaluate, return "none".`

  const objList = incomplete.map(({ obj, i }) => `${i}: ${obj}`).join('\n')
  const studentSaid = recentTurns.map(t => `[${t.idx}] Student: "${t.text}"`).join('\n')
  const lessonContext = JSON.stringify(lesson || {})

  const raw = await callGPT(apiKey, system,
    `Instructional lesson context (use for meaning and correctness, never as required wording):\n${lessonContext}\n\nRemaining objectives (number: text):\n${objList}\n\nRecent student messages:\n${studentSaid}`,
    300, 0)

  const parsed = parseComprehensionEvaluations({ raw, objectives, understoodIndices: coveredIndices, conversation })
  const objectiveEvidence = { ...(priorObjectiveEvidence || {}) }
  const learnerNotes = { ...parsed.learnerNotes }
  const newlyCovered = []
  const newlyUnderstood = []

  for (const [rawIndex, evaluation] of Object.entries(parsed.evaluationDetails || {})) {
    const index = Number(rawIndex)
    const classification = classifyWebbObjectiveAttempt({
      objectiveIndex: index,
      objective: objectives[index],
      evaluation,
      conversation,
      previousEvidence: priorObjectiveEvidence?.[index] || {},
      priorPromptExposed: priorPromptExposure?.[index] !== false,
    })
    if (!classification) continue
    objectiveEvidence[index] = classification
    if (classification.coverage === 'covered') {
      newlyCovered.push(index)
      if (!learnerNotes[index]) {
        learnerNotes[index] = createVerbatimLearnerRecord({ objectiveIndex: index, evaluation, conversation })
      }
    }
    if (classification.comprehension === 'demonstrated') newlyUnderstood.push(index)
  }
  const qualifyingText = Object.fromEntries(Object.entries(learnerNotes).filter(([, note]) => note).map(([index, note]) => [index, note.text]))

  return {
    newlyCovered,
    newlyUnderstood,
    // Compatibility alias: legacy callers used completion for progression.
    newlyCompleted: newlyCovered,
    learnerNotes,
    qualifyingText,
    sentenceQuality: parsed.sentenceQuality,
    evaluationStatus: parsed.evaluationStatus,
    objectiveEvidence,
  }
}

// ── Evaluate a learner's writing attempt without rewriting it ─────────────────
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
  return {
    accuracy: ['correct', 'partial', 'incorrect'].includes(accuracy) ? accuracy : 'partial',
    sentenceOk: String(sentenceRaw || '').trim().toLowerCase() === 'yes',
  }
}

export async function POST(req) {
  try {
    const body   = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
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
      const {
        newlyCompleted,
        newlyCovered,
        newlyUnderstood,
        learnerNotes,
        qualifyingText,
        sentenceQuality,
        evaluationStatus,
        objectiveEvidence,
      } = await checkObjectives(
        apiKey,
        body.objectives || [],
        body.coveredIndices || body.understoodIndices || body.completedIndices || [],
        body.conversation || [],
        buildInstructionalLessonView(body.lesson || {}),
        body.quick || false,
        body.objectiveEvidence || {},
        body.priorPromptExposure || {},
      )

      return NextResponse.json({
        newlyCompleted,
        newlyCovered,
        newlyUnderstood,
        learnerNotes,
        qualifyingText,
        sentenceQuality,
        evaluationStatus,
        objectiveEvidence,
      })
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
