/**
 * /api/webb-resources
 * Generates curated media resources for a lesson:
 *   type=video   → YouTube search embed URL
 *   type=article → Short educational reading passage (plain text)
 *   type=both    → Both in one call (used for preloading)
 *
 * POST body:
 *   { lesson: { title, subject, grade }, type: 'video'|'article'|'both', context?: string }
 *   context = recent conversation snippet (for on-demand refresh)
 *
 * Returns:
 *   { video?: { embedUrl, searchQuery }, article?: { title, text } }
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

async function callGPT(apiKey, systemPrompt, userPrompt, maxTokens = 60) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.5,
    }),
  })
  if (!res.ok) throw new Error('OpenAI error ' + res.status)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function POST(req) {
  try {
    const { lesson = {}, type = 'both', context = '' } = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

    const title   = lesson.title   || 'general topic'
    const subject = lesson.subject || 'general'
    const grade   = lesson.grade   ? `Grade ${lesson.grade}` : 'elementary'
    const ctx     = context ? ` The student discussion so far touches on: ${context.slice(0, 300)}` : ''

    const result = {}

    // ── Video: generate a tight YouTube search query ─────────────────────
    if (type === 'video' || type === 'both') {
      const query = await callGPT(
        apiKey,
        'You create YouTube search queries for educational videos aimed at children. ' +
        'Return ONLY the search query — 4 to 7 words — that would find the best educational video. ' +
        'Prefix with "educational" or a relevant domain word. No quotes, no punctuation at the end.',
        `Lesson: "${title}". Subject: ${subject}. ${grade}.${ctx}`,
        40,
      )
      const safeQuery = query || `educational ${title}`
      result.video = {
        searchQuery: safeQuery,
        // YouTube iframe with listType=search shows search results inline
        embedUrl: `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(safeQuery)}&rel=0&modestbranding=1`,
      }
    }

    // ── Article: generate a short reading passage ─────────────────────────
    if (type === 'article' || type === 'both') {
      const text = await callGPT(
        apiKey,
        'You are an educational content writer for children. ' +
        'Write a short, friendly reading passage — 150 to 200 words — in plain paragraphs. ' +
        'No lists, no markdown, no headers. Age-appropriate, engaging, factually accurate. ' +
        'The passage should read like a mini article a student would enjoy.',
        `Topic: "${title}". Subject: ${subject}. ${grade}.${ctx} Write the passage now:`,
        380,
      )
      result.article = {
        title,
        text: text || `Let's explore ${title}! This is a fascinating topic in ${subject}.`,
      }
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('webb-resources error:', e)
    return NextResponse.json({ error: 'Resource generation failed' }, { status: 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'webb-resources' })
}
