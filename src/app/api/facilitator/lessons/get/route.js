import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request){
  try {
    const { searchParams } = new URL(request.url)
    let file = searchParams.get('file')

    if (!file) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization') || ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Create Supabase client with service role key for storage access
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!url || !svc) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    }
    
    const supabaseAuth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: userResult, error: userError } = await supabaseAuth.auth.getUser(accessToken)
    const userId = userResult?.user?.id || null
    if (userError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(url, svc, { auth: { persistSession: false } })
    
    // Strip 'generated/' prefix if present and ensure .json extension
    // Storage uses flat structure but lesson_key in schedule includes folder prefix for routing
    let fileName = file.replace(/^generated\//, '')
    if (fileName.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }
    if (!fileName.endsWith('.json')) {
      fileName = `${fileName}.json`
    }
    
    // Download from Supabase Storage using SDK
    const storagePath = `facilitator-lessons/${userId}/${fileName}`
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('lessons')
      .download(storagePath)
    
    if (downloadError || !fileData) {
      console.error('Lesson download error:', {
        storagePath,
        error: downloadError
      })
      return NextResponse.json({ 
        error: 'Lesson not found',
        path: storagePath
      }, { status: 404 })
    }
    
    const raw = await fileData.text()
    const lesson = JSON.parse(raw)
    
    // Normalize question field names: Q/q -> prompt/question, A/a -> answer/expected
    const normalizeQuestion = (q) => {
      if (!q || typeof q !== 'object') return q
      const normalized = { ...q }
      // Map Q or q to prompt and question
      if (q.Q !== undefined) {
        normalized.prompt = q.Q
        normalized.question = q.Q
      } else if (q.q !== undefined) {
        normalized.prompt = q.q
        normalized.question = q.q
      }
      // Map A or a to answer and expected
      if (q.A !== undefined) {
        normalized.answer = q.A
        normalized.expected = q.A
      } else if (q.a !== undefined) {
        normalized.answer = q.a
        normalized.expected = q.a
      }
      return normalized
    }
    
    // Normalize all question arrays (removed 'sample' - deprecated zombie code)
    const questionArrays = ['truefalse', 'multiplechoice', 'shortanswer', 'fillintheblank', 'worksheet', 'test']
    for (const key of questionArrays) {
      if (Array.isArray(lesson[key])) {
        lesson[key] = lesson[key].map(normalizeQuestion)
      }
    }
    
    return NextResponse.json(lesson)
  } catch (e) {
    // General error
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
