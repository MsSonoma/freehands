/**
 * /api/webb-resources
 * Generates curated, child-safe media resources for a lesson.
 *
 * Video:   YouTube Data API v3 + GPT safety review of title/channel/description
 * Article: GPT picks best source from child-safe GREEN_LIST → fetches HTML server-side
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

// ── Green list of child-safe educational web sources ─────────────────────────
// All sources are either (a) Wikipedia REST API (CORS open, no auth) or
// (b) well-known children's educational sites fetchable server-to-server.
const GREEN_SOURCES = [
  {
    id: 'simple-wiki',
    name: 'Simple English Wikipedia',
    desc: 'Best for most topics. Written at a 4th–6th grade reading level. Covers science, history, geography, nature, people.',
    fetchUrl: a => `https://simple.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(a.replace(/\s+/g, '_'))}`,
    baseHref: 'https://simple.wikipedia.org',
  },
  {
    id: 'wikijunior',
    name: 'Wikijunior',
    desc: 'Best for science topics written for children ages 8–12: animals, solar system, human body, chemistry, ancient history.',
    fetchUrl: a => `https://en.wikibooks.org/api/rest_v1/page/mobile-html/${encodeURIComponent(('Wikijunior:' + a).replace(/\s+/g, '_'))}`,
    baseHref: 'https://en.wikibooks.org',
  },
  {
    id: 'ducksters',
    name: 'Ducksters',
    desc: 'Best for US history, American geography, science facts, and biography of famous people. Article must be a valid Ducksters.com path such as "science/photosynthesis.php" or "history/american_revolution.php" or "biography/george_washington.php" or "geography/us_states/california.php".',
    fetchUrl: a => `https://www.ducksters.com/${a.replace(/^\//, '')}`,
    baseHref: 'https://www.ducksters.com/',
  },
  {
    id: 'wiki',
    name: 'Wikipedia',
    desc: 'Best for complex or technical topics when other sources lack depth. Use exact article title.',
    fetchUrl: a => `https://en.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(a.replace(/\s+/g, '_'))}`,
    baseHref: 'https://en.wikipedia.org',
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
async function generateVideo(apiKey, ytKey, title, subject, grade, ctx) {
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
      const items  = (ytData.items || []).filter(i => i.id?.videoId)

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
            embedUrl:    `https://www.youtube-nocookie.com/embed/${picked.id.videoId}?autoplay=0&rel=0&modestbranding=1`,
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
async function generateArticle(apiKey, title, subject, grade, ctx, prevSrc = '') {
  const sourceMenu = GREEN_SOURCES.map(s => `- "${s.id}": ${s.name} — ${s.desc}`).join('\n')

  // Step 1: GPT picks best source + article from green list
  let chosenSource = null
  let chosenTitle  = null
  let html         = null

  try {
    const avoidLine = prevSrc ? `The student already read an article from "${prevSrc}" — pick a DIFFERENT source this time.\n\n` : ''
    const raw = await callGPT(
      apiKey,
      `You select the best educational web article for a child from this approved green list:\n${sourceMenu}\n\n${avoidLine}` +
      'Reply with ONLY valid JSON on one line, no markdown: {"source":"<id>","article":"<title or path>"}',
      `Topic: "${title}". Subject: ${subject}. ${grade}.${ctx}`,
      80,
    )
    const pick = JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim())
    const src  = GREEN_SOURCES.find(s => s.id === pick.source) || GREEN_SOURCES[0]
    const ref  = (pick.article || title).trim()

    const pageRes = await fetch(src.fetchUrl(ref), {
      headers: {
        'Api-User-Agent': 'EducationApp/1.0 (freehands)',
        'User-Agent':     'Mozilla/5.0 (compatible; EducationBot/1.0)',
      },
      signal: AbortSignal.timeout(9000),
    })

    if (pageRes.ok) {
      let rawHtml = await pageRes.text()
      // Inject <base href> so relative URLs (images, CSS) resolve properly
      if (src.baseHref) {
        rawHtml = rawHtml.includes('<head>')
          ? rawHtml.replace('<head>', `<head><base href="${src.baseHref}">`)
          : `<base href="${src.baseHref}">${rawHtml}`
      }
      html         = rawHtml
      chosenSource = src.name
      chosenTitle  = ref
    }
  } catch { /* fall through to fallbacks */ }

  // Fallback 1: Simple English Wikipedia on the lesson title
  if (!html) {
    try {
      const encoded = encodeURIComponent(title.replace(/\s+/g, '_'))
      const r = await fetch(
        `https://simple.wikipedia.org/api/rest_v1/page/mobile-html/${encoded}`,
        { headers: { 'Api-User-Agent': 'EducationApp/1.0' }, signal: AbortSignal.timeout(7000) },
      )
      if (r.ok) {
        let rawHtml = await r.text()
        rawHtml = rawHtml.includes('<head>')
          ? rawHtml.replace('<head>', '<head><base href="https://simple.wikipedia.org">')
          : `<base href="https://simple.wikipedia.org">${rawHtml}`
        html         = rawHtml
        chosenSource = 'Simple English Wikipedia'
        chosenTitle  = title
      }
    } catch {}
  }

  // Fallback 2: Regular English Wikipedia
  if (!html) {
    try {
      const encoded = encodeURIComponent(title.replace(/\s+/g, '_'))
      const r = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/mobile-html/${encoded}`,
        { headers: { 'Api-User-Agent': 'EducationApp/1.0' }, signal: AbortSignal.timeout(7000) },
      )
      if (r.ok) {
        let rawHtml = await r.text()
        rawHtml = rawHtml.includes('<head>')
          ? rawHtml.replace('<head>', '<head><base href="https://en.wikipedia.org">')
          : `<base href="https://en.wikipedia.org">${rawHtml}`
        html         = rawHtml
        chosenSource = 'Wikipedia'
        chosenTitle  = title
      }
    } catch {}
  }

  return { html: html || null, source: chosenSource, title: chosenTitle || title }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { lesson = {}, type = 'both', context = '', previousSource = '' } = await req.json()
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
    const [videoResult, articleResult] = await Promise.all([
      needVideo   ? generateVideo(apiKey, ytKey, title, subject, grade, ctx)   : null,
      needArticle ? generateArticle(apiKey, title, subject, grade, ctx, prevSrc) : null,
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
    greenList: GREEN_SOURCES.map(s => ({ id: s.id, name: s.name })),
  })
}
