import { NextResponse } from 'next/server.js'
import { featuresForTier, resolveEffectiveTier } from '../../../../lib/entitlements.js'
import { buildCanonicalLessonIdentity } from '../../../../lib/facilitatorPreparation.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function readUserAndTier(request, { createClientImpl = null } = {}){
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return { user: null, plan_tier: 'free', supabase: null }
    const createClient = createClientImpl || (await import('@supabase/supabase-js')).createClient
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { user: null, plan_tier: 'free', supabase: null }
    const admin = svc ? createClient(url, svc, { auth: { persistSession:false } }) : null
    let plan = 'free'
    if (admin) {
      const { data } = await admin.from('profiles').select('subscription_tier, plan_tier').eq('id', user.id).maybeSingle()
      plan = resolveEffectiveTier(data?.subscription_tier, data?.plan_tier)
    } else {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('subscription_tier, plan_tier')
          .eq('id', user.id)
          .maybeSingle()
        if (!error) {
          plan = resolveEffectiveTier(data?.subscription_tier, data?.plan_tier)
        }
      } catch {
        // ignore
      }
    }
    return { user, plan_tier: plan, supabase: admin || supabase }
  } catch {
    return { user: null, plan_tier: 'free', supabase: null }
  }
}

export async function POST(request, deps = {}){
  const startTime = Date.now()
  const { user, plan_tier, supabase } = await readUserAndTier(request, deps)
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status: 401 })
  if (!featuresForTier(plan_tier).lessonGenerator) return NextResponse.json({ error:'Lesson Generator plan required' }, { status: 403 })
  if (!supabase) return NextResponse.json({ error:'Storage not configured' }, { status: 500 })
  
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error:'Invalid body' }, { status: 400 }) }
  const file = (body?.file || '').toString()
  if (!file || file.includes('..') || file.includes('/') || file.includes('\\\\')) return NextResponse.json({ error:'Invalid file' }, { status: 400 })

  try {
    // Download from Supabase Storage
    const storagePath = `facilitator-lessons/${user.id}/${file}`
    const downloadStart = Date.now()
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('lessons')
      .download(storagePath)
    
    if (downloadError || !fileData) {
      return NextResponse.json({ error:'Lesson not found in storage' }, { status: 404 })
    }
    
    const raw = await fileData.text()
    const js = JSON.parse(raw)
    
    // Mark as approved and clear needsUpdate flag
    js.approved = true
    if (js.needsUpdate) delete js.needsUpdate
    
    // Update the original file to mark it as approved
    const uploadStart = Date.now()
    const updatedContent = JSON.stringify(js, null, 2)
    const blob = new Blob([updatedContent], { type: 'application/json' })
    
    const { error: updateError } = await supabase.storage
      .from('lessons')
      .upload(storagePath, blob, {
        contentType: 'application/json',
        upsert: true,
        cacheControl: '3600'
      })
    
    if (updateError) {
      return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 })
    }
    
    const totalTime = Date.now() - startTime
    const identity = buildCanonicalLessonIdentity({ file, ownerId: user.id, storagePath })
    return NextResponse.json({ ok:true, file, identity, lessonKey: identity?.lessonKey, storagePath, ownerId: user.id, timeMs: totalTime })
  } catch (e) {
    // General exception
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
