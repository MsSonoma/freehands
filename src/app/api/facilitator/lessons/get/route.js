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
      console.error('Download error:', downloadError)
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }
    
    const raw = await fileData.text()
    const lesson = JSON.parse(raw)
    
    return NextResponse.json(lesson)
  } catch (e) {
    console.error('Get lesson error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
