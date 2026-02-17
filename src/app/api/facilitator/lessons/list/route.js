import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

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
  const debug = process.env.DEBUG_LESSONS === '1'
  const startedAt = Date.now()
  try {
    const supabase = await getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    
    // SECURITY: Require authentication and only return lessons for the authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log('[api/facilitator/lessons/list]', '401 missing bearer')
      }
      return NextResponse.json({ error: 'Unauthorized - login required' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log('[api/facilitator/lessons/list]', '401 invalid token', {
          authError: authError?.message || null,
          ms: Date.now() - startedAt,
        })
      }
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    
    const userId = user.id

    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/facilitator/lessons/list]', 'start', {
        userId,
        ms: Date.now() - startedAt,
      })
    }
    
    // OPTIMIZATION: Accept filenames query parameter to only load specific files
    const { searchParams } = new URL(request.url)
    const filenamesParam = searchParams.get('filenames')
    const requestedFiles = filenamesParam ? filenamesParam.split(',').filter(Boolean) : null
    
    // Only list files in THIS user's folder
    const { data: files, error: listError } = await supabase.storage
      .from('lessons')
      .list(`facilitator-lessons/${userId}`, { limit: 1000 })
    
    if (listError) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log('[api/facilitator/lessons/list]', 'list error', { message: listError?.message || String(listError) })
      }
      return NextResponse.json([])
    }

    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/facilitator/lessons/list]', 'listed', { count: (files || []).length, ms: Date.now() - startedAt })
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
        const oneStartedAt = Date.now()
        // Bypass storage SDK and use direct REST API with service role
        const filePath = `facilitator-lessons/${userId}/${fileObj.name}`
        const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/lessons/${filePath}`
        
        const response = await fetchWithTimeout(storageUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
          }
        }, 15000)
        
        if (!response.ok) {
          if (debug) {
            // eslint-disable-next-line no-console
            console.log('[api/facilitator/lessons/list]', 'skip file (status)', {
              name: fileObj.name,
              status: response.status,
              ms: Date.now() - oneStartedAt,
            })
          }
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

        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[api/facilitator/lessons/list]', 'loaded file', {
            name: fileObj.name,
            subject: subj || null,
            ms: Date.now() - oneStartedAt,
          })
        }
      } catch (parseError) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[api/facilitator/lessons/list]', 'skip file (error)', {
            name: fileObj?.name,
            message: parseError?.message || String(parseError),
          })
        }
        // Silent error - skip this file
      }
    }
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/facilitator/lessons/list]', 'done', { count: out.length, ms: Date.now() - startedAt })
    }
    return NextResponse.json(out)
  } catch (e) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/facilitator/lessons/list]', 'ERR', { message: e?.message || String(e), ms: Date.now() - startedAt })
    }
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
