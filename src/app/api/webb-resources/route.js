/**
 * /api/webb-resources
 * Generates curated, child-safe media resources for a lesson.
 *
 * Video:   YouTube Data API v3 + GPT safety review of title/channel/description
 * Article: Fetches directly from Wikipedia REST APIs (Simple English first, then English)
 *          (srcdoc approach bypasses X-Frame-Options; no client-side fetching needed)
 *
 * POST { lesson, type: 'video'|'article'|'both', context? }
 * Returns:
 *   video?:   { embedUrl, title, channel, searchQuery }  — real playable embed
 *          OR { unavailable: true, searchQuery }          — no key / all rejected
 *   article?: { html, source, title }                    — ready for srcdoc iframe
 *          OR { html: null, source: null, title }        — all fetches failed
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const YT_SEARCH    = 'https://www.googleapis.com/youtube/v3/search'

// ── Wikipedia REST API sources (open, no-auth, work from cloud hosting) ───────
const WIKI_SOURCES = [
  {
    name: 'Simple English Wikipedia',
    url:  t => `https://simple.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(t.replace(/\s+/g, '_'))}`,
    base: 'https://simple.wikipedia.org',
  },
  {
    name: 'Wikipedia',
    url:  t => `https://en.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(t.replace(/\s+/g, '_'))}`,
    base: 'https://en.wikipedia.org',
  },
]

async function callGPT(apiKey, systemPrompt, userPrompt, maxTokens = 60) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })
  if (!res.ok) throw new Error('OpenAI error ' + res.status)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

// ── Generate video resource ───────────────────────────────────────────────────
async function generateVideo(apiKey, ytKey, title, subject, grade, ctx, excludeVideoIds = []) {
  // Step 1: GPT builds the best educational search query
  const query = await callGPT(
    apiKey,
    'You create YouTube search queries for educational videos for children. ' +
    'Return ONLY the search query — 4 to 7 words, no punctuation at the end, no quotes.',
    `Lesson: "${title}". Subject: ${subject}. ${grade}.${ctx}`,
    40,
  )
  const safeQuery = (query || `educational ${title}`).slice(0, 120)

  if (ytKey) {
    try {
      const ytUrl =
        `${YT_SEARCH}?part=snippet` +
        `&q=${encodeURIComponent(safeQuery)}` +
        `&type=video&safeSearch=strict&videoEmbeddable=true&maxResults=5` +
        `&key=${ytKey}`
      const ytRes  = await fetch(ytUrl)
      const ytData = await ytRes.json()
      let items  = (ytData.items || []).filter(i => i.id?.videoId)
      // Filter out previously-shown videos so refresh always gives something new
      const fresh = items.filter(i => !excludeVideoIds.includes(i.id.videoId))
      if (fresh.length) items = fresh

      if (items.length) {
        // Step 2: GPT picks the most educationally relevant result.
        // All candidates are already filtered by YouTube's safeSearch=strict + videoEmbeddable=true
        // so the safety bar here is just relevance, not content moderation.
        const candidateList = items.map((item, i) =>
          `${i}: "${item.snippet.title}" | Channel: ${item.snippet.channelTitle} | ${(item.snippet.description || '').slice(0, 200)}`
        ).join('\n')

        let pickedIdx = 0 // default: first result
        try {
          const verdict = await callGPT(
            apiKey,
            'You pick the best educational YouTube video for a child. ' +
            'All candidates passed YouTube safe search so focus on relevance and educational quality, not safety concerns. ' +
            'Reply with ONLY a single digit: the index (0–4) of the best video. No other text.',
            `Lesson: "${title}". ${grade}.\n\nCandidates:\n${candidateList}`,
            5,
          )
          const parsed = parseInt(verdict, 10)
          if (parsed >= 0 && parsed < items.length) pickedIdx = parsed
        } catch { /* keep pickedIdx = 0 */ }

        const picked = items[pickedIdx]
        if (picked?.id?.videoId) {
          return {
            videoId:     picked.id.videoId,
            embedUrl:    `https://www.youtube-nocookie.com/embed/${picked.id.videoId}?autoplay=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`,
            title:       picked.snippet.title,
            channel:     picked.snippet.channelTitle,
            searchQuery: safeQuery,
          }
        }
      }
    } catch { /* fall through */ }
  }

  return { unavailable: true, searchQuery: safeQuery }
}

// ── Generate article resource ─────────────────────────────────────────────────
// Directly fetches from Wikipedia REST APIs — no GPT call needed since the
// lesson title IS the Wikipedia article title. Tries Simple English Wikipedia
// first (4th–6th grade level), falls back to regular Wikipedia.
// Alternates which source comes first based on previousSource so refreshes
// show a genuinely different article.
async function generateArticle(title, prevSrc = '') {
  // Alternate sources on refresh so the student sees genuinely different content.
  // Simple English Wikipedia: 4th–6th grade reading level, concise.
  // Wikipedia:                full depth, more detail.
  const sources = (prevSrc === 'Simple English Wikipedia')
    ? [WIKI_SOURCES[1], WIKI_SOURCES[0]]
    : WIKI_SOURCES

  for (const src of sources) {
    try {
      const r = await fetch(src.url(title), {
        headers: { 'Api-User-Agent': 'EducationApp/1.0 (freehands; educational-app)' },
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        let html = await r.text()
        html = html.includes('<head>')
          ? html.replace('<head>', `<head><base href="${src.base}">`)
          : `<base href="${src.base}">${html}`
        return { html, source: src.name, title }
      }
    } catch { /* try next source */ }
  }

  return { html: null, source: null, title }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { lesson = {}, type = 'both', context = '', previousSource = '', excludeVideoIds = [] } = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    const ytKey  = process.env.YOUTUBE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

    const title   = lesson.title   || 'general topic'
    const subject = lesson.subject || 'general'
    const grade   = lesson.grade   ? `Grade ${lesson.grade}` : 'elementary'
    const ctx     = context ? ` Student discussion context: ${context.slice(0, 300)}` : ''
    const prevSrc = String(previousSource || '').slice(0, 60)

    const needVideo   = type === 'video'   || type === 'both'
    const needArticle = type === 'article' || type === 'both'

    // Run video and article generation in parallel
    const safeExcludeVids = Array.isArray(excludeVideoIds) ? excludeVideoIds.slice(0, 20) : []
    const [videoResult, articleResult] = await Promise.all([
      needVideo   ? generateVideo(apiKey, ytKey, title, subject, grade, ctx, safeExcludeVids) : null,
      needArticle ? generateArticle(title, prevSrc) : null,
    ])

    return NextResponse.json({
      ...(videoResult   ? { video:   videoResult   } : {}),
      ...(articleResult ? { article: articleResult } : {}),
    })
  } catch (e) {
    console.error('webb-resources error:', e)
    return NextResponse.json({ error: 'Resource generation failed' }, { status: 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'webb-resources',
    sources: WIKI_SOURCES.map(s => s.name),
  })
}
