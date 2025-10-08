import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function readUserAndTier(request){
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return { user: null, plan_tier: 'free', supabase: null }
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { user: null, plan_tier: 'free', supabase: null }
    const admin = svc ? createClient(url, svc, { auth: { persistSession:false } }) : null
    let plan = 'free'
    if (admin) {
      const { data } = await admin.from('profiles').select('plan_tier').eq('id', user.id).maybeSingle()
      plan = (data?.plan_tier || 'free').toLowerCase()
    }
    return { user, plan_tier: plan, supabase: admin || supabase }
  } catch {
    return { user: null, plan_tier: 'free', supabase: null }
  }
}

export async function POST(request){
  console.log('[APPROVE API] Request received')
  const { user, plan_tier, supabase } = await readUserAndTier(request)
  console.log('[APPROVE API] User:', user?.id, 'Plan:', plan_tier)
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status: 401 })
  if (plan_tier !== 'premium') return NextResponse.json({ error:'Premium plan required' }, { status: 403 })
  if (!supabase) return NextResponse.json({ error:'Storage not configured' }, { status: 500 })
  
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error:'Invalid body' }, { status: 400 }) }
  const file = (body?.file || '').toString()
  const userId = body?.userId || user.id // Use provided userId or fall back to current user
  console.log('[APPROVE API] File:', file, 'UserId:', userId)
  if (!file || file.includes('..') || file.includes('/') || file.includes('\\\\')) return NextResponse.json({ error:'Invalid file' }, { status: 400 })

  try {
    // Download from Supabase Storage
    const storagePath = `facilitator-lessons/${userId}/${file}`
    console.log('[APPROVE API] Storage path:', storagePath)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('lessons')
      .download(storagePath)
    
    if (downloadError || !fileData) {
      console.error('[APPROVE API] Download error:', downloadError)
      return NextResponse.json({ error:'Lesson not found in storage' }, { status: 404 })
    }
    
    const raw = await fileData.text()
    const js = JSON.parse(raw)
    console.log('[APPROVE API] Current approved status:', js.approved)
    
    // Mark as approved and clear needsUpdate flag
    js.approved = true
    if (js.needsUpdate) delete js.needsUpdate
    
    console.log('[APPROVE API] New approved status:', js.approved)
    
    // Update the original file to mark it as approved
    const { error: updateError } = await supabase.storage
      .from('lessons')
      .upload(storagePath, JSON.stringify(js, null, 2), {
        contentType: 'application/json',
        upsert: true
      })
    
    if (updateError) {
      console.error('[APPROVE API] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 })
    }
    
    console.log('[APPROVE API] Success!')
    return NextResponse.json({ ok:true, file })
  } catch (e) {
    console.error('[APPROVE API] Exception:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
