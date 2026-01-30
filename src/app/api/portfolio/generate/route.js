import { NextResponse } from 'next/server'

import {
  PORTFOLIOS_BUCKET,
  addDaysUtc,
  buildIndexHtml,
  buildLessonTitleFromKey,
  canonicalLessonId,
  makePortfolioId,
  normalizeVisualAidsKey,
  publicObjectUrl,
  safeYyyyMmDd
} from '../lib'

import {
  assertLearnerOwnedByUser,
  buildScansBasePath,
  createServiceClient,
  getUserFromAuthHeader,
  getBucketName as getTranscriptsBucket,
  guessContentType
} from '../../portfolio-scans/lib'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function okJson(data, init = {}) {
  return NextResponse.json(data, { status: 200, ...init })
}

function errJson(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

function safeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 140)
}

async function listScansByLesson(svc, { userId, learnerId, lessonKey }) {
  const base = buildScansBasePath({ userId, learnerId, lessonKey })
  if (!base) return []

  const bucket = getTranscriptsBucket()
  const kinds = ['worksheet', 'test', 'other']

  const out = []

  for (const kind of kinds) {
    const prefix = `${base}/${kind}`
    const { data: files, error } = await svc.storage.from(bucket).list(prefix, {
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'asc' }
    })

    if (error) continue

    for (const f of files || []) {
      if (!f?.name) continue
      const path = `${prefix}/${f.name}`
      out.push({
        name: f.name,
        path,
        kind,
        created_at: f.created_at || null,
        size: f.metadata?.size ?? null
      })
    }
  }

  // Stable output
  out.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
  return out
}

async function copyObject(svc, { fromBucket, fromPath, toBucket, toPath, filename }) {
  const { data: blob, error: dlErr } = await svc.storage.from(fromBucket).download(fromPath)
  if (dlErr || !blob) {
    throw new Error(dlErr?.message || 'Failed to download source file')
  }

  const buf = Buffer.from(await blob.arrayBuffer())
  const contentType = guessContentType(filename, blob.type)

  const { error: upErr } = await svc.storage.from(toBucket).upload(toPath, buf, {
    upsert: false,
    contentType
  })

  if (upErr) {
    throw new Error(upErr.message)
  }
}

async function uploadText(svc, { bucket, path, content, contentType = 'text/plain; charset=utf-8' }) {
  const buf = Buffer.from(String(content || ''), 'utf8')
  const { error } = await svc.storage.from(bucket).upload(path, buf, {
    upsert: true,
    contentType
  })
  if (error) throw new Error(error.message)
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req)
    if (!user) return errJson('Unauthorized', 401)

    const body = await req.json().catch(() => null)
    const learnerId = String(body?.learnerId || '').trim()
    const startDate = String(body?.startDate || '').trim()
    const endDate = String(body?.endDate || '').trim()

    const includeVisualAids = Boolean(body?.includeVisualAids)
    const includeNotes = Boolean(body?.includeNotes)
    const includeImages = Boolean(body?.includeImages)

    if (!learnerId) return errJson('Missing learnerId', 400)
    if (!safeYyyyMmDd(startDate) || !safeYyyyMmDd(endDate)) {
      return errJson('Invalid startDate or endDate (expected YYYY-MM-DD)', 400)
    }
    if (startDate > endDate) return errJson('startDate must be before endDate', 400)
    if (!includeVisualAids && !includeNotes && !includeImages) {
      return errJson('Select at least one include option', 400)
    }

    const svc = createServiceClient()
    if (!svc) return errJson('Server misconfigured', 500)

    const owned = await assertLearnerOwnedByUser(svc, learnerId, user.id)
    if (!owned) return errJson('Forbidden', 403)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return errJson('Server misconfigured', 500)

    const portfolioId = makePortfolioId()

    const { data: learnerRow, error: learnerErr } = await svc
      .from('learners')
      .select('id, name, lesson_notes')
      .eq('id', learnerId)
      .maybeSingle()

    if (learnerErr) return errJson(learnerErr.message, 500)

    const learnerName = learnerRow?.name || ''
    const notesMap = learnerRow?.lesson_notes && typeof learnerRow.lesson_notes === 'object' ? learnerRow.lesson_notes : {}

    const { data: scheduleRows, error: scheduleErr } = await svc
      .from('lesson_schedule')
      .select('id, lesson_key, scheduled_date')
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })

    if (scheduleErr) return errJson(scheduleErr.message, 500)

    const schedule = Array.isArray(scheduleRows) ? scheduleRows : []

    // Completion lookup window: include make-up completions up to 7 days after endDate.
    const toPlus7 = addDaysUtc(endDate, 7) || endDate

    const { data: eventRows, error: eventsErr } = await svc
      .from('lesson_session_events')
      .select('lesson_id, event_type, occurred_at')
      .eq('learner_id', learnerId)
      .eq('event_type', 'completed')
      .gte('occurred_at', `${startDate}T00:00:00.000Z`)
      .lt('occurred_at', `${addDaysUtc(toPlus7, 1) || toPlus7}T00:00:00.000Z`)
      .order('occurred_at', { ascending: true })

    const completedDatesByLesson = new Map()
    if (!eventsErr && Array.isArray(eventRows)) {
      for (const row of eventRows) {
        const key = canonicalLessonId(row?.lesson_id)
        if (!key) continue
        const dt = row?.occurred_at ? new Date(row.occurred_at) : null
        if (!dt || Number.isNaN(dt.getTime())) continue

        const yyyy = dt.getUTCFullYear()
        const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
        const dd = String(dt.getUTCDate()).padStart(2, '0')
        const dateStr = `${yyyy}-${mm}-${dd}`

        const prev = completedDatesByLesson.get(key) || []
        prev.push(dateStr)
        completedDatesByLesson.set(key, prev)
      }

      for (const [k, dates] of completedDatesByLesson.entries()) {
        const uniq = Array.from(new Set((dates || []).filter(Boolean))).sort()
        completedDatesByLesson.set(k, uniq)
      }
    }

    const completed = []
    const skipped = []

    for (const item of schedule) {
      const scheduledDate = item?.scheduled_date
      const lessonKey = item?.lesson_key
      if (!scheduledDate || !lessonKey) continue

      const canonical = canonicalLessonId(lessonKey)
      const dates = canonical ? (completedDatesByLesson.get(canonical) || []) : []

      const direct = dates.includes(scheduledDate)
      const windowEnd = addDaysUtc(scheduledDate, 7)
      const makeup = Boolean(windowEnd && dates.some(d => d > scheduledDate && d <= windowEnd))

      if (direct || makeup) completed.push(item)
      else skipped.push(item)
    }

    const lessonsOut = []

    for (const item of completed) {
      const lessonKey = item.lesson_key
      const scheduledDate = item.scheduled_date
      const [subject] = String(lessonKey || '').split('/')

      const lesson = {
        lessonKey,
        scheduledDate,
        subject: subject || '',
        title: buildLessonTitleFromKey(lessonKey),
        notes: includeNotes ? (typeof notesMap?.[lessonKey] === 'string' ? notesMap[lessonKey] : '') : '',
        visualAids: [],
        scans: []
      }

      if (includeVisualAids) {
        const normalizedKey = normalizeVisualAidsKey(lessonKey)
        const { data: vaRow } = await svc
          .from('visual_aids')
          .select('selected_images')
          .eq('facilitator_id', user.id)
          .eq('lesson_key', normalizedKey)
          .maybeSingle()

        const selected = Array.isArray(vaRow?.selected_images) ? vaRow.selected_images : []
        lesson.visualAids = selected
          .filter(img => Boolean(img?.url))
          .map(img => ({
            url: img.url,
            description: img.description || ''
          }))
      }

      if (includeImages) {
        const scans = await listScansByLesson(svc, { userId: user.id, learnerId, lessonKey })

        const copied = []
        for (const f of scans) {
          const baseKey = safeSegment(lessonKey)
          const destPath = `${user.id}/${learnerId}/${portfolioId}/assets/${baseKey}/${safeSegment(f.kind)}/${safeSegment(f.name)}`

          try {
            await copyObject(svc, {
              fromBucket: getTranscriptsBucket(),
              fromPath: f.path,
              toBucket: PORTFOLIOS_BUCKET,
              toPath: destPath,
              filename: f.name
            })

            copied.push({
              name: f.name,
              kind: f.kind,
              url: publicObjectUrl({ supabaseUrl, bucket: PORTFOLIOS_BUCKET, path: destPath })
            })
          } catch {
            // Skip copy failures; manifest will show only what was copied.
          }
        }

        lesson.scans = copied
      }

      lessonsOut.push(lesson)
    }

    const generatedAtIso = new Date().toISOString()
    const indexHtml = buildIndexHtml({
      learnerName,
      startDate,
      endDate,
      generatedAtIso,
      lessons: lessonsOut
    })

    const indexPath = `${user.id}/${learnerId}/${portfolioId}/index.html`
    const manifestPath = `${user.id}/${learnerId}/${portfolioId}/manifest.json`

    const manifest = {
      portfolioId,
      generatedAt: generatedAtIso,
      learnerId,
      learnerName,
      dateRange: { startDate, endDate },
      include: {
        visualAids: includeVisualAids,
        notes: includeNotes,
        images: includeImages
      },
      completedLessonCount: lessonsOut.length,
      skippedLessonCount: skipped.length,
      lessons: lessonsOut
    }

    await uploadText(svc, {
      bucket: PORTFOLIOS_BUCKET,
      path: indexPath,
      content: indexHtml,
      contentType: 'text/html; charset=utf-8'
    })

    await uploadText(svc, {
      bucket: PORTFOLIOS_BUCKET,
      path: manifestPath,
      content: JSON.stringify(manifest, null, 2),
      contentType: 'application/json; charset=utf-8'
    })

    const { error: saveErr } = await svc.from('portfolio_exports').insert({
      facilitator_id: user.id,
      learner_id: learnerId,
      portfolio_id: portfolioId,
      start_date: startDate,
      end_date: endDate,
      include_visual_aids: includeVisualAids,
      include_notes: includeNotes,
      include_images: includeImages,
      index_path: indexPath,
      manifest_path: manifestPath
    })

    if (saveErr) {
      // Generation must be persistently saved so it can be revisited and deleted.
      throw new Error(saveErr.message)
    }

    const indexUrl = publicObjectUrl({ supabaseUrl, bucket: PORTFOLIOS_BUCKET, path: indexPath })
    const manifestUrl = publicObjectUrl({ supabaseUrl, bucket: PORTFOLIOS_BUCKET, path: manifestPath })

    return okJson({
      portfolioId,
      indexUrl,
      manifestUrl,
      completedLessonCount: lessonsOut.length,
      skippedLessonCount: skipped.length
    })
  } catch (err) {
    return errJson(err?.message || String(err), 500)
  }
}
