/**
 * /api/webb-interpret
 * Finds the most educationally relevant passage in a Wikipedia article
 * for a given lesson, so Mrs. Webb can highlight and read it aloud.
 *
 * POST { html, lessonTitle, grade, learnerName? }
 * Returns { excerpt, intro }
 *   excerpt — 2–3 verbatim sentences from the article body text
 *   intro   — friendly 1-sentence lead-in for Mrs. Webb to speak first
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

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
    const { html = '', lessonTitle = '', grade = 'elementary', learnerName = '' } = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
    if (!html)   return NextResponse.json({ error: 'No html'        }, { status: 400 })

    // Strip to plain text, limit to 6000 chars so GPT can look past the intro
    const plainText = stripHtml(html).slice(0, 6000)
    const nameClause = learnerName ? `The student's name is ${learnerName}.` : ''
    const addressAs  = learnerName ? learnerName : 'you'

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
              `Pick 2–3 passages from DIFFERENT sections of the article body — NOT the opening ` +
              `paragraph, NOT photo captions, NOT image descriptions, NOT table entries. ` +
              `Each passage must be 2 consecutive verbatim sentences from the article. ` +
              `Choose passages that together tell a great educational story about the topic — ` +
              `concrete facts, surprising details, important causes or effects. ` +
              `List them in the order they appear in the article (top to bottom). ` +
              `Then write ONE warm intro sentence Mrs. Webb says before starting — ` +
              `address the student as "${addressAs}" (never "class", "students", or "everyone").`,
          },
          {
            role: 'user',
            content:
              `Grade: ${grade}. Lesson: "${lessonTitle}".\n\n` +
              `Return exactly this format:\n` +
              `EXCERPT 1: [2 verbatim sentences from somewhere past the first paragraph]\n` +
              `EXCERPT 2: [2 verbatim sentences from a different section]\n` +
              `EXCERPT 3: [2 verbatim sentences from a different section]\n` +
              `INTRO: [Mrs. Webb's one warm lead-in sentence]\n\n` +
              `Article text:\n${plainText}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    })
    if (!res.ok) throw new Error('OpenAI error ' + res.status)
    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content || '').trim()

    const introMatch = raw.match(/INTRO:\s*(.+)/i)
    const intro = introMatch ? introMatch[1].trim() : `Let me show you some key parts about ${lessonTitle}!`

    const passages = []
    const excerptRe = /EXCERPT\s*\d+:\s*([^\n]+(?:\n(?!EXCERPT|INTRO)[^\n]+)*)/gi
    let m
    while ((m = excerptRe.exec(raw)) !== null) {
      const excerpt = m[1].trim()
      if (excerpt) passages.push({ excerpt })
    }

    // Fallback: if parsing fails, treat everything before INTRO as one passage
    if (!passages.length) {
      const fallback = raw.replace(/INTRO:[\s\S]*/i, '').trim()
      if (fallback) passages.push({ excerpt: fallback })
    }

    return NextResponse.json({ passages, intro })
  } catch (e) {
    console.error('webb-interpret error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
