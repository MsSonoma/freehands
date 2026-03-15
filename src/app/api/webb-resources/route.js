/**
 * /api/webb-resources
 * Generates curated, child-safe media resources for a lesson.
 *
 * Video:   YouTube Data API v3 + GPT picks best result.
 * Article: Fetches from child-friendly internet sources. Caller passes
 *          `preferredSources` (array of source IDs); server shuffles those,
 *          tries each until one succeeds, then falls back to Simple Wikipedia.
 *
 * POST { lesson, type, context?, preferredSources?, excludeVideoIds? }
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const YT_SEARCH    = 'https://www.googleapis.com/youtube/v3/search'

// ── Article sources catalogue ─────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function _fetchHtml(url, baseHref, sourceName) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(9000),
    })
    if (!r.ok) return null
    let html = await r.text()
    if (!html.includes('<')) return null
    const styleOverride = `<style>
      header,nav,footer,.nav,.header,.footer,.sidebar,.ad,.ads,.advertisement,
      .site-nav,.breadcrumb,.breadcrumbs,[class*="navigation"],[class*="menu"],
      [id*="navigation"],[id*="header"],[id*="footer"],[id*="menu"],
      [class*="social"],[class*="share"]{display:none!important}
      body{font-size:15px!important;line-height:1.75!important;max-width:700px!important;margin:0 auto!important;padding:14px 18px!important}
      img{max-width:100%!important;height:auto!important}
    </style>`
    html = html.includes('<head>')
      ? html.replace('<head>', `<head><base href="${baseHref}">${styleOverride}`)
      : `<base href="${baseHref}">${styleOverride}${html}`
    return { html, source: sourceName }
  } catch { return null }
}

export const ARTICLE_SOURCES = [
  {
    id: 'simple-wikipedia',
    label: 'Simple Wikipedia',
    async fetch(term) {
      const slug = term.replace(/\s+/g, '_')
      return _fetchHtml(
        `https://simple.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(slug)}`,
        'https://simple.wikipedia.org', 'Simple Wikipedia',
      )
    },
  },
  {
    id: 'wikipedia',
    label: 'Wikipedia',
    async fetch(term) {
      const slug = term.replace(/\s+/g, '_')
      return _fetchHtml(
        `https://en.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(slug)}`,
        'https://en.wikipedia.org', 'Wikipedia',
      )
    },
  },
  {
    id: 'britannica-kids',
    label: 'Britannica Kids',
    async fetch(term, slug) {
      return _fetchHtml(
        `https://kids.britannica.com/kids/article/${encodeURIComponent(slug || term.toLowerCase().replace(/\s+/g, '-'))}`,
        'https://kids.britannica.com', 'Britannica Kids',
      )
    },
  },
  {
    id: 'national-geographic-kids',
    label: 'Nat Geo Kids',
    async fetch(term, slug) {
      return _fetchHtml(
        `https://kids.nationalgeographic.com/nature/article/${encodeURIComponent(slug || term.toLowerCase().replace(/\s+/g, '-'))}`,
        'https://kids.nationalgeographic.com', 'Nat Geo Kids',
      )
    },
  },
  {
    id: 'ducksters',
    label: 'Ducksters',
    async fetch(term, slug) {
      const path = slug || term.toLowerCase().replace(/\s+/g, '_')
      return _fetchHtml(
        `https://www.ducksters.com/science/${encodeURIComponent(path)}.php`,
        'https://www.ducksters.com', 'Ducksters',
      )
    },
  },
  {
    id: 'wikijunior',
    label: 'Wikijunior',
    async fetch(term) {
      const slug = term.replace(/\s+/g, '_')
      return _fetchHtml(
        `https://en.wikibooks.org/api/rest_v1/page/mobile-html/Wikijunior%3A${encodeURIComponent(slug)}`,
        'https://en.wikibooks.org', 'Wikijunior',
      )
    },
  },
]

export const DEFAULT_ARTICLE_SOURCE_IDS = ARTICLE_SOURCES.map(s => s.id)

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
        `&type=video&safeSearch=strict&videoEmbeddable=true&videoCaption=closedCaption&relevanceLanguage=en&maxResults=5` +
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
            embedUrl:    `https://www.youtube-nocookie.com/embed/${picked.id.videoId}?autoplay=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1&controls=0&playsinline=1`,
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
async function generateArticle(apiKey, title, grade, preferredSources) {
  // Resolve the best search term for this lesson (used as slug base)
  let searchTerm = title
  try {
    const raw = await callGPT(
      apiKey,
      'You find the best short search term for a school lesson topic. ' +
      'Return ONLY 1–4 words, lowercase, no punctuation, no extra text.',
      `Lesson: "${title.slice(0, 120)}". Grade: ${grade}.`,
      20,
    )
    if (raw && raw.length > 1 && raw.length < 60) searchTerm = raw
  } catch { /* use raw title */ }

  // Pick sources to try — shuffle for variety — always end with Simple Wikipedia as guaranteed fallback
  const preferred = Array.isArray(preferredSources) && preferredSources.length
    ? preferredSources
    : DEFAULT_ARTICLE_SOURCE_IDS
  const sourceObjs = shuffle(
    ARTICLE_SOURCES.filter(s => preferred.includes(s.id) && s.id !== 'simple-wikipedia'),
  )
  // Always put simple-wikipedia as the final fallback if not already in list
  const fallback = ARTICLE_SOURCES.find(s => s.id === 'simple-wikipedia')
  const toTry = [...sourceObjs, ...(fallback ? [fallback] : [])]

  // Also try with the raw lesson title as alternate term
  const terms = searchTerm.toLowerCase() !== title.toLowerCase()
    ? [searchTerm, title]
    : [searchTerm]

  for (const src of toTry) {
    for (const term of terms) {
      try {
        const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, src.id === 'ducksters' ? '_' : '-').replace(/^[-_]|[-_]$/g, '')
        const result = await src.fetch(term, slug)
        if (result?.html) return { ...result, title }
      } catch { /* try next */ }
    }
  }

  return { html: null, source: null, title }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { lesson = {}, type = 'both', context = '', preferredSources, excludeVideoIds = [] } = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    const ytKey  = process.env.YOUTUBE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

    const title   = lesson.title   || 'general topic'
    const subject = lesson.subject || 'general'
    const grade   = lesson.grade   ? `Grade ${lesson.grade}` : 'elementary'
    const ctx     = context ? ` Student discussion context: ${context.slice(0, 300)}` : ''

    const needVideo   = type === 'video'   || type === 'both'
    const needArticle = type === 'article' || type === 'both'

    // Run video and article generation in parallel
    const safeExcludeVids = Array.isArray(excludeVideoIds) ? excludeVideoIds.slice(0, 20) : []
    const [videoResult, articleResult] = await Promise.all([
      needVideo   ? generateVideo(apiKey, ytKey, title, subject, grade, ctx, safeExcludeVids) : null,
      needArticle ? generateArticle(apiKey, title, grade, preferredSources) : null,
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
    articleSources: ARTICLE_SOURCES.map(s => ({ id: s.id, label: s.label })),
  })
}
