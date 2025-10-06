import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function readUserAndTier(request){
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return { user: null, plan_tier: 'free' }
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { user: null, plan_tier: 'free' }
    const admin = svc ? createClient(url, svc, { auth: { persistSession:false } }) : null
    let plan = 'free'
    if (admin) {
      const { data } = await admin.from('profiles').select('plan_tier').eq('id', user.id).maybeSingle()
      plan = (data?.plan_tier || 'free').toLowerCase()
    }
    return { user, plan_tier: plan }
  } catch {
    return { user: null, plan_tier: 'free' }
  }
}

export async function POST(request){
  const { user, plan_tier } = await readUserAndTier(request)
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status: 401 })
  if (plan_tier !== 'premium') return NextResponse.json({ error:'Premium plan required' }, { status: 403 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error:'Invalid body' }, { status: 400 }) }
  const file = (body?.file || '').toString()
  const userId = body?.userId || user.id // Use provided userId or fall back to current user
  if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) return NextResponse.json({ error:'Invalid file' }, { status: 400 })
  
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !svc) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    
    const supabase = createClient(url, svc, { auth: { persistSession: false } })
    
    // Delete from Supabase Storage
    const storagePath = `facilitator-lessons/${userId}/${file}`
    const { error: deleteError } = await supabase.storage
      .from('lessons')
      .remove([storagePath])
    
    if (deleteError) {
      console.error('Storage delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
    return NextResponse.json({ ok:true })
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
