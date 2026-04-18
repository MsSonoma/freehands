/**
 * /api/webb-resources
 * Generates curated, child-safe media resources for a lesson.
 *
 * Video:   YouTube Data API v3 + GPT picks best result.
 * Article: Fetches from child-friendly internet sources. Caller passes
 *          `preferredSources` (array of source IDs); server shuffles those,
 *          tries each until one succeeds, then falls back to Simple Wikipedia.
 *          `excludeSourceId` = source ID last shown; rotated to last so refresh
 *          always picks a different source first.
 *
 * POST { lesson, type, context?, preferredSources?, excludeSourceId?, excludeVideoIds? }
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const YT_SEARCH    = 'https://www.googleapis.com/youtube/v3/search'
const YT_VIDEOS    = 'https://www.googleapis.com/youtube/v3/videos'

// ── Article sources catalogue ─────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function _fetchHtml(url, baseHref, sourceId, sourceLabel) {
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
    // Return BOTH the human-readable label AND the stable ID so clients can
    // compare by ID for excludeSourceId rotation (label ≠ id).
    return { html, source: sourceLabel, sourceId }
  } catch { return null }
}

// ── Article title relevance guard ─────────────────────────────────────────────
// Returns true if the resolved article title looks plausibly on-topic.
// Compares word overlap between lesson title and article title after stripping
// common stop-words and short tokens. Prevents returning "The Basics" (a band)
// for a lesson about "Basics of Economics".
const STOP_WORDS = new Set([
  'the','a','an','of','in','on','at','to','for','and','or','but','is','are',
  'was','were','be','been','by','as','with','about','from','that','this',
  'how','what','why','which','when','where','do','does','did',
])
function articleTitleIsRelevant(lessonTitle, articleTitle) {
  const tokens = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
  const lessonWords = new Set(tokens(lessonTitle))
  const articleWords = tokens(articleTitle)
  // Pass if any content word from the lesson title appears in the article title
  if (articleWords.some(w => lessonWords.has(w))) return true
  // Also pass if the lesson search term is a substring of the article title
  // (handles plurals, possessives, slight variations)
  const normLesson  = lessonTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
  const normArticle = articleTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normArticle.includes(normLesson) || normLesson.includes(normArticle)
}

export const ARTICLE_SOURCES = [
  {
    id: 'simple-wikipedia',
    label: 'Simple Wikipedia',
    async fetch(term, lessonTitle) {
      // Use the search API first so any lesson topic resolves to a real article
      // (exact-title lookup 404s for topics like "Story Elements" or "Adding Fractions")
      let slug = term.replace(/\s+/g, '_')
      try {
        const sr = await fetch(
          `https://simple.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=1&format=json`,
          { headers: { 'User-Agent': 'EducationalApp/1.0' }, signal: AbortSignal.timeout(5000) },
        )
        if (sr.ok) {
          const sd = await sr.json()
          const found = sd?.query?.search?.[0]?.title
          if (found) {
            if (!articleTitleIsRelevant(lessonTitle || term, found)) return null
            slug = found.replace(/\s+/g, '_')
          }
        }
      } catch { /* fall back to raw term */ }
      return _fetchHtml(
        `https://simple.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(slug)}`,
        'https://simple.wikipedia.org', 'simple-wikipedia', 'Simple Wikipedia',
      )
    },
  },
  {
    id: 'wikipedia',
    label: 'Wikipedia',
    async fetch(term, lessonTitle) {
      // Use the search API first so any lesson topic resolves to a real article
      let slug = term.replace(/\s+/g, '_')
      try {
        const sr = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=1&format=json`,
          { headers: { 'User-Agent': 'EducationalApp/1.0' }, signal: AbortSignal.timeout(5000) },
        )
        if (sr.ok) {
          const sd = await sr.json()
          const found = sd?.query?.search?.[0]?.title
          if (found) {
            if (!articleTitleIsRelevant(lessonTitle || term, found)) return null
            slug = found.replace(/\s+/g, '_')
          }
        }
      } catch { /* fall back to raw term */ }
      return _fetchHtml(
        `https://en.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(slug)}`,
        'https://en.wikipedia.org', 'wikipedia', 'Wikipedia',
      )
    },
  },
  {
    id: 'kiddle',
    label: 'Kiddle',
    // Kiddle (kids.kiddle.co) is a kid-safe encyclopedia using Wikipedia article titles.
    // We resolve the best-matching title via Wikipedia's search API, then fetch from Kiddle.
    async fetch(term, lessonTitle) {
      let slug = term.replace(/\s+/g, '_')
      try {
        const sr = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=1&format=json`,
          { headers: { 'User-Agent': 'EducationalApp/1.0' }, signal: AbortSignal.timeout(5000) },
        )
        if (sr.ok) {
          const sd = await sr.json()
          const found = sd?.query?.search?.[0]?.title
          if (found) {
            if (!articleTitleIsRelevant(lessonTitle || term, found)) return null
            slug = found.replace(/\s+/g, '_')
          }
        }
      } catch { /* fall back to raw term */ }
      return _fetchHtml(
        `https://kids.kiddle.co/${encodeURIComponent(slug)}`,
        'https://kids.kiddle.co', 'kiddle', 'Kiddle',
      )
    },
  },
  {
    id: 'ducksters',
    label: 'Ducksters',
    // Ducksters URLs are section-based (e.g. /science/, /history/, /geography/).
    // Ask GPT for the correct full path rather than guessing /science/.
    async fetch(term, _lessonTitle, apiKey) {
      let path = null
      if (apiKey) {
        try {
          const raw = await callGPT(
            apiKey,
            'You generate Ducksters.com article URL paths for school topics. ' +
            'Format: section/topic_filename with underscores and lowercase only ' +
            '(e.g. "science/photosynthesis", "history/american_revolution", "geography/amazon_river"). ' +
            'Return ONLY the path — no .php extension, no domain, no extra text.',
            `Topic: "${term}"`,
            30,
          )
          if (raw && /^[a-z][a-z0-9_/]*$/.test(raw) && raw.includes('/')) path = raw.trim()
        } catch { /* ignore */ }
      }
      if (!path) {
        // Fallback: guess /science/ section
        path = `science/${term.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
      }
      return _fetchHtml(
        `https://www.ducksters.com/${path}.php`,
        'https://www.ducksters.com', 'ducksters', 'Ducksters',
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
        'https://en.wikibooks.org', 'wikijunior', 'Wikijunior',
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
// Detect whether a YouTube description contains ≥2 chapter timestamp markers.
function hasChapterMarkers(description) {
  let count = 0
  for (const line of (description || '').split('\n')) {
    if (/^\d+:\d{2}(?::\d{2})?\s+\S{3,}/.test(line) && ++count >= 2) return true
  }
  return false
}

// ── Generate video resource ───────────────────────────────────────────────────
// Returns a tiered result so page.jsx can tune Mrs. Webb's dialogue:
//   relevanceTier: 'high' (score ≥ 7) | 'low' (score 3–6)
//   hasChapters / hasCaptions: drive Key Part behaviour
//   unavailable: true + reason → don't show the video at all
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

  if (!ytKey) return { unavailable: true, reason: 'no_key', searchQuery: safeQuery }

  try {
    // ── 1. Broad search — no caption filter so the pool stays rich ───────
    const ytUrl =
      `${YT_SEARCH}?part=snippet` +
      `&q=${encodeURIComponent(safeQuery)}` +
      `&type=video&safeSearch=strict&videoEmbeddable=true&relevanceLanguage=en&maxResults=10` +
      `&key=${ytKey}`
    const ytRes  = await fetch(ytUrl)
    const ytData = await ytRes.json()
    if (ytData.error) {
      console.error('[webb-resources] YouTube search error:', ytData.error.code, ytData.error.message)
      return { unavailable: true, reason: 'api_error', searchQuery: safeQuery }
    }
    let items = (ytData.items || []).filter(i => i.id?.videoId)
    const fresh = items.filter(i => !excludeVideoIds.includes(i.id.videoId))
    if (fresh.length) items = fresh
    if (!items.length) return { unavailable: true, reason: 'no_results', searchQuery: safeQuery }

    // ── 2. GPT scores each candidate for direct lesson relevance (0–10) ──
    // 8–10 = directly teaches the topic; 5–7 = related context;
    // 2–4 = loosely related; 0–1 = unrelated → dropped below.
    const candidateList = items.map((item, i) =>
      `${i}: "${item.snippet.title}" | Channel: ${item.snippet.channelTitle} | ${(item.snippet.description || '').slice(0, 150)}`
    ).join('\n')
    let scoreMap = {}
    try {
      const raw = await callGPT(
        apiKey,
        'You score YouTube video candidates for educational relevance to a lesson topic. ' +
        'Score each 0–10: 8–10 = directly teaches the exact topic, 5–7 = related context, ' +
        '2–4 = loosely related, 0–1 = unrelated. ' +
        'Reply ONLY with a JSON array — no other text: [{"idx":0,"score":8},{"idx":1,"score":3},...]',
        `Lesson: "${title}". Subject: ${subject}. ${grade}.\n\nCandidates:\n${candidateList}`,
        200,
      )
      const arr = JSON.parse(raw.match(/\[[\s\S]*?\]/)?.[0] || '[]')
      if (Array.isArray(arr)) arr.forEach(e => { if (typeof e.idx === 'number') scoreMap[e.idx] = e.score ?? 5 })
    } catch { /* default scores used below */ }

    // Treat unscored candidates as mid-range (5); drop score < 3 (completely irrelevant)
    const scored = items
      .map((item, i) => ({ item, relevanceScore: scoreMap[i] ?? 5 }))
      .filter(c => c.relevanceScore >= 3)
    if (!scored.length) return { unavailable: true, reason: 'irrelevant', searchQuery: safeQuery }

    // ── 3. Batch-fetch chapters + caption metadata for the top candidates ─
    const topN      = scored.slice(0, 6)
    const vidIds    = topN.map(c => c.item.id.videoId).join(',')
    const detailMap = {}
    try {
      const dr = await fetch(`${YT_VIDEOS}?part=snippet,contentDetails&id=${vidIds}&key=${ytKey}`)
      const dj = await dr.json()
      for (const v of (dj.items || [])) {
        detailMap[v.id] = {
          hasCaptions: v.contentDetails?.caption === 'true',
          hasChapters: hasChapterMarkers(v.snippet?.description || ''),
        }
      }
    } catch { /* omit detail bonuses if this fails */ }

    // ── 4. Composite rank: relevance × 10 + captions bonus + chapters bonus
    // Captions are weighted higher than chapters (both add value; neither blocks).
    const ranked = topN.map(c => {
      const vid = c.item.id.videoId
      const det = detailMap[vid] || {}
      return {
        vid,
        item:           c.item,
        relevanceScore: c.relevanceScore,
        hasCaptions:    det.hasCaptions || false,
        hasChapters:    det.hasChapters || false,
        composite:      c.relevanceScore * 10 + (det.hasCaptions ? 20 : 0) + (det.hasChapters ? 15 : 0),
      }
    }).sort((a, b) => b.composite - a.composite)

    const best = ranked[0]
    return {
      videoId:       best.vid,
      embedUrl:      `https://www.youtube-nocookie.com/embed/${best.vid}?autoplay=0&rel=0&iv_load_policy=3&enablejsapi=1&controls=1&playsinline=1`,
      title:         best.item.snippet.title,
      channel:       best.item.snippet.channelTitle,
      searchQuery:   safeQuery,
      relevanceTier: best.relevanceScore >= 7 ? 'high' : 'low',
      hasChapters:   best.hasChapters,
      hasCaptions:   best.hasCaptions,
    }
  } catch (e) {
    console.error('[webb-resources generateVideo]', e)
    return { unavailable: true, reason: 'error', searchQuery: safeQuery }
  }
}

// ── Generate article resource ─────────────────────────────────────────────────
async function generateArticle(apiKey, title, grade, preferredSources, excludeSourceId) {
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

  // Build the try-list with source diversity:
  //   - `wikipedia` and `simple-wikipedia` are treated as a family: if the currently
  //     shown article is either one, push BOTH to the back so the non-wiki sources
  //     are always tried first (they look different; wiki variants look identical).
  //   - The explicitly excluded sourceId is tried last within its group.
  //   - simple-wikipedia is always the absolute last-resort fallback.
  const preferred = Array.isArray(preferredSources) && preferredSources.length
    ? preferredSources
    : DEFAULT_ARTICLE_SOURCE_IDS
  const WIKI_FAMILY = new Set(['wikipedia', 'simple-wikipedia'])
  const excludeIsWiki = WIKI_FAMILY.has(excludeSourceId)
  // eligible = all preferred sources except simple-wikipedia (it's the guaranteed fallback)
  const eligible = ARTICLE_SOURCES.filter(
    s => preferred.includes(s.id) && s.id !== 'simple-wikipedia',
  )
  // "deferred" = sources pushed to back: the excluded one, plus the whole wiki family
  // if we're currently showing a wiki-family article
  const isDeferredSrc = (s) => s.id === excludeSourceId || (excludeIsWiki && WIKI_FAMILY.has(s.id))
  const shuffled  = shuffle(eligible.filter(s => !isDeferredSrc(s)))
  const deferred  = eligible.filter(s => isDeferredSrc(s) && s.id !== excludeSourceId)
  const excluded  = eligible.filter(s => s.id === excludeSourceId)
  const fallback  = ARTICLE_SOURCES.find(s => s.id === 'simple-wikipedia')
  // Order: non-wiki sources → deferred wiki (not the excluded) → excluded source → simple-wikipedia
  const toTry     = [...shuffled, ...deferred, ...excluded, ...(fallback ? [fallback] : [])]

  // Also try with the raw lesson title as alternate term
  const terms = searchTerm.toLowerCase() !== title.toLowerCase()
    ? [searchTerm, title]
    : [searchTerm]

  for (const src of toTry) {
    for (const term of terms) {
      try {
        const result = await src.fetch(term, title, apiKey)
        if (result?.html) return { ...result, title }
      } catch { /* try next */ }
    }
  }

  return { html: null, source: null, sourceId: null, title }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { lesson = {}, type = 'both', context = '', preferredSources, excludeSourceId, excludeVideoIds = [] } = await req.json()
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
      needArticle ? generateArticle(apiKey, title, grade, preferredSources, excludeSourceId) : null,
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
