// Shared, deterministic helpers for facilitator-selected Mrs. Webb media.
// A score is a suggestion, never an approval or a content-safety certification.
export const WEBB_MEDIA_KINDS = ['video', 'article']

export function parseVideoDuration(value) {
  const match = /^P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/i.exec(String(value || ''))
  if (!match) return 0
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 +
    Number(match[3] || 0) * 60 + Number(match[4] || 0)
}

export function mediaDurationLabel(resource) {
  if (!resource) return ''
  if (resource.kind === 'article') {
    const words = Number(resource.wordCount) || 0
    return words ? Math.max(1, Math.ceil(words / 180)) + ' min read' : 'Reading length unknown'
  }
  const seconds = Number(resource.durationSeconds) || 0
  return seconds ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : 'Length unknown'
}

export function videoEmbedUrl(id) {
  const value = String(id || '')
  if (!/^[A-Za-z0-9_-]{11}$/.test(value)) return ''
  return 'https://www.youtube-nocookie.com/embed/' + value +
    '?autoplay=0&rel=0&iv_load_policy=3&enablejsapi=1&controls=0&playsinline=1'
}

export function articleDetailsFromId(id) {
  const match = /^(simple|wiki):(.{1,180})$/.exec(String(id || ''))
  if (!match) return null
  const title = match[2].trim().replace(/_/g, ' ')
  if (!title || /[\r\n<>#?]/.test(title)) return null
  const hostname = match[1] === 'simple' ? 'simple.wikipedia.org' : 'en.wikipedia.org'
  return {
    title,
    source: match[1] === 'simple' ? 'Simple Wikipedia' : 'Wikipedia',
    url: 'https://' + hostname + '/wiki/' + encodeURIComponent(title.replace(/ /g, '_')),
    api: 'https://' + hostname + '/w/api.php',
  }
}

export function normalizeMediaResource(input) {
  if (!input || typeof input !== 'object') return null
  const kind = String(input.kind || '')
  if (!WEBB_MEDIA_KINDS.includes(kind)) return null
  const id = String(input.id || '').trim()
  if (kind === 'video' && !videoEmbedUrl(id)) return null
  if (kind === 'article' && !articleDetailsFromId(id)) return null
  const meta = kind === 'article' ? articleDetailsFromId(id) : null
  const title = String(input.title || meta?.title || '').trim().slice(0, 260)
  if (!title) return null
  return {
    kind,
    id,
    title,
    description: String(input.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 700),
    source: kind === 'article' ? meta.source : String(input.source || '').slice(0, 130),
    url: kind === 'article' ? meta.url : 'https://www.youtube.com/watch?v=' + id,
    durationSeconds: kind === 'video' ? Math.max(0, Math.min(86400, Number(input.durationSeconds) || 0)) : 0,
    wordCount: kind === 'article' ? Math.max(0, Math.min(50000, Number(input.wordCount) || 0)) : 0,
    fitScore: Math.max(0, Math.min(10, Math.round(Number(input.fitScore) || 0))),
    fitReason: String(input.fitReason || '').slice(0, 400),
    ageNote: String(input.ageNote || '').slice(0, 250),
  }
}

export function approvedWebbMedia(rows, kind) {
  return (Array.isArray(rows) ? rows : []).filter((r) =>
    r?.status === 'approved' && r.kind === kind && normalizeMediaResource(r.resource))
    .map((r) => ({ ...r.resource, workAllowed: r.work_allowed === true }))
}

export function workVideoChoices(rows, hasPlayedInWorkPeriod) {
  return hasPlayedInWorkPeriod ? [] : approvedWebbMedia(rows, 'video').filter((v) => v.workAllowed)
}

export function estimateMediaFit(resource, lesson) {
  const lessonText = [lesson?.title, lesson?.subject, ...(Array.isArray(lesson?.objectives) ? lesson.objectives.slice(0, 3) : [])]
    .filter(Boolean).join(' ').toLowerCase()
  const description = [resource?.title, resource?.description].filter(Boolean).join(' ').toLowerCase()
  const ignore = new Set(['the','and','for','with','from','into','this','that','about','lesson','learning','grade','video','how','what','when','where','why','school','student'])
  const words = [...new Set(lessonText.match(/[a-z]{4,}/g) || [])].filter((w) => !ignore.has(w))
  const matched = words.filter((w) => description.includes(w)).length
  return Math.max(2, Math.min(9, 3 + matched * 2))
}

export function escapeArticleText(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function articleHtmlFromExtract(title, extract) {
  const paragraphs = String(extract || '').slice(0, 100000).split(/\n{2,}/)
    .map((p) => '<p>' + escapeArticleText(p).replace(/\n/g, ' ') + '</p>').join('\n')
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'body{font:16px/1.7 system-ui,sans-serif;color:#172033;max-width:760px;margin:auto;padding:20px}' +
    'h1{font-size:1.4rem}p{margin:0 0 1rem;white-space:pre-wrap}</style></head><body><h1>' +
    escapeArticleText(title) + '</h1>' + paragraphs + '</body></html>'
}
