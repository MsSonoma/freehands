import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getSupabaseAdmin(){
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !svc) return null
    return createClient(url, svc, { auth: { persistSession: false } })
  } catch {
    return null
  }
}

export async function GET(request){
  try {
    const { searchParams } = new URL(request.url)
    const file = searchParams.get('file')
    const userId = searchParams.get('userId')
    
    if (!file || !userId) {
      return NextResponse.json({ error: 'Missing file or userId parameter' }, { status: 400 })
    }
    
    const supabase = await getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    }
    
    // Download from Supabase Storage
    const storagePath = `facilitator-lessons/${userId}/${file}`
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('lessons')
      .download(storagePath)
    
    if (downloadError || !fileData) {
      console.error('Lesson download error:', {
        storagePath,
        bucket: 'lessons',
        error: downloadError
      })
      return NextResponse.json({ 
        error: 'Lesson not found',
        details: downloadError?.message,
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
