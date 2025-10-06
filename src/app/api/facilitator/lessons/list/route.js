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
    const supabase = await getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    
    // List all files directly in facilitator-lessons
    const { data: files, error: listError } = await supabase.storage
      .from('lessons')
      .list('facilitator-lessons', { limit: 1000 })
    
    if (listError) {
      console.error('Storage list error:', listError)
      return NextResponse.json([])
    }
    
    console.log('Found', files?.length, 'items in facilitator-lessons')
    
    const out = []
    
    // Process each JSON file
    for (const fileObj of files || []) {
      if (!fileObj.name || !fileObj.name.toLowerCase().endsWith('.json')) {
        console.log('Skipping non-JSON item:', fileObj.name)
        continue
      }
      
      try {
        // Download and parse each file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('lessons')
          .download(`facilitator-lessons/${fileObj.name}`)
        
        if (downloadError) {
          console.error(`Error downloading ${fileObj.name}:`, downloadError)
          continue
        }
        
        const raw = await fileData.text()
        const js = JSON.parse(raw)
        const subj = (js.subject || '').toString().toLowerCase()
        const approved = js.approved === true
        const needsUpdate = js.needsUpdate === true
        out.push({ 
          file: fileObj.name, 
          title: js.title || fileObj.name, 
          grade: js.grade || null, 
          difficulty: (js.difficulty || '').toLowerCase(), 
          subject: subj || null, 
          approved, 
          needsUpdate 
        })
      } catch (parseError) {
        console.error('Parse error for', fileObj.name, parseError)
      }
    }
    
    return NextResponse.json(out)
  } catch (e) {
    console.error('List error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
