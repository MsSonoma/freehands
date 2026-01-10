import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function slugify(input) {
  const raw = (input || '').toString().trim().toLowerCase()
  const cleaned = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return cleaned || 'lesson'
}

function normalizeJsonFileName(name) {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
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
    const lesson = body?.lesson
    if (!lesson || typeof lesson !== 'object') {
      return NextResponse.json({ error: 'Missing lesson' }, { status: 400 })
    }

    const title = (lesson.title || '').toString().trim()
    const grade = (lesson.grade || '').toString().trim()
    const difficulty = (lesson.difficulty || '').toString().trim()
    const subject = (lesson.subject || '').toString().trim().toLowerCase()

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!grade) return NextResponse.json({ error: 'Grade is required' }, { status: 400 })
    if (!difficulty) return NextResponse.json({ error: 'Difficulty is required' }, { status: 400 })
    if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })

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

    const base = slugify(title).slice(0, 48)
    const suffix = crypto.randomUUID().slice(0, 8)
    const proposed = `${base}-${Date.now()}-${suffix}.json`
    const fileName = normalizeJsonFileName(proposed)
    if (!fileName) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const storageClient = createClient(url, svc, { auth: { persistSession: false } })
    const storagePath = `facilitator-lessons/${userId}/${fileName}`

    const toStore = {
      ...lesson,
      subject,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const uploadBody = JSON.stringify(toStore, null, 2)

    const { error: uploadError } = await storageClient.storage
      .from('lessons')
      .upload(storagePath, uploadBody, {
        contentType: 'application/json',
        upsert: false
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || 'Upload failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      file: fileName,
      lessonKey: `generated/${fileName}`
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
