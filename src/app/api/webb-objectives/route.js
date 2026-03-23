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

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

async function callGPT(apiKey, system, user, maxTokens = 500) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens,
      temperature: 0.3,
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
async function checkObjectives(apiKey, objectives, completedIndices, conversation) {
  const incomplete = objectives
    .map((obj, i) => ({ obj, i }))
    .filter(({ i }) => !completedIndices.includes(i))

  if (!incomplete.length) return { newlyCompleted: [], qualifyingText: {} }

  // Only look at the last 4 turns to keep this fast + cheap
  const recentTurns = conversation.slice(-4)
    .filter(m => m.role === 'user')
    .map(m => ({ idx: conversation.indexOf(m), text: String(m.content || '').trim() }))
    .filter(t => t.text)

  if (!recentTurns.length) return { newlyCompleted: [], qualifyingText: {} }

  const system =
    `You evaluate whether a student has demonstrated understanding of specific objectives ` +
    `in their own words — NOT just from hearing the teacher say it. ` +
    `The student must use their own words, paraphrase, or give an example. ` +
    `They do NOT need to use exact terminology — a clear conceptual demonstration counts. ` +
    `For each demonstrated objective, output one line: INDEX|STUDENT_QUOTE ` +
    `where STUDENT_QUOTE is the verbatim student sentence(s) that best demonstrate it. ` +
    `If no objectives are demonstrated, return "none".`

  const objList = incomplete.map(({ obj, i }) => `${i}: ${obj}`).join('\n')
  const studentSaid = recentTurns.map(t => `Student: "${t.text}"`).join('\n')

  const raw = await callGPT(apiKey, system,
    `Remaining objectives (number: text):\n${objList}\n\nRecent student messages:\n${studentSaid}`,
    200)

  if (raw.toLowerCase().startsWith('none')) return { newlyCompleted: [], qualifyingText: {} }

  const newlyCompleted = []
  const qualifyingText = {}
  for (const line of raw.split('\n')) {
    const [indexPart, ...quoteParts] = line.split('|')
    const n = parseInt(indexPart?.trim(), 10)
    const quote = quoteParts.join('|').trim()
    if (!isNaN(n) && !completedIndices.includes(n) && objectives[n]) {
      newlyCompleted.push(n)
      if (quote) qualifyingText[n] = quote
    }
  }
  return { newlyCompleted, qualifyingText }
}

// ── Generate essay from the student's own responses ──────────────────────────
async function generateEssay(apiKey, objectives, responses, lesson) {
  const title = lesson?.title || 'this topic'
  const pairs = objectives
    .map((obj, i) => responses[i] ? `Objective: ${obj}\nStudent said: "${responses[i]}"` : null)
    .filter(Boolean)
  if (!pairs.length) return null

  const system =
    `You are assembling a child's essay using ONLY the exact words the student said. ` +
    `The student's answers are shown below. Your job is to stitch them together — nothing more. ` +
    `STRICT RULES — violating any of these is an error: ` +
    `(1) COPY the student's words verbatim. Do NOT change, upgrade, or paraphrase any word they used. If they said "stuff", keep "stuff". If they said "I think", keep "I think". ` +
    `(2) You may ONLY add: one short intro sentence and one short closing sentence, plus minimal connective words (like "also", "and", "because") needed to join sentences together. ` +
    `(3) Do NOT improve their vocabulary. Do NOT make their sentences sound more educated or sophisticated. ` +
    `(4) Do NOT add any fact, idea, or word that did not come directly from the student's own answers. ` +
    `(5) If the student used simple or awkward words, keep them exactly. Do not adjust the sophistication level up or down — preserve their natural voice as-is. ` +
    `(6) Return ONLY the essay text, no title, no labels.`

  const user = `Lesson topic: "${title}"\n\n${pairs.join('\n\n')}`
  return callGPT(apiKey, system, user, 700)
}

export async function POST(req) {
  try {
    const body   = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

    if (body.action === 'generate') {
      const objectives = await generateObjectives(apiKey, body.lesson || {})
      return NextResponse.json({ objectives })
    }

    if (body.action === 'check') {
      const { newlyCompleted, qualifyingText } = await checkObjectives(
        apiKey,
        body.objectives    || [],
        body.completedIndices || [],
        body.conversation  || [],
      )
      return NextResponse.json({ newlyCompleted, qualifyingText })
    }

    if (body.action === 'generate-essay') {
      const essay = await generateEssay(
        apiKey,
        body.objectives || [],
        body.responses  || {},
        body.lesson     || {},
      )
      return NextResponse.json({ essay: essay || '' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[webb-objectives]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
