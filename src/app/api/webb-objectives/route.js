/**
 * /api/webb-objectives
 *
 * Two actions, one endpoint:
 *
 * POST { action: 'generate', lesson }
 *   → { objectives: string[] }   — 5-8 comprehension objectives derived from lesson questions
 *
 * POST { action: 'check', objectives: string[], completedIndices: number[], conversation: {role,content}[] }
 *   → { newlyCompleted: number[] }   — indices of objectives the student just demonstrated
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
async function checkObjectives(apiKey, objectives, completedIndices, conversation) {
  const incomplete = objectives
    .map((obj, i) => ({ obj, i }))
    .filter(({ i }) => !completedIndices.includes(i))

  if (!incomplete.length) return []

  // Only look at the last 4 turns to keep this fast + cheap
  const recentTurns = conversation.slice(-4)
    .filter(m => m.role === 'user')
    .map(m => String(m.content || '').trim())
    .filter(Boolean)

  if (!recentTurns.length) return []

  const system =
    `You evaluate whether a student has demonstrated understanding of specific objectives ` +
    `in their own words — NOT just from hearing the teacher say it. ` +
    `The student must use their own words, paraphrase, or give an example. ` +
    `They do NOT need to use exact terminology — a clear conceptual demonstration counts. ` +
    `Return ONLY the numbers of objectives that are clearly demonstrated, e.g. "2,5". ` +
    `If none are demonstrated, return "none".`

  const objList = incomplete.map(({ obj, i }) => `${i}: ${obj}`).join('\n')
  const studentSaid = recentTurns.map(t => `Student: "${t}"`).join('\n')

  const raw = await callGPT(apiKey, system,
    `Remaining objectives (number: text):\n${objList}\n\nRecent student messages:\n${studentSaid}`,
    80)

  if (raw.toLowerCase().includes('none')) return []
  const newly = []
  for (const part of raw.split(',')) {
    const n = parseInt(part.trim(), 10)
    if (!isNaN(n) && !completedIndices.includes(n) && objectives[n]) newly.push(n)
  }
  return newly
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
      const newly = await checkObjectives(
        apiKey,
        body.objectives    || [],
        body.completedIndices || [],
        body.conversation  || [],
      )
      return NextResponse.json({ newlyCompleted: newly })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[webb-objectives]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
