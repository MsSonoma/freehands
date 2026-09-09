import { NextResponse } from 'next/server'
import { resolveEffectiveTier, featuresForTier } from '@/app/lib/entitlements'
import { AI_MODEL } from '@/app/lib/aiModel'
import { canonicalizeAiGeneratedLessonChoices } from '@/app/lib/aiGeneratedChoiceOrder.mjs'
import { buildCanonicalLessonIdentity } from '@/app/lib/facilitatorPreparation.mjs'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'
import { LessonRevisionStateError, synchronizeLessonRevisionState } from '@/app/lib/lessonRevision.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function readUserAndTier(request, { createClientImpl = null } = {}) {
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return { user: null, tier: 'free', supabase: null }
    const createClient = createClientImpl || (await import('@supabase/supabase-js')).createClient
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { user: null, tier: 'free', supabase: null }
    const admin = svc ? createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } }) : null
    let subscriptionTier = null
    let paidTier = 'free'
    const profileClient = admin || supabase
    try {
      const { data } = await profileClient.from('profiles').select('subscription_tier, plan_tier').eq('id', user.id).maybeSingle()
      subscriptionTier = data?.subscription_tier || null
      paidTier = (data?.plan_tier || 'free').toLowerCase()
    } catch {}
    return { user, tier: resolveEffectiveTier(subscriptionTier, paidTier), supabase: admin || supabase }
  } catch {
    return { user: null, tier: 'free', supabase: null }
  }
}

export function buildChangePrompt(existingLesson, changeRequest) {
  const lessonText = JSON.stringify(existingLesson, null, 2)
  return `You are an education content editor. You have an existing lesson in JSON format. The facilitator has requested changes to this lesson. Apply the requested changes while maintaining the lesson structure and educational intent unless the request explicitly changes that intent.

Existing lesson:
${lessonText}

Facilitator change request:
${changeRequest}

CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE EXACTLY:
1. Each question type (truefalse, multiplechoice, fillintheblank, shortanswer) needs at least 10 complete questions
2. For shortanswer and fillintheblank:
   - EVERY SINGLE QUESTION must have at least 3 items in the "expectedAny" array
   - Include the main answer, synonyms, alternative phrasings, and common variations
3. True/false questions must have complete question text
4. Multiple choice must have exactly 4 distinct choices and a correct index (0-3). Vary correct positions across 0, 1, 2, and 3; do not default answers to index 0
5. Fill-in-the-blank questions must contain _____ placeholder
6. Preserve materialization and identity metadata from the existing lesson

Return the updated lesson as valid JSON only. No markdown. No commentary. Keep all existing fields unless the change request specifically modifies them. Ensure kid-safe language and age-appropriate content.`
}

async function callModel(prompt) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OpenAI API key not configured')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: 'Return only valid JSON. No markdown. No commentary.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    }),
  })
  if (!res.ok) throw new Error(`Model error ${res.status}`)
  const js = await res.json()
  const text = js?.choices?.[0]?.message?.content || '{}'
  try { return JSON.parse(text) } catch { throw new Error('Model returned invalid JSON') }
}

function revisionIdentity(body, userId) {
  const requestedKey = normalizeLessonKey(body?.lessonKey)
  let file = String(body?.file || '').trim()
  let lessonKey = requestedKey
  if (lessonKey) {
    if (!lessonKey.startsWith('generated/')) return null
    file = lessonKey.slice('generated/'.length)
  } else if (file) {
    lessonKey = normalizeLessonKey(`generated/${file}`)
  }
  if (!lessonKey || !file || file.includes('..') || file.includes('/') || file.includes('\\')) return null
  const storagePath = `facilitator-lessons/${userId}/${file}`
  return { file, lessonKey, storagePath }
}

function cacheBustedPath(storagePath) {
  return `${storagePath}?revision=${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function POST(request, deps = {}) {
  const { user, tier, supabase } = await readUserAndTier(request, deps)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!featuresForTier(tier).lessonGenerator) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 })
  if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })

  const body = await request.json().catch(() => null)
  const identityInput = revisionIdentity(body, user.id)
  const changeRequest = String(body?.changeRequest || '').trim()
  if (!identityInput || changeRequest.length < 4) {
    return NextResponse.json({ error: 'A generated lesson and a clear change request are required' }, { status: 400 })
  }

  try {
    const lessonStorage = supabase.storage.from('lessons')
    const { data: fileData, error: downloadError } = await lessonStorage.download(cacheBustedPath(identityInput.storagePath))
    if (downloadError || !fileData) return NextResponse.json({ error: 'Lesson file not found' }, { status: 404 })

    const existingLesson = JSON.parse(await fileData.text())
    const wasApproved = existingLesson.approved === true
    const prompt = (deps.buildChangePrompt || buildChangePrompt)(existingLesson, changeRequest)
    const revised = await (deps.callModel || callModel)(prompt)

    revised.id = existingLesson.id || revised.id
    revised.title = revised.title || existingLesson.title
    revised.grade = revised.grade || existingLesson.grade
    revised.difficulty = revised.difficulty || existingLesson.difficulty
    revised.subject = revised.subject || existingLesson.subject
    revised.userId = existingLesson.userId || revised.userId || user.id
    if (existingLesson.materialization_operation) revised.materialization_operation = existingLesson.materialization_operation
    revised.approved = false
    if (wasApproved || existingLesson.needsUpdate === true) revised.needsUpdate = true
    else if (Object.prototype.hasOwnProperty.call(revised, 'needsUpdate')) delete revised.needsUpdate

    const canonicalLesson = canonicalizeAiGeneratedLessonChoices(revised, { rng: deps.choiceOrderRng })
    const synchronize = deps.synchronizeLessonRevisionState || synchronizeLessonRevisionState
    const state = await synchronize({
      admin: supabase,
      facilitatorId: user.id,
      lessonKey: identityInput.lessonKey,
      now: deps.now || new Date(),
    })

    const updatedContent = JSON.stringify(canonicalLesson, null, 2)
    const { error: uploadError } = await lessonStorage.update(identityInput.storagePath, updatedContent, {
      contentType: 'application/json',
      cacheControl: '0',
    })
    if (uploadError) {
      return NextResponse.json({
        error: 'The lesson was made unavailable for safety, but the regenerated content could not be saved. Retry regeneration before approving it.',
        code: 'LESSON_REVISION_STORAGE_FAILED',
        stateReset: true,
      }, { status: 500 })
    }

    const identity = buildCanonicalLessonIdentity({ file: identityInput.file, ownerId: user.id, storagePath: identityInput.storagePath })
    return NextResponse.json({
      ok: true,
      file: identityInput.file,
      identity,
      lessonKey: identity?.lessonKey || identityInput.lessonKey,
      storagePath: identityInput.storagePath,
      ownerId: user.id,
      lesson: canonicalLesson,
      previousApproved: wasApproved,
      state,
      message: 'Lesson regenerated and returned to draft for review',
    })
  } catch (error) {
    const status = error instanceof LessonRevisionStateError ? error.status : 500
    return NextResponse.json({
      error: error?.message || String(error),
      ...(error?.code ? { code: error.code } : {}),
    }, { status })
  }
}