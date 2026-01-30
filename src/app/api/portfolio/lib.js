import crypto from 'crypto'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

export const PORTFOLIOS_BUCKET = 'portfolios'

export function safeYyyyMmDd(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function addDaysUtc(dateStr, days) {
  if (!safeYyyyMmDd(dateStr)) return null
  const [y, m, d] = dateStr.split('-').map(n => Number(n))
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (Number.isNaN(dt.getTime())) return null
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function canonicalLessonId(raw) {
  if (!raw) return null
  const normalized = normalizeLessonKey(String(raw)) || String(raw)
  const base = normalized.includes('/') ? normalized.split('/').pop() : normalized
  const withoutExt = String(base || '').replace(/\.json$/i, '')
  return withoutExt || null
}

export function normalizeVisualAidsKey(lessonKey) {
  return String(lessonKey || '').replace(/^(generated|facilitator|math|science|language-arts|social-studies|demo)\//, '')
}

export function encodeStoragePath(rawPath) {
  return String(rawPath || '')
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/')
}

export function publicObjectUrl({ supabaseUrl, bucket, path }) {
  const root = String(supabaseUrl || '').replace(/\/$/, '')
  return `${root}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildLessonTitleFromKey(lessonKey) {
  const key = String(lessonKey || '')
  const parts = key.split('/')
  const filename = parts.length > 1 ? parts[1] : parts[0]
  return String(filename || key).replace(/\.json$/i, '').replace(/_/g, ' ')
}

export function makePortfolioId() {
  return crypto.randomUUID()
}

export function buildIndexHtml({ learnerName, startDate, endDate, generatedAtIso, lessons }) {
  const title = `Portfolio${learnerName ? ` - ${learnerName}` : ''}`

  const lessonSections = (Array.isArray(lessons) ? lessons : []).map((lesson) => {
    const lessonTitle = escapeHtml(lesson.title || 'Lesson')
    const dateStr = escapeHtml(lesson.scheduledDate || '')
    const subject = escapeHtml(lesson.subject || '')

    const notesHtml = lesson.notes
      ? `<div class="block"><div class="label">Notes</div><div class="text">${escapeHtml(lesson.notes)}</div></div>`
      : `<div class="block"><div class="label">Notes</div><div class="muted">(none)</div></div>`

    const visualAids = Array.isArray(lesson.visualAids) ? lesson.visualAids : []
    const visualHtml = visualAids.length
      ? `<div class="block"><div class="label">Visual aids</div><div class="grid">${visualAids
          .map((img) => {
            const url = escapeHtml(img.url || '')
            const desc = escapeHtml(img.description || '')
            return `<div class="card"><a href="${url}" target="_blank" rel="noreferrer"><img src="${url}" alt="Visual aid" /></a><div class="caption">${desc}</div></div>`
          })
          .join('')}</div></div>`
      : `<div class="block"><div class="label">Visual aids</div><div class="muted">(none)</div></div>`

    const scans = Array.isArray(lesson.scans) ? lesson.scans : []
    const scansHtml = scans.length
      ? `<div class="block"><div class="label">Images / scans</div><ul class="links">${scans
          .map((f) => {
            const url = escapeHtml(f.url || '')
            const name = escapeHtml(f.name || 'file')
            const kind = escapeHtml(f.kind || '')
            return `<li><a href="${url}" target="_blank" rel="noreferrer">${name}</a>${kind ? ` <span class="pill">${kind}</span>` : ''}</li>`
          })
          .join('')}</ul></div>`
      : `<div class="block"><div class="label">Images / scans</div><div class="muted">(none)</div></div>`

    return `
      <section class="lesson">
        <div class="lesson-head">
          <div class="lesson-title">${lessonTitle}</div>
          <div class="lesson-meta">
            ${dateStr ? `<span>${dateStr}</span>` : ''}
            ${subject ? `<span class="dot">•</span><span>${subject}</span>` : ''}
          </div>
        </div>
        ${notesHtml}
        ${visualHtml}
        ${scansHtml}
      </section>
    `
  })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: #f9fafb; color: #111827; }
      .wrap { max-width: 980px; margin: 0 auto; padding: 18px 14px 40px; }
      h1 { font-size: 20px; margin: 0; font-weight: 900; }
      .sub { margin-top: 6px; font-size: 12px; color: #6b7280; }
      .meta { margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap; }
      .chip { background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; padding: 6px 10px; font-size: 12px; color: #374151; }
      .lesson { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; margin-top: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.05); }
      .lesson-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
      .lesson-title { font-size: 15px; font-weight: 900; }
      .lesson-meta { font-size: 12px; color: #6b7280; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .dot { opacity: 0.6; }
      .block { margin-top: 12px; }
      .label { font-size: 12px; font-weight: 900; color: #111827; margin-bottom: 6px; }
      .muted { font-size: 12px; color: #9ca3af; }
      .text { font-size: 13px; color: #111827; line-height: 1.5; white-space: pre-wrap; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
      .card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; }
      .card img { display: block; width: 100%; height: auto; }
      .caption { font-size: 12px; color: #374151; padding: 8px 10px; line-height: 1.35; }
      .links { margin: 0; padding-left: 18px; }
      .links li { font-size: 13px; margin: 4px 0; }
      a { color: #1d4ed8; }
      .pill { display: inline-block; margin-left: 6px; font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
      @media print {
        body { background: #fff; }
        .lesson { box-shadow: none; }
        a { color: #111827; text-decoration: none; }
        .card { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">Generated ${escapeHtml(generatedAtIso || '')}</div>
      <div class="meta">
        ${startDate ? `<div class="chip">Start: ${escapeHtml(startDate)}</div>` : ''}
        ${endDate ? `<div class="chip">End: ${escapeHtml(endDate)}</div>` : ''}
        <div class="chip">Lessons: ${(Array.isArray(lessons) ? lessons.length : 0)}</div>
      </div>
      ${lessonSections.join('')}
    </div>
  </body>
</html>`
}
