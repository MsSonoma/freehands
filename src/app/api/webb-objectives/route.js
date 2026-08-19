/**
 * /api/webb-objectives
 *
 * POST { action: 'generate', lesson }
 *   → { objectives: string[] }
 *
 * POST { action: 'check', objectives, completedIndices, conversation }
 *   → { newlyCompleted: number[], qualifyingText: Record<number,string> }
 *
 * POST { action: 'generate-essay', objectives: string[], responses: Record<number,string>, lesson }
 *   → { essay: string }   — student's own words woven into a short essay
 */
import { NextResponse } from 'next/server'
import { buildInstructionalLessonView } from '@/app/lib/masteryEvidence/assessmentIsolation.js'

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
// Returns: { newlyCompleted: number[], qualifyingText: Record<number, string> }
async function checkObjectives(apiKey, objectives, completedIndices, conversation, lesson = {}, quick = false) {
  const incomplete = objectives
    .map((obj, i) => ({ obj, i }))
    .filter(({ i }) => !completedIndices.includes(i))

  if (!incomplete.length) return { newlyCompleted: [], qualifyingText: {} }

  // quick=true  → only last 2 user turns (inline pre-check before webb-chat)
  // quick=false → last 20 messages (~10 turns) for catch-up / video-research checks
  const windowSize = quick ? 4 : 20
  const recentTurns = conversation.slice(-windowSize)
    .filter(m => m.role === 'user')
    .map(m => ({ idx: conversation.indexOf(m), text: String(m.content || '').trim() }))
    .filter(t => t.text)

  if (!recentTurns.length) return { newlyCompleted: [], qualifyingText: {} }

  const system =
    `You are evaluating whether a student has mastered lesson objectives. ` +
    `Evaluate meaning flexibly, but correctness strictly. ` +
    `The student may use any age-appropriate wording, paraphrase, explanation, or valid example. NEVER require exact terminology, a memorized definition, or wording that matches the lesson. ` +
    `Judge semantic meaning, not textual similarity. A materially correct explanation that differs from the lesson wording should pass. ` +
    `An objective is correct only when the student's own words materially and accurately demonstrate the objective, are sufficient to show understanding, and contain no material misconception or contradiction. ` +
    `Do not infer missing understanding merely because a response is related to the topic. Partial, vague, guessed, or conceptually wrong answers are NOT complete. ` +
    `Use the instructional lesson context to help judge meaning and factual or conceptual correctness, never as a required answer key. ` +
    `For each remaining objective that the recent student messages address enough to evaluate, output one line: INDEX|ACCURACY|SENTENCE_OK|STUDENT_QUOTE ` +
    `where ACCURACY is exactly "correct", "partial", or "incorrect". Judge ACCURACY from conceptual meaning alone, independently of grammar or sentence form. A fragment may be ACCURACY "correct" when it contains the full materially correct concept; SENTENCE_OK must separately reject the fragment. Never downgrade ACCURACY merely because the response is not a complete sentence or has poor grammar. ` +
    `SENTENCE_OK is "yes" only when the student's quoted response is a complete, grammatically coherent sentence suitable for the child's essay with at most minor spelling, capitalization, or punctuation fixes. ` +
    `Use SENTENCE_OK "no" for a fragment, single word, phrase, materially broken grammar, garbled or repeated wording, or anything that would require rephrasing, restructuring, or adding missing words. ` +
    `STUDENT_QUOTE must contain the student's verbatim sentence or sentences relevant to that objective. ` +
    `If a response contains a material contradiction or misconception, do not cherry-pick one correct phrase and call the objective correct. ` +
    `If no remaining objective is addressed enough to evaluate, return "none".`

  const objList = incomplete.map(({ obj, i }) => `${i}: ${obj}`).join('\n')
  const studentSaid = recentTurns.map(t => `Student: "${t.text}"`).join('\n')
  const lessonContext = JSON.stringify(lesson || {})

  const raw = await callGPT(apiKey, system,
    `Instructional lesson context (use for meaning and correctness, never as required wording):\n${lessonContext}\n\nRemaining objectives (number: text):\n${objList}\n\nRecent student messages:\n${studentSaid}`,
    300, 0)

  const newlyCompleted = []
  const qualifyingText = {}
  const sentenceQuality = {}
  const needsSentence = []
  const evaluationStatus = {}

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.toLowerCase() === 'none') continue

    const parts = trimmed.split('|')
    if (parts.length < 4) continue

    const n = parseInt(parts[0].trim(), 10)
    const accuracy = (parts[1]?.trim() || '').toLowerCase()
    const sentenceOk = (parts[2]?.trim() || '').toLowerCase() === 'yes'
    const quote = parts.slice(3).join('|').trim()

    if (isNaN(n) || completedIndices.includes(n) || !objectives[n]) continue
    if (!['correct', 'partial', 'incorrect'].includes(accuracy)) continue

    evaluationStatus[n] = accuracy
    sentenceQuality[n] = sentenceOk

    if (accuracy === 'correct' && sentenceOk) {
      newlyCompleted.push(n)
      if (quote) qualifyingText[n] = quote
    } else if (accuracy === 'correct' && !sentenceOk) {
      needsSentence.push(n)
    }
  }

  return {
    newlyCompleted,
    qualifyingText,
    sentenceQuality,
    needsSentence,
    evaluationStatus
  }
}

// ── Check if a student's text is a complete sentence usable in an essay ───────
async function checkSentence(apiKey, text) {
  const system =
    `You judge whether a student's response is a complete sentence that could be used verbatim in an essay. ` +
    `A complete sentence has a subject and predicate and conveys a full thought. ` +
    `Reply with exactly one word: YES or NO.`
  const raw = await callGPT(apiKey, system, `Student said: "${text}"`, 5)
  return raw.toUpperCase().startsWith('Y')
}

// ── Generate essay from the student's own responses ──────────────────────────
async function generateEssay(apiKey, objectives, responses, lesson) {
  const title = lesson?.title || 'this topic'
  const pairs = objectives
    .map((obj, i) => responses[i] ? `Objective: ${obj}\nStudent said: "${responses[i]}"` : null)
    .filter(Boolean)
  if (!pairs.length) return null

  const system =
    `You are a copy editor, NOT a writer. Your job is to arrange a child's spoken answers into essay form WITHOUT changing what they said. ` +
    `WHAT YOU ARE ALLOWED TO DO (nothing else): ` +
    `(1) Copy the student's exact words into essay paragraphs. If the exact same student sentence appears for more than one objective, include that sentence only once. ` +
    `(2) Fix only clear spelling errors (e.g. "beleive" → "believe"). ` +
    `(3) Fix only obvious grammar errors that change nothing else: missing end punctuation, wrong capitalization, or a broken verb agreement (e.g. "they was" → "they were"). ` +
    `(4) Add only the tiniest connective glue between the student's sentences WHEN needed — short words or phrases like "also", "and", "because", "for example", or "another thing is". ` +
    `(5) Add ONE very short intro sentence and ONE very short closing sentence. Use simple, plain language a child would use (e.g. "I learned about volcanoes." / "Those are the things I learned."). ` +
    `WHAT YOU MUST NEVER DO: ` +
    `(6) Do NOT replace ANY word the student used with a different or more sophisticated word. ` +
    `(7) Do NOT rephrase or restructure their sentences. ` +
    `(8) Do NOT expand a short phrase into a longer sentence. ` +
    `(9) Do NOT add any new fact, claim, description, or idea that the student did not say. ` +
    `(10) Do NOT make the writing sound more polished, educated, or collegiate. ` +
    `If a child said "it was really cool and stuff", that stays as "it was really cool and stuff". ` +
    `The finished essay must sound EXACTLY like this specific child wrote it — not like an AI. ` +
    `Return ONLY the essay text, no title, no labels.`

  const user = `Lesson topic: "${title}"\n\n${pairs.join('\n\n')}`
  return callGPT(apiKey, system, user, 700)
}

export async function POST(req) {
  try {
    const body   = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

    if (body.action === 'generate') {
      const objectives = await generateObjectives(apiKey, buildInstructionalLessonView(body.lesson || {}))
      return NextResponse.json({ objectives })
    }

    if (body.action === 'check') {
      const {
        newlyCompleted,
        qualifyingText,
        sentenceQuality,
        needsSentence,
        evaluationStatus,
      } = await checkObjectives(
        apiKey,
        body.objectives || [],
        body.completedIndices || [],
        body.conversation || [],
        buildInstructionalLessonView(body.lesson || {}),
        body.quick || false,
      )

      return NextResponse.json({
        newlyCompleted,
        qualifyingText,
        sentenceQuality,
        needsSentence,
        evaluationStatus,
      })
    }

    if (body.action === 'check-sentence') {
      const isSentence = await checkSentence(apiKey, body.text || '')
      return NextResponse.json({ isSentence })
    }

    if (body.action === 'generate-essay') {
      const essay = await generateEssay(
        apiKey,
        body.objectives || [],
        body.responses  || {},
        buildInstructionalLessonView(body.lesson || {}),
      )
      return NextResponse.json({ essay: essay || '' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[webb-objectives]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
