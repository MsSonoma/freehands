import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 40
const DOWNLOAD_CONCURRENCY = 6

async function getSupabaseAdmin(){
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !svc) return null
    return createClient(url, svc, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  } catch {
    return null
  }
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await worker(items[index], index)
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

function sortLessonFiles(files = []) {
  return files
    .filter((fileObj) => fileObj?.name?.toLowerCase().endsWith('.json'))
    .sort((a, b) => {
      const timeA = new Date(a?.updated_at || a?.created_at || 0).getTime()
      const timeB = new Date(b?.updated_at || b?.created_at || 0).getTime()
      if (timeA !== timeB) return timeB - timeA
      return String(a?.name || '').localeCompare(String(b?.name || ''))
    })
}

export async function GET(request){
  const debug = process.env.DEBUG_LESSONS === '1'
  const startedAt = Date.now()
  try {
    const supabase = await getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (debug) console.log('[api/facilitator/lessons/list]', '401 missing bearer')
      return NextResponse.json({ error: 'Unauthorized - login required' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      if (debug) {
        console.log('[api/facilitator/lessons/list]', '401 invalid token', {
          authError: authError?.message || null,
          ms: Date.now() - startedAt,
        })
      }
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const userId = user.id
    const { searchParams } = new URL(request.url)
    const filenamesParam = searchParams.get('filenames')
    const requestedFiles = filenamesParam ? new Set(filenamesParam.split(',').filter(Boolean)) : null
    const paged = searchParams.get('paged') === '1'
    const limit = clampInteger(searchParams.get('limit'), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
    const offset = clampInteger(searchParams.get('offset'), 0, 0, 100000)

    if (debug) {
      console.log('[api/facilitator/lessons/list]', 'start', {
        userId,
        paged,
        limit,
        offset,
        ms: Date.now() - startedAt,
      })
    }

    const { data: files, error: listError } = await supabase.storage
      .from('lessons')
      .list(`facilitator-lessons/${userId}`, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'updated_at', order: 'desc' },
      })

    if (listError) {
      if (debug) console.log('[api/facilitator/lessons/list]', 'list error', { message: listError?.message || String(listError) })
      return NextResponse.json(paged ? { lessons: [], total: 0, nextOffset: null, hasMore: false } : [])
    }

    let eligibleFiles = sortLessonFiles(files || [])
    if (requestedFiles) eligibleFiles = eligibleFiles.filter((fileObj) => requestedFiles.has(fileObj.name))

    const total = eligibleFiles.length
    const selectedFiles = paged ? eligibleFiles.slice(offset, offset + limit) : eligibleFiles

    const loaded = await mapWithConcurrency(selectedFiles, DOWNLOAD_CONCURRENCY, async (fileObj) => {
      try {
        const oneStartedAt = Date.now()
        const filePath = `facilitator-lessons/${userId}/${fileObj.name}`
        const downloadPromise = supabase.storage
          .from('lessons')
          .download(filePath)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Lesson download timed out')), 15000)
        })
        const { data: fileData, error: downloadError } = await Promise.race([downloadPromise, timeoutPromise])

        if (downloadError || !fileData) {
          if (debug) {
            console.log('[api/facilitator/lessons/list]', 'skip file (download)', {
              name: fileObj.name,
              message: downloadError?.message || null,
              ms: Date.now() - oneStartedAt,
            })
          }
          return null
        }

        const raw = await fileData.text()
        const js = JSON.parse(raw)
        const subject = (js.subject || '').toString().toLowerCase()
        return {
          file: fileObj.name,
          userId,
          title: js.title || fileObj.name,
          grade: js.grade || null,
          difficulty: (js.difficulty || '').toLowerCase(),
          subject: subject || null,
          approved: js.approved === true,
          needsUpdate: js.needsUpdate === true,
          created_at: fileObj.created_at || null,
          updated_at: fileObj.updated_at || null,
        }
      } catch (parseError) {
        if (debug) {
          console.log('[api/facilitator/lessons/list]', 'skip file (error)', {
            name: fileObj?.name,
            message: parseError?.message || String(parseError),
          })
        }
        return null
      }
    })

    const lessons = loaded.filter(Boolean)

    if (debug) {
      console.log('[api/facilitator/lessons/list]', 'done', {
        returned: lessons.length,
        total,
        ms: Date.now() - startedAt,
      })
    }

    if (!paged) return NextResponse.json(lessons)

    const nextOffset = offset + selectedFiles.length
    return NextResponse.json({
      lessons,
      total,
      ownedFiles: eligibleFiles.map((fileObj) => fileObj.name),
      nextOffset: nextOffset < total ? nextOffset : null,
      hasMore: nextOffset < total,
    })
  } catch (e) {
    if (debug) {
      console.log('[api/facilitator/lessons/list]', 'ERR', { message: e?.message || String(e), ms: Date.now() - startedAt })
    }
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
