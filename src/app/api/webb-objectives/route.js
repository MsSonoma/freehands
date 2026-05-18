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
async function checkObjectives(apiKey, objectives, completedIndices, conversation, quick = false) {
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
    `You are a strict evaluator. A student has earned an objective ONLY if they have clearly explained it ` +
    `in their own words — describing what it is, how it works, or why it matters. ` +
    `Merely MENTIONING a word, asking a question about it, repeating what the teacher said, or giving a one-word answer does NOT count. ` +
    `The student must demonstrate understanding through their own explanation or example. ` +
    `Be conservative: if there is any doubt, do NOT award it. ` +
    `Award AT MOST ONE objective per check — the single most clearly demonstrated one. ` +
    `If you find a qualifying response, output exactly one line: INDEX|STUDENT_QUOTE ` +
    `where INDEX is the objective number and STUDENT_QUOTE is the verbatim student text that demonstrates it. ` +
    `If no objective is clearly demonstrated, output exactly: none`

  const objList = incomplete.map(({ obj, i }) => `${i}: ${obj}`).join('\n')
  const studentSaid = recentTurns.map(t => `Student: "${t.text}"`).join('\n')

  const raw = await callGPT(apiKey, system,
    `Remaining objectives (number: text):\n${objList}\n\nRecent student messages:\n${studentSaid}`,
    300, 0)

  const newlyCompleted = []
  const qualifyingText = {}
  const sentenceQuality = {}

  // Build a set of all actual student text (lowercased) for hallucination-check
  const allStudentText = recentTurns.map(t => t.text.toLowerCase())

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.toLowerCase() === 'none') continue
    const pipeIdx = trimmed.indexOf('|')
    if (pipeIdx === -1) continue
    const n = parseInt(trimmed.slice(0, pipeIdx).trim(), 10)
    const quote = trimmed.slice(pipeIdx + 1).trim()
    if (isNaN(n) || completedIndices.includes(n) || !objectives[n]) continue

    // Reject if the AI invented a quote — require at least 4 consecutive words
    // from the quote to appear in one of the actual student messages
    if (quote) {
      const quoteWords = quote.toLowerCase().split(/\s+/).filter(Boolean)
      const windowWords = Math.min(4, quoteWords.length)
      const verified = windowWords < 2
        ? allStudentText.some(s => s.includes(quoteWords[0]))
        : allStudentText.some(s => {
            for (let i = 0; i <= quoteWords.length - windowWords; i++) {
              const phrase = quoteWords.slice(i, i + windowWords).join(' ')
              if (s.includes(phrase)) return true
            }
            return false
          })
      if (!verified) {
        console.warn(`[webb-objectives] Rejected hallucinated quote for objective ${n}: "${quote}"`)
        continue
      }
    }

    newlyCompleted.push(n)
    if (quote) qualifyingText[n] = quote
  }
  return { newlyCompleted, qualifyingText, sentenceQuality: {} }
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
    `(1) Copy the student's exact words into essay paragraphs. ` +
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
      const objectives = await generateObjectives(apiKey, body.lesson || {})
      return NextResponse.json({ objectives })
    }

    if (body.action === 'check') {
      const { newlyCompleted, qualifyingText, sentenceQuality } = await checkObjectives(
        apiKey,
        body.objectives    || [],
        body.completedIndices || [],
        body.conversation  || [],
        body.quick         || false,
      )
      return NextResponse.json({ newlyCompleted, qualifyingText, sentenceQuality })
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
