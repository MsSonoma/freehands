/**
 * /api/webb-interpret
 * Finds the most educationally relevant passage in a Wikipedia article
 * for a given lesson, so Mrs. Webb can highlight and read it aloud.
 *
 * POST { html, lessonTitle, grade, learnerName?, objectives?, completedIndices? }
 * Returns { passages: [{ excerpt }], intro }
 *   excerpt — 2–3 verbatim sentences from the article body text
 *   intro   — friendly 1-sentence lead-in for Mrs. Webb to speak first
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
import { AI_MODEL } from '@/app/lib/aiModel'
const OPENAI_MODEL = AI_MODEL

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove figure captions, image descriptions, table headers, nav, footer
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, '')
    .replace(/<caption[^>]*>[\s\S]*?<\/caption>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function POST(req) {
  try {
    const { html = '', lessonTitle = '', grade = 'elementary', learnerName = '', objectives = [], completedIndices = [] } = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
    if (!html)   return NextResponse.json({ error: 'No html'        }, { status: 400 })

    // Strip to plain text, limit to 6000 chars so GPT can look past the intro
    const plainText = stripHtml(html).slice(0, 6000)
    const nameClause = learnerName ? `The student's name is ${learnerName}.` : ''
    const addressAs  = learnerName ? learnerName : 'you'

    const uncompleted = objectives.filter((_, i) => !completedIndices.includes(i))
    // When called from Research, uncompleted is always a single objective — be explicit
    const primaryObjective = uncompleted.length === 1 ? uncompleted[0] : null
    const objClause = uncompleted.length
      ? primaryObjective
        ? `YOUR ONLY JOB is to find passages that teach this ONE learning objective: "${primaryObjective}". ` +
          `Every passage you pick MUST directly explain or demonstrate this concept. ` +
          `Reject any passage — no matter how interesting — that does not address this objective. `
        : `You MUST choose passages that directly address one or more of these learning objectives:\n${uncompleted.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n` +
          `Each passage must visibly teach or demonstrate an objective — not just mention the topic in passing. `
      : ''

    // Repeated in user message so GPT stays anchored to the objective through the format task
    const objReminder = primaryObjective
      ? `\n\nTARGET OBJECTIVE (all passages must address this): "${primaryObjective}"`
      : uncompleted.length
        ? `\n\nLearning objectives to address:\n${uncompleted.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
        : ''

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              `You help Mrs. Webb, an AI teacher, guide a student through an article. ` +
              `${nameClause} ` +
              `${objClause}` +
              `Pick 2–3 passages from DIFFERENT sections of the article body — NOT the opening ` +
              `paragraph, NOT photo captions, NOT image descriptions, NOT table entries. ` +
              `Each passage must be 2 consecutive verbatim sentences from the article. ` +
              `If no passage in the article directly addresses the target objective, pick the closest available and note it in SPOKEN. ` +
              `List them in the order they appear in the article (top to bottom). ` +
              `Then write ONE warm intro sentence Mrs. Webb says before starting — ` +
              `address the student as "${addressAs}" (never "class", "students", or "everyone").`,
          },
          {
            role: 'user',
            content:
              `Grade: ${grade}. Lesson: "${lessonTitle}".${objReminder}\n\n` +
              `Return exactly this format:\n` +
              `EXCERPT 1: [2 verbatim sentences that teach the target objective]\n` +
              `SPOKEN 1: [Rewrite EXCERPT 1 in 1–2 friendly sentences a ${grade} student can understand. Use simple words, no jargon. Mrs. Webb is speaking warmly to the student — not quoting a textbook.]\n` +
              `EXCERPT 2: [2 verbatim sentences from a different section that teach the target objective]\n` +
              `SPOKEN 2: [Rewrite EXCERPT 2 in 1–2 friendly sentences a ${grade} student can understand.]\n` +
              `EXCERPT 3: [2 verbatim sentences from a different section that teach the target objective]\n` +
              `SPOKEN 3: [Rewrite EXCERPT 3 in 1–2 friendly sentences a ${grade} student can understand.]\n` +
              `INTRO: [Mrs. Webb's one warm lead-in sentence]\n\n` +
              `Article text:\n${plainText}`,
          },
        ],
        max_completion_tokens: 900,
        temperature: 0.2,
      }),
    })
    if (!res.ok) throw new Error('OpenAI error ' + res.status)
    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content || '').trim()

    const introMatch = raw.match(/INTRO:\s*(.+)/i)
    const intro = introMatch ? introMatch[1].trim() : `Let me show you some key parts about ${lessonTitle}!`

    const passages = []
    const excerptRe = /EXCERPT\s*(\d+):\s*([^\n]+(?:\n(?!EXCERPT|SPOKEN|INTRO)[^\n]+)*)/gi
    const spokenMap = {}
    const spokenRe  = /SPOKEN\s*(\d+):\s*([^\n]+(?:\n(?!EXCERPT|SPOKEN|INTRO)[^\n]+)*)/gi
    let m
    while ((m = spokenRe.exec(raw)) !== null) {
      spokenMap[m[1]] = m[2].trim()
    }
    while ((m = excerptRe.exec(raw)) !== null) {
      const idx     = m[1]
      const excerpt = m[2].trim()
      if (excerpt) passages.push({ excerpt, spoken: spokenMap[idx] || null })
    }

    // Fallback: if parsing fails, treat everything before INTRO as one passage
    if (!passages.length) {
      const fallback = raw.replace(/INTRO:[\s\S]*/i, '').trim()
      if (fallback) passages.push({ excerpt: fallback, spoken: null })
    }

    return NextResponse.json({ passages, intro })
  } catch (e) {
    console.error('webb-interpret error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
