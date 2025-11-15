import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

export async function GET(request){
  try {
    const supabase = await getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    
    // SECURITY: Require authentication and only return lessons for the authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - login required' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    
    const userId = user.id
    
    // OPTIMIZATION: Accept filenames query parameter to only load specific files
    const { searchParams } = new URL(request.url)
    const filenamesParam = searchParams.get('filenames')
    const requestedFiles = filenamesParam ? filenamesParam.split(',').filter(Boolean) : null
    
    // Only list files in THIS user's folder
    const { data: files, error: listError } = await supabase.storage
      .from('lessons')
      .list(`facilitator-lessons/${userId}`, { limit: 1000 })
    
    if (listError) {
      return NextResponse.json([])
    }
    
    const out = []
    
    // Process each file in the user's folder
    for (const fileObj of files || []) {
      if (!fileObj.name.toLowerCase().endsWith('.json')) continue
      
      // OPTIMIZATION: Skip files not in the requested list
      if (requestedFiles && !requestedFiles.includes(fileObj.name)) {
        continue
      }
      
      try {
        // Bypass storage SDK and use direct REST API with service role
        const filePath = `facilitator-lessons/${userId}/${fileObj.name}`
        const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/lessons/${filePath}`
        
        const response = await fetch(storageUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
          }
        })
        
        if (!response.ok) {
          // Silent error - skip this file
          continue
        }
        
        const raw = await response.text()
        const js = JSON.parse(raw)
        const subj = (js.subject || '').toString().toLowerCase()
        const approved = js.approved === true
        const needsUpdate = js.needsUpdate === true
        out.push({ 
          file: fileObj.name,
          userId: userId,
          title: js.title || fileObj.name, 
          grade: js.grade || null, 
          difficulty: (js.difficulty || '').toLowerCase(), 
          subject: subj || null, 
          approved, 
          needsUpdate 
        })
      } catch (parseError) {
        // Silent error - skip this file
      }
    }
    
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
