import { NextResponse } from 'next/server'
import { AI_MODEL, aiModelTemperature } from '@/app/lib/aiModel'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'
import { getSyllabusRequestContext } from '@/app/lib/syllabus/request.server.mjs'
import { verifyFacilitatorPinForUser } from '@/app/lib/facilitatorPin.server.mjs'
import {
  articleDetailsFromId, articleHtmlFromExtract, estimateMediaFit,
  normalizeMediaResource, parseVideoDuration,
} from '@/app/lib/webbMedia.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos'
const MEDIA_TABLE = 'webb_lesson_media'

function reply(error, status = 400) {
  return NextResponse.json({ error }, { status })
}

function cleanText(value, max = 180) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

function decodeSnippet(value) {
  return cleanText(String(value || '')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>'), 500)
}

async function authorized(request, learnerId, lessonKey, deps = {}) {
  const key = normalizeLessonKey(lessonKey)
  if (!learnerId || !key || key.length > 320) return { error: 'A learner and lesson are required.', status: 400 }
  const auth = await getSyllabusRequestContext(request, deps)
  if (!auth.user || !auth.admin) return { error: auth.error || 'Unauthorized', status: auth.status || 401 }
  const { data: learner, error } = await auth.admin.from('learners').select('id')
    .eq('id', learnerId)
    .or('facilitator_id.eq.' + auth.user.id + ',owner_id.eq.' + auth.user.id + ',user_id.eq.' + auth.user.id)
    .maybeSingle()
  if (error || !learner) return { error: 'Learner not found or unauthorized', status: 403 }
  return { ...auth, learnerId: learner.id, lessonKey: key }
}

async function listMedia(ctx) {
  const { data, error } = await ctx.admin.from(MEDIA_TABLE)
    .select('resource,status,work_allowed,requested_at,approved_at,updated_at')
    .eq('facilitator_id', ctx.user.id)
    .eq('learner_id', ctx.learnerId)
    .eq('lesson_key', ctx.lessonKey)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map((entry) => ({
    resource: normalizeMediaResource(entry.resource),
    kind: entry.resource?.kind,
    status: entry.status,
    work_allowed: entry.work_allowed === true,
    requested_at: entry.requested_at,
    approved_at: entry.approved_at,
    updated_at: entry.updated_at,
  })).filter((entry) => entry.resource)
}

async function rateSuggestions(items, lesson) {
  const baseline = items.map((item) => ({
    ...item,
    fitScore: estimateMediaFit(item, lesson),
    fitReason: 'Estimated from the lesson topic and source description.',
    ageNote: lesson.grade
      ? 'Suggested for Grade ' + cleanText(lesson.grade, 12) + '; check suitability before approval.'
      : 'Age suitability requires facilitator review.',
  }))
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !baseline.length) return baseline
  try {
    const listing = baseline.map((item, i) =>
      [i, item.title, item.description.slice(0, 240), item.source].join(' | ')).join('\n')
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        max_completion_tokens: 420,
        ...aiModelTemperature(0.2),
        messages: [
          { role: 'system', content: 'Estimate relevance to the LESSON, not safety approval. Score each metadata-only source 0-10. Provide one concise reason for lesson fit and an age-suitability note based only on metadata. Never say you watched or read a resource. Reply with a JSON array of objects {idx,score,reason,ageNote}. No prose outside JSON.' },
          { role: 'user', content: 'Lesson: ' + cleanText(lesson.title, 140) + '. Subject: ' + cleanText(lesson.subject, 80) + '. Grade: ' + cleanText(lesson.grade, 20) + '.\nCandidates:\n' + listing },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return baseline
    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]')
    for (const suggestion of parsed) {
      if (!Number.isInteger(suggestion.idx) || !baseline[suggestion.idx]) continue
      const item = baseline[suggestion.idx]
      if (Number.isFinite(Number(suggestion.score))) item.fitScore = Math.max(0, Math.min(10, Math.round(Number(suggestion.score))))
      item.fitReason = cleanText(suggestion.reason, 220) || item.fitReason
      item.ageNote = cleanText(suggestion.ageNote, 170) || item.ageNote
    }
  } catch { /* Metadata-only estimates remain visibly provisional. */ }
  return baseline
}

async function searchVideos(query, seen, lesson) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YouTube search is not configured.')
  const terms = query || [lesson.title, lesson.subject, 'educational', lesson.grade ? 'grade ' + lesson.grade : 'for kids'].filter(Boolean).join(' ')
  const url = SEARCH_URL + '?' + new URLSearchParams({
    part: 'snippet', q: cleanText(terms, 150),
    type: 'video', safeSearch: 'strict', videoEmbeddable: 'true',
    relevanceLanguage: 'en', maxResults: '25', key,
  }).toString()
  const searchResponse = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!searchResponse.ok) throw new Error('Video search is temporarily unavailable.')
  const result = await searchResponse.json()
  if (result.error) throw new Error('Video search is temporarily unavailable.')
  const seenSet = new Set(Array.isArray(seen) ? seen.slice(0, 150).map(String) : [])
  const raw = (result.items || []).filter((item) =>
    /^[a-zA-Z0-9_-]{11}$/.test(String(item.id?.videoId || '')) && !seenSet.has(item.id.videoId)).slice(0, 12)
  if (!raw.length) return []
  const detailsResponse = await fetch(VIDEOS_URL + '?' + new URLSearchParams({
    part: 'contentDetails,status', id: raw.map((i) => i.id.videoId).join(','), key,
  }).toString(), { signal: AbortSignal.timeout(10000) })
  if (!detailsResponse.ok) throw new Error('Video details are temporarily unavailable.')
  const details = await detailsResponse.json()
  const byId = new Map((details.items || []).map((item) => [item.id, item]))
  const candidates = raw.filter((item) => byId.get(item.id.videoId)?.status?.embeddable !== false)
    .map((item) => ({
      kind: 'video', id: item.id.videoId, title: decodeSnippet(item.snippet?.title),
      source: cleanText(item.snippet?.channelTitle, 120),
      description: decodeSnippet(item.snippet?.description),
      durationSeconds: parseVideoDuration(byId.get(item.id.videoId)?.contentDetails?.duration),
    }))
  const rated = await rateSuggestions(candidates, lesson)
  return rated.sort((a, b) => b.fitScore - a.fitScore).slice(0, 3)
}

async function searchArticles(query, seen, lesson) {
  const terms = cleanText(query || lesson.title || lesson.subject, 150)
  const seenSet = new Set(Array.isArray(seen) ? seen.slice(0, 150).map(String) : [])
  const searchOne = async (prefix, host) => {
    const url = 'https://' + host + '/w/api.php?' + new URLSearchParams({
      action: 'query', list: 'search', srsearch: terms, srlimit: '12', format: 'json',
    }).toString()
    const res = await fetch(url, { signal: AbortSignal.timeout(8500) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.query?.search || []).map((item) => ({
      kind: 'article',
      id: prefix + ':' + item.title,
      title: cleanText(item.title, 250),
      source: prefix === 'simple' ? 'Simple Wikipedia' : 'Wikipedia',
      description: decodeSnippet(item.snippet),
      wordCount: Number(item.wordcount) || 0,
    })).filter((item) => !seenSet.has(item.id))
  }
  const [simple, regular] = await Promise.allSettled([
    searchOne('simple', 'simple.wikipedia.org'), searchOne('wiki', 'en.wikipedia.org'),
  ])
  const pool = [
    ...(simple.status === 'fulfilled' ? simple.value : []),
    ...(regular.status === 'fulfilled' ? regular.value : []),
  ]
  const rated = await rateSuggestions(pool.slice(0, 12), lesson)
  return rated.sort((a, b) => (b.fitScore - a.fitScore) || (a.source === 'Simple Wikipedia' ? -1 : 1)).slice(0, 3)
}

async function fetchApprovedArticle(ctx, id) {
  if (!articleDetailsFromId(id)) return reply('Invalid article', 400)
  const { data: row, error } = await ctx.admin.from(MEDIA_TABLE)
    .select('resource,status').eq('facilitator_id', ctx.user.id)
    .eq('learner_id', ctx.learnerId).eq('lesson_key', ctx.lessonKey)
    .eq('kind', 'article').eq('resource_id', id).maybeSingle()
  if (error) throw error
  if (row?.status !== 'approved') return reply('This article has not been approved.', 403)
  const details = articleDetailsFromId(id)
  const res = await fetch(details.api + '?' + new URLSearchParams({
    action: 'query', prop: 'extracts', explaintext: '1', redirects: '1',
    titles: details.title, format: 'json',
  }).toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return reply('Could not retrieve the approved article.', 502)
  const data = await res.json()
  const page = Object.values(data.query?.pages || {})[0]
  if (!page?.extract) return reply('Could not retrieve the approved article.', 502)
  return NextResponse.json({
    article: {
      title: row.resource?.title || page.title || details.title,
      source: details.source, sourceId: id,
      html: articleHtmlFromExtract(page.title || details.title, page.extract),
    },
  })
}

export async function GET(request, deps = {}) {
  try {
    const params = new URL(request.url).searchParams
    const ctx = await authorized(request, params.get('learnerId'), params.get('lessonKey'), deps)
    if (ctx.error) return reply(ctx.error, ctx.status)
    const rows = await listMedia(ctx)
    return NextResponse.json({ ok: true, rows })
  } catch (error) {
    console.error('[webb-media GET]', error)
    return reply('Could not load facilitator media approvals.', 503)
  }
}

export async function POST(request, deps = {}) {
  try {
    const body = await request.json().catch(() => null)
    const ctx = await authorized(request, body?.learnerId, body?.lessonKey, deps)
    if (ctx.error) return reply(ctx.error, ctx.status)
    const action = String(body?.action || '')
    if (action === 'search') {
      if (body?.kind !== 'video' && body?.kind !== 'article') return reply('Invalid media kind')
      const lesson = {
        title: cleanText(body.lesson?.title, 140),
        subject: cleanText(body.lesson?.subject, 80),
        grade: cleanText(body.lesson?.grade, 20),
      }
      const query = cleanText(body?.query, 150)
      const results = body.kind === 'video'
        ? await searchVideos(query, body.seenIds, lesson)
        : await searchArticles(query, body.seenIds, lesson)
      return NextResponse.json({ ok: true, results, provisional: true })
    }
    if (action === 'request') {
      const resource = normalizeMediaResource(body?.resource)
      if (!resource || resource.kind !== 'video') return reply('Only video requests are supported.')
      const { data: existing, error: lookupError } = await ctx.admin.from(MEDIA_TABLE).select('status')
        .eq('facilitator_id', ctx.user.id).eq('learner_id', ctx.learnerId)
        .eq('lesson_key', ctx.lessonKey).eq('kind', resource.kind).eq('resource_id', resource.id).maybeSingle()
      if (lookupError) throw lookupError
      if (existing?.status === 'approved') return NextResponse.json({ ok: true, status: 'approved' })
      const { error } = await ctx.admin.from(MEDIA_TABLE).upsert({
        facilitator_id: ctx.user.id, learner_id: ctx.learnerId, lesson_key: ctx.lessonKey,
        kind: resource.kind, resource_id: resource.id, resource, status: 'pending',
        work_allowed: false, requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), approved_at: null,
      }, { onConflict: 'facilitator_id,learner_id,lesson_key,kind,resource_id' })
      if (error) throw error
      return NextResponse.json({ ok: true, status: 'pending' })
    }
    if (action === 'decide') {
      const decisions = Array.isArray(body?.decisions) ? body.decisions.slice(0, 3) : []
      if (!decisions.length || typeof body.pin !== 'string' || !body.pin) return reply('Facilitator PIN and decisions are required.')
      if (!(await verifyFacilitatorPinForUser(ctx.admin, ctx.user.id, body.pin))) return reply('Invalid facilitator PIN.', 403)
      const now = new Date().toISOString()
      const rows = decisions.map((decision) => {
        const resource = normalizeMediaResource(decision.resource)
        if (!resource || !['approved', 'rejected'].includes(decision.status)) return null
        return {
          facilitator_id: ctx.user.id, learner_id: ctx.learnerId, lesson_key: ctx.lessonKey,
          kind: resource.kind, resource_id: resource.id, resource, status: decision.status,
          work_allowed: resource.kind === 'video' && decision.status === 'approved' && decision.workAllowed === true,
          approved_at: decision.status === 'approved' ? now : null, updated_at: now,
        }
      })
      if (rows.some((row) => !row)) return reply('Invalid decision.')
      const { error } = await ctx.admin.from(MEDIA_TABLE)
        .upsert(rows, { onConflict: 'facilitator_id,learner_id,lesson_key,kind,resource_id' })
      if (error) throw error
      return NextResponse.json({ ok: true, rows: await listMedia(ctx) })
    }
    if (action === 'article') return fetchApprovedArticle(ctx, body?.id)
    return reply('Unknown media action')
  } catch (error) {
    console.error('[webb-media POST]', error)
    return reply('Mrs. Webb media request failed.', 503)
  }
}
