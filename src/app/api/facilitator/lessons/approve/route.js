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

function approvalReadToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cacheBustedLessonPath(storagePath, token) {
  return `${storagePath}?approval=${encodeURIComponent(token)}`
}
const APPROVAL_CONFIRMATION_DELAYS_MS = [0, 50, 150, 300, 600]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function confirmApprovedLesson(lessonStorage, storagePath, { sleepImpl = sleep, cacheBustToken = approvalReadToken() } = {}) {
  let lastError = null
  let attempt = 0
  for (const delayMs of APPROVAL_CONFIRMATION_DELAYS_MS) {
    if (delayMs > 0) await sleepImpl(delayMs)
    const readPath = cacheBustedLessonPath(storagePath, `${cacheBustToken}-confirm-${attempt}`)
    attempt += 1
    const { data, error } = await lessonStorage.download(readPath)
    if (error || !data) {
      lastError = error || new Error('Approval confirmation returned no lesson data')
      continue
    }
    try {
      const lesson = JSON.parse(await data.text())
      if (lesson?.approved === true) return { lesson, error: null }
    } catch (error) {
      lastError = error
    }
  }
  return { lesson: null, error: lastError }
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
    const storagePath = `facilitator-lessons/${user.id}/${file}`
    const lessonStorage = supabase.storage.from('lessons')
    const readToken = deps.approvalReadToken || approvalReadToken()
    const { data: fileData, error: downloadError } = await lessonStorage.download(
      cacheBustedLessonPath(storagePath, `${readToken}-initial`),
    )
    
    if (downloadError || !fileData) {
      return NextResponse.json({ error:'Lesson not found in storage' }, { status: 404 })
    }
    
    const raw = await fileData.text()
    const js = JSON.parse(raw)
    
    let confirmedLesson = js
    const alreadyApproved = js.approved === true && js.needsUpdate !== true

    if (!alreadyApproved) {
      // Mark as approved and clear needsUpdate flag. Storage can briefly serve
      // the previous object after a successful overwrite, so confirmation is
      // bounded and retryable instead of treating the first stale read as loss.
      js.approved = true
      if (js.needsUpdate) delete js.needsUpdate

      const updatedContent = JSON.stringify(js, null, 2)
      const { error: updateError } = await lessonStorage.update(storagePath, updatedContent, {
        contentType: 'application/json',
        cacheControl: '0',
      })

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 })
      }

      const confirmation = await confirmApprovedLesson(lessonStorage, storagePath, {
        sleepImpl: deps.sleepImpl,
        cacheBustToken: readToken,
      })
      if (!confirmation.lesson) {
        return NextResponse.json({
          error: 'Approval was saved but storage has not reflected it yet. Please retry approval.',
          code: 'APPROVAL_CONFIRMATION_DELAYED',
          retryable: true,
        }, { status: 503 })
      }
      confirmedLesson = confirmation.lesson
    }
    const totalTime = Date.now() - startTime
    const identity = buildCanonicalLessonIdentity({ file, ownerId: user.id, storagePath })
    return NextResponse.json({
      ok: true,
      approved: true,
      file,
      identity,
      lessonKey: identity?.lessonKey,
      storagePath,
      ownerId: user.id,
      lesson: confirmedLesson,
      timeMs: totalTime,
    })
  } catch (e) {
    // General exception
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
