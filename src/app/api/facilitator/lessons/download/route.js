import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_SUBJECTS = new Set(['math', 'science', 'language arts', 'social studies', 'general'])

function normalizeSubjectFolder(subject) {
  // public/lessons uses folders with spaces, plus special mapping for general.
  if (subject === 'general') return 'Facilitator Lessons'
  return subject
}

function normalizeFileName(file) {
  if (typeof file !== 'string') return null
  const trimmed = file.trim()
  if (!trimmed) return null
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) return null
  return trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const subjectRaw = (body?.subject || '').toString().toLowerCase().trim()
    const fileRaw = body?.file

    if (!ALLOWED_SUBJECTS.has(subjectRaw)) {
      return NextResponse.json({ error: 'Invalid subject' }, { status: 400 })
    }

    const fileName = normalizeFileName(fileRaw)
    if (!fileName) {
      return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anon || !svc) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    }

    // Resolve user from bearer token using anon client.
    const supabaseAuth = createClient(url, anon, { auth: { persistSession: false } })
    const { data: userResult, error: userError } = await supabaseAuth.auth.getUser(accessToken)
    const userId = userResult?.user?.id || null
    if (userError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read canonical lesson JSON from server filesystem (public/lessons/...)
    const subjectFolder = normalizeSubjectFolder(subjectRaw)
    const lessonPath = path.join(process.cwd(), 'public', 'lessons', subjectFolder, fileName)

    if (!fs.existsSync(lessonPath)) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const raw = fs.readFileSync(lessonPath, 'utf8')
    const lesson = JSON.parse(raw)

    // Ensure the owned copy has a stable subject + markers.
    lesson.subject = lesson.subject || subjectRaw
    lesson.downloaded = true
    lesson.downloadedAt = new Date().toISOString()

    const storageClient = createClient(url, svc, { auth: { persistSession: false } })
    const storagePath = `facilitator-lessons/${userId}/${fileName}`

    const uploadBody = JSON.stringify(lesson, null, 2)

    const { error: uploadError } = await storageClient.storage
      .from('lessons')
      .upload(storagePath, uploadBody, {
        contentType: 'application/json',
        upsert: true
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || 'Upload failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, lessonKey: `generated/${fileName}` })
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
