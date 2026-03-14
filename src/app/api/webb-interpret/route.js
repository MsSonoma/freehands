/**
 * /api/webb-interpret
 * Finds the most educationally relevant passage in a Wikipedia article
 * for a given lesson, so Mrs. Webb can highlight and read it aloud.
 *
 * POST { html, lessonTitle, grade }
 * Returns { excerpt, intro }
 *   excerpt — 2–3 verbatim sentences from the article text
 *   intro   — friendly 1-sentence lead-in for Mrs. Webb to speak first
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
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
    const { html = '', lessonTitle = '', grade = 'elementary' } = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
    if (!html)   return NextResponse.json({ error: 'No html'        }, { status: 400 })

    // Strip to plain text, limit to 4000 chars to keep token cost low
    const plainText = stripHtml(html).slice(0, 4000)

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a teacher\'s assistant. You find the most educationally important ' +
              'passage in an article for a student, then write a warm introduction for the teacher to say.',
          },
          {
            role: 'user',
            content:
              `The student is in ${grade} and learning about "${lessonTitle}".\n\n` +
              `From the article text below, copy 2–3 consecutive sentences that best explain ` +
              `the core concept. The sentences must appear VERBATIM in the text — do not paraphrase.\n\n` +
              `Then on a new line write: INTRO: [one friendly sentence Mrs. Webb says before reading it]\n\n` +
              `Article text:\n${plainText}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    })
    if (!res.ok) throw new Error('OpenAI error ' + res.status)
    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content || '').trim()

    const introMatch = raw.match(/INTRO:\s*(.+)/i)
    const intro  = introMatch ? introMatch[1].trim() : `Here's an important part about ${lessonTitle}!`
    const excerpt = raw.replace(/INTRO:[\s\S]*/i, '').trim()

    return NextResponse.json({ excerpt, intro })
  } catch (e) {
    console.error('webb-interpret error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
